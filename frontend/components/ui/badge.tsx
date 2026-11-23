import * as React from "react";
import { cn } from "@/lib/utils";
import type { Diagnosis, StressClass } from "@/lib/types";
import { diagnosisColor, diagnosisShort, stressColor, stressLabel } from "@/lib/encodings";

/** shadcn/ui Badge, re-themed for status only: 2 px radius, 1 px border, label always beside the colour. */
export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "accent" | "solid" | "outline" }) {
  const tones = {
    neutral: "bg-ink-6 text-ink",
    accent: "border border-saffron-20 bg-saffron-12 text-saffron-ink",
    solid: "bg-evergreen text-white",
    outline: "border border-rule-strong bg-surface text-ink",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm px-2 py-0.5 text-micro font-medium leading-4",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

export function Swatch({ color, className, hollow }: { color: string; className?: string; hollow?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2.5 shrink-0 rounded-[1px]", className)}
      style={hollow ? { border: `1.5px solid ${color}`, background: "var(--surface)" } : { background: color }}
    />
  );
}

export function StressBadge({ cls, className }: { cls: StressClass; className?: string }) {
  return (
    <Badge tone="outline" className={cn("pl-1.5", className)}>
      <Swatch color={stressColor[cls]} hollow={cls === "low"} />
      {stressLabel[cls]} stress
    </Badge>
  );
}

export function DiagnosisBadge({ dx, className }: { dx: Diagnosis; className?: string }) {
  return (
    <Badge tone="outline" className={cn("pl-1.5", className)}>
      <Swatch color={diagnosisColor[dx]} hollow={dx === "at_benchmark"} />
      {diagnosisShort[dx]}
    </Badge>
  );
}
