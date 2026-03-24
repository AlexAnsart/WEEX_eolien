import { motion } from "framer-motion";
import { Wind, BarChart3, Zap, Thermometer, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { kpis } from "@/data/windData";

const stats = [
  { icon: Wind, label: "Mesures", value: kpis.totalMeasurements.toLocaleString() },
  { icon: Zap, label: "Puissance nominale", value: `${kpis.ratedPower} MW` },
  { icon: BarChart3, label: "Disponibilité", value: `${kpis.availability}%` },
  { icon: Thermometer, label: "Temp. moyenne", value: `${kpis.meanTemperature} °C` },
];

const features = [
  {
    title: "Courbe de puissance",
    desc: "Modélisation expérimentale de la puissance électrique en fonction de la vitesse du vent, avec enveloppe Q10-Q90.",
  },
  {
    title: "Distribution du vent",
    desc: "Histogramme et ajustement de Weibull pour caractériser le gisement éolien du site.",
  },
  {
    title: "Rose des vents",
    desc: "Analyse directionnelle du vent et de la production pour identifier les orientations optimales.",
  },
  {
    title: "Indicateurs clés",
    desc: "Facteur de capacité, vitesse de démarrage, vitesse nominale et densité de l'air corrigée.",
  },
];

const Home = () => (
  <div className="flex flex-col">
    {/* Hero */}
    <section className="px-6 py-20">
      <div className="mx-auto max-w-4xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <span className="mb-4 inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            WEEX Éolien · Centrale Lyon 2026
          </span>
          <h1 className="mb-6 font-display text-5xl font-bold leading-tight text-foreground">
            Analyse de performance
            <br />
            <span className="text-primary">d'une éolienne</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
            Dashboard interactif pour explorer les données de campagne de mesure certifiée :
            modélisation de la puissance, caractérisation du gisement éolien et identification
            des conditions optimales de fonctionnement.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/analyse"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Analyse éolienne
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/analyse-meteo"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              Analyse météo
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>


  </div>
);

export default Home;
