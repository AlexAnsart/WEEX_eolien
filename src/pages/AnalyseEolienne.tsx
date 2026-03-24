import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Wind, Zap, Gauge, Thermometer, Activity, BarChart3, Upload, CheckCircle,
} from "lucide-react";
import {
  Line, LineChart, BarChart, Bar, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
  ScatterChart, Scatter, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  powerCurveData, windDistributionData, windRoseData,
  tempPowerData, airDensityData, kpis,
} from "@/data/windData";
import { saveAnalysisSnapshot } from "@/lib/report";
import type { AnalysisPayload } from "@/types/report";

type AnalysisTab = "performance" | "weibull" | "atmosphere";

const chartLegendStyle = {
  color: "hsl(var(--muted-foreground))",
  fontSize: 12,
};

const axisLabelProps = {
  fill: "hsl(var(--muted-foreground))",
  fontSize: 12,
  textAnchor: "middle" as const,
};

const powerCurveGridProps = {
  stroke: "hsl(var(--foreground))",
  strokeOpacity: 0.22,
  strokeDasharray: "3 3",
};

const weibullPdf = (v: number, k: number, c: number) => {
  if (v < 0 || k <= 0 || c <= 0) {
    return 0;
  }
  const vc = v / c;
  return (k / c) * (vc ** (k - 1)) * Math.exp(-(vc ** k));
};

const weibullCdf = (v: number, k: number, c: number) => {
  if (v <= 0 || k <= 0 || c <= 0) {
    return 0;
  }
  return 1 - Math.exp(-((v / c) ** k));
};

const parseBinBounds = (range: string): { left: number; right: number | null } | null => {
  if (range.includes("-")) {
    const [leftRaw, rightRaw] = range.split("-");
    const left = Number(leftRaw);
    const right = Number(rightRaw);
    if (!Number.isNaN(left) && !Number.isNaN(right)) {
      return { left, right };
    }
  }

  if (range.endsWith("+")) {
    const left = Number(range.slice(0, -1));
    if (!Number.isNaN(left)) {
      return { left, right: null };
    }
  }
  return null;
};

const estimateBinWidth = (ranges: string[]): number => {
  const widths = ranges
    .map((range) => parseBinBounds(range))
    .filter((bin): bin is { left: number; right: number } => !!bin && bin.right !== null)
    .map((bin) => bin.right - bin.left)
    .filter((width) => width > 0);
  return widths.length > 0 ? widths[0] : 1;
};

