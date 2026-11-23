"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import { api, useCountries, useHealth } from "@/lib/api";
import { Container, PageHeader } from "@/components/shell/page";
import { SyntheticBadge } from "@/components/shell/synthetic-badge";
import { DataTable } from "@/components/data-table";
import { Figure, FigureSourceProvider, LegendItem } from "@/components/charts/figure";
import { ErrorState, EmptyState, PageSkeleton } from "@/components/states";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Select } from "@/components/ui/select";
import { StressBadge } from "@/components/ui/badge";
import { MarkerGlyph } from "@/components/marker";
import type { MarkerShape } from "@/lib/encodings";
import { fmtIndex, fmtMoney } from "@/lib/format";
import type { ColumnSpec } from "@/lib/csv";
import type { Assessment, CountrySummary } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Row {
  c: CountrySummary;
  a: Assessment;
  realloc: number;
}

/** Up to four pinned countries: fixed colour and shape order, assigned by pin order, never recycled. */
const PIN_STYLE: { color: string; shape: MarkerShape }[] = [
  { color: "var(--evergreen)", shape: "circle" },
  { color: "var(--saffron-mark)", shape: "square" },
  { color: "var(--steel)", shape: "triangle" },
  { color: "var(--neutral-mark)", shape: "diamond" },
];

