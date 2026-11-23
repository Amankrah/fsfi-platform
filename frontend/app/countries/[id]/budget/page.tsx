"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Download, Search, X } from "lucide-react";
import { api, downloads, useBudgetLines } from "@/lib/api";
import { useCountryCtx } from "@/components/shell/country-context";
import { ChartSkeleton, EmptyState, ErrorState } from "@/components/states";
import { FileDrop } from "@/components/file-drop";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/misc";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { MarkerGlyph } from "@/components/marker";
import { componentStyleMap } from "@/lib/encodings";
import { fmtMoney, fmtPct } from "@/lib/format";
import type { BudgetLine, MappingResult } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE = 25;

function useDebounced<T>(v: T, ms: number) {
  const [d, setD] = React.useState(v);
  React.useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

export default function BudgetPage() {
  const { id, profile, year, componentName } = useCountryCtx();
  const [q, setQRaw] = React.useState("");
  const dq = useDebounced(q, 250);
  const [yr, setYrRaw] = React.useState<string>(year);
  const [page, setPage] = React.useState(1);
  const [stage, setStageRaw] = React.useState<string | null>(null);
  const [comp, setCompRaw] = React.useState<string | null>(null);
  const resetting = <T,>(f: (v: T) => void) => (v: T) => {
    f(v);
    setPage(1);
  };
  const setQ = resetting(setQRaw);
  const setYr = resetting(setYrRaw);
  const setStage = resetting(setStageRaw);
  const setComp = resetting(setCompRaw);

  const all = React.useMemo(() => profile.budget_lines ?? [], [profile]);
  const remote = useBudgetLines(id, {
    year: yr === "all" ? undefined : yr,
    q: dq || undefined,
    page,
    page_size: PAGE,
    stage: stage ?? undefined,
    component: comp ?? undefined,
  });

  const items: BudgetLine[] = remote.data?.items ?? [];
  const total = remote.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  const yearLines = React.useMemo(() => all.filter((l) => yr === "all" || l.year === yr), [all, yr]);
  const stages = React.useMemo(() => countBy(yearLines, (l) => l.stage), [yearLines]);
  const comps = React.useMemo(
    () => countBy(yearLines, (l) => l.component).filter(([k]) => k !== "—").map(([k, n]) => [k, n, componentName(k)] as [string, number, string]),
    [yearLines, componentName],
  );
  const byComp = React.useMemo(() => {
    const m = new Map<string, number>();
    yearLines.forEach((l) => m.set(l.component ?? "__none", (m.get(l.component ?? "__none") ?? 0) + l.amount));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [yearLines]);
  const totalAmt = yearLines.reduce((a, l) => a + l.amount, 0);
  const styles = componentStyleMap(profile.components.map((c) => c.id));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHeader
            title="Budget lines"
            description="Every executed line with the indicator it was mapped to and the rule that assigned it"
          />
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[240px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-55" strokeWidth={1.5} />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search line, agency, programme…" className="pl-9" aria-label="Search budget lines" />
              </div>
              <Select
                label="Year"
                value={yr}
                onValueChange={setYr}
                options={[{ value: "all", label: "All years" }, ...profile.years.map((y) => ({ value: y.year, label: y.year }))]}
              />
            </div>
            {all.length ? (
              <div className="space-y-2">
                <ChipRow label="Stage" items={stages.filter(([k]) => k !== "—").map(([k, n]) => [k, n, stageLabel(k)])} active={stage} onPick={setStage} />
                <ChipRow label="Component" items={comps} active={comp} onPick={setComp} />
              </div>
            ) : null}

            {remote.error ? (
              <ErrorState error={remote.error} onRetry={() => void remote.mutate()} />
            ) : !remote.data ? (
              <ChartSkeleton height={420} />
            ) : items.length === 0 ? (
              <EmptyState title="No lines match">Try another search term or clear the filters.</EmptyState>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Line</Th>
                    <Th>Year</Th>
                    <Th>Indicator</Th>
                    <Th>Stage / rule</Th>
                    <Th className="text-right">Amount ({profile.currency})</Th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((l) => (
                    <Tr key={l.id}>
                      <Td className="max-w-[320px]">
                        <span className="block truncate font-medium" title={l.line}>
                          {l.line}
                        </span>
                        <span className="block truncate text-[12px] text-muted">
                          {l.agency} · {l.sub_programme}
                          {l.budget_tag ? (
                            <Badge tone={l.budget_tag === "external" ? "accent" : "neutral"} className="ml-2 py-0 text-[12px]">
                              {l.budget_tag}
                            </Badge>
                          ) : null}
                        </span>
                      </Td>
                      <Td className="text-muted">{l.year}</Td>
                      <Td>
                        {l.indicator ? (
                          <span className="flex items-center gap-1.5">
                            {l.component && styles[l.component] ? (
                              <MarkerGlyph shape={styles[l.component].shape} fill={styles[l.component].fill} size={11} />
                            ) : null}
                            <span className="whitespace-nowrap font-mono text-[12px]">{l.indicator}</span>
                            {l.line_class ? <span className="text-[12px] text-muted">{l.line_class}</span> : null}
                          </span>
                        ) : (
                          <span className="text-[12px] text-muted">unassigned</span>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap text-[12px] text-muted">
                        {l.stage ? stageLabel(l.stage) : "—"}
                        {l.rule ? <span className="block font-mono text-[12px]">{l.rule}</span> : null}
                      </Td>
                      <Td className="text-right">{fmtMoney(l.amount, undefined, 2)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
            <div className="flex items-center justify-between text-[12.5px] text-muted">
              <span className="tabular">
                {total.toLocaleString()} lines · page {page} of {pages}
              </span>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft />
                </Button>
                <Button variant="outline" size="icon" aria-label="Next page" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight />
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>

        <div className="space-y-6 xl:col-span-4">
          <Card>
            <CardHeader title="By component" description={`${fmtMoney(totalAmt)} ${profile.currency} across ${yearLines.length.toLocaleString()} lines`} />
            <CardBody className="space-y-2.5">
              {byComp.length === 0 ? <p className="text-sm text-muted">No budget lines are stored for this country. Upload a budget file below to map one.</p> : null}
              {byComp.map(([cid, amt]) => (
                <div key={cid}>
                  <div className="flex items-center justify-between text-[12.5px]">
                    <span className="flex items-center gap-2">
                      {styles[cid] ? <MarkerGlyph shape={styles[cid].shape} fill={styles[cid].fill} size={11} /> : null}
                      {cid === "__none" ? <span className="text-muted">Unassigned</span> : componentName(cid)}
                    </span>
                    <span className="tabular text-muted">{fmtPct(amt / (totalAmt || 1), 1)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-8">
                    <div className={cn("h-full rounded-full", cid === "__none" ? "bg-alert" : "bg-evergreen")} style={{ width: `${(amt / (totalAmt || 1)) * 100}%` }} />
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="By mapping stage" />
            <CardBody>
              <Table>
                <tbody>
                  {stages.map(([s, n]) => (
                    <Tr key={s}>
                      <Td>{stageLabel(s)}</Td>
                      <Td className="text-right text-muted">{n} lines</Td>
                      <Td className="text-right">
                        {fmtPct(yearLines.filter((l) => (l.stage ?? "—") === s).reduce((a, l) => a + l.amount, 0) / (totalAmt || 1), 1)}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </CardBody>
          </Card>
        </div>
      </div>

      <MapperUpload />
    </div>
  );
}

/** Plain-language names for the mapper's rule stages (mapping/mapper.py, in the order they are tried). */
const STAGE_NAMES: Record<string, string> = {
  PRE: "Pre-assigned",
  OHS: "Overhead, shared pro rata",
  DICT_ROADS: "Road phrases",
  DICT: "Line phrases",
  LATE: "Late phrases",
  SUB: "Sub-programme",
  AGY: "Agency",
  RES: "Residual by budget tag",
};
function stageLabel(s: string) {
  return STAGE_NAMES[s] ?? s.replace(/_/g, " ");
}

function countBy(lines: BudgetLine[], f: (l: BudgetLine) => string | null): [string, number][] {
  const m = new Map<string, number>();
  lines.forEach((l) => {
    const k = f(l) ?? "—";
    m.set(k, (m.get(k) ?? 0) + 1);
  });
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function ChipRow({
  label,
  items,
  active,
  onPick,
}: {
  label: string;
  items: [string, number, string][];
  active: string | null;
  onPick: (v: string | null) => void;
}) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 w-20 text-[12px] font-semibold text-ink-subtle">{label}</span>
      {items.map(([k, n, text]) => {
        const on = active === k;
        return (
          <button
            key={k}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(on ? null : k)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition-colors",
              on ? "border-evergreen bg-evergreen text-white" : "border-rule-strong bg-surface text-ink hover:bg-ink-6",
            )}
          >
            {text}
            <span className={on ? "text-white" : "text-ink-subtle"}>{n}</span>
            {on ? <X className="size-3" /> : null}
          </button>
        );
      })}
    </div>
  );
}

function MapperUpload() {
  const { id, profile, componentName } = useCountryCtx();
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<unknown>(null);
  const [res, setRes] = React.useState<MappingResult | null>(null);
  const [name, setName] = React.useState<string>("");

  const run = async (f: File) => {
    setBusy(true);
    setErr(null);
    setName(f.name);
    try {
      setRes(await api.runMapping(f, id));
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };

  const s = res?.summary;
  return (
    <Card>
      <CardHeader
        title="Map a budget file"
        description="Upload executed budget lines as CSV; the mapper assigns each line to an indicator and reports what it could not assign. Nothing is stored."
        actions={
          <Button variant="secondary" size="sm" asChild>
            <a href={downloads.mappingTemplate} download>
              <Download aria-hidden /> Template (CSV)
            </a>
          </Button>
        }
      />
      <CardBody>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <FileDrop onFile={run} busy={busy} hint={name ? `Last file: ${name}` : "Nothing is stored."} />
          {err ? <ErrorState error={err} className="mt-4 p-5" /> : null}
        </div>
        <div className="lg:col-span-8">
          {!s ? (
            <EmptyState title="No file mapped yet" className="h-full">
              Upload a CSV to see totals by mapping stage, by component, and the unassigned remainder.
            </EmptyState>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Total" value={`${fmtMoney(s.total_amount)} ${profile.currency}`} />
                <Stat label="Assigned" value={fmtPct(1 - s.unassigned_amount / (s.total_amount || 1), 1)} />
                <Stat label="Unassigned" value={`${fmtMoney(s.unassigned_amount)}`} accent={s.unassigned_amount > 0} />
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <div className="eyebrow mb-2">By stage</div>
                  <Table>
                    <tbody>
                      {Object.entries(s.by_stage).map(([k, v]) => (
                        <Tr key={k}>
                          <Td>{stageLabel(k)}</Td>
                          <Td className="text-right text-muted">{v.lines}</Td>
                          <Td className="text-right">{fmtMoney(v.amount)}</Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
                <div>
                  <div className="eyebrow mb-2">By component</div>
                  <Table>
                    <tbody>
                      {Object.entries(s.by_component)
                        .sort((a, b) => b[1] - a[1])
                        .map(([k, v]) => (
                          <Tr key={k}>
                            <Td>{componentName(k)}</Td>
                            <Td className="text-right">{fmtPct(v / (s.total_amount || 1), 1)}</Td>
                          </Tr>
                        ))}
                    </tbody>
                  </Table>
                </div>
              </div>
              <p className="text-xs text-muted">{res.lines.length.toLocaleString()} lines mapped.</p>
            </div>
          )}
        </div>
      </div>
      </CardBody>
    </Card>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn("border-l-2 border-evergreen bg-surface px-4 py-2", accent && "border-alert")}>
      <div className="text-[12px] text-muted">{label}</div>
      <div className="display-num text-[1.35rem]">{value}</div>
    </div>
  );
}
