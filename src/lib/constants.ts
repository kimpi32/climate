import type { CityInfo } from '@/types/climate';

export const CITIES: CityInfo[] = [
  { id: 'seoul', name: '서울', nameEn: 'Seoul', stationId: 108, observationStart: 1907, lat: 37.57, lon: 126.98 },
  { id: 'busan', name: '부산', nameEn: 'Busan', stationId: 159, observationStart: 1904, lat: 35.18, lon: 129.08 },
  { id: 'daegu', name: '대구', nameEn: 'Daegu', stationId: 143, observationStart: 1907, lat: 35.87, lon: 128.60 },
  { id: 'daejeon', name: '대전', nameEn: 'Daejeon', stationId: 133, observationStart: 1969, lat: 36.35, lon: 127.38 },
  { id: 'incheon', name: '인천', nameEn: 'Incheon', stationId: 112, observationStart: 1904, lat: 37.46, lon: 126.70 },
  { id: 'gwangju', name: '광주', nameEn: 'Gwangju', stationId: 156, observationStart: 1939, lat: 35.16, lon: 126.85 },
  { id: 'ulsan', name: '울산', nameEn: 'Ulsan', stationId: 152, observationStart: 1932, lat: 35.54, lon: 129.31 },
  { id: 'jeju', name: '제주', nameEn: 'Jeju', stationId: 184, observationStart: 1923, lat: 33.51, lon: 126.53 },
  // 추가 도시
  { id: 'gangneung', name: '강릉', nameEn: 'Gangneung', stationId: 105, observationStart: 1912, lat: 37.75, lon: 128.90 },
  { id: 'cheonan', name: '천안', nameEn: 'Cheonan', stationId: 232, observationStart: 1973, lat: 36.76, lon: 127.12 },
  { id: 'cheongju', name: '청주', nameEn: 'Cheongju', stationId: 131, observationStart: 1967, lat: 36.64, lon: 127.44 },
  { id: 'donghae', name: '동해', nameEn: 'Donghae', stationId: 106, observationStart: 1992, lat: 37.51, lon: 129.12 },
  { id: 'jeonju', name: '전주', nameEn: 'Jeonju', stationId: 146, observationStart: 1918, lat: 35.82, lon: 127.15 },
  { id: 'pohang', name: '포항', nameEn: 'Pohang', stationId: 138, observationStart: 1942, lat: 36.03, lon: 129.38 },
  { id: 'miryang', name: '밀양', nameEn: 'Miryang', stationId: 288, observationStart: 1973, lat: 35.49, lon: 128.74 },
  { id: 'yeosu', name: '여수', nameEn: 'Yeosu', stationId: 168, observationStart: 1942, lat: 34.74, lon: 127.74 },
  { id: 'changwon', name: '창원', nameEn: 'Changwon', stationId: 155, observationStart: 1985, lat: 35.17, lon: 128.57 },
];

// 기준기간: 1973-2000
export const BASELINE_START = 1973;
export const BASELINE_END = 2000;

// 데이터 범위
export const DATA_START_YEAR = 1961;
export const DATA_END_YEAR = new Date().getFullYear();

// Warming Stripes 색상 팔레트 (파랑 → 흰 → 빨강)
export const WARMING_COLORS = [
  '#08306b', '#08519c', '#2171b5', '#4292c6', '#6baed6',
  '#9ecae1', '#c6dbef', '#deebf7', '#f7f7f7',
  '#fee0d2', '#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c',
  '#cb181d', '#a50f15', '#67000d',
];

// 히트맵 색상 (diverging)
export const HEATMAP_COLD = '#2166ac';
export const HEATMAP_NEUTRAL = '#f7f7f7';
export const HEATMAP_HOT = '#b2182b';

// 최근 2년 강조 색상
export const RECENT_YEAR_COLORS: Record<number, { color: string; width: number; label: string }> = {
  [new Date().getFullYear()]: { color: '#ef4444', width: 2.5, label: `${new Date().getFullYear()}년` },
  [new Date().getFullYear() - 1]: { color: '#facc15', width: 1.8, label: `${new Date().getFullYear() - 1}년` },
};

// 차트 색상
export const CHART_COLORS = {
  positive: '#ef4444',  // 양수 편차
  negative: '#3b82f6',  // 음수 편차
  baseline: '#9ca3af',  // 기준선
  trend: '#f59e0b',     // 추세선
  currentYear: '#ef4444',
  pastYears: 'rgba(156, 163, 175, 0.15)',
  movingAverage: '#f59e0b',
};

export const MONTHS = [
  '1월', '2월', '3월', '4월', '5월', '6월',
  '7월', '8월', '9월', '10월', '11월', '12월',
];

export const MONTHS_EN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// 분석 차트 색상
export const ANALYSIS_COLORS = {
  forecast: '#8b5cf6',       // 보라 — 예측선
  forecastBand: 'rgba(139, 92, 246, 0.15)', // 신뢰구간 밴드
  anomalyHot: '#ef4444',     // 이상 고온
  anomalyCold: '#3b82f6',    // 이상 저온
  sigmaLine: '#facc15',      // ±2σ 기준선
  decomTrend: '#f59e0b',     // 추세
  decomSeasonal: '#10b981',  // 계절성
  decomResidual: '#6366f1',  // 잔차
  decomObserved: '#94a3b8',  // 관측값
};
