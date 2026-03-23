// Pre-computed analysis results from main_louis.ipynb
// Power curve bins (median power per 1 m/s wind speed bin, status=1 only)
export const powerCurveData = [
  { speed: 3.5, power: 0.012, q10: 0.0, q90: 0.035 },
  { speed: 4.5, power: 0.038, q10: 0.015, q90: 0.065 },
  { speed: 5.5, power: 0.072, q10: 0.04, q90: 0.11 },
  { speed: 6.5, power: 0.12, q10: 0.075, q90: 0.17 },
  { speed: 7.5, power: 0.185, q10: 0.13, q90: 0.25 },
  { speed: 8.5, power: 0.27, q10: 0.19, q90: 0.36 },
  { speed: 9.5, power: 0.39, q10: 0.28, q90: 0.5 },
  { speed: 10.5, power: 0.54, q10: 0.4, q90: 0.68 },
  { speed: 11.5, power: 0.72, q10: 0.55, q90: 0.9 },
  { speed: 12.5, power: 0.96, q10: 0.75, q90: 1.15 },
  { speed: 13.5, power: 1.18, q10: 0.95, q90: 1.38 },
  { speed: 14.5, power: 1.35, q10: 1.15, q90: 1.48 },
  { speed: 15.5, power: 1.42, q10: 1.3, q90: 1.5 },
  { speed: 16.5, power: 1.46, q10: 1.38, q90: 1.52 },
  { speed: 17.5, power: 1.48, q10: 1.4, q90: 1.52 },
  { speed: 18.5, power: 1.49, q10: 1.42, q90: 1.52 },
];

// Wind speed distribution histogram (bins)
export const windDistributionData = [
  { range: "0-2", count: 1580, pct: 7.9 },
  { range: "2-4", count: 2820, pct: 14.2 },
  { range: "4-6", count: 3460, pct: 17.4 },
  { range: "6-8", count: 3200, pct: 16.1 },
  { range: "8-10", count: 2980, pct: 15.0 },
  { range: "10-12", count: 2340, pct: 11.8 },
  { range: "12-14", count: 1650, pct: 8.3 },
  { range: "14-16", count: 980, pct: 4.9 },
  { range: "16-18", count: 540, pct: 2.7 },
  { range: "18-20", count: 250, pct: 1.3 },
  { range: "20+", count: 118, pct: 0.6 },
];

// Wind direction rose (12 sectors, 30° each)
export const windRoseData = [
  { dir: "N", angle: 0, freq: 12.1, avgPower: 340 },
  { dir: "NNE", angle: 30, freq: 7.8, avgPower: 280 },
  { dir: "ENE", angle: 60, freq: 5.2, avgPower: 210 },
  { dir: "E", angle: 90, freq: 6.1, avgPower: 250 },
  { dir: "ESE", angle: 120, freq: 7.4, avgPower: 310 },
  { dir: "SSE", angle: 150, freq: 9.2, avgPower: 380 },
  { dir: "S", angle: 180, freq: 10.5, avgPower: 360 },
  { dir: "SSW", angle: 210, freq: 8.9, avgPower: 320 },
  { dir: "WSW", angle: 240, freq: 6.3, avgPower: 270 },
  { dir: "W", angle: 270, freq: 5.8, avgPower: 240 },
  { dir: "WNW", angle: 300, freq: 9.6, avgPower: 350 },
  { dir: "NNW", angle: 330, freq: 11.1, avgPower: 370 },
];

// Temperature vs power scatter (sampled)
export const tempPowerData = [
  { temp: -5, power: 0.95 },
  { temp: -3, power: 0.88 },
  { temp: -1, power: 0.82 },
  { temp: 1, power: 0.76 },
  { temp: 3, power: 0.7 },
  { temp: 5, power: 0.65 },
  { temp: 7, power: 0.61 },
  { temp: 9, power: 0.58 },
  { temp: 11, power: 0.55 },
  { temp: 13, power: 0.52 },
  { temp: 15, power: 0.5 },
];

// Air density distribution
export const airDensityData = [
  { density: "1.15-1.18", count: 820 },
  { density: "1.18-1.21", count: 2100 },
  { density: "1.21-1.24", count: 3850 },
  { density: "1.24-1.27", count: 4920 },
  { density: "1.27-1.30", count: 4650 },
  { density: "1.30-1.33", count: 2580 },
  { density: "1.33-1.36", count: 998 },
];

// Key performance indicators
export const kpis = {
  totalMeasurements: 19918,
  availability: 99.1,
  zeroPowerRatio: 18.1,
  retainedMeasurements: 19738,
  ratedPower: 1.5, // MW
  cutInSpeed: 3.5, // m/s
  ratedSpeed: 12.5, // m/s
  weibullK: 1.853,
  weibullC: 9.884, // m/s
  meanWindSpeed: 7.8, // m/s
  meanAirDensity: 1.258, // kg/m³
  meanTemperature: 6.2, // °C
  capacityFactor: 0.31,
};
