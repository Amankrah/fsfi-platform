"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useCountries, useCountry, useHealth } from "@/lib/api";
import { useControls } from "@/lib/use-controls";
import { RESPONSES, WEIGHTINGS } from "@/lib/encodings";
import { fmtMoney, scenarioLabel } from "@/lib/format";
import type { ResponseForm, Weighting } from "@/lib/types";
import { CountryProvider } from "./country-context";
import { SyntheticBadge } from "./synthetic-badge";
import { Select } from "../ui/select";
import { Skeleton } from "../ui/misc";
import { Breadcrumb } from "../ui/breadcrumb";
import { FigureSourceProvider } from "../charts/figure";
import { ErrorState, PageSkeleton } from "../states";
import { cn } from "@/lib/utils";

/** Workspace steps in order (brief §5.6). The order doubles as a progress indicator. */
export const STEPS = [
  { slug: "", label: "Overview", title: "Overview" },
  { slug: "indicators", label: "Indicators", title: "Indicators" },
  { slug: "weights", label: "Weights", title: "Component weights" },
  { slug: "budget", label: "Budget mapping", title: "Budget mapping" },
  { slug: "scale", label: "Budget size", title: "Efficiency and budget size" },
  { slug: "optimum", label: "Reallocation", title: "Optimal reallocation" },
  { slug: "record", label: "Record", title: "Record over time" },
  { slug: "sandbox", label: "Draft scoring", title: "Score a draft budget" },
] as const;

/** Pages whose content does not depend on a single year. */
const YEARLESS = new Set(["record", "scale"]);

export function CountryShell({ id, children }: { id: string; children: React.ReactNode }) {
  const { data: profile, error, isLoading, mutate } = useCountry(id);
  const { data: health } = useHealth();
  const controls = useControls();
  const pathname = usePathname();
  const slug = pathname.split("/")[3] ?? "";
  const step = STEPS.find((s) => s.slug === slug) ?? STEPS[0];

  const years = React.useMemo(() => profile?.years.map((y) => y.year) ?? [], [profile]);
  const latest = years[years.length - 1] ?? "";
  const year = controls.year && years.includes(controls.year) ? controls.year : latest;
  const scenarios = React.useMemo(
    () => Object.keys(profile?.dependency_matrices ?? { normal_operations: [] }),
    [profile],
  );

  const ctx = React.useMemo(() => {
    if (!profile) return null;
    const names = Object.fromEntries(profile.components.map((c) => [c.id, c.name]));
    return {
      id,
      profile,
      controls: { ...controls, year },
      year,
      componentIds: profile.components.map((c) => c.id),
      componentName: (cid: string) => names[cid] ?? cid,
    };
  }, [id, profile, controls, year]);

  const yr = profile?.years.find((y) => y.year === year);
  const vintage = profile ? new Date(profile.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
  const source = profile
    ? `FSFSI assessment engine v${health?.version ?? "1"} (${health?.engine ?? "reference"}); ${profile.kind === "synthetic" ? "synthetic demonstration data" : "user-supplied data"} for ${profile.name}, generated ${vintage}.`
    : "FSFSI assessment engine.";

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col lg:flex-row">
      <WorkspaceNav id={id} slug={slug} query={controls.query} hasLines={!!profile?.budget_lines?.length || profile?.kind === "synthetic"} />

      <div className="min-w-0 flex-1 px-4 pb-20 pt-6 md:px-6 lg:border-l lg:border-rule lg:px-8">
        <Breadcrumb
          items={[
            { label: "Assessments", href: "/assessments" },
            { label: profile?.name ?? id, href: `/countries/${id}${controls.query}` },
            ...(slug ? [{ label: step.label }] : []),
          ]}
        />
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {profile ? (
            <h1 className="t-h1">
              {profile.name}
              {slug ? <span className="text-ink-muted">: {step.title}</span> : null}
            </h1>
          ) : (
            <Skeleton className="h-10 w-80" />
          )}
          {profile?.kind === "synthetic" ? <SyntheticBadge /> : null}
        </div>

        {/* context bar: quoted figures belong on screen, not in a tooltip */}
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 border-y border-rule py-2.5 t-ui sm:flex sm:flex-wrap">
          <Ctx label="Assessment year" value={YEARLESS.has(slug) ? `${years[0] ?? ""}–${latest}` : year} />
          <Ctx label="Budget envelope" value={yr ? fmtMoney(yr.envelope, profile?.currency) : "n/a"} />
          <Ctx label="Data vintage" value={profile ? `${profile.kind === "synthetic" ? "Synthetic" : "Custom"}, ${vintage}` : "n/a"} />
          <Ctx label="Model version" value={health ? `v${health.version}, ${health.engine} engine` : "n/a"} />
        </dl>

        {/* controls */}
        <div className="mt-3 flex flex-wrap items-center gap-2" data-print-hide>
          {profile ? (
            <>
              {!YEARLESS.has(slug) ? (
                <Select
                  label="Year"
                  size="sm"
                  value={year}
                  onValueChange={(v) => controls.set({ year: v === latest ? undefined : v })}
                  options={years.map((y) => ({ value: y, label: y }))}
                />
              ) : null}
              <Select
                label="Weights"
                size="sm"
                value={controls.weighting}
                onValueChange={(v) => controls.set({ weighting: v as Weighting })}
                options={WEIGHTINGS.map((w) => ({ value: w.value, label: w.label, hint: w.hint }))}
              />
              <Select
                label="Scenario"
                size="sm"
                value={controls.scenario}
                onValueChange={(v) => controls.set({ scenario: v })}
                options={scenarios.map((s) => ({ value: s, label: scenarioLabel(s) }))}
              />
              <Select
                label="Response"
                size="sm"
                value={controls.response}
                onValueChange={(v) => controls.set({ response: v as ResponseForm })}
                options={RESPONSES.map((r) => ({ value: r.value, label: r.label }))}
              />
            </>
          ) : (
            <Skeleton className="h-8 w-[420px] max-w-full" />
          )}
        </div>

        <div className="mt-6">
          {error ? (
            <ErrorState error={error} onRetry={() => void mutate()} />
          ) : isLoading || !ctx ? (
            <PageSkeleton />
          ) : (
            <FigureSourceProvider source={source} filePrefix={`${id}-${year}`}>
              <CountryProvider value={ctx}>{children}</CountryProvider>
            </FigureSourceProvider>
          )}
        </div>
      </div>
    </div>
  );
}

