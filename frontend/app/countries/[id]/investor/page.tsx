"use client";

import * as React from "react";
import Link from "next/link";
import { useAssessment, useInvestment } from "@/lib/api";
import { useCountryCtx } from "@/components/shell/country-context";
import { Kpi, KpiRow } from "@/components/kpi";
import { Figure } from "@/components/charts/figure";
import { DotRows } from "@/components/charts/dot-rows";
import { ProgrammePathChart } from "@/components/charts/plan-charts";
import { DataTable } from "@/components/data-table";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";
import { DiagnosisBadge } from "@/components/ui/badge";
import { Input } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { Slider } from "@/components/ui/slider";
import { planParamsOf, usePlanParams } from "@/lib/use-plan-params";
import { fmtIndex, fmtMoney, fmtPct, fmtPp } from "@/lib/format";
import { diagnosisLabel } from "@/lib/encodings";
import { cn } from "@/lib/utils";
import type { ColumnSpec } from "@/lib/csv";
import type { Assessment, InvestmentIndicator, InvestmentRequest, InvestmentSplit } from "@/lib/types";

export default function InvestorPage() {
  const { id, controls } = useCountryCtx();
  const { data: a, error, mutate } = useAssessment(id, { ...controls, year: undefined });
  if (error) return <ErrorState error={error} onRetry={() => void mutate()} />;
  if (!a) return <PageSkeleton />;
  return <Investor key={`${id}-${a.year}`} a={a} />;
}

