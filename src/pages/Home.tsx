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

    {/* Stats */}
    <section className="border-y border-border bg-muted/30 px-6 py-12">
      <div className="mx-auto grid max-w-4xl grid-cols-2 gap-6 md:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * i, duration: 0.4 }}
            className="text-center"
          >
            <s.icon className="mx-auto mb-2 h-6 w-6 text-primary" />
            <p className="font-display text-2xl font-bold text-foreground">{s.value}</p>
            <p className="text-sm text-muted-foreground">{s.label}</p>
          </motion.div>
        ))}
      </div>
    </section>

    {/* Features */}
    <section className="px-6 py-16">
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-8 text-center font-display text-2xl font-semibold text-foreground">
          Analyses disponibles
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * i, duration: 0.4 }}
              className="glass-card p-6"
            >
              <h3 className="mb-2 font-display text-lg font-semibold text-foreground">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* Context */}
    <section className="border-t border-border px-6 py-16">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="mb-4 font-display text-2xl font-semibold text-foreground">
          Contexte du projet
        </h2>
        <p className="text-muted-foreground">
          Ce projet s'inscrit dans le cadre des{" "}
          <span className="font-medium text-foreground">Weeks of Engineering Experience (WEEX)</span>{" "}
          de l'École Centrale de Lyon. L'objectif est d'analyser les données d'une campagne de mesure
          certifiée d'une éolienne, modéliser sa courbe de puissance et identifier les conditions
          d'exploitation optimales. Les analyses sont réalisées en Python (NumPy, Pandas, SciPy)
          et visualisées via ce dashboard interactif.
        </p>
      </div>
    </section>
  </div>
);

export default Home;
