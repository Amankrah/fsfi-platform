"use client";

import * as React from "react";
import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** shadcn/ui Sheet: a right-hand definitions panel. */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-[rgb(15_61_51/0.32)]" />
        <D.Content
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-rule-strong bg-paper shadow-lg outline-none",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-rule px-6 py-4">
            <div className="min-w-0">
              <D.Title className="t-h2 text-evergreen">{title}</D.Title>
              {description ? <D.Description className="mt-1 t-ui text-ink-muted">{description}</D.Description> : null}
            </div>
            <D.Close className="rounded-[2px] p-1.5 text-ink-muted hover:bg-ink-6 hover:text-ink" aria-label="Close">
              <X className="size-5" strokeWidth={1.5} />
            </D.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/** shadcn/ui Dialog (used rarely). */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-[rgb(15_61_51/0.32)]" />
        <D.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,30rem)] -translate-x-1/2 -translate-y-1/2 rounded-[4px] border border-rule-strong bg-paper p-6 shadow-lg outline-none">
          <D.Title className="t-h2 text-evergreen">{title}</D.Title>
          {description ? <D.Description className="mt-1 t-ui text-ink-muted">{description}</D.Description> : null}
          <div className="mt-5">{children}</div>
          <D.Close className="absolute right-4 top-4 rounded-[2px] p-1.5 text-ink-muted hover:bg-ink-6" aria-label="Close">
            <X className="size-4" strokeWidth={1.5} />
          </D.Close>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
