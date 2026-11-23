"use client";

import * as React from "react";
import { API_BASE, downloads, useCountries, useHealth } from "@/lib/api";
import { Container, PageHeader } from "@/components/shell/page";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { DataTable } from "@/components/data-table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ErrorState, PageSkeleton } from "@/components/states";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import type { ColumnSpec } from "@/lib/csv";
import { SITE } from "@/lib/site";

interface Dataset {
  group: "Inputs" | "Outputs" | "Code and API";
  name: string;
  description: string;
  coverage: string;
  vintage: string;
  format: string;
  licence: string;
  href: string;
}

const DICTIONARY: { name: string; fields: [string, string][] }[] = [
  {
    name: "Country profile (JSON)",
    fields: [
      ["components[]", "Food-system components: id, name, short name"],
      ["indicators[]", "Indicator code, name, component, direction (higher or lower is better), unit"],
      ["years[].envelope", "Total mapped budget for the year, in the country currency unit (millions)"],
      ["years[].indicators.{code}", "observed value (null if imputed), benchmark, allocation"],
      ["sensitivities", "Response sensitivity α per component"],
      ["ahp_matrix, dependency_matrices", "Expert pairwise comparisons; component dependencies per scenario"],
      ["breaks", "Cut points for stress classes and diagnosis"],
      ["budget_lines[]", "year, agency, sub-programme, line, budget tag, amount, mapped indicator and rule"],
    ],
  },
  {
    name: "Assessment (JSON)",
    fields: [
      ["system.fsfsi, fsfsi_acc, fsfsi_opt", "Index this year, accumulated, and at the optimum"],
      ["system.efficiency, efficiency_fixed_t0", "Efficiency, and efficiency with the budget held at the first year's size"],
      ["system.envelope_multiple", "Budget multiple that would lower stress as much as the optimal reallocation"],
      ["components[]", "Weight, share, stress, mean gap, coverage, diagnosis, optimal share and shift (percentage points)"],
      ["indicators[]", "Gap, imputed flag, allocation, coverage, stress, weight, diagnosis, optimal allocation, marginal return"],
      ["diagnosis_summary[]", "Count, share of budget and share of stress per diagnosis class"],
      ["meta", "Engine used, compute time and cut points"],
    ],
  },
  {
    name: "Templates (CSV)",
    fields: [
      ["Budget lines", "year, agency, sub_programme, line, budget_tag, amount"],
      ["Indicator records", "year, code, observed, benchmark, allocation"],
      ["Indicator framework", "code, name, component, direction, unit"],
    ],
  },
];

