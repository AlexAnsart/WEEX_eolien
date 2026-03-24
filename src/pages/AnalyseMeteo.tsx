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
        </div>
      </div>
    </div>
  );
};

export default AnalyseMeteo;
