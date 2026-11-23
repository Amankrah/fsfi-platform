"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useHealth } from "@/lib/api";
import { Container, PageHeader } from "@/components/shell/page";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { CitationBlock } from "@/components/citation-block";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { SITE } from "@/lib/site";

const CREDITS = [
  ["Two men sifting grain onto a pile", "Nasiru Othman", "https://unsplash.com/photos/men-sifting-grain-on-outdoor-pile-YIYSe_lLxnY", "Home"],
  ["Aerial view of fields and an irrigation channel", "Bernd Dittrich", "https://unsplash.com/photos/aerial-view-of-agricultural-fields-irrigation-ditch-and-sprinkler-Gz-3pPHOKzw", "Method"],
  ["Dried maize cobs", "Samuel Agyeman-Duah", "https://unsplash.com/photos/corn-on-gray-metal-tray-Gyxf5xtYkKI", "Compare countries"],
  ["Calculator on printed charts", "Jakub Żerdzicki", "https://unsplash.com/photos/smartphone-calculator-app-on-financial-report-papers-4rTXOMv28VA", "Score a draft"],
  ["Stacks of paper documents and file folders", "Wesley Tingey", "https://unsplash.com/photos/stacks-of-paper-documents-and-file-folders-snNHKZ-mGfE", "Data and downloads"],
  ["Man in a straw hat carrying a sack", "Nasiru Othman", "https://unsplash.com/photos/man-in-straw-hat-carrying-sack-OWlfU_l2MAQ", "About"],
] as const;