export default function ComparePage() {
  const { data: countries, error, mutate } = useCountries();
  const { data: health } = useHealth();
  const [year, setYear] = React.useState("latest");
  const [kind, setKind] = React.useState<"all" | "synthetic" | "custom">("all");
  const [pinned, setPinned] = React.useState<string[]>([]);

  const allYears = React.useMemo(() => {
    const s = new Set<string>();
    countries?.forEach((c) => c.years.forEach((y) => s.add(y)));
    return [...s].sort();
  }, [countries]);
  const list = React.useMemo(
    () => (countries ?? []).filter((c) => (kind === "all" || c.kind === kind) && (year === "latest" || c.years.includes(year))),
    [countries, kind, year],
  );

  const { data: assessments, error: aErr } = useSWR(
    list.length ? ["compare", list.map((c) => c.id).join(","), year] : null,
    () => Promise.all(list.map((c) => api.assessment(c.id, { year: year === "latest" ? undefined : year }))),
    { revalidateOnFocus: false, keepPreviousData: true },
  );

  const rows: Row[] = React.useMemo(() => {
    if (!assessments) return [];
    return list
      .map((c) => {
        const a = assessments.find((x) => x.country_id === c.id);
        if (!a) return null;
        const realloc = a.components.reduce((acc, k) => acc + Math.max(0, k.shift_pp), 0) / 100;
        return { c, a, realloc };
      })
      .filter((r): r is Row => !!r);
  }, [assessments, list]);

  const components = rows[0]?.a.components ?? [];
  const compIds = components.map((k) => k.id);
  const compNames = Object.fromEntries(components.map((k) => [k.id, k.name]));
  const pinnedRows = pinned.map((id) => rows.find((r) => r.c.id === id)).filter((r): r is Row => !!r);

  const togglePin = React.useCallback((id: string) => {
    setPinned((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 4 ? p : [...p, id]));
  }, []);

  const columns = React.useMemo<ColumnSpec<Row>[]>(
    () => [
      {
        key: "name",
        header: "Country",
        value: (r) => r.c.name,
        cell: (r) => (
          <span className="flex items-center gap-2">
            <Link href={`/countries/${r.c.id}`} className="link font-medium">
              {r.c.name}
            </Link>
            {r.c.kind === "synthetic" ? <SyntheticBadge short /> : null}
          </span>
        ),
      },
      { key: "year", header: "Year", value: (r) => r.a.year },
      { key: "fsfsi", header: "Stress index", short: "Index", numeric: true, value: (r) => r.a.system.fsfsi, format: (v) => v.toFixed(2) },
      { key: "class", header: "Stress class", short: "Class", value: (r) => r.a.system.stress_class, cell: (r) => <StressBadge cls={r.a.system.stress_class} /> },
      { key: "eff", header: "Efficiency", numeric: true, value: (r) => r.a.system.efficiency, format: (v) => v.toFixed(2) },
      {
        key: "env",
        header: "Envelope",
        numeric: true,
        value: (r) => r.a.system.envelope,
        format: (v, r) => fmtMoney(v, r.c.currency),
      },
      { key: "realloc", header: "Envelope reallocated at optimum", unit: "%", short: "Reallocated %", numeric: true, value: (r) => +(r.realloc * 100).toFixed(1), format: (v) => v.toFixed(1) },
      { key: "vintage", header: "Data vintage", short: "Data", value: (r) => (r.c.kind === "synthetic" ? "Synthetic" : "Custom") },
      {
        key: "pin",
        header: "Compare",
        value: (r) => (pinned.includes(r.c.id) ? "yes" : ""),
        cell: (r) => (
          <label className="inline-flex min-h-6 cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="size-4 accent-[var(--evergreen)]"
              checked={pinned.includes(r.c.id)}
              disabled={!pinned.includes(r.c.id) && pinned.length >= 4}
              onChange={() => togglePin(r.c.id)}
            />
            <span className="sr-only">Compare {r.c.name}</span>
          </label>
        ),
      },
    ],
    [pinned, togglePin],
  );

  const smRows = rows.flatMap((r) => r.a.components.map((k) => ({ country: r.c.name, year: r.a.year, component: k.name, stress: k.stress, share: k.share })));
  const smColumns: ColumnSpec<(typeof smRows)[number]>[] = [
    { key: "country", header: "Country", value: (r) => r.country },
    { key: "year", header: "Year", value: (r) => r.year },
    { key: "component", header: "Component", value: (r) => r.component },
    { key: "stress", header: "Component stress", unit: "0–1", numeric: true, value: (r) => +r.stress.toFixed(3), format: (v) => v.toFixed(2) },
    { key: "share", header: "Budget share", unit: "%", numeric: true, value: (r) => +(r.share * 100).toFixed(1), format: (v) => v.toFixed(1) },
  ];

  const worst = rows.length ? [...rows].sort((a, b) => b.a.system.fsfsi - a.a.system.fsfsi)[0] : null;
  const yearLabel = year === "latest" ? "latest fiscal year" : `fiscal year ${year}`;

  return (
    <div>
      <PageHeader
        image={{
          src: "/images/header-dried-maize.webp",
          alt: "Dried maize cobs heaped together, in evergreen duotone.",
          credit: "Photo: Samuel Agyeman-Duah / Unsplash",
        }}
        eyebrow={<Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Compare countries" }]} />}
        title="Compare countries"
        description="Stress, efficiency and the reallocation each country's own optimum implies, on one table. Select two to four countries to compare their component stress side by side."
      />
      <Container className="space-y-8 py-8">
        <div className="flex flex-wrap items-center gap-3 border-b border-rule pb-4" role="group" aria-label="Filters">
          <Select
            label="Year"
            size="sm"
            value={year}
            onValueChange={setYear}
            options={[{ value: "latest", label: "Latest" }, ...allYears.map((y) => ({ value: y, label: y }))]}
          />
          <Select
            label="Data"
            size="sm"
            value={kind}
            onValueChange={(v) => setKind(v as typeof kind)}
            options={[
              { value: "all", label: "All" },
              { value: "synthetic", label: "Synthetic" },
              { value: "custom", label: "Custom" },
            ]}
          />
          {(year !== "latest" || kind !== "all") && (
            <span className="flex flex-wrap items-center gap-2 t-caption text-ink-muted">
              Active filters:
              {year !== "latest" ? (
                <button type="button" className="rounded-full border border-rule-strong bg-surface px-2.5 py-0.5 hover:bg-ink-4" onClick={() => setYear("latest")}>
                  Year {year} <span aria-hidden>×</span>
                  <span className="sr-only"> (remove)</span>
                </button>
              ) : null}
              {kind !== "all" ? (
                <button type="button" className="rounded-full border border-rule-strong bg-surface px-2.5 py-0.5 hover:bg-ink-4" onClick={() => setKind("all")}>
                  {kind === "synthetic" ? "Synthetic" : "Custom"} <span aria-hidden>×</span>
                  <span className="sr-only"> (remove)</span>
                </button>
              ) : null}
            </span>
          )}
        </div>

        {error || aErr ? (
          <ErrorState error={error ?? aErr} onRetry={() => void mutate()} />
        ) : !countries || (list.length > 0 && !assessments) ? (
          <PageSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState title="No countries match these filters">
            Clear the filters above, or{" "}
            <Link className="link" href="/builder">
              build a country
            </Link>{" "}
            with data for this year.
          </EmptyState>
        ) : (
          <FigureSourceProvider
            source={`FSFSI assessment engine v${health?.version ?? "1"}; hybrid weights, normal operations, exponential response; ${yearLabel}. Demonstration countries are synthetic.`}
            filePrefix={`compare-${year}`}
          >
            <section aria-labelledby="tbl-h">
              <h2 id="tbl-h" className="t-h2">
                Countries, {yearLabel}
              </h2>
              <DataTable
                className="mt-4"
                rows={rows}
                columns={columns}
                caption={`Stress index, efficiency, envelope and reallocation at the optimum, ${yearLabel}`}
                filename={`fsfsi-compare-${year}`}
                initialSort={{ key: "fsfsi", desc: true }}
                rowKey={(r) => r.c.id}
              />
              <p className="mt-2 t-caption text-ink-subtle">
                Envelope reallocated at optimum: the share of the budget that moves between components to reach each
                country&apos;s own optimum.
              </p>
            </section>

            {pinnedRows.length >= 2 ? (
              <Figure
                title={`Component stress in the ${pinnedRows.length} selected countries`}
                subtitle={`Component stress (0 = none, 1 = whole gap unfinanced), ${yearLabel}`}
                data={{ columns: smColumns, rows: smRows.filter((r) => pinnedRows.some((p) => p.c.name === r.country)), filename: "component-stress-selected" }}
              >
                <DotPlot rows={pinnedRows} compIds={compIds} compNames={compNames} />
              </Figure>
            ) : (
              <p className="callout t-ui text-ink-muted" data-print-hide>
                Select two to four countries in the Compare column to see their component stress on one dot plot.
                {pinnedRows.length === 1 ? " One selected." : ""}
              </p>
            )}

            <Figure
              title={worst ? `${worst.c.name} carries the highest stress index of the countries shown` : "Component stress by country"}
              subtitle={`Component stress (0–1, same scale in every panel), ${yearLabel}; components in framework order`}
              data={{ columns: smColumns, rows: smRows, filename: "component-stress-by-country" }}
            >
              <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 xl:grid-cols-4">
                {rows.map((r) => (
                  <SmallMultiple key={r.c.id} r={r} />
                ))}
              </div>
            </Figure>
          </FigureSourceProvider>
        )}
      </Container>
    </div>
  );
}

function SmallMultiple({ r }: { r: Row }) {
  const max = Math.max(...r.a.components.map((k) => k.stress));
  return (
    <div>
      <p className="t-ui font-semibold text-ink">
        {r.c.name} <span className="font-normal text-ink-subtle">· {r.a.year}</span>
      </p>
      <p className="t-caption text-ink-subtle">Index {fmtIndex(r.a.system.fsfsi)}</p>
      <ul className="mt-2 space-y-1">
        {r.a.components.map((k) => (
          <li key={k.id} className="grid grid-cols-[minmax(0,7.5rem)_1fr_2.5rem] items-center gap-2 t-caption">
            <span className="truncate text-ink-muted" title={k.name}>
              {k.name}
            </span>
            <span className="relative h-2.5 bg-ink-6" aria-hidden>
              <span
                className={cn("absolute inset-y-0 left-0", k.stress === max ? "bg-evergreen" : "bg-steel")}
                style={{ width: `${Math.min(1, k.stress) * 100}%` }}
              />
            </span>
            <span className="text-right tabular text-ink">{fmtIndex(k.stress)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DotPlot({ rows, compIds, compNames }: { rows: Row[]; compIds: string[]; compNames: Record<string, string> }) {
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-5">
        {rows.map((r, i) => (
          <LegendItem key={r.c.id} marker={<MarkerGlyph shape={PIN_STYLE[i].shape} fill={PIN_STYLE[i].color} stroke="var(--surface)" size={14} />} label={r.c.name} />
        ))}
      </div>
      <div className="grid grid-cols-[minmax(0,9rem)_1fr] gap-x-3 sm:grid-cols-[minmax(0,13rem)_1fr]">
        <span />
        <div className="relative mb-1 h-4 t-caption text-ink-subtle">
          {ticks.map((t) => (
            <span key={t} className="absolute -translate-x-1/2 tabular" style={{ left: `${t * 100}%` }}>
              {t.toFixed(2)}
            </span>
          ))}
        </div>
        {compIds.map((cid) => (
          <React.Fragment key={cid}>
            <span className="truncate border-t border-rule py-2 t-ui text-ink">{compNames[cid]}</span>
            <div className="relative border-t border-rule">
              {ticks.map((t) => (
                <span key={t} aria-hidden className="absolute inset-y-0 w-px bg-rule" style={{ left: `${t * 100}%` }} />
              ))}
              {rows.map((r, i) => {
                const k = r.a.components.find((x) => x.id === cid);
                if (!k) return null;
                return (
                  <span
                    key={r.c.id}
                    className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${Math.min(1, k.stress) * 100}%` }}
                    title={`${r.c.name}, ${compNames[cid]}: ${fmtIndex(k.stress)}`}
                  >
                    <MarkerGlyph shape={PIN_STYLE[i].shape} fill={PIN_STYLE[i].color} stroke="var(--surface)" size={14} />
                  </span>
                );
              })}
            </div>
          </React.Fragment>
        ))}
      </div>
      <p className="mt-3 t-caption text-ink-subtle">Each component&apos;s budget share is listed in the Table tab.</p>
    </div>
  );
}
