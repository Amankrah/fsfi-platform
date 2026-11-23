"use client";

import * as React from "react";
import type { Component, ComponentResult } from "@/lib/types";
import { componentStyleMap } from "@/lib/encodings";
import { fmtPct, fmtPp } from "@/lib/format";
import { useSize } from "@/lib/use-size";
import { MarkerGlyph } from "../marker";

/** Dumbbell: current share (open circle) to optimal share (filled evergreen dot), with the shift in percentage points. */
export function Dumbbell({ rows, components }: { rows: ComponentResult[]; components: Component[] }) {
  const [ref, { width }] = useSize<HTMLDivElement>();
  const styles = componentStyleMap(components.map((c) => c.id));
  const sorted = [...rows].sort((a, b) => b.shift_pp - a.shift_pp);

  const rowH = 44;
  const labelW = width < 640 ? 118 : 180;
  const colsW = width < 640 ? 64 : 90;
  const m = { top: 28, bottom: 30 };
  const W = Math.max(width, 280);
  const iw = W - labelW - colsW - 16;
  const H = m.top + sorted.length * rowH + m.bottom;
  const maxShare = Math.max(0.1, ...rows.flatMap((r) => [r.share, r.optimal_share]));
  const xMax = Math.ceil(maxShare * 10) / 10;
  const x = (v: number) => labelW + (Math.max(0, v) / xMax) * iw;
  const ticks = Array.from({ length: Math.round(xMax * 10) + 1 }, (_, i) => i / 10).filter((_, i, a) => a.length <= 6 || i % 2 === 0);

  return (
    <div ref={ref} className="w-full">
      {width > 0 ? (
        <svg width={W} height={H} role="img" aria-label="Current and optimal component shares of the budget">
          <defs>
            <marker id="db-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 9 5 L 0 9 z" fill="var(--rule-strong)" />
            </marker>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={m.top - 8} y2={H - m.bottom + 4} stroke="var(--line)" />
              <text x={x(t)} y={H - m.bottom + 20} textAnchor="middle" className="fill-[var(--ink-subtle)] text-micro tabular">
                {Math.round(t * 100)}%
              </text>
            </g>
          ))}
          <text x={W - 8} y={12} textAnchor="end" className="fill-[var(--ink-subtle)] text-micro font-semibold">
            Shift (pp)
          </text>

          {sorted.map((r, i) => {
            const cy = m.top + i * rowH + rowH / 2;
            const x0 = x(r.share);
            const x1 = x(r.optimal_share);
            const st = styles[r.id];
            const big = Math.abs(x1 - x0) > 10;
            return (
              <g key={r.id}>
                <line x1={labelW} x2={labelW + iw} y1={cy} y2={cy} stroke="var(--line)" strokeDasharray="1 4" />
                <foreignObject x={0} y={cy - 11} width={labelW - 12} height={22}>
                  <div className="flex h-full items-center gap-2 text-small text-ink">
                    {st ? <MarkerGlyph shape={st.shape} fill={st.fill} size={12} /> : null}
                    <span className="truncate">{r.name}</span>
                  </div>
                </foreignObject>
                <line
                  x1={x0}
                  y1={cy}
                  y2={cy}
                  x2={big ? x1 + (x1 > x0 ? -9 : 9) : x1}
                  stroke="var(--rule-strong)"
                  strokeWidth={1.6}
                  markerEnd={big ? "url(#db-arrow)" : undefined}
                />
                <circle cx={x0} cy={cy} r={6.5} fill="var(--canvas)" stroke="var(--ink)" strokeWidth={1.4}>
                  <title>{`Current ${fmtPct(r.share, 1)}`}</title>
                </circle>
                <circle cx={x1} cy={cy} r={7} fill="var(--evergreen)" stroke="var(--surface)" strokeWidth={1.5}>
                  <title>{`Optimal ${fmtPct(r.optimal_share, 1)}`}</title>
                </circle>
                <text
                  x={W - 8}
                  y={cy}
                  dy="0.35em"
                  textAnchor="end"
                  className={`text-small tabular ${r.shift_pp > 0 ? "fill-[var(--ink)] font-semibold" : "fill-[var(--ink-subtle)]"}`}
                >
                  {fmtPp(r.shift_pp)}
                </text>
              </g>
            );
          })}
        </svg>
      ) : (
        <div style={{ height: H }} />
      )}
      <div className="mt-3 flex flex-wrap gap-5 text-micro text-ink-muted">
        <span className="inline-flex items-center gap-2">
          <svg width="14" height="14" aria-hidden><circle cx="7" cy="7" r="5.5" fill="var(--canvas)" stroke="var(--ink)" strokeWidth="1.4" /></svg>
          Current
        </span>
        <span className="inline-flex items-center gap-2">
          <svg width="14" height="14" aria-hidden><circle cx="7" cy="7" r="5.5" fill="var(--evergreen)" /></svg>
          Optimal
        </span>
      </div>
    </div>
  );
}
