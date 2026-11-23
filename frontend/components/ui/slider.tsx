"use client";

import * as React from "react";
import { Slider as S } from "radix-ui";
import { cn } from "@/lib/utils";

/** shadcn/ui Slider, re-themed. Always paired with a numeric read-out or entry beside it. */
export function Slider({
  value,
  onValueChange,
  min = 0,
  max = 1,
  step = 0.001,
  label,
  className,
  marker,
}: {
  value: number;
  onValueChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
  className?: string;
  /** optional reference position (e.g. the enacted value) */
  marker?: number;
  accent?: boolean;
}) {
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  return (
    <S.Root
      className={cn("relative flex h-6 w-full touch-none select-none items-center", className)}
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={(v) => onValueChange(v[0])}
    >
      <S.Track className="relative h-[3px] grow bg-rule">
        <S.Range className="absolute h-full bg-evergreen" />
      </S.Track>
      {marker !== undefined && Number.isFinite(marker) ? (
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 h-3.5 w-[2px] -translate-y-1/2 bg-rule-strong"
          style={{ left: `${Math.max(0, Math.min(100, pct(marker)))}%` }}
        />
      ) : null}
      <S.Thumb aria-label={label} className="block size-4 rounded-full border-2 border-evergreen bg-surface" />
    </S.Root>
  );
}
