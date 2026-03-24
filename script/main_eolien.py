from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd


def weibull_pdf(v: np.ndarray, k: float, c: float) -> np.ndarray:
    vc = np.maximum(v, 0) / c
    return (k / c) * np.power(vc, k - 1) * np.exp(-np.power(vc, k))


def load_dataset(data_file: Path) -> pd.DataFrame:
    df = pd.read_csv(data_file, sep=r"\s+", engine="python")
    df.columns = df.columns.str.strip()

    rename_map = {
        "Vitess_Vent_[m/s]": "wind_speed",
        "Pelec[w]": "power_w",
        "Temp[degC]": "temp_c",
        "Patm[Pa]": "patm_pa",
        "Statut": "status",
    }
    df = df.rename(columns=rename_map)

    required = ["wind_speed", "power_w", "temp_c", "patm_pa", "status"]
    missing = [col for col in required if col not in df.columns]
    if missing:
        raise ValueError(f"Colonnes manquantes dans {data_file.name}: {', '.join(missing)}")

    for col in required:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df = df.dropna(subset=required)
    return df[df["status"] == 1].copy()


def generate_images(data_file: Path, output_dir: Path) -> dict[str, str]:
    output_dir.mkdir(parents=True, exist_ok=True)
    df = load_dataset(data_file)
    if df.empty:
        raise ValueError("Aucune mesure exploitable (status=1).")

    vitesse = df["wind_speed"].to_numpy()
    puissance = df["power_w"].to_numpy()
    temperature = df["temp_c"].to_numpy()
    direction = df["Dir_Vent_[deg]"].to_numpy() if "Dir_Vent_[deg]" in df.columns else np.array([])

    bins = np.arange(0, float(np.nanmax(vitesse)) + 2, 1)
    binned = (
        df.assign(speed_bin=pd.cut(df["wind_speed"], bins=bins, right=False))
        .groupby("speed_bin", observed=False)["power_w"]
        .agg(["mean", "std"])
        .reset_index()
    )
    binned = binned.dropna(subset=["mean"]).copy()
    binned["center"] = binned["speed_bin"].apply(lambda iv: (iv.left + iv.right) / 2)
    vc = binned["center"].to_numpy()
    mp = binned["mean"].to_numpy()
    sp = binned["std"].fillna(0).to_numpy()

    # Ajustement plus stable:
    # - fit sur la plage productive (hors tres faibles vitesses et hors plateau nominal)
    # - saturation au niveau de puissance nominale observee
    p_nom = float(np.nanpercentile(puissance, 99.5))
    prod_mask = (vitesse >= 2.5) & (puissance > 0.02 * p_nom) & (puissance < 0.98 * p_nom)
    fit_speed = vitesse[prod_mask] if np.any(prod_mask) else vitesse[puissance > 0]
    fit_power = puissance[prod_mask] if np.any(prod_mask) else puissance[puissance > 0]
    coeffs = np.polyfit(np.power(fit_speed, 3), fit_power, 1)
    k_curve = float(coeffs[0])
    v_fit = np.linspace(0, float(np.nanmax(vitesse)) + 1, 400)
    p_fit_raw = np.where(v_fit >= 2.5, k_curve * v_fit**3, 0.0)
    p_fit = np.minimum(p_fit_raw, p_nom)

    # Loi de Weibull ajustee sur les vitesses observees.
    mu = float(np.nanmean(vitesse))
    sigma = float(np.nanstd(vitesse, ddof=1))
    k_weibull = float((sigma / mu) ** (-1.086)) if mu > 0 and sigma > 0 else 2.0
    c_weibull = float(mu / math.gamma(1 + 1 / k_weibull)) if k_weibull > 0 else mu
    v_pdf = np.linspace(0, max(30.0, float(np.nanmax(vitesse)) + 2), 500)
    pdf_vals = weibull_pdf(v_pdf, k_weibull, c_weibull)

    outputs = {
        "powerCurve": "courbe_puissance.png",
        "powerCurveScatter": "puissance_vitesse_brut.png",
        "powerCurveFitOnly": "courbe_puissance_ajustee.png",
        "powerCurveEtaTop": "courbe_puissance_regression_eta.png",
        "powerCurveEtaResiduals": "residus_modele_puissance.png",
        "windPowerScatter": "nuage_puissance_vent.png",
        "tempPowerScatter": "temperature_puissance_brut.png",
        "tempPowerRegression": "temperature_puissance_regression.png",
        "weibullDistribution": "distribution_weibull.png",
        "windRoseFrequency": "rose_vents_frequence.png",
        "windRosePower": "rose_vents_puissance.png",
    }

    fig, ax = plt.subplots(figsize=(11, 6))
    ax.scatter(vitesse, puissance, color="steelblue", alpha=0.12, edgecolors="none", s=10, label="Mesures")
    ax.errorbar(
        vc,
        mp,
        yerr=sp,
        fmt="o-",
        color="darkorange",
        linewidth=2,
        markersize=5,
        capsize=3,
        label="Moyenne par bin ± ecart-type",
        zorder=3,
    )
    ax.plot(v_fit, p_fit, "--", color="crimson", linewidth=2, label=f"Ajustement P(V) (k={k_curve:.0f})")
    ax.set_xlabel("Vitesse du vent [m/s]")
    ax.set_ylabel("Puissance electrique [W]")
    ax.set_title("Courbe de puissance de l'eolienne")
    ax.grid(True, linestyle="--", alpha=0.35)
    ax.legend()
    fig.tight_layout()
    fig.savefig(output_dir / outputs["powerCurve"], dpi=180, bbox_inches="tight")
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(11, 6))
    ax.scatter(vitesse, puissance, color="steelblue", alpha=0.15, edgecolors="none", s=10, label="Mesures")
    ax.set_xlabel("Vitesse du vent [m/s]")
    ax.set_ylabel("Puissance electrique [W]")
    ax.set_title("Puissance en fonction de la vitesse (donnees brutes)")
    ax.grid(True, linestyle="--", alpha=0.35)
    ax.legend()
    fig.tight_layout()
    fig.savefig(output_dir / outputs["powerCurveScatter"], dpi=180, bbox_inches="tight")
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(11, 6))
    ax.errorbar(
        vc,
        mp,
        yerr=sp,
        fmt="o-",
        color="darkorange",
        linewidth=2,
        markersize=5,
        capsize=3,
        label="Moyenne par bin ± ecart-type",
        zorder=3,
    )
    ax.plot(v_fit, p_fit, "--", color="crimson", linewidth=2.2, label=f"Ajustement P(V) (k={k_curve:.0f})")
    ax.set_xlabel("Vitesse du vent [m/s]")
    ax.set_ylabel("Puissance electrique [W]")
    ax.set_title("Courbe ajustee de puissance")
    ax.grid(True, linestyle="--", alpha=0.35)
    ax.legend()
    fig.tight_layout()
    fig.savefig(output_dir / outputs["powerCurveFitOnly"], dpi=180, bbox_inches="tight")
    plt.close(fig)

    # Version modulable de l'ajustement "regression sur eta" + residus.
    d_turb = 60.0
    r_air = 287.0
    area = np.pi * d_turb**2 / 4
    temp_k = temperature + 273.15
    rho_moy = float(np.mean(df["patm_pa"].to_numpy() / (r_air * temp_k)))
    fit_mask = (vitesse >= 3.0) & (vitesse <= 15.0)
    if np.any(fit_mask):
        v_fit_zone = vitesse[fit_mask]
        p_fit_zone = puissance[fit_mask]
    else:
        v_fit_zone = vitesse
        p_fit_zone = puissance

    x = np.power(v_fit_zone, 3)
    k_opt = float(np.dot(x, p_fit_zone) / max(np.dot(x, x), 1e-12))
    eta_opt = float(k_opt / (0.5 * rho_moy * area) * (27.0 / 16.0))
    eta_opt = float(np.clip(eta_opt, 0.0, 0.6))
    cp_opt = eta_opt * (16.0 / 27.0)
    k_opt = cp_opt * 0.5 * rho_moy * area

    v_fit_eta = np.linspace(0, float(np.nanmax(vitesse)) + 1, 300)
    p_fit_eta = np.where(v_fit_eta >= 3.0, k_opt * v_fit_eta**3, 0.0)
    p_pred_all = np.where(vitesse >= 2.5, k_opt * vitesse**3, 0.0)
    residus_kw = (puissance - p_pred_all) / 1000.0

    rmse = float(np.sqrt(np.mean((p_pred_all[fit_mask] - puissance[fit_mask]) ** 2))) if np.any(fit_mask) else float(np.sqrt(np.mean((p_pred_all - puissance) ** 2)))
    denom = float(np.sum((puissance[fit_mask] - np.mean(puissance[fit_mask])) ** 2)) if np.any(fit_mask) else float(np.sum((puissance - np.mean(puissance)) ** 2))
    r2 = 1.0 - (float(np.sum((puissance[fit_mask] - p_pred_all[fit_mask]) ** 2)) / denom if np.any(fit_mask) and denom > 0 else 0.0)

    fig, ax = plt.subplots(figsize=(11, 6))
    ax.scatter(vitesse, puissance, color="steelblue", alpha=0.10, edgecolors="none", s=8, label="Donnees mesurees", zorder=2)
    ax.errorbar(vc, mp, yerr=sp, fmt="o-", color="darkorange", linewidth=2, markersize=5, capsize=3, label="Moyenne par bin", zorder=4)
    ax.plot(v_fit_eta, p_fit_eta, "-", color="green", linewidth=2.5, label=f"Modele ajuste eta={eta_opt:.3f} (k={k_opt:.0f})", zorder=5)
    ax.set_xlabel("Vitesse du vent [m/s]")
    ax.set_ylabel("Puissance [W]")
    ax.set_title("Courbe de puissance - regression sur eta")
    ax.grid(True, linestyle="--", alpha=0.4)
    ax.legend(fontsize=9)
    ax.set_xlim(0, float(np.nanmax(vitesse)) + 1)
    ax.set_ylim(-50000, float(np.nanmax(puissance)) * 1.15)
    ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda y, _: f"{y/1e6:.2f} MW" if y >= 1e6 else f"{y/1e3:.0f} kW"))
    fig.tight_layout()
    fig.savefig(output_dir / outputs["powerCurveEtaTop"], dpi=170, bbox_inches="tight")
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(11, 6))
    ax.scatter(vitesse, residus_kw, color="purple", alpha=0.15, edgecolors="none", s=8, label="Residu = P_mesuree - P_modele")
    ax.axhline(0, color="black", linewidth=1.2, linestyle="--")
    ax.set_xlabel("Vitesse du vent [m/s]")
    ax.set_ylabel("Residu [kW]")
    ax.set_title("Residus du modele ajuste")
    ax.grid(True, linestyle="--", alpha=0.4)
    ax.legend(fontsize=9)
    ax.set_xlim(0, float(np.nanmax(vitesse)) + 1)
    stats = (
        f"eta optimal = {eta_opt:.4f}\n"
        f"Cp = {cp_opt:.4f}\n"
        f"rho moy = {rho_moy:.3f} kg/m^3\n"
        f"k = {k_opt:.1f} Ws^3/m^3\n"
        f"RMSE = {rmse/1000:.1f} kW\n"
        f"R^2 = {r2:.4f}"
    )
    ax.text(
        0.98,
        0.97,
        stats,
        transform=ax.transAxes,
        fontsize=9,
        va="top",
        ha="right",
        bbox={"boxstyle": "round", "facecolor": "lightyellow", "alpha": 0.8},
    )
    fig.tight_layout()
    fig.savefig(output_dir / outputs["powerCurveEtaResiduals"], dpi=170, bbox_inches="tight")
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(10, 6))
    ax.scatter(vitesse, puissance, alpha=0.20, s=12, color="#1f77b4")
    ax.set_xlabel("Vitesse du vent [m/s]")
    ax.set_ylabel("Puissance electrique [W]")
    ax.set_title("Nuage de points brut : puissance vs vitesse")
    ax.grid(True, linestyle="--", alpha=0.35)
    fig.tight_layout()
    fig.savefig(output_dir / outputs["windPowerScatter"], dpi=170, bbox_inches="tight")
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(10, 6))
    ax.scatter(temperature, puissance, alpha=0.20, s=12, color="#2ca02c")
    ax.set_xlabel("Temperature [degC]")
    ax.set_ylabel("Puissance electrique [W]")
    ax.set_title("Effet de la temperature sur la puissance")
    ax.grid(True, linestyle="--", alpha=0.35)
    fig.tight_layout()
    fig.savefig(output_dir / outputs["tempPowerScatter"], dpi=170, bbox_inches="tight")
    plt.close(fig)

    # Regression lineaire a vitesse constante (idee du notebook principal).
    fig, ax = plt.subplots(figsize=(10.5, 6))
    speed_int = np.rint(vitesse).astype(int)
    candidate_speeds = (
        pd.Series(speed_int)
        .value_counts()
        .loc[lambda s: (s.index >= 5) & (s.index <= 12)]
        .head(2)
        .index
        .tolist()
    )
    if len(candidate_speeds) == 0:
        candidate_speeds = [int(np.median(speed_int))]

    colors = ["#d62728", "#9467bd", "#17becf"]
    for i, sv in enumerate(candidate_speeds):
        m = speed_int == sv
        if np.sum(m) < 5:
            continue
        x = temperature[m]
        y = puissance[m]
        coef = np.polyfit(x, y, 1)
        xx = np.linspace(float(np.min(x)), float(np.max(x)), 120)
        yy = coef[0] * xx + coef[1]
        ax.scatter(x, y, s=14, alpha=0.28, color=colors[i % len(colors)], label=f"Mesures V={sv} m/s")
        ax.plot(xx, yy, linewidth=2, color=colors[i % len(colors)], linestyle="--", label=f"Reg. lineaire V={sv} m/s")

    ax.set_xlabel("Temperature [degC]")
    ax.set_ylabel("Puissance electrique [W]")
    ax.set_title("Regression lineaire de la puissance a vitesse constante")
    ax.grid(True, linestyle="--", alpha=0.35)
    ax.legend(fontsize=9)
    fig.tight_layout()
    fig.savefig(output_dir / outputs["tempPowerRegression"], dpi=180, bbox_inches="tight")
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(10, 6))
    ax.hist(vitesse, bins=np.arange(0, float(np.nanmax(vitesse)) + 2, 1), density=True, alpha=0.45, color="#4C72B0", label="Distribution observee")
    ax.plot(v_pdf, pdf_vals, color="#C44E52", linewidth=2.4, label=f"Weibull ajustee (k={k_weibull:.2f}, c={c_weibull:.2f})")
    ax.set_xlabel("Vitesse du vent [m/s]")
    ax.set_ylabel("Densite de probabilite")
    ax.set_title("Probabilite de vitesse du vent - Ajustement Weibull")
    ax.grid(True, linestyle="--", alpha=0.35)
    ax.legend()
    fig.tight_layout()
    fig.savefig(output_dir / outputs["weibullDistribution"], dpi=180, bbox_inches="tight")
    plt.close(fig)

    if direction.size > 0:
        dir_clean = np.mod(direction, 360)
        bins_dir = np.arange(0, 361, 30)
        centers = np.deg2rad((bins_dir[:-1] + bins_dir[1:]) / 2)

        counts, _ = np.histogram(dir_clean, bins=bins_dir)
        freq = counts / max(1, np.sum(counts)) * 100.0

        fig = plt.figure(figsize=(8, 8))
        ax = fig.add_subplot(111, projection="polar")
        ax.bar(centers, freq, width=np.deg2rad(30), bottom=0.0, alpha=0.55, color="#1f77b4", edgecolor="white")
        ax.set_theta_zero_location("N")
        ax.set_theta_direction(-1)
        ax.set_title("Rose des vents - Frequence [%]")
        fig.tight_layout()
        fig.savefig(output_dir / outputs["windRoseFrequency"], dpi=170, bbox_inches="tight")
        plt.close(fig)

        dir_idx = np.digitize(dir_clean, bins_dir, right=False) - 1
        dir_idx = np.clip(dir_idx, 0, 11)
        avg_power = np.array(
            [float(np.mean(puissance[dir_idx == i])) if np.any(dir_idx == i) else 0.0 for i in range(12)]
        ) / 1000.0

        fig = plt.figure(figsize=(8, 8))
        ax = fig.add_subplot(111, projection="polar")
        ax.bar(centers, avg_power, width=np.deg2rad(30), bottom=0.0, alpha=0.55, color="#2ca02c", edgecolor="white")
        ax.set_theta_zero_location("N")
        ax.set_theta_direction(-1)
        ax.set_title("Rose directionnelle - Puissance moyenne [kW]")
        fig.tight_layout()
        fig.savefig(output_dir / outputs["windRosePower"], dpi=170, bbox_inches="tight")
        plt.close(fig)

    return outputs


def main() -> None:
    parser = argparse.ArgumentParser(description="Genere les images d'analyse eolienne.")
    parser.add_argument("--data", default="script/donnees.txt", help="Chemin du fichier donnees")
    parser.add_argument("--output", default="public/generated", help="Dossier de sortie des PNG")
    args = parser.parse_args()

    outputs = generate_images(Path(args.data), Path(args.output))
    print(json.dumps(outputs))


if __name__ == "__main__":
    main()
