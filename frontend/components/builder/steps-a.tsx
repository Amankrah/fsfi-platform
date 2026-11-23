"use client";

import * as React from "react";
import { Copy, Download, Plus, Trash2, Upload } from "lucide-react";
import { api, downloads, useCountries } from "@/lib/api";
import type { Direction, Framework } from "@/lib/types";
import { componentStyleMap } from "@/lib/encodings";
import { cn } from "@/lib/utils";
import { fmtMoney } from "@/lib/format";
import { Button } from "../ui/button";
import { Input, Label, Switch, Textarea } from "../ui/misc";
import { Select } from "../ui/select";
import { Segmented } from "../ui/segmented";
import { Badge } from "../ui/badge";
import { MarkerGlyph } from "../marker";
import { FileDrop } from "../file-drop";
import { ErrorState } from "../states";
import { nextCustomCode, type Cell, type Draft } from "./state";

export type Update = (fn: (d: Draft) => Draft) => void;

/* ---------------------------------------------------------------- 1 identity */

export function StepIdentity({
  draft,
  update,
  onStartFrom,
  loadingFrom,
}: {
  draft: Draft;
  update: Update;
  onStartFrom: (id: string | null) => void;
  loadingFrom: string | null;
}) {
  const { data: countries } = useCountries();
  const synthetic = countries?.filter((c) => c.kind === "synthetic") ?? [];
  return (
    <div className="space-y-8">
      <div>
        <div className="eyebrow mb-3">Start from</div>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <StartCard active={draft.startedFrom === null} title="Blank framework" body="You enter the data" onClick={() => onStartFrom(null)} />
          {synthetic.map((c) => (
            <StartCard
              key={c.id}
              active={draft.startedFrom === c.id}
              title={c.name}
              body="Pre-filled demo data"
              busy={loadingFrom === c.id}
              onClick={() => onStartFrom(c.id)}
            />
          ))}
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-[1fr_200px]">
        <div>
          <Label htmlFor="b-name">Country name *</Label>
          <Input id="b-name" value={draft.name} onChange={(e) => update((d) => ({ ...d, name: e.target.value }))} placeholder="e.g. Republic of Northshire" />
        </div>
        <div>
          <Label htmlFor="b-cur">Currency</Label>
          <Input id="b-cur" value={draft.currency} onChange={(e) => update((d) => ({ ...d, currency: e.target.value }))} placeholder="e.g. CU m" />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="b-tag">Tagline</Label>
          <Input id="b-tag" value={draft.tagline} onChange={(e) => update((d) => ({ ...d, tagline: e.target.value }))} placeholder="One line" />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="b-desc">Description</Label>
          <Textarea id="b-desc" rows={3} value={draft.description} onChange={(e) => update((d) => ({ ...d, description: e.target.value }))} placeholder="Optional" />
        </div>
      </div>
    </div>
  );
}

function StartCard({
  active,
  title,
  body,
  busy,
  onClick,
}: {
  active: boolean;
  title: string;
  body: string;
  busy?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex w-full items-start gap-4 rounded-xl border p-4 text-left transition-colors",
        active ? "border-ink bg-ink-4 ring-1 ring-ink" : "border-line-strong hover:bg-ink-4",
      )}
    >
      <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border", active ? "border-ink bg-ink" : "border-line-strong")}>
        {active ? <span className="size-2 rounded-full bg-saffron" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2 font-medium">
          {title}
          {busy ? <span className="text-xs text-muted">loading…</span> : null}
        </span>
        <span className="mt-0.5 block text-small text-muted">{body}</span>
      </span>
      {active ? null : <Copy className="size-4 shrink-0 text-ink-40" strokeWidth={1.5} />}
    </button>
  );
}

/* --------------------------------------------------------------- 2 framework */

