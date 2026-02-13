'use client';

import { useMemo } from 'react';
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
      <p className="chart-subtitle">{cityName}이 기록한 극한의 숫자들</p>

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
        />

        {/* 폭염 */}
        <StatCard
          label="폭염 일수 (최근 5년 평균)"
          value={`${avgRecentHeatwave.toFixed(1)}일`}
          sub={`초기 5년 평균: ${avgEarlyHeatwave.toFixed(1)}일`}
          color="text-rose-400"
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
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="bg-[var(--background)] rounded-lg p-4 border border-[var(--card-border)]">
      <p className="text-xs text-[var(--muted)] mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-[var(--muted)] mt-1">{sub}</p>
    </div>
  );
}
