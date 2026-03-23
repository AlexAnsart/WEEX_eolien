import { useState } from "react";
import { motion } from "framer-motion";
import { CloudSun, MapPinned, Compass, CalendarDays, ArrowRightLeft } from "lucide-react";

const tabs = [
  { id: "context", label: "Contexte mission" },
  { id: "maps", label: "Cartes de l'île" },
  { id: "decision", label: "Aide à la décision" },
] as const;

type TabId = typeof tabs[number]["id"];

const AnalyseMeteo = () => {
  const [activeTab, setActiveTab] = useState<TabId>("context");

  return (
    <div className="flex flex-col gap-6 px-6 py-6">
      <div className="flex items-center gap-3">
        <CloudSun className="h-5 w-5 text-chart-2" />
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground">
            Analyse météo — Centrosus
          </h2>
          <p className="text-sm text-muted-foreground">
            Phase 1 · Mise en situation "Mesure Météo" (slide 41) · Page préparatoire
          </p>
        </div>
      </div>

      <div className="glass-card p-5">
        <h3 className="font-display text-base font-semibold text-foreground">Objectif majeur</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Fournir des outils de prise de décision rapide pour sélectionner les lieux les plus favorables
          à l&apos;installation d&apos;éoliennes, afin de répondre efficacement aux appels à projets.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {[
          { icon: CalendarDays, title: "Horizon", text: "1 an de mesures moyennes journalières" },
          { icon: MapPinned, title: "Couverture", text: "228 parcelles météo sur l'île" },
          { icon: Compass, title: "Variables", text: "Vitesse + direction du vent" },
          { icon: ArrowRightLeft, title: "Finalité", text: "Classement rapide des zones favorables" },
        ].map((item) => (
          <div key={item.title} className="glass-card p-4">
            <item.icon className="mb-2 h-5 w-5 text-primary" />
            <p className="text-sm font-medium text-foreground">{item.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{item.text}</p>
          </div>
        ))}
      </div>

      <div className="border-b border-border">
        <div className="flex flex-wrap gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
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

      {activeTab === "context" && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid gap-6 lg:grid-cols-2"
        >
          <div className="glass-card p-5">
            <h3 className="font-display text-base font-semibold text-foreground">Ce que cette page va couvrir</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>Classement des parcelles selon le potentiel venteux moyen et la variabilité.</li>
              <li>Visualisation des régimes de vent et de l&apos;orientation dominante.</li>
              <li>Pré-sélection de zones favorables pour la phase d&apos;implantation.</li>
              <li>Synthèse décisionnelle orientée "go / no-go" pour appels à projets.</li>
            </ul>
          </div>
          <div className="glass-card p-5">
            <h3 className="font-display text-base font-semibold text-foreground">Méthodologie prévue</h3>
            <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>1. Qualification des 228 fichiers météo (qualité, cohérence, couverture).</li>
              <li>2. Indicateurs par parcelle (vitesse moyenne, dispersion, Weibull k/c).</li>
              <li>3. Agrégation cartographique et score multicritère transparent.</li>
              <li>4. Aide à la décision rapide avec filtres et classement actionnable.</li>
            </ol>
          </div>
        </motion.div>
      )}

      {activeTab === "maps" && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid gap-6 lg:grid-cols-2"
        >
          <div className="glass-card p-5">
            <h3 className="font-display text-base font-semibold text-foreground">Carte de coordonnées (slide 15)</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Base de lecture de la grille de parcelles de Centrosus (pas 5 km x 5 km) pour relier les
              mesures météo aux zones d&apos;implantation.
            </p>
            <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
              <div className="grid grid-cols-8 gap-1 text-center text-[10px] text-muted-foreground">
                {Array.from({ length: 64 }).map((_, i) => (
                  <div key={i} className="rounded bg-background/80 py-2">
                    {i + 1}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Emplacement de référence en attendant l&apos;intégration du visuel officiel de la slide 15.
              </p>
            </div>
          </div>

          <div className="glass-card p-5">
            <h3 className="font-display text-base font-semibold text-foreground">Carte topographique (slide 16)</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Support géographique pour confronter potentiel de vent, relief et accès aux zones de projet.
            </p>
            <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
              <div className="h-52 rounded-md bg-gradient-to-br from-emerald-900/30 via-sky-900/30 to-slate-900/30" />
              <p className="mt-3 text-xs text-muted-foreground">
                Fond topographique temporaire. Le rendu sera remplacé par la carte de la slide 16.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === "decision" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
          <h3 className="font-display text-base font-semibold text-foreground">Aide à la décision (prochaines étapes)</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Tableau de priorisation</p>
              <p className="mt-1">Classement des parcelles par potentiel, stabilité et cohérence directionnelle.</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Mode décision rapide</p>
              <p className="mt-1">Filtres pour isoler les zones "favorables", "à étudier", "à exclure".</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Justification technique</p>
              <p className="mt-1">Affichage des critères ayant conduit au classement de chaque parcelle.</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Export de synthèse</p>
              <p className="mt-1">Sortie orientée réponse à appel à projets (argumentaire + shortlist).</p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default AnalyseMeteo;
