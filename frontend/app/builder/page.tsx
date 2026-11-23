"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, Check, RotateCcw } from "lucide-react";
import { api, useFramework } from "@/lib/api";
import { Container, PageHeader } from "@/components/shell/page";
import { ErrorState, PageSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { StepData, StepFinancing, StepFramework, StepIdentity } from "@/components/builder/steps-a";
import { StepParameters, StepReview } from "@/components/builder/steps-b";
import { fromFramework, fromProfile, STORAGE_KEY, toProfile, type Draft } from "@/components/builder/state";
import { cn } from "@/lib/utils";
import { Breadcrumb } from "@/components/ui/breadcrumb";

const STEPS = ["Identity", "Framework", "Data", "Financing", "Parameters", "Review"];

export default function BuilderPage() {
  const { data: fw, error, mutate } = useFramework();
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [step, setStep] = React.useState(0);
  const [loadingFrom, setLoadingFrom] = React.useState<string | null>(null);
  const [startErr, setStartErr] = React.useState<unknown>(null);

  // restore a saved draft, else start from the framework
  React.useEffect(() => {
    if (!fw || draft) return;
    let restored: Draft | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Draft;
        if (d.version === 1) restored = d;
      }
    } catch {}
    const next = restored ?? fromFramework(fw);
    const id = requestAnimationFrame(() => setDraft(next));
    return () => cancelAnimationFrame(id);
  }, [fw, draft]);

  React.useEffect(() => {
    if (!draft) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...draft, budget_lines: draft.budget_lines?.slice(0, 3000) }));
      } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [draft]);

  const update = React.useCallback((fn: (d: Draft) => Draft) => setDraft((d) => (d ? fn(d) : d)), []);

  const startFrom = async (id: string | null) => {
    if (!fw) return;
    setStartErr(null);
    if (id === null) {
      setDraft((d) => ({ ...fromFramework(fw), name: d?.name ?? "", currency: d?.currency ?? "CU m" }));
      return;
    }
    setLoadingFrom(id);
    try {
      const p = await api.country(id);
      setDraft((d) => ({ ...fromProfile(p, fw), name: d?.name ?? "" }));
    } catch (e) {
      setStartErr(e);
    } finally {
      setLoadingFrom(null);
    }
  };

  const issues = draft ? toProfile(draft).issues : [];
  const stepIssues = (s: number) => issues.filter((i) => i.step === s).length;

  return (
    <div className="pb-24">
      <PageHeader
        eyebrow={<Breadcrumb items={[{ label: "Assessments", href: "/assessments" }, { label: "Build for a country" }]} />}
        title="Build for a country"
        description="Six steps: identity, indicator framework, indicator data, financing, parameters and review. The draft is kept in this browser until you save it."
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (!fw || !confirm("Discard this draft and start again?")) return;
              try {
                localStorage.removeItem(STORAGE_KEY);
              } catch {}
              setDraft(fromFramework(fw));
              setStep(0);
            }}
          >
            <RotateCcw aria-hidden /> Reset draft
          </Button>
        }
      />
      <Container className="pt-8">
      {error ? (
        <ErrorState error={error} onRetry={() => void mutate()} />
      ) : !draft ? (
        <PageSkeleton />
      ) : (
        <div>
            <div className="rounded-[4px] border border-rule bg-surface">
              <nav aria-label="Builder steps" className="no-scrollbar overflow-x-auto border-b border-line px-5">
                <ol className="flex min-w-max items-center">
                  {STEPS.map((title, i) => {
                    const done = i < step;
                    const active = i === step;
                    const warn = stepIssues(i) > 0 && i < step;
                    return (
                      <li key={title} className="flex items-center">
                        {i > 0 ? <span aria-hidden className={cn("mx-1 h-px w-6 lg:w-10", i <= step ? "bg-ink-40" : "bg-line-strong")} /> : null}
                        <button
                          type="button"
                          onClick={() => setStep(i)}
                          aria-current={active ? "step" : undefined}
                          className={cn(
                            "relative flex items-center gap-2.5 px-2 py-4 text-small transition-colors",
                            active ? "font-medium text-ink" : done ? "text-ink" : "text-ink-muted hover:text-ink",
                          )}
                        >
                          <span
                            className={cn(
                              "grid size-6 shrink-0 place-items-center rounded-full border text-micro font-semibold tabular",
                              active
                                ? "border-evergreen bg-evergreen text-white"
                                : done
                                  ? warn
                                    ? "border-alert text-alert"
                                    : "border-green-700 text-green-700"
                                  : "border-rule-strong text-ink-subtle",
                            )}
                          >
                            {done && !warn ? <Check className="size-3.5" /> : i + 1}
                          </span>
                          {title}
                          {active ? <span aria-hidden className="absolute inset-x-2 -bottom-px h-[3px] bg-evergreen" /> : null}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </nav>
              <div className="px-7 py-7 md:px-9">
                {startErr ? <ErrorState error={startErr} className="mb-6" /> : null}
                <div key={step}>
                    {step === 0 ? <StepIdentity draft={draft} update={update} onStartFrom={startFrom} loadingFrom={loadingFrom} /> : null}
                    {step === 1 ? <StepFramework draft={draft} update={update} /> : null}
                    {step === 2 ? <StepData draft={draft} update={update} /> : null}
                    {step === 3 ? <StepFinancing draft={draft} update={update} /> : null}
                    {step === 4 ? <StepParameters draft={draft} update={update} /> : null}
                    {step === 5 ? <StepReview draft={draft} goTo={setStep} /> : null}
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-line px-7 py-4">
                <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
                  <ArrowLeft /> Back
                </Button>
                {step < STEPS.length - 1 ? (
                  <Button onClick={() => setStep((s) => s + 1)}>
                    Continue <ArrowRight />
                  </Button>
                ) : null}
              </div>
            </div>
        </div>
      )}
      </Container>
    </div>
  );
}
