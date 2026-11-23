"use client";

import * as React from "react";
import Link from "next/link";
import { useAssessment, useCountries, useCountry, useHealth } from "@/lib/api";
import { Container, PageHeader } from "@/components/shell/page";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { DisplayMath, EQ } from "@/components/math";
import { MethodDiagram } from "@/components/method-diagram";
import { SyntheticBadge } from "@/components/shell/synthetic-badge";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/misc";
import { diagnosisLabel } from "@/lib/encodings";
import { fmtIndex, fmtMoney, fmtNum, fmtPct } from "@/lib/format";
import type { Assessment, CountryProfile } from "@/lib/types";

const TOC = [
  ["step-1", "1. Budget lines"],
  ["step-2", "2. Mapping lines to indicators"],
  ["step-3", "3. Performance gaps"],
  ["step-4", "4. Financing stress and the index"],
  ["step-5", "5. Optimal reallocation and efficiency"],
  ["step-6", "6. Diagnosis"],
  ["materials", "Technical note and code"],
] as const;

export default function MethodPage() {
  const { data: countries } = useCountries();
  const demo = countries?.find((c) => c.id === "aurelia") ?? countries?.find((c) => c.kind === "synthetic");
  const { data: a } = useAssessment(demo?.id, {});
  const { data: p } = useCountry(demo?.id);
  const { data: health } = useHealth();
  // worked example: the indicator with the most stress in the demonstration assessment
  // (prefer a measured, higher-is-better indicator so the example matches the displayed gap formula)
  const ex = a
    ? ([...a.indicators].filter((i) => i.direction === "higher" && !i.imputed).sort((x, y) => y.stress - x.stress)[0] ??
      [...a.indicators].sort((x, y) => y.stress - x.stress)[0])
    : undefined;

  return (
    <div>
      <PageHeader
        image={{
          src: "/images/header-irrigated-fields.webp",
          alt: "Aerial view of cultivated fields crossed by an irrigation channel and a sprinkler, in evergreen duotone.",
          credit: "Photo: Bernd Dittrich / Unsplash",
        }}
        eyebrow={<Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Method" }]} />}
        title="Method"
        description="How an executed budget becomes a measure of financing stress, an optimal reallocation and a diagnosis, in six steps. Each step gives the equation, what it means in plain terms, a worked example from a demonstration assessment, and the assumptions it rests on."
      />
      <Container className="py-10">
        <div className="grid gap-10 lg:grid-cols-12">
          <article className="min-w-0 lg:col-span-8">
            <MethodDiagram linkSteps />

            <Step id="step-1" title="1. Budget lines">
              <p>
                The input is the executed budget for one fiscal year, one row per budget line: the agency, the
                sub-programme, the line description, a budget tag and the amount spent. Executed rather than voted
                amounts are used, because stress depends on money that reached the sector.
              </p>
              <Assumptions items={["Amounts are in one currency unit per country, in millions.", "Lines financed by partners appear on budget and carry an external tag; off-budget finance is not seen."]} />
            </Step>

            <Step id="step-2" title="2. Mapping lines to indicators">
              <p>
                Audited rules assign every line to one outcome indicator, in a fixed order: pre-assigned lines, overhead
                lines (shared pro rata within their sub-programme, agency-year or agency), phrase rules on the line text,
                sub-programme and agency rules, and finally a residual rule by budget tag. The mapper reports what it
                could not assign. The sum of mapped lines is each indicator&apos;s allocation <i>f</i>
                <sub>i</sub>.
              </p>
              <Assumptions items={["Each line funds one indicator; shared costs are split pro rata.", "Unassigned amounts are reported separately and are not distributed across indicators."]} />
            </Step>

            <Step id="step-3" title="3. Performance gaps">
              <p>
                Each indicator&apos;s observed value <i>x</i>
                <sub>i</sub> is compared with its benchmark <i>b</i>
                <sub>i</sub>. The gap is the normalised shortfall, bounded between 0 (at or beyond the benchmark) and 1
                (the whole benchmark missing). For indicators where lower is better, the roles of <i>x</i> and <i>b</i>{" "}
                are reversed.
              </p>
              <DisplayMath mathml={EQ.gap} label="delta i equals the minimum of 1 and max of 0 and b i minus x i, divided by b i" />
              <WorkedExample a={a} p={p} demoName={demo?.name} code={ex?.code} part="gap" />
              <Assumptions items={["Where no observation exists the gap is imputed and flagged as such on every page.", "Indicators without a benchmark in a year are not assessed in that year."]} />
            </Step>

            <Step id="step-4" title="4. Financing stress and the index">
              <p>
                Money closes a gap with diminishing returns. Stress <i>υ</i>
                <sub>i</sub> is the part of the gap that the allocation leaves unfinanced; coverage <i>c</i>
                <sub>i</sub> is the part it absorbs. The sensitivity <i>α</i> is set per component so that <i>α f</i>{" "}
                is of order one at the component&apos;s budget. A hyperbolic response, <i>δ</i>/(1 + <i>αf</i>), is
                available as an alternative.
              </p>
              <DisplayMath mathml={EQ.stress} label="upsilon i equals delta i times e to the minus alpha i f i; coverage c i equals 1 minus e to the minus alpha i f i" />
              <p>
                The index is the weighted sum of indicator stress. Component weights blend expert pairwise judgements,
                dependencies between components and budget shares; each component&apos;s weight is shared equally among
                its indicators.
              </p>
              <DisplayMath mathml={EQ.index} label="FSFSI equals the sum over i of omega i times upsilon i, with weights summing to one" />
              <WorkedExample a={a} p={p} demoName={demo?.name} code={ex?.code} part="stress" />
              <Assumptions items={["Returns diminish exponentially (or hyperbolically) in the allocation.", "Weights are fixed within a year; five weightings are offered for sensitivity."]} />
            </Step>

            <Step id="step-5" title="5. Optimal reallocation and efficiency">
              <p>
                Minimising the index within a fixed envelope <i>F</i> has a closed-form solution: money flows to each
                indicator until its weighted marginal return equals a common level <i>λ</i>, and indicators whose return
                never reaches it receive nothing.
              </p>
              <DisplayMath mathml={EQ.optimum} label="f i star equals the maximum of 0 and one over alpha i times the log of omega i delta i alpha i over lambda; the f star sum to F" />
              <p>
                Efficiency compares the index at the optimum with the index at the actual allocation. Because it depends
                on the size of the envelope as well as its composition, the platform also reports it with the budget
                held at the first year&apos;s size, so that changes over time reflect composition alone.
              </p>
              <DisplayMath mathml={EQ.efficiency} label="E equals FSFSI star over FSFSI, between 0 and 1" />
              {a ? (
                <p className="t-ui text-ink-muted">
                  In the demonstration assessment ({demo?.name}, {a.year}) the index is {fmtIndex(a.system.fsfsi, 3)} at
                  the actual allocation and {fmtIndex(a.system.fsfsi_opt, 3)} at the optimum, so <i>E</i> ={" "}
                  {fmtIndex(a.system.efficiency, 3)}.
                </p>
              ) : (
                <Skeleton className="h-4 w-3/4" />
              )}
              <Assumptions items={["The envelope is fixed; the optimum reallocates it without adding money.", "The optimum indicates the direction and size of shifts; it is not itself a budget proposal."]} />
            </Step>

            <Step id="step-6" title="6. Diagnosis">
              <p>
                Crossing coverage with the gap labels every indicator. Gaps below the gap cut point are at or near
                benchmark. Above it, low coverage means an unfunded gap, middle coverage a partially funded gap and high
                coverage a funded gap: a shortfall that persists where money is concentrated, which points to
                effectiveness rather than to quantity.
              </p>
              {a ? (
                <Table className="mt-4" label="Diagnosis cut points">
                  <caption className="py-2 text-left t-caption text-ink-subtle">Cut points used in the demonstration assessment (from the country profile)</caption>
                  <thead>
                    <tr>
                      <Th>Class</Th>
                      <Th>Rule</Th>
                    </tr>
                  </thead>
                  <tbody>
                    <Tr>
                      <Td>{diagnosisLabel.at_benchmark}</Td>
                      <Td>gap ≤ {fmtNum(a.meta.breaks.indicator[0], 2)}</Td>
                    </Tr>
                    <Tr>
                      <Td>{diagnosisLabel.unfunded_gap}</Td>
                      <Td>coverage ≤ {fmtNum(a.meta.breaks.coverage[0], 2)}</Td>
                    </Tr>
                    <Tr>
                      <Td>{diagnosisLabel.partially_funded_gap}</Td>
                      <Td>
                        {fmtNum(a.meta.breaks.coverage[0], 2)} &lt; coverage ≤ {fmtNum(a.meta.breaks.coverage[1], 2)}
                      </Td>
                    </Tr>
                    <Tr>
                      <Td>{diagnosisLabel.funded_gap}</Td>
                      <Td>coverage &gt; {fmtNum(a.meta.breaks.coverage[1], 2)}</Td>
                    </Tr>
                  </tbody>
                </Table>
              ) : (
                <Skeleton className="h-32 w-full" />
              )}
              <Assumptions items={["Cut points belong to each country's profile; with three or more years of data they can be recalibrated from the country's own record by Fisher–Jenks natural breaks."]} />
            </Step>

            <section id="materials" className="mt-12 scroll-mt-24 border-t border-rule pt-8">
              <h2 className="t-h2">Technical note and code</h2>
              <ul className="mt-4 max-w-[68ch] list-disc space-y-2 pl-5">
                <li>
                  The article: <span className="italic">Joining budget lines to food-system outcomes shows where money falls short</span>{" "}
                  (forthcoming). See{" "}
                  <Link href="/about#cite" className="link">
                    how to cite
                  </Link>
                  .
                </li>
                <li>
                  A reproduction package with the reference implementation of these equations and equivalence tests is
                  released with the article.
                </li>
                <li>
                  The live API that computed every figure on this site documents each endpoint at{" "}
                  <code className="font-mono text-[0.9em]">/docs</code> on the API host. Platform version{" "}
                  <span className="tabular">{health?.version ?? "…"}</span>.
                </li>
              </ul>
            </section>
          </article>

          <aside className="hidden lg:col-span-3 lg:col-start-10 lg:block" aria-label="On this page" data-print-hide>
            <nav className="sticky top-20 border-l border-rule pl-4">
              <p className="t-micro font-semibold text-ink-subtle">On this page</p>
              <ul className="mt-2 space-y-1.5 t-ui">
                {TOC.map(([id, label]) => (
                  <li key={id}>
                    <a href={`#${id}`} className="text-green-700 hover:text-evergreen hover:underline">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
        </div>
      </Container>
    </div>
  );
}

function Step({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} data-major className="mt-12 scroll-mt-24 border-t border-rule pt-8" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="t-h2">
        {title}
      </h2>
      <div className="prose-measure mt-3 space-y-4">{children}</div>
    </section>
  );
}

function Assumptions({ items }: { items: string[] }) {
  return (
    <div className="callout mt-4">
      <p className="t-ui font-semibold text-ink">Assumptions</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 t-ui text-ink-muted">
        {items.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </div>
  );
}

function WorkedExample({
  a,
  p,
  code,
  demoName,
  part,
}: {
  a?: Assessment;
  p?: CountryProfile;
  code?: string;
  demoName?: string;
  part: "gap" | "stress";
}) {
  if (!a || !p || !code) return <Skeleton className="h-28 w-full" />;
  const ind = a.indicators.find((i) => i.code === code);
  const rec = p.years.find((y) => y.year === a.year)?.indicators[code];
  if (!ind || !rec) return null;
  const alpha = p.sensitivities[ind.component];
  const rows: [string, React.ReactNode][] =
    part === "gap"
      ? [
          ["Observed value x", rec.observed === null ? "imputed" : fmtNum(rec.observed, 3)],
          ["Benchmark b", fmtNum(rec.benchmark, 3)],
          ["Direction", ind.direction === "higher" ? "higher is better" : "lower is better"],
          ["Gap δ", fmtIndex(ind.gap, 3)],
        ]
      : [
          ["Gap δ", fmtIndex(ind.gap, 3)],
          ["Allocation f", fmtMoney(rec.allocation, p.currency)],
          ["Sensitivity α (component)", alpha !== undefined ? fmtNum(alpha, 4) : "n/a"],
          ["Coverage c", fmtIndex(ind.coverage, 3)],
          ["Stress υ = δ(1 − c)", fmtIndex(ind.stress, 3)],
          ["Weight ω", fmtPct(ind.weight, 2)],
        ];
  return (
    <div className="mt-2">
      <div className="mb-2 flex flex-wrap items-center gap-2 t-caption text-ink-subtle">
        <span>
          Worked example: {ind.name} ({ind.code}), {demoName}, {a.year}
        </span>
        <SyntheticBadge short />
      </div>
      <Table label="Worked example" className="max-w-md">
        <tbody>
          {rows.map(([k, v]) => (
            <Tr key={k}>
              <Th scope="row" className="w-1/2 bg-ivory font-normal text-ink">
                {k}
              </Th>
              <Td className="text-right tabular">{v}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
