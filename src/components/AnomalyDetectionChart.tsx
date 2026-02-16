'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { DailyRecord } from '@/types/climate';
import { detectAnomalies } from '@/lib/climate-utils';
import { CHART_COLORS, ANALYSIS_COLORS } from '@/lib/constants';

interface AnomalyDetectionChartProps {
  records: DailyRecord[];
  cityName: string;
}

export default function AnomalyDetectionChart({ records, cityName }: AnomalyDetectionChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || records.length === 0) return;

    const result = detectAnomalies(records, 2.0);
    if (result.flags.length === 0) return;

    const { flags, std } = result;
    const anomalyCount = flags.filter((f) => f.isAnomaly).length;

    const containerWidth = containerRef.current.clientWidth;
    const margin = { top: 20, right: 30, bottom: 60, left: 55 };
    const width = containerWidth - margin.left - margin.right;
    const height = 300;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', containerWidth).attr('height', height + margin.top + margin.bottom);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleBand()
      .domain(flags.map((d) => String(d.year)))
      .range([0, width])
      .padding(0.15);

    const maxAbs = d3.max(flags, (d) => Math.abs(d.anomaly)) || 1;
    const yMax = Math.max(maxAbs * 1.15, std * 2.5);
    const yScale = d3.scaleLinear().domain([-yMax, yMax]).range([height, 0]);

    // X axis
    const xTicks = flags.filter((d) => d.year % 10 === 0);
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(
        d3.axisBottom(xScale)
          .tickValues(xTicks.map((d) => String(d.year)))
          .tickFormat((d) => d as string)
      )
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '10px');

    // Y axis
    g.append('g')
      .call(d3.axisLeft(yScale).ticks(6).tickFormat((d) => `${d as number > 0 ? '+' : ''}${(d as number).toFixed(1)}℃`))
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '10px');

    // Grid
    g.append('g')
      .selectAll('line')
      .data(yScale.ticks(6))
      .join('line')
      .attr('x1', 0).attr('x2', width)
      .attr('y1', (d) => yScale(d)).attr('y2', (d) => yScale(d))
      .attr('stroke', '#1e293b')
      .attr('stroke-dasharray', '2,2');

    // Zero line
    g.append('line')
      .attr('x1', 0).attr('x2', width)
      .attr('y1', yScale(0)).attr('y2', yScale(0))
      .attr('stroke', '#475569').attr('stroke-width', 1);

    // ±2σ lines
    [2, -2].forEach((mult) => {
      const yVal = std * mult;
      g.append('line')
        .attr('x1', 0).attr('x2', width)
        .attr('y1', yScale(yVal)).attr('y2', yScale(yVal))
        .attr('stroke', ANALYSIS_COLORS.sigmaLine)
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '6,4');

      g.append('text')
        .attr('x', width - 4)
        .attr('y', yScale(yVal) - 5)
        .attr('text-anchor', 'end')
        .attr('fill', ANALYSIS_COLORS.sigmaLine)
        .attr('font-size', '10px')
        .text(`${mult > 0 ? '+' : ''}${mult}σ`);
    });

    // Bars
    g.selectAll('.bar')
      .data(flags)
      .join('rect')
      .attr('class', 'bar')
      .attr('x', (d) => xScale(String(d.year))!)
      .attr('y', (d) => (d.anomaly >= 0 ? yScale(d.anomaly) : yScale(0)))
      .attr('width', xScale.bandwidth())
      .attr('height', (d) => Math.abs(yScale(0) - yScale(d.anomaly)))
      .attr('fill', (d) => (d.anomaly >= 0 ? CHART_COLORS.positive : CHART_COLORS.negative))
      .attr('opacity', (d) => (d.isAnomaly ? 1.0 : 0.35))
      .attr('stroke', (d) => (d.isAnomaly ? (d.anomaly >= 0 ? ANALYSIS_COLORS.anomalyHot : ANALYSIS_COLORS.anomalyCold) : 'none'))
      .attr('stroke-width', (d) => (d.isAnomaly ? 2 : 0));

    // Legend
    const legend = g.append('g').attr('transform', `translate(10, 10)`);

    legend.append('rect').attr('x', 0).attr('y', 0).attr('width', 12).attr('height', 12)
      .attr('fill', CHART_COLORS.positive).attr('opacity', 1.0).attr('stroke', ANALYSIS_COLORS.anomalyHot).attr('stroke-width', 2);
    legend.append('text').attr('x', 18).attr('y', 10).text('이상 고온')
      .attr('fill', '#e2e8f0').attr('font-size', '11px');

    legend.append('rect').attr('x', 0).attr('y', 20).attr('width', 12).attr('height', 12)
      .attr('fill', CHART_COLORS.negative).attr('opacity', 1.0).attr('stroke', ANALYSIS_COLORS.anomalyCold).attr('stroke-width', 2);
    legend.append('text').attr('x', 18).attr('y', 30).text('이상 저온')
      .attr('fill', '#e2e8f0').attr('font-size', '11px');

    legend.append('rect').attr('x', 0).attr('y', 40).attr('width', 12).attr('height', 12)
      .attr('fill', CHART_COLORS.positive).attr('opacity', 0.35);
    legend.append('text').attr('x', 18).attr('y', 50).text('정상 범위')
      .attr('fill', '#e2e8f0').attr('font-size', '11px');

    legend.append('line').attr('x1', 0).attr('x2', 12).attr('y1', 66).attr('y2', 66)
      .attr('stroke', ANALYSIS_COLORS.sigmaLine).attr('stroke-width', 1.5).attr('stroke-dasharray', '6,4');
    legend.append('text').attr('x', 18).attr('y', 70).text('±2σ 기준')
      .attr('fill', '#e2e8f0').attr('font-size', '11px');

    // Summary text
    g.append('text')
      .attr('x', width)
      .attr('y', height + 40)
      .attr('text-anchor', 'end')
      .attr('fill', '#94a3b8')
      .attr('font-size', '12px')
      .text(`이상 기온 해: ${anomalyCount}개 / 전체 ${flags.length}개 (σ = ${std.toFixed(2)}℃)`);

    // Tooltip
    const tooltip = d3.select(containerRef.current)
      .selectAll('.d3-tooltip')
      .data([0])
      .join('div')
      .attr('class', 'd3-tooltip')
      .style('opacity', 0);

    g.selectAll('.bar')
      .on('mouseover', function (event, d: unknown) {
        const data = d as typeof flags[0];
        d3.select(this).attr('opacity', 1);
        tooltip
          .style('opacity', 1)
          .html(
            `<strong>${data.year}년</strong>${data.isAnomaly ? ' ⚠ 이상' : ''}<br/>` +
            `편차: <span style="color:${data.anomaly >= 0 ? '#ef4444' : '#3b82f6'}">${data.anomaly >= 0 ? '+' : ''}${data.anomaly.toFixed(2)}℃</span><br/>` +
            `Z-score: ${data.zScore.toFixed(2)}`
          );
      })
      .on('mousemove', function (event) {
        const containerRect = containerRef.current!.getBoundingClientRect();
        tooltip
          .style('left', (event.clientX - containerRect.left + 10) + 'px')
          .style('top', (event.clientY - containerRect.top - 50) + 'px');
      })
      .on('mouseout', function (_, d: unknown) {
        const data = d as typeof flags[0];
        d3.select(this).attr('opacity', data.isAnomaly ? 1.0 : 0.35);
        tooltip.style('opacity', 0);
      });
  }, [records, cityName]);

  return (
    <div className="chart-container" ref={containerRef} style={{ position: 'relative' }}>
      <h3 className="chart-title">이상 기온 탐지</h3>
      <p className="chart-subtitle">
        {cityName}에서 통계적으로 비정상적이었던 해 — Z-score ±2σ 기준
      </p>
      <svg ref={svgRef} />
    </div>
  );
}
