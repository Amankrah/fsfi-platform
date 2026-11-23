"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Download } from "lucide-react";
import { Button } from "./ui/button";
import { downloadCsv, toCsv, type ColumnSpec } from "@/lib/csv";
import { cn } from "@/lib/utils";

/**
 * DataTable (TanStack Table, USWDS / NN/g pattern): <caption>, scope on headers, sortable headers with aria-sort and a
 * live region, right-aligned tabular numbers, units in the header, sticky header, frozen first column, CSV export.
 */
export function DataTable<R>({
  rows,
  columns,
  caption,
  captionHidden,
  filename,
  csvPreamble,
  initialSort,
  maxHeight,
  frozenFirst = true,
  showCsv = true,
  rowKey,
  className,
  onRowClick,
}: {
  rows: R[];
  columns: ColumnSpec<R>[];
  caption: string;
  captionHidden?: boolean;
  filename?: string;
  csvPreamble?: string[];
  initialSort?: { key: string; desc?: boolean };
  maxHeight?: number;
  frozenFirst?: boolean;
  showCsv?: boolean;
  rowKey?: (r: R, i: number) => string;
  className?: string;
  onRowClick?: (r: R) => void;
}) {
  const [sorting, setSorting] = React.useState<SortingState>(
    initialSort ? [{ id: initialSort.key, desc: !!initialSort.desc }] : [],
  );
  const [announce, setAnnounce] = React.useState("");

  const defs = React.useMemo<ColumnDef<R>[]>(
    () =>
      columns.map((c) => ({
        id: c.key,
        accessorFn: (r: R) => c.value(r) ?? null,
        header: c.short ?? (c.unit ? `${c.header} (${c.unit})` : c.header),
        sortingFn: c.numeric ? "basic" : "alphanumeric",
        sortUndefined: "last",
        cell: (ctx) => {
          const r = ctx.row.original;
          if (c.cell) return c.cell(r);
          const v = c.value(r);
          if (v === null || v === undefined || (typeof v === "number" && !Number.isFinite(v))) return "n/a";
          if (typeof v === "number" && c.format) return c.format(v, r);
          return String(v);
        },
      })),
    [columns],
  );

  // TanStack Table returns non-memoisable functions; React Compiler skips this component by design.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns: defs,
    state: { sorting },
    onSortingChange: (u) => {
      const next = typeof u === "function" ? u(sorting) : u;
      setSorting(next);
      const s = next[0];
      const col = columns.find((c) => c.key === s?.id);
      setAnnounce(s && col ? `Sorted by ${col.header}, ${s.desc ? "descending" : "ascending"}` : "Sort cleared");
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: rowKey ? (r, i) => rowKey(r, i) : undefined,
  });

  const spec = Object.fromEntries(columns.map((c) => [c.key, c]));

  return (
    <div className={cn("min-w-0", className)}>
      <div
        className="relative w-full overflow-auto rounded-sm border border-rule bg-surface"
        style={maxHeight ? { maxHeight } : undefined}
        tabIndex={0}
        role="region"
        aria-label={`${caption} (scrollable)`}
      >
        <table className="w-full border-collapse t-ui tabular">
          <caption className={cn("px-3 py-2 text-left t-caption text-ink-subtle", captionHidden && "sr-only")}>{caption}</caption>
          <thead className="sticky top-0 z-10">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h, i) => {
                  const c = spec[h.column.id];
                  const sorted = h.column.getIsSorted();
                  return (
                    <th
                      key={h.id}
                      scope="col"
                      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"}
                      className={cn(
                        "whitespace-nowrap border-b border-rule-strong bg-ivory px-3 py-1.5 text-micro font-semibold text-ink-muted",
                        c?.numeric ? "text-right" : "text-left",
                        i === 0 && frozenFirst && "sticky left-0 z-20",
                      )}
                    >
                      <button
                        type="button"
                        title={c ? (c.unit ? `${c.header} (${c.unit})` : c.header) : undefined}
                        aria-label={c?.short ? `${c.header}${c.unit ? ` (${c.unit})` : ""}, sort` : undefined}
                        onClick={h.column.getToggleSortingHandler()}
                        className={cn(
                          "inline-flex min-h-6 items-center gap-1 rounded-sm hover:text-evergreen",
                          c?.numeric && "flex-row-reverse",
                        )}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {sorted === "asc" ? (
                          <ArrowUp aria-hidden className="size-3.5" />
                        ) : sorted === "desc" ? (
                          <ArrowDown aria-hidden className="size-3.5" />
                        ) : (
                          <ArrowUpDown aria-hidden className="size-3.5 opacity-60" />
                        )}
                      </button>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={cn("odd:bg-surface even:bg-paper hover:bg-ink-4", onRowClick && "cursor-pointer")}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              >
                {row.getVisibleCells().map((cell, i) => {
                  const c = spec[cell.column.id];
                  const Tag = i === 0 ? "th" : "td";
                  return (
                    <Tag
                      key={cell.id}
                      scope={i === 0 ? "row" : undefined}
                      className={cn(
                        "h-8 border-b border-rule px-3 py-1 align-middle font-normal",
                        c?.numeric ? "whitespace-nowrap text-right" : "text-left",
                        i === 0 && frozenFirst && "sticky left-0 bg-inherit",
                        c?.className,
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </Tag>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="px-3 py-6 t-ui text-ink-muted">No rows to show.</p> : null}
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="sr-only" aria-live="polite">
          {announce}
        </span>
        <span className="t-caption text-ink-subtle">
          {rows.length} {rows.length === 1 ? "row" : "rows"} · select a column heading to sort
        </span>
        {showCsv && filename ? (
          <Button
            variant="quiet"
            size="sm"
            onClick={() => downloadCsv(filename, toCsv(columns, rows, csvPreamble))}
            data-print-hide
          >
            <Download aria-hidden /> Download CSV
          </Button>
        ) : null}
      </div>
    </div>
  );
}
