/**
 * KMA CSV → JSON 변환 스크립트
 * 기상자료개방포털에서 다운로드한 ASOS CSV 또는 데모 CSV를 JSON으로 변환
 *
 * Usage: npx tsx scripts/process-csv.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface RawRecord {
  date: string;
  avgTemp: number;
  minTemp: number;
  maxTemp: number;
}

interface OutputData {
  cityId: string;
  cityName: string;
  stationId: number;
  records: RawRecord[];
}

const CITY_MAP: Record<string, { id: string; name: string }> = {
  '108': { id: 'seoul', name: '서울' },
  '159': { id: 'busan', name: '부산' },
  '143': { id: 'daegu', name: '대구' },
  '133': { id: 'daejeon', name: '대전' },
  '112': { id: 'incheon', name: '인천' },
  '156': { id: 'gwangju', name: '광주' },
  '152': { id: 'ulsan', name: '울산' },
  '184': { id: 'jeju', name: '제주' },
};

function parseCSV(content: string, stationId?: string): { records: RawRecord[]; detectedStation: string } {
  const lines = content.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length < 2) throw new Error('CSV file is empty or has no data rows');

  // Parse header to find column indices
  const header = lines[0];
  const headerCols = header.split(',').map((c) => c.trim());

  // KMA CSV columns: 지점, 지점명, 일시, 평균기온(℃), 최저기온(℃), 최고기온(℃)
  // 또는 영문: stnId, stnNm, tm, avgTa, minTa, maxTa
  let dateIdx = -1;
  let avgIdx = -1;
  let minIdx = -1;
  let maxIdx = -1;
  let stationIdx = -1;

  headerCols.forEach((col, i) => {
    const c = col.toLowerCase();
    if (c.includes('일시') || c === 'tm' || c.includes('date')) dateIdx = i;
    if (c.includes('평균기온') || c === 'avgta' || c.includes('avg')) avgIdx = i;
    if (c.includes('최저기온') || c === 'minta' || c.includes('min')) minIdx = i;
    if (c.includes('최고기온') || c === 'maxta' || c.includes('max')) maxIdx = i;
    if ((c === '지점' || c === '지점번호') || c === 'stnid' || c === 'station') stationIdx = i;
  });

  // Fallback to positional if headers not matched
  if (dateIdx === -1) dateIdx = 2;
  if (avgIdx === -1) avgIdx = 3;
  if (minIdx === -1) minIdx = 4;
  if (maxIdx === -1) maxIdx = 5;
  if (stationIdx === -1) stationIdx = 0;

  const records: RawRecord[] = [];
  let detectedStation = stationId || '';

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim());
    if (cols.length < Math.max(dateIdx, avgIdx, minIdx, maxIdx) + 1) continue;

    if (!detectedStation && stationIdx >= 0) {
      detectedStation = cols[stationIdx];
    }

    const date = cols[dateIdx];
    const avgTemp = parseFloat(cols[avgIdx]);
    const minTemp = parseFloat(cols[minIdx]);
    const maxTemp = parseFloat(cols[maxIdx]);

    // 결측치 제외
    if (isNaN(avgTemp) || isNaN(minTemp) || isNaN(maxTemp)) continue;
    if (!date || date.length < 8) continue;

    records.push({ date, avgTemp, minTemp, maxTemp });
  }

  return { records, detectedStation };
}

function processFile(filePath: string): void {
  console.log(`Processing: ${filePath}`);

  // Try UTF-8 first, then EUC-KR
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
    // Check if it looks garbled (common with EUC-KR files)
    if (content.includes('\ufffd')) {
      throw new Error('Garbled content, trying EUC-KR');
    }
  } catch {
    // For EUC-KR encoded files (actual KMA downloads)
    const buffer = fs.readFileSync(filePath);
    const decoder = new TextDecoder('euc-kr');
    content = decoder.decode(buffer);
  }

  const { records, detectedStation } = parseCSV(content);

  if (records.length === 0) {
    console.warn(`  ⚠ No valid records found in ${filePath}`);
    return;
  }

  // Sort by date
  records.sort((a, b) => a.date.localeCompare(b.date));

  // Determine city
  const cityInfo = CITY_MAP[detectedStation];
  const filename = path.basename(filePath, path.extname(filePath));
  const cityId = cityInfo?.id || filename.replace('_asos', '').toLowerCase();
  const cityName = cityInfo?.name || cityId;

  const output: OutputData = {
    cityId,
    cityName,
    stationId: parseInt(detectedStation) || 0,
    records,
  };

  const outputPath = path.join(__dirname, '..', 'public', 'data', `${cityId}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(output), 'utf-8');
  console.log(`  → ${outputPath} (${records.length} records, ${records[0].date} ~ ${records[records.length - 1].date})`);
}

// Main
const rawDir = path.join(__dirname, '..', 'data', 'raw');
const outputDir = path.join(__dirname, '..', 'public', 'data');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

if (!fs.existsSync(rawDir)) {
  console.error(`Raw data directory not found: ${rawDir}`);
  console.error('Run "npx tsx scripts/generate-demo-data.ts" first to generate demo data.');
  process.exit(1);
}

const csvFiles = fs.readdirSync(rawDir).filter((f) => f.endsWith('.csv'));

if (csvFiles.length === 0) {
  console.error('No CSV files found in data/raw/');
  console.error('Run "npx tsx scripts/generate-demo-data.ts" first to generate demo data.');
  process.exit(1);
}

csvFiles.forEach((file) => {
  processFile(path.join(rawDir, file));
});

console.log(`\nDone! Processed ${csvFiles.length} files.`);
