"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { usePlan } from "@/lib/api";
import { useCountryCtx } from "@/components/shell/country-context";
import { Kpi, KpiRow } from "@/components/kpi";
import { Figure } from "@/components/charts/figure";
import { DotRows } from "@/components/charts/dot-rows";
import { EnvelopeChart, TrajectoryChart, trajectoryRows, type TrajectoryPoint } from "@/components/charts/plan-charts";
import { ErrorState, PageSkeleton } from "@/components/states";
import { Segmented } from "@/components/ui/segmented";
import { Slider } from "@/components/ui/slider";
import { StressBadge } from "@/components/ui/badge";
import { CURVES, HORIZONS, PACES, planParamsOf, usePlanParams } from "@/lib/use-plan-params";
import { fmtIndex, fmtMoney, fmtPct, fmtPp } from "@/lib/format";
import { stressLabel } from "@/lib/encodings";
import type { ColumnSpec } from "@/lib/csv";
import type { PlanComponent } from "@/lib/types";

const pct = (v: number, d = 1) => (v * 100).toFixed(d);

/** Local slider state, written to the URL a moment after the hand stops. */
function useDebounced(value: number, commit: (v: number) => void, ms = 300) {
  const [local, setLocal] = React.useState(value);
  const [synced, setSynced] = React.useState(value);
  if (synced !== value) {
    setSynced(value);
    setLocal(value);
  }
  React.useEffect(() => {
    if (Math.abs(local - value) < 1e-9) return;
    const t = setTimeout(() => commit(local), ms);
    return () => clearTimeout(t);
  }, [local, value, commit, ms]);
  return [local, setLocal] as const;
}

