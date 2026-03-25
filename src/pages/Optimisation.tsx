import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Target } from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";
const ROWS = Array.from({ length: 12 }, (_, i) => String.fromCharCode(65 + i));
const COLS = Array.from({ length: 19 }, (_, i) => i + 1);
const ALLOWED = new Set([
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
]);

type Placement = {
  parcel_id: string;
  type_id: number;
  install_kind: "offshore" | "terrestre";
  theta_deg: number;
  n_turbines: number;
  capacity_max: number;
  energy_mwh_per_year: number;
  cost_total_eur: number;
  roi_years: number;
  feasible: boolean;
  transport_ok?: boolean;
  transport_blocker?: string | null;
};

type OptimisationPayload = {
  objective_model_version?: string;
  summary: {
    total_cost_eur: number;
    budget_limit_eur: number;
    total_energy_mwh_per_year: number;
    total_profit_eur_per_year: number;
    roi_min_years: number | null;
    roi_max_years: number | null;
  };
  placements: Placement[];
  meta?: {
    transport_max_distance_m?: number;
    transport_steering_angle_deg?: number;
    truck_base_mass_t?: number;
    truck_blade_mass_factor_t_per_m?: number;
    acoustic_lp_limit_dba?: number;
    acoustic_receiver_height_m?: number;
    acoustic_ground_reflection_q?: number;
    acoustic_wind_delta_lw_dba?: number;
    notes?: string[];
  };
};

type BruteforcePayload = {
  objective_model_version?: string;
  summary: {
    total_cost_eur: number;
    budget_limit_eur: number;
    total_energy_mwh_per_year: number;
    total_profit_eur_per_year: number;
    roi_min_years: number | null;
    roi_max_years: number | null;
  };
  placements: Placement[];
};

type Optimisation5Payload = {
  objective_model_version?: string;
  summary: {
    total_cost_eur: number;
    budget_limit_eur: number;
    total_energy_mwh_per_year: number;
    total_profit_eur_per_year: number;
    roi_min_years: number | null;
    roi_max_years: number | null;
  };
  placements: Placement[];
  meta?: {
    offshore_priority_factor?: number;
    objective_priority?: string[];
  };
};

const euroFmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const numFmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

