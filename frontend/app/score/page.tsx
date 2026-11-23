"use client";

import * as React from "react";
import Link from "next/link";
import { useCountries } from "@/lib/api";
import { Container, PageHeader } from "@/components/shell/page";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { SyntheticBadge } from "@/components/shell/synthetic-badge";
import { ErrorState } from "@/components/states";
import { Skeleton } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";

/** Public explainer above the draft-budget scoring tool. */
export default function ScorePage() {
  const { data, error, mutate } = useCountries();
  return (
    <div>
      <PageHeader
        image={{
          src: "/images/header-budget-papers.webp",
          alt: "A calculator resting on printed bar charts, in evergreen duotone.",
          credit: "Photo: Jakub Żerdzicki / Unsplash",
        }}
        eyebrow={<Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Score a draft budget" }]} />}
        title="Score a draft budget"
        description="Change component shares or the size of the envelope and see, before anything is committed, what the draft does to financing stress compared with the enacted budget."
      />
      <Container className="py-10">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <h2 className="t-h2">How it works</h2>
            <ol className="mt-4 max-w-[68ch] list-decimal space-y-3 pl-5">
              <li>Choose a country below. The tool opens on its enacted budget for the latest fiscal year.</li>
              <li>
                Move component shares, type a share directly, or start from the optimum. Shares always sum to 100%, and
                the envelope can be scaled.
              </li>
              <li>
                The score updates as you work: the stress index and efficiency of the draft, the change against the
                enacted budget, component stress side by side and the changes that moved the score most.
              </li>
              <li>Export the scorecard as CSV or print it, or reset to the enacted budget.</li>
            </ol>
          </div>
          <div className="lg:col-span-5">
            <h2 className="t-h2">Choose a country</h2>
            {error ? (
              <ErrorState error={error} onRetry={() => void mutate()} className="mt-4" />
            ) : !data ? (
              <div className="mt-4 space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <ul className="mt-4 divide-y divide-rule border-y border-rule">
                {data.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <span>
                      <span className="block font-medium text-ink">{c.name}</span>
                      <span className="flex items-center gap-2 t-caption text-ink-subtle">
                        {c.tagline}
                        {c.kind === "synthetic" ? <SyntheticBadge short /> : null}
                      </span>
                    </span>
                    <Button asChild variant="secondary" size="sm">
                      <Link href={`/countries/${c.id}/sandbox`}>
                        Score a draft<span className="sr-only"> for {c.name}</span>
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Container>
    </div>
  );
}
