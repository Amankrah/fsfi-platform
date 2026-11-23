"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Button } from "../ui/button";
import { DataTable } from "../data-table";
import { downloadCsv, toCsv, type ColumnSpec } from "@/lib/csv";
import { cn } from "@/lib/utils";

/** Default source line for every figure inside a provider (set by the country workspace). */
const SourceCtx = React.createContext<{ source: string; filePrefix: string }>({
  source: "FSFI platform API.",
  filePrefix: "fsfi",
});

export function FigureSourceProvider({
  source,
  filePrefix,
  children,
}: {
  source: string;
  filePrefix: string;
  children: React.ReactNode;
}) {
  const v = React.useMemo(() => ({ source, filePrefix }), [source, filePrefix]);
  return <SourceCtx.Provider value={v}>{children}</SourceCtx.Provider>;
}

export interface FigureData<R> {
  columns: ColumnSpec<R>[];
  rows: R[];
  /** file stem for the CSV; prefixed with the country id */
  filename: string;
  initialSort?: { key: string; desc?: boolean };
}

/**
 * The single shared chart component (brief §2.5, §5.5). Every chart on the platform is rendered through it:
 * a title that states the finding, a subtitle with unit and year, Chart / Table / Download CSV tabs on the same data,
 * a source line and optional notes. The Table tab is keyboard-reachable and sortable.
 */
export function Figure<R>({
  title,
  subtitle,
  description,
  source,
  notes,
  actions,
  data,
  className,
  bodyClassName,
  children,
}: {
  title: React.ReactNode;
  /** unit and year */
  subtitle?: React.ReactNode;
  /** legacy alias for subtitle */
  description?: React.ReactNode;
  source?: React.ReactNode;
  notes?: React.ReactNode;
  actions?: React.ReactNode;
  data?: FigureData<R>;
  className?: string;
  bodyClassName?: string;
  /** legacy: ignored when `data` is provided */
  table?: React.ReactNode;
  eyebrow?: React.ReactNode;
  caption?: React.ReactNode;
  children: React.ReactNode;
}) {
  const ctx = React.useContext(SourceCtx);
  const id = React.useId();
  const titleText = typeof title === "string" ? title : "Figure";
  const file = data ? `${ctx.filePrefix}-${data.filename}` : "";
  const preamble = [titleText, typeof (subtitle ?? description) === "string" ? String(subtitle ?? description) : "", `Source: ${ctx.source}`].filter(Boolean);
  const sub = subtitle ?? description;

  return (
    <figure
      data-figure
      aria-labelledby={`${id}-t`}
      className={cn("flex min-w-0 flex-col rounded-[4px] border border-rule bg-surface", className)}
    >
      <div className="px-5 pt-4">
        <h3 id={`${id}-t`} className="t-h4 text-ink text-pretty">
          {title}
        </h3>
        {sub ? <p className="mt-0.5 t-ui text-ink-muted">{sub}</p> : null}
      </div>
      <Tabs defaultValue="chart" className="flex flex-1 flex-col">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 px-5 pt-3" data-print-hide>
          <TabsList aria-label={`${titleText}: view`}>
            <TabsTrigger value="chart">Chart</TabsTrigger>
            {data ? <TabsTrigger value="table">Table</TabsTrigger> : null}
            {data ? <TabsTrigger value="download">Download CSV</TabsTrigger> : null}
          </TabsList>
          {actions ? <div className="flex flex-wrap items-center gap-2 pb-1">{actions}</div> : null}
        </div>
        <TabsContent value="chart" className={cn("min-w-0 flex-1 px-5 pb-4", bodyClassName)}>
          {children}
        </TabsContent>
        {data ? (
          <TabsContent value="table" className="px-5 pb-4">
            <DataTable
              rows={data.rows}
              columns={data.columns}
              caption={titleText}
              captionHidden
              filename={file}
              csvPreamble={preamble}
              initialSort={data.initialSort}
              maxHeight={440}
            />
          </TabsContent>
        ) : null}
        {data ? (
          <TabsContent value="download" className="px-5 pb-5">
            <p className="t-ui text-ink-muted">
              The data plotted in this figure: {data.rows.length} rows, {data.columns.length} columns, with the title and
              source in the first lines of the file.
            </p>
            <Button
              className="mt-3"
              variant="secondary"
              size="sm"
              onClick={() => downloadCsv(file, toCsv(data.columns, data.rows, preamble))}
            >
              <Download aria-hidden /> {file}.csv
            </Button>
          </TabsContent>
        ) : null}
      </Tabs>
      <figcaption className="border-t border-rule px-5 py-2.5 t-caption text-ink-subtle">
        <span>Source: {source ?? ctx.source}</span>
        {notes ? <span className="mt-1 block">Note: {notes}</span> : null}
      </figcaption>
    </figure>
  );
}

/** Direct, inline legend item (preferred over Recharts legends). */
export function LegendItem({
  color,
  label,
  dashed,
  dotted,
  marker,
}: {
  color?: string;
  label: React.ReactNode;
  dashed?: boolean;
  dotted?: boolean;
  marker?: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-2 text-micro text-ink-muted">
      {marker ?? (
        <svg width="22" height="8" aria-hidden>
          <line
            x1="1"
            x2="21"
            y1="4"
            y2="4"
            stroke={color ?? "var(--ink)"}
            strokeWidth={2}
            strokeDasharray={dashed ? "5 3" : dotted ? "1.5 3" : undefined}
          />
        </svg>
      )}
      {label}
    </span>
  );
}
