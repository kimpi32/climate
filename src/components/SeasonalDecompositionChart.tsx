'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { DailyRecord } from '@/types/climate';
import { decomposeSeasonality } from '@/lib/climate-utils';
import { ANALYSIS_COLORS } from '@/lib/constants';

interface SeasonalDecompositionChartProps {
  records: DailyRecord[];
  cityName: string;
}

export default function SeasonalDecompositionChart({ records, cityName }: SeasonalDecompositionChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || records.length === 0) return;

    const { points } = decomposeSeasonality(records);
    if (points.length === 0) return;

    const containerWidth = containerRef.current.clientWidth;
    const margin = { top: 15, right: 30, bottom: 25, left: 55 };
    const panelHeight = 120;
    const panelGap = 30;
    const width = containerWidth - margin.left - margin.right;
    const totalHeight = (panelHeight + panelGap) * 4 - panelGap + margin.top + margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', containerWidth).attr('height', totalHeight);

    // Shared x-scale: index-based with year labels
    const xScale = d3.scaleLinear().domain([0, points.length - 1]).range([0, width]);

    // Year tick positions
    const yearTicks: { index: number; year: number }[] = [];
    for (let i = 0; i < points.length; i++) {
      if (points[i].month === 1 && points[i].year % 10 === 0) {
        yearTicks.push({ index: i, year: points[i].year });
      }
    }

    const panels: {
      title: string;
      color: string;
      getData: () => (number | null)[];
      format: (d: number) => string;
    }[] = [
      {
        title: '관측값 (Observed)',
        color: ANALYSIS_COLORS.decomObserved,
        getData: () => points.map((p) => p.observed),
        format: (d) => `${d.toFixed(0)}℃`,
      },
      {
        title: '추세 (Trend)',
        color: ANALYSIS_COLORS.decomTrend,
        getData: () => points.map((p) => p.trend),
        format: (d) => `${d.toFixed(1)}℃`,
      },
      {
        title: '계절성 (Seasonal)',
        color: ANALYSIS_COLORS.decomSeasonal,
        getData: () => points.map((p) => p.seasonal),
        format: (d) => `${d >= 0 ? '+' : ''}${d.toFixed(1)}℃`,
      },
      {
        title: '잔차 (Residual)',
        color: ANALYSIS_COLORS.decomResidual,
        getData: () => points.map((p) => p.residual),
        format: (d) => `${d >= 0 ? '+' : ''}${d.toFixed(1)}℃`,
      },
    ];

    panels.forEach((panel, panelIdx) => {
      const yOffset = margin.top + panelIdx * (panelHeight + panelGap);
      const g = svg.append('g').attr('transform', `translate(${margin.left},${yOffset})`);

      const data = panel.getData();
      const validData: { idx: number; val: number }[] = [];
      data.forEach((v, i) => {
        if (v !== null) validData.push({ idx: i, val: v });
      });

      if (validData.length === 0) {
        g.append('text').attr('x', width / 2).attr('y', panelHeight / 2)
          .attr('text-anchor', 'middle').attr('fill', '#475569').attr('font-size', '12px')
          .text('데이터 부족');
        return;
      }

      const yExtent = d3.extent(validData, (d) => d.val) as [number, number];
      const yPad = (yExtent[1] - yExtent[0]) * 0.1 || 1;
      const yScale = d3.scaleLinear()
        .domain([yExtent[0] - yPad, yExtent[1] + yPad])
        .range([panelHeight, 0]);

      // Panel title
      g.append('text')
        .attr('x', 0).attr('y', -4)
        .attr('fill', panel.color).attr('font-size', '11px').attr('font-weight', '600')
        .text(panel.title);

      // Grid
      g.append('g')
        .selectAll('line')
        .data(yScale.ticks(3))
        .join('line')
        .attr('x1', 0).attr('x2', width)
        .attr('y1', (d) => yScale(d)).attr('y2', (d) => yScale(d))
        .attr('stroke', '#1e293b').attr('stroke-dasharray', '2,2');

      // Y axis
      g.append('g')
        .call(d3.axisLeft(yScale).ticks(3).tickFormat((d) => panel.format(d as number)))
        .selectAll('text')
        .attr('fill', '#94a3b8').attr('font-size', '9px');

      // X axis (only on last panel)
      if (panelIdx === panels.length - 1) {
        g.append('g')
          .attr('transform', `translate(0,${panelHeight})`)
          .call(
            d3.axisBottom(xScale)
              .tickValues(yearTicks.map((t) => t.index))
              .tickFormat((_, i) => String(yearTicks[i]?.year ?? ''))
          )
          .selectAll('text')
          .attr('fill', '#94a3b8').attr('font-size', '10px');
      }

      // Zero line for seasonal/residual
      if (panelIdx >= 2) {
        g.append('line')
          .attr('x1', 0).attr('x2', width)
          .attr('y1', yScale(0)).attr('y2', yScale(0))
          .attr('stroke', '#475569').attr('stroke-width', 0.5);
      }

      // Line
      const line = d3.line<typeof validData[0]>()
        .x((d) => xScale(d.idx))
        .y((d) => yScale(d.val))
        .curve(d3.curveLinear);

      g.append('path')
        .datum(validData)
        .attr('fill', 'none')
        .attr('stroke', panel.color)
        .attr('stroke-width', 1.2)
        .attr('d', line);
    });
  }, [records, cityName]);

  return (
    <div className="chart-container" ref={containerRef} style={{ position: 'relative' }}>
      <h3 className="chart-title">계절 분해</h3>
      <p className="chart-subtitle">
        {cityName} 월별 기온을 추세 + 계절성 + 잔차로 분리
      </p>
      <svg ref={svgRef} />
    </div>
  );
}
