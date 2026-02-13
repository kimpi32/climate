'use client';

import { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import type { DailyRecord } from '@/types/climate';
import { calcMonthlyAnomalies, calcBaselineMonthlyMeans } from '@/lib/climate-utils';
import { HEATMAP_COLD, HEATMAP_NEUTRAL, HEATMAP_HOT, MONTHS_EN, MONTHS } from '@/lib/constants';

interface MonthlyHeatmapProps {
  records: DailyRecord[];
  cityName: string;
}

export default function MonthlyHeatmap({ records, cityName }: MonthlyHeatmapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 30년 기후평년값 (1991-2020) 월별 평균기온
  const climateNormalMonthly = useMemo(() => {
    if (records.length === 0) return null;
    const means = calcBaselineMonthlyMeans(records, 1991, 2020);
    return Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      temp: means.get(i + 1) ?? 0,
    }));
  }, [records]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || records.length === 0) return;

    const monthlyAnomalies = calcMonthlyAnomalies(records);
    if (monthlyAnomalies.length === 0) return;

    const years = Array.from(new Set(monthlyAnomalies.map((d) => d.year))).sort((a, b) => a - b);

    const containerWidth = containerRef.current.clientWidth;
    const margin = { top: 20, right: 60, bottom: 40, left: 55 };
    const width = containerWidth - margin.left - margin.right;
    const height = Math.max(years.length * 8, 300);

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg
      .attr('width', containerWidth)
      .attr('height', height + margin.top + margin.bottom);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleBand()
      .domain(d3.range(1, 13).map(String))
      .range([0, width])
      .padding(0.05);

    const yScale = d3.scaleBand()
      .domain(years.map(String))
      .range([0, height])
      .padding(0.05);

    const maxAbsAnomaly = d3.max(monthlyAnomalies, (d) => Math.abs(d.anomaly)) || 1;
    const colorScale = d3.scaleLinear<string>()
      .domain([-maxAbsAnomaly, 0, maxAbsAnomaly])
      .range([HEATMAP_COLD, HEATMAP_NEUTRAL, HEATMAP_HOT]);

    // X axis (months)
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(
        d3.axisBottom(xScale).tickFormat((d) => MONTHS_EN[parseInt(d as string) - 1])
      )
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '10px');

    // Y axis (years) - show every 5th year
    const yTicks = years.filter((y) => y % 5 === 0);
    g.append('g')
      .call(
        d3.axisLeft(yScale)
          .tickValues(yTicks.map(String))
          .tickFormat((d) => d as string)
      )
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '10px');

    // Cells
    g.selectAll('.cell')
      .data(monthlyAnomalies)
      .join('rect')
      .attr('class', 'cell')
      .attr('x', (d) => xScale(String(d.month))!)
      .attr('y', (d) => yScale(String(d.year))!)
      .attr('width', xScale.bandwidth())
      .attr('height', yScale.bandwidth())
      .attr('fill', (d) => colorScale(d.anomaly))
      .attr('rx', 1);

    // Color legend
    const legendWidth = 15;
    const legendHeight = Math.min(height, 200);
    const legendX = width + 15;
    const legendY = (height - legendHeight) / 2;

    const legendScale = d3.scaleLinear()
      .domain([-maxAbsAnomaly, maxAbsAnomaly])
      .range([legendHeight, 0]);

    const legendAxis = d3.axisRight(legendScale)
      .ticks(5)
      .tickFormat((d) => `${d as number > 0 ? '+' : ''}${(d as number).toFixed(1)}℃`);

    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', 'heatmap-gradient')
      .attr('x1', '0%').attr('x2', '0%')
      .attr('y1', '100%').attr('y2', '0%');

    gradient.append('stop').attr('offset', '0%').attr('stop-color', HEATMAP_COLD);
    gradient.append('stop').attr('offset', '50%').attr('stop-color', HEATMAP_NEUTRAL);
    gradient.append('stop').attr('offset', '100%').attr('stop-color', HEATMAP_HOT);

    const legendG = g.append('g').attr('transform', `translate(${legendX},${legendY})`);

    legendG.append('rect')
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .attr('fill', 'url(#heatmap-gradient)')
      .attr('rx', 2);

    legendG.append('g')
      .attr('transform', `translate(${legendWidth},0)`)
      .call(legendAxis)
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '9px');

    // Tooltip
    const tooltip = d3.select(containerRef.current)
      .selectAll('.d3-tooltip')
      .data([0])
      .join('div')
      .attr('class', 'd3-tooltip')
      .style('opacity', 0);

    g.selectAll('.cell')
      .on('mouseover', function (event, d: unknown) {
        const data = d as { year: number; month: number; anomaly: number; avgTemp: number };
        d3.select(this).attr('stroke', '#e2e8f0').attr('stroke-width', 2);
        tooltip
          .style('opacity', 1)
          .html(
            `<strong>${data.year}년 ${data.month}월</strong><br/>` +
            `평균: ${data.avgTemp.toFixed(1)}℃<br/>` +
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
        d3.select(this).attr('stroke', 'none');
        tooltip.style('opacity', 0);
      });
  }, [records, cityName]);

  return (
    <div className="chart-container" ref={containerRef} style={{ position: 'relative' }}>
      <h3 className="chart-title">몇 월이 가장 빨리 뜨거워졌나?</h3>
      <p className="chart-subtitle">
        {cityName} 월별 기온편차 — 붉을수록 평년보다 뜨겁다
      </p>
      {climateNormalMonthly && (
        <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-[var(--muted)] mb-3 px-1">
          <span className="font-medium text-[var(--foreground)]">기후평년값(1991-2020):</span>
          {climateNormalMonthly.map((m) => (
            <span key={m.month}>
              {MONTHS[m.month - 1]} <span className={m.temp >= 20 ? 'text-red-400' : m.temp <= 0 ? 'text-blue-400' : 'text-[var(--foreground)]'}>{m.temp.toFixed(1)}℃</span>
            </span>
          ))}
        </div>
      )}
      <svg ref={svgRef} />
    </div>
  );
}
