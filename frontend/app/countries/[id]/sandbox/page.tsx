"use client";

import * as React from "react";
import { Download, Printer, RotateCcw, Save } from "lucide-react";
import { api, useAssessment } from "@/lib/api";
import { useCountryCtx } from "@/components/shell/country-context";
import { ErrorState, PageSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { StressBadge } from "@/components/ui/badge";
import { Figure, LegendItem } from "@/components/charts/figure";
import { downloadCsv, toCsv, type ColumnSpec } from "@/lib/csv";
import { fmtIndex, fmtMoney, fmtMs, fmtPct, fmtSigned } from "@/lib/format";
import type { Assessment, DraftScore } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Move one share and rescale the others so the total stays at exactly 1. */
function rebalance(shares: Record<string, number>, id: string, v: number): Record<string, number> {
  const next = { ...shares };
  const clamped = Math.max(0, Math.min(1, v));
  const others = Object.keys(next).filter((k) => k !== id);
  const rest = others.reduce((a, k) => a + next[k], 0);
  const remaining = 1 - clamped;
  next[id] = clamped;
  if (rest <= 1e-12) others.forEach((k) => (next[k] = remaining / Math.max(others.length, 1)));
  else others.forEach((k) => (next[k] = (next[k] / rest) * remaining));
  return next;
}

export default function SandboxPage() {
  const { id, profile, controls } = useCountryCtx();
  const { data: a, error, mutate } = useAssessment(id, controls);
  if (error) return <ErrorState error={error} onRetry={() => void mutate()} />;
  if (!a) return <PageSkeleton />;
  return <Sandbox key={`${a.year}-${a.weighting}-${a.scenario}-${a.response}`} a={a} currency={profile.currency} />;
}

interface ChangeRow {
  id: string;
  name: string;
  enacted: number;
  draft: number;
  stressEnacted: number;
  stressDraft: number;
  weight: number;
  contribution: number;
}

function Sandbox({ a, currency }: { a: Assessment; currency: string }) {
  const { id, profile, controls } = useCountryCtx();
  const storeKey = `fsfsi-draft-${id}-${a.year}`;
  const actual = React.useMemo(() => Object.fromEntries(a.components.map((c) => [c.id, c.share])), [a]);
  const optimum = React.useMemo(() => Object.fromEntries(a.components.map((c) => [c.id, c.optimal_share])), [a]);
  const [shares, setShares] = React.useState<Record<string, number>>(actual);
  const [mult, setMult] = React.useState(1);
  const [score, setScore] = React.useState<DraftScore | null>(null);
  const [pending, setPending] = React.useState(false);
  const [err, setErr] = React.useState<unknown>(null);
  const [saved, setSaved] = React.useState<string>("");

  // restore a saved draft for this country and year (per-viewer convenience only)
  React.useEffect(() => {
    const raf = requestAnimationFrame(() => {
      try {
        const raw = localStorage.getItem(storeKey);
        if (!raw) return;
        const d = JSON.parse(raw) as { shares: Record<string, number>; mult: number; at: string };
        if (d.shares && Object.keys(d.shares).every((k) => k in actual)) {
          setShares(d.shares);
          setMult(d.mult || 1);
          setSaved(d.at);
        }
      } catch {}
    });
    return () => cancelAnimationFrame(raf);
  }, [storeKey, actual]);

  React.useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setPending(true);
      try {
        const res = await api.draft(
          id,
          {
            year: a.year,
            component_shares: shares,
            envelope_multiplier: mult,
            weighting: controls.weighting,
            scenario: controls.scenario,
            response: controls.response,
          },
          ctrl.signal,
        );
        setScore(res);
        setErr(null);
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) setErr(e);
      } finally {
        if (!ctrl.signal.aborted) setPending(false);
      }
    }, 150);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [id, a.year, shares, mult, controls.weighting, controls.scenario, controls.response]);

  const total = Object.values(shares).reduce((x, y) => x + y, 0);
  const comps = profile.components.filter((c) => c.id in shares);
  const delta = score ? score.fsfsi - a.system.fsfsi : null;
  const draftComp = Object.fromEntries((score?.components ?? []).map((c) => [c.id, c]));
  const changed = comps.some((c) => Math.abs((shares[c.id] ?? 0) - (actual[c.id] ?? 0)) > 5e-4) || Math.abs(mult - 1) > 1e-3;

  const changes: ChangeRow[] = a.components
    .map((c) => {
      const d = draftComp[c.id];
      const sd = d?.stress ?? c.stress;
      return {
        id: c.id,
        name: c.name,
        enacted: c.share,
        draft: shares[c.id] ?? c.share,
        stressEnacted: c.stress,
        stressDraft: sd,
        weight: c.weight,
        contribution: c.weight * (sd - c.stress),
      };
    })
    .sort((x, y) => Math.abs(y.contribution) - Math.abs(x.contribution));

  const columns: ColumnSpec<ChangeRow>[] = [
    { key: "name", header: "Component", value: (r) => r.name },
    { key: "enacted", header: "Enacted share", unit: "%", numeric: true, value: (r) => +(r.enacted * 100).toFixed(1), format: (v) => v.toFixed(1) },
    { key: "draft", header: "Draft share", unit: "%", numeric: true, value: (r) => +(r.draft * 100).toFixed(1), format: (v) => v.toFixed(1) },
    { key: "se", header: "Stress, enacted", unit: "0–1", numeric: true, value: (r) => +r.stressEnacted.toFixed(3), format: (v) => v.toFixed(2) },
    { key: "sd", header: "Stress, draft", unit: "0–1", numeric: true, value: (r) => +r.stressDraft.toFixed(3), format: (v) => v.toFixed(2) },
    { key: "contrib", header: "Weighted change in stress", numeric: true, value: (r) => +r.contribution.toFixed(4), format: (v) => fmtSigned(v, 3) },
  ];

  const exportScorecard = () =>
    downloadCsv(
      `${id}-${a.year}-draft-scorecard`,
      toCsv(columns, changes, [
        `Draft-budget scorecard, ${profile.name}, ${a.year}${profile.kind === "synthetic" ? " (synthetic demonstration data)" : ""}`,
        `Envelope multiplier ${mult.toFixed(2)}; draft stress index ${fmtIndex(score?.fsfsi, 3)} against enacted ${fmtIndex(a.system.fsfsi, 3)}`,
      ]),
    );

  return (
    <div className="pb-20">
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
        {/* left pane: draft entry */}
        <section className="xl:col-span-7" aria-labelledby="draft-h">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="draft-h" className="t-h2">
                Draft budget
              </h2>
              <p className="mt-1 t-ui text-ink-muted">
                Component shares of the envelope. Moving one share rescales the others so the total stays at 100%. The
                tick on each track marks the enacted share.
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setShares(optimum)}>
              Start from the optimum
            </Button>
          </div>

          <div className={cn("mt-4 border-l-[3px] px-3 py-2 t-ui", Math.abs(total - 1) < 1e-3 ? "border-evergreen bg-surface text-ink" : "border-alert bg-surface text-alert")} role="status">
            Shares total {fmtPct(total, 1)}
            {changed ? "; the draft differs from the enacted budget." : "; the draft equals the enacted budget."}
          </div>

          <div className="mt-3 overflow-x-auto rounded-[2px] border border-rule bg-surface">
            <table className="w-full min-w-[560px] border-collapse t-ui tabular">
              <caption className="sr-only">Draft component shares</caption>
              <thead>
                <tr>
                  <th scope="col" className="border-b border-rule-strong bg-ivory px-3 py-1.5 text-left text-[12px] font-semibold text-ink-muted">
                    Component
                  </th>
                  <th scope="col" className="border-b border-rule-strong bg-ivory px-3 py-1.5 text-left text-[12px] font-semibold text-ink-muted">
                    Share
                  </th>
                  <th scope="col" className="border-b border-rule-strong bg-ivory px-3 py-1.5 text-right text-[12px] font-semibold text-ink-muted">
                    Draft (%)
                  </th>
                  <th scope="col" className="border-b border-rule-strong bg-ivory px-3 py-1.5 text-right text-[12px] font-semibold text-ink-muted">
                    Change (pp)
                  </th>
                </tr>
              </thead>
              <tbody>
                {comps.map((c) => {
                  const v = shares[c.id] ?? 0;
                  const diff = (v - (actual[c.id] ?? 0)) * 100;
                  return (
                    <tr key={c.id} className="hover:bg-ink-4">
                      <th scope="row" className="border-b border-rule px-3 py-1.5 text-left font-normal text-ink">
                        {c.name}
                      </th>
                      <td className="w-[38%] border-b border-rule px-3 py-1.5">
                        <Slider label={`${c.name} share`} value={v} min={0} max={1} step={0.0025} marker={actual[c.id]} onValueChange={(nv) => setShares((s) => rebalance(s, c.id, nv))} />
                      </td>
                      <td className="border-b border-rule px-3 py-1.5 text-right">
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={100}
                          step={0.1}
                          aria-label={`${c.name} draft share, per cent`}
                          value={(v * 100).toFixed(1)}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            if (Number.isFinite(n)) setShares((s) => rebalance(s, c.id, n / 100));
                          }}
                          className="h-8 w-20 rounded-[2px] border border-rule-strong bg-surface px-2 text-right"
                        />
                      </td>
                      <td className={cn("border-b border-rule px-3 py-1.5 text-right", Math.abs(diff) < 0.05 ? "text-ink-subtle" : "font-medium text-ink")}>
                        {Math.abs(diff) < 0.05 ? "0.0" : fmtSigned(diff, 1)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid items-center gap-3 border border-rule bg-surface px-3 py-3 sm:grid-cols-[minmax(0,10rem)_1fr_auto]">
            <label htmlFor="mult" className="t-ui font-medium text-ink">
              Envelope size
            </label>
            <Slider label="Envelope multiplier" value={Math.log2(mult)} min={-2} max={3} step={0.01} marker={0} onValueChange={(v) => setMult(Math.pow(2, v))} />
            <span className="flex items-center gap-2 t-ui tabular">
              <input
                id="mult"
                type="number"
                min={0.25}
                max={8}
                step={0.05}
                value={mult.toFixed(2)}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n) && n > 0) setMult(Math.min(8, Math.max(0.25, n)));
                }}
                className="h-8 w-20 rounded-[2px] border border-rule-strong bg-surface px-2 text-right"
              />
              × = {fmtMoney(a.system.envelope * mult, currency)}
            </span>
          </div>
        </section>

        {/* right pane: live score */}
        <section className="space-y-6 xl:col-span-5" aria-labelledby="score-h">
          <div>
            <h2 id="score-h" className="t-h2">
              Live score, {a.year}
            </h2>
            <p className="mt-1 t-caption text-ink-subtle" aria-live="polite">
              {pending ? "Scoring the draft" : score ? `Scored in ${fmtMs(score.compute_ms)}` : "Waiting for the first score"}
            </p>
          </div>
          {err ? (
            <ErrorState error={err} />
          ) : (
            <dl className="grid grid-cols-2 gap-3">
              <div className="border-l-2 border-evergreen bg-surface py-3 pl-4 pr-3">
                <dt className="t-ui font-medium text-ink">Stress index, draft</dt>
                <dd className="display-num text-[1.75rem] leading-9 text-evergreen">{fmtIndex(score?.fsfsi, 3)}</dd>
                <dd className="t-caption text-ink-muted">
                  {delta === null ? "—" : `${fmtSigned(delta, 3)} against enacted ${fmtIndex(a.system.fsfsi, 3)}`}
                </dd>
                {score ? <dd className="mt-1.5"><StressBadge cls={score.stress_class} /></dd> : null}
              </div>
              <div className="border-l-2 border-evergreen bg-surface py-3 pl-4 pr-3">
                <dt className="t-ui font-medium text-ink">Efficiency, draft</dt>
                <dd className="display-num text-[1.75rem] leading-9 text-evergreen">{fmtIndex(score?.efficiency, 3)}</dd>
                <dd className="t-caption text-ink-muted">enacted {fmtIndex(a.system.efficiency, 3)}</dd>
              </div>
            </dl>
          )}

          <Figure
            title={delta === null ? "Component stress under the draft" : delta < -1e-6 ? "The draft lowers stress against the enacted budget" : delta > 1e-6 ? "The draft raises stress against the enacted budget" : "The draft leaves stress unchanged"}
            subtitle={`Component stress (0–1): bar is the draft, tick is the enacted budget, ${a.year}`}
            data={{ columns, rows: changes, filename: "draft-component-stress" }}
          >
            <BulletBars rows={changes} />
          </Figure>

          <div>
            <h3 className="t-h4">Changes that moved the score most</h3>
            <ol className="mt-2 divide-y divide-rule border-y border-rule t-ui">
              {changes.slice(0, 4).map((r) => (
                <li key={r.id} className="flex items-baseline justify-between gap-3 py-2">
                  <span>
                    <span className="text-ink">{r.name}</span>
                    <span className="block t-caption text-ink-subtle">
                      share {fmtPct(r.enacted, 1)} → {fmtPct(r.draft, 1)}
                    </span>
                  </span>
                  <span className="tabular font-medium text-ink">{fmtSigned(r.contribution, 3)}</span>
                </li>
              ))}
            </ol>
            <p className="mt-1.5 t-caption text-ink-subtle">Weighted change in component stress, draft minus enacted.</p>
          </div>
        </section>
      </div>

      {/* sticky footer bar */}
      <div className="sticky bottom-0 z-20 mt-8 flex flex-wrap items-center gap-2 border-t border-rule-strong bg-paper py-3" data-print-hide>
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            const at = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
            try {
              localStorage.setItem(storeKey, JSON.stringify({ shares, mult, at }));
              setSaved(at);
            } catch {
              setSaved("");
            }
          }}
        >
          <Save aria-hidden /> Save draft
        </Button>
        <Button variant="secondary" size="sm" onClick={exportScorecard} disabled={!score}>
          <Download aria-hidden /> Export scorecard (CSV)
        </Button>
        <Button variant="secondary" size="sm" onClick={() => window.print()}>
          <Printer aria-hidden /> Print scorecard
        </Button>
        <Button
          variant="quiet"
          size="sm"
          onClick={() => {
            setShares(actual);
            setMult(1);
          }}
        >
          <RotateCcw aria-hidden /> Reset to enacted budget
        </Button>
        <span className="ml-auto t-caption text-ink-subtle" aria-live="polite">
          {saved ? `Draft saved in this browser, ${saved}` : "Drafts are saved in this browser only"}
        </span>
      </div>
    </div>
  );
}

