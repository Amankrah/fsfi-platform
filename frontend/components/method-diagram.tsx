import * as React from "react";
import Link from "next/link";

const STEPS = [
  { n: 1, title: "Budget lines", body: "The executed budget, one row per line, with agency, sub-programme and amount." },
  { n: 2, title: "Mapping", body: "Audited rules assign each line to an outcome indicator within a food-system component." },
  { n: 3, title: "Benchmarks", body: "Each indicator's observed value against its benchmark gives a normalised performance gap." },
  { n: 4, title: "Stress", body: "The part of each gap that spending leaves unfinanced, under diminishing returns." },
  { n: 5, title: "Reallocation", body: "The split of the same envelope that minimises weighted stress, in closed form." },
  { n: 6, title: "Diagnosis", body: "Each indicator labelled unfunded, partially funded, funded or at benchmark." },
];

/** The pipeline as a single diagram: six numbered stages joined by a rule. Horizontal on wide screens. */
export function MethodDiagram({ linkSteps }: { linkSteps?: boolean }) {
  return (
    <figure aria-labelledby="pipeline-cap">
      <ol className="grid gap-0 md:grid-cols-6">
        {STEPS.map((s, i) => (
          <li key={s.n} className="relative flex gap-4 pb-6 md:block md:pb-0 md:pr-4">
            {/* connector */}
            {i < STEPS.length - 1 ? (
              <span aria-hidden className="absolute left-[15px] top-8 h-[calc(100%-2rem)] w-px bg-rule-strong md:left-8 md:right-0 md:top-[15px] md:h-px md:w-auto" />
            ) : null}
            <span className="relative z-10 inline-flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-evergreen bg-paper text-[14px] font-semibold text-evergreen tabular">
              {s.n}
            </span>
            <div className="md:mt-3">
              <p className="font-semibold text-ink">
                {linkSteps ? (
                  <Link href={`/method#step-${s.n}`} className="hover:underline">
                    {s.title}
                  </Link>
                ) : (
                  s.title
                )}
              </p>
              <p className="mt-1 t-ui text-ink-muted">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <figcaption id="pipeline-cap" className="sr-only">
        The assessment pipeline in six stages, from budget lines to diagnosis.
      </figcaption>
    </figure>
  );
}