function Investor({ a }: { a: Assessment }) {
  const { id, profile, controls, componentName } = useCountryCtx();
  const pp = usePlanParams();
  const cur = profile.currency;
  const F = a.system.envelope;

  // default: the component the optimum adds most money to
  const start = React.useMemo(() => [...a.components].sort((x, y) => y.shift_pp - x.shift_pp)[0]?.id, [a]);
  const [name, setName] = React.useState("Investor programme");
  const [comps, setComps] = React.useState<string[]>(start ? [start] : []);
  const [inds, setInds] = React.useState<string[]>([]);
  const [share, setShare] = React.useState(0.05);
  const [shareLive, setShareLive] = React.useState(0.05);
  const [years, setYears] = React.useState(Math.min(3, pp.horizon));
  const [split, setSplit] = React.useState<InvestmentSplit>("equal");
  React.useEffect(() => {
    const t = setTimeout(() => setShare(shareLive), 300);
    return () => clearTimeout(t);
  }, [shareLive]);
  const yrs = Math.min(years, pp.horizon);
  const amount = +(share * F).toFixed(4);

  const body: InvestmentRequest | null =
    comps.length || inds.length
      ? {
          name,
          components: comps,
          indicators: inds,
          amount,
          years: yrs,
          split,
          weighting: controls.weighting,
          scenario: controls.scenario,
          response: controls.response,
          ...planParamsOf(pp),
        }
      : null;
  const { data: r, error, isValidating } = useInvestment(id, body);

  const byComp = React.useMemo(() => {
    const m: Record<string, typeof a.indicators> = {};
    a.indicators.forEach((i) => (m[i.component] ??= []).push(i));
    return m;
  }, [a]);
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const indColumns: ColumnSpec<InvestmentIndicator>[] = [
    { key: "code", header: "Code", value: (d) => d.code, className: "font-mono text-small" },
    { key: "name", header: "Indicator", value: (d) => d.name, className: "min-w-[180px]" },
    { key: "comp", header: "Component", value: (d) => componentName(d.component) },
    { key: "added", header: "Programme money", short: "Programme", unit: cur, numeric: true, value: (d) => +d.added.toFixed(2), format: (v) => fmtMoney(v) },
    { key: "best", header: "Best use of the same money", short: "Best use", unit: cur, numeric: true, value: (d) => +d.best_added.toFixed(2), format: (v) => fmtMoney(v) },
    { key: "s0", header: "Stress without", short: "Without", numeric: true, value: (d) => +d.stress.toFixed(3), format: (v) => v.toFixed(3) },
    { key: "s1", header: "Stress with", short: "With", numeric: true, value: (d) => +d.stress_with.toFixed(3), format: (v) => v.toFixed(3) },
    { key: "red", header: "Contribution to the index reduction", short: "Index cut", numeric: true, value: (d) => +d.reduction.toFixed(5), format: (v) => v.toFixed(4) },
    { key: "dx", header: "Diagnosis", value: (d) => diagnosisLabel[d.diagnosis], cell: (d) => <DiagnosisBadge dx={d.diagnosis} /> },
  ];

  return (
    <div className="space-y-8">
      <p className="max-w-[80ch] t-ui text-ink-muted">
        A development partner or investor brings money from outside the national budget and earmarks it. Choose what the
        programme funds and how much it brings each year. The page scores it against the best use of the same money,
        against the national plan and against the national strategy.
      </p>

      <section aria-label="Programme settings" className="grid grid-cols-1 gap-6 border border-rule bg-surface p-5 xl:grid-cols-12" data-print-hide>
        <div className="space-y-5 xl:col-span-5">
          <div>
            <label htmlFor="inv-name" className="t-ui font-medium text-ink">
              Programme name
            </label>
            <Input id="inv-name" className="mt-2" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="t-ui font-medium text-ink">Money per year</span>
              <span className="t-caption tabular text-ink-muted">
                {fmtMoney(shareLive * F, cur)} ({fmtPct(shareLive, 1)} of the {a.year} envelope)
              </span>
            </div>
            <Slider className="mt-2" label="Money per year" value={shareLive} min={0.005} max={0.2} step={0.0025} onValueChange={setShareLive} />
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-4">
            <div>
              <div className="t-ui font-medium text-ink">Years of disbursement</div>
              <Segmented
                className="mt-2"
                label="Years of disbursement"
                size="sm"
                value={String(yrs)}
                onValueChange={(v) => setYears(Number(v))}
                options={Array.from({ length: pp.horizon }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
              />
            </div>
            <div>
              <div className="t-ui font-medium text-ink">Split within the selection</div>
              <Segmented
                className="mt-2"
                label="Split within the selection"
                size="sm"
                value={split}
                onValueChange={(v) => setSplit(v)}
                options={[
                  { value: "equal", label: "Equal", title: "The same amount to each selected indicator" },
                  { value: "best", label: "Best use", title: "Where each unit cuts stress most, within the selection" },
                ]}
              />
            </div>
          </div>
          <p className="t-micro text-ink-subtle">
            Plan settings ({pp.horizon} years, {fmtPct(pp.growth, 1)} envelope growth) come from the{" "}
            <Link className="text-green-700 underline-offset-4 hover:underline" href={`/countries/${id}/plan${pp.query}`}>
              strategic plan
            </Link>
            .
          </p>
        </div>

        <div className="xl:col-span-7">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="t-ui font-medium text-ink">What the programme funds</span>
            <span className="t-caption text-ink-muted">
              {r ? `${r.programme.n_indicators} indicators selected` : comps.length || inds.length ? "…" : "Nothing selected"}
            </span>
          </div>
          <p className="mt-1 t-micro text-ink-subtle">A whole component funds all its assessed indicators; or pick single indicators below.</p>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Components">
            {profile.components.map((c) => {
              const on = comps.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setComps((l) => toggle(l, c.id))}
                  className={cn(
                    "h-8 rounded-sm border px-3 text-small font-medium",
                    on ? "border-evergreen bg-evergreen text-white" : "border-rule-strong bg-surface text-ink-muted hover:bg-ink-4 hover:text-ink",
                  )}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
          <details className="mt-3 rounded-sm border border-rule">
            <summary className="cursor-pointer px-3 py-2 t-ui text-ink">
              Single indicators {inds.length ? <span className="text-ink-subtle">({inds.length} picked)</span> : null}
            </summary>
            <div className="grid max-h-72 grid-cols-1 gap-x-6 overflow-y-auto px-3 pb-3 sm:grid-cols-2">
              {profile.components.map((c) =>
                byComp[c.id]?.length ? (
                  <fieldset key={c.id} className="mt-2">
                    <legend className="t-micro font-semibold text-ink-subtle">{c.name}</legend>
                    {byComp[c.id].map((i) => {
                      const viaComp = comps.includes(c.id);
                      return (
                        <label key={i.code} className={cn("flex items-center gap-2 py-0.5 text-small", viaComp ? "text-ink-subtle" : "text-ink")}>
                          <input
                            type="checkbox"
                            className="size-4 accent-[var(--evergreen)]"
                            checked={viaComp || inds.includes(i.code)}
                            disabled={viaComp}
                            onChange={() => setInds((l) => toggle(l, i.code))}
                          />
                          <span className="font-mono text-micro">{i.code}</span>
                          <span className="truncate">{i.name}</span>
                        </label>
                      );
                    })}
                  </fieldset>
                ) : null,
              )}
            </div>
          </details>
        </div>
      </section>

      {!body ? (
        <EmptyState title="Choose what the programme funds">
          <p className="t-ui text-ink-muted">Select at least one component or indicator above.</p>
        </EmptyState>
      ) : error ? (
        <ErrorState error={error} />
      ) : !r ? (
        <PageSkeleton />
      ) : (
        <Results r={r} indColumns={indColumns} busy={isValidating} />
      )}
    </div>
  );
}

function Results({
  r,
  indColumns,
  busy,
}: {
  r: NonNullable<ReturnType<typeof useInvestment>["data"]>;
  indColumns: ColumnSpec<InvestmentIndicator>[];
  busy: boolean;
}) {
  const { id, profile } = useCountryCtx();
  const cur = profile.currency;
  const s = r.snapshot;
  const pl = r.plan;
  const st = r.strategy;
  const vfm = s.value_for_money;
  const amount = r.programme.amount;
  const compMax = Math.max(0.1, ...r.components.flatMap((c) => [c.added / amount, c.best_added / amount]));
  const areaMax = Math.max(0.1, ...st.areas.flatMap((a) => [a.programme_share, a.target_share, a.actual_share]));
  const bestComp = [...r.components].sort((x, y) => y.best_added - x.best_added)[0];

  return (
    <div className={cn("space-y-8 transition-opacity", busy && "opacity-70")} aria-busy={busy}>
      <KpiRow>
        <Kpi
          label="Stress index with the programme"
          year={r.year}
          value={s.fsfsi_with}
          format={(v) => v.toFixed(3)}
          sub={<>from {fmtIndex(s.fsfsi, 3)} without it ({fmtPct(s.reduction_pct, 1)} lower)</>}
          hint="One year's disbursement added to the actual allocation of the latest year."
        />
        <Kpi
          label="Value for money"
          year={r.year}
          value={vfm * 100}
          format={(v) => v.toFixed(0)}
          unit="%"
          sub={<>{fmtPct(s.value_within_selection)} of the best use within its own selection</>}
          hint="Reduction achieved divided by the reduction the same money would buy at its best use anywhere."
        />
        <Kpi
          label="Against budget support"
          year={r.year}
          value={s.vs_national}
          format={(v) => v.toFixed(2)}
          unit="×"
          sub={<>{s.vs_national >= 1 ? "More" : "Less"} than the same money given to the budget in today&apos;s proportions</>}
        />
        <Kpi
          label="Extra reduction by the end of the plan"
          year={pl.end_year}
          value={pl.additional_reduction}
          format={(v) => v.toFixed(4)}
          sub={
            pl.with_reached && !pl.plan_reached ? (
              <>The programme lets the plan meet its target ({pl.first_year_with})</>
            ) : pl.with_reached ? (
              <>Target met {pl.first_year_with === pl.first_year_plan ? `in ${pl.first_year_with} either way` : `in ${pl.first_year_with} instead of ${pl.first_year_plan}`}</>
            ) : (
              <>The plan still misses its target</>
            )
          }
          hint="Accumulated index of the plan alone minus the plan with the programme on top."
        />
      </KpiRow>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <Figure
          title={
            vfm >= 0.9
              ? "The programme puts its money close to where it cuts stress most"
              : `The same money would cut stress most in ${bestComp?.name ?? "another component"}`
          }
          subtitle={`Share of the programme's yearly ${fmtMoney(amount, cur)} by component (%), as designed and at its best use, ${r.year}`}
          data={{
            columns: [
              { key: "name", header: "Component", value: (c: (typeof r.components)[number]) => c.name },
              { key: "added", header: "Programme", unit: cur, numeric: true, value: (c) => +c.added.toFixed(2), format: (v) => fmtMoney(v) },
              { key: "best", header: "Best use", unit: cur, numeric: true, value: (c) => +c.best_added.toFixed(2), format: (v) => fmtMoney(v) },
              { key: "s0", header: "Mean stress without", numeric: true, value: (c) => +c.stress.toFixed(3), format: (v) => v.toFixed(3) },
              { key: "s1", header: "Mean stress with", numeric: true, value: (c) => +c.stress_with.toFixed(3), format: (v) => v.toFixed(3) },
            ] as ColumnSpec<(typeof r.components)[number]>[],
            rows: r.components,
            filename: "investor-components",
          }}
        >
          <DotRows
            ariaLabel="Programme money and best use by component"
            rows={[...r.components]
              .sort((x, y) => y.best_added + y.added - (x.best_added + x.added))
              .map((c) => ({
                id: c.id,
                label: c.name,
                from: "prog",
                to: "best",
                right: fmtPct(c.added / amount),
                rightStrong: c.added > 0,
                marks: [
                  { key: "prog", value: c.added / amount, kind: "hollow" as const, title: `Programme ${fmtMoney(c.added, cur)}` },
                  { key: "best", value: c.best_added / amount, kind: "filled" as const, title: `Best use ${fmtMoney(c.best_added, cur)}` },
                ],
              }))}
            max={compMax}
            format={(v) => `${Math.round(v * 100)}%`}
            rightHeader="Programme"
            legend={[
              { kind: "hollow", label: "Programme as designed" },
              { kind: "filled", label: "Best use of the same money" },
            ]}
          />
        </Figure>

        <Figure
          title={
            st.under_target_share >= 0.5
              ? `${fmtPct(st.under_target_share)} of the money goes to priority areas the budget leaves below target`
              : `Most of the money goes to priority areas already at or above their target share`
          }
          subtitle={`Share by priority area of ${st.name} (%): programme, national budget (${r.year}) and strategy target`}
          data={{
            columns: [
              { key: "code", header: "Code", value: (a: (typeof st.areas)[number]) => a.code },
              { key: "name", header: "Priority area", value: (a) => a.name },
              { key: "prog", header: "Programme share", unit: "%", numeric: true, value: (a) => +(a.programme_share * 100).toFixed(1), format: (v) => v.toFixed(1) },
              { key: "nat", header: "National share", unit: "%", numeric: true, value: (a) => +(a.actual_share * 100).toFixed(1), format: (v) => v.toFixed(1) },
              { key: "with", header: "National share with the programme", unit: "%", numeric: true, value: (a) => +(a.actual_share_with * 100).toFixed(1), format: (v) => v.toFixed(1) },
              { key: "target", header: "Target share", unit: "%", numeric: true, value: (a) => +(a.target_share * 100).toFixed(1), format: (v) => v.toFixed(1) },
              { key: "dev", header: "National minus target", unit: "pp", numeric: true, value: (a) => +a.deviation_pp.toFixed(1), format: (v) => fmtPp(v) },
            ] as ColumnSpec<(typeof st.areas)[number]>[],
            rows: st.areas,
            filename: "investor-strategy",
          }}
          notes={<>Budget alignment moves from {fmtPct(st.alignment_before)} to {fmtPct(st.alignment_after)} once the programme is counted.</>}
        >
          <DotRows
            ariaLabel="Programme, national and target shares by priority area"
            rows={st.areas.map((a) => ({
              id: a.code,
              label: `${a.code} ${a.name}`,
              right: fmtPp(a.deviation_pp),
              rightStrong: a.deviation_pp < 0 && a.programme_share > 0,
              marks: [
                { key: "t", value: a.target_share, kind: "tick" as const, title: `Target ${fmtPct(a.target_share, 1)}` },
                { key: "n", value: a.actual_share, kind: "hollow" as const, title: `National ${fmtPct(a.actual_share, 1)}` },
                { key: "p", value: a.programme_share, kind: "filled" as const, title: `Programme ${fmtPct(a.programme_share, 1)}` },
              ],
            }))}
            max={areaMax}
            format={(v) => `${Math.round(v * 100)}%`}
            rightHeader="National − target (pp)"
            legend={[
              { kind: "tick", label: "Strategy target" },
              { kind: "hollow", label: `National budget, ${r.year}` },
              { kind: "filled", label: "Programme" },
            ]}
          />
        </Figure>
      </div>

      <Figure
        title={`On top of the plan, the programme lowers accumulated stress by ${fmtIndex(pl.additional_reduction, 4)} by ${pl.end_year}`}
        subtitle={`Accumulated stress index (0–1), plan alone and with ${r.programme.years} year(s) of ${fmtMoney(amount, cur)} on top`}
        data={{
          columns: [
            { key: "year", header: "Year", value: (d: (typeof pl.path)[number]) => d.year },
            { key: "disb", header: "Disbursed", unit: cur, numeric: true, value: (d) => +d.disbursed.toFixed(2), format: (v) => fmtMoney(v) },
            { key: "plan", header: "Plan alone, accumulated", numeric: true, value: (d) => +d.plan_acc.toFixed(4), format: (v) => v.toFixed(3) },
            { key: "with", header: "With the programme, accumulated", numeric: true, value: (d) => +d.with_acc.toFixed(4), format: (v) => v.toFixed(3) },
            { key: "tgt", header: "Year target", numeric: true, value: (d) => +d.year_target.toFixed(4), format: (v) => v.toFixed(3) },
          ] as ColumnSpec<(typeof pl.path)[number]>[],
          rows: pl.path,
          filename: "investor-plan-path",
        }}
        notes={<>After the last disbursement the programme&apos;s effect fades at each component&apos;s persistence rate.</>}
      >
        <ProgrammePathChart r={r} />
      </Figure>

      <section aria-labelledby="inv-ind" className="space-y-3">
        <h2 id="inv-ind" className="t-h3">
          Indicators the money reaches
        </h2>
        <p className="max-w-[80ch] t-ui text-ink-muted">
          Selected indicators, and any others the best use of the same money would fund, ranked by their contribution to the
          index reduction in {r.year}.
        </p>
        <DataTable
          rows={r.indicators}
          columns={indColumns}
          caption="Indicators reached by the programme"
          captionHidden
          filename={`${id}-investor-indicators`}
          csvPreamble={[r.programme.name, profile.name]}
          rowKey={(d) => d.code}
        />
      </section>
    </div>
  );
}
