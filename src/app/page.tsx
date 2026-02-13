'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import CitySelector from '@/components/CitySelector';
import WarmingStripes from '@/components/WarmingStripes';
import DailyTempChart from '@/components/DailyTempChart';
import AnnualAnomalyChart from '@/components/AnnualAnomalyChart';
import MonthlyHeatmap from '@/components/MonthlyHeatmap';
import DecadeSummary from '@/components/DecadeSummary';
import StatsPanel from '@/components/StatsPanel';
import { CITIES } from '@/lib/constants';
import type { CityData, DailyRecord } from '@/types/climate';

export default function Home() {
  const [selectedCity, setSelectedCity] = useState('seoul');
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const cityInfo = CITIES.find((c) => c.id === selectedCity)!;

  useEffect(() => {
    setLoading(true);
    fetch(`/data/${selectedCity}.json`)
      .then((res) => res.json())
      .then((data: CityData) => {
        setRecords(data.records);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load data:', err);
        setLoading(false);
      });
  }, [selectedCity]);

  return (
    <div className="min-h-screen">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* City Selector */}
        <section className="mb-8">
          <CitySelector selectedCity={selectedCity} onCityChange={setSelectedCity} />
        </section>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-[var(--muted)] text-lg">데이터 로딩 중...</div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Warming Stripes */}
            <section id="warming-stripes">
              <WarmingStripes records={records} cityName={cityInfo.name} />
            </section>

            {/* Stats Panel */}
            <section id="stats">
              <StatsPanel records={records} cityName={cityInfo.name} />
            </section>

            {/* Daily Temperature Spaghetti Plot */}
            <section id="daily-temp">
              <DailyTempChart records={records} cityName={cityInfo.name} />
            </section>

            {/* Annual Anomaly Chart */}
            <section id="annual-anomaly">
              <AnnualAnomalyChart records={records} cityName={cityInfo.name} />
            </section>

            {/* Monthly Heatmap */}
            <section id="monthly-heatmap">
              <MonthlyHeatmap records={records} cityName={cityInfo.name} />
            </section>

            {/* Decade Summary */}
            <section id="decade-summary">
              <DecadeSummary records={records} cityName={cityInfo.name} />
            </section>

            {/* Data Source */}
            <section className="chart-container text-sm text-[var(--muted)]">
              <h3 className="chart-title text-[var(--foreground)]">데이터 출처 및 안내</h3>
              <div className="mt-3 space-y-2">
                <p>
                  <strong>데이터 출처:</strong> 기상청 기상자료개방포털 (data.kma.go.kr) ASOS 종관기상관측 일자료
                </p>
                <p>
                  <strong>기준 기간:</strong> 1973-2000년 평균을 기준으로 편차를 계산합니다.
                </p>
                <p>
                  <strong>참고:</strong> 현재 표시되는 데이터는 데모 데이터입니다.
                  실제 데이터를 사용하려면 기상자료개방포털에서 ASOS 일자료 CSV를 다운로드한 후{' '}
                  <code className="bg-[var(--background)] px-1.5 py-0.5 rounded text-xs">
                    data/raw/
                  </code>{' '}
                  폴더에 넣고{' '}
                  <code className="bg-[var(--background)] px-1.5 py-0.5 rounded text-xs">
                    npx tsx scripts/process-csv.ts
                  </code>
                  를 실행하세요.
                </p>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--card-border)] mt-12 py-6 text-center text-sm text-[var(--muted)]">
        <p>한국 기후 위기 시각화 | Korea Climate Crisis Visualization</p>
        <p className="mt-1">데이터: 기상청 ASOS 종관기상관측</p>
      </footer>
    </div>
  );
}
