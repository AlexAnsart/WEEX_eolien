import type { AnalysisPayload, EolienReportPayload } from "@/types/report";

const ANALYSIS_CACHE_KEY = "weex:eolien:analysis-snapshot";

export const defaultGenericSections = {
  introduction:
    "Cette etude presente une analyse des performances d'une eolienne a partir de mesures terrain certifiees. L'objectif est de caracteriser la production, les regimes de vent dominants et les conditions d'exploitation du site.",
  theoreticalFramework:
    "La production eolienne depend principalement de la vitesse du vent, de la densite de l'air et de la courbe de puissance de la machine. La distribution de Weibull est utilisee pour modeliser statistiquement la ressource en vent.",
  methodology:
    "Les donnees sont filtrees sur les periodes de fonctionnement (status=1). Les indicateurs de performance sont calcules a partir des mesures retenues. Les graphiques de puissance, distribution des vitesses et rose des vents sont utilises pour l'interpretation.",
  conclusion:
    "L'analyse met en evidence les performances observees du site et fournit des recommandations d'interpretation pour l'exploitation et le suivi de la turbine.",
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
