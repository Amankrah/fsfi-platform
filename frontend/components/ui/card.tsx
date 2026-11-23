import * as React from "react";
import { cn } from "@/lib/utils";

/** shadcn/ui Card, re-themed: white surface, 1 px rule, 4 px radius, no shadow. */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-[4px] border border-rule bg-surface", className)} {...props} />;
}

export function CardHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4 px-5 pt-5", className)}>
      <div className="min-w-0 max-w-3xl">
        {eyebrow ? <div className="eyebrow mb-1">{eyebrow}</div> : null}
        <h3 className="t-h4 text-ink">{title}</h3>
        {description ? <p className="mt-1 t-ui text-ink-muted text-pretty">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pb-5 pt-4", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-t border-rule px-5 py-3 t-caption text-ink-subtle", className)} {...props} />;
}
