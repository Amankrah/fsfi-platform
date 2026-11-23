"use client";

import * as React from "react";
import { ToggleGroup } from "radix-ui";
import { cn } from "@/lib/utils";

/** shadcn/ui ToggleGroup as a segmented control: bordered, 2 px radius, evergreen selected state, no animation. */
export function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  label,
  className,
  size = "md",
}: {
  value: T;
  onValueChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; title?: string }[];
  label: string;
  className?: string;
  size?: "sm" | "md";
  layoutId?: string;
}) {
  return (
    <ToggleGroup.Root
      type="single"
      aria-label={label}
      value={value}
      onValueChange={(v) => v && onValueChange(v as T)}
      className={cn("inline-flex items-stretch rounded-[2px] border border-rule-strong bg-surface", className)}
    >
      {options.map((o, i) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          title={o.title}
          className={cn(
            "font-medium tabular transition-colors data-[state=on]:bg-evergreen data-[state=on]:text-white",
            "text-ink-muted hover:bg-ink-4 hover:text-ink",
            i > 0 && "border-l border-rule-strong",
            size === "sm" ? "h-[30px] min-w-[28px] px-2.5 text-[12.5px]" : "h-9 px-3 text-[13px]",
          )}
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
