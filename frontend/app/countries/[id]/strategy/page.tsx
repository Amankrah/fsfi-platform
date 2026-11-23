"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useStrategy } from "@/lib/api";
import { useCountryCtx } from "@/components/shell/country-context";
import { Kpi, KpiRow } from "@/components/kpi";
import { Figure } from "@/components/charts/figure";
import { DotRows } from "@/components/charts/dot-rows";
import { AlignmentHistoryChart } from "@/components/charts/plan-charts";
import { DataTable } from "@/components/data-table";
import { ErrorState, PageSkeleton } from "@/components/states";
import { Badge, DiagnosisBadge, Swatch } from "@/components/ui/badge";
import { CURVES, planParamsOf, usePlanParams } from "@/lib/use-plan-params";
import { fmtIndex, fmtNum, fmtPct, fmtPp } from "@/lib/format";
import { diagnosisLabel } from "@/lib/encodings";
import type { ColumnSpec } from "@/lib/csv";
import type { StrategyArea, StrategyTarget, TargetStatus } from "@/lib/types";

const STATUS: Record<TargetStatus, { label: string; color: string; hollow?: boolean }> = {
  achieved: { label: "Achieved", color: "var(--positive)" },
  on_track: { label: "On track", color: "var(--positive)", hollow: true },
  behind: { label: "Behind", color: "var(--warning)" },
  off_track: { label: "Moving away", color: "var(--alert)" },
  no_data: { label: "No data", color: "var(--neutral-mark)", hollow: true },
};
const STATUS_ORDER: TargetStatus[] = ["achieved", "on_track", "behind", "off_track", "no_data"];

function StatusBadge({ s }: { s: TargetStatus }) {
  const v = STATUS[s];
  return (
    <Badge tone="outline" className="pl-1.5">
      <Swatch color={v.color} hollow={v.hollow} />
      {v.label}
    </Badge>
  );
}

function val(v: number | null) {
  if (v === null || v === undefined) return "n/a";
  const a = Math.abs(v);
  return fmtNum(v, a >= 1000 ? 0 : a >= 10 ? 1 : 2);
}

