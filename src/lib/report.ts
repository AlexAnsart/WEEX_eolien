import type { AnalysisPayload, EolienReportPayload } from "@/types/report";

const ANALYSIS_CACHE_KEY = "weex:eolien:analysis-snapshot";

export const defaultGenericSections = {
  introduction:
    "Cette étude présente une analyse des performances d'une éolienne à partir de mesures terrain certifiées. L'objectif est de caractériser la production, les régimes de vent dominants et les conditions d'exploitation du site.",
  theoreticalFramework:
    "La production éolienne dépend principalement de la vitesse du vent, de la densité de l'air et de la courbe de puissance de la machine. La distribution de Weibull est utilisée pour modéliser statistiquement la ressource en vent.",
  methodology:
    "Les données sont filtrées sur les périodes de fonctionnement (status=1). Les indicateurs de performance sont calculés à partir des mesures retenues. Les graphiques de puissance, distribution des vitesses et rose des vents sont utilisés pour l'interprétation.",
  conclusion:
    "L'analyse met en évidence les performances observées du site et fournit des recommandations d'interprétation pour l'exploitation et le suivi de la turbine.",
};

export const defaultReportMetadata: EolienReportPayload["metadata"] = {
  title: "Rapport d'analyse d'une éolienne",
  ue: "WEEX Éolienne",
  students: [],
};

export const saveAnalysisSnapshot = (analysis: AnalysisPayload) => {
  localStorage.setItem(ANALYSIS_CACHE_KEY, JSON.stringify(analysis));
};

export const loadAnalysisSnapshot = (): AnalysisPayload | null => {
  const raw = localStorage.getItem(ANALYSIS_CACHE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as AnalysisPayload;
  } catch {
    return null;
  }
};

export const buildReportPayload = (args: {
  metadata: EolienReportPayload["metadata"];
  genericSections: EolienReportPayload["genericSections"];
  analysis: AnalysisPayload;
  chartSections: EolienReportPayload["chartSections"];
}): EolienReportPayload => ({
  reportVersion: 1,
  metadata: args.metadata,
  genericSections: args.genericSections,
  analysisSummary: {
    sourceNotebook: args.analysis.sourceNotebook,
    sourceDataFile: args.analysis.sourceDataFile,
    kpis: args.analysis.kpis,
  },
  chartSections: args.chartSections,
  generatedAtIso: new Date().toISOString(),
});
