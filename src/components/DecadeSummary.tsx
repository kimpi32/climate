'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { DailyRecord } from '@/types/climate';
import { calcDecadeStats } from '@/lib/climate-utils';

interface DecadeSummaryProps {
  records: DailyRecord[];
  cityName: string;
}

export default function DecadeSummary({ records, cityName }: DecadeSummaryProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || records.length === 0) return;

    const decades = calcDecadeStats(records);
    if (decades.length === 0) return;

    const containerWidth = containerRef.current.clientWidth;
    const margin = { top: 20, right: 30, bottom: 50, left: 55 };
    const width = containerWidth - margin.left - margin.right;
    const height = 280;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg
      .attr('width', containerWidth)
      .attr('height', height + margin.top + margin.bottom);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleBand()
      .domain(decades.map((d) => d.decade))
      .range([0, width])
      .padding(0.3);

    const yMin = d3.min(decades, (d) => d.avgTemp)! - 1;
    const yMax = d3.max(decades, (d) => d.avgTemp)! + 1;
    const yScale = d3.scaleLinear().domain([yMin, yMax]).range([height, 0]);

    // Axes
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '11px');

    g.append('g')
      .call(d3.axisLeft(yScale).ticks(6).tickFormat((d) => `${(d as number).toFixed(1)}℃`))
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '10px');

    // Grid
    g.append('g')
      .selectAll('line')
      .data(yScale.ticks(6))
      .join('line')
      .attr('x1', 0).attr('x2', width)
      .attr('y1', (d) => yScale(d))
      .attr('y2', (d) => yScale(d))
      .attr('stroke', '#1e293b')
      .attr('stroke-dasharray', '2,2');

    // Color scale based on temperature difference from first decade
    const colorScale = d3.scaleSequential()
      .domain([0, d3.max(decades, (d) => Math.abs(d.diffFromFirst)) || 1])
      .interpolator(d3.interpolateRgb('#3b82f6', '#ef4444'));

    // Bars
    g.selectAll('.bar')
      .data(decades)
      .join('rect')
      .attr('class', 'bar')
      .attr('x', (d) => xScale(d.decade)!)
      .attr('y', (d) => yScale(d.avgTemp))
      .attr('width', xScale.bandwidth())
      .attr('height', (d) => height - yScale(d.avgTemp))
      .attr('fill', (d) => colorScale(Math.abs(d.diffFromFirst)))
      .attr('rx', 4)
      .attr('opacity', 0.9);

    // Temperature labels on bars
    g.selectAll('.temp-label')
      .data(decades)
      .join('text')
      .attr('class', 'temp-label')
      .attr('x', (d) => xScale(d.decade)! + xScale.bandwidth() / 2)
      .attr('y', (d) => yScale(d.avgTemp) - 8)
      .attr('text-anchor', 'middle')
      .attr('fill', '#e2e8f0')
      .attr('font-size', '12px')
      .attr('font-weight', '600')
      .text((d) => `${d.avgTemp.toFixed(1)}℃`);

    // Difference labels
    g.selectAll('.diff-label')
      .data(decades.filter((d) => d.diffFromFirst !== 0))
      .join('text')
      .attr('class', 'diff-label')
      .attr('x', (d) => xScale(d.decade)! + xScale.bandwidth() / 2)
      .attr('y', (d) => yScale(d.avgTemp) - 24)
      .attr('text-anchor', 'middle')
      .attr('fill', (d) => (d.diffFromFirst > 0 ? '#ef4444' : '#3b82f6'))
      .attr('font-size', '11px')
      .text((d) => `${d.diffFromFirst > 0 ? '+' : ''}${d.diffFromFirst.toFixed(2)}℃`);

    // Trend line
    const trendLine = d3.line<typeof decades[0]>()
      .x((d) => xScale(d.decade)! + xScale.bandwidth() / 2)
      .y((d) => yScale(d.avgTemp))
      .curve(d3.curveCatmullRom);

    g.append('path')
      .datum(decades)
      .attr('fill', 'none')
      .attr('stroke', '#f59e0b')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '6,4')
      .attr('d', trendLine);

    g.selectAll('.trend-dot')
      .data(decades)
      .join('circle')
      .attr('cx', (d) => xScale(d.decade)! + xScale.bandwidth() / 2)
      .attr('cy', (d) => yScale(d.avgTemp))
      .attr('r', 4)
      .attr('fill', '#f59e0b')
      .attr('stroke', '#0b1120')
      .attr('stroke-width', 2);
  }, [records, cityName]);

  return (
    <div className="chart-container" ref={containerRef} style={{ position: 'relative' }}>
      <h3 className="chart-title">10년마다 올라가는 체온</h3>
      <p className="chart-subtitle">
        {cityName}의 10년 단위 평균기온 — 되돌릴 수 없는 상승
      </p>
      <svg ref={svgRef} />
    </div>
  );
}
