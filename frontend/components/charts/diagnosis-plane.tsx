"use client";

import * as React from "react";
import type { Breaks, Component, Diagnosis, DiagnosisSummary, IndicatorResult } from "@/lib/types";
import { componentStyleMap } from "@/lib/encodings";
import { fmtIndex, fmtPct } from "@/lib/format";
import { useSize } from "@/lib/use-size";
import { markerPath, MarkerGlyph } from "../marker";
import { TooltipCard } from "./chart-tooltip";

/**
 * Columns are coverage classes; height is the performance gap; the bottom
 * strip holds indicators at or near benchmark. Position within a column
 * carries no information. Marker shape + tint = component; a centre dot marks
 * an imputed gap.
 */
export function DiagnosisPlane({
  indicators,
  components,
  breaks,
  summary,
  onSelect,
  height = 460,
}: {
  indicators: IndicatorResult[];
  components: Component[];
  breaks: Breaks;
  summary: DiagnosisSummary[];
  onSelect?: (code: string) => void;
  height?: number;
}) {
  const [ref, { width }] = useSize<HTMLDivElement>();
  const [hover, setHover] = React.useState<{ ind: IndicatorResult; x: number; y: number } | null>(null);
  const styles = React.useMemo(() => componentStyleMap(components.map((c) => c.id)), [components]);
  const compName = React.useMemo(() => Object.fromEntries(components.map((c) => [c.id, c.name])), [components]);

  const b1 = breaks.indicator[0] ?? 0.17;
  const [c1, c2] = [breaks.coverage[0] ?? 0.16, breaks.coverage[1] ?? 0.48];
  const sum = React.useMemo(() => Object.fromEntries(summary.map((s) => [s.diagnosis, s])) as Partial<Record<Diagnosis, DiagnosisSummary>>, [summary]);

  const colOf = (cov: number) => (cov <= c1 ? 0 : cov <= c2 ? 1 : 2);
  const cols = [0, 1, 2].map((k) => indicators.filter((d) => colOf(d.coverage) === k));
  // column widths proportional to the number of markers, with a floor
  const raw = cols.map((c) => Math.max(c.length, 3));
  const tot = raw.reduce((a, b) => a + b, 0);

  const m = { top: 50, right: 12, bottom: 34, left: 46 };
  const W = Math.max(width, 280);
  const iw = W - m.left - m.right;
  const ih = height - m.top - m.bottom;
  // each column keeps room for its three-line header; the rest is shared in proportion to the markers
  const minCol = Math.min(108, iw / 3);
  const prop = raw.map((r) => (r / tot) * iw);
  const small = prop.map((w) => w < minCol);
  const freeW = iw - minCol * small.filter(Boolean).length;
  const bigTot = prop.reduce((a, w, i) => (small[i] ? a : a + w), 0) || 1;
  const colW = prop.map((w, i) => (small[i] ? minCol : (w / bigTot) * freeW));
  const colX = colW.map((_, i) => m.left + colW.slice(0, i).reduce((a, b) => a + b, 0));
  const y = (g: number) => m.top + (1 - g) * ih;
  const r = W < 560 ? 5 : 6.5;

  // deterministic placement: within each column, order by component then code,
  // spread evenly; at-benchmark markers occupy their own row within the strip.
  const placed = React.useMemo(() => {
    const out: { ind: IndicatorResult; x: number; y: number }[] = [];
    cols.forEach((list, k) => {
      const order = (a: IndicatorResult, b: IndicatorResult) =>
        (styles[a.component]?.index ?? 99) - (styles[b.component]?.index ?? 99) || a.code.localeCompare(b.code);
      const above = list.filter((d) => d.diagnosis !== "at_benchmark").sort(order);
      const below = list.filter((d) => d.diagnosis === "at_benchmark").sort(order);
      const pad = Math.min(18, colW[k] * 0.12);
      const span = colW[k] - 2 * pad;
      [above, below].forEach((grp) => {
        grp.forEach((d, i) => {
          const x = colX[k] + pad + ((i + 0.5) / Math.max(grp.length, 1)) * span;
          out.push({ ind: d, x, y: y(Math.max(0, Math.min(1, d.gap))) });
        });
      });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators, W, height, styles, c1, c2]);

  const header = (k: number): { dx: Diagnosis; title: string; range: string } =>
    k === 0
      ? { dx: "unfunded_gap", title: "Unfunded gap", range: "Low coverage" }
      : k === 1
        ? { dx: "partially_funded_gap", title: "Partially funded", range: "Medium coverage" }
        : { dx: "funded_gap", title: "Funded gap", range: "High coverage" };

  const ticks = [0, 0.2, 0.4, 0.6, 0.8, 1];
  const atb = sum.at_benchmark;

  return (
    <div className="relative min-w-0">
      <div ref={ref} className="w-full min-w-0 overflow-hidden">
        {width > 0 ? (
          <svg width={W} height={height} role="img" aria-label="Diagnosis plane: performance gap against financing coverage class for each assessed indicator">
            {/* column shading */}
            {[0, 1, 2].map((k) => (
              <rect
                key={k}
                x={colX[k]}
                y={m.top}
                width={colW[k]}
                height={ih}
                fill={k === 0 ? "transparent" : k === 1 ? "var(--ink-4)" : "var(--ink-8)"}
              />
            ))}
            {/* at-benchmark strip */}
            <rect x={m.left} y={y(b1)} width={iw} height={y(0) - y(b1)} fill="var(--ink-10)" opacity={0.75} />
            <line x1={m.left} x2={m.left + iw} y1={y(b1)} y2={y(b1)} stroke="var(--line-strong)" strokeDasharray="3 3" />
            {/* gridlines + axis */}
            {ticks.map((t) => (
              <g key={t}>
                <line x1={m.left} x2={m.left + iw} y1={y(t)} y2={y(t)} stroke="var(--line)" />
                <text x={m.left - 10} y={y(t)} dy="0.32em" textAnchor="end" className="fill-[var(--ink-subtle)] text-[12px] tabular">
                  {t.toFixed(1)}
                </text>
              </g>
            ))}
            <text
              transform={`translate(12 ${m.top + ih / 2}) rotate(-90)`}
              textAnchor="middle"
              className="fill-[var(--ink-subtle)] text-[12px]"
            >
              Performance gap
            </text>
            {/* column separators */}
            {[1, 2].map((k) => (
              <line key={k} x1={colX[k]} x2={colX[k]} y1={m.top - 46} y2={m.top + ih} stroke="var(--line-strong)" />
            ))}
            {/* column headers */}
            {[0, 1, 2].map((k) => {
              const h = header(k);
              const s = sum[h.dx];
              const cx = colX[k] + colW[k] / 2;
              const narrow = colW[k] < 130;
              return (
                <g key={k}>
                  <text x={cx} y={14} textAnchor="middle" className="fill-[var(--ink)] text-[13px] font-semibold">
                    {narrow ? h.title.split(" ")[0] : h.title}
                  </text>
                  {s ? (
                    <text
                      x={cx}
                      y={32}
                      textAnchor="middle"
                      className={k === 0 ? "fill-[var(--alert)] text-[12px] font-semibold tabular" : "fill-[var(--ink-subtle)] text-[12px] tabular"}
                    >
                      {s.count} {narrow ? "ind." : s.count === 1 ? "indicator" : "indicators"}
                    </text>
                  ) : null}
                  <text x={cx} y={height - 12} textAnchor="middle" className="fill-[var(--ink-subtle)] text-[12px] tabular">
                    {h.range}
                  </text>
                </g>
              );
            })}
            {atb ? (
              <text x={m.left + iw - 8} y={y(b1) + 14} textAnchor="end" className="fill-[var(--ink-subtle)] text-[12px] tabular">
                At or near benchmark · {atb.count}
              </text>
            ) : null}
            {/* markers */}
            {placed.map(({ ind, x, y: py }) => {
              const st = styles[ind.component];
              const active = hover?.ind.code === ind.code;
              return (
                <g
                  key={ind.code}
                  opacity={hover && !active ? 0.45 : 1}
                  style={{ cursor: onSelect ? "pointer" : "default" }}
                  onMouseEnter={() => setHover({ ind, x, y: py })}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => onSelect?.(ind.code)}
                  tabIndex={0}
                  role="button"
                  aria-label={`${ind.name}: gap ${fmtIndex(ind.gap)}, coverage ${fmtIndex(ind.coverage)}${ind.imputed ? ", imputed" : ""}`}
                  onFocus={() => setHover({ ind, x, y: py })}
                  onBlur={() => setHover(null)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onSelect?.(ind.code);
                  }}
                >
                  <g transform={`translate(${x} ${py})`}>
                    {active ? <circle r={r + 6} fill="none" stroke="var(--evergreen)" strokeWidth={2} /> : null}
                    <path
                      d={markerPath(st?.shape ?? "circle", r)}
                      fill={st?.fill ?? "var(--ink)"}
                      stroke="var(--ink)"
                      strokeWidth={1}
                      strokeLinejoin="round"
                    />
                    {ind.imputed ? <circle r={r * 0.34} fill="var(--canvas)" stroke="var(--ink)" strokeWidth={0.75} /> : null}
                  </g>
                </g>
              );
            })}
          </svg>
        ) : (
          <div style={{ height }} />
        )}
      </div>

      {hover ? (
        <div
          className="pointer-events-none absolute z-10"
          style={{
            left: Math.min(Math.max(hover.x + 14, 0), W - 250),
            top: Math.max(hover.y - 40, 0),
          }}
        >
          <TooltipCard
            title={hover.ind.name}
            rows={[
              { label: "Code", value: <span className="font-mono">{hover.ind.code}</span> },
              { label: "Component", value: compName[hover.ind.component] ?? hover.ind.component },
              { label: "Gap", value: fmtIndex(hover.ind.gap) },
              { label: "Coverage", value: fmtIndex(hover.ind.coverage) },
              { label: "Budget share", value: fmtPct(hover.ind.share, 1) },
              { label: "Stress", value: fmtIndex(hover.ind.stress), strong: true },
            ]}
            footer={hover.ind.imputed ? "Imputed gap" : undefined}
          />
        </div>
      ) : null}

      {/* legend */}
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-4">
        {components.map((c) => {
          const st = styles[c.id];
          return (
            <span key={c.id} className="inline-flex items-center gap-1.5 text-[12px] text-ink-muted">
              <MarkerGlyph shape={st.shape} fill={st.fill} size={13} />
              {c.name}
            </span>
          );
        })}
        <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-muted">
          <MarkerGlyph shape="circle" fill="var(--ink-40)" size={13} imputed />
          Imputed
        </span>
      </div>
    </div>
  );
}
