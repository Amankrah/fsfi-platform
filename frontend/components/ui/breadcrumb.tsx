import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** shadcn/ui Breadcrumb, condensed into one component: Countries / [Country] / Page. */
export function Breadcrumb({
  items,
  className,
}: {
  items: { label: React.ReactNode; href?: string }[];
  className?: string;
}) {
  return (
    <nav aria-label="Breadcrumb" className={cn("t-caption text-ink-subtle", className)}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {items.map((it, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className="inline-flex items-center gap-1.5">
              {it.href && !last ? (
                <Link href={it.href} className="text-green-700 underline-offset-2 hover:underline">
                  {it.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={last ? "text-ink" : undefined}>
                  {it.label}
                </span>
              )}
              {!last ? (
                <span aria-hidden className="text-ink-subtle">
                  /
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