const ChartCard = ({
  title,
  purpose,
  children,
  className = "",
}: {
  title: string;
  purpose?: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={`glass-card flex flex-col p-5 ${className}`}>
    <div className="mb-4">
      <h3 className="font-display text-base font-semibold text-foreground">{title}</h3>
      {purpose && <p className="mt-1 text-xs text-muted-foreground">{purpose}</p>}
    </div>
    <div className="flex-1 min-h-0">{children}</div>
  </div>
);

const AnalyseEolienne = () => {
  const [loaded, setLoaded] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AnalysisTab>("performance");

  useEffect(() => {
    if (!loaded) {
      return;
    }

    const controller = new AbortController();
    const loadAnalysis = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("http://127.0.0.1:8000/api/analyse/main-louis", {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("Impossible de récupérer l'analyse depuis le serveur FastAPI.");
        }
        const payload = (await response.json()) as AnalysisPayload;
        setAnalysis(payload);
        saveAnalysisSnapshot(payload);
      } catch (fetchError) {
        if ((fetchError as Error).name === "AbortError") {
          return;
        }
        setError((fetchError as Error).message);
      } finally {
        setLoading(false);
      }
    };

    void loadAnalysis();
    return () => controller.abort();
  }, [loaded]);

  const currentData = analysis ?? {
    sourceNotebook: "script/main_louis.ipynb",
    sourceDataFile: "script/donnees.txt",
    powerCurveData,
    windDistributionData,
    windRoseData,
    tempPowerData,
    airDensityData,
    kpis,
  };

  const kpiCards = [
    {
      icon: BarChart3,
      label: "Disponibilité",
      value: `${currentData.kpis.availability}%`,
      color: "text-chart-1",
      help: "Part des enregistrements où status=1 (machine en fonctionnement). C'est un proxy de disponibilité opérationnelle.",
    },
    {
      icon: Zap,
      label: "Puissance nominale",
      value: `${currentData.kpis.ratedPower} MW`,
      color: "text-chart-1",
      help: "Puissance maximale atteinte en exploitation. Elle sert de référence pour évaluer les performances relatives.",
    },
    {
      icon: Wind,
      label: "Vitesse démarrage",
      value: `${currentData.kpis.cutInSpeed} m/s`,
      color: "text-chart-2",
      help: "Seuil de vent à partir duquel la turbine produit de l'énergie utile.",
    },
    {
      icon: Gauge,
      label: "Vitesse nominale",
      value: `${currentData.kpis.ratedSpeed} m/s`,
      color: "text-chart-3",
      help: "Vitesse de vent où la puissance nominale est atteinte puis régulée.",
    },
    {
      icon: Activity,
      label: "Facteur de capacité",
      value: `${(currentData.kpis.capacityFactor * 100).toFixed(0)}%`,
      color: "text-chart-5",
      help: "Ratio entre production moyenne et production théorique nominale. Mesure directe du niveau d'exploitation du parc.",
    },
    {
      icon: Thermometer,
      label: "Weibull k / c",
      value: `${currentData.kpis.weibullK} / ${currentData.kpis.weibullC}`,
      color: "text-chart-2",
      help: "Paramètres de distribution du vent : k (forme) et c (échelle). Ils servent à la modélisation du productible.",
    },
  ];

  const windBinWidth = estimateBinWidth(currentData.windDistributionData.map((bin) => bin.range));

  const weibullDistributionData = currentData.windDistributionData
    .map((bin) => {
      const bounds = parseBinBounds(bin.range);
      if (!bounds) {
        return null;
      }
      const left = bounds.left;
      const right = bounds.right ?? (bounds.left + windBinWidth);
      const weibullPct = (weibullCdf(right, currentData.kpis.weibullK, currentData.kpis.weibullC)
        - weibullCdf(left, currentData.kpis.weibullK, currentData.kpis.weibullC)) * 100;
      return {
        range: bin.range,
        observedPct: bin.pct,
        weibullPct: Number(weibullPct.toFixed(2)),
      };
    })
    .filter((v): v is { range: string; observedPct: number; weibullPct: number } => v !== null);

  if (!loaded) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md text-center"
        >
          <Wind className="mx-auto mb-6 h-16 w-16 text-primary/40" />
          <h2 className="mb-3 font-display text-2xl font-semibold text-foreground">
            Charger les données
          </h2>
          <p className="mb-8 text-muted-foreground">
            Chargez le fichier <code className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono text-foreground">donnees.txt</code>{" "}
            pour générer l'analyse complète du fonctionnement de l'éolienne.
          </p>
          <button
            onClick={() => setLoaded(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Upload className="h-4 w-4" />
            Charger donnees.txt
          </button>
          <p className="mt-3 text-xs text-muted-foreground">
            19 918 mesures · 6 variables · Analyse via main_louis.ipynb
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-6 py-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <CheckCircle className="h-5 w-5 text-chart-2" />
        <div className="flex-1">
          <h2 className="font-display text-xl font-semibold text-foreground">
            Analyse éolienne — données.txt
          </h2>
          <p className="text-sm text-muted-foreground">
            {currentData.kpis.totalMeasurements.toLocaleString()} mesures · {currentData.kpis.retainedMeasurements.toLocaleString()} retenues (status=1) · Script: main_louis.ipynb
          </p>
        </div>
        <Link
          to="/rapport/eolien"
          className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          Ouvrir l'éditeur de rapport
        </Link>
      </div>
      {loading && (
        <div className="glass-card p-3 text-sm text-muted-foreground">
          Calcul des analyses en cours via FastAPI...
        </div>
      )}
      {error && (
        <div className="glass-card p-3 text-sm text-destructive">
          {error} Affichage des données locales de secours.
        </div>
      )}

      <div className="glass-card p-4 text-sm text-muted-foreground">
        Référence méthode : <span className="font-medium text-foreground">{currentData.sourceNotebook}</span> ·{" "}
        <span className="font-medium text-foreground">{currentData.sourceDataFile}</span>
      </div>

      {/* KPIs détaillés */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {kpiCards.map((k, i) => (
          <Tooltip key={k.label}>
            <TooltipTrigger asChild>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass-card flex cursor-help items-center gap-3 p-4"
              >
                <k.icon className={`h-5 w-5 shrink-0 ${k.color}`} />
                <div>
                  <p className="font-display text-lg font-bold text-foreground">{k.value}</p>
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                </div>
              </motion.div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
              {k.help}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>

      {/* Méthodologie */}
      <div className="glass-card p-5">
        <h3 className="font-display text-base font-semibold text-foreground">Méthodologie d&apos;analyse</h3>
        <div className="mt-3 grid gap-3 text-sm text-muted-foreground md:grid-cols-4">
          <div className="rounded-lg bg-muted/40 p-3">
            <p className="font-medium text-foreground">1) Qualification des données</p>
            <p>Filtrage des mesures sur status=1, conversion numérique, contrôle des colonnes critiques.</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-3">
            <p className="font-medium text-foreground">2) Physique atmosphérique</p>
            <p>Calcul de densité de l&apos;air rho = P/(R*T), puis estimation du potentiel rho.v^3.</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-3">
            <p className="font-medium text-foreground">3) Performance machine</p>
            <p>Courbe P(V) (médiane, Q10, Q90), repérage V démarrage et V nominale.</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-3">
            <p className="font-medium text-foreground">4) Ressource vent</p>
            <p>Distribution empirique des vitesses et ajustement par Weibull (k, c) pour projection énergétique.</p>
          </div>
        </div>
      </div>

      <div className="border-b border-border">
        <div className="flex flex-wrap gap-1">
          {[
            { id: "performance", label: "Performance machine" },
            { id: "weibull", label: "Ressource vent et Weibull" },
            { id: "atmosphere", label: "Direction et atmosphère" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as AnalysisTab)}
              className={`rounded-t-md px-4 py-2 text-sm transition-colors ${
                activeTab === tab.id
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "performance" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard
            title="Courbe de puissance expérimentale"
            purpose="Lecture simplifiée de la courbe de puissance (médiane) avec bornes Q10/Q90 pour estimer la dispersion."
          >
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={currentData.powerCurveData}>
                <CartesianGrid {...powerCurveGridProps} />
                <XAxis dataKey="speed" label={{ value: "Vent [m/s]", position: "insideBottom", offset: -5, ...axisLabelProps }} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis label={{ value: "MW", angle: -90, position: "insideLeft", ...axisLabelProps }} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="q90"
                  stroke="hsl(var(--chart-1))"
                  strokeOpacity={0.45}
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                  dot={false}
                  name="Q90"
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="q10"
                  stroke="hsl(var(--chart-1))"
                  strokeOpacity={0.45}
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                  dot={false}
                  name="Q10"
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="power"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2.8}
                  dot={false}
                  name="Médiane"
                  animationDuration={450}
                  animationEasing="ease-out"
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Synthèse opérationnelle" purpose="Consolide les indicateurs pour décision de conduite, maintenance et benchmark inter-sites.">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ["Mesures totales", currentData.kpis.totalMeasurements.toLocaleString()],
                ["Mesures retenues", currentData.kpis.retainedMeasurements.toLocaleString()],
                ["Disponibilité machine", `${currentData.kpis.availability}%`],
                ["Puissance à 0 W", `${currentData.kpis.zeroPowerRatio}%`],
                ["Puissance nominale", `${currentData.kpis.ratedPower} MW`],
                ["Vitesse de démarrage", `${currentData.kpis.cutInSpeed} m/s`],
                ["Vitesse nominale", `${currentData.kpis.ratedSpeed} m/s`],
                ["Facteur de capacité", `${(currentData.kpis.capacityFactor * 100).toFixed(0)}%`],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium text-foreground">{value}</span>
                </div>
              ))}
            </div>
          </ChartCard>
        </div>
      )}

      {activeTab === "weibull" && (
        <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Distribution observée vs ajustement Weibull"
          purpose="Vérifie la cohérence statistique de la ressource vent; indispensable pour extrapoler la production annuelle."
        >
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={weibullDistributionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="range" interval={1} label={{ value: "Classes de vitesse [m/s]", position: "insideBottom", offset: -5, ...axisLabelProps }} stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis label={{ value: "Fréquence [%]", angle: -90, position: "insideLeft", ...axisLabelProps }} stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Legend verticalAlign="top" height={28} wrapperStyle={chartLegendStyle} />
              <Bar dataKey="observedPct" barSize={12} fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} name="Fréquence observée" />
              <Line dataKey="weibullPct" type="monotone" stroke="hsl(var(--chart-3))" strokeWidth={2.5} dot={false} name={`Weibull k=${currentData.kpis.weibullK}, c=${currentData.kpis.weibullC}`} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Distribution du vent (comptages)"
          purpose="Indique le régime de fonctionnement le plus fréquent de l'éolienne pour dimensionner l'exploitation."
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={currentData.windDistributionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="range" interval={1} label={{ value: "Classes de vitesse [m/s]", position: "insideBottom", offset: -5, ...axisLabelProps }} stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis label={{ value: "Nombre de mesures", angle: -90, position: "insideLeft", ...axisLabelProps }} stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Legend verticalAlign="top" height={28} wrapperStyle={chartLegendStyle} />
              <Bar dataKey="count" barSize={12} fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} name="Nb mesures" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        </div>
      )}

      {activeTab === "atmosphere" && (
        <>
          <div className="grid gap-6 lg:grid-cols-3">
        <ChartCard
          title="Rose des vents (fréquence %)"
          purpose="Identifie les directions dominantes de vent pour relier l'environnement du site aux performances et aux contraintes d'implantation."
        >
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={currentData.windRoseData} cx="50%" cy="50%" outerRadius="75%">
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="dir" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <PolarRadiusAxis tick={{ fontSize: 10 }} stroke="hsl(var(--border))" />
              <Radar name="Fréquence" dataKey="freq" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.25} />
              <Legend wrapperStyle={chartLegendStyle} />
            </RadarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard
          title="Puissance moyenne par direction"
          purpose="Met en évidence les directions qui apportent le plus d'énergie, pour détecter des masques de vent ou pertes directionnelles."
        >
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={currentData.windRoseData} cx="50%" cy="50%" outerRadius="75%">
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="dir" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <PolarRadiusAxis tick={{ fontSize: 10 }} stroke="hsl(var(--border))" />
              <Radar name="Puissance moy. (kW)" dataKey="avgPower" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.25} />
              <Legend wrapperStyle={chartLegendStyle} />
            </RadarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Densité de l'air"
          purpose="Quantifie la variabilité de rho (kg/m^3), variable clé de la puissance aérodynamique ; utile pour contextualiser les écarts de production."
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={currentData.airDensityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="density" label={{ value: "Classes de densité [kg/m^3]", position: "insideBottom", offset: 4, ...axisLabelProps }} stroke="hsl(var(--muted-foreground))" fontSize={10} angle={-30} textAnchor="end" height={58} />
              <YAxis label={{ value: "Nombre de mesures", angle: -90, position: "insideLeft", ...axisLabelProps }} stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Legend verticalAlign="top" height={28} wrapperStyle={chartLegendStyle} />
              <Bar dataKey="count" barSize={10} fill="hsl(var(--chart-5))" radius={[3, 3, 0, 0]} name="Nb mesures" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

          <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Effet de la température sur la densité de puissance"
          purpose="Montre l'impact thermique sur le potentiel énergétique (rho.v^3 normalisé), pour distinguer effet météo et performance machine."
        >
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="temp" name="Temp °C" stroke="hsl(var(--muted-foreground))" fontSize={12} label={{ value: "Température [°C]", position: "insideBottom", offset: -5, ...axisLabelProps }} />
              <YAxis dataKey="power" name="rho.v^3 norm." label={{ value: "rho.v^3 normalisé [-]", angle: -90, position: "insideLeft", ...axisLabelProps }} stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Scatter data={currentData.tempPowerData} fill="hsl(var(--chart-4))" name="ρ·v³ normalisé" />
              <Legend verticalAlign="top" height={28} wrapperStyle={chartLegendStyle} />
            </ScatterChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Paramètres de modélisation Weibull" purpose="Rappel des paramètres utilisés pour l'ajustement de distribution et la projection du productible.">
          <div className="space-y-3 text-sm">
            <div className="rounded-lg bg-muted/50 px-3 py-2">
              <p className="text-muted-foreground">Paramètre de forme (k)</p>
              <p className="font-medium text-foreground">{currentData.kpis.weibullK}</p>
            </div>
            <div className="rounded-lg bg-muted/50 px-3 py-2">
              <p className="text-muted-foreground">Paramètre d&apos;échelle (c)</p>
              <p className="font-medium text-foreground">{currentData.kpis.weibullC} m/s</p>
            </div>
            <div className="rounded-lg bg-muted/50 px-3 py-2 text-muted-foreground">
              La superposition histogramme / Weibull permet de vérifier que le modèle statistique reste fidèle aux fréquences observées sur site.
            </div>
          </div>
        </ChartCard>
      </div>
        </>
      )}
    </div>
  );
};

export default AnalyseEolienne;
