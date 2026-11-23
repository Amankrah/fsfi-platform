"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAllYearAssessments, useAssessment } from "@/lib/api";
import { useUrlParam } from "@/lib/use-controls";
import { useCountryCtx } from "@/components/shell/country-context";
import { ErrorState, PageSkeleton, ChartSkeleton, EmptyState } from "@/components/states";
import { DataTable } from "@/components/data-table";
import type { ColumnSpec } from "@/lib/csv";
import { Input, Switch } from "@/components/ui/misc";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { DiagnosisBadge, StressBadge, Badge } from "@/components/ui/badge";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { MarkerGlyph } from "@/components/marker";
import { TooltipCard } from "@/components/charts/chart-tooltip";
import { LegendItem } from "@/components/charts/figure";
import { axisProps, gridProps, yAxisProps, type TipProps } from "@/components/charts/rc";
import { componentStyleMap, DIAGNOSES, diagnosisLabel } from "@/lib/encodings";
import { fmtIndex, fmtMoney, fmtNum, fmtPct } from "@/lib/format";
import type { IndicatorResult } from "@/lib/types";

export default function IndicatorsPage() {
  const { id, profile, controls, componentName, year } = useCountryCtx();
  const { data: a, error, mutate } = useAssessment(id, controls);
  const [code, setCode] = useUrlParam("code");
  const [q, setQ] = React.useState("");
  const [comp, setComp] = React.useState("all");
  const [dx, setDx] = React.useState("all");
  const [onlyImputed, setOnlyImputed] = React.useState(false);
  const styles = React.useMemo(() => componentStyleMap(profile.components.map((c) => c.id)), [profile]);

  const rows = React.useMemo(() => {
    if (!a) return [];
    const needle = q.trim().toLowerCase();
    return a.indicators
      .filter((d) => comp === "all" || d.component === comp)
      .filter((d) => dx === "all" || d.diagnosis === dx)
      .filter((d) => !onlyImputed || d.imputed)
      .filter((d) => !needle || d.name.toLowerCase().includes(needle) || d.code.toLowerCase().includes(needle));
  }, [a, q, comp, dx, onlyImputed]);

  const columns = React.useMemo<ColumnSpec<IndicatorResult>[]>(
    () => [
      { key: "code", header: "Code", value: (d) => d.code, className: "whitespace-nowrap font-mono text-small" },
      {
        key: "name",
        header: "Indicator",
        value: (d) => d.name,
        cell: (d) => {
          const st = styles[d.component];
          return (
            <span className="block min-w-[200px] max-w-[320px]">
              <span className="flex items-center gap-2">
                {st ? <MarkerGlyph shape={st.shape} fill={st.fill} size={12} imputed={d.imputed} /> : null}
                <button type="button" className="truncate text-left text-green-700 underline-offset-2 hover:underline" onClick={() => setCode(d.code)}>
                  {d.name}
                </button>
              </span>
              <span className="ml-5 block t-caption text-ink-subtle">
                {componentName(d.component)} · {d.direction === "higher" ? "higher is better" : "lower is better"}
                {d.imputed ? " · imputed" : ""}
              </span>
            </span>
          );
        },
      },
      { key: "gap", header: "Gap", unit: "0–1", short: "Gap", numeric: true, value: (d) => +d.gap.toFixed(3), format: (v) => v.toFixed(2) },
      { key: "share", header: "Budget share", unit: "%", short: "Budget %", numeric: true, value: (d) => +(d.share * 100).toFixed(2), format: (v) => v.toFixed(1) },
      { key: "stress", header: "Stress", unit: "0–1", short: "Stress", numeric: true, value: (d) => +d.stress.toFixed(3), format: (v) => v.toFixed(2) },
      { key: "acc", header: "Accumulated stress", unit: "0–1", short: "Accum.", numeric: true, value: (d) => +d.acc_stress.toFixed(3), format: (v) => v.toFixed(2) },
      { key: "coverage", header: "Coverage", unit: "0–1", short: "Coverage", numeric: true, value: (d) => +d.coverage.toFixed(3), format: (v) => v.toFixed(2) },
      { key: "weight", header: "Weight", numeric: true, value: (d) => +d.weight.toFixed(4), format: (v) => v.toFixed(3) },
      { key: "dx", header: "Diagnosis", value: (d) => diagnosisLabel[d.diagnosis], cell: (d) => <DiagnosisBadge dx={d.diagnosis} /> },
    ],
    [styles, componentName, setCode],
  );

  if (error) return <ErrorState error={error} onRetry={() => void mutate()} />;
  if (!a) return <PageSkeleton />;

  const selected = a.indicators.find((d) => d.code === code) ?? null;
  const nImp = a.indicators.filter((d) => d.imputed).length;

  return (
    <div className="space-y-6">
      <div className="border-b border-rule pb-4" role="group" aria-label="Filters">
        <div className="flex flex-wrap items-center gap-3">
          <span className="whitespace-nowrap pr-1 text-small text-muted tabular">
            {a.indicators.length} indicators{nImp ? ` · ${nImp} imputed` : ""}
          </span>
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-55" strokeWidth={1.5} />
            <Input placeholder="Search code or name" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" aria-label="Search indicators" />
          </div>
          <Select
            label="Component"
            value={comp}
            onValueChange={setComp}
            options={[{ value: "all", label: "All" }, ...profile.components.map((c) => ({ value: c.id, label: c.name }))]}
            className="min-w-[200px]"
          />
          <Select
            label="Diagnosis"
            value={dx}
            onValueChange={setDx}
            options={[{ value: "all", label: "All" }, ...DIAGNOSES.map((d) => ({ value: d, label: diagnosisLabel[d] }))]}
            className="min-w-[210px]"
          />
          <Switch checked={onlyImputed} onCheckedChange={setOnlyImputed} label="Imputed only" />
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No indicators match these filters">
          Clear the search term, set Component and Diagnosis back to All, or turn off Imputed only.
        </EmptyState>
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          caption={`Assessed indicators, ${profile.name}, ${year}. Select a row to open the indicator.`}
          filename={`${id}-${year}-indicators`}
          initialSort={{ key: "stress", desc: true }}
          rowKey={(d) => d.code}
          onRowClick={(d) => setCode(d.code)}
        />
      )}

      <Sheet
        open={!!selected}
        onOpenChange={(o) => !o && setCode("")}
        title={selected?.name ?? ""}
        description={selected ? `${selected.code} · ${componentName(selected.component)}` : undefined}
      >
        {selected ? <IndicatorDrawer ind={selected} /> : null}
      </Sheet>
    </div>
  );
}