export default function PlanPage() {
  const { id, profile, controls, componentName } = useCountryCtx();
  const pp = usePlanParams();
  const params = planParamsOf(pp);
  const { data: plan, error, mutate, isValidating } = usePlan(id, controls, params);
  const setTarget = React.useCallback((v: number) => pp.set({ target_reduction: v }), [pp]);
  const setGrowth = React.useCallback((v: number) => pp.set({ growth: v }), [pp]);
  const [tr, setTr] = useDebounced(pp.target_reduction, setTarget);
  const [g, setG] = useDebounced(pp.growth, setGrowth);

  if (error) return <ErrorState error={error} onRetry={() => void mutate()} />;
  if (!plan) return <PageSkeleton />;
  const s = plan.summary;
  const end = plan.years[plan.years.length - 1];
  const cur = profile.currency;

  const title = s.reached
    ? `The plan brings accumulated stress from ${fmtIndex(plan.base.fsfsi_acc, 3)} to ${fmtIndex(s.final_fsfsi_acc, 3)} by ${end.year} and meets the target in ${s.first_year_on_target}`
    : `The plan brings accumulated stress to ${fmtIndex(s.final_fsfsi_acc, 3)} by ${end.year}, short of the ${fmtIndex(plan.target, 3)} target`;

  const trajColumns: ColumnSpec<TrajectoryPoint>[] = [
    { key: "year", header: "Year", value: (d) => d.year },
    { key: "plan", header: "Plan, accumulated", numeric: true, value: (d) => +d.plan.toFixed(4), format: (v) => v.toFixed(3) },
    { key: "bau", header: "Today's composition, accumulated", short: "Today's comp.", numeric: true, value: (d) => +d.bau.toFixed(4), format: (v) => v.toFixed(3) },
    { key: "target", header: "Year target", numeric: true, value: (d) => +d.target.toFixed(4), format: (v) => v.toFixed(3) },
    { key: "fsfsi", header: "Plan, this year only", short: "This year", numeric: true, value: (d) => +d.fsfsi.toFixed(4), format: (v) => v.toFixed(3) },
    { key: "env", header: "Envelope", unit: cur, numeric: true, value: (d) => +d.envelope.toFixed(2), format: (v) => fmtMoney(v) },
    { key: "ok", header: "On track", value: (d) => (d.on_track === null ? "Latest year" : d.on_track ? "Yes" : "No") },
  ];
  const compColumns: ColumnSpec<PlanComponent>[] = [
    { key: "name", header: "Component", value: (r) => r.name },
    { key: "share", header: `Share, ${plan.base.year}`, unit: "%", numeric: true, value: (r) => +pct(r.share), format: (v) => v.toFixed(1) },
    { key: "end", header: `Share, ${end.year}`, unit: "%", numeric: true, value: (r) => +pct(r.end_share), format: (v) => v.toFixed(1) },
    { key: "shift", header: "Shift", unit: "pp", numeric: true, value: (r) => +r.shift_pp.toFixed(1), format: (v) => fmtPp(v) },
    { key: "acc", header: `Accumulated stress, ${plan.base.year}`, short: "Now", numeric: true, value: (r) => +r.acc_stress.toFixed(3), format: (v) => v.toFixed(3) },
    { key: "endacc", header: `Accumulated stress, ${end.year}, plan`, short: "Plan", numeric: true, value: (r) => +r.end_acc_stress.toFixed(3), format: (v) => v.toFixed(3) },
    { key: "bau", header: `Accumulated stress, ${end.year}, today's composition`, short: "Today's comp.", numeric: true, value: (r) => +r.bau_end_acc_stress.toFixed(3), format: (v) => v.toFixed(3) },
    { key: "chg", header: "Change under the plan", unit: "%", numeric: true, value: (r) => +r.change_pct.toFixed(1), format: (v) => fmtPp(v) },
    { key: "cls", header: `Class, ${end.year}`, value: (r) => stressLabel[r.end_class] },
  ];

  const shareMax = Math.max(0.1, ...plan.components.flatMap((c) => [c.share, c.end_share]));
  const stressMax = Math.max(0.1, ...plan.components.flatMap((c) => [c.acc_stress, c.end_acc_stress, c.bau_end_acc_stress]));
  const bySorted = <T extends PlanComponent>(rows: T[], k: (r: T) => number) => [...rows].sort((a, b) => k(b) - k(a));
  const residual = s.residual_high.map(componentName);

  return (
    <div className="space-y-8">
      <KpiRow>
        <Kpi
          label="Target, accumulated index"
          year={end.year}
          value={plan.target}
          format={(v) => v.toFixed(3)}
          sub={<>{fmtPct(plan.params.target_reduction)} below {fmtIndex(plan.base.fsfsi_acc, 3)} in {plan.base.year}</>}
        />
        <Kpi
          label="Projected under the plan"
          year={end.year}
          value={s.final_fsfsi_acc}
          format={(v) => v.toFixed(3)}
          sub={s.reached ? <>Target met in {s.first_year_on_target}</> : <>Target not met within {plan.params.horizon} years</>}
        />
        <Kpi
          label="Growth needed to meet the target"
          value={s.required_growth === null ? null : s.required_growth * 100}
          format={(v) => v.toFixed(1)}
          unit="% a year"
          sub={s.required_growth === null ? <>Not reachable below 100% a year</> : <>against {fmtPct(plan.params.growth, 1)} assumed</>}
          hint="Smallest constant envelope growth that meets the target by the last plan year, at the chosen pace."
        />
        <Kpi
          label="Money added over the plan"
          value={s.cumulative_additional}
          format={(v) => fmtMoney(v)}
          unit={cur}
          sub={<>Envelope {fmtMoney(plan.base.envelope)} → {fmtMoney(s.final_envelope)} {cur}</>}
          hint="Sum over the plan years of the envelope above its latest-year level."
        />
      </KpiRow>

      <section aria-label="Plan settings" className="grid grid-cols-1 gap-x-8 gap-y-5 border border-rule bg-surface p-5 md:grid-cols-2 xl:grid-cols-3" data-print-hide>
        <Field label="Planning horizon" value={`${pp.horizon} years`}>
          <Segmented
            label="Planning horizon"
            value={String(pp.horizon)}
            onValueChange={(v) => pp.set({ horizon: Number(v) })}
            options={HORIZONS.map((h) => ({ value: String(h), label: `${h} years` }))}
            size="sm"
          />
        </Field>
        <Field label="Stress reduction target" value={`${pct(tr, 0)}% (${fmtIndex(plan.base.fsfsi_acc * (1 - tr), 3)})`}>
          <Slider label="Stress reduction target" value={tr} min={0.05} max={0.5} step={0.01} onValueChange={setTr} />
        </Field>
        <Field
          label="Envelope growth"
          value={`${g >= 0 ? "" : "−"}${pct(Math.abs(g), 1)}% a year`}
          note={s.required_growth !== null ? `The marker shows the ${pct(s.required_growth, 1)}% needed to meet the target.` : undefined}
        >
          <Slider label="Envelope growth" value={g} min={-0.05} max={0.3} step={0.0025} marker={s.required_growth ?? undefined} onValueChange={setG} />
        </Field>
        <Field label="Pace of reallocation" value={`${pct(pp.pace, 0)}% of the distance a year`} note="Share of the remaining distance to the year's optimal composition closed each year.">
          <Segmented
            label="Pace of reallocation"
            value={String(pp.pace)}
            onValueChange={(v) => pp.set({ pace: Number(v) })}
            options={PACES.map((p) => ({ value: String(p), label: p === 1 ? "Full" : `${p * 100}%` }))}
            size="sm"
          />
        </Field>
        <Field label="Target path" value={CURVES.find((c) => c.value === pp.curve)?.hint ?? ""}>
          <Segmented
            label="Target path"
            value={pp.curve}
            onValueChange={(v) => pp.set({ curve: v })}
            options={CURVES.map((c) => ({ value: c.value, label: c.label, title: c.hint }))}
            size="sm"
          />
        </Field>
        <div className="flex items-end">
          <p className="t-caption text-ink-subtle" aria-live="polite">
            {isValidating ? "Recomputing…" : `Base year ${plan.base.year}: index ${fmtIndex(plan.base.fsfsi, 3)}, accumulated ${fmtIndex(plan.base.fsfsi_acc, 3)}, efficiency ${fmtIndex(plan.base.efficiency)}.`}
          </p>
        </div>
      </section>

      <Figure
        title={title}
        subtitle={`Accumulated stress index (0–1), ${plan.base.year} to ${end.year}, ${profile.name}`}
        data={{ columns: trajColumns, rows: trajectoryRows(plan), filename: "strategic-plan-trajectory" }}
        notes={
          <>
            Holding today&apos;s composition with the same money gives {fmtIndex(s.bau_final_fsfsi_acc, 3)} in {end.year}; the
            optimal composition is worth {fmtIndex(s.composition_gain, 3)} more of the reduction. The plan is on or below
            its year target in {s.years_on_track} of {plan.params.horizon} years.
          </>
        }
      >
        <TrajectoryChart plan={plan} />
      </Figure>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <Figure
          title="Where the plan moves the money"
          subtitle={`Component shares of the envelope (%), ${plan.base.year} and ${end.year}`}
          data={{ columns: compColumns, rows: plan.components, filename: "strategic-plan-components", initialSort: { key: "shift", desc: true } }}
        >
          <DotRows
            ariaLabel="Component shares now and at the end of the plan"
            rows={bySorted(plan.components, (r) => r.shift_pp).map((r) => ({
              id: r.id,
              label: r.name,
              from: "now",
              to: "end",
              right: fmtPp(r.shift_pp),
              rightStrong: r.shift_pp > 0,
              marks: [
                { key: "now", value: r.share, kind: "hollow", title: `${plan.base.year}: ${fmtPct(r.share, 1)}` },
                { key: "end", value: r.end_share, kind: "filled", title: `${end.year}: ${fmtPct(r.end_share, 1)}` },
              ],
            }))}
            max={shareMax}
            format={(v) => `${Math.round(v * 100)}%`}
            rightHeader="Shift (pp)"
            legend={[
              { kind: "hollow", label: plan.base.year },
              { kind: "filled", label: `${end.year}, plan` },
            ]}
          />
        </Figure>
        <Figure
          title="How accumulated stress moves in each component"
          subtitle={`Accumulated component stress (0–1), ${plan.base.year} and ${end.year}`}
          data={{ columns: compColumns, rows: plan.components, filename: "strategic-plan-components", initialSort: { key: "chg", desc: false } }}
        >
          <DotRows
            ariaLabel="Accumulated component stress now, at the end of the plan and with today's composition"
            rows={bySorted(plan.components, (r) => r.acc_stress).map((r) => ({
              id: r.id,
              label: r.name,
              from: "now",
              to: "end",
              right: Math.round(r.change_pct) === 0 ? "0%" : `${r.change_pct > 0 ? "+" : "−"}${Math.abs(r.change_pct).toFixed(0)}%`,
              rightStrong: r.change_pct > 0,
              marks: [
                { key: "bau", value: r.bau_end_acc_stress, kind: "diamond", title: `${end.year}, today's composition: ${fmtIndex(r.bau_end_acc_stress, 3)}` },
                { key: "now", value: r.acc_stress, kind: "hollow", title: `${plan.base.year}: ${fmtIndex(r.acc_stress, 3)}` },
                { key: "end", value: r.end_acc_stress, kind: "filled", title: `${end.year}, plan: ${fmtIndex(r.end_acc_stress, 3)}` },
              ],
            }))}
            max={stressMax}
            format={(v) => v.toFixed(2)}
            rightHeader="Change"
            legend={[
              { kind: "hollow", label: plan.base.year },
              { kind: "filled", label: `${end.year}, plan` },
              { kind: "diamond", label: `${end.year}, today's composition` },
            ]}
          />
        </Figure>
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
        <Figure
          className="xl:col-span-7"
          title={`The envelope grows from ${fmtMoney(plan.base.envelope)} to ${fmtMoney(s.final_envelope)} ${cur}`}
          subtitle={`Budget envelope by year (${cur}), ${fmtPct(plan.params.growth, 1)} growth a year`}
          data={{ columns: trajColumns, rows: trajectoryRows(plan), filename: "strategic-plan-envelope" }}
        >
          <EnvelopeChart plan={plan} currency={cur} />
        </Figure>
        <section className="xl:col-span-5" aria-labelledby="plan-reading">
          <h2 id="plan-reading" className="t-h3">
            Reading the plan
          </h2>
          <ul className="mt-3 space-y-3 t-ui text-ink-muted">
            <li>
              {s.reached ? (
                s.first_year_on_target === end.year ? (
                  <>The target is met in the last plan year, {end.year}, with no margin to spare.</>
                ) : (
                  <>
                    The target is met in {s.first_year_on_target},{" "}
                    {plan.years.length - plan.years.findIndex((y) => y.year === s.first_year_on_target) - 1} year(s) before the end of the horizon.
                  </>
                )
              ) : s.required_growth !== null ? (
                <>The target is out of reach at {fmtPct(plan.params.growth, 1)} growth. It needs {fmtPct(s.required_growth, 1)} a year, a longer horizon, a faster pace or a smaller target.</>
              ) : (
                <>The target cannot be met within {plan.params.horizon} years at any growth rate up to 100% a year. Stress persists: choose a longer horizon or a smaller target.</>
              )}
            </li>
            <li>
              The dashed line spends the same money in today&apos;s proportions. The gap between it and the plan line is
              what reallocation buys on top of the extra money.
            </li>
            {residual.length ? (
              <li>
                {residual.length === 1 ? `${residual[0]} is` : `${residual.slice(0, -1).join(", ")} and ${residual[residual.length - 1]} are`} still in
                the high or critical class at the end of the plan. <StressBadge cls={plan.components.find((c) => c.id === s.residual_high[0])!.end_class} />
              </li>
            ) : (
              <li>No component is left in the high or critical class at the end of the plan.</li>
            )}
            {plan.components.some((c) => c.change_pct > 5) ? (
              <li>
                Stress rises in {plan.components.filter((c) => c.change_pct > 5).map((c) => c.name).join(", ")}: the optimum moves money away from
                components where it does least, and their accumulated stress climbs as a result.
              </li>
            ) : null}
          </ul>
          <h3 className="mt-6 t-h4">Assumptions</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 t-caption text-ink-subtle">
            {plan.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
          <Link
            href={`/countries/${id}/strategy${pp.query}`}
            className="mt-6 inline-flex items-center gap-1.5 t-ui font-medium text-green-700 underline-offset-4 hover:underline"
          >
            Check the plan against the national strategy <ArrowRight aria-hidden className="size-4" />
          </Link>
        </section>
      </div>
    </div>
  );
}

function Field({ label, value, note, children }: { label: string; value: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="t-ui font-medium text-ink">{label}</span>
        <span className="t-caption tabular text-ink-muted">{value}</span>
      </div>
      <div className="mt-2">{children}</div>
      {note ? <p className="mt-1.5 t-micro text-ink-subtle">{note}</p> : null}
    </div>
  );
}

