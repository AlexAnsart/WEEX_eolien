from __future__ import annotations

import argparse
import json
import math
import re
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any


ROOT_DIR = Path(__file__).resolve().parents[1]
ALLOWED_PARCELS = [
    "3H",
    "3J",
    "4E",
    "4H",
    "5G",
    "6G",
    "7C",
    "8C",
    "8H",
    "9E",
    "9F",
    "11E",
    "12E",
    "13F",
    "14J",
    "15J",
    "16E",
    "18F",
    "18G",
    "18H",
]
# Parcelles marines (zones bleues de la carte Mission 2).
# Les autres parcelles autorisees sont considerees terrestres.
OFFSHORE_PARCELS = {"7C", "8C", "8H", "14J", "15J"}

DIAMETER_CLASSES = [200, 150, 135, 120, 110, 80, 60, 50, 30]
CAPACITY_BY_PARCEL: dict[str, dict[int, int]] = {
    "3H": {200: 0, 150: 0, 135: 20, 120: 23, 110: 25, 80: 32, 60: 36, 50: 38, 30: 42},
    "3J": {200: 0, 150: 0, 135: 17, 120: 20, 110: 21, 80: 27, 60: 30, 50: 32, 30: 36},
    "4E": {200: 0, 150: 0, 135: 17, 120: 20, 110: 22, 80: 27, 60: 31, 50: 33, 30: 36},
    "4H": {200: 0, 150: 0, 135: 19, 120: 22, 110: 24, 80: 30, 60: 34, 50: 36, 30: 40},
    "5G": {200: 0, 150: 0, 135: 18, 120: 21, 110: 23, 80: 29, 60: 33, 50: 35, 30: 39},
    "6G": {200: 0, 150: 0, 135: 19, 120: 22, 110: 24, 80: 30, 60: 34, 50: 36, 30: 40},
    "7C": {200: 6, 150: 15, 135: 18, 120: 0, 110: 0, 80: 0, 60: 0, 50: 0, 30: 0},
    "8C": {200: 5, 150: 14, 135: 16, 120: 0, 110: 0, 80: 0, 60: 0, 50: 0, 30: 0},
    "8H": {200: 5, 150: 13, 135: 15, 120: 0, 110: 0, 80: 0, 60: 0, 50: 0, 30: 0},
    "9E": {200: 0, 150: 0, 135: 16, 120: 19, 110: 21, 80: 26, 60: 29, 50: 31, 30: 34},
    "9F": {200: 0, 150: 0, 135: 17, 120: 19, 110: 21, 80: 26, 60: 30, 50: 32, 30: 35},
    "11E": {200: 0, 150: 0, 135: 17, 120: 20, 110: 22, 80: 27, 60: 31, 50: 32, 30: 36},
    "12E": {200: 0, 150: 0, 135: 18, 120: 21, 110: 23, 80: 28, 60: 32, 50: 34, 30: 38},
    "13F": {200: 0, 150: 0, 135: 17, 120: 19, 110: 21, 80: 26, 60: 30, 50: 31, 30: 35},
    "14J": {200: 6, 150: 15, 135: 17, 120: 0, 110: 0, 80: 0, 60: 0, 50: 0, 30: 0},
    "15J": {200: 6, 150: 15, 135: 17, 120: 0, 110: 0, 80: 0, 60: 0, 50: 0, 30: 0},
    "16E": {200: 0, 150: 0, 135: 20, 120: 23, 110: 25, 80: 32, 60: 36, 50: 38, 30: 42},
    "18F": {200: 0, 150: 0, 135: 19, 120: 22, 110: 24, 80: 29, 60: 33, 50: 35, 30: 39},
    "18G": {200: 0, 150: 0, 135: 17, 120: 20, 110: 21, 80: 27, 60: 30, 50: 32, 30: 36},
    "18H": {200: 0, 150: 0, 135: 17, 120: 19, 110: 21, 80: 26, 60: 30, 50: 32, 30: 35},
}


