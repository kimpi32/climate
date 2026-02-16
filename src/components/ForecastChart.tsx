'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { DailyRecord } from '@/types/climate';
import { calcForecast } from '@/lib/climate-utils';
import { CHART_COLORS, ANALYSIS_COLORS } from '@/lib/constants';

interface ForecastChartProps {
  records: DailyRecord[];
  cityName: string;
}

export default function ForecastChart({ records, cityName }: ForecastChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

    // Combined domain: historical years + forecast years
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

    // X axis
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

    // Future zone background
    const futureX = xScale(String(lastHistYear + 1))!;
    g.append('rect')
      .attr('x', futureX - xScale.step() * xScale.padding() / 2)
      .attr('y', 0)
      .attr('width', width - futureX + xScale.step() * xScale.padding() / 2)
      .attr('height', height)
      .attr('fill', 'rgba(139, 92, 246, 0.05)');

    // Historical bars
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

    // Confidence band
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

    // Regression line (across full range)
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

    // Forecast dots
    g.selectAll('.forecast-dot')
      .data(forecast)
      .join('circle')
      .attr('cx', (d) => (xScale(String(d.year)) || 0) + xScale.bandwidth() / 2)
      .attr('cy', (d) => yScale(d.value))
      .attr('r', 4)
      .attr('fill', ANALYSIS_COLORS.forecast)
      .attr('stroke', '#0b1120')
      .attr('stroke-width', 2);

    // Divider line
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

    // Legend
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

    // Summary below chart
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

    // Tooltip for historical bars
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
      <svg ref={svgRef} />
    </div>
  );
}