const Optimisation = () => {
  const [data, setData] = useState<OptimisationPayload | null>(null);
  const [selectedParcel, setSelectedParcel] = useState<string | null>(null);
  const [bruteforceData, setBruteforceData] = useState<BruteforcePayload | null>(null);
  const [optimisation5Data, setOptimisation5Data] = useState<Optimisation5Payload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const placementsByParcel = useMemo(() => {
    const map = new Map<string, Placement>();
    for (const p of data?.placements ?? []) map.set(p.parcel_id, p);
    return map;
  }, [data]);

  const selected = selectedParcel ? placementsByParcel.get(selectedParcel) : undefined;

  const loadResult = async () => {
    setLoading(true);
    setError(null);
    try {
      const ts = Date.now();
      const resultRes = await fetch(`/generated/optimisation_result.json?t=${ts}`, { cache: "no-store" });
      if (!resultRes.ok) throw new Error("Impossible de charger optimisation_result.json");
      const payload = (await resultRes.json()) as OptimisationPayload;
      setData(payload);
      const bruteforceRes = await fetch(`/generated/optimisation4_result.json?t=${ts}`, { cache: "no-store" });
      if (bruteforceRes.ok) {
        const bruteforcePayload = (await bruteforceRes.json()) as BruteforcePayload;
        setBruteforceData(bruteforcePayload);
      } else {
        setBruteforceData(null);
      }
      const optimisation5Res = await fetch(`/generated/optimisation5_result.json?t=${ts}`, { cache: "no-store" });
      if (optimisation5Res.ok) {
        const optimisation5Payload = (await optimisation5Res.json()) as Optimisation5Payload;
        setOptimisation5Data(optimisation5Payload);
      } else {
        setOptimisation5Data(null);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const refreshFromApi = async () => {
    setLoading(true);
    setError(null);
    try {
      const run = await fetch(`${API_BASE_URL}/api/optimisation/run`, { method: "POST" });
      if (!run.ok) throw new Error("Le recalcul API a échoué.");
      await loadResult();
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadResult();
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">Optimisation</h1>
          <p className="text-sm text-muted-foreground">Implantation optimale sous contraintes budget, capacité et ROI.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadResult}
            className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Charger résultat
          </button>
          <button
            type="button"
            onClick={refreshFromApi}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <RefreshCw className="h-4 w-4" />
            Rafraîchir calcul
          </button>
        </div>
      </div>

      {loading && <div className="glass-card p-3 text-sm text-muted-foreground">Chargement...</div>}
      {error && <div className="glass-card p-3 text-sm text-destructive">{error}</div>}

      {data && (
        <>
          <div className="glass-card p-4">
            <p className="mb-2 text-sm font-medium">Contraintes prises en compte</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>Avifaune (constraint-set 2): exclusion des parcelles protégées.</li>
              <li>Transport terrestre: accès camion à moins de {data.meta?.transport_max_distance_m ?? 500} m.</li>
              <li>Rayon de braquage: R = E / sin(a), avec a = {data.meta?.transport_steering_angle_deg ?? 40}°.</li>
              <li>
                Ponts: contrôle de masse du convoi (base {data.meta?.truck_base_mass_t ?? 38} t +{" "}
                {(data.meta?.truck_blade_mass_factor_t_per_m ?? 0.9).toFixed(1)} t/m de pale).
              </li>
              <li>
                Acoustique: Lp ≤ {data.meta?.acoustic_lp_limit_dba ?? 40} dBA (sol rigide Q=
                {data.meta?.acoustic_ground_reflection_q ?? 1}, récepteur {data.meta?.acoustic_receiver_height_m ?? 2} m, vent défavorable ΔLW=
                {data.meta?.acoustic_wind_delta_lw_dba ?? 0.28} dBA).
              </li>
              <li>
                Prix turbines: grille mission mise à jour appliquée (incluant les hausses liées aux aimants permanents).
              </li>
            </ul>
            {data.meta?.notes?.length ? (
              <p className="mt-2 text-xs text-muted-foreground">{data.meta.notes[data.meta.notes.length - 1]}</p>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="glass-card p-4">
              <p className="text-xs text-muted-foreground">Budget utilisé</p>
              <p className="font-display text-lg font-semibold">
                {euroFmt.format(data.summary.total_cost_eur)} / {euroFmt.format(data.summary.budget_limit_eur)} €
              </p>
            </div>
            <div className="glass-card p-4">
              <p className="text-xs text-muted-foreground">Production totale</p>
              <p className="font-display text-lg font-semibold">
                {numFmt.format(data.summary.total_energy_mwh_per_year)} MWh/an
              </p>
            </div>
            <div className="glass-card p-4">
              <p className="text-xs text-muted-foreground">Profit net total</p>
              <p className="font-display text-lg font-semibold">
                {euroFmt.format(data.summary.total_profit_eur_per_year)} €/an
              </p>
            </div>
            <div className="glass-card p-4">
              <p className="text-xs text-muted-foreground">ROI min / max</p>
              <p className="font-display text-lg font-semibold">
                {data.summary.roi_min_years?.toFixed(1) ?? "-"} / {data.summary.roi_max_years?.toFixed(1) ?? "-"} ans
              </p>
            </div>
          </div>

          {bruteforceData && (
            <div className="glass-card p-4">
              <p className="mb-2 text-sm font-medium">Méthode force brute (optimisation4)</p>
              <p className="text-sm text-muted-foreground">
                Version: {bruteforceData.objective_model_version ?? "n/a"}
              </p>
              <p className="text-sm text-muted-foreground">
                Production: {numFmt.format(bruteforceData.summary.total_energy_mwh_per_year)} MWh/an
              </p>
              <p className="text-sm text-muted-foreground">
                Budget: {euroFmt.format(bruteforceData.summary.total_cost_eur)} /{" "}
                {euroFmt.format(bruteforceData.summary.budget_limit_eur)} €
              </p>
              <p className="text-sm text-muted-foreground">
                Placements: {bruteforceData.placements.length}
              </p>
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-[55%_45%]">
            <div className="glass-card p-4">
              <p className="mb-3 text-sm font-medium">Grille des parcelles</p>
              <div className="grid grid-cols-[20px_1fr] gap-2">
                <div className="grid grid-rows-12 gap-0.5 pt-4">
                  {ROWS.map((row) => (
                    <span key={row} className="text-center text-[10px] text-muted-foreground">{row}</span>
                  ))}
                </div>
                <div className="space-y-1">
                  <div className="grid gap-0.5" style={{ gridTemplateColumns: "repeat(19, minmax(0, 1fr))" }}>
                    {COLS.map((col) => (
                      <span key={col} className="text-center text-[10px] text-muted-foreground">{col}</span>
                    ))}
                  </div>
                  <div className="grid gap-0.5" style={{ gridTemplateColumns: "repeat(19, minmax(0, 1fr))" }}>
                    {ROWS.flatMap((row) =>
                      COLS.map((col) => {
                        const id = `${col}${row}`;
                        const allowed = ALLOWED.has(id);
                        const placement = placementsByParcel.get(id);
                        const active = selectedParcel === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            disabled={!allowed}
                            onClick={() => setSelectedParcel(id)}
                            className={`aspect-square rounded border text-[10px] ${
                              !allowed
                                ? "border-transparent bg-muted/20 text-muted-foreground/40"
                                : placement
                                  ? "border-primary/60 bg-primary/15 text-primary"
                                  : "border-border bg-background text-muted-foreground"
                            } ${active ? "ring-2 ring-primary" : ""}`}
                          >
                            {placement ? placement.type_id : ""}
                          </button>
                        );
                      }),
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-card p-4">
              <p className="mb-3 text-sm font-medium">Détails parcelle</p>
              {!selected ? (
                <p className="text-sm text-muted-foreground">Sélectionnez une parcelle autorisée pour voir son implantation.</p>
              ) : (
                <div className="space-y-2 text-sm">
                  <p><span className="text-muted-foreground">Parcelle:</span> {selected.parcel_id}</p>
                  <p><span className="text-muted-foreground">Type:</span> Éolienne {selected.type_id} ({selected.install_kind})</p>
                  <p><span className="text-muted-foreground">Nombre:</span> {selected.n_turbines} / {selected.capacity_max}</p>
                  <p><span className="text-muted-foreground">Direction:</span> {selected.theta_deg}°</p>
                  <p><span className="text-muted-foreground">Énergie annuelle:</span> {numFmt.format(selected.energy_mwh_per_year)} MWh</p>
                  <p><span className="text-muted-foreground">Coût:</span> {euroFmt.format(selected.cost_total_eur)} €</p>
                  <p><span className="text-muted-foreground">ROI:</span> {selected.roi_years.toFixed(2)} ans</p>
                  <div className="mt-3 rounded bg-muted/40 p-3 text-xs text-muted-foreground">
                    <Target className="mr-1 inline h-3.5 w-3.5" />
                    Option choisie pour maximiser le profit global sous contrainte budget + ROI.
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="glass-card overflow-x-auto p-4">
            <p className="mb-3 text-sm font-medium">Table de vérification</p>
            <table className="w-full min-w-[900px] text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2">Parcelle</th>
                  <th className="py-2">Type</th>
                  <th className="py-2">n</th>
                  <th className="py-2">Theta</th>
                  <th className="py-2">Capacité max</th>
                  <th className="py-2">Coût (€)</th>
                  <th className="py-2">Énergie (MWh/an)</th>
                  <th className="py-2">ROI (ans)</th>
                  <th className="py-2">Transport OK</th>
                  <th className="py-2">Feasible</th>
                </tr>
              </thead>
              <tbody>
                {data.placements.map((p) => (
                  <tr key={p.parcel_id} className="border-t border-border/60">
                    <td className="py-2">{p.parcel_id}</td>
                    <td className="py-2">{p.type_id}</td>
                    <td className="py-2">{p.n_turbines}</td>
                    <td className="py-2">{p.theta_deg}°</td>
                    <td className="py-2">{p.capacity_max}</td>
                    <td className="py-2">{euroFmt.format(p.cost_total_eur)}</td>
                    <td className="py-2">{numFmt.format(p.energy_mwh_per_year)}</td>
                    <td className="py-2">{p.roi_years.toFixed(2)}</td>
                    <td className="py-2">{p.transport_ok ?? true ? "Oui" : "Non"}</td>
                    <td className="py-2">{String(p.feasible)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {optimisation5Data && (
            <>
              <div className="glass-card p-4">
                <p className="mb-2 text-sm font-medium">Optimisation 5 (dynamique, priorité offshore)</p>
                <p className="text-sm text-muted-foreground">
                  Facteur priorité offshore: {optimisation5Data.meta?.offshore_priority_factor ?? 2.0}
                </p>
                <p className="text-sm text-muted-foreground">
                  Version: {optimisation5Data.objective_model_version ?? "n/a"}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="glass-card p-4">
                  <p className="text-xs text-muted-foreground">Budget utilisé (opt5)</p>
                  <p className="font-display text-lg font-semibold">
                    {euroFmt.format(optimisation5Data.summary.total_cost_eur)} / {euroFmt.format(optimisation5Data.summary.budget_limit_eur)} €
                  </p>
                </div>
                <div className="glass-card p-4">
                  <p className="text-xs text-muted-foreground">Production totale (opt5)</p>
                  <p className="font-display text-lg font-semibold">
                    {numFmt.format(optimisation5Data.summary.total_energy_mwh_per_year)} MWh/an
                  </p>
                </div>
                <div className="glass-card p-4">
                  <p className="text-xs text-muted-foreground">Profit net total (opt5)</p>
                  <p className="font-display text-lg font-semibold">
                    {euroFmt.format(optimisation5Data.summary.total_profit_eur_per_year)} €/an
                  </p>
                </div>
                <div className="glass-card p-4">
                  <p className="text-xs text-muted-foreground">Placements (opt5)</p>
                  <p className="font-display text-lg font-semibold">{optimisation5Data.placements.length}</p>
                </div>
              </div>

              <div className="glass-card overflow-x-auto p-4">
                <p className="mb-3 text-sm font-medium">Table de vérification (optimisation5)</p>
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="text-left text-muted-foreground">
                    <tr>
                      <th className="py-2">Parcelle</th>
                      <th className="py-2">Type</th>
                      <th className="py-2">n</th>
                      <th className="py-2">Theta</th>
                      <th className="py-2">Capacité max</th>
                      <th className="py-2">Coût (€)</th>
                      <th className="py-2">Énergie (MWh/an)</th>
                      <th className="py-2">ROI (ans)</th>
                      <th className="py-2">Feasible</th>
                    </tr>
                  </thead>
                  <tbody>
                    {optimisation5Data.placements.map((p) => (
                      <tr key={`${p.parcel_id}-${p.type_id}-${p.theta_deg}`} className="border-t border-border/60">
                        <td className="py-2">{p.parcel_id}</td>
                        <td className="py-2">{p.type_id}</td>
                        <td className="py-2">{p.n_turbines}</td>
                        <td className="py-2">{p.theta_deg}°</td>
                        <td className="py-2">{p.capacity_max}</td>
                        <td className="py-2">{euroFmt.format(p.cost_total_eur)}</td>
                        <td className="py-2">{numFmt.format(p.energy_mwh_per_year)}</td>
                        <td className="py-2">{p.roi_years.toFixed(2)}</td>
                        <td className="py-2">{String(p.feasible)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default Optimisation;