@dataclass
class Config:
    buyback_price_eur_per_mwh: float = 80.0
    maintenance_cost_eur_per_mwh: float = 30.0
    budget_limit_eur: int = 600_000_000
    roi_limit_years: float = 20.0
    theta_step_deg: int = 30
    direction_penalty_power: float = 1.8
    wake_loss_alpha: float = 0.009
    wake_loss_floor: float = 0.70
    budget_quantization_eur: int = 100_000
    max_options_per_parcel: int = 120
    yearly_aggregation_mode: str = "mean"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Optimisation WEEX phase 2.")
    parser.add_argument("--scenario", type=int, default=1)
    parser.add_argument("--constraint-set", type=int, default=1)
    parser.add_argument("--theta-step", type=int, default=30)
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT_DIR / "public" / "generated" / "optimisation_result.json",
    )
    parser.add_argument(
        "--wind-output",
        type=Path,
        default=ROOT_DIR / "phase2" / "data" / "wind_aggregated.json",
    )
    parser.add_argument(
        "--compare-output",
        type=Path,
        default=ROOT_DIR / "public" / "generated" / "optimisation_comparison.json",
    )
    return parser.parse_args()


def circular_distance_deg(a: float, b: float) -> float:
    d = abs((a - b) % 360.0)
    return min(d, 360.0 - d)


def diameter_class_strict(d_m: float) -> int:
    rounded = int(round(d_m))
    if rounded not in DIAMETER_CLASSES:
        raise ValueError(
            f"Diametre turbine non supporte par le tableau capacite: D={d_m}. "
            f"Valeurs autorisees: {DIAMETER_CLASSES}"
        )
    return rounded


def read_turbines(path: Path) -> list[dict[str, Any]]:
    turbines = json.loads(path.read_text(encoding="utf-8"))
    for t in turbines:
        t["diameter_class"] = diameter_class_strict(float(t["D_m"]))
    return turbines


def parse_wind_text(raw_text: str) -> list[tuple[float, float]]:
    values: list[tuple[float, float]] = []
    for line in raw_text.splitlines():
        if "NAN values refers" in line or "Day" in line:
            continue
        parts = re.findall(r"[-+]?\d*\.?\d+", line)
        if len(parts) < 5:
            continue
        velocity = float(parts[3])
        direction = float(parts[4]) % 360.0
        if velocity < 0:
            continue
        values.append((velocity, direction))
    return values


def _normalize_parcel_from_file_id(file_parcel: str) -> str:
    # "03H" -> "3H"
    return f"{int(file_parcel[:2])}{file_parcel[2]}"


def load_wind_observations() -> dict[str, dict[str, list[tuple[float, float]]]]:
    data_brut_dir = ROOT_DIR / "phase2" / "data" / "Data brut"
    if not data_brut_dir.exists():
        raise FileNotFoundError(f"Dossier introuvable: {data_brut_dir}")

    yearly: dict[str, dict[str, list[tuple[float, float]]]] = {}
    zip_paths = sorted(data_brut_dir.glob("*.zip"))
    if not zip_paths:
        raise FileNotFoundError(f"Aucun zip trouvé dans: {data_brut_dir}")

    txt_pattern = re.compile(r"([0-9]{2}[A-L])_([0-9]{4})\.txt$")
    allowed_set = set(ALLOWED_PARCELS)

    for zpath in zip_paths:
        with zipfile.ZipFile(zpath, "r") as zf:
            for member in zf.namelist():
                match = txt_pattern.search(member)
                if not match:
                    continue
                file_parcel, year = match.group(1), match.group(2)
                parcel = _normalize_parcel_from_file_id(file_parcel)
                if parcel not in allowed_set:
                    continue
                raw = zf.read(member).decode("utf-8", errors="ignore")
                obs = parse_wind_text(raw)
                yearly.setdefault(year, {})[parcel] = obs

    # Validation: chaque année doit contenir les 20 parcelles.
    years = sorted(yearly.keys())
    if not years:
        raise ValueError("Aucune donnée météo exploitable trouvée dans les zips Data brut.")
    for year in years:
        missing = sorted(set(ALLOWED_PARCELS) - set(yearly[year].keys()))
        if missing:
            raise ValueError(f"Année {year} incomplète, parcelles manquantes: {missing}")
    return yearly


