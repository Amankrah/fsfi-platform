"use client";

import * as React from "react";
import { API_BASE, ApiError, isOffline } from "@/lib/api";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/misc";
import { cn } from "@/lib/utils";

const START_CMD = "cd fsfi-platform/backend; uvicorn fsfi_platform.main:app --port 8010";

/**
 * Error state (brief §2.6): plain language, what was kept, what to do next, and a technical-detail disclosure.
 */
export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const offline = isOffline(error);
  const notFound = error instanceof ApiError && error.status === 404;
  const msg = error instanceof Error ? error.message : String(error);
  const title = offline
    ? "The assessment service is not responding"
    : notFound
      ? "This item was not found"
      : "The data could not be loaded";
  const body = offline
    ? "Nothing on this page was changed. Start the API service, then try again."
    : notFound
      ? "It may have been deleted or the address may be wrong. Go back to the list of countries and choose another."
      : "Nothing was saved or changed. Try again; if the problem continues, check the technical details below.";
  return (
    <div className={cn("callout callout-caution bg-surface py-4 pr-4", className)} role="alert">
      <h3 className="t-h4 text-ink">{title}</h3>
      <p className="mt-1 t-ui text-ink-muted">{body}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
      <details className="mt-3 t-caption text-ink-subtle">
        <summary className="cursor-pointer text-green-700">Technical details</summary>
        <p className="mt-1">
          {offline ? (
            <>
              Could not reach <code className="font-mono">{API_BASE}</code>. Start it with{" "}
              <code className="select-all font-mono">{START_CMD}</code>.
            </>
          ) : (
            <>
              {error instanceof ApiError ? `HTTP ${error.status}: ` : null}
              {msg}
            </>
          )}
        </p>
      </details>
    </div>
  );
}

/** Empty state: say what is missing and how to supply it, with the action inside the message. */
export function EmptyState({
  title,
  children,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("callout bg-surface py-4 pr-4", className)}>
      <h3 className="t-h4 text-ink">{title}</h3>
      {children ? <div className="mt-1 max-w-[68ch] t-ui text-ink-muted">{children}</div> : null}
    </div>
  );
}

/** Loading skeleton for a chart: a frame with axes, not a spinner. */
export function ChartSkeleton({ height = 320, className }: { height?: number; className?: string }) {
  return (
    <div className={cn("relative", className)} style={{ height }} aria-hidden>
      <div className="absolute bottom-6 left-10 right-2 top-2 border-b border-l border-rule-strong" />
      {[0.25, 0.5, 0.75].map((f) => (
        <div key={f} className="absolute left-10 right-2 h-px bg-rule" style={{ top: `${f * (height - 32) + 8}px` }} />
      ))}
    </div>
  );
}

/** Loading skeleton for a workspace page: KPI row, a figure frame and table rows. */
export function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border-l-2 border-rule bg-surface py-3 pl-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-2 h-8 w-20" />
          </div>
        ))}
      </div>
      <div className="rounded-[4px] border border-rule bg-surface p-5">
        <Skeleton className="h-5 w-72" />
        <Skeleton className="mt-2 h-4 w-48" />
        <ChartSkeleton height={280} className="mt-4" />
      </div>
      <div className="rounded-[4px] border border-rule bg-surface">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex h-8 items-center gap-4 border-b border-rule px-3">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="ml-auto h-3 w-12" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}
