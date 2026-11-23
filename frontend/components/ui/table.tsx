import * as React from "react";
import { cn } from "@/lib/utils";

/** shadcn/ui Table primitives, re-themed (USWDS pattern): 14 px text, tabular figures, 1 px rules, subtle hover. */
export function Table({
  className,
  wrapperClassName,
  label = "Table",
  ...props
}: React.TableHTMLAttributes<HTMLTableElement> & { wrapperClassName?: string; label?: string }) {
  return (
    <div className={cn("relative w-full overflow-x-auto", wrapperClassName)} tabIndex={0} role="region" aria-label={label}>
      <table className={cn("w-full border-collapse t-ui tabular", className)} {...props} />
    </div>
  );
}

export function Th({ className, scope = "col", ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope={scope}
      className={cn("border-b border-rule-strong bg-ivory px-3 py-2 text-left text-[12px] font-semibold text-ink-muted", className)}
      {...props}
    />
  );
}

export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("h-8 border-b border-rule px-3 py-1.5 align-middle", className)} {...props} />;
}

export function Tr({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("hover:bg-ink-4", className)} {...props} />;
}
