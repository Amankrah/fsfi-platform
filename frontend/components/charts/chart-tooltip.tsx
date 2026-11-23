"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TooltipRow {
  label: React.ReactNode;
  value: React.ReactNode;
  color?: string;
  dashed?: boolean;
  strong?: boolean;
}

/** Shared tooltip card for Recharts and custom SVG charts. */
export function TooltipCard({
  title,
  rows,
  footer,
  className,
}: {
  title?: React.ReactNode;
  rows: TooltipRow[];
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none min-w-[180px] max-w-[300px] rounded-sm border border-rule-strong bg-surface px-3 py-2.5 text-ink shadow-lg",
        className,
      )}
    >
      {title ? <div className="mb-1.5 text-small font-semibold leading-snug">{title}</div> : null}
      <div className="space-y-1">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-3 text-micro">
            {r.color ? (
              <span
                aria-hidden
                className="inline-block h-[3px] w-3 shrink-0 rounded-full"
                style={{
                  background: r.dashed ? "transparent" : r.color,
                  borderTop: r.dashed ? `2px dashed ${r.color}` : undefined,
                }}
              />
            ) : null}
            <span className="text-ink-muted">{r.label}</span>
            <span className={cn("ml-auto pl-3 tabular", r.strong ? "font-semibold text-evergreen" : "font-medium")}>{r.value}</span>
          </div>
        ))}
      </div>
      {footer ? (
        <div className="mt-2 border-t border-rule pt-1.5 text-micro text-ink-subtle">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

/** Tooltips sit on a white surface, so series colours are used unchanged. */
export function onDark(color: string | undefined) {
  return color ?? "var(--ink)";
}
