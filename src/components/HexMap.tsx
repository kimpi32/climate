'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import { CITIES, HEATMAP_COLD, HEATMAP_NEUTRAL, HEATMAP_HOT, DATA_START_YEAR } from '@/lib/constants';
import { calcAnnualAnomalies } from '@/lib/climate-utils';
import type { CityData, AnnualAnomaly } from '@/types/climate';

interface HexMapProps {
  selectedCity: string;
  onCityChange: (cityId: string) => void;
}

// ── Hex grid: pointy-top, odd-r offset (odd rows shift right) ──
// Data cities — (col, row) integer coordinates
// Pointy-top, odd-r offset grid layout:
//
// Row 0: 인천(1)  서울(2)  강릉(3)
// Row 1:    천안(1)  청주(2)  동해(3)
// Row 2: 전주(1)  대전(2)  대구(3)  포항(4)
// Row 3:    광주(1)  밀양(2)  울산(3)
// Row 4: 여수(1)  창원(2)  부산(3)
// Row 6: 제주(0)
//
const HEX_GRID: Record<string, [number, number]> = {
  incheon: [1, 0],
  seoul:   [2, 0],
  daejeon: [2, 2],
  gwangju: [1, 3],
  daegu:   [3, 2],
  ulsan:   [3, 3],
  busan:   [3, 4],
  jeju:    [0, 6],
};

// Filler cities — grey placeholder tiles to form the peninsula shape
const FILLER_TILES: { name: string; col: number; row: number }[] = [
  { name: '강릉', col: 3, row: 0 },
  { name: '천안', col: 1, row: 1 },
  { name: '청주', col: 2, row: 1 },
  { name: '동해', col: 3, row: 1 },
  { name: '전주', col: 1, row: 2 },
  { name: '포항', col: 4, row: 2 },
  { name: '밀양', col: 2, row: 3 },
  { name: '여수', col: 1, row: 4 },
  { name: '창원', col: 2, row: 4 },
];

const HEX_R = 45;
const HEX_W = Math.sqrt(3) * HEX_R;  // pointy-top width ≈ 77.9
const ROW_H = 1.5 * HEX_R;           // vertical row spacing = 67.5
const PAD_X = 55;
const PAD_Y = 55;
const SVG_W = 435;
const SVG_H = 540;

function hexCenter(col: number, row: number): [number, number] {
  return [
    PAD_X + col * HEX_W + (row % 2 ? HEX_W / 2 : 0),
    PAD_Y + row * ROW_H,
  ];
}

// Pointy-top hexagon path
function hexPath(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
  }
  return `M${pts.join('L')}Z`;
}

// 5-year periods — exclude current year (no complete data yet)
function generatePeriods(): string[] {
  const periods: string[] = [];
  const cur = new Date().getFullYear();
  for (let y = DATA_START_YEAR; y < cur; y += 5) {
    periods.push(`${y}-${y + 4}`);
  }
  return periods;
}

function calcPeriodAnomalies(annuals: AnnualAnomaly[], periods: string[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const p of periods) {
    const [s, e] = p.split('-').map(Number);
    const m = annuals.filter((a) => a.year >= s && a.year <= e);
    if (m.length > 0) {
      result.set(p, m.reduce((sum, a) => sum + a.anomaly, 0) / m.length);
    }
  }
  return result;
}