export default function DataPage() {
  const { data: countries, error, mutate } = useCountries();
  const { data: health } = useHealth();
  const version = health?.version ?? "…";

  const rows: Dataset[] = React.useMemo(() => {
    const synth = (countries ?? []).filter((c) => c.kind === "synthetic");
    const out: Dataset[] = [];
    synth.forEach((c) =>
      out.push({
        group: "Inputs",
        name: `${c.name}: country profile`,
        description: "Framework, indicator records, budget lines and parameters for a synthetic country",
        coverage: `${c.years[0]}–${c.latest.year}, ${c.n_indicators} indicators`,
        vintage: `Synthetic generator, platform v${version}`,
        format: "JSON",
        licence: "Reuse with attribution",
        href: `${API_BASE}/countries/${c.id}`,
      }),
    );
    out.push(
      {
        group: "Inputs",
        name: "Indicator framework",
        description: "The reference list of components and indicators with direction and unit",
        coverage: "All components",
        vintage: `Platform v${version}`,
        format: "CSV",
        licence: "Reuse with attribution",
        href: downloads.indicatorsTemplate,
      },
      {
        group: "Inputs",
        name: "Budget-line template",
        description: "Column layout the mapper accepts for executed budget lines",
        coverage: "Template",
        vintage: `Platform v${version}`,
        format: "CSV",
        licence: "Reuse with attribution",
        href: downloads.mappingTemplate,
      },
      {
        group: "Inputs",
        name: "Indicator-records template",
        description: "Observed values, benchmarks and allocations by year and indicator",
        coverage: "Template",
        vintage: `Platform v${version}`,
        format: "CSV",
        licence: "Reuse with attribution",
        href: downloads.recordsTemplate,
      },
    );
    synth.forEach((c) =>
      out.push({
        group: "Outputs",
        name: `${c.name}: assessment, ${c.latest.year}`,
        description: "Index, efficiency, component and indicator results, diagnosis and optimum (hybrid weights, normal operations)",
        coverage: `${c.latest.year}`,
        vintage: `Computed on request, engine v${version}`,
        format: "JSON",
        licence: "Reuse with attribution",
        href: `${API_BASE}/countries/${c.id}/assessment`,
      }),
    );
    synth.forEach((c) =>
      out.push({
        group: "Outputs",
        name: `${c.name}: record over time`,
        description: "Index, accumulated stress, efficiency and component stress for every year",
        coverage: `${c.years[0]}–${c.latest.year}`,
        vintage: `Computed on request, engine v${version}`,
        format: "JSON",
        licence: "Reuse with attribution",
        href: `${API_BASE}/countries/${c.id}/timeseries`,
      }),
    );
    out.push({
      group: "Code and API",
      name: "API reference",
      description: "Interactive documentation of every endpoint used by this site",
      coverage: "All endpoints",
      vintage: `Platform v${version}`,
      format: "OpenAPI",
      licence: "Documentation",
      href: API_BASE.replace(/\/api$/, "/docs"),
    });
    return out;
  }, [countries, version]);

  const columns: ColumnSpec<Dataset>[] = [
    {
      key: "name",
      header: "Dataset",
      value: (d) => d.name,
      cell: (d) => (
        <span className="flex flex-col py-1">
          <span className="font-medium text-ink">{d.name}</span>
          <span className="t-caption text-ink-subtle">{d.description}</span>
        </span>
      ),
    },
    { key: "coverage", header: "Coverage", value: (d) => d.coverage },
    { key: "vintage", header: "Vintage", value: (d) => d.vintage },
    { key: "format", header: "Format", value: (d) => d.format },
    { key: "licence", header: "Licence", value: (d) => d.licence },
    {
      key: "href",
      header: "Download",
      value: (d) => d.href,
      cell: (d) => (
        <a href={d.href} className="link whitespace-nowrap" download={d.format === "CSV" ? "" : undefined} target={d.format === "CSV" ? undefined : "_blank"} rel="noreferrer">
          {d.format === "OpenAPI" ? "Open" : `Download ${d.format}`}
          <span className="sr-only"> for {d.name}</span>
        </a>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        image={{
          src: "/images/header-document-stacks.webp",
          alt: "Stacks of paper files with tabbed folders, in evergreen duotone.",
          credit: "Photo: Wesley Tingey / Unsplash",
        }}
        eyebrow={<Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Data and downloads" }]} />}
        title="Data and downloads"
        description="Every input and output behind the figures on this site, in open formats. All country data here are synthetic archetypes produced by a seeded generator."
      />
      <Container className="py-10">
        <div className="callout max-w-[68ch]" id="licence">
          <p className="font-semibold text-ink">Licence in plain words</p>
          <p className="mt-1 text-ink-muted">
            {SITE.licence.outputs} Cite the platform version you used. {SITE.licence.code}
          </p>
        </div>

        {error ? (
          <ErrorState error={error} onRetry={() => void mutate()} className="mt-8" />
        ) : !countries ? (
          <div className="mt-8">
            <PageSkeleton />
          </div>
        ) : (
          (["Inputs", "Outputs", "Code and API"] as const).map((g) => (
            <section key={g} className="mt-10" aria-labelledby={`g-${g}`}>
              <h2 id={`g-${g}`} className="t-h2">
                {g}
              </h2>
              <DataTable
                className="mt-4"
                rows={rows.filter((r) => r.group === g)}
                columns={columns}
                caption={`${g}: datasets`}
                captionHidden
                filename={`fsfsi-datasets-${g.toLowerCase().replace(/\W+/g, "-")}`}
                rowKey={(r) => r.href}
                frozenFirst={false}
              />
            </section>
          ))
        )}

        <section className="mt-12" aria-labelledby="dict-h">
          <h2 id="dict-h" className="t-h2">
            Data dictionary
          </h2>
          <Accordion type="multiple" className="mt-4 max-w-[880px] border-t border-rule">
            {DICTIONARY.map((d) => (
              <AccordionItem key={d.name} value={d.name}>
                <AccordionTrigger>{d.name}</AccordionTrigger>
                <AccordionContent>
                  <Table label={`${d.name} fields`}>
                    <thead>
                      <tr>
                        <Th>Field</Th>
                        <Th>Meaning</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.fields.map(([k, v]) => (
                        <Tr key={k}>
                          <Td className="font-mono text-[13px]">{k}</Td>
                          <Td>{v}</Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <section className="mt-12 max-w-[68ch]" aria-labelledby="api-h">
          <h2 id="api-h" className="t-h2">
            Using the API
          </h2>
          <p className="mt-3">
            Every figure on this site is computed by the same API. Assessments take the query parameters{" "}
            <code className="font-mono text-[0.9em]">year</code>, <code className="font-mono text-[0.9em]">weighting</code>,{" "}
            <code className="font-mono text-[0.9em]">scenario</code> and <code className="font-mono text-[0.9em]">response</code>. For example:
          </p>
          <pre className="mt-3 overflow-x-auto border border-rule bg-surface p-3 font-mono text-[13px] text-ink">
            {`GET ${API_BASE}/countries/{id}/assessment?year={year}&weighting=equal`}
          </pre>
          <p className="mt-3 t-ui text-ink-muted">Each chart on the site also offers its plotted data as CSV from its Download tab.</p>
        </section>

        <section className="mt-12 max-w-[68ch]" aria-labelledby="log-h">
          <h2 id="log-h" className="t-h2">
            Data versions
          </h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5">
            <li>
              Platform v{version}: {countries?.filter((c) => c.kind === "synthetic").length ?? "…"} synthetic demonstration
              countries, regenerated from a seeded generator whenever the generator version changes.
            </li>
          </ul>
        </section>
      </Container>
    </div>
  );
}