export default function AboutPage() {
  const { data: health } = useHealth();
  return (
    <div>
      <PageHeader
        eyebrow={<Breadcrumb items={[{ label: "Home", href: "/" }, { label: "About and citation" }]} />}
        title="About the index"
        description="Who built the Food System Financing Stress Index, how to cite it, and what this platform does and does not publish."
      />
      <Container className="py-10">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="min-w-0 space-y-12 lg:col-span-8">
            <section id="purpose" aria-labelledby="purpose-h">
              <h2 id="purpose-h" className="t-h2">
                Purpose
              </h2>
              <div className="prose-measure mt-3">
                <p>
                  Governments rarely join what they spend on the food system to how the food system performs. Instruments
                  that follow money report how much is spent and on what; instruments that follow outcomes report diets,
                  livelihoods and environmental performance. The index joins the two at the level of the budget line, so
                  that a ministry can ask whether the money it already has reaches the shortfalls that most need it.
                </p>
                <p>
                  This platform computes the index for any country and year from an executed budget and a set of outcome
                  indicators, and lets an analyst score a draft budget before it is committed. Every country shown here
                  is synthetic.
                </p>
              </div>
            </section>

            <section id="team" aria-labelledby="team-h">
              <h2 id="team-h" className="t-h2">
                Team and affiliations
              </h2>
              <ul className="mt-3 max-w-[68ch] divide-y divide-rule border-y border-rule">
                <li className="py-3">
                  <p className="font-semibold text-ink">John Ulimwengu</p>
                  <p className="t-ui text-ink-muted">International Food Policy Research Institute (IFPRI), Washington, DC. Corresponding author.</p>
                </li>
                <li className="py-3">
                  <p className="font-semibold text-ink">Emmanuel Amankrah Kwofie</p>
                  <p className="t-ui text-ink-muted">Department of Bioresource Engineering, McGill University, Sainte-Anne-de-Bellevue, Quebec.</p>
                </li>
                <li className="py-3">
                  <p className="font-semibold text-ink">Ebenezer Miezah Kwofie</p>
                  <p className="t-ui text-ink-muted">Department of Bioresource Engineering, McGill University, Sainte-Anne-de-Bellevue, Quebec.</p>
                </li>
              </ul>
            </section>

            <section id="governance" aria-labelledby="gov-h">
              <h2 id="gov-h" className="t-h2">
                Governance and data
              </h2>
              <div className="prose-measure mt-3">
                <p>
                  The platform publishes synthetic data only. The demonstration countries are archetypes
                  produced by a seeded generator and carry a &ldquo;Synthetic demonstration data&rdquo; label wherever
                  they appear. Countries built by users exist only on the machine that runs the API.
                </p>
              </div>
            </section>

            <section id="cite" aria-labelledby="cite-h">
              <h2 id="cite-h" className="t-h2">
                How to cite
              </h2>
              <div className="mt-3">
                <CitationBlock />
              </div>
            </section>

            <section id="changelog" aria-labelledby="log-h">
              <h2 id="log-h" className="t-h2">
                Version history
              </h2>
              <Table className="mt-3" label="Version history">
                <thead>
                  <tr>
                    <Th>Version</Th>
                    <Th>Changes</Th>
                  </tr>
                </thead>
                <tbody>
                  <Tr>
                    <Td className="whitespace-nowrap tabular">{health?.version ?? "…"} (current)</Td>
                    <Td>
                      Redesigned public site: method, comparison, data and citation pages; one figure component with chart,
                      table and CSV views; print stylesheet.
                    </Td>
                  </Tr>
                </tbody>
              </Table>
            </section>

            <section id="partners" aria-labelledby="partners-h">
              <h2 id="partners-h" className="t-h2">
                Partners
              </h2>
              <ul className="mt-3 max-w-[68ch] space-y-2">
                {SITE.partners.map((p) => (
                  <li key={p.name}>
                    <span className="font-semibold text-ink">{p.name}</span>
                    <span className="text-ink-muted">: {p.role}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section id="licence" aria-labelledby="lic-h">
              <h2 id="lic-h" className="t-h2">
                Licence
              </h2>
              <p className="prose-measure mt-3">
                {SITE.licence.outputs} {SITE.licence.code} See{" "}
                <Link href="/data" className="link">
                  Data and downloads
                </Link>
                .
              </p>
            </section>

            <section id="credits" aria-labelledby="credits-h">
              <h2 id="credits-h" className="t-h2">
                Photo credits
              </h2>
              <p className="mt-3 max-w-[68ch] t-ui text-ink-muted">
                All photographs are used under the Unsplash License, accessed 23 November 2026, and shown cropped and
                toned. Captions describe the subject only.
              </p>
              <Table className="mt-3" label="Photo credits">
                <thead>
                  <tr>
                    <Th>Subject</Th>
                    <Th>Photographer</Th>
                    <Th>Used on</Th>
                    <Th>Source</Th>
                  </tr>
                </thead>
                <tbody>
                  {CREDITS.map(([subject, who, url, page]) => (
                    <Tr key={url}>
                      <Td>{subject}</Td>
                      <Td>{who}</Td>
                      <Td>{page}</Td>
                      <Td>
                        <a href={url} className="link" target="_blank" rel="noreferrer">
                          Unsplash<span className="sr-only">: {subject}</span>
                        </a>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </section>

            <section id="contact" aria-labelledby="contact-h">
              <h2 id="contact-h" className="t-h2">
                Contact
              </h2>
              <p className="mt-3">
                <a href={`mailto:${SITE.contact}`} className="link">
                  {SITE.contact}
                </a>
              </p>
            </section>
          </div>

          <aside className="lg:col-span-4" aria-label="Photograph">
            <figure className="lg:sticky lg:top-20">
              <div className="relative aspect-[4/5] w-full max-w-[360px] overflow-hidden bg-evergreen">
                <Image
                  src="/images/portrait-carrying-grain.webp"
                  alt="A man in a woven straw hat walks along a dirt track carrying a sack over his shoulder."
                  fill
                  sizes="(min-width: 1024px) 360px, 90vw"
                  className="object-cover"
                />
              </div>
              <figcaption className="mt-1.5 t-caption text-ink-subtle">Carrying grain from the field. Photo: Nasiru Othman / Unsplash</figcaption>
            </figure>
          </aside>
        </div>
      </Container>
    </div>
  );
}
