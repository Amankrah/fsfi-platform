"use client";

import * as React from "react";
import { useScale } from "@/lib/api";
import { useCountryCtx } from "@/components/shell/country-context";
import { Figure } from "@/components/charts/figure";
import { ScaleChart } from "@/components/charts/scale-chart";
import { ErrorState, PageSkeleton } from "@/components/states";
import { Kpi, KpiRow } from "@/components/kpi";
import type { ColumnSpec } from "@/lib/csv";
import { fmtSigned } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ResponseForm } from "@/lib/types";

export default function ScalePage() {
  const { id, controls } = useCountryCtx();
  const { data: sc, error, mutate } = useScale(id, controls);
  const [hl, setHl] = React.useState<string | null>(null);
  const response: ResponseForm = controls.response;

  if (error) return <ErrorState error={error} onRetry={() => void mutate()} />;
  if (!sc) return <PageSkeleton />;

  const curves = sc.curves.filter((c) => c.response === response);
  const ref = curves.find((c) => c.year === sc.reference_year) ?? curves[curves.length - 1];
  const lo = ref?.efficiency[0];
  const hi = ref?.efficiency[ref.efficiency.length - 1];
  const fixed = curves.map((c) => {
    const i = sc.multiples.findIndex((m) => Math.abs(m - 1) < 1e-9);
    return { year: c.year, e: i >= 0 ? c.efficiency[i] : interp(sc.multiples, c.efficiency, 1) };
  });

  const columns: ColumnSpec<(typeof curves)[number]>[] = [
    { key: "year", header: "Year mix", value: (c) => c.year },
    { key: "own", header: "Own budget", unit: `× ${sc.reference_year}`, numeric: true, value: (c) => +c.own_multiple.toFixed(3), format: (v) => v.toFixed(2) },
    { key: "eff", header: "Efficiency at own budget", numeric: true, value: (c) => +c.own_efficiency.toFixed(4), format: (v) => v.toFixed(3) },
    {
      key: "fixed",
      header: `Efficiency at ${sc.reference_year} budget`,
      numeric: true,
      value: (c) => {
        const f = fixed.find((x) => x.year === c.year)?.e;
        return f === undefined ? null : +f.toFixed(4);
      },
      format: (v) => v.toFixed(3),
    },
    { key: "el", header: "Budget elasticity of efficiency", numeric: true, value: (c) => +c.elasticity.toFixed(3), format: (v) => fmtSigned(v) },
  ];

  return (
    <div className="space-y-8">
      <KpiRow>
        <Kpi label="Efficiency at own budget" year={sc.reference_year} value={ref?.own_efficiency} format={(v) => v.toFixed(2)} />
        <Kpi label={`Efficiency at ${sc.multiples[0]}× the budget`} year={sc.reference_year} value={lo} format={(v) => v.toFixed(2)} hint="Same composition, smallest envelope tested." />
        <Kpi label={`Efficiency at ${sc.multiples[sc.multiples.length - 1]}× the budget`} year={sc.reference_year} value={hi} format={(v) => v.toFixed(2)} hint="Same composition, largest envelope tested." />
        <Kpi
          label="Budget elasticity of efficiency"
          year={sc.reference_year}
          value={ref?.elasticity}
          format={(v) => fmtSigned(v)}
          hint="Percentage change in efficiency per 1% more budget, at the current composition."
        />
      </KpiRow>

      <Figure
        title={`Efficiency ${ref && ref.elasticity < 0 ? "falls" : "rises"} as the same composition is scaled up (elasticity ${fmtSigned(ref?.elasticity)})`}
        subtitle={`Efficiency (0–1) against budget size, as a multiple of the ${sc.reference_year} envelope (log scale), one line per year's composition`}
        notes="Efficiency depends on the size of the envelope as well as its composition, so comparisons over time use a fixed budget size."
        actions={
          <div className="hidden flex-wrap gap-1 md:flex" role="group" aria-label="Highlight a year">
            {curves.map((c) => (
              <button
                key={c.year}
                type="button"
                aria-pressed={hl === c.year}
                onMouseEnter={() => setHl(c.year)}
                onMouseLeave={() => setHl(null)}
                onFocus={() => setHl(c.year)}
                onBlur={() => setHl(null)}
                className={cn(
                  "h-7 min-w-[28px] rounded-[2px] border border-rule-strong px-2 text-[12px] tabular",
                  c.year === ref?.year ? "bg-evergreen text-white" : "bg-surface text-ink-muted hover:text-ink",
                )}
              >
                {c.year}
              </button>
            ))}
          </div>
        }
        data={{ columns, rows: curves, filename: "efficiency-vs-budget-size" }}
      >
        <ScaleChart scale={sc} response={response} highlight={hl} />
      </Figure>
    </div>
  );
}

function interp(xs: number[], ys: number[], x: number) {
  for (let i = 1; i < xs.length; i++) {
    if (xs[i] >= x) {
      const t = (Math.log(x) - Math.log(xs[i - 1])) / (Math.log(xs[i]) - Math.log(xs[i - 1]));
      return ys[i - 1] + t * (ys[i] - ys[i - 1]);
    }
  }
  return ys[ys.length - 1];
}
