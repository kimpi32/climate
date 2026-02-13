/**
 * 한국 주요 도시의 리얼리스틱한 데모 기온 데이터 생성
 * 실제 기후 패턴 반영: 계절 변화 + 장기적 온난화 트렌드
 */

import * as fs from 'fs';
import * as path from 'path';

interface CityConfig {
  id: string;
  name: string;
  stationId: number;
  // 기준 연평균기온 (1970년대 기준, ℃)
  baseAvgTemp: number;
  // 여름/겨울 기온 진폭 (℃)
  amplitude: number;
  // 연간 온난화율 (℃/decade)
  warmingRate: number;
}

const cities: CityConfig[] = [
  { id: 'seoul', name: '서울', stationId: 108, baseAvgTemp: 11.8, amplitude: 16.0, warmingRate: 0.30 },
  { id: 'busan', name: '부산', stationId: 159, baseAvgTemp: 14.5, amplitude: 12.0, warmingRate: 0.22 },
  { id: 'daegu', name: '대구', stationId: 143, baseAvgTemp: 13.8, amplitude: 15.0, warmingRate: 0.28 },
  { id: 'daejeon', name: '대전', stationId: 133, baseAvgTemp: 12.5, amplitude: 15.5, warmingRate: 0.27 },
  { id: 'incheon', name: '인천', stationId: 112, baseAvgTemp: 11.5, amplitude: 14.5, warmingRate: 0.26 },
  { id: 'gwangju', name: '광주', stationId: 156, baseAvgTemp: 13.2, amplitude: 14.0, warmingRate: 0.25 },
  { id: 'ulsan', name: '울산', stationId: 152, baseAvgTemp: 13.5, amplitude: 13.0, warmingRate: 0.24 },
  { id: 'jeju', name: '제주', stationId: 184, baseAvgTemp: 15.5, amplitude: 10.5, warmingRate: 0.20 },
];

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// Seeded random number generator for reproducibility
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// Box-Muller transform for normal distribution
function normalRandom(rng: () => number, mean: number, std: number): number {
  const u1 = rng();
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1 + 0.0001)) * Math.cos(2 * Math.PI * u2);
  return mean + std * z;
}

function generateCityData(city: CityConfig, startYear: number, endYear: number): string {
  const rng = seededRandom(city.stationId * 1000 + startYear);
  const lines: string[] = [];

  // CSV header mimicking KMA format
  lines.push('지점,지점명,일시,평균기온(℃),최저기온(℃),최고기온(℃)');

  for (let year = startYear; year <= endYear; year++) {
    // 온난화 트렌드: 1970년대 기준으로 10년당 warmingRate℃ 상승
    const decadesFrom1975 = (year - 1975) / 10;
    const warmingOffset = decadesFrom1975 * city.warmingRate;

    // 연간 변동 (±0.3℃)
    const yearVariation = normalRandom(rng, 0, 0.3);

    for (let month = 1; month <= 12; month++) {
      const days = daysInMonth(year, month);

      for (let day = 1; day <= days; day++) {
        // 날짜 문자열
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        // Day of year (0-365)
        const dayOfYear = getDayOfYear(year, month, day);
        const totalDays = isLeapYear(year) ? 366 : 365;

        // 계절 변화: 코사인 함수 (1월 중순 최저, 8월 초 최고)
        // -cos 사용: phase=0일 때 최저(1월), phase=π일 때 최고(7~8월)
        // day 25 (1월 25일) 최저 → day 25+183=208 (7월 27일) 최고
        const seasonalPhase = ((dayOfYear - 25) / totalDays) * 2 * Math.PI;
        const seasonalTemp = -Math.cos(seasonalPhase) * city.amplitude;

        // 일별 변동 (여름에 작고, 겨울에 큼)
        const dailyStd = 2.0 + 1.5 * Math.cos(seasonalPhase);
        const dailyVariation = normalRandom(rng, 0, dailyStd);

        // 평균기온 계산
        const avgTemp = city.baseAvgTemp + seasonalTemp + warmingOffset + yearVariation + dailyVariation;

        // 일교차 (겨울에 크고, 여름에 작으며, 여름 습한 날은 일교차 작음)
        const diurnalRange = 5.0 + 3.0 * Math.cos(seasonalPhase) + normalRandom(rng, 0, 1.5);
        const maxTemp = avgTemp + diurnalRange / 2 + Math.abs(normalRandom(rng, 0, 0.8));
        const minTemp = avgTemp - diurnalRange / 2 - Math.abs(normalRandom(rng, 0, 0.8));

        lines.push(
          `${city.stationId},${city.name},${dateStr},${avgTemp.toFixed(1)},${minTemp.toFixed(1)},${maxTemp.toFixed(1)}`
        );
      }
    }
  }

  return lines.join('\n');
}

function getDayOfYear(year: number, month: number, day: number): number {
  const date = new Date(year, month - 1, day);
  const startOfYear = new Date(year, 0, 1);
  return Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000)) + 1;
}

// Main execution
const outputDir = path.join(__dirname, '..', 'data', 'raw');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const START_YEAR = 1961;
const END_YEAR = 2024;

cities.forEach((city) => {
  console.log(`Generating data for ${city.name} (${city.id})...`);
  const csv = generateCityData(city, START_YEAR, END_YEAR);
  const filePath = path.join(outputDir, `${city.id}_asos.csv`);
  fs.writeFileSync(filePath, csv, 'utf-8');
  console.log(`  → ${filePath}`);
});

console.log('\nDone! Demo CSV files generated.');
