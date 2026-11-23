"use client";

import * as React from "react";
import { Tooltip as T, Switch as Sw } from "radix-ui";
import { cn } from "@/lib/utils";

/** shadcn/ui Skeleton: a flat block, no shimmer. */
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div aria-hidden className={cn("skeleton rounded-[2px]", className)} style={style} />;
}

/** shadcn/ui Input: 1 px rule-strong border (3.26:1), 2 px radius. */
export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-[2px] border border-rule-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-subtle",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-[2px] border border-rule-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-subtle",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-[13px] font-medium text-ink", className)} {...props} />;
}

/** shadcn/ui Tooltip. */
export function Tip({
  content,
  children,
  side = "top",
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <T.Root delayDuration={150}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          className="z-50 max-w-xs rounded-[2px] bg-evergreen px-3 py-2 text-[13px] leading-snug text-white shadow-lg"
        >
          {content}
          <T.Arrow className="fill-evergreen" />
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <T.Provider>{children}</T.Provider>;
}

/** shadcn/ui Switch. */
export function Switch({
  checked,
  onCheckedChange,
  label,
  className,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label: string;
  className?: string;
}) {
  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-2 text-[13px] text-ink", className)}>
      <Sw.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="relative h-5 w-9 shrink-0 rounded-full border border-rule-strong bg-surface transition-colors data-[state=checked]:border-evergreen data-[state=checked]:bg-evergreen"
      >
        <Sw.Thumb className="block size-3.5 translate-x-0.5 rounded-full bg-rule-strong transition-transform data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-white" />
      </Sw.Root>
      {label}
    </label>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded-[2px] border border-rule-strong bg-ivory px-1.5 py-0.5 font-mono text-[12px]">{children}</kbd>;
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-rule", className)} />;
}