function ProgressBar({ t }: { t: StrategyTarget }) {
  if (t.progress === null) return <span className="text-ink-subtle">n/a</span>;
  const p = Math.max(0, Math.min(1, t.progress));
  const e = Math.max(0, Math.min(1, t.expected_progress));
  const color = STATUS[t.status].color;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative inline-block h-2 w-24 rounded-full bg-ink-6" aria-hidden>
        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${p * 100}%`, background: color }} />
        <span className="absolute -top-1 h-4 w-[2px] bg-ink" style={{ left: `calc(${e * 100}% - 1px)` }} />
      </span>
      <span className="tabular">{t.progress < 0 ? "−" : ""}{Math.abs(t.progress * 100).toFixed(0)}%</span>
    </span>
  );
}

export default function StrategyPage() {
  const { id, profile, controls } = useCountryCtx();
  const pp = usePlanParams();
  const { data: r, error, mutate } = useStrategy(id, controls, planParamsOf(pp));
  if (error) return <ErrorState error={error} onRetry={() => void mutate()} />;
  if (!r) return <PageSkeleton />;

  const tr = r.tracking;
  const onTrack = tr.targets.filter((t) => t.status === "on_track" || t.status === "achieved").length;
  const withData = tr.targets.filter((t) => t.status !== "no_data").length;
  const areaName = Object.fromEntries(r.areas.map((a) => [a.code, a.name]));
  const worst = [...r.areas].sort((a, b) => Math.abs(b.deviation_pp) - Math.abs(a.deviation_pp))[0];
  const planEnd = r.plan.end_year;
  const curve = CURVES.find((c) => c.value === r.plan.params.curve)?.label.toLowerCase();

  const areaColumns: ColumnSpec<StrategyArea>[] = [
    { key: "code", header: "Code", value: (a) => a.code, className: "font-mono text-small" },
    { key: "name", header: "Priority area", value: (a) => a.name },
    { key: "comps", header: "Components", value: (a) => a.components.map((c) => c.name).join("; ") },
    { key: "target", header: "Target share", unit: "%", numeric: true, value: (a) => +(a.target_share * 100).toFixed(1), format: (v) => v.toFixed(1) },
    { key: "actual", header: `Actual share, ${r.year}`, short: "Actual", unit: "%", numeric: true, value: (a) => +(a.actual_share * 100).toFixed(1), format: (v) => v.toFixed(1) },
    { key: "dev", header: "Actual minus target", short: "Gap", unit: "pp", numeric: true, value: (a) => +a.deviation_pp.toFixed(1), format: (v) => fmtPp(v) },
    { key: "opt", header: "Optimal share", short: "Optimal", unit: "%", numeric: true, value: (a) => +(a.optimal_share * 100).toFixed(1), format: (v) => v.toFixed(1) },
    { key: "plan", header: `Plan share, ${planEnd}`, short: "Plan", unit: "%", numeric: true, value: (a) => +(a.plan_share * 100).toFixed(1), format: (v) => v.toFixed(1) },
    { key: "acc", header: `Accumulated stress, ${r.year}`, short: "Stress now", numeric: true, value: (a) => +a.acc_stress.toFixed(3), format: (v) => v.toFixed(3) },
    { key: "pend", header: `Accumulated stress, ${planEnd}, plan`, short: "Stress, plan", numeric: true, value: (a) => +a.plan_end_acc_stress.toFixed(3), format: (v) => v.toFixed(3) },
    { key: "red", header: "Stress reduction under the plan", short: "Reduction", unit: "%", numeric: true, value: (a) => +a.plan_reduction_pct.toFixed(1), format: (v) => v.toFixed(1) },
    { key: "tg", header: "Targets on track", short: "On track", value: (a) => `${a.targets_on_track} of ${a.targets}` },
  ];

  const targetColumns: ColumnSpec<StrategyTarget>[] = [
    { key: "code", header: "Code", value: (t) => t.code, className: "font-mono text-small" },
    { key: "name", header: "Indicator", value: (t) => t.name, className: "min-w-[180px]" },
    { key: "area", header: "Priority area", short: "Area", value: (t) => areaName[t.area] ?? t.area, cell: (t) => <span className="font-mono text-small" title={areaName[t.area]}>{t.area}</span> },
    { key: "base", header: `Baseline, ${tr.start}`, short: "Baseline", numeric: true, value: (t) => t.baseline, format: (v) => val(v) },
    { key: "cur", header: `Latest, ${tr.latest}`, short: "Latest", numeric: true, value: (t) => t.current, format: (v) => val(v) },
    { key: "target", header: `Target, ${tr.target_year}`, short: "Target", numeric: true, value: (t) => t.target, format: (v) => val(v) },
    { key: "bench", header: "Benchmark", numeric: true, value: (t) => t.benchmark, format: (v) => val(v) },
    {
      key: "prog",
      header: "Progress to target",
      unit: "%",
      numeric: true,
      value: (t) => (t.progress === null ? null : +(t.progress * 100).toFixed(1)),
      cell: (t) => <ProgressBar t={t} />,
    },
    { key: "status", header: "Status", value: (t) => STATUS[t.status].label, cell: (t) => <StatusBadge s={t.status} /> },
    {
      key: "dx",
      header: `Diagnosis, ${tr.latest}`,
      short: "Diagnosis",
      value: (t) => (t.diagnosis ? diagnosisLabel[t.diagnosis] : "n/a"),
      cell: (t) => (t.diagnosis ? <DiagnosisBadge dx={t.diagnosis} /> : <span className="text-ink-subtle">n/a</span>),
    },
  ];

  const maxShare = Math.max(0.1, ...r.areas.flatMap((a) => [a.target_share, a.actual_share, a.optimal_share, a.plan_share]));
  const cost = r.index.strategy_cost;

  return (
    <div className="space-y-8">
      <div className="callout max-w-[80ch]">
        <p className="t-ui text-ink">
          <span className="font-semibold">{r.strategy.name}.</span> {r.strategy.description}
        </p>
        {r.strategy.unmapped_components.length ? (
          <p className="mt-1 t-caption text-ink-subtle">Not in any priority area: {r.strategy.unmapped_components.join(", ")}.</p>
        ) : null}
      </div>

      <KpiRow>
        <Kpi
          label="Budget alignment"
          year={r.year}
          value={r.alignment.actual * 100}
          format={(v) => v.toFixed(0)}
          unit="%"
          sub={<>Plan in {planEnd}: {fmtPct(r.alignment.plan)}; optimum: {fmtPct(r.alignment.optimum)}</>}
          hint="Share of the envelope already where the strategy's target split puts it (1 minus half the summed share gaps)."
        />
        <Kpi
          label="Index at the strategy's split"
          year={r.year}
          value={r.index.strategy_optimum}
          format={(v) => v.toFixed(3)}
          sub={<>Actual {fmtIndex(r.index.actual, 3)}, unconstrained optimum {fmtIndex(r.index.optimum, 3)}</>}
          hint="Lowest index reachable with today's envelope if each priority area receives exactly its target share."
        />
        <Kpi
          label="Efficiency within the strategy"
          year={r.year}
          value={r.index.efficiency_strategy}
          format={(v) => v.toFixed(2)}
          sub={cost > 1e-4 ? <>The split costs {fmtIndex(cost, 3)} of index against the optimum</> : <>The split costs nothing against the optimum</>}
          hint="Index at the optimum divided by the index at the best allocation that keeps the strategy's split."
        />
        <Kpi
          label="Indicator targets on track"
          year={tr.latest}
          value={onTrack}
          format={(v) => v.toFixed(0)}
          unit={`of ${withData}`}
          sub={<>{tr.elapsed} of {tr.periods} years elapsed ({tr.start} to {tr.target_year})</>}
        />
      </KpiRow>

      <Figure
        title={
          Math.abs(worst.deviation_pp) < 2
            ? "The budget already follows the strategy's split"
            : `${worst.name} is ${Math.abs(worst.deviation_pp).toFixed(1)} points ${worst.deviation_pp > 0 ? "above" : "below"} its target share`
        }
        subtitle={`Share of the envelope by priority area (%): strategy target, actual (${r.year}), and the plan in ${planEnd}`}
        data={{ columns: areaColumns, rows: r.areas, filename: "strategy-areas" }}
        notes={<>The plan follows the stress-minimising composition, not the strategy&apos;s split; the optimal share is in the table.</>}
      >
        <DotRows
          ariaLabel="Target, actual and plan shares by priority area"
          rows={r.areas.map((a) => ({
            id: a.code,
            label: `${a.code} ${a.name}`,
            from: "actual",
            to: "plan",
            right: fmtPp(a.deviation_pp),
            rightStrong: Math.abs(a.deviation_pp) >= 5,
            marks: [
              { key: "target", value: a.target_share, kind: "tick", title: `Target ${fmtPct(a.target_share, 1)}` },
              { key: "actual", value: a.actual_share, kind: "hollow", title: `Actual ${fmtPct(a.actual_share, 1)}` },
              { key: "plan", value: a.plan_share, kind: "filled", title: `Plan ${fmtPct(a.plan_share, 1)}` },
            ],
          }))}
          max={maxShare}
          format={(v) => `${Math.round(v * 100)}%`}
          rightHeader="Actual − target (pp)"
          legend={[
            { kind: "tick", label: "Strategy target" },
            { kind: "hollow", label: `Actual, ${r.year}` },
            { kind: "filled", label: `Plan, ${planEnd}` },
          ]}
        />
      </Figure>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
        <Figure
          className="xl:col-span-7"
          title={`Alignment ${r.history[r.history.length - 1].alignment >= r.history[0].alignment ? "rose" : "fell"} from ${fmtPct(r.history[0].alignment)} to ${fmtPct(r.history[r.history.length - 1].alignment)} over the record`}
          subtitle={`Budget alignment with the strategy's target split (%), ${r.history[0].year} to ${r.year}`}
          data={{
            columns: [
              { key: "year", header: "Year", value: (h: (typeof r.history)[number]) => h.year },
              { key: "al", header: "Alignment", unit: "%", numeric: true, value: (h) => +(h.alignment * 100).toFixed(1), format: (v) => v.toFixed(1) },
              ...r.areas.map((a) => ({
                key: a.code,
                header: `${a.code} share`,
                unit: "%",
                numeric: true,
                value: (h: (typeof r.history)[number]) => +((h.shares[a.code] ?? 0) * 100).toFixed(1),
                format: (v: number) => v.toFixed(1),
              })),
            ] as ColumnSpec<(typeof r.history)[number]>[],
            rows: r.history,
            filename: "strategy-alignment-history",
          }}
        >
          <AlignmentHistoryChart report={r} />
        </Figure>
        <section className="xl:col-span-5" aria-labelledby="strategy-reading">
          <h2 id="strategy-reading" className="t-h3">
            Strategy and optimum
          </h2>
          <ul className="mt-3 space-y-3 t-ui text-ink-muted">
            <li>
              Spending today&apos;s envelope in the strategy&apos;s split, as well as possible within each area, would bring the index
              from {fmtIndex(r.index.actual, 3)} to {fmtIndex(r.index.strategy_optimum, 3)}.
            </li>
            <li>
              {cost > 1e-4 ? (
                <>
                  Dropping the split and following the optimum would lower it further, to {fmtIndex(r.index.optimum, 3)}. The
                  difference, {fmtIndex(cost, 3)}, is what the strategy&apos;s split costs in stress.
                </>
              ) : (
                <>The optimum already respects the split, so following the strategy costs nothing in stress.</>
              )}
            </li>
            <li>
              The plan ({r.plan.params.horizon} years, {fmtPct(r.plan.params.growth, 1)} growth, {curve} target path)
              {r.plan.summary.reached ? " meets" : " misses"} its target of {fmtIndex(r.plan.target, 3)} and ends{" "}
              {fmtPct(r.alignment.plan)} aligned with the strategy.
            </li>
          </ul>
          <Link
            href={`/countries/${id}/plan${pp.query}`}
            className="mt-6 inline-flex items-center gap-1.5 t-ui font-medium text-green-700 underline-offset-4 hover:underline"
          >
            Change the plan settings <ArrowRight aria-hidden className="size-4" />
          </Link>
        </section>
      </div>

      <section aria-labelledby="targets-h" className="space-y-3">
        <div>
          <h2 id="targets-h" className="t-h3">
            Indicator targets
          </h2>
          <p className="mt-1 max-w-[80ch] t-ui text-ink-muted">
            Each target is set from the {tr.start} value toward the indicator&apos;s benchmark by {tr.target_year}. Progress is
            the share of that distance covered by {tr.latest}; the tick marks the {fmtPct(tr.expected_progress)} expected on
            a straight path. Indicators with an imputed value in either year show no data.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {STATUS_ORDER.map((s) => {
              const n = tr.targets.filter((t) => t.status === s).length;
              return n ? (
                <span key={s} className="inline-flex items-center gap-1.5 t-caption text-ink-muted">
                  <StatusBadge s={s} /> {n}
                </span>
              ) : null;
            })}
          </div>
        </div>
        <DataTable
          rows={tr.targets}
          columns={targetColumns}
          caption="Strategy indicator targets"
          captionHidden
          filename={`${id}-strategy-targets`}
          csvPreamble={[`${r.strategy.name}: indicator targets`, profile.name]}
        />
      </section>
    </div>
  );
}
