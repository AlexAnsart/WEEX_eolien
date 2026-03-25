from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT_DIR = Path(__file__).resolve().parents[1]
INPUT_PATH = ROOT_DIR / "phase2" / "data" / "transport_measurements.json"
OUTPUT_PATH = ROOT_DIR / "phase2" / "data" / "transport_constraints.json"


def _round1(value: float) -> float:
    return round(float(value), 1)


def build_constraints(raw: dict[str, Any]) -> dict[str, Any]:
    g = raw["global"]
    scale_bar_real_m = float(g["scale_bar_real_m"])

    parcels: dict[str, dict[str, Any]] = {}
    traceability: dict[str, dict[str, Any]] = {}
    for map_name, map_data in raw["maps"].items():
        scale_bar_px = float(map_data["scale_bar_px"])
        m_per_px = scale_bar_real_m / scale_bar_px
        for parcel, p in map_data["parcels"].items():
            distance_m = _round1(float(p["distance_px"]) * m_per_px)
            min_curve_radius_m = _round1(float(p["min_curve_radius_px"]) * m_per_px)
            bridge_limit = p.get("bridge_limit_t")
            parcels[parcel] = {
                "distance_to_access_road_m": distance_m,
                "min_curve_radius_m": min_curve_radius_m,
                "bridge_limit_t": None if bridge_limit is None else float(bridge_limit),
            }
            traceability[parcel] = {
                "source_map": map_name,
                "scale_bar_px": scale_bar_px,
                "meter_per_pixel": _round1(m_per_px),
                "distance_px": float(p["distance_px"]),
                "min_curve_radius_px": float(p["min_curve_radius_px"]),
            }

    out = {
        "measurement_protocol": {
            "version": raw.get("version", 1),
            "description": raw.get("description", ""),
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "input_file": str(INPUT_PATH),
            "scale_reference_m": scale_bar_real_m,
        },
        "steering_max_angle_deg": float(g["steering_max_angle_deg"]),
        "max_distance_to_site_m": float(g["max_distance_to_site_m"]),
        "truck_weight_model": {
            "base_mass_t": float(g["truck_weight_model"]["base_mass_t"]),
            "blade_mass_factor_t_per_m": float(g["truck_weight_model"]["blade_mass_factor_t_per_m"]),
        },
        "parcels": dict(sorted(parcels.items())),
        "traceability_by_parcel": dict(sorted(traceability.items())),
    }
    return out


def main() -> None:
    raw = json.loads(INPUT_PATH.read_text(encoding="utf-8"))
    out = build_constraints(raw)
    OUTPUT_PATH.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"output": str(OUTPUT_PATH), "parcels": len(out["parcels"])}))


if __name__ == "__main__":
    main()
