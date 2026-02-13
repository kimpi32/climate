'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { DailyRecord } from '@/types/climate';
import { calcAnnualAnomalies } from '@/lib/climate-utils';
import { WARMING_COLORS } from '@/lib/constants';

interface WarmingStripesProps {
  records: DailyRecord[];
  cityName: string;
}

export default function WarmingStripes({ records, cityName }: WarmingStripesProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || records.length === 0) return;

    const anomalies = calcAnnualAnomalies(records);
    if (anomalies.length === 0) return;

    const containerWidth = containerRef.current.clientWidth;
    const margin = { top: 20, right: 20, bottom: 40, left: 20 };
    const width = containerWidth - margin.left - margin.right;
    const height = 160;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg
      .attr('width', containerWidth)
      .attr('height', height + margin.top + margin.bottom);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const maxAbsAnomaly = d3.max(anomalies, (d) => Math.abs(d.anomaly)) || 1;

    const colorScale = d3
      .scaleSequential()
      .domain([-maxAbsAnomaly, maxAbsAnomaly])
      .interpolator(d3.interpolateRgbBasis(WARMING_COLORS));

    const xScale = d3
      .scaleBand()
      .domain(anomalies.map((d) => String(d.year)))
      .range([0, width])
      .padding(0);

    // Draw stripes
    g.selectAll('rect')
      .data(anomalies)
      .join('rect')
      .attr('x', (d) => xScale(String(d.year))!)
      .attr('y', 0)
      .attr('width', xScale.bandwidth())
      .attr('height', height)
      .attr('fill', (d) => colorScale(d.anomaly));

    // Year labels
    const labelYears = anomalies
      .filter((d) => d.year % 10 === 0)
      .map((d) => d.year);

    g.selectAll('.year-label')
      .data(labelYears)
      .join('text')
      .attr('class', 'year-label')
      .attr('x', (d) => (xScale(String(d)) || 0) + xScale.bandwidth() / 2)
      .attr('y', height + 20)
      .attr('text-anchor', 'middle')
      .attr('fill', '#94a3b8')
      .attr('font-size', '11px')
      .text((d) => d);

    // Tooltip
    const tooltip = d3.select(containerRef.current)
      .selectAll('.d3-tooltip')
      .data([0])
      .join('div')
      .attr('class', 'd3-tooltip')
      .style('opacity', 0);

    g.selectAll('rect')
      .on('mouseover', function (event, d: unknown) {
        const data = d as { year: number; anomaly: number; avgTemp: number };
        tooltip
          .style('opacity', 1)
          .html(
            `<strong>${data.year}년</strong><br/>` +
            `평균기온: ${data.avgTemp.toFixed(1)}℃<br/>` +
            `편차: <span style="color:${data.anomaly >= 0 ? '#ef4444' : '#3b82f6'}">${data.anomaly >= 0 ? '+' : ''}${data.anomaly.toFixed(2)}℃</span>`
          );
      })
      .on('mousemove', function (event) {
        const containerRect = containerRef.current!.getBoundingClientRect();
        tooltip
          .style('left', (event.clientX - containerRect.left + 10) + 'px')
          .style('top', (event.clientY - containerRect.top - 40) + 'px');
      })
      .on('mouseout', function () {
        tooltip.style('opacity', 0);
      });
  }, [records, cityName]);

  return (
    <div className="chart-container" ref={containerRef} style={{ position: 'relative' }}>
      <h3 className="chart-title">뜨거워지는 {cityName}</h3>
      <p className="chart-subtitle">
        연평균 기온 변화 — 파란 해가 사라지고 있다
      </p>
      <svg ref={svgRef} />
      <div className="flex justify-between mt-3 text-xs text-[var(--muted)]">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ background: '#08519c' }} />
          <span>평균 이하</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ background: '#f7f7f7' }} />
          <span>평균</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ background: '#cb181d' }} />
          <span>평균 이상</span>
        </div>
      </div>
    </div>
  );
}