/** BulletBar: draft component stress as a bar, the enacted value as a tick. */
function BulletBars({ rows }: { rows: ChangeRow[] }) {
  const ordered = [...rows].sort((x, y) => y.stressDraft - x.stressDraft);
  const max = Math.min(1, Math.max(0.2, ...rows.flatMap((r) => [r.stressDraft, r.stressEnacted])) * 1.1);
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-5">
        <LegendItem marker={<span className="h-2.5 w-4 bg-green-500" />} label="Draft" />
        <LegendItem marker={<span className="h-3.5 w-[3px] bg-ink" />} label="Enacted" />
      </div>
      <ul className="space-y-2">
        {ordered.map((r) => (
          <li key={r.id} className="grid grid-cols-[minmax(0,9rem)_1fr_3rem] items-center gap-3 t-caption">
            <span className="truncate text-ink" title={r.name}>
              {r.name}
            </span>
            <span className="relative h-4" aria-hidden>
              <span className="absolute inset-y-[3px] left-0 right-0 bg-ink-6" />
              <span className="absolute inset-y-[3px] left-0 bg-green-500" style={{ width: `${(r.stressDraft / max) * 100}%` }} />
              <span className="absolute inset-y-0 w-[3px] -translate-x-1/2 bg-ink" style={{ left: `${(r.stressEnacted / max) * 100}%` }} />
            </span>
            <span className="text-right tabular text-ink">{fmtIndex(r.stressDraft)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
