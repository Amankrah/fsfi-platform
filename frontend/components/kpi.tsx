"use client";

import * as React from "react";
import { Skeleton } from "./ui/misc";
import { cn } from "@/lib/utils";

/**
 * One cell of a KPI row (at most four per row): label, value with unit, reference year, comparison, and a short
 * definition underneath. No icons, no colour carrying meaning, no animated counting.
 */
export function Kpi({
  label,
  value,
  format,
  unit,
  year,
  sub,
  hint,
  className,
  loading,
  children,
}: {
  label: string;
  value?: number | null;
  format?: (v: number) => string;
  unit?: string;
  year?: string;
  sub?: React.ReactNode;
  /** a one-line definition, shown in full (not hidden in a tooltip) */
  hint?: string;
  accent?: boolean;
  className?: string;
  loading?: boolean;
  children?: React.ReactNode;
}) {
  const shown = value === null || value === undefined || !Number.isFinite(value) ? "—" : (format ?? ((v) => v.toFixed(2)))(value);
  return (
    <div className={cn("flex min-w-0 flex-col gap-1 border-l-2 border-evergreen bg-surface py-3 pl-4 pr-3", className)}>
      <div className="t-ui font-medium text-ink">
        {label}
        {year ? <span className="font-normal text-ink-subtle">, {year}</span> : null}
      </div>
      {loading ? (
        <Skeleton className="h-8 w-24" />
      ) : children ? (
        children
      ) : (
        <div className="display-num text-[1.75rem] leading-9 text-evergreen">
          {shown}
          {unit ? <span className="ml-1 text-[0.875rem] font-normal text-ink-muted">{unit}</span> : null}
        </div>
      )}
      {sub ? <div className="t-caption text-ink-muted">{loading ? <Skeleton className="h-3 w-24" /> : sub}</div> : null}
      {hint ? <p className="t-caption text-ink-subtle">{hint}</p> : null}
    </div>
  );
}

/** A KPI row: up to four cells, separated by space, not boxes. */
export function KpiRow({ children, className, label = "Key figures" }: { children: React.ReactNode; className?: string; label?: string }) {
  return (
    <section aria-label={label} className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4", className)}>
      {children}
    </section>
  );
}
