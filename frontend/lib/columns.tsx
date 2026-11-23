import * as React from "react";
import type { ColumnSpec } from "./csv";
import type { ComponentResult, IndicatorResult } from "./types";
import { diagnosisLabel } from "./encodings";
import { DiagnosisBadge } from "@/components/ui/badge";

const pct1 = (v: number) => v.toFixed(1);
const idx = (v: number) => v.toFixed(2);

/** Component results: one definition shared by the overview table and every component figure. */
export const componentColumns: ColumnSpec<ComponentResult>[] = [
  { key: "name", header: "Component", value: (r) => r.name },
  { key: "weight", header: "Weight", short: "Weight %", unit: "%", numeric: true, value: (r) => +(r.weight * 100).toFixed(1), format: pct1 },
  { key: "share", header: "Budget share", short: "Budget %", unit: "%", numeric: true, value: (r) => +(r.share * 100).toFixed(1), format: pct1 },
  { key: "stress", header: "Stress", unit: "0–1", short: "Stress", numeric: true, value: (r) => +r.stress.toFixed(3), format: idx },
  { key: "acc", header: "Accumulated stress", unit: "0–1", short: "Accum.", numeric: true, value: (r) => +r.acc_stress.toFixed(3), format: idx },
  { key: "gap", header: "Mean gap", unit: "0–1", short: "Gap", numeric: true, value: (r) => +r.mean_gap.toFixed(3), format: idx },
  { key: "cov", header: "Coverage", unit: "0–1", short: "Coverage", numeric: true, value: (r) => +r.coverage.toFixed(3), format: idx },
  { key: "dx", header: "Diagnosis", value: (r) => diagnosisLabel[r.diagnosis], cell: (r) => <DiagnosisBadge dx={r.diagnosis} /> },
  { key: "opt", header: "Optimal share", unit: "%", short: "Optimal %", numeric: true, value: (r) => +(r.optimal_share * 100).toFixed(1), format: pct1 },
  { key: "shift", header: "Shift", unit: "pp", short: "Shift pp", numeric: true, value: (r) => +r.shift_pp.toFixed(1), format: (v) => (v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1).replace("-", "−")) },
  {
    key: "n",
    header: "Indicators (imputed)",
    short: "Ind.",
    numeric: true,
    value: (r) => r.n_indicators,
    cell: (r) => (
      <>
        {r.n_indicators}
        {r.n_imputed ? <span className="text-ink-subtle"> ({r.n_imputed})</span> : null}
      </>
    ),
  },
  { key: "imp", header: "Imputed", numeric: true, value: (r) => r.n_imputed },
];

/** On-screen component table: the imputed count is folded into the indicator column. */
export const componentTableColumns = componentColumns.filter((c) => c.key !== "imp");

export function indicatorColumns(compName: (id: string) => string): ColumnSpec<IndicatorResult>[] {
  return [
    { key: "code", header: "Code", value: (r) => r.code, className: "font-mono text-[13px]" },
    { key: "name", header: "Indicator", value: (r) => `${r.name}${r.imputed ? " (imputed)" : ""}` },
    { key: "component", header: "Component", value: (r) => compName(r.component) },
    { key: "gap", header: "Gap", unit: "0–1", short: "Gap", numeric: true, value: (r) => +r.gap.toFixed(3), format: idx },
    { key: "cov", header: "Coverage", unit: "0–1", short: "Coverage", numeric: true, value: (r) => +r.coverage.toFixed(3), format: idx },
    { key: "stress", header: "Stress", unit: "0–1", short: "Stress", numeric: true, value: (r) => +r.stress.toFixed(3), format: idx },
    { key: "share", header: "Budget share", unit: "%", short: "Budget %", numeric: true, value: (r) => +(r.share * 100).toFixed(2), format: (v) => v.toFixed(2) },
    { key: "dx", header: "Diagnosis", value: (r) => diagnosisLabel[r.diagnosis], cell: (r) => <DiagnosisBadge dx={r.diagnosis} /> },
  ];
}
