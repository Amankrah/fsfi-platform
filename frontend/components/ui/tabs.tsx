"use client";

import * as React from "react";
import { Tabs as T } from "radix-ui";
import { cn } from "@/lib/utils";

/** shadcn/ui Tabs, re-themed as an underlined tab row (no pills). */
export const Tabs = T.Root;

export function TabsList({ className, ...props }: React.ComponentProps<typeof T.List>) {
  return <T.List className={cn("flex items-end gap-1 border-b border-rule", className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof T.Trigger>) {
  return (
    <T.Trigger
      className={cn(
        "-mb-px inline-flex h-9 min-w-[24px] items-center gap-1.5 border-b-2 border-transparent px-2.5 text-small font-medium text-ink-muted transition-colors hover:text-evergreen data-[state=active]:border-evergreen data-[state=active]:text-evergreen [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: React.ComponentProps<typeof T.Content>) {
  return <T.Content className={cn("pt-4 outline-none", className)} {...props} />;
}
