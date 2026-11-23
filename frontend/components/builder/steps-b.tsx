"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CircleAlert, Loader2, Save } from "lucide-react";
import { api } from "@/lib/api";
import { ahp } from "@/lib/math";
import { componentStyleMap } from "@/lib/encodings";
import { fmtIndex, fmtMultiple, fmtPct, scenarioLabel } from "@/lib/format";
import type { Assessment } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Select } from "../ui/select";
import { StressBadge } from "../ui/badge";
import { MarkerGlyph } from "../marker";
import { ErrorState, ChartSkeleton } from "../states";
import { MoneyVsStress } from "../charts/money-vs-stress";
import { DiagnosisPlane } from "../charts/diagnosis-plane";
import { ComponentTable } from "../component-table";
import { toProfile, toRequestBody, STORAGE_KEY, type Draft } from "./state";
import type { Update } from "./steps-a";

const SAATY: { v: number; label: string }[] = [9, 8, 7, 6, 5, 4, 3, 2, 1, 1 / 2, 1 / 3, 1 / 4, 1 / 5, 1 / 6, 1 / 7, 1 / 8, 1 / 9].map((v) => ({
  v,
  label: v >= 1 ? String(v) : `1/${Math.round(1 / v)}`,
}));

function nearestSaaty(x: number) {
  return SAATY.reduce((best, s) => (Math.abs(Math.log(s.v) - Math.log(x)) < Math.abs(Math.log(best.v) - Math.log(x)) ? s : best), SAATY[8]);
}

function NumCell({ value, onChange, label, step = "0.01", className }: { value: number; onChange: (v: number) => void; label: string; step?: string; className?: string }) {
  const [text, setText] = React.useState(String(value));
  const [prev, setPrev] = React.useState(value);
  if (prev !== value) {
    setPrev(value);
    setText(String(value));
  }
  return (
    <input
      type="number"
      inputMode="decimal"
      step={step}
      min={0}
      aria-label={label}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const v = Number(e.target.value);
        if (e.target.value.trim() !== "" && Number.isFinite(v) && v >= 0) onChange(v);
      }}
      className={cn("h-8 w-full rounded-md border border-line-strong bg-surface px-2 text-right text-[12.5px] tabular hover:border-ink-40", className)}
    />
  );
}

