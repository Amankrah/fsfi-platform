import type { ReactNode } from "react";

/** A column shared by the DataTable and the Figure's Table / Download CSV tabs. */
export interface ColumnSpec<R> {
  key: string;
  header: string;
  /** compact on-screen heading; the full header is kept for the tooltip, screen readers and CSV */
  short?: string;
  /** shown in the header, never in every cell */
  unit?: string;
  /** right-aligned, tabular figures, sorted numerically */
  numeric?: boolean;
  /** raw value: used for sorting and CSV */
  value: (row: R) => string | number | null | undefined;
  /** display text; defaults to the raw value */
  format?: (v: number, row: R) => string;
  /** rich cell (badges, markers); CSV still uses `value` */
  cell?: (row: R) => ReactNode;
  className?: string;
}

function esc(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<R>(columns: ColumnSpec<R>[], rows: R[], preamble: string[] = []): string {
  const head = columns.map((c) => esc(c.unit ? `${c.header} (${c.unit})` : c.header)).join(",");
  const body = rows.map((r) => columns.map((c) => esc(c.value(r))).join(","));
  return [...preamble.map((p) => `# ${p}`), head, ...body].join("\n") + "\n";
}

export function downloadCsv(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
