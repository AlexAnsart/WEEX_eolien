from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT_DIR = Path(__file__).resolve().parents[1]
INPUT_PATH = ROOT_DIR / "phase2" / "data" / "acoustic_measurements.json"
OUTPUT_PATH = ROOT_DIR / "phase2" / "data" / "acoustic_constraints.json"


def _round1(value: float) -> float:
    return round(float(value), 1)


def build_constraints(raw: dict[str, Any]) -> dict[str, Any]:
    scale_bar_real_m = float(raw["global"]["scale_bar_real_m"])
    parcels: dict[str, dict[str, float]] = {}
    traceability: dict[str, dict[str, Any]] = {}

    for map_name, map_data in raw["maps"].items():
        scale_bar_px = float(map_data["scale_bar_px"])
        m_per_px = scale_bar_real_m / scale_bar_px
        for parcel, p in map_data["parcels"].items():
            dist_px = float(p["closest_habitation_to_field_px"])
            parcels[parcel] = {
                "closest_habitation_to_field_m": _round1(dist_px * m_per_px),
            }
            traceability[parcel] = {
                "source_map": map_name,
                "scale_bar_px": scale_bar_px,
                "meter_per_pixel": _round1(m_per_px),
                "closest_habitation_to_field_px": dist_px,
            }

    return {
        "measurement_protocol": {
            "version": raw.get("version", 1),
            "description": raw.get("description", ""),
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "input_file": str(INPUT_PATH),
            "scale_reference_m": scale_bar_real_m,
        },
        "parcels": dict(sorted(parcels.items())),
        "traceability_by_parcel": dict(sorted(traceability.items())),
    }


def main() -> None:
    raw = json.loads(INPUT_PATH.read_text(encoding="utf-8"))
    out = build_constraints(raw)
    OUTPUT_PATH.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"output": str(OUTPUT_PATH), "parcels": len(out["parcels"])}))


if __name__ == "__main__":
    main()
