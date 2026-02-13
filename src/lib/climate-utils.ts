import type {
  DailyRecord,
  AnnualAnomaly,
  MonthlyAnomaly,
  DecadeStats,
  CityStats,
  ExtremeRecord,
} from '@/types/climate';
import { BASELINE_START, BASELINE_END } from './constants';

/**
 * 기준기간(1973-2000) 연평균기온 계산
 */
export function calcBaselineAnnualMean(records: DailyRecord[]): number {
  const baselineRecords = records.filter((r) => {
    const year = parseInt(r.date.slice(0, 4));
    return year >= BASELINE_START && year <= BASELINE_END;
  });
  if (baselineRecords.length === 0) return 0;
  return baselineRecords.reduce((sum, r) => sum + r.avgTemp, 0) / baselineRecords.length;
}

/**
 * 기준기간 월별 평균기온 계산
 */
export function calcBaselineMonthlyMeans(records: DailyRecord[], startYear?: number, endYear?: number): Map<number, number> {
  const bStart = startYear ?? BASELINE_START;
  const bEnd = endYear ?? BASELINE_END;
  const monthlyData = new Map<number, number[]>();
  for (let m = 1; m <= 12; m++) monthlyData.set(m, []);

  records.forEach((r) => {
    const year = parseInt(r.date.slice(0, 4));
    const month = parseInt(r.date.slice(5, 7));
    if (year >= bStart && year <= bEnd) {
      monthlyData.get(month)!.push(r.avgTemp);
    }
  });

  const means = new Map<number, number>();
  monthlyData.forEach((temps, month) => {
    means.set(month, temps.length > 0 ? temps.reduce((a, b) => a + b, 0) / temps.length : 0);
  });
  return means;
}

/**
 * 기준기간 일별 평균기온 계산 (366일 - 윤년 포함)
 */
export function calcBaselineDailyMeans(records: DailyRecord[]): Map<string, number> {
  const dailyData = new Map<string, number[]>(); // "MM-DD" → temps

  records.forEach((r) => {
    const year = parseInt(r.date.slice(0, 4));
    if (year >= BASELINE_START && year <= BASELINE_END) {
      const mmdd = r.date.slice(5); // "MM-DD"
      if (!dailyData.has(mmdd)) dailyData.set(mmdd, []);
      dailyData.get(mmdd)!.push(r.avgTemp);
    }
  });

  const means = new Map<string, number>();
  dailyData.forEach((temps, mmdd) => {
    means.set(mmdd, temps.reduce((a, b) => a + b, 0) / temps.length);
  });
  return means;
}

/**
 * 연간 평균기온 편차 계산
 */
export function calcAnnualAnomalies(records: DailyRecord[]): AnnualAnomaly[] {
  const baselineMean = calcBaselineAnnualMean(records);
  const yearlyData = new Map<number, number[]>();

  records.forEach((r) => {
    const year = parseInt(r.date.slice(0, 4));
    if (!yearlyData.has(year)) yearlyData.set(year, []);
    yearlyData.get(year)!.push(r.avgTemp);
  });

  const anomalies: AnnualAnomaly[] = [];
  const sortedYears = Array.from(yearlyData.keys()).sort((a, b) => a - b);

  sortedYears.forEach((year) => {
    const temps = yearlyData.get(year)!;
    if (temps.length < 300) return; // 결측 너무 많은 연도 제외
    const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
    anomalies.push({
      year,
      anomaly: avgTemp - baselineMean,
      avgTemp,
    });
  });

  return anomalies;
}

/**
 * 월별 기온 편차 계산
 */
export function calcMonthlyAnomalies(records: DailyRecord[]): MonthlyAnomaly[] {
  const baselineMonthly = calcBaselineMonthlyMeans(records);
  const monthlyData = new Map<string, number[]>(); // "YYYY-MM" → temps

  records.forEach((r) => {
    const key = r.date.slice(0, 7); // "YYYY-MM"
    if (!monthlyData.has(key)) monthlyData.set(key, []);
    monthlyData.get(key)!.push(r.avgTemp);
  });

  const anomalies: MonthlyAnomaly[] = [];

  monthlyData.forEach((temps, key) => {
    const year = parseInt(key.slice(0, 4));
    const month = parseInt(key.slice(5, 7));
    if (temps.length < 20) return; // 결측 너무 많은 월 제외
    const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
    const baseline = baselineMonthly.get(month) || 0;
    anomalies.push({ year, month, anomaly: avgTemp - baseline, avgTemp });
  });

  return anomalies.sort((a, b) => a.year - b.year || a.month - b.month);
}

/**
 * 10년 단위 통계 계산
 */
