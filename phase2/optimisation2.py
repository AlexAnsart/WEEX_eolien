from __future__ import annotations

import argparse
import json
import random
from pathlib import Path
from typing import Any

from optimisation import (
    Config,
    ROOT_DIR,
    TRANSPORT_CONSTRAINTS_PATH,
    allowed_parcels_for_constraint_set,
    build_options_for_parcel,
    build_parcel_distribution_20y,
    build_wind_aggregated,
    compute_summary,
    load_transport_constraints,
    load_wind_observations,
    read_turbines,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Optimisation WEEX phase 2 (Monte-Carlo).")
    parser.add_argument("--scenario", type=int, default=1)
    parser.add_argument("--constraint-set", type=int, default=1)
    parser.add_argument("--theta-step", type=int, default=30)
    parser.add_argument("--iterations", type=int, default=4000)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT_DIR / "public" / "generated" / "optimisation2_result.json",
    )
    parser.add_argument(
        "--wind-output",
        type=Path,
        default=ROOT_DIR / "phase2" / "data" / "wind_aggregated.json",
    )
    return parser.parse_args()


def optimize_global_monte_carlo(
    options_by_parcel: dict[str, list[dict[str, Any]]],
    cfg: Config,
    parcels: list[str],
    iterations: int,
    seed: int,
) -> list[dict[str, Any]]:
    rng = random.Random(seed)
    budget_limit = int(cfg.budget_limit_eur)

    best_profit = -1.0
    best_solution: list[dict[str, Any]] = []

    for _ in range(max(1, iterations)):
        order = list(parcels)
        rng.shuffle(order)

        current_budget = 0
        current_profit = 0.0
        current_solution: list[dict[str, Any]] = []

        for parcel in order:
            feasible = [
                opt
                for opt in options_by_parcel[parcel]
                if current_budget + int(opt["cost_total_eur"]) <= budget_limit
            ]
            if not feasible:
                continue

            # Bias vers les bonnes options, avec une part d'exploration aléatoire.
            feasible.sort(key=lambda x: float(x["profit_net_eur_per_year"]), reverse=True)
            top_k = feasible[: min(8, len(feasible))]
            chosen = rng.choice(top_k if rng.random() < 0.7 else feasible)

            current_solution.append(chosen)
            current_budget += int(chosen["cost_total_eur"])
            current_profit += float(chosen["profit_net_eur_per_year"])

        if current_profit > best_profit:
            best_profit = current_profit
            best_solution = current_solution

    return best_solution


def main() -> None:
    args = parse_args()
    cfg = Config(theta_step_deg=args.theta_step)
    allowed_parcels = allowed_parcels_for_constraint_set(args.constraint_set)
    transport_constraints, transport_globals = load_transport_constraints(TRANSPORT_CONSTRAINTS_PATH)
    cfg.transport_steering_angle_deg = float(
        transport_globals.get("steering_max_angle_deg", cfg.transport_steering_angle_deg)
    )
    cfg.transport_max_distance_m = float(
        transport_globals.get("max_distance_to_site_m", cfg.transport_max_distance_m)
    )
    cfg.truck_base_mass_t = float(transport_globals.get("truck_base_mass_t", cfg.truck_base_mass_t))
    cfg.truck_blade_mass_factor_t_per_m = float(
        transport_globals.get("truck_blade_mass_factor_t_per_m", cfg.truck_blade_mass_factor_t_per_m)
    )

    turbines = read_turbines(ROOT_DIR / "phase2" / "data" / "turbines.json")
    yearly_obs = load_wind_observations(allowed_parcels)
    wind_agg = build_wind_aggregated(yearly_obs)
    parcel_dist_20y = build_parcel_distribution_20y(yearly_obs, allowed_parcels)

    options_by_parcel = {
        parcel: build_options_for_parcel(
            parcel=parcel,
            parcel_distribution=parcel_dist_20y[parcel],
            turbines=turbines,
            cfg=cfg,
            transport_constraints=transport_constraints,
        )
        for parcel in allowed_parcels
    }
    placements = optimize_global_monte_carlo(
        options_by_parcel=options_by_parcel,
        cfg=cfg,
        parcels=allowed_parcels,
        iterations=args.iterations,
        seed=args.seed,
    )

    result = {
        "scenario": args.scenario,
        "constraint_set": args.constraint_set,
        "objective_model_version": "phase2_v2_monte_carlo",
        "summary": compute_summary(placements, cfg),
        "placements": placements,
        "meta": {
            "method": "monte_carlo",
            "allowed_parcels": allowed_parcels,
            "iterations": args.iterations,
            "seed": args.seed,
            "theta_step_deg": cfg.theta_step_deg,
            "years_used": sorted(yearly_obs.keys()),
        },
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.wind_output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    args.wind_output.write_text(json.dumps(wind_agg, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        json.dumps(
            {
                "output": str(args.output),
                "placements": len(placements),
                "total_profit_eur_per_year": result["summary"]["total_profit_eur_per_year"],
            }
        )
    )


if __name__ == "__main__":
    main()