function Ctx({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col sm:flex-row sm:items-baseline sm:gap-1.5">
      <dt className="text-ink-subtle">{label}</dt>
      <dd className="tabular font-medium text-ink">{value}</dd>
    </div>
  );
}

/** Persistent left navigation (>= 1024 px); a disclosure menu below that. */
function WorkspaceNav({ id, slug, query, hasLines }: { id: string; slug: string; query: string; hasLines: boolean }) {
  const { data: countries } = useCountries();
  const router = useRouter();
  const idx = STEPS.findIndex((s) => s.slug === slug);
  const [open, setOpen] = React.useState(false);
  const [lastSlug, setLastSlug] = React.useState(slug);
  if (lastSlug !== slug) {
    setLastSlug(slug);
    setOpen(false);
  }

  const list = (
    <ol className="mt-2 space-y-px">
      {STEPS.map((s, i) => {
        const active = s.slug === slug;
        const href = `/countries/${id}${s.slug ? `/${s.slug}` : ""}${query}`;
        return (
          <li key={s.slug}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-9 items-center gap-3 border-l-[3px] py-1.5 pl-3 pr-2 t-ui",
                active
                  ? "border-evergreen bg-surface font-semibold text-evergreen"
                  : "border-transparent text-ink-muted hover:bg-ink-4 hover:text-ink",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-micro tabular",
                  active ? "border-evergreen bg-evergreen text-white" : i < idx ? "border-green-700 text-green-700" : "border-rule-strong text-ink-subtle",
                )}
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">{s.label}</span>
              {s.slug === "budget" && !hasLines ? <span className="t-micro text-ink-subtle">no lines</span> : null}
            </Link>
          </li>
        );
      })}
    </ol>
  );

  const picker = (
    <div>
      <label htmlFor="ws-country" className="t-caption font-medium text-ink-subtle">
        Country
      </label>
      <div className="relative mt-1">
        <select
          id="ws-country"
          value={id}
          onChange={(e) => router.push(`/countries/${e.target.value}${slug ? `/${slug}` : ""}`)}
          className="h-9 w-full appearance-none rounded-sm border border-rule-strong bg-surface pl-3 pr-8 t-ui text-ink"
        >
          {(countries ?? [{ id, name: id, kind: "synthetic" as const }]).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.kind === "synthetic" ? " (synthetic)" : ""}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden className="pointer-events-none absolute right-2.5 top-2.5 size-4 text-ink-subtle" />
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden w-[248px] shrink-0 bg-ivory px-4 pb-10 pt-6 lg:block" aria-label="Assessment steps" data-print-hide>
        <div className="sticky top-20">
          {picker}
          <p className="mt-6 t-micro font-semibold text-ink-subtle">Steps</p>
          {list}
        </div>
      </aside>
      <div className="border-b border-rule bg-ivory px-4 py-3 md:px-6 lg:hidden" data-print-hide>
        {picker}
        <button
          type="button"
          aria-expanded={open}
          aria-controls="ws-steps"
          onClick={() => setOpen((o) => !o)}
          className="mt-3 flex h-10 w-full items-center justify-between rounded-sm border border-rule-strong bg-surface px-3 t-ui font-medium text-ink"
        >
          <span>
            Step {idx + 1} of {STEPS.length}: {STEPS[idx]?.label}
          </span>
          <ChevronDown aria-hidden className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
        {open ? (
          <nav id="ws-steps" aria-label="Assessment steps">
            {list}
          </nav>
        ) : null}
      </div>
    </>
  );
}
