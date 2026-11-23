"use client";

import * as React from "react";
import type { Diagnosis, DiagnosisSummary } from "@/lib/types";
import { DIAGNOSES, diagnosisColor, diagnosisLabel, diagnosisOnColor, diagnosisShort } from "@/lib/encodings";
import { fmtPct } from "@/lib/format";
import { useSize } from "@/lib/use-size";

/**
 * Two 100% bars (budget share, stress share) by diagnosis label, joined by
 * ribbons so the reader can follow each label from money to stress.
 */
export function MoneyVsStress({ summary, height = 300 }: { summary: DiagnosisSummary[]; height?: number }) {
  const [ref, { width }] = useSize<HTMLDivElement>();
  const [hover, setHover] = React.useState<Diagnosis | null>(null);

  const byDx = Object.fromEntries(summary.map((s) => [s.diagnosis, s])) as Partial<Record<Diagnosis, DiagnosisSummary>>;
  const rows = DIAGNOSES.map((d) => byDx[d] ?? { diagnosis: d, count: 0, envelope_share: 0, stress_share: 0 });
  const envTot = rows.reduce((a, r) => a + r.envelope_share, 0) || 1;
  const strTot = rows.reduce((a, r) => a + r.stress_share, 0) || 1;

  const W = Math.max(width, 300);
  const left = 0;
  const iw = W - left;
  const barH = 46;
  const yTop = 26;
  const yBot = height - barH - 26;

  const cum = (k: "envelope_share" | "stress_share", i: number) => rows.slice(0, i).reduce((a, r) => a + r[k], 0);
  const segs = rows.map((r, i) => ({
    r,
    e0: (cum("envelope_share", i) / envTot) * iw,
    e1: (cum("envelope_share", i + 1) / envTot) * iw,
    s0: (cum("stress_share", i) / strTot) * iw,
    s1: (cum("stress_share", i + 1) / strTot) * iw,
  }));

  const ribbon = (a0: number, a1: number, b0: number, b1: number) => {
    const y0 = yTop + barH;
    const y1 = yBot;
    const my = (y0 + y1) / 2;
    return `M ${a0} ${y0} C ${a0} ${my}, ${b0} ${my}, ${b0} ${y1} L ${b1} ${y1} C ${b1} ${my}, ${a1} ${my}, ${a1} ${y0} Z`;
  };

  return (
    <div ref={ref} className="w-full">
      {width > 0 ? (
        <svg width={W} height={height} role="img" aria-label="Share of budget and share of stress by diagnosis label">
          <text x={0} y={14} className="fill-[var(--ink-muted)] text-[12px] font-semibold">
            Share of budget
          </text>
          <text x={0} y={height - 6} className="fill-[var(--ink-muted)] text-[12px] font-semibold">
            Share of stress
          </text>
          {segs.map(({ r, e0, e1, s0, s1 }) => {
            const dim = hover && hover !== r.diagnosis;
            const fill = diagnosisColor[r.diagnosis];
            return (
              <g
                key={r.diagnosis}
                onMouseEnter={() => setHover(r.diagnosis)}
                onMouseLeave={() => setHover(null)}
                opacity={dim ? 0.35 : 1}
              >
                <path d={ribbon(e0, e1, s0, s1)} fill={fill} opacity={r.diagnosis === "unfunded_gap" ? 0.38 : 0.2} />
                <rect x={e0} y={yTop} width={Math.max(0, e1 - e0 - 1.5)} height={barH} fill={fill} />
                <rect x={s0} y={yBot} width={Math.max(0, s1 - s0 - 1.5)} height={barH} fill={fill} />
                {e1 - e0 > 46 ? (
                  <text x={e0 + 10} y={yTop + barH / 2} dy="0.35em" fill={diagnosisOnColor[r.diagnosis]} className="display-num text-[19px] font-semibold">
                    {fmtPct(r.envelope_share)}
                  </text>
                ) : null}
                {s1 - s0 > 46 ? (
                  <text x={s0 + 10} y={yBot + barH / 2} dy="0.35em" fill={diagnosisOnColor[r.diagnosis]} className="display-num text-[19px] font-semibold">
                    {fmtPct(r.stress_share)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      ) : (
        <div style={{ height }} />
      )}
      <div className={`mt-4 grid gap-x-6 gap-y-2.5 ${W < 560 ? "grid-cols-2" : "grid-cols-4"}`}>
        {rows.map((r) => (
          <button
            key={r.diagnosis}
            type="button"
            onMouseEnter={() => setHover(r.diagnosis)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(r.diagnosis)}
            onBlur={() => setHover(null)}
            className="flex items-start gap-2 rounded-md text-left"
          >
            <span
              className="mt-1 size-3 shrink-0 rounded-[1px]"
              style={{ background: diagnosisColor[r.diagnosis] }}
              aria-hidden
            />
            <span className="text-[12px] leading-snug">
              <span className="block font-medium text-ink">{diagnosisShort[r.diagnosis]}</span>
              <span className="block text-ink-muted tabular">
                {r.count} ind. · {fmtPct(r.envelope_share)} → {fmtPct(r.stress_share)}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function MoneyVsStressTable({ summary }: { summary: DiagnosisSummary[] }) {
  return (
    <table className="w-full text-sm tabular">
      <thead>
        <tr className="text-left text-[12px] text-ink-muted">
          <th className="border-b border-line-strong py-2 font-semibold">Label</th>
          <th className="border-b border-line-strong py-2 text-right font-semibold">Indicators</th>
          <th className="border-b border-line-strong py-2 text-right font-semibold">Budget</th>
          <th className="border-b border-line-strong py-2 text-right font-semibold">Stress</th>
        </tr>
      </thead>
      <tbody>
        {DIAGNOSES.map((d) => {
          const r = summary.find((s) => s.diagnosis === d);
          return (
            <tr key={d}>
              <td className="border-b border-line py-2">{diagnosisLabel[d]}</td>
              <td className="border-b border-line py-2 text-right">{r?.count ?? 0}</td>
              <td className="border-b border-line py-2 text-right">{fmtPct(r?.envelope_share ?? 0, 1)}</td>
              <td className="border-b border-line py-2 text-right">{fmtPct(r?.stress_share ?? 0, 1)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}