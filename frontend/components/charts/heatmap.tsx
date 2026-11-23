"use client";

import * as React from "react";
import { heatColor, heatTextColor } from "@/lib/encodings";
import { cn } from "@/lib/utils";

/** Matrix heatmap rendered as a CSS grid (crisp text, keyboard-readable). */
export function Heatmap({
  rows,
  cols,
  values,
  max,
  format = (v) => v.toFixed(2),
  rowHeader,
  colHeader,
  caption,
  diagonalBlank,
  className,
  cellTitle,
}: {
  rows: string[];
  cols: string[];
  values: (number | null)[][];
  max?: number;
  format?: (v: number) => string;
  rowHeader?: string;
  colHeader?: string;
  caption?: string;
  diagonalBlank?: boolean;
  className?: string;
  cellTitle?: (r: number, c: number, v: number | null) => string;
}) {
  const flat = values.flat().filter((v): v is number => v !== null && Number.isFinite(v));
  const mx = max ?? Math.max(1e-9, ...flat);
  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <table className="w-full border-separate border-spacing-[3px] text-[12px] tabular">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr>
            <th className="w-40 pb-1 text-left text-[12px] font-semibold text-muted">{rowHeader}</th>
            {cols.map((c) => (
              <th key={c} scope="col" className="pb-1 text-center text-[12px] font-medium text-muted">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r}>
              <th scope="row" className="whitespace-nowrap pr-3 text-left text-[12.5px] font-normal text-ink">
                {r}
              </th>
              {cols.map((c, j) => {
                const v = values[i]?.[j] ?? null;
                const blank = v === null || (diagonalBlank && i === j);
                return (
                  <td
                    key={c}
                    title={cellTitle?.(i, j, v)}
                    className="h-10 min-w-[52px] rounded-[5px] text-center transition-transform hover:scale-[1.04]"
                    style={{
                      background: blank ? "transparent" : heatColor(v as number, mx),
                      color: blank ? "var(--ink-40)" : heatTextColor(v as number, mx),
                      outline: blank ? "1px dashed var(--line)" : undefined,
                    }}
                  >
                    {blank ? "·" : format(v as number)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {colHeader ? <div className="mt-2 text-center text-[12px] text-muted">{colHeader}</div> : null}
      <HeatLegend max={mx} format={format} />
    </div>
  );
}

export function HeatLegend({ max, format }: { max: number; format: (v: number) => string }) {
  const stops = Array.from({ length: 24 }, (_, i) => i / 23);
  return (
    <div className="mt-3 flex items-center gap-2 text-[12px] text-muted">
      <span className="tabular">{format(0)}</span>
      <div className="flex h-2 w-40 overflow-hidden rounded-full">
        {stops.map((s) => (
          <span key={s} className="h-full flex-1" style={{ background: heatColor(s * max, max) }} />
        ))}
      </div>
      <span className="tabular">{format(max)}</span>
    </div>
  );
}
