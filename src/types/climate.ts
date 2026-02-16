export interface DailyRecord {
  date: string;      // "YYYY-MM-DD"
  avgTemp: number;   // 평균기온
  minTemp: number;   // 최저기온
  maxTemp: number;   // 최고기온
}

export interface CityData {
  cityId: string;
  cityName: string;
  stationId: number;
  records: DailyRecord[];
}

export interface AnnualAnomaly {
  year: number;
  anomaly: number;       // 기준기간 대비 편차
  avgTemp: number;       // 연평균기온
}

export interface MonthlyAnomaly {
  year: number;
  month: number;         // 1-12
  anomaly: number;
  avgTemp: number;
}

export interface DecadeStats {
  decade: string;        // "1960s", "1970s", ...
  startYear: number;
  endYear: number;
  avgTemp: number;
  diffFromFirst: number; // 첫 10년 대비 차이
}

export interface CityInfo {
  id: string;
  name: string;
  nameEn: string;
  stationId: number;
  observationStart: number;
  lat: number;
  lon: number;
}

export interface ExtremeRecord {
  value: number;
  date: string;
}

export interface CityStats {
  allTimeHigh: ExtremeRecord;
  allTimeLow: ExtremeRecord;
  recentDecadeAvg: number;
  firstDecadeAvg: number;
  tempChange: number;
  tropicalNights: { year: number; count: number }[];
  heatwaveDays: { year: number; count: number }[];
}

// --- 분석 기능 타입 ---

export interface ForecastPoint {
  year: number;
  value: number;       // 회귀 예측값
  lower: number;       // 95% 하한
  upper: number;       // 95% 상한
}

export interface ForecastResult {
  historical: AnnualAnomaly[];
  forecast: ForecastPoint[];
  slope: number;         // 연간 변화율 (℃/yr)
  intercept: number;
  rSquared: number;
  slopePerDecade: number; // 10년당 변화율
}

export interface AnomalyFlag {
  year: number;
  anomaly: number;
  avgTemp: number;
  zScore: number;
  isAnomaly: boolean;   // |z| > threshold
}

export interface AnomalyDetectionResult {
  flags: AnomalyFlag[];
  mean: number;
  std: number;
  threshold: number;
}

export interface DecompositionPoint {
  year: number;
  month: number;
  observed: number;
  trend: number | null;
  seasonal: number;
  residual: number | null;
}

export interface DecompositionResult {
  points: DecompositionPoint[];
}
