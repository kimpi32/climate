/**
 * 공공데이터포털 API로 기상청 ASOS 일자료 자동 수집
 *
 * Usage: npx tsx scripts/fetch-kma-data.ts
 *
 * .env.local에 KMA_API_KEY 필요 (Encoding 키)
 */

import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

// dotenv/config는 .env만 읽으므로 .env.local도 수동 로드
import { config } from 'dotenv';
config({ path: path.join(__dirname, '..', '.env.local'), override: true });

const API_KEY = process.env.KMA_API_KEY;
if (!API_KEY) {
  console.error('ERROR: KMA_API_KEY not found in .env.local');
  process.exit(1);
}

const BASE_URL = 'http://apis.data.go.kr/1360000/AsosDalyInfoService/getWthrDataList';

interface CityConfig {
  id: string;
  name: string;
  stationId: number;
  startYear: number;
}

const CITIES: CityConfig[] = [
  { id: 'seoul', name: '서울', stationId: 108, startYear: 1961 },
  { id: 'busan', name: '부산', stationId: 159, startYear: 1961 },
  { id: 'daegu', name: '대구', stationId: 143, startYear: 1961 },
  { id: 'daejeon', name: '대전', stationId: 133, startYear: 1969 },
  { id: 'incheon', name: '인천', stationId: 112, startYear: 1961 },
  { id: 'gwangju', name: '광주', stationId: 156, startYear: 1961 },
  { id: 'ulsan', name: '울산', stationId: 152, startYear: 1961 },
  { id: 'jeju', name: '제주', stationId: 184, startYear: 1961 },
  // 추가 도시 (한반도 hex map 확장)
  { id: 'gangneung', name: '강릉', stationId: 105, startYear: 1961 },
  { id: 'cheonan', name: '천안', stationId: 232, startYear: 1961 },
  { id: 'cheongju', name: '청주', stationId: 131, startYear: 1967 },
  { id: 'donghae', name: '동해', stationId: 106, startYear: 1961 },
  { id: 'jeonju', name: '전주', stationId: 146, startYear: 1961 },
  { id: 'pohang', name: '포항', stationId: 138, startYear: 1961 },
  { id: 'miryang', name: '밀양', stationId: 288, startYear: 1961 },
  { id: 'yeosu', name: '여수', stationId: 168, startYear: 1961 },
  { id: 'changwon', name: '창원', stationId: 155, startYear: 1961 },
];

const END_YEAR = new Date().getFullYear();
const NUM_OF_ROWS = 999; // 한 번에 최대 999일 (≈2.7년)
const DELAY_MS = 300; // API 호출 간 딜레이 (ms)

// API는 전날 자료까지만 제공 → endDt 상한을 어제로 제한
const yesterday = new Date(Date.now() - 86400000);
const MAX_END_DT = `${yesterday.getFullYear()}${String(yesterday.getMonth() + 1).padStart(2, '0')}${String(yesterday.getDate()).padStart(2, '0')}`;

interface ApiRecord {
  tm: string;        // "2024-01-01"
  avgTa: string;     // "1.2"
  minTa: string;     // "-2.3"
  maxTa: string;     // "4.5"
  stnId: string;
  stnNm: string;
}