function IndicatorDrawer({ ind }: { ind: IndicatorResult }) {
  const { id, profile, controls, year } = useCountryCtx();
  const years = profile.years.map((y) => y.year);
  const { data: all } = useAllYearAssessments(id, years, controls);
  const meta = profile.indicators.find((i) => i.code === ind.code);

  const series = years.map((y, i) => {
    const r = all?.[i]?.indicators.find((d) => d.code === ind.code);
    const raw = profile.years[i]?.indicators[ind.code];
    return {
      year: y,
      gap: r?.gap ?? null,
      stress: r?.stress ?? null,
      acc: r?.acc_stress ?? null,
      coverage: r?.coverage ?? null,
      observed: raw?.observed ?? null,
      benchmark: raw?.benchmark ?? null,
      allocation: raw?.allocation ?? null,
      assessed: !!r,
      imputed: r?.imputed ?? false,
    };
  });

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap gap-2">
        <DiagnosisBadge dx={ind.diagnosis} />
        <StressBadge cls={ind.stress_class} />
        {ind.imputed ? <Badge tone="accent">Imputed gap</Badge> : <Badge>Measured gap</Badge>}
        <Badge tone="outline">{ind.direction === "higher" ? "Higher is better" : "Lower is better"}</Badge>
        {meta?.unit ? <Badge tone="outline">{meta.unit}</Badge> : null}
      </div>

      <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line">
        {[
          ["Gap", fmtIndex(ind.gap)],
          ["Coverage", fmtIndex(ind.coverage)],
          ["Stress", fmtIndex(ind.stress)],
          ["Accumulated", fmtIndex(ind.acc_stress)],
          ["Budget share", fmtPct(ind.share, 1)],
          ["Optimal share", fmtPct(ind.optimal_share, 1)],
        ].map(([k, v]) => (
          <div key={k} className="bg-canvas px-4 py-3">
            <dt className="text-micro text-muted">{k}</dt>
            <dd className="display-num text-[1.5rem]">{v}</dd>
          </div>
        ))}
      </dl>

      <div>
        <div className="eyebrow mb-3">Over time</div>
        {all ? (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="year" {...axisProps} />
                <YAxis domain={[0, 1]} {...yAxisProps} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={(v: number) => v.toFixed(2)} />
                <Tooltip
                  content={(p: TipProps<(typeof series)[number]>) => {
                    const d = p.active ? p.payload?.[0]?.payload : undefined;
                    if (!d) return null;
                    return (
                      <TooltipCard
                        title={d.year}
                        rows={
                          d.assessed
                            ? [
                                { label: "Gap", value: fmtIndex(d.gap) },
                                { label: "Stress", value: fmtIndex(d.stress), strong: true },
                                { label: "Accumulated", value: fmtIndex(d.acc) },
                                { label: "Coverage", value: fmtIndex(d.coverage) },
                              ]
                            : [{ label: "Status", value: "not assessed" }]
                        }
                      />
                    );
                  }}
                />
                <Line dataKey="gap" stroke="var(--ink-40)" strokeWidth={1.5} strokeDasharray="2 3" dot={false} connectNulls />
                <Line dataKey="acc" stroke="var(--ink-55)" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
                <Line dataKey="stress" stroke="var(--ink)" strokeWidth={2.4} dot={{ r: 3.5, fill: "var(--ink)" }} activeDot={{ r: 5, fill: "var(--saffron)" }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-2 flex flex-wrap gap-4">
              <LegendItem label="Stress" />
              <LegendItem label="Accumulated" color="var(--ink-55)" dashed />
              <LegendItem label="Gap" color="var(--ink-40)" dotted />
            </div>
          </>
        ) : (
          <ChartSkeleton height={220} />
        )}
      </div>

      <div>
        <div className="eyebrow mb-2">Inputs</div>
        <Table>
          <thead>
            <tr>
              <Th>Year</Th>
              <Th className="text-right">Observed</Th>
              <Th className="text-right">Benchmark</Th>
              <Th className="text-right">Allocation ({profile.currency})</Th>
            </tr>
          </thead>
          <tbody>
            {series.map((s) => (
              <Tr key={s.year} className={s.year === year ? "bg-saffron-12" : undefined}>
                <Td>{s.year}</Td>
                <Td className="text-right">{s.observed === null ? <span className="text-muted">imputed</span> : fmtNum(s.observed, 2)}</Td>
                <Td className="text-right">{s.benchmark === null ? "n/a" : fmtNum(s.benchmark, 2)}</Td>
                <Td className="text-right">{fmtMoney(s.allocation)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
