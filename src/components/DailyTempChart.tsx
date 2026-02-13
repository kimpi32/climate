'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { DailyRecord } from '@/types/climate';
import { groupByYear, calcBaselineDailyMeans } from '@/lib/climate-utils';
import { CHART_COLORS, RECENT_YEAR_COLORS } from '@/lib/constants';

interface DailyTempChartProps {
  records: DailyRecord[];
  cityName: string;
}

export default function DailyTempChart({ records, cityName }: DailyTempChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || records.length === 0) return;

    const containerWidth = containerRef.current.clientWidth;
    const margin = { top: 20, right: 30, bottom: 50, left: 55 };
    const width = containerWidth - margin.left - margin.right;
    const height = 350;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg
      .attr('width', containerWidth)
      .attr('height', height + margin.top + margin.bottom);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const grouped = groupByYear(records);
    const baselineDaily = calcBaselineDailyMeans(records);

    // X scale: day of year (1-366)
    const xScale = d3.scaleLinear().domain([1, 366]).range([0, width]);

    // Y scale: temperature
    const allTemps = records.map((r) => r.avgTemp);
    const yMin = d3.min(allTemps)! - 2;
    const yMax = d3.max(allTemps)! + 2;
    const yScale = d3.scaleLinear().domain([yMin, yMax]).range([height, 0]);

    // Axes
    const monthStarts = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
    const monthLabels = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

    const xAxis = d3.axisBottom(xScale)
      .tickValues(monthStarts)
      .tickFormat((_, i) => monthLabels[i]);

    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(xAxis)
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '10px');

    g.append('g')
      .call(d3.axisLeft(yScale).ticks(8).tickFormat((d) => `${d}℃`))
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '10px');

    // Grid lines
    g.append('g')
      .attr('class', 'grid')
      .selectAll('line')
      .data(yScale.ticks(8))
      .join('line')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('y1', (d) => yScale(d))
      .attr('y2', (d) => yScale(d))
      .attr('stroke', '#1e293b')
      .attr('stroke-dasharray', '2,2');

    // Line generator
    const line = d3.line<{ dayOfYear: number; avgTemp: number }>()
      .x((d) => xScale(d.dayOfYear))
      .y((d) => yScale(d.avgTemp))
      .curve(d3.curveBasis);

    // Recent 3 years to highlight
    const recentYears = Object.keys(RECENT_YEAR_COLORS).map(Number);
    const sortedYears = Array.from(grouped.keys()).sort((a, b) => a - b);

    // Draw past years (gray, low opacity) — skip recent 3
    sortedYears.forEach((year) => {
      if (recentYears.includes(year)) return;
      const yearData = grouped.get(year)!;
      g.append('path')
        .datum(yearData)
        .attr('fill', 'none')
        .attr('stroke', CHART_COLORS.pastYears)
        .attr('stroke-width', 0.8)
        .attr('d', line);
    });

    // Draw baseline (1973-2000 mean) as dashed line
    const baselineData: { dayOfYear: number; avgTemp: number }[] = [];
    for (let d = 1; d <= 365; d++) {
      const mmdd = dayOfYearToMMDD(d);
      const temp = baselineDaily.get(mmdd);
      if (temp !== undefined) {
        baselineData.push({ dayOfYear: d, avgTemp: temp });
      }
    }

    g.append('path')
      .datum(baselineData)
      .attr('fill', 'none')
      .attr('stroke', CHART_COLORS.baseline)
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '6,4')
      .attr('d', line);

    // Draw recent 3 years (oldest first so newest is on top)
    const recentYearsSorted = [...recentYears].sort((a, b) => a - b);
    recentYearsSorted.forEach((year) => {
      const yearData = grouped.get(year);
      if (!yearData) return;
      const cfg = RECENT_YEAR_COLORS[year];
      g.append('path')
        .datum(yearData)
        .attr('fill', 'none')
        .attr('stroke', cfg.color)
        .attr('stroke-width', cfg.width)
        .attr('d', line);
    });

    // Legend — recent years + baseline + past
    const legend = g.append('g').attr('transform', `translate(${width - 200}, 10)`);
    let legendY = 0;

    // Recent years (newest first in legend)
    [...recentYearsSorted].reverse().forEach((year) => {
      const cfg = RECENT_YEAR_COLORS[year];
      legend.append('line').attr('x1', 0).attr('x2', 25).attr('y1', legendY).attr('y2', legendY)
        .attr('stroke', cfg.color).attr('stroke-width', cfg.width);
      legend.append('text').attr('x', 30).attr('y', legendY + 4).text(cfg.label)
        .attr('fill', '#e2e8f0').attr('font-size', '12px');
      legendY += 20;
    });

    legend.append('line').attr('x1', 0).attr('x2', 25).attr('y1', legendY).attr('y2', legendY)
      .attr('stroke', CHART_COLORS.baseline).attr('stroke-width', 2).attr('stroke-dasharray', '6,4');
    legend.append('text').attr('x', 30).attr('y', legendY + 4).text('1973-2000 평균')
      .attr('fill', '#94a3b8').attr('font-size', '12px');
    legendY += 20;

    legend.append('line').attr('x1', 0).attr('x2', 25).attr('y1', legendY).attr('y2', legendY)
      .attr('stroke', 'rgba(156, 163, 175, 0.3)').attr('stroke-width', 1);
    legend.append('text').attr('x', 30).attr('y', legendY + 4).text('과거 연도')
      .attr('fill', '#64748b').attr('font-size', '12px');

    // Tooltip
    const tooltip = d3.select(containerRef.current)
      .selectAll('.d3-tooltip')
      .data([0])
      .join('div')
      .attr('class', 'd3-tooltip')
      .style('opacity', 0);

    const focusLine = g.append('line')
      .attr('y1', 0).attr('y2', height)
      .attr('stroke', '#475569').attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,4')
      .style('opacity', 0);

    svg.on('mousemove', function (event) {
      const [mx] = d3.pointer(event, g.node());
      if (mx < 0 || mx > width) {
        tooltip.style('opacity', 0);
        focusLine.style('opacity', 0);
        return;
      }
      const dayOfYear = Math.round(xScale.invert(mx));
      if (dayOfYear < 1 || dayOfYear > 365) return;

      focusLine.attr('x1', mx).attr('x2', mx).style('opacity', 1);

      const mmdd = dayOfYearToMMDD(dayOfYear);
      const baselineTemp = baselineDaily.get(mmdd);

      // Build tooltip lines for recent years
      let recentLines = '';
      [...recentYearsSorted].reverse().forEach((year) => {
        const yearData = grouped.get(year);
        const dayData = yearData?.find((d) => d.dayOfYear === dayOfYear);
        if (dayData) {
          const cfg = RECENT_YEAR_COLORS[year];
          recentLines += `${year}년: <span style="color:${cfg.color}">${dayData.avgTemp.toFixed(1)}℃</span><br/>`;
        }
      });

      const containerRect = containerRef.current!.getBoundingClientRect();
      tooltip
        .style('opacity', 1)
        .html(
          `<strong>${mmdd.replace('-', '월 ')}일</strong><br/>` +
          recentLines +
          (baselineTemp !== undefined ? `기준 평균: ${baselineTemp.toFixed(1)}℃` : '')
        )
        .style('left', (event.clientX - containerRect.left + 15) + 'px')
        .style('top', (event.clientY - containerRect.top - 50) + 'px');
    });

    svg.on('mouseout', function () {
      tooltip.style('opacity', 0);
      focusLine.style('opacity', 0);
    });
  }, [records, cityName]);

  return (
    <div className="chart-container" ref={containerRef} style={{ position: 'relative' }}>
      <h3 className="chart-title">오늘, 역대 몇 번째로 더운 날?</h3>
      <p className="chart-subtitle">
        {cityName}의 65년치 일별 기온 기록
      </p>
      <svg ref={svgRef} />
    </div>
  );
}

function dayOfYearToMMDD(day: number): string {
  // Non-leap year mapping
  const months = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let remaining = day;
  for (let m = 0; m < 12; m++) {
    if (remaining <= months[m]) {
      return `${String(m + 1).padStart(2, '0')}-${String(remaining).padStart(2, '0')}`;
    }
    remaining -= months[m];
  }
  return '12-31';
}
