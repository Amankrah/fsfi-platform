"use client";

import * as React from "react";
import { useSize } from "@/lib/use-size";

/** Mark styles: identity is carried by shape as well as colour, and every mark has a legend entry. */
export type DotKind = "hollow" | "filled" | "tick" | "diamond";

export interface DotMark {
  key: string;
  value: number;
  kind: DotKind;
  title: string;
}

export interface DotRow {
  id: string;
  label: string;
  marks: DotMark[];
  /** draw an arrow from this mark to that mark */
  from?: string;
  to?: string;
  right?: string;
  rightStrong?: boolean;
}

function Mark({ kind, cx, cy }: { kind: DotKind; cx: number; cy: number }) {
  if (kind === "tick") return <line x1={cx} x2={cx} y1={cy - 10} y2={cy + 10} stroke="var(--ink)" strokeWidth={2.5} />;
  if (kind === "diamond") {
    const d = 6.5;
    return <path d={`M ${cx} ${cy - d} L ${cx + d} ${cy} L ${cx} ${cy + d} L ${cx - d} ${cy} Z`} fill="var(--neutral-mark)" stroke="var(--surface)" strokeWidth={1.5} />;
  }
  if (kind === "filled") return <circle cx={cx} cy={cy} r={7} fill="var(--steel)" stroke="var(--surface)" strokeWidth={1.5} />;
  return <circle cx={cx} cy={cy} r={6.5} fill="var(--canvas)" stroke="var(--ink)" strokeWidth={1.4} />;
}

export function DotLegend({ items }: { items: { kind: DotKind; label: string }[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-5 text-micro text-ink-muted">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-2">
          <svg width="16" height="22" aria-hidden>
            <Mark kind={it.kind} cx={8} cy={11} />
          </svg>
          {it.label}
        </span>
      ))}
    </div>
  );
}

/** Rows of marks on a shared horizontal scale (shares or stress), with an optional value column on the right. */
export function DotRows({
  rows,
  max,
  format,
  legend,
  ariaLabel,
  rightHeader,
}: {
  rows: DotRow[];
  max: number;
  format: (v: number) => string;
  legend: { kind: DotKind; label: string }[];
  ariaLabel: string;
  rightHeader?: string;
}) {
  const [ref, { width }] = useSize<HTMLDivElement>();
  const rowH = 44;
  const labelW = width < 640 ? 120 : 210;
  const colsW = rightHeader ? (width < 640 ? 64 : 96) : 8;
  const m = { top: 28, bottom: 30 };
  const W = Math.max(width, 280);
  const iw = W - labelW - colsW - 16;
  const H = m.top + rows.length * rowH + m.bottom;
  const step = max <= 0.3 ? 0.05 : max <= 0.6 ? 0.1 : 0.2;
  const xMax = Math.max(step, Math.ceil(max / step) * step);
  const x = (v: number) => labelW + (Math.max(0, Math.min(v, xMax)) / xMax) * iw;
  const ticks = Array.from({ length: Math.round(xMax / step) + 1 }, (_, i) => +(i * step).toFixed(4));

  return (
    <div ref={ref} className="w-full">
      {width > 0 ? (
        <svg width={W} height={H} role="img" aria-label={ariaLabel}>
          <defs>
            <marker id="dr-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 9 5 L 0 9 z" fill="var(--rule-strong)" />
            </marker>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={m.top - 8} y2={H - m.bottom + 4} stroke="var(--line)" />
              <text x={x(t)} y={H - m.bottom + 20} textAnchor="middle" className="fill-[var(--ink-subtle)] text-micro tabular">
                {format(t)}
              </text>
            </g>
          ))}
          {rightHeader ? (
            <text x={W - 8} y={12} textAnchor="end" className="fill-[var(--ink-subtle)] text-micro font-semibold">
              {rightHeader}
            </text>
          ) : null}
          {rows.map((r, i) => {
            const cy = m.top + i * rowH + rowH / 2;
            const a = r.marks.find((k) => k.key === r.from);
            const b = r.marks.find((k) => k.key === r.to);
            const x0 = a ? x(a.value) : 0;
            const x1 = b ? x(b.value) : 0;
            const big = Math.abs(x1 - x0) > 12;
            return (
              <g key={r.id}>
                <line x1={labelW} x2={labelW + iw} y1={cy} y2={cy} stroke="var(--line)" strokeDasharray="1 4" />
                <text x={0} y={cy} dy="0.35em" className="fill-[var(--ink)] text-small">
                  {r.label.length > (labelW < 150 ? 15 : 28) ? `${r.label.slice(0, labelW < 150 ? 14 : 27)}…` : r.label}
                  <title>{r.label}</title>
                </text>
                {a && b ? (
                  <line
                    x1={x0}
                    x2={big ? x1 + (x1 > x0 ? -10 : 10) : x1}
                    y1={cy}
                    y2={cy}
                    stroke="var(--rule-strong)"
                    strokeWidth={1.6}
                    markerEnd={big ? "url(#dr-arrow)" : undefined}
                  />
                ) : null}
                {r.marks.map((k) => (
                  <g key={k.key}>
                    <Mark kind={k.kind} cx={x(k.value)} cy={cy} />
                    <title>{k.title}</title>
                  </g>
                ))}
                {r.right ? (
                  <text
                    x={W - 8}
                    y={cy}
                    dy="0.35em"
                    textAnchor="end"
                    className={`text-small tabular ${r.rightStrong ? "fill-[var(--ink)] font-semibold" : "fill-[var(--ink-subtle)]"}`}
                  >
                    {r.right}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      ) : (
        <div style={{ height: H }} />
      )}
      <DotLegend items={legend} />
    </div>
  );
}
