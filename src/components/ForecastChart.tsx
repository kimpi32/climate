'use client';

import { useEffect, useRef, useMemo, useState } from 'react';
import * as d3 from 'd3';
import type { DailyRecord } from '@/types/climate';
import { calcForecast, calcBaselineAnnualMean, calcExtremeDayProjections } from '@/lib/climate-utils';
import { CHART_COLORS, ANALYSIS_COLORS } from '@/lib/constants';

interface ForecastChartProps {
  records: DailyRecord[];
  cityName: string;
}

const HORIZONS = [10, 20, 30, 50];

// 편차 → 색상 (점진적 빨강)
function anomalyColor(anomaly: number): string {
  const t = Math.min(Math.max(anomaly / 3, 0), 1); // 0~3℃ 범위 정규화
  const r = Math.round(239 + (180 - 239) * (1 - t)); // 밝은 주황 → 진한 빨강
  const g = Math.round(160 * (1 - t));
  const b = Math.round(80 * (1 - t));
  return `rgb(${r}, ${g}, ${b})`;
}

function anomalyBorderColor(anomaly: number): string {
  const t = Math.min(Math.max(anomaly / 3, 0), 1);
  const r = Math.round(239 + (153 - 239) * t);
  const g = Math.round(120 * (1 - t));
  const b = Math.round(60 * (1 - t));
  return `rgba(${r}, ${g}, ${b}, 0.5)`;
}

