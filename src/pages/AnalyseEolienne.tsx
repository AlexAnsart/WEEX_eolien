import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Wind, Zap, Gauge, Activity, BarChart3, Upload, CheckCircle,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  powerCurveData, windDistributionData, windRoseData,
  tempPowerData, airDensityData, kpis,
} from "@/data/windData";
import { saveAnalysisSnapshot } from "@/lib/report";
import type { AnalysisPayload } from "@/types/report";

type AnalysisTab = "performance" | "weibull" | "direction" | "temperature";

// KPI values produced by script/main_adil_2.ipynb
const machinePerformanceKpisFromAdil2 = {
  cutInSpeed: 4.5, // m/s
  ratedSpeed: 15.5, // m/s
  maxPowerKw: 1436.8, // kW
  efficiencyEta: 0.3966,
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

const ImageChart = ({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) => (
  <div className="overflow-hidden rounded-lg border border-border bg-background/60 p-2">
    <img src={src} alt={alt} className="h-auto w-full rounded-md" loading="lazy" />
  </div>
);

const AnalyseEolienne = () => {
  const [loaded, setLoaded] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AnalysisTab>("performance");
  const [imageStamp, setImageStamp] = useState<number>(Date.now());

  useEffect(() => {
    if (!loaded) {
      return;
    }

    const controller = new AbortController();
    const loadAnalysis = async () => {
      try {
        setLoading(true);
        setError(null);
        await fetch("http://127.0.0.1:8000/api/analyse/main-eolien/images", {
          method: "POST",
          signal: controller.signal,
        });
        setImageStamp(Date.now());
        const response = await fetch("http://127.0.0.1:8000/api/analyse/main-eolien", {
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
  const sortedPowerCurve = [...currentData.powerCurveData].sort((a, b) => a.speed - b.speed);
  const cutOutPoint = sortedPowerCurve.find(
    (point) => point.speed > machinePerformanceKpisFromAdil2.ratedSpeed && point.power <= 0.01,
  );

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
      label: "Puissance maximale",
      value: `${machinePerformanceKpisFromAdil2.maxPowerKw.toFixed(1)} kW`,
      color: "text-chart-1",
      help: "Puissance maximale identifiee dans main_adil_2.ipynb.",
    },
    {
      icon: Wind,
      label: "Vitesse démarrage",
      value: `${machinePerformanceKpisFromAdil2.cutInSpeed.toFixed(1)} m/s`,
      color: "text-chart-2",
      help: "Seuil de vent à partir duquel la turbine produit de l'énergie utile.",
    },
    {
      icon: Gauge,
      label: "Vitesse nominale",
      value: `${machinePerformanceKpisFromAdil2.ratedSpeed.toFixed(1)} m/s`,
      color: "text-chart-3",
      help: "Vitesse de vent où la puissance nominale est atteinte puis régulée.",
    },
    {
      icon: Gauge,
      label: "Vitesse retour a 0",
      value: cutOutPoint ? `${cutOutPoint.speed.toFixed(1)} m/s` : "Non observee",
      color: "text-chart-4",
      help: "Premiere vitesse > rated pour laquelle la puissance retombe a 0 (logique KPI precedente).",
    },
    {
      icon: Activity,
      label: "Rendement eta",
      value: machinePerformanceKpisFromAdil2.efficiencyEta.toFixed(4),
      color: "text-chart-5",
      help: "Rendement eta estime par regression sur la zone productive [cut-in ; rated] dans main_adil_2.ipynb.",
    },
  ];

  const imageBase = `/generated`;
  const imageSrc = {
    powerCurve: `${imageBase}/courbe_puissance.png?t=${imageStamp}`,
    powerCurveScatter: `${imageBase}/puissance_vitesse_brut.png?t=${imageStamp}`,
    powerCurveFitOnly: `${imageBase}/courbe_puissance_ajustee.png?t=${imageStamp}`,
    powerCurveEtaTop: `${imageBase}/courbe_puissance_regression_eta.png?t=${imageStamp}`,
    powerCurveEtaResiduals: `${imageBase}/residus_modele_puissance.png?t=${imageStamp}`,
    windPowerScatter: `${imageBase}/nuage_puissance_vent.png?t=${imageStamp}`,
    tempPowerScatter: `${imageBase}/temperature_puissance_brut.png?t=${imageStamp}`,
    tempPowerRegression: `${imageBase}/temperature_puissance_regression.png?t=${imageStamp}`,
    weibullDistribution: `${imageBase}/distribution_weibull.png?t=${imageStamp}`,
    windRoseFrequency: `${imageBase}/rose_vents_frequence.png?t=${imageStamp}`,
    windRosePower: `${imageBase}/rose_vents_puissance.png?t=${imageStamp}`,
    directionPowerScatter: `${imageBase}/direction_puissance_brut.png?t=${imageStamp}`,
  };
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
            19 918 mesures · 6 variables · Analyse via main_eolien.py
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
            Analyse éolienne via données.txt
          </h2>
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
          Analyse en cours...
        </div>
      )}
      {error && (
        <div className="glass-card p-3 text-sm text-destructive">
          {error} Affichage des données locales de secours.
        </div>
      )}

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

      

      <div className="border-b border-border">
        <div className="flex flex-wrap gap-1">
          {[
            { id: "performance", label: "Performance machine" },
            { id: "weibull", label: "Ressource vent" },
            { id: "direction", label: "Direction du vent" },
            { id: "temperature", label: "Température" },
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
              title="Puissance vs vitesse (données brutes)"
              purpose="Visualisation directe des points de mesure pour conserver le niveau de détail du calcul Python."
            >
              <ImageChart src={imageSrc.powerCurveScatter} alt="Nuage brut puissance en fonction de la vitesse du vent" />
            </ChartCard>

            <ChartCard
              title="Ajustement sur eta"
              purpose="Courbe de puissance ajustée (haut) et résidus du modèle (bas)."
            >
              <div className="grid gap-4">
                <ImageChart src={imageSrc.powerCurveEtaTop} alt="Courbe de puissance avec regression sur eta" />
                <ImageChart src={imageSrc.powerCurveEtaResiduals} alt="Residus de l'ajustement sur eta" />
              </div>
            </ChartCard>
        </div>
      )}

      {activeTab === "weibull" && (
        <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Probabilité de vitesse du vent (image Python)"
          purpose="Distribution observée des vitesses et courbe Weibull ajustée sur les données de site."
        >
          <ImageChart src={imageSrc.weibullDistribution} alt="Distribution des vitesses et ajustement Weibull générés en Python" />
        </ChartCard>

        <ChartCard
          title="Méthodologie d'ajustement"
          purpose="Démarche utilisée pour obtenir une courbe stable et physiquement cohérente."
        >
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded-lg bg-muted/50 p-3">
              1) Nettoyage des données, conversion numérique et filtrage sur <span className="font-medium text-foreground">status=1</span>.
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              2) Binning de la vitesse (pas 1 m/s), calcul moyenne et écart-type de puissance par classe.
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              3) Ajustement sur la zone productive (hors bas régime et hors plateau nominal) puis saturation au nominal observé.
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              4) Ajustement Weibull par méthode des moments (paramètres <span className="font-medium text-foreground">k</span> et <span className="font-medium text-foreground">c</span>) et comparaison à l'histogramme observé.
            </div>
          </div>
        </ChartCard>
        </div>
      )}

      {activeTab === "direction" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard
            title="Pelec[w] en fonction de Dir_Vent_[deg]"
            purpose="Montre l'éparpillement de la puissance selon la direction du vent."
          >
            <ImageChart src={imageSrc.directionPowerScatter} alt="Nuage de points puissance selon direction du vent" />
          </ChartCard>

          <ChartCard
            title="Rose directionnelle de puissance"
            purpose="Puissance moyenne associée à chaque secteur directionnel."
          >
            <ImageChart src={imageSrc.windRosePower} alt="Rose directionnelle de puissance moyenne" />
          </ChartCard>
        </div>
      )}

      {activeTab === "temperature" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard
            title="Température vs puissance (image Python)"
            purpose="Graphique généré côté Python pour lire plus finement la dispersion thermique."
          >
            <ImageChart src={imageSrc.tempPowerScatter} alt="Nuage de points température versus puissance généré en Python" />
          </ChartCard>

          <ChartCard
            title="Régression linéaire à vitesse constante"
            purpose="Effet thermique estimé pour des vitesses de vent fixes, avec droites de régression."
          >
            <ImageChart src={imageSrc.tempPowerRegression} alt="Régressions linéaires de la puissance selon la température à vitesse constante" />
          </ChartCard>
        </div>
      )}
    </div>
  );
};

export default AnalyseEolienne;