export function calcDecadeStats(records: DailyRecord[]): DecadeStats[] {
  const yearlyData = new Map<number, number[]>();

  records.forEach((r) => {
    const year = parseInt(r.date.slice(0, 4));
    if (!yearlyData.has(year)) yearlyData.set(year, []);
    yearlyData.get(year)!.push(r.avgTemp);
  });

  const decades: DecadeStats[] = [];
  const decadeStarts = [1960, 1970, 1980, 1990, 2000, 2010, 2020];

  decadeStarts.forEach((start) => {
    const end = start + 9;
    const temps: number[] = [];

    for (let y = start; y <= end; y++) {
      const yt = yearlyData.get(y);
      if (yt && yt.length >= 300) {
        temps.push(yt.reduce((a, b) => a + b, 0) / yt.length);
      }
    }

    if (temps.length > 0) {
      decades.push({
        decade: `${start}s`,
        startYear: start,
        endYear: end,
        avgTemp: temps.reduce((a, b) => a + b, 0) / temps.length,
        diffFromFirst: 0,
      });
    }
  });

  if (decades.length > 0) {
    const firstAvg = decades[0].avgTemp;
    decades.forEach((d) => {
      d.diffFromFirst = d.avgTemp - firstAvg;
    });
  }

  return decades;
}

/**
 * 도시 핵심 통계 계산
 */
export function calcCityStats(records: DailyRecord[]): CityStats {
  let allTimeHigh: ExtremeRecord = { value: -Infinity, date: '' };
  let allTimeLow: ExtremeRecord = { value: Infinity, date: '' };

  records.forEach((r) => {
    if (r.maxTemp > allTimeHigh.value) {
      allTimeHigh = { value: r.maxTemp, date: r.date };
    }
    if (r.minTemp < allTimeLow.value) {
      allTimeLow = { value: r.minTemp, date: r.date };
    }
  });

  // 최근 10년 vs 첫 10년
  const years = records.map((r) => parseInt(r.date.slice(0, 4)));
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);

  const firstDecade = records.filter((r) => {
    const y = parseInt(r.date.slice(0, 4));
    return y >= minYear && y < minYear + 10;
  });
  const recentDecade = records.filter((r) => {
    const y = parseInt(r.date.slice(0, 4));
    return y > maxYear - 10 && y <= maxYear;
  });

  const firstDecadeAvg =
    firstDecade.length > 0
      ? firstDecade.reduce((s, r) => s + r.avgTemp, 0) / firstDecade.length
      : 0;
  const recentDecadeAvg =
    recentDecade.length > 0
      ? recentDecade.reduce((s, r) => s + r.avgTemp, 0) / recentDecade.length
      : 0;

  // 열대야 (최저기온 25℃ 이상인 날) 연간 집계
  const tropicalNightsMap = new Map<number, number>();
  const heatwaveDaysMap = new Map<number, number>();

  records.forEach((r) => {
    const year = parseInt(r.date.slice(0, 4));
    if (r.minTemp >= 25) {
      tropicalNightsMap.set(year, (tropicalNightsMap.get(year) || 0) + 1);
    }
    if (r.maxTemp >= 33) {
      heatwaveDaysMap.set(year, (heatwaveDaysMap.get(year) || 0) + 1);
    }
  });

  const tropicalNights = Array.from(tropicalNightsMap.entries())
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year - b.year);

  const heatwaveDays = Array.from(heatwaveDaysMap.entries())
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year - b.year);

  return {
    allTimeHigh,
    allTimeLow,
    recentDecadeAvg,
    firstDecadeAvg,
    tempChange: recentDecadeAvg - firstDecadeAvg,
    tropicalNights,
    heatwaveDays,
  };
}

/**
 * 이동평균 계산 (양쪽 끝은 가용 데이터로 축소 윈도우 적용)
 */
export function movingAverage(data: { year: number; value: number }[], window: number): { year: number; value: number }[] {
  const result: { year: number; value: number }[] = [];
  const half = Math.floor(window / 2);

  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - half);
    const end = Math.min(data.length - 1, i + half);
    let sum = 0;
    for (let j = start; j <= end; j++) {
      sum += data[j].value;
    }
    result.push({ year: data[i].year, value: sum / (end - start + 1) });
  }

  return result;
}

/**
 * 연도별 일별 평균기온 그룹화 (스파게티 플롯용)
 */
export function groupByYear(records: DailyRecord[]): Map<number, { dayOfYear: number; avgTemp: number; date: string }[]> {
  const grouped = new Map<number, { dayOfYear: number; avgTemp: number; date: string }[]>();

  records.forEach((r) => {
    const year = parseInt(r.date.slice(0, 4));
    const date = new Date(r.date);
    const startOfYear = new Date(year, 0, 1);
    const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000)) + 1;

    if (!grouped.has(year)) grouped.set(year, []);
    grouped.get(year)!.push({ dayOfYear, avgTemp: r.avgTemp, date: r.date });
  });

  // 각 연도 내 정렬
  grouped.forEach((days) => days.sort((a, b) => a.dayOfYear - b.dayOfYear));

  return grouped;
}
