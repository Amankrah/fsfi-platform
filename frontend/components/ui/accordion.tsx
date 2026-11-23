"use client";

import * as React from "react";
import { Accordion as A } from "radix-ui";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** shadcn/ui Accordion, re-themed: ruled rows, no cards. */
export const Accordion = A.Root;

export function AccordionItem({ className, ...props }: React.ComponentProps<typeof A.Item>) {
  return <A.Item className={cn("border-b border-rule", className)} {...props} />;
}

export function AccordionTrigger({ className, children, ...props }: React.ComponentProps<typeof A.Trigger>) {
  return (
    <A.Header className="flex">
      <A.Trigger
        className={cn(
          "group flex flex-1 items-center justify-between gap-4 py-3 text-left text-[15px] font-medium text-ink hover:text-evergreen",
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDown
          aria-hidden
          className="size-4 shrink-0 text-ink-subtle transition-transform duration-150 group-data-[state=open]:rotate-180"
          strokeWidth={1.5}
        />
      </A.Trigger>
    </A.Header>
  );
}

export function AccordionContent({ className, children, ...props }: React.ComponentProps<typeof A.Content>) {
  return (
    <A.Content className="overflow-hidden" {...props}>
      <div className={cn("pb-4", className)}>{children}</div>
    </A.Content>
  );
}
