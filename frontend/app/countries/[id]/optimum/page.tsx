"use client";

import * as React from "react";
import { useAssessment } from "@/lib/api";
import { useCountryCtx } from "@/components/shell/country-context";
import { Figure } from "@/components/charts/figure";
import { Dumbbell } from "@/components/charts/dumbbell";
import { FrontLoadedChart, MarginalReturnsChart } from "@/components/charts/optimum-charts";
import { ErrorState, PageSkeleton } from "@/components/states";
import { Kpi, KpiRow } from "@/components/kpi";
import { componentColumns } from "@/lib/columns";
import { fmtIndex, fmtMoney, fmtPct, fmtSci } from "@/lib/format";
import type { ColumnSpec } from "@/lib/csv";
import type { IndicatorResult } from "@/lib/types";

export default function OptimumPage() {
  const { id, profile, controls, year } = useCountryCtx();
  const { data: a, error, mutate } = useAssessment(id, controls);
  if (error) return <ErrorState error={error} onRetry={() => void mutate()} />;
  if (!a) return <PageSkeleton />;
  const s = a.system;
  const moved = a.components.reduce((acc, c) => acc + Math.max(0, c.shift_pp), 0) / 100;
  const top = [...a.indicators].sort((x, y) => y.marginal_return - x.marginal_return)[0];

  const flColumns: ColumnSpec<{ moved: number; captured: number }>[] = [
    { key: "moved", header: "Budget moved", unit: "%", numeric: true, value: (p) => +(p.moved * 100).toFixed(1), format: (v) => v.toFixed(1) },
    { key: "captured", header: "Reduction captured", unit: "%", numeric: true, value: (p) => +(p.captured * 100).toFixed(1), format: (v) => v.toFixed(1) },
  ];
  const mrColumns: ColumnSpec<IndicatorResult>[] = [
    { key: "code", header: "Code", value: (d) => d.code, className: "font-mono text-[13px]" },
    { key: "name", header: "Indicator", value: (d) => d.name },
    { key: "mr", header: "Marginal return", numeric: true, value: (d) => d.marginal_return, format: (v) => fmtSci(v) },
    { key: "actual", header: "Actual allocation", unit: profile.currency, numeric: true, value: (d) => +d.allocation.toFixed(2), format: (v) => fmtMoney(v) },
    { key: "optimal", header: "Optimal allocation", unit: profile.currency, numeric: true, value: (d) => +d.optimal_allocation.toFixed(2), format: (v) => fmtMoney(v) },
  ];

  return (
    <div className="space-y-8">
      <KpiRow>
        <Kpi label="Stress index at the optimum" year={year} value={s.fsfsi_opt} format={(v) => v.toFixed(2)} sub={<>from {fmtIndex(s.fsfsi)} at the actual allocation</>} />
        <Kpi label="Efficiency" year={year} value={s.efficiency} format={(v) => v.toFixed(2)} hint="Index at the optimum divided by the index at the actual allocation, same envelope." />
        <Kpi
          label="Budget equivalent of the reallocation"
          year={year}
          value={s.envelope_multiple}
          format={(v) => v.toFixed(1)}
          unit="× envelope"
          hint="The budget multiple that, spent in the current proportions, would lower stress as much as the optimal reallocation."
        />
        <Kpi label="Envelope moved" year={year} value={moved * 100} format={(v) => v.toFixed(1)} unit="%" hint="Share of the budget that changes component to reach the optimum." />
      </KpiRow>

      <Figure
        title={`Reaching the optimum moves ${fmtPct(moved, 1)} of the envelope between components`}
        subtitle={`Current and optimal component shares of the budget (%), same envelope, ${profile.name}, ${year}`}
        data={{ columns: componentColumns, rows: a.components, filename: "current-vs-optimal", initialSort: { key: "shift", desc: true } }}
      >
        <Dumbbell rows={a.components} components={profile.components} />
      </Figure>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
        <Figure
          className="xl:col-span-5"
          title={`Moving the first 10% of the budget captures ${fmtPct(s.front_loaded_10pct)} of the attainable reduction`}
          subtitle={`Share of the stress reduction captured against share of the budget moved along the optimal path (%), ${year}`}
          data={{ columns: flColumns, rows: a.front_loaded, filename: "front-loaded-gain" }}
        >
          <FrontLoadedChart points={a.front_loaded} at10={s.front_loaded_10pct} />
        </Figure>
        <Figure
          className="xl:col-span-7"
          title={`The next unit of money works hardest on ${top?.name ?? "one indicator"}`}
          subtitle={`Marginal return per indicator at the actual allocation, against the common return level of the optimum, ${year}`}
          data={{ columns: mrColumns, rows: a.indicators, filename: "marginal-returns", initialSort: { key: "mr", desc: true } }}
        >
          <MarginalReturnsChart indicators={a.indicators} lambda={s.lambda} components={profile.components} />
        </Figure>
      </div>
    </div>
  );
}
