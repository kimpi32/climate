'use client';

import { useMemo, useState } from 'react';
import type { DailyRecord } from '@/types/climate';
import { calcCityStats } from '@/lib/climate-utils';

interface StatsPanelProps {
  records: DailyRecord[];
  cityName: string;
}

export default function StatsPanel({ records, cityName }: StatsPanelProps) {
  const stats = useMemo(() => {
    if (records.length === 0) return null;
    return calcCityStats(records);
  }, [records]);

  if (!stats) return null;

  // 최근 5년 열대야/폭염 평균
  const recentTropical = stats.tropicalNights.slice(-5);
  const recentHeatwave = stats.heatwaveDays.slice(-5);
  const avgRecentTropical = recentTropical.length > 0
    ? recentTropical.reduce((s, d) => s + d.count, 0) / recentTropical.length
    : 0;
  const avgRecentHeatwave = recentHeatwave.length > 0
    ? recentHeatwave.reduce((s, d) => s + d.count, 0) / recentHeatwave.length
    : 0;

  // 초기 5년 열대야/폭염 평균
  const earlyTropical = stats.tropicalNights.slice(0, 5);
  const earlyHeatwave = stats.heatwaveDays.slice(0, 5);
  const avgEarlyTropical = earlyTropical.length > 0
    ? earlyTropical.reduce((s, d) => s + d.count, 0) / earlyTropical.length
    : 0;
  const avgEarlyHeatwave = earlyHeatwave.length > 0
    ? earlyHeatwave.reduce((s, d) => s + d.count, 0) / earlyHeatwave.length
    : 0;

  return (
    <div className="chart-container">
      <h3 className="chart-title">숫자로 보는 위기</h3>
      <p className="chart-subtitle">{cityName}에서 기록된 극한의 숫자들</p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
        {/* 역대 최고기온 */}
        <StatCard
          label="역대 최고기온"
          value={`${stats.allTimeHigh.value.toFixed(1)}℃`}
          sub={stats.allTimeHigh.date}
          color="text-red-400"
        />

        {/* 역대 최저기온 */}
        <StatCard
          label="역대 최저기온"
          value={`${stats.allTimeLow.value.toFixed(1)}℃`}
          sub={stats.allTimeLow.date}
          color="text-blue-400"
        />

        {/* 기온 변화 */}
        <StatCard
          label="기온 변화"
          value={`${stats.tempChange >= 0 ? '+' : ''}${stats.tempChange.toFixed(2)}℃`}
          sub={`최근 10년 vs 첫 10년`}
          color={stats.tempChange >= 0 ? 'text-red-400' : 'text-blue-400'}
        />

        {/* 최근 10년 평균 */}
        <StatCard
          label="최근 10년 평균"
          value={`${stats.recentDecadeAvg.toFixed(1)}℃`}
          sub={`첫 10년: ${stats.firstDecadeAvg.toFixed(1)}℃`}
          color="text-orange-400"
        />

        {/* 열대야 */}
        <StatCard
          label="열대야 일수 (최근 5년 평균)"
          value={`${avgRecentTropical.toFixed(1)}일`}
          sub={`초기 5년 평균: ${avgEarlyTropical.toFixed(1)}일`}
          color="text-amber-400"
          tooltip="밤 최저기온이 25℃ 이상인 날"
        />

        {/* 폭염 */}
        <StatCard
          label="폭염 일수 (최근 5년 평균)"
          value={`${avgRecentHeatwave.toFixed(1)}일`}
          sub={`초기 5년 평균: ${avgEarlyHeatwave.toFixed(1)}일`}
          color="text-rose-400"
          tooltip="낮 최고기온이 33℃ 이상인 날"
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  color,
  tooltip,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
  tooltip?: string;
}) {
  const [showTip, setShowTip] = useState(false);

  return (
    <div className="bg-[var(--background)] rounded-lg p-4 border border-[var(--card-border)]">
      <p className="text-base text-[var(--muted)] mb-1.5">
        {label}
        {tooltip && (
          <span className="relative inline-block ml-1">
            <button
              type="button"
              onClick={() => setShowTip((v) => !v)}
              onMouseEnter={() => setShowTip(true)}
              onMouseLeave={() => setShowTip(false)}
              className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full border border-[var(--card-border)] text-[11px] font-medium text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors cursor-help align-middle"
            >
              ?
            </button>
            {showTip && (
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 text-xs rounded-md bg-[var(--foreground)] text-[var(--background)] whitespace-nowrap z-10 shadow-lg">
                {tooltip}
              </span>
            )}
          </span>
        )}
      </p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="text-base text-[var(--muted)] mt-1.5">{sub}</p>
    </div>
  );
}
