"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useWeights } from "@/lib/api";
import { useCountryCtx } from "@/components/shell/country-context";
import { Figure, LegendItem } from "@/components/charts/figure";
import { Heatmap } from "@/components/charts/heatmap";
import { TooltipCard } from "@/components/charts/chart-tooltip";
import { axisProps, gridProps, yAxisProps, type TipProps } from "@/components/charts/rc";
import { ErrorState, PageSkeleton } from "@/components/states";
import { Kpi, KpiRow } from "@/components/kpi";
import type { ColumnSpec } from "@/lib/csv";
import { Segmented } from "@/components/ui/segmented";
import { fmtPct, scenarioLabel } from "@/lib/format";
import type { WeightsReport } from "@/lib/types";

const VECTORS: { key: keyof WeightsReport["vectors"]; label: string; color: string }[] = [
  { key: "ahp", label: "Expert", color: "var(--neutral-mark)" },
  { key: "pagerank", label: "Network", color: "var(--steel)" },
  { key: "cascade", label: "Cascade", color: "var(--green-700)" },
  { key: "financial", label: "Budget share", color: "var(--saffron-mark)" },
  { key: "hybrid", label: "Hybrid", color: "var(--evergreen)" },
];

export default function WeightsPage() {
  const { id, profile, controls, componentName, year } = useCountryCtx();
  const { data: w, error, mutate } = useWeights(id, controls);
  const [focus, setFocus] = React.useState<keyof WeightsReport["vectors"] | "all">("all");

  if (error) return <ErrorState error={error} onRetry={() => void mutate()} />;
  if (!w) return <PageSkeleton />;

  const names = w.components.map((c) => componentName(c));
  const short = w.components.map((c) => profile.components.find((p) => p.id === c)?.short ?? componentName(c));
  const data = w.components.map((c, i) => {
    const row: Record<string, number | string> = { id: c, name: names[i], short: short[i] };
    VECTORS.forEach((v) => (row[v.key] = w.vectors[v.key][i]));
    return row;
  });
  const shown = focus === "all" ? VECTORS : VECTORS.filter((v) => v.key === focus || v.key === "hybrid");
  const crOk = w.ahp_cr < 0.1;
  const wMax = Math.ceil(Math.max(...VECTORS.flatMap((v) => w.vectors[v.key])) * 20) / 20;
  const wTicks = Array.from({ length: Math.round(wMax / 0.05) + 1 }, (_, i) => +(i * 0.05).toFixed(2));
  const wColumns: ColumnSpec<Record<string, number | string>>[] = [
    { key: "name", header: "Component", value: (r) => String(r.name) },
    ...VECTORS.map((v) => ({
      key: v.key,
      header: v.label,
      unit: "%",
      numeric: true,
      value: (r: Record<string, number | string>) => +(Number(r[v.key]) * 100).toFixed(2),
      format: (x: number) => x.toFixed(1),
    })),
  ];
  type DepRow = { from: string } & Record<string, string | number | null>;
  const depRows: DepRow[] = names.map((n, i) => {
    const r: DepRow = { from: n };
    names.forEach((m, j) => (r[m] = i === j ? null : +w.dependency_matrix[i][j].toFixed(3)));
    return r;
  });
  const depColumns: ColumnSpec<DepRow>[] = [
    { key: "from", header: "From", value: (r) => String(r.from) },
    ...names.map((m) => ({ key: m, header: `To ${m}`, numeric: true, value: (r: DepRow) => r[m] as number | null, format: (x: number) => x.toFixed(2) })),
  ];
  const top = Math.max(...w.vectors.hybrid);

  return (
    <div className="space-y-8">
      <KpiRow>
        <Kpi
          label="Expert consistency ratio"
          year={year}
          value={w.ahp_cr}
          format={(v) => v.toFixed(3)}
          sub={crOk ? <>Consistent (below 0.10)</> : <>Above 0.10: revise the pairwise comparisons</>}
          hint="Consistency of the expert pairwise judgements."
        />
        <Kpi label="Largest hybrid weight" year={year} value={top * 100} format={(v) => v.toFixed(1)} unit="%" sub={<>{names[w.vectors.hybrid.indexOf(top)]}</>} />
        <Kpi label="Dependency scenario" year={year}>
          <span className="display-num text-[1.25rem] leading-8 text-evergreen">{scenarioLabel(w.scenario)}</span>
        </Kpi>
      </KpiRow>

      <Figure
        title={`${names[w.vectors.hybrid.indexOf(top)]} receives the largest hybrid weight, ${fmtPct(top, 1)}`}
        subtitle={`Component weight under each view and the hybrid blend (%), ${year}, ${scenarioLabel(w.scenario)}`}
        actions={
          <Segmented
            label="Focus vector"
            size="sm"
            value={focus}
            onValueChange={setFocus}
            options={[{ value: "all", label: "All" }, ...VECTORS.filter((v) => v.key !== "hybrid").map((v) => ({ value: v.key, label: v.label }))]}
          />
        }
        data={{ columns: wColumns, rows: data, filename: "component-weights" }}
      >
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="18%" barGap={2}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="short" {...axisProps} interval={0} />
            <YAxis {...yAxisProps} domain={[0, wMax]} ticks={wTicks} tickFormatter={(v: number) => fmtPct(v)} />
            <Tooltip
              cursor={{ fill: "var(--ink-4)" }}
              content={(p: TipProps<Record<string, number | string>>) => {
                const d = p.active ? p.payload?.[0]?.payload : undefined;
                if (!d) return null;
                return (
                  <TooltipCard
                    title={String(d.name)}
                    rows={VECTORS.map((v) => ({
                      label: v.label,
                      value: fmtPct(Number(d[v.key]), 1),
                      strong: v.key === "hybrid",
                    }))}
                  />
                );
              }}
            />
            {shown.map((v) => (
              <Bar key={v.key} dataKey={v.key} name={v.label} fill={v.color} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-3 flex flex-wrap gap-5">
          {VECTORS.map((v) => (
            <LegendItem key={v.key} marker={<span className="size-3" style={{ background: v.color }} />} label={v.label} />
          ))}
        </div>
      </Figure>

      <Figure
        title="How strongly each component depends on the others"
        subtitle={`Dependency of the column component on the row component (0–1), ${scenarioLabel(w.scenario)}`}
        data={{ columns: depColumns, rows: depRows, filename: "dependency-matrix" }}
      >
        <Heatmap
          rows={names}
          cols={short}
          values={w.dependency_matrix}
          max={1}
          rowHeader="From ↓ / to →"
          diagonalBlank
          caption="Dependency matrix"
          cellTitle={(r, c, v) => `${names[r]} → ${names[c]}: ${v === null ? "n/a" : v.toFixed(2)}`}
        />
      </Figure>
    </div>
  );
}
