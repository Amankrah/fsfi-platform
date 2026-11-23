"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DiagnosisSummary } from "@/lib/types";
import { DIAGNOSES, diagnosisLabel } from "@/lib/encodings";
import { fmtPct } from "@/lib/format";
import type { ColumnSpec } from "@/lib/csv";
import { TooltipCard } from "./chart-tooltip";
import { LegendItem } from "./figure";
import { axisProps, type TipProps } from "./rc";

export interface DxRow {
  label: string;
  count: number;
  budget: number;
  stress: number;
}

export function diagnosisRows(summary: DiagnosisSummary[]): DxRow[] {
  return DIAGNOSES.map((d) => {
    const s = summary.find((x) => x.diagnosis === d);
    return { label: diagnosisLabel[d], count: s?.count ?? 0, budget: s?.envelope_share ?? 0, stress: s?.stress_share ?? 0 };
  }).sort((a, b) => b.stress - a.stress);
}

export const diagnosisColumns: ColumnSpec<DxRow>[] = [
  { key: "label", header: "Diagnosis", value: (r) => r.label },
  { key: "count", header: "Indicators", numeric: true, value: (r) => r.count },
  { key: "budget", header: "Share of budget", unit: "%", numeric: true, value: (r) => +(r.budget * 100).toFixed(1), format: (v) => v.toFixed(1) },
  { key: "stress", header: "Share of stress", unit: "%", numeric: true, value: (r) => +(r.stress * 100).toFixed(1), format: (v) => v.toFixed(1) },
];

const BUDGET = "var(--green-500)";
const STRESS = "var(--evergreen)";

/** Paired horizontal bars, sorted by share of stress: where the money sits against where the stress sits. */
export function DiagnosisBars({ rows, height = 300 }: { rows: DxRow[]; height?: number }) {
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-5">
        <LegendItem marker={<span className="size-3" style={{ background: BUDGET }} />} label="Share of budget" />
        <LegendItem marker={<span className="size-3" style={{ background: STRESS }} />} label="Share of stress" />
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 48, bottom: 4, left: 4 }} barCategoryGap="22%" barGap={2} accessibilityLayer>
          <CartesianGrid stroke="var(--rule)" horizontal={false} />
          <XAxis type="number" domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={(v: number) => fmtPct(v)} {...axisProps} />
          <YAxis type="category" dataKey="label" width={150} tickLine={false} axisLine={{ stroke: "var(--rule-strong)" }} tick={{ fill: "var(--ink)", fontSize: 13 }} />
          <Tooltip
            cursor={{ fill: "var(--ink-4)" }}
            content={(p: TipProps<DxRow>) => {
              const d = p.active ? p.payload?.[0]?.payload : undefined;
              if (!d) return null;
              return (
                <TooltipCard
                  title={d.label}
                  rows={[
                    { label: "Indicators", value: d.count },
                    { label: "Share of budget", value: fmtPct(d.budget, 1), color: BUDGET },
                    { label: "Share of stress", value: fmtPct(d.stress, 1), color: STRESS, strong: true },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="budget" name="Share of budget" fill={BUDGET} isAnimationActive={false}>
            <LabelList dataKey="budget" position="right" formatter={(v: unknown) => fmtPct(Number(v))} style={{ fill: "var(--ink-muted)", fontSize: 12 }} />
          </Bar>
          <Bar dataKey="stress" name="Share of stress" fill={STRESS} isAnimationActive={false}>
            <LabelList dataKey="stress" position="right" formatter={(v: unknown) => fmtPct(Number(v))} style={{ fill: "var(--ink)", fontSize: 12, fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