export default function HexMap({ selectedCity, onCityChange }: HexMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [data, setData] = useState<Map<string, Map<string, number>>>(new Map());
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('');
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const periods = generatePeriods();

  // Fetch all 8 data cities
  useEffect(() => {
    Promise.all(
      CITIES.map((c) =>
        fetch(`/data/${c.id}.json`)
          .then((r) => r.json())
          .then((d: CityData) =>
            [c.id, calcPeriodAnomalies(calcAnnualAnomalies(d.records), periods)] as const
          )
      )
    ).then((results) => {
      setData(new Map(results));
      setPeriod(periods[periods.length - 1]);
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-play
  useEffect(() => {
    if (!playing) return;
    timerRef.current = setInterval(() => {
      setPeriod((prev) => {
        const idx = periods.indexOf(prev);
        if (idx >= periods.length - 1) {
          setPlaying(false);
          return prev;
        }
        return periods[idx + 1];
      });
    }, 2000);
    return () => clearInterval(timerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const handlePlay = useCallback(() => {
    if (playing) { setPlaying(false); return; }
    const idx = periods.indexOf(period);
    if (idx >= periods.length - 1) setPeriod(periods[0]);
    setPlaying(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, period]);

  // ── D3 render ──
  useEffect(() => {
    if (loading || !svgRef.current || data.size === 0 || !period) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${SVG_W} ${SVG_H}`);

    // Color scale from all anomaly values
    const allVals: number[] = [];
    data.forEach((m) => m.forEach((v) => allVals.push(v)));
    const maxAbs = Math.max(d3.max(allVals.map(Math.abs)) || 1.5, 0.5);

    const color = d3
      .scaleLinear<string>()
      .domain([-maxAbs, 0, maxAbs])
      .range([HEATMAP_COLD, HEATMAP_NEUTRAL, HEATMAP_HOT])
      .interpolate(d3.interpolateRgb);

    // ── 1) Draw filler tiles (grey, no data) ──
    FILLER_TILES.forEach((tile) => {
      const [cx, cy] = hexCenter(tile.col, tile.row);
      const g = svg.append('g');

      g.append('path')
        .attr('d', hexPath(cx, cy, HEX_R))
        .attr('fill', 'var(--card-bg)')
        .attr('stroke', 'rgba(128,128,128,0.2)')
        .attr('stroke-width', 1);

      g.append('text')
        .attr('x', cx).attr('y', cy)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '14px')
        .attr('font-weight', '500')
        .attr('fill', 'var(--muted)')
        .attr('opacity', 0.5)
        .text(tile.name);
    });

    // ── 2) Draw data cities (colored) ──
    CITIES.forEach((city) => {
      const pos = HEX_GRID[city.id];
      if (!pos) return;
      const [cx, cy] = hexCenter(pos[0], pos[1]);
      const anomaly = data.get(city.id)?.get(period);
      const fill = anomaly !== undefined ? color(anomaly) : '#e5e7eb';
      const isSelected = city.id === selectedCity;
      const isDark = anomaly !== undefined && Math.abs(anomaly) > maxAbs * 0.45;

      const g = svg.append('g')
        .style('cursor', 'pointer')
        .on('click', () => onCityChange(city.id));

      g.append('path')
        .attr('d', hexPath(cx, cy, HEX_R))
        .attr('fill', fill)
        .attr('stroke', isSelected ? 'var(--foreground)' : 'rgba(128,128,128,0.3)')
        .attr('stroke-width', isSelected ? 2.5 : 1);

      // City name — larger text
      g.append('text')
        .attr('x', cx).attr('y', cy - 9)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '15px')
        .attr('font-weight', '700')
        .attr('fill', isDark ? '#fff' : 'var(--foreground)')
        .text(city.name);

      // Anomaly value
      if (anomaly !== undefined) {
        g.append('text')
          .attr('x', cx).attr('y', cy + 13)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('font-size', '14px')
          .attr('font-weight', '600')
          .attr('fill', isDark ? 'rgba(255,255,255,0.9)' : 'var(--muted)')
          .text(`${anomaly > 0 ? '+' : ''}${anomaly.toFixed(1)}℃`);
      }
    });

    // ── 3) Color legend ──
    const lw = 140, lh = 10;
    const lx = SVG_W - lw - 20, ly = SVG_H - 25;
    const defs = svg.append('defs');
    const grad = defs.append('linearGradient').attr('id', 'hex-lg');
    grad.append('stop').attr('offset', '0%').attr('stop-color', HEATMAP_COLD);
    grad.append('stop').attr('offset', '50%').attr('stop-color', HEATMAP_NEUTRAL);
    grad.append('stop').attr('offset', '100%').attr('stop-color', HEATMAP_HOT);

    svg.append('rect')
      .attr('x', lx).attr('y', ly)
      .attr('width', lw).attr('height', lh)
      .attr('rx', 3).attr('fill', 'url(#hex-lg)');
    svg.append('text')
      .attr('x', lx).attr('y', ly - 4)
      .attr('font-size', '10px').attr('fill', 'var(--muted)')
      .text(`-${maxAbs.toFixed(1)}℃`);
    svg.append('text')
      .attr('x', lx + lw).attr('y', ly - 4)
      .attr('text-anchor', 'end')
      .attr('font-size', '10px').attr('fill', 'var(--muted)')
      .text(`+${maxAbs.toFixed(1)}℃`);

  }, [data, period, selectedCity, loading, onCityChange]);

  if (loading) {
    return (
      <div className="chart-container">
        <h2 className="chart-title">한반도 기온 편차 지도</h2>
        <div className="flex items-center justify-center py-16">
          <div className="text-[var(--muted)]">전국 데이터 로딩 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="chart-container">
      <h2 className="chart-title">한반도 기온 편차 지도</h2>
      <p className="text-sm text-[var(--muted)] mt-1 mb-4">
        기준기간(1973-2000) 대비 5년 평균 기온 편차 | 도시를 클릭하면 상세 차트로 이동합니다
      </p>

      <div className="flex justify-center">
        <svg ref={svgRef} className="w-full max-w-[435px]" />
      </div>

      {/* Period controls */}
      <div className="mt-4">
        <div className="flex items-center gap-1.5 flex-wrap justify-center">
          <button
            onClick={handlePlay}
            className="flex items-center justify-center w-8 h-8 rounded-md border border-[var(--card-border)] hover:bg-[var(--card-bg)] transition-colors"
            title={playing ? '일시정지' : '자동 재생'}
          >
            {playing ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <rect x="2" y="1" width="4" height="12" rx="1" />
                <rect x="8" y="1" width="4" height="12" rx="1" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <path d="M2 1.5v11l10-5.5z" />
              </svg>
            )}
          </button>

          {periods.map((p) => {
            const isActive = p === period;
            const startYear = p.split('-')[0];
            return (
              <button
                key={p}
                onClick={() => { setPlaying(false); setPeriod(p); }}
                className={`px-1.5 py-1 text-xs rounded-md border transition-colors ${
                  isActive
                    ? 'bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)] font-semibold'
                    : 'border-[var(--card-border)] hover:bg-[var(--card-bg)] text-[var(--muted)]'
                }`}
              >
                {startYear}
              </button>
            );
          })}
        </div>
        <div className="text-center mt-2 text-sm font-medium text-[var(--foreground)]">
          {period && `${period.replace('-', ' ~ ')}년`}
        </div>
      </div>
    </div>
  );
}
