"use client";

import * as React from "react";
import { Select as S } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: React.ReactNode;
  hint?: string;
}

/** shadcn/ui Select, re-themed. */
export function Select({
  value,
  onValueChange,
  options,
  label,
  className,
  placeholder,
  size = "md",
}: {
  value: string;
  onValueChange: (v: string) => void;
  options: SelectOption[];
  label?: string;
  className?: string;
  placeholder?: string;
  size?: "sm" | "md";
}) {
  return (
    <S.Root value={value} onValueChange={onValueChange}>
      <S.Trigger
        aria-label={label}
        className={cn(
          "group inline-flex items-center justify-between gap-2 rounded-sm border border-rule-strong bg-surface text-left text-ink hover:bg-ink-4",
          size === "sm" ? "h-8 px-2.5 text-small" : "h-9 px-3 text-sm",
          className,
        )}
      >
        <span className="flex min-w-0 items-center gap-1.5 truncate">
          {label ? <span className="text-ink-subtle">{label}</span> : null}
          <span className="truncate font-medium">
            <S.Value placeholder={placeholder} />
          </span>
        </span>
        <S.Icon>
          <ChevronDown className="size-3.5 text-ink-subtle" strokeWidth={1.5} />
        </S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content
          position="popper"
          sideOffset={4}
          className="z-50 max-h-[min(24rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-sm border border-rule-strong bg-surface p-1 text-ink shadow-lg"
        >
          <S.Viewport>
            {options.map((o) => (
              <S.Item
                key={o.value}
                value={o.value}
                className="relative flex cursor-default select-none flex-col rounded-sm py-1.5 pl-8 pr-3 text-sm outline-none data-[highlighted]:bg-ivory"
              >
                <S.ItemIndicator className="absolute left-2.5 top-2">
                  <Check className="size-3.5 text-evergreen" strokeWidth={2} />
                </S.ItemIndicator>
                <S.ItemText>{o.label}</S.ItemText>
                {o.hint ? <span className="mt-0.5 text-xs text-ink-subtle">{o.hint}</span> : null}
              </S.Item>
            ))}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  );
}