export function StepParameters({ draft, update }: { draft: Draft; update: Update }) {
  const idx = draft.components.map((c, i) => (c.included ? i : -1)).filter((i) => i >= 0);
  const comps = idx.map((i) => draft.components[i]);
  const styles = componentStyleMap(draft.components.map((c) => c.id));
  const sub = idx.map((i) => idx.map((j) => draft.ahp[i]?.[j] ?? 1));
  const res = ahp(sub);
  const [scenario, setScenario] = React.useState("normal_operations");
  const scenarios = Object.keys(draft.dependency);
  const latest = draft.years[draft.years.length - 1];
  const fByComp = React.useMemo(() => {
    const out: Record<string, number> = {};
    const row = draft.data[latest] ?? {};
    draft.indicators.forEach((i) => {
      const a = Number(row[i.code]?.allocation ?? 0);
      if (i.included && Number.isFinite(a)) out[i.component] = (out[i.component] ?? 0) + a;
    });
    return out;
  }, [draft, latest]);

  const setAhp = (i: number, j: number, v: number) =>
    update((d) => {
      const m = d.ahp.map((r) => [...r]);
      m[i][j] = v;
      m[j][i] = 1 / v;
      return { ...d, ahp: m, ahpEdited: true };
    });

  return (
    <div className="space-y-10">
      <section className="space-y-10">
        <div className="max-w-2xl">
          <div className="eyebrow mb-1">Sensitivity</div>
          <p className="mb-4 text-[13px] text-muted">How fast money closes each gap, per {draft.currency}.</p>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[12px] text-muted">
                <th className="pb-2 font-semibold">Component</th>
                <th className="w-32 pb-2 text-right font-semibold">Rate</th>
                <th className="w-28 pb-2 text-right font-semibold">Coverage {latest}</th>
              </tr>
            </thead>
            <tbody>
              {comps.map((c) => {
                const a = draft.sensitivities[c.id] ?? 0;
                const af = a * (fByComp[c.id] ?? 0);
                const ok = af === 0 || (af >= 0.1 && af <= 4);
                const cov = 1 - Math.exp(-af);
                return (
                  <tr key={c.id} className="border-t border-line">
                    <td className="py-1.5">
                      <span className="flex items-center gap-2">
                        <MarkerGlyph shape={styles[c.id].shape} fill={styles[c.id].fill} size={12} />
                        {c.name}
                      </span>
                    </td>
                    <td className="py-1.5">
                      <NumCell label={`alpha ${c.name}`} step="0.0001" value={+a.toPrecision(4)} onChange={(v) => update((d) => ({ ...d, sensitivities: { ...d.sensitivities, [c.id]: v } }))} />
                    </td>
                    <td className={cn("py-1.5 text-right tabular", ok ? "text-muted" : "font-semibold text-saffron-ink")}>{fmtPct(cov)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
            <div className="eyebrow">Expert comparisons</div>
            <div
              className={cn(
                "rounded-full px-3 py-1 text-[12px] font-semibold tabular",
                res.cr < 0.1 ? "bg-ink text-canvas" : "bg-saffron text-evergreen",
              )}
              aria-live="polite"
            >
              Consistency {res.cr.toFixed(3)} {res.cr < 0.1 ? "· ok" : "· revise"}
            </div>
          </div>
          <p className="mb-4 text-[13px] text-muted">How much more important is the row than the column (1–9).</p>
          <div className="overflow-x-auto">
            <table className="border-separate border-spacing-1 text-[12px]">
              <thead>
                <tr>
                  <th />
                  {comps.map((c) => (
                    <th key={c.id} className="px-1 text-center font-medium text-muted">
                      {c.short}
                    </th>
                  ))}
                  <th className="pl-3 text-left font-medium text-muted">Weight</th>
                </tr>
              </thead>
              <tbody>
                {idx.map((gi, a) => (
                  <tr key={gi}>
                    <th className="whitespace-nowrap pr-2 text-left font-normal">{comps[a].short}</th>
                    {idx.map((gj, b) => {
                      if (a === b)
                        return (
                          <td key={gj} className="h-8 w-14 rounded-md bg-ink-8 text-center text-muted">
                            1
                          </td>
                        );
                      const v = draft.ahp[gi]?.[gj] ?? 1;
                      if (b < a)
                        return (
                          <td key={gj} className="h-8 w-14 rounded-md text-center tabular text-muted" style={{ background: "var(--ink-4)" }}>
                            {nearestSaaty(v).label}
                          </td>
                        );
                      return (
                        <td key={gj} className="h-8 w-14">
                          <select
                            aria-label={`${comps[a].name} vs ${comps[b].name}`}
                            value={nearestSaaty(v).label}
                            onChange={(e) => {
                              const s = SAATY.find((x) => x.label === e.target.value);
                              if (s) setAhp(gi, gj, s.v);
                            }}
                            className="h-8 w-14 rounded-md border border-line-strong bg-surface px-1 text-center text-[12px] tabular hover:border-ink-40"
                          >
                            {SAATY.map((s) => (
                              <option key={s.label} value={s.label}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        </td>
                      );
                    })}
                    <td className="pl-3">
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-ink-8">
                          <span className="block h-full bg-ink" style={{ width: `${(res.weights[a] ?? 0) * 100 * 2.5}%` }} />
                        </span>
                        <span className="tabular">{fmtPct(res.weights[a], 1)}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
            <div className="eyebrow">Dependencies</div>
            <Select size="sm" label="Scenario" value={scenario} onValueChange={setScenario} options={scenarios.map((s) => ({ value: s, label: scenarioLabel(s) }))} />
          </div>
          <p className="mb-4 text-[13px] text-muted">Share of a failure in the row that reaches the column (0–1).</p>
          <div className="overflow-x-auto">
            <table className="border-separate border-spacing-1 text-[12px]">
              <thead>
                <tr>
                  <th />
                  {comps.map((c) => (
                    <th key={c.id} className="px-1 text-center font-medium text-muted">
                      {c.short}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {idx.map((gi, a) => (
                  <tr key={gi}>
                    <th className="whitespace-nowrap pr-2 text-left font-normal">{comps[a].short}</th>
                    {idx.map((gj, b) =>
                      a === b ? (
                        <td key={gj} className="h-8 w-16 rounded-md bg-ink-8 text-center text-muted">
                          —
                        </td>
                      ) : (
                        <td key={gj} className="w-16">
                          <NumCell
                            label={`dependency ${comps[a].name} to ${comps[b].name}`}
                            value={draft.dependency[scenario]?.[gi]?.[gj] ?? 0}
                            onChange={(v) =>
                              update((d) => {
                                const m = (d.dependency[scenario] ?? []).map((r) => [...r]);
                                if (m[gi]) m[gi][gj] = Math.min(1, v);
                                return { ...d, dependency: { ...d.dependency, [scenario]: m } };
                              })
                            }
                          />
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="max-w-2xl">
          <div className="eyebrow mb-1">Persistence</div>
          <p className="mb-4 text-[13px] text-muted">How quickly carried-over stress builds up and fades.</p>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[12px] text-muted">
                <th className="pb-2 font-semibold">Component</th>
                <th className="w-28 pb-2 text-right font-semibold">Build-up</th>
                <th className="w-28 pb-2 text-right font-semibold">Fade</th>
              </tr>
            </thead>
            <tbody>
              {comps.map((c) => {
                const [up, down] = draft.persistence[c.id] ?? [0.4, 0.15];
                return (
                  <tr key={c.id} className="border-t border-line">
                    <td className="py-1.5">{c.name}</td>
                    <td className="py-1.5 pl-2">
                      <NumCell label={`gamma up ${c.name}`} value={up} onChange={(v) => update((d) => ({ ...d, persistence: { ...d.persistence, [c.id]: [Math.min(1, v), down] } }))} />
                    </td>
                    <td className="py-1.5 pl-2">
                      <NumCell label={`gamma down ${c.name}`} value={down} onChange={(v) => update((d) => ({ ...d, persistence: { ...d.persistence, [c.id]: [up, Math.min(1, v)] } }))} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ review */

export function StepReview({ draft, goTo }: { draft: Draft; goTo: (step: number) => void }) {
  const router = useRouter();
  const { profile, issues } = React.useMemo(() => toProfile(draft), [draft]);
  const [preview, setPreview] = React.useState<Assessment | null>(null);
  const [err, setErr] = React.useState<unknown>(null);
  const [pending, setPending] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saveErr, setSaveErr] = React.useState<unknown>(null);
  const blocking = issues.filter((i) => i.step !== 0);
  const latest = profile.years[profile.years.length - 1]?.year;

  React.useEffect(() => {
    if (blocking.length || !latest) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setPending(true);
      try {
        const body = toRequestBody(profile) as typeof profile;
        const a = await api.assess({ profile: { ...body, name: body.name || "Preview" }, year: latest }, ctrl.signal);
        setPreview(a);
        setErr(null);
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) setErr(e);
      } finally {
        if (!ctrl.signal.aborted) setPending(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(profile.years), JSON.stringify(profile.sensitivities), JSON.stringify(profile.ahp_matrix), JSON.stringify(profile.dependency_matrices), profile.indicators.length, profile.components.length, blocking.length, latest]);

  const save = async () => {
    setSaving(true);
    setSaveErr(null);
    try {
      const p = await api.createCountry(toRequestBody(profile));
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
      router.push(`/countries/${p.id}`);
    } catch (e) {
      setSaveErr(e);
      setSaving(false);
    }
  };

  const nImputed = profile.years.reduce((a, y) => a + Object.values(y.indicators).filter((v) => v.observed === null).length, 0);
  const nCells = profile.years.reduce((a, y) => a + Object.keys(y.indicators).length, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["Components", String(profile.components.length)],
          ["Indicators", String(profile.indicators.length)],
          [
            "Years",
            profile.years.length > 3
              ? `${profile.years[0].year}–${profile.years[profile.years.length - 1].year} (${profile.years.length})`
              : profile.years.map((y) => y.year).join(", ") || "—",
          ],
          ["Imputed values", `${nImputed} of ${nCells}`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-line px-4 py-3">
            <div className="text-[12px] text-muted">{k}</div>
            <div className="display-num truncate text-[1.4rem]">{v}</div>
          </div>
        ))}
      </div>

      {issues.length ? (
        <div className="rounded-xl border border-saffron bg-saffron-12 p-5">
          <div className="mb-2 flex items-center gap-2 font-medium text-evergreen dark:text-ink">
            <CircleAlert className="size-4" /> {issues.length} thing{issues.length > 1 ? "s" : ""} to fix before saving
          </div>
          <ul className="space-y-1 text-[13px]">
            {issues.slice(0, 12).map((i, k) => (
              <li key={k} className="flex items-center gap-2">
                <button type="button" onClick={() => goTo(i.step)} className="inline-flex items-center gap-1 font-medium underline underline-offset-4">
                  Step {i.step + 1} <ArrowRight className="size-3" />
                </button>
                <span>{i.message}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-2xl border border-line">
        <div className="flex items-center justify-between border-b border-line px-6 py-3">
          <span className="eyebrow">Preview · {latest ?? "—"}</span>
          {pending ? <Loader2 className="size-3.5 animate-spin text-muted" /> : null}
        </div>
        <div className="p-6">
          {blocking.length ? (
            <p className="text-sm text-muted">Complete the data and financing steps to preview.</p>
          ) : err ? (
            <ErrorState error={err} />
          ) : !preview ? (
            <ChartSkeleton height={300} />
          ) : (
            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <PreviewStat label="Stress index" value={fmtIndex(preview.system.fsfsi)} extra={<StressBadge cls={preview.system.stress_class} />} />
                <PreviewStat label="Accumulated" value={fmtIndex(preview.system.fsfsi_acc)} />
                <PreviewStat label="Efficiency" value={fmtIndex(preview.system.efficiency)} />
                <PreviewStat label="Reallocation worth" value={fmtMultiple(preview.system.envelope_multiple)} />
              </div>
              <DiagnosisPlane indicators={preview.indicators} components={profile.components} breaks={preview.meta.breaks} summary={preview.diagnosis_summary} height={380} />
              <MoneyVsStress summary={preview.diagnosis_summary} height={230} />
              <ComponentTable rows={preview.components} components={profile.components} />
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {saveErr ? <span className="text-sm text-saffron-ink">{saveErr instanceof Error ? saveErr.message : String(saveErr)}</span> : null}
        <Button variant="accent" size="lg" disabled={issues.length > 0 || saving} onClick={save}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />} Save country
        </Button>
      </div>
    </div>
  );
}

function PreviewStat({ label, value, extra }: { label: string; value: string; extra?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line px-4 py-3">
      <div className="text-[12px] text-muted">{label}</div>
      <div className="display-num text-[1.9rem] leading-tight">{value}</div>
      {extra ? <div className="mt-1">{extra}</div> : null}
    </div>
  );
}
