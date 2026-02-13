'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { DailyRecord } from '@/types/climate';
import { calcAnnualAnomalies, movingAverage } from '@/lib/climate-utils';
import { CHART_COLORS } from '@/lib/constants';

interface AnnualAnomalyChartProps {
  records: DailyRecord[];
  cityName: string;
}

export default function AnnualAnomalyChart({ records, cityName }: AnnualAnomalyChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || records.length === 0) return;

    const anomalies = calcAnnualAnomalies(records);
    if (anomalies.length === 0) return;

    const containerWidth = containerRef.current.clientWidth;
    const margin = { top: 20, right: 30, bottom: 50, left: 55 };
    const width = containerWidth - margin.left - margin.right;
    const height = 300;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg
      .attr('width', containerWidth)
      .attr('height', height + margin.top + margin.bottom);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const xScale = d3
      .scaleBand()
      .domain(anomalies.map((d) => String(d.year)))
      .range([0, width])
      .padding(0.15);

    const maxAbs = d3.max(anomalies, (d) => Math.abs(d.anomaly)) || 1;
    const yScale = d3.scaleLinear().domain([-maxAbs * 1.1, maxAbs * 1.1]).range([height, 0]);

    // X axis
    const xTicks = anomalies.filter((d) => d.year % 10 === 0);
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

    // Zero line
    g.append('line')
      .attr('x1', 0).attr('x2', width)
      .attr('y1', yScale(0)).attr('y2', yScale(0))
      .attr('stroke', '#475569')
      .attr('stroke-width', 1);

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

    // Bars
    g.selectAll('.bar')
      .data(anomalies)
      .join('rect')
      .attr('class', 'bar')
      .attr('x', (d) => xScale(String(d.year))!)
      .attr('y', (d) => (d.anomaly >= 0 ? yScale(d.anomaly) : yScale(0)))
      .attr('width', xScale.bandwidth())
      .attr('height', (d) => Math.abs(yScale(0) - yScale(d.anomaly)))
      .attr('fill', (d) => (d.anomaly >= 0 ? CHART_COLORS.positive : CHART_COLORS.negative))
      .attr('opacity', 0.85);

    // 10-year moving average
    const maData = movingAverage(
      anomalies.map((d) => ({ year: d.year, value: d.anomaly })),
      10
    );

    const maLine = d3.line<{ year: number; value: number }>()
      .x((d) => (xScale(String(d.year)) || 0) + xScale.bandwidth() / 2)
      .y((d) => yScale(d.value))
      .curve(d3.curveBasis);

    g.append('path')
      .datum(maData)
      .attr('fill', 'none')
      .attr('stroke', CHART_COLORS.movingAverage)
      .attr('stroke-width', 2.5)
      .attr('d', maLine);

    // Legend
    const legend = g.append('g').attr('transform', `translate(10, 10)`);

    legend.append('rect').attr('x', 0).attr('y', 0).attr('width', 12).attr('height', 12)
      .attr('fill', CHART_COLORS.positive).attr('opacity', 0.85);
    legend.append('text').attr('x', 18).attr('y', 10).text('기준 이상')
      .attr('fill', '#e2e8f0').attr('font-size', '11px');

    legend.append('rect').attr('x', 0).attr('y', 20).attr('width', 12).attr('height', 12)
      .attr('fill', CHART_COLORS.negative).attr('opacity', 0.85);
    legend.append('text').attr('x', 18).attr('y', 30).text('기준 이하')
      .attr('fill', '#e2e8f0').attr('font-size', '11px');

    legend.append('line').attr('x1', 0).attr('x2', 12).attr('y1', 46).attr('y2', 46)
      .attr('stroke', CHART_COLORS.movingAverage).attr('stroke-width', 2.5);
    legend.append('text').attr('x', 18).attr('y', 50).text('10년 이동평균')
      .attr('fill', '#e2e8f0').attr('font-size', '11px');

    // Tooltip
    const tooltip = d3.select(containerRef.current)
      .selectAll('.d3-tooltip')
      .data([0])
      .join('div')
      .attr('class', 'd3-tooltip')
      .style('opacity', 0);

    g.selectAll('.bar')
      .on('mouseover', function (event, d: unknown) {
        const data = d as { year: number; anomaly: number; avgTemp: number };
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
        d3.select(this).attr('opacity', 0.85);
        tooltip.style('opacity', 0);
      });
  }, [records, cityName]);

  return (
    <div className="chart-container" ref={containerRef} style={{ position: 'relative' }}>
      <h3 className="chart-title">평년보다 더웠던 해, 추웠던 해</h3>
      <p className="chart-subtitle">
        {cityName} 연평균 기온이 기준선을 넘어선 순간들
      </p>
      <svg ref={svgRef} />
    </div>
  );
}
