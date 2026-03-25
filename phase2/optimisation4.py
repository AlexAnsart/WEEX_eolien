from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from optimisation import (
    ACOUSTIC_CONSTRAINTS_PATH,
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
    parser = argparse.ArgumentParser(description="Optimisation WEEX phase 2 (force brute + elagage).")
    parser.add_argument("--scenario", type=int, default=1)
    parser.add_argument("--constraint-set", type=int, default=1)
    parser.add_argument("--theta-step", type=int, default=60)
    parser.add_argument("--max-options-per-parcel", type=int, default=180)
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT_DIR / "public" / "generated" / "optimisation4_result.json",
    )
    parser.add_argument(
        "--wind-output",
        type=Path,
        default=ROOT_DIR / "phase2" / "data" / "wind_aggregated.json",
    )
    return parser.parse_args()


def optimize_global_bruteforce(
    options_by_parcel: dict[str, list[dict[str, Any]]],
    cfg: Config,
    parcels: list[str],
) -> list[dict[str, Any]]:
    budget_limit = int(cfg.budget_limit_eur)

    all_options: dict[str, list[dict[str, Any]]] = {
        p: [{"parcel_id": p, "cost_total_eur": 0, "energy_mwh_per_year": 0.0, "none": True}] + options_by_parcel[p]
        for p in parcels
    }

    # Tri décroissant en énergie pour accélérer la convergence.
    for p in parcels:
        all_options[p].sort(key=lambda x: float(x.get("energy_mwh_per_year", 0.0)), reverse=True)

    # Borne supérieure: somme des max énergies restantes.
    max_energy_per_parcel = [max(float(o.get("energy_mwh_per_year", 0.0)) for o in all_options[p]) for p in parcels]
    suffix_upper_bound = [0.0] * (len(parcels) + 1)
    for i in range(len(parcels) - 1, -1, -1):
        suffix_upper_bound[i] = suffix_upper_bound[i + 1] + max_energy_per_parcel[i]

    best_energy = -1.0
    best_selection: list[dict[str, Any]] = []
    current_selection: list[dict[str, Any]] = []

    # Memo de dominance: (idx, budget_quantized) -> meilleure énergie atteinte.
    seen_best: dict[tuple[int, int], float] = {}

    def dfs(idx: int, used_budget: int, current_energy: float) -> None:
        nonlocal best_energy, best_selection

        if used_budget > budget_limit:
            return
        if idx == len(parcels):
            if current_energy > best_energy:
                best_energy = current_energy
                best_selection = list(current_selection)
            return

        # Branch and bound global.
        if current_energy + suffix_upper_bound[idx] <= best_energy:
            return

        q_budget = used_budget // cfg.budget_quantization_eur
        key = (idx, q_budget)
        prev = seen_best.get(key)
        if prev is not None and prev >= current_energy:
            return
        seen_best[key] = current_energy

        parcel = parcels[idx]
        for opt in all_options[parcel]:
            next_budget = used_budget + int(opt["cost_total_eur"])
            if next_budget > budget_limit:
                continue
            next_energy = current_energy + float(opt.get("energy_mwh_per_year", 0.0))
            if not opt.get("none"):
                current_selection.append(opt)
            dfs(idx + 1, next_budget, next_energy)
            if not opt.get("none"):
                current_selection.pop()

    dfs(0, 0, 0.0)
    return best_selection


def main() -> None:
    args = parse_args()
    cfg = Config(theta_step_deg=args.theta_step, max_options_per_parcel=args.max_options_per_parcel)
    allowed_parcels = allowed_parcels_for_constraint_set(args.constraint_set)
    transport_constraints, transport_globals = load_transport_constraints(TRANSPORT_CONSTRAINTS_PATH)
    acoustic_constraints = load_acoustic_constraints(ACOUSTIC_CONSTRAINTS_PATH)
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
    placements = optimize_global_bruteforce(options_by_parcel, cfg, parcels=allowed_parcels)

    result = {
        "scenario": args.scenario,
        "constraint_set": args.constraint_set,
        "objective_model_version": "phase2_v4_bruteforce_branch_and_bound",
        "summary": compute_summary(placements, cfg),
        "placements": placements,
        "meta": {
            "method": "bruteforce_branch_and_bound",
            "allowed_parcels": allowed_parcels,
            "theta_step_deg": cfg.theta_step_deg,
            "max_options_per_parcel": cfg.max_options_per_parcel,
            "buyback_price_eur_per_mwh": cfg.buyback_price_eur_per_mwh,
            "maintenance_cost_eur_per_mwh": cfg.maintenance_cost_eur_per_mwh,
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
                "total_energy_mwh_per_year": result["summary"]["total_energy_mwh_per_year"],
            }
        )
    )


if __name__ == "__main__":
    main()