export function StepFramework({ draft, update }: { draft: Draft; update: Update }) {
  const styles = componentStyleMap(draft.components.map((c) => c.id));
  const [newInd, setNewInd] = React.useState({ name: "", component: draft.components[0]?.id ?? "", direction: "higher" as Direction, unit: "" });
  const includedComps = draft.components.filter((c) => c.included);
  const newComp = includedComps.some((c) => c.id === newInd.component) ? newInd.component : (includedComps[0]?.id ?? "");
  return (
    <div className="space-y-8">
      <div>
        <div className="eyebrow mb-3">Components</div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {draft.components.map((c, i) => (
            <div key={c.id} className={cn("rounded-xl border p-4 transition-opacity", c.included ? "border-line-strong" : "border-dashed border-line-strong opacity-55")}>
              <div className="mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2 font-mono text-micro text-muted">
                  <MarkerGlyph shape={styles[c.id].shape} fill={styles[c.id].fill} size={13} />
                  {c.id}
                </span>
                <Switch
                  label=""
                  checked={c.included}
                  onCheckedChange={(v) =>
                    update((d) => ({ ...d, components: d.components.map((x, j) => (j === i ? { ...x, included: v } : x)) }))
                  }
                />
              </div>
              <Input
                aria-label={`Name of ${c.id}`}
                value={c.name}
                onChange={(e) => update((d) => ({ ...d, components: d.components.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) }))}
                className="mb-2"
              />
              <Input
                aria-label={`Short label of ${c.id}`}
                value={c.short}
                onChange={(e) => update((d) => ({ ...d, components: d.components.map((x, j) => (j === i ? { ...x, short: e.target.value } : x)) }))}
                className="h-8 text-micro"
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="eyebrow">Indicators · {draft.indicators.filter((i) => i.included).length} of {draft.indicators.length} included</div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => update((d) => ({ ...d, indicators: d.indicators.map((i) => ({ ...i, included: true })) }))}>
              Include all
            </Button>
            <Button variant="ghost" size="sm" onClick={() => update((d) => ({ ...d, indicators: d.indicators.map((i) => ({ ...i, included: false })) }))}>
              Clear
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={downloads.indicatorsTemplate} download>
                <Download /> CSV
              </a>
            </Button>
          </div>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          {draft.components.map((c) => {
            const inds = draft.indicators.filter((i) => i.component === c.id);
            if (!inds.length) return null;
            return (
              <div key={c.id} className={cn("rounded-xl border border-line p-4", !c.included && "opacity-50")}>
                <div className="mb-2 flex items-center gap-2 text-small font-medium">
                  <MarkerGlyph shape={styles[c.id].shape} fill={styles[c.id].fill} size={13} />
                  {c.name}
                </div>
                <ul className="divide-y divide-line">
                  {inds.map((ind) => (
                    <li key={ind.code} className="flex items-center gap-3 py-1.5">
                      <input
                        type="checkbox"
                        id={`ind-${ind.code}`}
                        checked={ind.included}
                        onChange={(e) =>
                          update((d) => ({ ...d, indicators: d.indicators.map((x) => (x.code === ind.code ? { ...x, included: e.target.checked } : x)) }))
                        }
                        className="size-4 accent-[var(--evergreen)]"
                      />
                      <label htmlFor={`ind-${ind.code}`} className="flex min-w-0 flex-1 items-center gap-2 text-small">
                        <span className="w-14 shrink-0 font-mono text-micro text-muted">{ind.code}</span>
                        <span className="truncate">{ind.name}</span>
                      </label>
                      <span className="shrink-0 text-micro text-muted">{ind.direction === "higher" ? "↑ better" : "↓ better"}</span>
                      {ind.custom ? (
                        <button
                          type="button"
                          aria-label={`Remove ${ind.name}`}
                          onClick={() => update((d) => ({ ...d, indicators: d.indicators.filter((x) => x.code !== ind.code) }))}
                          className="rounded p-1 text-muted hover:bg-ink-6 hover:text-ink"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-line bg-ink-4 p-5">
        <div className="eyebrow mb-3">Add an indicator</div>
        <form
          className="grid items-end gap-3 md:grid-cols-[2fr_1.2fr_1fr_1fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newInd.name.trim() || !newComp) return;
            update((d) => ({
              ...d,
              indicators: [
                ...d.indicators,
                { code: nextCustomCode(d), name: newInd.name.trim(), component: newComp, direction: newInd.direction, unit: newInd.unit || undefined, included: true, custom: true },
              ],
            }));
            setNewInd((s) => ({ ...s, name: "", unit: "" }));
          }}
        >
          <div>
            <Label htmlFor="ni-name">Name</Label>
            <Input id="ni-name" value={newInd.name} onChange={(e) => setNewInd((s) => ({ ...s, name: e.target.value }))} placeholder="e.g. Seed certification coverage (%)" />
          </div>
          <div>
            <Label>Component</Label>
            <Select value={newComp} onValueChange={(v) => setNewInd((s) => ({ ...s, component: v }))} options={includedComps.map((c) => ({ value: c.id, label: c.name }))} className="w-full" />
          </div>
          <div>
            <Label>Direction</Label>
            <Select
              value={newInd.direction}
              onValueChange={(v) => setNewInd((s) => ({ ...s, direction: v as Direction }))}
              options={[
                { value: "higher", label: "Higher is better" },
                { value: "lower", label: "Lower is better" },
              ]}
              className="w-full"
            />
          </div>
          <div>
            <Label htmlFor="ni-unit">Unit</Label>
            <Input id="ni-unit" value={newInd.unit} onChange={(e) => setNewInd((s) => ({ ...s, unit: e.target.value }))} placeholder="%" />
          </div>
          <Button type="submit" disabled={!newInd.name.trim() || !newComp}>
            <Plus /> Add
          </Button>
        </form>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- 3 / 4 year grids */

function YearTabs({ draft, update, year, setYear }: { draft: Draft; update: Update; year: string; setYear: (y: string) => void }) {
  const [newYear, setNewYear] = React.useState("");
  return (
    <div className="flex flex-wrap items-center gap-2">
      {draft.years.length ? (
        <Segmented label="Year" value={year} onValueChange={setYear} options={draft.years.map((y) => ({ value: y, label: y }))} layoutId="builder-year" />
      ) : null}
      <form
        className="flex items-center gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          const y = newYear.trim() || `t${draft.years.length}`;
          if (draft.years.includes(y)) return;
          update((d) => {
            const prev = d.years[d.years.length - 1];
            const carry: Record<string, Cell> = {};
            if (prev && d.data[prev]) {
              Object.entries(d.data[prev]).forEach(([k, c]) => (carry[k] = { observed: "", benchmark: c.benchmark, allocation: "" }));
            }
            return { ...d, years: [...d.years, y], data: { ...d.data, [y]: carry } };
          });
          setYear(y);
          setNewYear("");
        }}
      >
        <Input value={newYear} onChange={(e) => setNewYear(e.target.value)} placeholder={`t${draft.years.length}`} className="h-8 w-20 text-micro" aria-label="New year label" />
        <Button type="submit" variant="outline" size="sm">
          <Plus /> Year
        </Button>
      </form>
      {draft.years.length > 1 ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            update((d) => {
              const years = d.years.filter((y) => y !== year);
              const data = { ...d.data };
              delete data[year];
              return { ...d, years, data };
            });
            setYear(draft.years.filter((y) => y !== year)[0]);
          }}
        >
          <Trash2 /> Remove {year}
        </Button>
      ) : null}
    </div>
  );
}

function setCell(update: Update, year: string, code: string, key: keyof Cell, value: string) {
  update((d) => {
    const row = d.data[year] ?? {};
    const cur = row[code] ?? { observed: "", benchmark: "", allocation: "" };
    return { ...d, data: { ...d.data, [year]: { ...row, [code]: { ...cur, [key]: value } } } };
  });
}

function GridInput({ value, onChange, label, placeholder, invalid }: { value: string; onChange: (v: string) => void; label: string; placeholder?: string; invalid?: boolean }) {
  return (
    <input
      inputMode="decimal"
      aria-label={label}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-8 w-full rounded-md border bg-transparent px-2 text-right text-small tabular placeholder:text-ink-40 hover:border-line-strong focus-visible:border-ink-55 focus-visible:bg-surface",
        invalid ? "border-saffron bg-saffron-12" : "border-transparent",
      )}
    />
  );
}

const bad = (v: string) => v.trim() !== "" && (!Number.isFinite(Number(v)) || Number(v) < 0);

export function StepData({ draft, update }: { draft: Draft; update: Update }) {
  const [yearSel, setYear] = React.useState(draft.years[draft.years.length - 1] ?? "t0");
  const year = draft.years.includes(yearSel) ? yearSel : (draft.years[draft.years.length - 1] ?? "t0");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<unknown>(null);
  const comps = new Set(draft.components.filter((c) => c.included).map((c) => c.id));
  const inds = draft.indicators.filter((i) => i.included && comps.has(i.component));
  const row = draft.data[year] ?? {};
  const filled = inds.filter((i) => (row[i.code]?.benchmark ?? "").trim() !== "").length;
  const imputed = inds.filter((i) => (row[i.code]?.benchmark ?? "").trim() !== "" && (row[i.code]?.observed ?? "").trim() === "").length;

  const importCsv = async (f: File) => {
    setBusy(true);
    setErr(null);
    try {
      const recs = await api.importRecords(f);
      update((d) => {
        const years = [...d.years];
        const data = { ...d.data };
        const codes = new Set(d.indicators.map((i) => i.code));
        let indicators = d.indicators;
        recs.forEach((r) => {
          if (!years.includes(r.year)) years.push(r.year);
          const rowd = { ...(data[r.year] ?? {}) };
          Object.entries(r.indicators).forEach(([code, iy]) => {
            if (!codes.has(code)) return;
            rowd[code] = { observed: iy.observed === null ? "" : String(iy.observed), benchmark: String(iy.benchmark), allocation: String(iy.allocation) };
          });
          data[r.year] = rowd;
        });
        indicators = indicators.map((i) => (recs.some((r) => i.code in r.indicators) ? { ...i, included: true } : i));
        return { ...d, years, data, indicators };
      });
      if (recs[0]) setYear(recs[recs.length - 1].year);
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <YearTabs draft={draft} update={update} year={year} setYear={setYear} />
          <span className="text-micro text-muted tabular">
            {filled}/{inds.length} with benchmark · {imputed} imputed
          </span>
        </div>
        <div className="max-h-[560px] overflow-auto rounded-xl border border-line">
          <table className="w-full text-small">
            <thead className="sticky top-0 z-10 bg-surface">
              <tr className="text-left text-micro text-muted">
                <th className="border-b border-line-strong px-3 py-2 font-semibold">Indicator</th>
                <th className="w-20 border-b border-line-strong px-3 py-2 font-semibold">Dir.</th>
                <th className="w-32 border-b border-line-strong px-3 py-2 text-right font-semibold">Observed</th>
                <th className="w-32 border-b border-line-strong px-3 py-2 text-right font-semibold">Benchmark</th>
              </tr>
            </thead>
            <tbody>
              {inds.map((i) => {
                const c = row[i.code] ?? { observed: "", benchmark: "", allocation: "" };
                return (
                  <tr key={i.code} className="border-b border-line last:border-0 hover:bg-ink-4">
                    <td className="px-3 py-1">
                      <span className="mr-2 font-mono text-micro text-muted">{i.code}</span>
                      {i.name}
                    </td>
                    <td className="px-3 py-1 text-micro text-muted">{i.direction === "higher" ? "↑" : "↓"}</td>
                    <td className="px-2 py-1">
                      <GridInput label={`${i.code} observed ${year}`} value={c.observed} placeholder="impute" invalid={bad(c.observed)} onChange={(v) => setCell(update, year, i.code, "observed", v)} />
                    </td>
                    <td className="px-2 py-1">
                      <GridInput label={`${i.code} benchmark ${year}`} value={c.benchmark} placeholder="n/a" invalid={bad(c.benchmark)} onChange={(v) => setCell(update, year, i.code, "benchmark", v)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="rounded-xl border border-line p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="eyebrow">Or import a CSV</div>
          <Button variant="outline" size="sm" asChild>
            <a href={downloads.recordsTemplate} download>
              <Download /> Template
            </a>
          </Button>
        </div>
        <FileDrop onFile={importCsv} busy={busy} label="Upload records CSV" />
        {err ? <ErrorState error={err} className="mt-3 p-4" /> : null}
      </div>
    </div>
  );
}

export function StepFinancing({ draft, update }: { draft: Draft; update: Update; framework?: Framework }) {
  const [yearSel, setYear] = React.useState(draft.years[draft.years.length - 1] ?? "t0");
  const year = draft.years.includes(yearSel) ? yearSel : (draft.years[draft.years.length - 1] ?? "t0");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<unknown>(null);
  const [mapped, setMapped] = React.useState<string | null>(null);
  const comps = draft.components.filter((c) => c.included);
  const compSet = new Set(comps.map((c) => c.id));
  const inds = draft.indicators.filter((i) => i.included && compSet.has(i.component));
  const row = draft.data[year] ?? {};
  const val = (code: string) => {
    const v = Number(row[code]?.allocation ?? "");
    return Number.isFinite(v) ? v : 0;
  };
  const envelope = inds.reduce((a, i) => a + val(i.code), 0);
  const styles = componentStyleMap(draft.components.map((c) => c.id));

  const runMapper = async (f: File) => {
    setBusy(true);
    setErr(null);
    try {
      const res = await api.runMapping(f);
      const agg: Record<string, Record<string, number>> = {};
      res.lines.forEach((l) => {
        if (!l.indicator) return;
        agg[l.year] ??= {};
        agg[l.year][l.indicator] = (agg[l.year][l.indicator] ?? 0) + l.amount;
      });
      update((d) => {
        const years = [...d.years];
        const data = { ...d.data };
        Object.entries(agg).forEach(([y, byInd]) => {
          if (!years.includes(y)) years.push(y);
          const r = { ...(data[y] ?? {}) };
          Object.entries(byInd).forEach(([code, amt]) => {
            const cur = r[code] ?? { observed: "", benchmark: "", allocation: "" };
            r[code] = { ...cur, allocation: String(+amt.toFixed(4)) };
          });
          data[y] = r;
        });
        return { ...d, years, data, budget_lines: res.lines.map((l, i) => ({ ...l, id: i + 1 })) };
      });
      setMapped(
        `${res.lines.length.toLocaleString()} lines mapped · ${fmtMoney(res.summary.unassigned_amount)} of ${fmtMoney(res.summary.total_amount)} unassigned`,
      );
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <YearTabs draft={draft} update={update} year={year} setYear={setYear} />
          <span className="text-small">
            Total {year}: <b className="display-num text-[1.3rem]">{fmtMoney(envelope)}</b> {draft.currency}
          </span>
        </div>
        <div className="max-h-[560px] overflow-auto rounded-xl border border-line">
          <table className="w-full text-small">
            <thead className="sticky top-0 z-10 bg-surface">
              <tr className="text-left text-micro text-muted">
                <th className="border-b border-line-strong px-3 py-2 font-semibold">Indicator</th>
                <th className="w-40 border-b border-line-strong px-3 py-2 text-right font-semibold">Allocation</th>
                <th className="w-24 border-b border-line-strong px-3 py-2 text-right font-semibold">Share</th>
              </tr>
            </thead>
            <tbody>
              {inds.map((i) => {
                const c = row[i.code] ?? { observed: "", benchmark: "", allocation: "" };
                const share = envelope > 0 ? val(i.code) / envelope : 0;
                return (
                  <tr key={i.code} className="border-b border-line last:border-0 hover:bg-ink-4">
                    <td className="px-3 py-1">
                      <span className="flex items-center gap-2">
                        <MarkerGlyph shape={styles[i.component]?.shape ?? "circle"} fill={styles[i.component]?.fill ?? "var(--ink)"} size={11} />
                        <span className="w-14 font-mono text-micro text-muted">{i.code}</span>
                        {i.name}
                      </span>
                    </td>
                    <td className="px-2 py-1">
                      <GridInput label={`${i.code} allocation ${year}`} value={c.allocation} placeholder="0" invalid={bad(c.allocation)} onChange={(v) => setCell(update, year, i.code, "allocation", v)} />
                    </td>
                    <td className="px-3 py-1 text-right text-micro tabular text-muted">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-1 w-10 overflow-hidden rounded-full bg-ink-8">
                          <span className="block h-full bg-ink" style={{ width: `${share * 100}%` }} />
                        </span>
                        {(share * 100).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="rounded-xl border border-line p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="eyebrow">Or map a budget file</span>
            {draft.budget_lines?.length ? <Badge tone="accent">{draft.budget_lines.length.toLocaleString()} lines</Badge> : null}
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href={downloads.mappingTemplate} download>
              <Download /> Template
            </a>
          </Button>
        </div>
        <FileDrop onFile={runMapper} busy={busy} label="Upload budget CSV" />
        {mapped ? (
          <p className="mt-3 flex items-start gap-2 text-micro text-ink">
            <Upload className="mt-0.5 size-3.5 shrink-0" /> {mapped}
          </p>
        ) : null}
        {err ? <ErrorState error={err} className="mt-3 p-4" /> : null}
      </div>
    </div>
  );
}