export default function ForecastChart({ records, cityName }: ForecastChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const forecastData = useMemo(() => {
    if (records.length === 0) return null;
    const result = calcForecast(records, 10);
    if (result.historical.length === 0) return null;
    const baselineMean = calcBaselineAnnualMean(records);
    const lastYear = result.historical[result.historical.length - 1].year;
    const { slope, intercept } = result;

    const xs = result.historical.map((d) => d.year);
    const ys = result.historical.map((d) => d.anomaly);
    const n = xs.length;
    const xMean = xs.reduce((a, b) => a + b, 0) / n;
    const sxx = xs.reduce((s, x) => s + (x - xMean) ** 2, 0);
    const residuals = ys.map((y, i) => y - (slope * xs[i] + intercept));
    const se = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / (n - 2));

    // 미래 예측
    const predictions = HORIZONS.map((h) => {
      const targetYear = lastYear + h;
      const anomaly = slope * targetYear + intercept;
      const margin = 1.96 * se * Math.sqrt(1 + 1 / n + (targetYear - xMean) ** 2 / sxx);
      return {
        horizon: h,
        year: targetYear,
        temp: baselineMean + anomaly,
        lower: baselineMean + anomaly - margin,
        upper: baselineMean + anomaly + margin,
        anomaly,
      };
    });

    // 과거 실측 (10년 단위 평균)
    const DECADES = [
      { label: '1970년대', start: 1970, end: 1979 },
      { label: '1990년대', start: 1990, end: 1999 },
      { label: '2000년대', start: 2000, end: 2009 },
      { label: '2010년대', start: 2010, end: 2019 },
    ];

    const yearMap = new Map<number, { temps: number[]; tn: number; hw: number; sd: number }>();
    records.forEach((r) => {
      const y = parseInt(r.date.slice(0, 4));
      if (!yearMap.has(y)) yearMap.set(y, { temps: [], tn: 0, hw: 0, sd: 0 });
      const entry = yearMap.get(y)!;
      entry.temps.push(r.avgTemp);
      if (r.minTemp >= 25) entry.tn++;
      if (r.maxTemp >= 33) entry.hw++;
      if (r.maxTemp >= 25) entry.sd++;
    });

    const pastCards = DECADES.map((dec) => {
      const decadeYears: typeof yearMap extends Map<number, infer V> ? { year: number; data: V }[] : never = [];
      for (let y = dec.start; y <= dec.end; y++) {
        const d = yearMap.get(y);
        if (d && d.temps.length >= 300) decadeYears.push({ year: y, data: d });
      }
      if (decadeYears.length === 0) return null;

      const avgTemp = decadeYears.reduce((s, { data }) =>
        s + data.temps.reduce((a, b) => a + b, 0) / data.temps.length, 0) / decadeYears.length;
      const anomaly = avgTemp - baselineMean;
      return {
        label: dec.label,
        period: `${dec.start}-${dec.end}`,
        temp: avgTemp,
        anomaly,
        tropicalNights: Math.round(decadeYears.reduce((s, { data }) => s + data.tn, 0) / decadeYears.length),
        heatwaveDays: Math.round(decadeYears.reduce((s, { data }) => s + data.hw, 0) / decadeYears.length),
        summerDays: Math.round(decadeYears.reduce((s, { data }) => s + data.sd, 0) / decadeYears.length),
      };
    }).filter((v): v is NonNullable<typeof v> => v != null);

    // 최근 3년 (2023-2025) 실측
    const RECENT_YEARS = [2023, 2024, 2025];
    const recentYearEntries = RECENT_YEARS
      .map((y) => ({ year: y, data: yearMap.get(y) }))
      .filter((e): e is { year: number; data: NonNullable<typeof e.data> } => e.data != null && e.data.temps.length >= 300);

    const recentCard = recentYearEntries.length > 0 ? (() => {
      const avgTemp = recentYearEntries.reduce((s, { data }) =>
        s + data.temps.reduce((a, b) => a + b, 0) / data.temps.length, 0) / recentYearEntries.length;
      const anomaly = avgTemp - baselineMean;
      const yearRange = recentYearEntries.length === 1
        ? `${recentYearEntries[0].year}년`
        : `${recentYearEntries[0].year}-${recentYearEntries[recentYearEntries.length - 1].year}`;
      return {
        label: `최근 (${yearRange})`,
        temp: avgTemp,
        anomaly,
        tropicalNights: Math.round(recentYearEntries.reduce((s, { data }) => s + data.tn, 0) / recentYearEntries.length),
        heatwaveDays: Math.round(recentYearEntries.reduce((s, { data }) => s + data.hw, 0) / recentYearEntries.length),
        summerDays: Math.round(recentYearEntries.reduce((s, { data }) => s + data.sd, 0) / recentYearEntries.length),
      };
    })() : null;

    const { projections, recentAvg } = calcExtremeDayProjections(records, HORIZONS);

    // 첫 연대 기준 온도 (비교 기준점)
    const firstDecadeTemp = pastCards.length > 0 ? pastCards[0].temp : baselineMean;

    return { predictions, projections, recentAvg, pastCards, recentCard, firstDecadeTemp, baselineMean };
  }, [records]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || records.length === 0) return;

    const result = calcForecast(records, 10);
    if (result.historical.length === 0) return;

    const { historical, forecast, slope, intercept, rSquared, slopePerDecade } = result;
    const lastHistYear = historical[historical.length - 1].year;

    const containerWidth = containerRef.current.clientWidth;
    const margin = { top: 20, right: 30, bottom: 70, left: 55 };
    const width = containerWidth - margin.left - margin.right;
    const height = 320;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', containerWidth).attr('height', height + margin.top + margin.bottom);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const allYears = [
      ...historical.map((d) => d.year),
      ...forecast.map((d) => d.year),
    ];
    const xScale = d3.scaleBand()
      .domain(allYears.map(String))
      .range([0, width])
      .padding(0.15);

    const allValues = [
      ...historical.map((d) => d.anomaly),
      ...forecast.map((d) => d.upper),
      ...forecast.map((d) => d.lower),
    ];
    const yMin = Math.min(...allValues) * 1.15;
    const yMax = Math.max(...allValues) * 1.15;
    const yScale = d3.scaleLinear().domain([yMin, yMax]).range([height, 0]);

    const xTicks = allYears.filter((y) => y % 10 === 0 || y === lastHistYear + 1);
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(
        d3.axisBottom(xScale)
          .tickValues(xTicks.map(String))
          .tickFormat((d) => d as string)
      )
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '10px');

    g.append('g')
      .call(d3.axisLeft(yScale).ticks(6).tickFormat((d) => `${d as number > 0 ? '+' : ''}${(d as number).toFixed(1)}℃`))
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '10px');

    g.append('g')
      .selectAll('line')
      .data(yScale.ticks(6))
      .join('line')
      .attr('x1', 0).attr('x2', width)
      .attr('y1', (d) => yScale(d)).attr('y2', (d) => yScale(d))
      .attr('stroke', '#1e293b')
      .attr('stroke-dasharray', '2,2');

    g.append('line')
      .attr('x1', 0).attr('x2', width)
      .attr('y1', yScale(0)).attr('y2', yScale(0))
      .attr('stroke', '#475569').attr('stroke-width', 1);

    const futureX = xScale(String(lastHistYear + 1))!;
    g.append('rect')
      .attr('x', futureX - xScale.step() * xScale.padding() / 2)
      .attr('y', 0)
      .attr('width', width - futureX + xScale.step() * xScale.padding() / 2)
      .attr('height', height)
      .attr('fill', 'rgba(139, 92, 246, 0.05)');

    g.selectAll('.hist-bar')
      .data(historical)
      .join('rect')
      .attr('class', 'hist-bar')
      .attr('x', (d) => xScale(String(d.year))!)
      .attr('y', (d) => (d.anomaly >= 0 ? yScale(d.anomaly) : yScale(0)))
      .attr('width', xScale.bandwidth())
      .attr('height', (d) => Math.abs(yScale(0) - yScale(d.anomaly)))
      .attr('fill', (d) => (d.anomaly >= 0 ? CHART_COLORS.positive : CHART_COLORS.negative))
      .attr('opacity', 0.7);

    const bandData = forecast.map((d) => ({
      x: (xScale(String(d.year)) || 0) + xScale.bandwidth() / 2,
      lower: d.lower,
      upper: d.upper,
    }));

    const area = d3.area<typeof bandData[0]>()
      .x((d) => d.x)
      .y0((d) => yScale(d.lower))
      .y1((d) => yScale(d.upper))
      .curve(d3.curveLinear);

    g.append('path')
      .datum(bandData)
      .attr('fill', ANALYSIS_COLORS.forecastBand)
      .attr('stroke', 'none')
      .attr('d', area);

    const regLineData = allYears.map((y) => ({
      x: (xScale(String(y)) || 0) + xScale.bandwidth() / 2,
      y: slope * y + intercept,
    }));

    const regLine = d3.line<typeof regLineData[0]>()
      .x((d) => d.x)
      .y((d) => yScale(d.y))
      .curve(d3.curveLinear);

    g.append('path')
      .datum(regLineData)
      .attr('fill', 'none')
      .attr('stroke', ANALYSIS_COLORS.forecast)
      .attr('stroke-width', 2.5)
      .attr('stroke-dasharray', '8,4')
      .attr('d', regLine);

    g.selectAll('.forecast-dot')
      .data(forecast)
      .join('circle')
      .attr('cx', (d) => (xScale(String(d.year)) || 0) + xScale.bandwidth() / 2)
      .attr('cy', (d) => yScale(d.value))
      .attr('r', 4)
      .attr('fill', ANALYSIS_COLORS.forecast)
      .attr('stroke', '#0b1120')
      .attr('stroke-width', 2);

    g.append('line')
      .attr('x1', futureX - xScale.step() * xScale.padding() / 2)
      .attr('x2', futureX - xScale.step() * xScale.padding() / 2)
      .attr('y1', 0).attr('y2', height)
      .attr('stroke', '#475569')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,4');

    g.append('text')
      .attr('x', futureX + 4)
      .attr('y', 14)
      .attr('fill', ANALYSIS_COLORS.forecast)
      .attr('font-size', '11px')
      .text('예측 구간');

    const legend = g.append('g').attr('transform', `translate(10, 10)`);

    legend.append('rect').attr('x', 0).attr('y', 0).attr('width', 12).attr('height', 12)
      .attr('fill', CHART_COLORS.positive).attr('opacity', 0.7);
    legend.append('text').attr('x', 18).attr('y', 10).text('과거 편차')
      .attr('fill', '#e2e8f0').attr('font-size', '11px');

    legend.append('line').attr('x1', 0).attr('x2', 12).attr('y1', 26).attr('y2', 26)
      .attr('stroke', ANALYSIS_COLORS.forecast).attr('stroke-width', 2.5).attr('stroke-dasharray', '6,3');
    legend.append('text').attr('x', 18).attr('y', 30).text('회귀 추세선')
      .attr('fill', '#e2e8f0').attr('font-size', '11px');

    legend.append('rect').attr('x', 0).attr('y', 40).attr('width', 12).attr('height', 12)
      .attr('fill', ANALYSIS_COLORS.forecastBand).attr('stroke', ANALYSIS_COLORS.forecast).attr('stroke-width', 1);
    legend.append('text').attr('x', 18).attr('y', 50).text('95% 예측구간')
      .attr('fill', '#e2e8f0').attr('font-size', '11px');

    const lastForecast = forecast[forecast.length - 1];
    const summaryY = height + 40;

    g.append('text')
      .attr('x', 0).attr('y', summaryY)
      .attr('fill', '#e2e8f0').attr('font-size', '12px')
      .text(`10년당 ${slopePerDecade >= 0 ? '+' : ''}${slopePerDecade.toFixed(2)}℃`);

    g.append('text')
      .attr('x', width / 3).attr('y', summaryY)
      .attr('fill', '#94a3b8').attr('font-size', '12px')
      .text(`R² = ${rSquared.toFixed(3)}`);

    g.append('text')
      .attr('x', width * 2 / 3).attr('y', summaryY)
      .attr('fill', ANALYSIS_COLORS.forecast).attr('font-size', '12px')
      .text(`${lastForecast.year}년 예측: ${lastForecast.value >= 0 ? '+' : ''}${lastForecast.value.toFixed(2)}℃`);

    const tooltip = d3.select(containerRef.current)
      .selectAll('.d3-tooltip')
      .data([0])
      .join('div')
      .attr('class', 'd3-tooltip')
      .style('opacity', 0);

    g.selectAll('.hist-bar')
      .on('mouseover', function (event, d: unknown) {
        const data = d as typeof historical[0];
        d3.select(this).attr('opacity', 1);
        tooltip
          .style('opacity', 1)
          .html(
            `<strong>${data.year}년</strong><br/>` +
            `연평균: ${data.avgTemp.toFixed(1)}℃<br/>` +
            `편차: <span style="color:${data.anomaly >= 0 ? '#ef4444' : '#3b82f6'}">${data.anomaly >= 0 ? '+' : ''}${data.anomaly.toFixed(2)}℃</span>`
          );
      })
      .on('mousemove', function (event) {
        const containerRect = containerRef.current!.getBoundingClientRect();
        tooltip
          .style('left', (event.clientX - containerRect.left + 10) + 'px')
          .style('top', (event.clientY - containerRect.top - 50) + 'px');
      })
      .on('mouseout', function () {
        d3.select(this).attr('opacity', 0.7);
        tooltip.style('opacity', 0);
      });
  }, [records, cityName]);

  return (
    <div className="chart-container" ref={containerRef} style={{ position: 'relative' }}>
      <h3 className="chart-title">기온 예측: 향후 10년</h3>
      <p className="chart-subtitle">
        {cityName}의 선형회귀 기반 기온 편차 추세와 95% 예측구간
      </p>
      {/* 과거 → 미래 타임라인 카드 */}
      {forecastData && (
        <>
          {/* 과거 실측 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {forecastData.pastCards.map((p, i) => {
              const diff = p.temp - forecastData.firstDecadeTemp;
              const isFirst = i === 0;
              return (
                <div
                  key={p.label}
                  className="rounded-xl p-4 border border-[var(--card-border)] text-center"
                  style={{ background: 'rgba(255,255,255,0.03)' }}
                >
                  <p className="text-base font-semibold text-[var(--muted)] mb-3">
                    {p.label} <span className="opacity-60 text-sm">평균</span>
                  </p>
                  <p className="text-sm text-[var(--muted)]">연평균 기온</p>
                  <p className="text-3xl font-black text-[var(--foreground)]">
                    {p.temp.toFixed(1)}℃
                  </p>
                  {isFirst ? (
                    <p className="text-sm text-[var(--muted)] mt-1">기준</p>
                  ) : (
                    <p className="text-sm font-semibold mt-1" style={{ color: diff > 0 ? '#ef4444' : '#3b82f6' }}>
                      {forecastData.pastCards[0].label} 대비 {diff >= 0 ? '+' : ''}{diff.toFixed(2)}℃
                    </p>
                  )}
                  <div className="mt-3 pt-3 border-t border-[var(--card-border)] space-y-2 text-left">
                    <ExtremeRow label="열대야" value={p.tropicalNights} color="text-amber-400/70" tooltip="일 최저기온 25℃ 이상" />
                    <ExtremeRow label="폭염일" value={p.heatwaveDays} color="text-rose-400/70" tooltip="일 최고기온 33℃ 이상" />
                    <ExtremeRow label="여름일" value={p.summerDays} color="text-orange-400/70" tooltip="일 최고기온 25℃ 이상" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* 최근 실측 카드 */}
          {forecastData.recentCard && (() => {
            const rc = forecastData.recentCard;
            const diff = rc.temp - forecastData.firstDecadeTemp;
            const color = anomalyColor(rc.anomaly);
            const borderCol = anomalyBorderColor(rc.anomaly);
            return (
              <div className="flex justify-center mb-4">
                <div
                  className="rounded-xl p-5 border-2 text-center w-full max-w-xs"
                  style={{
                    borderColor: borderCol,
                    background: `linear-gradient(135deg, rgba(0,0,0,0.25), rgba(0,0,0,0.08))`,
                  }}
                >
                  <p className="text-lg font-bold text-[var(--foreground)] mb-3">
                    {rc.label}
                  </p>
                  <p className="text-sm text-[var(--muted)]">연평균 기온</p>
                  <p className="text-4xl font-black" style={{ color }}>
                    {rc.temp.toFixed(1)}℃
                  </p>
                  <p className="text-sm font-semibold mt-1" style={{ color }}>
                    {forecastData.pastCards[0]?.label ?? '기준'} 대비 {diff >= 0 ? '+' : ''}{diff.toFixed(2)}℃
                  </p>
                  <div className="mt-3 pt-3 border-t border-[var(--card-border)] space-y-2.5 text-left">
                    <ExtremeRow label="열대야" value={rc.tropicalNights} color="text-amber-400" tooltip="일 최저기온 25℃ 이상" />
                    <ExtremeRow label="폭염일" value={rc.heatwaveDays} color="text-rose-400" tooltip="일 최고기온 33℃ 이상" />
                    <ExtremeRow label="여름일" value={rc.summerDays} color="text-orange-400" tooltip="일 최고기온 25℃ 이상" />
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 구분선 */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-[var(--card-border)]" />
            <span className="text-sm font-semibold text-[var(--muted)]">미래 예측</span>
            <div className="flex-1 h-px bg-[var(--card-border)]" />
          </div>

          {/* 미래 예측 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {forecastData.predictions.map((p, i) => {
              const ext = forecastData.projections[i];
              const diff = p.temp - forecastData.firstDecadeTemp;
              const color = anomalyColor(p.anomaly);
              const borderCol = anomalyBorderColor(p.anomaly);
              return (
                <div
                  key={p.horizon}
                  className="rounded-xl p-4 border-2 text-center"
                  style={{
                    borderColor: borderCol,
                    background: `linear-gradient(135deg, rgba(0,0,0,0.3), rgba(0,0,0,0.1))`,
                  }}
                >
                  <p className="text-base font-semibold text-[var(--foreground)] mb-3">
                    {p.horizon}년 후 <span className="text-[var(--muted)]">({p.year})</span>
                  </p>
                  <p className="text-sm text-[var(--muted)]">예측 연평균</p>
                  <p className="text-4xl font-black" style={{ color }}>
                    {p.temp.toFixed(1)}℃
                  </p>
                  <p className="text-sm font-semibold mt-1" style={{ color }}>
                    {forecastData.pastCards[0]?.label ?? '기준'} 대비 {diff >= 0 ? '+' : ''}{diff.toFixed(2)}℃
                  </p>

                  {ext && (
                    <div className="mt-3 pt-3 border-t border-[var(--card-border)] space-y-2.5 text-left">
                      <ExtremeRow label="열대야" value={ext.tropicalNights} color="text-amber-400" tooltip="일 최저기온 25℃ 이상" />
                      <ExtremeRow label="폭염일" value={ext.heatwaveDays} color="text-rose-400" tooltip="일 최고기온 33℃ 이상" />
                      <ExtremeRow label="여름일" value={ext.summerDays} color="text-orange-400" tooltip="일 최고기온 25℃ 이상" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-xs text-[var(--muted)] mb-4 text-right">
            과거: 해당 연도 ±2년 실측 평균 / 미래: 선형회귀 예측 (95% 신뢰구간)
          </p>
        </>
      )}

      <svg ref={svgRef} />
    </div>
  );
}

function ExtremeRow({ label, value, color, tooltip }: {
  label: string;
  value: number;
  color: string;
  tooltip: string;
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="flex justify-between items-center">
      <span className="text-base text-[var(--muted)] flex items-center gap-1">
        {label}
        <span className="relative inline-block">
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            onMouseEnter={() => setShow(true)}
            onMouseLeave={() => setShow(false)}
            className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full border border-[var(--card-border)] text-[11px] font-medium text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors cursor-help"
          >
            ?
          </button>
          {show && (
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 text-xs rounded-md bg-[var(--foreground)] text-[var(--background)] whitespace-nowrap z-10 shadow-lg">
              {tooltip}
            </span>
          )}
        </span>
      </span>
      <span className={`text-lg font-bold ${color}`}>{value}일</span>
    </div>
  );
}
