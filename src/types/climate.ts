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
