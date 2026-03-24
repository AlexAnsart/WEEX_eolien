export type AnalysisPayload = {
  sourceNotebook: string;
  sourceDataFile: string;
  powerCurveData: Array<{ speed: number; power: number; q10: number; q90: number }>;
  windDistributionData: Array<{ range: string; count: number; pct: number }>;
  windRoseData: Array<{ dir: string; angle: number; freq: number; avgPower: number }>;
  tempPowerData: Array<{ temp: number; power: number }>;
  airDensityData: Array<{ density: string; count: number }>;
  kpis: {
    totalMeasurements: number;
    availability: number;
    zeroPowerRatio: number;
    retainedMeasurements: number;
    ratedPower: number;
    cutInSpeed: number;
    ratedSpeed: number;
    weibullK: number;
    weibullC: number;
    meanWindSpeed: number;
    meanAirDensity: number;
    meanTemperature: number;
    capacityFactor: number;
  };
};

export type ReportChartSection = {
  id: string;
  title: string;
  caption: string;
  interpretation: string;
  imageBase64: string;
};

export type EolienReportPayload = {
  reportVersion: 1;
  metadata: {
    title: string;
    ue: string;
    students: string[];
  };
  genericSections: {
    introduction: string;
    theoreticalFramework: string;
    methodology: string;
    conclusion: string;
  };
  analysisSummary: Pick<AnalysisPayload, "sourceNotebook" | "sourceDataFile" | "kpis">;
  chartSections: ReportChartSection[];
  generatedAtIso: string;
};