interface OutputRecord {
  date: string;
  avgTemp: number;
  minTemp: number;
  maxTemp: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(
  stationId: number,
  startDt: string,
  endDt: string,
  pageNo: number
): Promise<{ items: ApiRecord[]; totalCount: number }> {
  const params = new URLSearchParams({
    ServiceKey: API_KEY!,
    numOfRows: String(NUM_OF_ROWS),
    pageNo: String(pageNo),
    dataType: 'JSON',
    dataCd: 'ASOS',
    dateCd: 'DAY',
    startDt,
    endDt,
    stnIds: String(stationId),
  });

  // ServiceKey는 이미 URL-encoded 상태이므로 직접 URL 구성
  const url = `${BASE_URL}?${params.toString().replace(
    /ServiceKey=[^&]+/,
    `ServiceKey=${API_KEY}`
  )}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  const data = await res.json();

  const header = data?.response?.header;
  if (header?.resultCode !== '00') {
    throw new Error(`API Error: ${header?.resultCode} - ${header?.resultMsg}`);
  }

  const body = data?.response?.body;
  const totalCount = body?.totalCount || 0;
  const items = body?.items?.item || [];

  // 단일 항목인 경우 배열로 변환
  return {
    items: Array.isArray(items) ? items : [items],
    totalCount,
  };
}

async function fetchCityData(city: CityConfig): Promise<OutputRecord[]> {
  const allRecords: OutputRecord[] = [];
  let apiCalls = 0;

  // 3년 단위로 분할 (numOfRows=999 ≈ 2.7년이므로 페이징 최소화)
  const CHUNK_YEARS = 3;

  for (let year = city.startYear; year <= END_YEAR; year += CHUNK_YEARS) {
    const startDt = `${year}0101`;
    const endYear = Math.min(year + CHUNK_YEARS - 1, END_YEAR);
    const rawEndDt = `${endYear}1231`;
    const endDt = rawEndDt > MAX_END_DT ? MAX_END_DT : rawEndDt;

    let pageNo = 1;
    let fetched = 0;
    let totalCount = Infinity;

    while (fetched < totalCount) {
      try {
        const result = await fetchPage(city.stationId, startDt, endDt, pageNo);
        totalCount = result.totalCount;

        for (const item of result.items) {
          const avgTemp = parseFloat(item.avgTa);
          const minTemp = parseFloat(item.minTa);
          const maxTemp = parseFloat(item.maxTa);

          if (isNaN(avgTemp) || isNaN(minTemp) || isNaN(maxTemp)) continue;

          allRecords.push({
            date: item.tm,
            avgTemp,
            minTemp,
            maxTemp,
          });
        }

        fetched += result.items.length;
        apiCalls++;

        if (fetched < totalCount) {
          pageNo++;
        } else {
          break;
        }

        await sleep(DELAY_MS);
      } catch (err) {
        console.error(`    Error at ${startDt}-${endDt} page ${pageNo}:`, err);
        // 에러 시 다음 청크로
        break;
      }
    }

    // 진행률 표시
    const progress = Math.min(100, Math.round(((endYear - city.startYear + 1) / (END_YEAR - city.startYear + 1)) * 100));
    process.stdout.write(`\r  ${city.name} (${city.id}): ${progress}% - ${allRecords.length}건 (API ${apiCalls}콜)`);
  }

  console.log(); // 줄바꿈
  return allRecords.sort((a, b) => a.date.localeCompare(b.date));
}

async function main() {
  console.log('=== 기상청 ASOS 일자료 자동 수집 시작 ===');
  console.log(`대상 기간: 각 도시 관측 시작 ~ ${END_YEAR}년`);
  console.log(`도시: ${CITIES.map((c) => c.name).join(', ')}`);
  console.log('');

  const outputDir = path.join(__dirname, '..', 'public', 'data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let totalCalls = 0;

  // --only-new 플래그: 파일이 없는 도시만 수집
  const onlyNew = process.argv.includes('--only-new');

  for (const city of CITIES) {
    const filePath = path.join(outputDir, `${city.id}.json`);
    if (onlyNew && fs.existsSync(filePath)) {
      console.log(`[${city.name}] 이미 존재, 건너뜀 (${filePath})`);
      continue;
    }

    console.log(`[${city.name}] 수집 시작 (지점: ${city.stationId}, ${city.startYear}~${END_YEAR})...`);

    const records = await fetchCityData(city);

    if (records.length === 0) {
      console.warn(`  ⚠ ${city.name}: 데이터 없음, 건너뜀`);
      continue;
    }

    const output = {
      cityId: city.id,
      cityName: city.name,
      stationId: city.stationId,
      records,
    };

    fs.writeFileSync(filePath, JSON.stringify(output), 'utf-8');
    console.log(`  → ${filePath} (${records.length}건, ${records[0].date} ~ ${records[records.length - 1].date})`);

    const cityCalls = Math.ceil((END_YEAR - city.startYear + 1) / 3) + 5; // 대략적 추정
    totalCalls += cityCalls;

    // 도시 간 딜레이
    await sleep(1000);
  }

  console.log('\n=== 수집 완료 ===');
  console.log('다음 단계: npm run dev 로 확인');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
