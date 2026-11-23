"use client";

import * as React from "react";
import { useAssessment, useTimeSeries } from "@/lib/api";
import { useCountryCtx } from "@/components/shell/country-context";
import { Figure } from "@/components/charts/figure";
import {
  DiagnosisByYearChart,
  EfficiencyRecordChart,
  EnvelopeIndexChart,
  IndexRecordChart,
  UnfundedTrend,
} from "@/components/charts/record-charts";
import { Heatmap } from "@/components/charts/heatmap";
import { CalibrateCard } from "@/components/calibrate-card";
import { ErrorState, PageSkeleton } from "@/components/states";
import { Kpi, KpiRow } from "@/components/kpi";
import { Segmented } from "@/components/ui/segmented";
import { fmtIndex, fmtPct, fmtSigned } from "@/lib/format";
import type { ColumnSpec } from "@/lib/csv";
import type { TimeSeriesYear } from "@/lib/types";

const n3 = (v: number) => v.toFixed(3);

export default function RecordPage() {
  const { id, profile, controls } = useCountryCtx();
  const { data: ts, error, mutate } = useTimeSeries(id, controls);
  const { data: a } = useAssessment(id, { ...controls, year: undefined });
  const [heat, setHeat] = React.useState<"acc_stress" | "stress">("acc_stress");

  if (error) return <ErrorState error={error} onRetry={() => void mutate()} />;
  if (!ts) return <PageSkeleton />;

  const first = ts.years[0];
  const last = ts.years[ts.years.length - 1];
  const breaks = a?.meta.breaks ?? profile.breaks;
  const comps = profile.components;
  const years = ts.years.map((y) => y.year);
  const span = `${first.year}–${last.year}`;

  const seriesColumns: ColumnSpec<TimeSeriesYear>[] = [
    { key: "year", header: "Year", value: (y) => y.year },
    { key: "fsfsi", header: "Stress index", numeric: true, value: (y) => +y.fsfsi.toFixed(4), format: n3 },
    { key: "acc", header: "Accumulated", numeric: true, value: (y) => +y.fsfsi_acc.toFixed(4), format: n3 },
    { key: "eff", header: "Efficiency", numeric: true, value: (y) => +y.efficiency.toFixed(4), format: n3 },
    { key: "eff0", header: `Efficiency at ${first.year} budget`, numeric: true, value: (y) => +y.efficiency_fixed_t0.toFixed(4), format: n3 },
    { key: "env", header: "Budget index", unit: `${first.year} = 100`, numeric: true, value: (y) => +y.envelope_index.toFixed(1), format: (v) => v.toFixed(1) },
    { key: "n", header: "Assessed", numeric: true, value: (y) => y.n_assessed },
    { key: "imp", header: "Imputed", numeric: true, value: (y) => y.n_imputed },
  ];
  type HeatRow = { component: string } & Record<string, string | number | null>;
  const heatRows: HeatRow[] = comps.map((c) => {
    const r: HeatRow = { component: c.name };
    ts.years.forEach((y) => (r[y.year] = y.components[c.id]?.[heat] ?? null));
    return r;
  });
  const heatColumns: ColumnSpec<HeatRow>[] = [
    { key: "component", header: "Component", value: (r) => r.component },
    ...years.map((y) => ({
      key: y,
      header: y,
      numeric: true,
      value: (r: HeatRow) => (typeof r[y] === "number" ? +(r[y] as number).toFixed(3) : null),
      format: (v: number) => v.toFixed(2),
    })),
  ];
  type DxRow = { year: string; diagnosis: string; count: number; budget: number; stress: number };
  const dxRows: DxRow[] = ts.years.flatMap((y) =>
    y.diagnosis_summary.map((d) => ({ year: y.year, diagnosis: d.diagnosis.replace(/_/g, " "), count: d.count, budget: d.envelope_share, stress: d.stress_share })),
  );
  const dxColumns: ColumnSpec<DxRow>[] = [
    { key: "year", header: "Year", value: (r) => r.year },
    { key: "diagnosis", header: "Diagnosis", value: (r) => r.diagnosis },
    { key: "count", header: "Indicators", numeric: true, value: (r) => r.count },
    { key: "budget", header: "Share of budget", unit: "%", numeric: true, value: (r) => +(r.budget * 100).toFixed(1), format: (v) => v.toFixed(1) },
    { key: "stress", header: "Share of stress", unit: "%", numeric: true, value: (r) => +(r.stress * 100).toFixed(1), format: (v) => v.toFixed(1) },
  ];
  const unfLast = last.diagnosis_summary.find((d) => d.diagnosis === "unfunded_gap");
  const dE = last.efficiency_fixed_t0 - first.efficiency_fixed_t0;

  return (
    <div className="space-y-8">
      <KpiRow>
        <Kpi label="Stress index" year={last.year} value={last.fsfsi} format={(v) => v.toFixed(2)} sub={<>{fmtSigned(last.fsfsi - first.fsfsi)} since {first.year}</>} />
        <Kpi label="Accumulated stress" year={last.year} value={last.fsfsi_acc} format={(v) => v.toFixed(2)} hint="Stress carried over from earlier years at the published persistence rates." />
        <Kpi label="Efficiency" year={last.year} value={last.efficiency} format={(v) => v.toFixed(2)} sub={<>{fmtSigned(last.efficiency - first.efficiency)} since {first.year}</>} />
        <Kpi
          label={`Efficiency at ${first.year} budget`}
          year={last.year}
          value={last.efficiency_fixed_t0}
          format={(v) => v.toFixed(2)}
          sub={<>{fmtSigned(dE)} since {first.year}</>}
          hint="Budget held at its first-year size, so the change reflects composition alone."
        />
      </KpiRow>

      <Figure
        title={`The stress index moved from ${fmtIndex(first.fsfsi)} in ${first.year} to ${fmtIndex(last.fsfsi)} in ${last.year}`}
        subtitle={`Stress index (solid) and accumulated stress (dashed), 0–1, ${span}; bands show stress classes`}
        data={{ columns: seriesColumns, rows: ts.years, filename: "stress-index-over-time" }}
      >
        <IndexRecordChart ts={ts} breaks={breaks} height={340} />
      </Figure>

      <div className="grid gap-8 lg:grid-cols-2">
        <Figure
          title={`The budget envelope reached ${last.envelope_index.toFixed(0)} in ${last.year} (${first.year} = 100)`}
          subtitle={`Budget envelope index, ${first.year} = 100, ${span}`}
          data={{ columns: seriesColumns, rows: ts.years, filename: "envelope-index" }}
        >
          <EnvelopeIndexChart ts={ts} />
        </Figure>
        <Figure
          title={`At a fixed budget, efficiency ${dE < 0 ? "fell" : "rose"} by ${Math.abs(dE).toFixed(2)} over the period`}
          subtitle={`Efficiency (0–1), actual and with the budget held at its ${first.year} size, ${span}`}
          data={{ columns: seriesColumns, rows: ts.years, filename: "efficiency-over-time" }}
        >
          <EfficiencyRecordChart ts={ts} />
        </Figure>
      </div>

      <Figure
        title={heat === "acc_stress" ? "Accumulated component stress by year" : "Component stress by year"}
        subtitle={`${heat === "acc_stress" ? "Accumulated" : "Point-in-time"} component stress (0–1), ${span}; darker is higher`}
        actions={
          <Segmented
            label="Heatmap measure"
            size="sm"
            value={heat}
            onValueChange={setHeat}
            options={[
              { value: "acc_stress", label: "Accumulated" },
              { value: "stress", label: "This year" },
            ]}
          />
        }
        data={{ columns: heatColumns, rows: heatRows, filename: `component-${heat}-by-year` }}
      >
        <Heatmap
          rows={comps.map((c) => c.name)}
          cols={years}
          values={comps.map((c) => ts.years.map((y) => y.components[c.id]?.[heat] ?? null))}
          max={1}
          rowHeader="Component"
          caption={`${heat === "acc_stress" ? "Accumulated" : "Point-in-time"} component stress by year`}
          cellTitle={(r, c, v) => `${comps[r].name}, ${years[c]}: ${v === null ? "not assessed" : v.toFixed(3)}`}
        />
      </Figure>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <Figure
          className="lg:col-span-8"
          title="Money and stress by diagnosis class, year by year"
          subtitle={`Share of the budget (upper bar) and of stress (lower bar) by diagnosis class (%), ${span}`}
          data={{ columns: dxColumns, rows: dxRows, filename: "diagnosis-by-year" }}
        >
          <DiagnosisByYearChart ts={ts} height={Math.max(260, ts.years.length * 52)} />
        </Figure>
        <Figure
          className="lg:col-span-4"
          title={`In ${last.year}, unfunded gaps took ${fmtPct(unfLast?.envelope_share)} of the budget and ${fmtPct(unfLast?.stress_share)} of stress`}
          subtitle={`Unfunded gaps: share of budget and of stress (%), ${span}`}
          data={{ columns: dxColumns, rows: dxRows.filter((r) => r.diagnosis === "unfunded gap"), filename: "unfunded-gaps-by-year" }}
        >
          <UnfundedTrend ts={ts} />
        </Figure>
      </div>

      {profile.kind === "custom" && profile.years.length >= 3 ? <CalibrateCard id={id} controls={controls} current={profile.breaks} /> : null}
    </div>
  );
}
