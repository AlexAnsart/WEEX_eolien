from __future__ import annotations

import math
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from fastapi import HTTPException


def load_and_prepare_dataframe(data_file: Path) -> pd.DataFrame:
    if not data_file.exists():
        raise HTTPException(status_code=404, detail=f"Fichier introuvable: {data_file}")

    raw = pd.read_csv(data_file, sep=r"\s+", engine="python")
    raw.columns = [c.strip() for c in raw.columns]

    rename_map = {
        "Vitess_Vent_[m/s]": "wind_speed",
        "Dir_Vent_[deg]": "wind_dir",
        "Pelec[w]": "power_w",
        "Patm[Pa]": "patm_pa",
        "Temp[degC]": "temp_c",
        "Statut": "status",
    }
    df = raw.rename(columns=rename_map).copy()

    required = ["wind_speed", "wind_dir", "power_w", "patm_pa", "temp_c", "status"]
    missing = [col for col in required if col not in df.columns]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Colonnes manquantes dans le fichier de donnees: {', '.join(missing)}",
        )

    for col in ["wind_speed", "wind_dir", "power_w", "patm_pa", "temp_c"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df["status"] = pd.to_numeric(df["status"], errors="coerce").fillna(0).astype(int)

    r_air = 287.05
    df["temp_k"] = df["temp_c"] + 273.15
    df["rho_air"] = df["patm_pa"] / (r_air * df["temp_k"])
    df["v3"] = df["wind_speed"] ** 3
    return df.dropna(subset=["wind_speed", "wind_dir", "power_w", "patm_pa", "temp_c"])


def compute_analysis(df: pd.DataFrame, *, source_notebook: str, source_data_file: str) -> dict[str, Any]:
    df_on = df[df["status"] == 1].copy()
    if df_on.empty:
        raise HTTPException(status_code=400, detail="Aucune mesure valide avec status=1.")

    availability = float((df["status"] == 1).mean())
    zero_power_ratio = float((df["power_w"] <= 0).mean())

    vmax = int(math.ceil(float(df_on["wind_speed"].max())))
    bins = np.arange(0, max(2, vmax + 1), 1)
    curve = (
        df_on.assign(speed_bin=pd.cut(df_on["wind_speed"], bins=bins, right=False))
        .groupby("speed_bin", observed=False)["power_w"]
        .agg(
            p_med=lambda s: float(np.nanmedian(s)),
            p_q10=lambda s: float(np.nanquantile(s, 0.10)),
            p_q90=lambda s: float(np.nanquantile(s, 0.90)),
            n="count",
        )
        .reset_index()
    )
    curve["v_mean"] = curve["speed_bin"].apply(lambda b: float((b.left + b.right) / 2) if pd.notna(b) else np.nan)
    curve = curve[curve["n"] >= 20].copy()

    power_curve_data = [
        {
            "speed": round(row["v_mean"], 1),
            "power": round(row["p_med"] / 1e6, 3),
            "q10": round(row["p_q10"] / 1e6, 3),
            "q90": round(row["p_q90"] / 1e6, 3),
        }
        for _, row in curve.iterrows()
    ]

    p_rated = float(curve["p_med"].max()) if not curve.empty else float(np.nan)
    cut_in_candidates = curve[curve["p_med"] > 0.01 * p_rated]
    rated_candidates = curve[curve["p_med"] > 0.95 * p_rated]
    v_cut_in = float(cut_in_candidates["v_mean"].iloc[0]) if not cut_in_candidates.empty else float("nan")
    v_rated = float(rated_candidates["v_mean"].iloc[0]) if not rated_candidates.empty else float("nan")

    # Use 1 m/s bins to increase x-axis resolution on wind distribution charts.
    max_hist_speed = int(math.ceil(float(df_on["wind_speed"].max())))
    hist_upper = max(20, max_hist_speed)
    speed_hist_bins = list(np.arange(0, hist_upper + 1, 1)) + [float("inf")]
    speed_hist_labels = [f"{i}-{i + 1}" for i in range(hist_upper)] + [f"{hist_upper}+"]
    speed_cats = pd.cut(df_on["wind_speed"], bins=speed_hist_bins, labels=speed_hist_labels, right=False)
    speed_counts = speed_cats.value_counts(sort=False)
    wind_distribution_data = [
        {
            "range": label,
            "count": int(speed_counts[label]),
            "pct": round(float(speed_counts[label] / len(df_on) * 100), 1),
        }
        for label in speed_hist_labels
    ]

    dir_edges = np.arange(0, 361, 30)
    dir_labels = ["N", "NNE", "ENE", "E", "ESE", "SSE", "S", "SSW", "WSW", "W", "WNW", "NNW"]
    dir_sector_index = pd.cut(df_on["wind_dir"] % 360, bins=dir_edges, right=False, include_lowest=True, labels=False)
    freq_counts = dir_sector_index.value_counts(sort=False).reindex(range(12), fill_value=0)
    avg_power = (
        df_on.groupby(dir_sector_index)["power_w"].mean().reindex(range(12), fill_value=0.0) / 1000.0
    )
    wind_rose_data = [
        {
            "dir": dir_labels[i],
            "angle": i * 30,
            "freq": round(float(freq_counts[i] / len(df_on) * 100), 1),
            "avgPower": round(float(avg_power[i]), 0),
        }
        for i in range(12)
    ]

    temp_bins = np.arange(-5, 18, 2)
    temp_labels = [int((temp_bins[i] + temp_bins[i + 1]) / 2) for i in range(len(temp_bins) - 1)]
    temp_grouped = (
        df_on.assign(temp_bin=pd.cut(df_on["temp_c"], bins=temp_bins, right=False, labels=temp_labels))
        .groupby("temp_bin", observed=False)
        .apply(lambda g: (g["rho_air"] * g["v3"]).mean(), include_groups=False)
        .dropna()
    )
    norm = float(temp_grouped.max()) if len(temp_grouped) else 1.0
    temp_power_data = [
        {"temp": int(idx), "power": round(float(val / norm), 3)}
        for idx, val in temp_grouped.items()
    ]

    rho_bins = np.arange(1.15, 1.39, 0.02)
    rho_cats = pd.cut(df_on["rho_air"], bins=rho_bins, right=False)
    rho_counts = rho_cats.value_counts(sort=False)
    air_density_data = []
    for interval, count in rho_counts.items():
        if pd.isna(interval):
            continue
        air_density_data.append({"density": f"{interval.left:.2f}-{interval.right:.2f}", "count": int(count)})

    v = df_on["wind_speed"].dropna()
    mu = float(v.mean())
    sigma = float(v.std(ddof=1))
    weibull_k = float((sigma / mu) ** (-1.086)) if mu > 0 and sigma > 0 else float("nan")
    weibull_c = float(mu / math.gamma(1 + 1 / weibull_k)) if weibull_k and not math.isnan(weibull_k) else float("nan")

    p_rated_obs = float(df_on["power_w"].quantile(0.995))
    p_mean_obs = float(df_on["power_w"].mean())
    capacity_factor_obs = float(p_mean_obs / p_rated_obs) if p_rated_obs > 0 else 0.0

    kpis = {
        "totalMeasurements": int(len(df)),
        "availability": round(availability * 100, 1),
        "zeroPowerRatio": round(zero_power_ratio * 100, 1),
        "retainedMeasurements": int(len(df_on)),
        "ratedPower": round(p_rated / 1e6, 3) if not math.isnan(p_rated) else 0.0,
        "cutInSpeed": round(v_cut_in, 2) if not math.isnan(v_cut_in) else 0.0,
        "ratedSpeed": round(v_rated, 2) if not math.isnan(v_rated) else 0.0,
        "weibullK": round(weibull_k, 3) if not math.isnan(weibull_k) else 0.0,
        "weibullC": round(weibull_c, 3) if not math.isnan(weibull_c) else 0.0,
        "meanWindSpeed": round(mu, 2),
        "meanAirDensity": round(float(df_on["rho_air"].mean()), 3),
        "meanTemperature": round(float(df_on["temp_c"].mean()), 2),
        "capacityFactor": round(capacity_factor_obs, 3),
    }

    return {
        "sourceNotebook": source_notebook,
        "sourceDataFile": source_data_file,
        "powerCurveData": power_curve_data,
        "windDistributionData": wind_distribution_data,
        "windRoseData": wind_rose_data,
        "tempPowerData": temp_power_data,
        "airDensityData": air_density_data,
        "kpis": kpis,
    }
