from __future__ import annotations

import argparse
import json
from pathlib import Path

from optimisation import (
    ACOUSTIC_CONSTRAINTS_PATH,
    Config,
    OFFSHORE_PARCELS,
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
    parser = argparse.ArgumentParser(description="Optimisation WEEX phase 2 (DP priorite offshore).")
    parser.add_argument("--scenario", type=int, default=1)
    parser.add_argument("--constraint-set", type=int, default=1)
    parser.add_argument("--theta-step", type=int, default=60)
    parser.add_argument("--offshore-priority-factor", type=float, default=2.0)
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT_DIR / "public" / "generated" / "optimisation5_result.json",
    )
    parser.add_argument(
        "--wind-output",
        type=Path,
        default=ROOT_DIR / "phase2" / "data" / "wind_aggregated.json",
    )
    return parser.parse_args()


def optimize_global_offshore_priority(
    options_by_parcel: dict[str, list[dict[str, Any]]], cfg: Config, parcels: list[str], offshore_priority_factor: float
) -> list[dict[str, Any]]:
    """
    Objectif principal: favoriser fortement l'offshore via un score pondéré.
    Objectif secondaire implicite: maximiser l'énergie réelle sous budget.
    """
    budget_steps = cfg.budget_limit_eur // cfg.budget_quantization_eur
    all_options = {
        p: [{"parcel_id": p, "cost_total_eur": 0, "energy_mwh_per_year": 0.0, "none": True}] + options_by_parcel[p]
        for p in parcels
    }

    dp_score = [-1e30] * (budget_steps + 1)
    dp_score[0] = 0.0
    dp_energy = [-1e30] * (budget_steps + 1)
    dp_energy[0] = 0.0
    choice: list[list[int]] = [[-1] * (budget_steps + 1) for _ in parcels]
    previous_budget: list[list[int]] = [[-1] * (budget_steps + 1) for _ in parcels]

    for i, parcel in enumerate(parcels):
        nxt_score = [-1e30] * (budget_steps + 1)
        nxt_energy = [-1e30] * (budget_steps + 1)
        for b in range(budget_steps + 1):
            if dp_score[b] <= -1e20:
                continue
            for opt_idx, opt in enumerate(all_options[parcel]):
                c = int(opt["cost_total_eur"] // cfg.budget_quantization_eur)
                nb = b + c
                if nb > budget_steps:
                    continue
                e = float(opt.get("energy_mwh_per_year", 0.0))
                is_offshore = opt.get("install_kind") == "offshore" or opt.get("parcel_id") in OFFSHORE_PARCELS
                score = dp_score[b] + (e * offshore_priority_factor if is_offshore else e)
                energy = dp_energy[b] + e
                if (score > nxt_score[nb]) or (score == nxt_score[nb] and energy > nxt_energy[nb]):
                    nxt_score[nb] = score
                    nxt_energy[nb] = energy
                    choice[i][nb] = opt_idx
                    previous_budget[i][nb] = b
        dp_score = nxt_score
        dp_energy = nxt_energy

    # Choisit le meilleur score, puis l'énergie en départage.
    reachable_budgets = [b for b in range(budget_steps + 1) if dp_score[b] > -1e20]
    if not reachable_budgets:
        return []
    end_budget = max(reachable_budgets, key=lambda b: (dp_score[b], dp_energy[b]))

    selected: list[dict[str, Any]] = []
    b = end_budget
    for i in range(len(parcels) - 1, -1, -1):
        opt_idx = choice[i][b]
        if opt_idx < 0:
            continue
        opt = all_options[parcels[i]][opt_idx]
        if not opt.get("none"):
            selected.append(opt)
        b = previous_budget[i][b]
        if b < 0:
            b = 0
    selected.reverse()
    return selected


def main() -> None:
    args = parse_args()
    cfg = Config(theta_step_deg=args.theta_step)
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
    placements = optimize_global_offshore_priority(
        options_by_parcel, cfg, parcels=allowed_parcels, offshore_priority_factor=args.offshore_priority_factor
    )

    result = {
        "scenario": args.scenario,
        "constraint_set": args.constraint_set,
        "objective_model_version": "phase2_v5_dp_offshore_priority",
        "summary": compute_summary(placements, cfg),
        "placements": placements,
        "meta": {
            "method": "dynamic_programming",
            "offshore_priority_factor": args.offshore_priority_factor,
            "objective_priority": ["maximize_offshore_weighted_energy", "maximize_energy_mwh_per_year"],
            "allowed_parcels": allowed_parcels,
            "theta_step_deg": cfg.theta_step_deg,
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
