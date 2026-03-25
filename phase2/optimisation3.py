from __future__ import annotations

import argparse
import json
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
    load_acoustic_constraints,
    load_transport_constraints,
    load_wind_observations,
    read_turbines,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Optimisation WEEX phase 2 (descente de gradient).")
    parser.add_argument("--scenario", type=int, default=1)
    parser.add_argument("--constraint-set", type=int, default=1)
    parser.add_argument("--theta-step", type=int, default=30)
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT_DIR / "public" / "generated" / "optimisation3_result.json",
    )
    parser.add_argument(
        "--wind-output",
        type=Path,
        default=ROOT_DIR / "phase2" / "data" / "wind_aggregated.json",
    )
    return parser.parse_args()


def _best_option_by_gain(
    options: list[dict[str, Any]], current: dict[str, Any] | None, budget_left: int
) -> dict[str, Any] | None:
    current_cost = int(current["cost_total_eur"]) if current else 0
    current_profit = float(current["profit_net_eur_per_year"]) if current else 0.0
    best: dict[str, Any] | None = None
    best_score = 0.0
    for opt in options:
        delta_cost = int(opt["cost_total_eur"]) - current_cost
        delta_profit = float(opt["profit_net_eur_per_year"]) - current_profit
        if delta_cost <= 0:
            continue
        if delta_cost > budget_left:
            continue
        score = delta_profit / delta_cost
        if score > best_score:
            best_score = score
            best = opt
    return best


def optimize_global_gradient_descent(
    options_by_parcel: dict[str, list[dict[str, Any]]],
    cfg: Config,
    parcels: list[str],
) -> list[dict[str, Any]]:
    selected: dict[str, dict[str, Any]] = {}
    used_budget = 0
    budget_limit = int(cfg.budget_limit_eur)

    while True:
        budget_left = budget_limit - used_budget
        if budget_left <= 0:
            break

        best_parcel: str | None = None
        best_candidate: dict[str, Any] | None = None
        best_score = 0.0

        for parcel in parcels:
            current = selected.get(parcel)
            candidate = _best_option_by_gain(options_by_parcel[parcel], current, budget_left)
            if not candidate:
                continue

            current_cost = int(current["cost_total_eur"]) if current else 0
            current_profit = float(current["profit_net_eur_per_year"]) if current else 0.0
            delta_cost = int(candidate["cost_total_eur"]) - current_cost
            delta_profit = float(candidate["profit_net_eur_per_year"]) - current_profit
            if delta_cost <= 0 or delta_profit <= 0:
                continue

            score = delta_profit / delta_cost
            if score > best_score:
                best_score = score
                best_parcel = parcel
                best_candidate = candidate

        if not best_parcel or not best_candidate:
            break

        current = selected.get(best_parcel)
        old_cost = int(current["cost_total_eur"]) if current else 0
        new_cost = int(best_candidate["cost_total_eur"])
        used_budget += new_cost - old_cost
        selected[best_parcel] = best_candidate

    placements = [selected[p] for p in parcels if p in selected]
    return placements


def main() -> None:
    args = parse_args()
    cfg = Config(theta_step_deg=args.theta_step)
    allowed_parcels = allowed_parcels_for_constraint_set(args.constraint_set)
    transport_constraints, transport_globals = load_transport_constraints(TRANSPORT_CONSTRAINTS_PATH)
    acoustic_constraints = load_acoustic_constraints(ROOT_DIR / "phase2" / "data" / "acoustic_constraints.json")
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
            acoustic_constraints=acoustic_constraints,
        )
        for parcel in allowed_parcels
    }
    placements = optimize_global_gradient_descent(
        options_by_parcel=options_by_parcel,
        cfg=cfg,
        parcels=allowed_parcels,
    )

    result = {
        "scenario": args.scenario,
        "constraint_set": args.constraint_set,
        "objective_model_version": "phase2_v3_gradient_descent",
        "summary": compute_summary(placements, cfg),
        "placements": placements,
        "meta": {
            "method": "gradient_descent_discrete",
            "allowed_parcels": allowed_parcels,
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