def build_wind_aggregated(
    yearly_obs: dict[str, dict[str, list[tuple[float, float]]]]
) -> dict[str, Any]:
    out: dict[str, Any] = {"years": sorted(yearly_obs.keys()), "parcels": {}}
    for year, parcel_map in sorted(yearly_obs.items()):
        for parcel, obs in parcel_map.items():
            bins: dict[str, int] = {}
            for v, d in obs:
                speed_bin = round(v * 2) / 2.0
                dir_bin = int((d // 30) * 30) % 360
                key = f"{speed_bin:.1f}|{dir_bin}"
                bins[key] = bins.get(key, 0) + 1
            total = max(sum(bins.values()), 1)
            out["parcels"].setdefault(parcel, {})[year] = {
                "total_count": total,
                "bins": [
                    {
                        "speed_mps": float(k.split("|")[0]),
                        "dir_deg": int(k.split("|")[1]),
                        "count": c,
                        "probability": c / total,
                    }
                    for k, c in sorted(bins.items())
                ],
            }
    return out


def build_parcel_distribution_20y(
    yearly_obs: dict[str, dict[str, list[tuple[float, float]]]]
) -> dict[str, list[dict[str, float]]]:
    # Agrégation des observations de toutes les annees dans une distribution (V, dir) par parcelle.
    out: dict[str, list[dict[str, float]]] = {}
    for parcel in ALLOWED_PARCELS:
        bins: dict[str, int] = {}
        for year in sorted(yearly_obs.keys()):
            for v, d in yearly_obs[year][parcel]:
                speed_bin = round(v * 2) / 2.0  # 0.5 m/s
                dir_bin = int((d // 30) * 30) % 360  # 30 deg
                key = f"{speed_bin:.1f}|{dir_bin}"
                bins[key] = bins.get(key, 0) + 1
        total = max(sum(bins.values()), 1)
        out[parcel] = [
            {
                "speed_mps": float(k.split("|")[0]),
                "dir_deg": int(k.split("|")[1]),
                "count": float(c),
                "probability": float(c / total),
            }
            for k, c in sorted(bins.items())
        ]
    return out


def direction_factor(delta_deg: float, power: float) -> float:
    # Orientation penalty: when opposite to the mean flow direction, output drops sharply.
    c = max(0.0, math.cos(math.radians(delta_deg)))
    return c ** power


def turbine_power_mw(v_eff: float, turbine: dict[str, Any]) -> float:
    cut_in = float(turbine.get("cut_in_mps", 3.5))
    rated_speed = float(turbine.get("rated_speed_mps", 15.5))
    cut_out = float(turbine.get("cut_out_mps", 25.0))
    rated_power = float(turbine["rated_power_mw"])
    if v_eff < cut_in or v_eff >= cut_out:
        return 0.0
    if v_eff >= rated_speed:
        return rated_power
    x = (v_eff - cut_in) / max(rated_speed - cut_in, 1e-6)
    return rated_power * (x ** 3)


def annual_energy_per_turbine_mwh_from_distribution(
    distribution_bins: list[dict[str, float]],
    turbine: dict[str, Any],
    theta_deg: float,
    direction_penalty_power: float,
) -> float:
    if not distribution_bins:
        return 0.0
    total_mwh = 0.0
    for b in distribution_bins:
        v = float(b["speed_mps"])
        direction = float(b["dir_deg"])
        prob = float(b["probability"])
        delta = circular_distance_deg(direction, theta_deg)
        v_eff = v * direction_factor(delta, direction_penalty_power)
        total_mwh += turbine_power_mw(v_eff, turbine) * prob * 8760.0
    return total_mwh


def wake_factor(n: int, alpha: float, floor: float) -> float:
    return max(floor, 1.0 - alpha * max(0, n - 1))


def build_options_for_parcel(
    parcel: str,
    parcel_distribution: list[dict[str, float]],
    turbines: list[dict[str, Any]],
    cfg: Config,
) -> list[dict[str, Any]]:
    options: list[dict[str, Any]] = []
    thetas = list(range(0, 360, cfg.theta_step_deg))
    for t in turbines:
        is_offshore_parcel = parcel in OFFSHORE_PARCELS
        if is_offshore_parcel and t["install_kind"] != "offshore":
            continue
        if (not is_offshore_parcel) and t["install_kind"] != "terrestre":
            continue

        cap_max = CAPACITY_BY_PARCEL[parcel][t["diameter_class"]]
        if cap_max <= 0:
            continue
        for theta in thetas:
            base_energy = annual_energy_per_turbine_mwh_from_distribution(
                distribution_bins=parcel_distribution,
                turbine=t,
                theta_deg=float(theta),
                direction_penalty_power=cfg.direction_penalty_power,
            )
            if base_energy <= 0:
                continue
            for n in range(1, cap_max + 1):
                wf = wake_factor(n, cfg.wake_loss_alpha, cfg.wake_loss_floor)
                energy = n * base_energy * wf
                if energy <= 0:
                    continue
                cost = int(n * t["price_eur"])
                annual_revenue = energy * cfg.buyback_price_eur_per_mwh
                annual_maintenance = energy * cfg.maintenance_cost_eur_per_mwh
                annual_profit = annual_revenue - annual_maintenance
                if annual_profit <= 0:
                    continue
                roi = cost / annual_profit
                if roi > cfg.roi_limit_years:
                    continue
                options.append(
                    {
                        "parcel_id": parcel,
                        "type_id": t["id"],
                        "install_kind": t["install_kind"],
                        "theta_deg": theta,
                        "n_turbines": n,
                        "capacity_max": cap_max,
                        "energy_mwh_per_year": energy,
                        "cost_total_eur": cost,
                        "roi_years": roi,
                        "profit_net_eur_per_year": annual_profit,
                        "feasible": True,
                    }
                )
    options.sort(key=lambda x: (x["profit_net_eur_per_year"], -x["cost_total_eur"]), reverse=True)
    return options[: cfg.max_options_per_parcel]


def optimize_global(options_by_parcel: dict[str, list[dict[str, Any]]], cfg: Config) -> list[dict[str, Any]]:
    parcels = ALLOWED_PARCELS
    budget_steps = cfg.budget_limit_eur // cfg.budget_quantization_eur

    all_options = {
        p: [{"parcel_id": p, "cost_total_eur": 0, "profit_net_eur_per_year": 0.0, "none": True}]
        + options_by_parcel[p]
        for p in parcels
    }

    dp = [-1e30] * (budget_steps + 1)
    dp[0] = 0.0
    choice: list[list[int]] = [[-1] * (budget_steps + 1) for _ in parcels]
    previous_budget: list[list[int]] = [[-1] * (budget_steps + 1) for _ in parcels]

    for i, parcel in enumerate(parcels):
        nxt = [-1e30] * (budget_steps + 1)
        for b in range(budget_steps + 1):
            if dp[b] <= -1e20:
                continue
            for opt_idx, opt in enumerate(all_options[parcel]):
                c = int(opt["cost_total_eur"] // cfg.budget_quantization_eur)
                nb = b + c
                if nb > budget_steps:
                    continue
                v = dp[b] + float(opt["profit_net_eur_per_year"])
                if v > nxt[nb]:
                    nxt[nb] = v
                    choice[i][nb] = opt_idx
                    previous_budget[i][nb] = b
        dp = nxt

    end_budget = max(range(budget_steps + 1), key=lambda b: dp[b])
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


def compute_summary(placements: list[dict[str, Any]], cfg: Config) -> dict[str, Any]:
    total_cost = int(sum(p["cost_total_eur"] for p in placements))
    total_energy = float(sum(p["energy_mwh_per_year"] for p in placements))
    total_profit = float(sum(p["profit_net_eur_per_year"] for p in placements))
    rois = [float(p["roi_years"]) for p in placements]
    return {
        "total_cost_eur": total_cost,
        "budget_limit_eur": cfg.budget_limit_eur,
        "total_energy_mwh_per_year": total_energy,
        "total_profit_eur_per_year": total_profit,
        "roi_min_years": min(rois) if rois else None,
        "roi_max_years": max(rois) if rois else None,
    }


def main() -> None:
    args = parse_args()
    cfg = Config(theta_step_deg=args.theta_step)

    turbines = read_turbines(ROOT_DIR / "phase2" / "data" / "turbines.json")
    yearly_obs = load_wind_observations()
    wind_agg = build_wind_aggregated(yearly_obs)
    parcel_dist_20y = build_parcel_distribution_20y(yearly_obs)

    options_by_parcel = {
        parcel: build_options_for_parcel(
            parcel=parcel,
            parcel_distribution=parcel_dist_20y[parcel],
            turbines=turbines,
            cfg=cfg,
        )
        for parcel in ALLOWED_PARCELS
    }
    placements = optimize_global(options_by_parcel, cfg)
    # Import local pour eviter les imports circulaires quand optimisation.py est
    # charge depuis optimisation2.py / optimisation3.py.
    from optimisation2 import optimize_global_monte_carlo
    from optimisation3 import optimize_global_gradient_descent

    placements_mc = optimize_global_monte_carlo(
        options_by_parcel=options_by_parcel,
        cfg=cfg,
        iterations=4000,
        seed=42,
    )
    placements_gd = optimize_global_gradient_descent(options_by_parcel=options_by_parcel, cfg=cfg)

    compare = {
        "methods": [
            {
                "method": "dynamic_programming",
                "result_file": "optimisation_result.json",
                "summary": compute_summary(placements, cfg),
            },
            {
                "method": "monte_carlo",
                "result_file": "optimisation2_result.json",
                "summary": compute_summary(placements_mc, cfg),
            },
            {
                "method": "gradient_descent_discrete",
                "result_file": "optimisation3_result.json",
                "summary": compute_summary(placements_gd, cfg),
            },
        ]
    }

    result = {
        "scenario": args.scenario,
        "constraint_set": args.constraint_set,
        "objective_model_version": "phase2_v1_directional_roi_budget_dp",
        "summary": compute_summary(placements, cfg),
        "placements": placements,
        "meta": {
            "theta_step_deg": cfg.theta_step_deg,
            "buyback_price_eur_per_mwh": cfg.buyback_price_eur_per_mwh,
            "maintenance_cost_eur_per_mwh": cfg.maintenance_cost_eur_per_mwh,
            "roi_limit_years": cfg.roi_limit_years,
            "budget_quantization_eur": cfg.budget_quantization_eur,
            "years_used": sorted(yearly_obs.keys()),
            "notes": [
                "Capacites parcelles depuis Mission2_pres.pdf (diapo capacite).",
                "Donnees meteo chargees uniquement depuis phase2/data/Data brut/*.zip.",
                "Toutes les annees disponibles dans Data brut sont agregees en distribution vent (vitesse+direction) sur 20+ ans.",
                "Contrainte terrestre/offshore appliquee selon parcelles marines (zones bleues).",
                "Capacite appliquee strictement selon le tableau D=200..30 (sans approximation de diametre).",
                "Direction penalisee via max(0, cos(delta))^p.",
                "Les options sont filtrees avec ROI <= 20 ans par parcelle.",
                "Comparaison en sortie avec Monte-Carlo et descente de gradient discrete.",
            ],
        },
        "comparison_methods": compare,
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.wind_output.parent.mkdir(parents=True, exist_ok=True)
    args.compare_output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    args.wind_output.write_text(json.dumps(wind_agg, ensure_ascii=False, indent=2), encoding="utf-8")
    args.compare_output.write_text(json.dumps(compare, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        json.dumps(
            {
                "output": str(args.output),
                "wind_output": str(args.wind_output),
                "compare_output": str(args.compare_output),
                "placements": len(placements),
                "total_profit_eur_per_year": result["summary"]["total_profit_eur_per_year"],
            }
        )
    )


if __name__ == "__main__":
    main()
