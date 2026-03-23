import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Wind, Zap, Gauge, Thermometer, Activity, BarChart3, Upload, CheckCircle,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ScatterChart, Scatter, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import {
  powerCurveData, windDistributionData, windRoseData,
  tempPowerData, airDensityData, kpis,
} from "@/data/windData";

type AnalysisPayload = {
  sourceNotebook: string;
  sourceDataFile: string;
  powerCurveData: typeof powerCurveData;
  windDistributionData: typeof windDistributionData;
  windRoseData: typeof windRoseData;
  tempPowerData: typeof tempPowerData;
  airDensityData: typeof airDensityData;
  kpis: typeof kpis;
};

const ChartCard = ({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) => (
  <div className={`glass-card flex flex-col p-5 ${className}`}>
    <h3 className="mb-4 font-display text-base font-semibold text-foreground">{title}</h3>
    <div className="flex-1 min-h-0">{children}</div>
  </div>
);

const Analyse = () => {
  const [loaded, setLoaded] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          throw new Error("Impossible de recuperer l'analyse depuis le serveur FastAPI.");
        }
        const payload = (await response.json()) as AnalysisPayload;
        setAnalysis(payload);
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
    { icon: Zap, label: "Puissance nominale", value: `${currentData.kpis.ratedPower} MW`, color: "text-chart-1" },
    { icon: Wind, label: "Vitesse demarrage", value: `${currentData.kpis.cutInSpeed} m/s`, color: "text-chart-2" },
    { icon: Gauge, label: "Vitesse nominale", value: `${currentData.kpis.ratedSpeed} m/s`, color: "text-chart-3" },
    { icon: Activity, label: "Facteur de capacite", value: `${(currentData.kpis.capacityFactor * 100).toFixed(0)}%`, color: "text-chart-5" },
    { icon: BarChart3, label: "Disponibilite", value: `${currentData.kpis.availability}%`, color: "text-chart-1" },
    { icon: Thermometer, label: "Weibull k / c", value: `${currentData.kpis.weibullK} / ${currentData.kpis.weibullC}`, color: "text-chart-2" },
  ];

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
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground">
            Analyse — donnees.txt
          </h2>
          <p className="text-sm text-muted-foreground">
            {currentData.kpis.totalMeasurements.toLocaleString()} mesures · {currentData.kpis.retainedMeasurements.toLocaleString()} retenues (status=1) · Script: main_louis.ipynb
          </p>
        </div>
      </div>
      {loading && (
        <div className="glass-card p-3 text-sm text-muted-foreground">
          Calcul des analyses en cours via FastAPI...
        </div>
      )}
      {error && (
        <div className="glass-card p-3 text-sm text-destructive">
          {error} Affichage des donnees locales de secours.
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {kpiCards.map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card flex items-center gap-3 p-4"
          >
            <k.icon className={`h-5 w-5 shrink-0 ${k.color}`} />
            <div>
              <p className="font-display text-lg font-bold text-foreground">{k.value}</p>
              <p className="text-xs text-muted-foreground">{k.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Courbe de puissance expérimentale">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={currentData.powerCurveData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="speed" label={{ value: "Vent [m/s]", position: "insideBottom", offset: -4 }} stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis label={{ value: "MW", angle: -90, position: "insideLeft" }} stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="q90" stackId="1" stroke="none" fill="hsl(var(--chart-1))" fillOpacity={0.1} name="Q90" />
              <Area type="monotone" dataKey="q10" stackId="2" stroke="none" fill="hsl(var(--background))" fillOpacity={1} name="Q10" />
              <Line type="monotone" dataKey="power" stroke="hsl(var(--chart-1))" strokeWidth={2.5} dot={false} name="Médiane" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Distribution du vent">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={currentData.windDistributionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="range" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} name="Nb mesures" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid gap-6 lg:grid-cols-3">
        <ChartCard title="Rose des vents (fréquence %)">
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={currentData.windRoseData} cx="50%" cy="50%" outerRadius="75%">
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="dir" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <PolarRadiusAxis tick={{ fontSize: 10 }} stroke="hsl(var(--border))" />
              <Radar name="Fréquence" dataKey="freq" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.25} />
            </RadarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Puissance moyenne par direction">
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={currentData.windRoseData} cx="50%" cy="50%" outerRadius="75%">
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="dir" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <PolarRadiusAxis tick={{ fontSize: 10 }} stroke="hsl(var(--border))" />
              <Radar name="Puissance moy. (kW)" dataKey="avgPower" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.25} />
            </RadarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Densité de l'air">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={currentData.airDensityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="density" stroke="hsl(var(--muted-foreground))" fontSize={10} angle={-30} textAnchor="end" height={50} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} name="Nb mesures" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts row 3 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Effet de la température sur la densité de puissance">
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="temp" name="Temp °C" stroke="hsl(var(--muted-foreground))" fontSize={12} label={{ value: "Température [°C]", position: "insideBottom", offset: -4 }} />
              <YAxis dataKey="power" name="ρ·v³ norm." stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Scatter data={currentData.tempPowerData} fill="hsl(var(--chart-4))" name="ρ·v³ normalisé" />
            </ScatterChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Synthèse notebook — main_louis.ipynb">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ["Mesures totales", currentData.kpis.totalMeasurements.toLocaleString()],
              ["Mesures retenues", currentData.kpis.retainedMeasurements.toLocaleString()],
              ["Disponibilite machine", `${currentData.kpis.availability}%`],
              ["Puissance a 0 W", `${currentData.kpis.zeroPowerRatio}%`],
              ["Puissance nominale", `${currentData.kpis.ratedPower} MW`],
              ["Vitesse de demarrage", `${currentData.kpis.cutInSpeed} m/s`],
              ["Vitesse nominale", `${currentData.kpis.ratedSpeed} m/s`],
              ["Weibull k", currentData.kpis.weibullK.toString()],
              ["Weibull c", `${currentData.kpis.weibullC} m/s`],
              ["Vent moyen", `${currentData.kpis.meanWindSpeed} m/s`],
              ["Densite air moy.", `${currentData.kpis.meanAirDensity} kg/m³`],
              ["Facteur de capacite", `${(currentData.kpis.capacityFactor * 100).toFixed(0)}%`],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium text-foreground">{value}</span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  );
};

export default Analyse;
