/** Site-wide editorial constants. No figures live here: every number on the site comes from the API. */

export const SITE = {
  name: "Food System Financing Stress Index",
  short: "FSFSI",
  /** placeholders until the article is published and a DOI is minted */
  paper: {
    authors: "Ulimwengu, J., Kwofie, E. A. and Kwofie, E. M.",
    authorsBib: "Ulimwengu, John and Kwofie, Emmanuel Amankrah and Kwofie, Ebenezer Miezah",
    year: "2026",
    title: "Joining budget lines to food-system outcomes shows where money falls short",
    journal: "[journal to be confirmed]",
    doi: "10.xxxx/xxxxx",
  },
  partners: [
    {
      name: "International Food Policy Research Institute (IFPRI)",
      role: "Index design, policy application and corresponding author",
    },
    {
      name: "McGill University, Department of Bioresource Engineering",
      role: "Method development, engine and platform",
    },
  ],
  contact: "j.ulimwengu@cgiar.org",
  licence: {
    outputs: "Platform outputs (charts and tables of synthetic demonstration data) may be reused with attribution.",
    code: "The reference implementation of the published equations is released for non-commercial use; the assessment engine, platform and mapping rules are not open source.",
  },
} as const;

export function citationText(version?: string) {
  const p = SITE.paper;
  return `${p.authors} (${p.year}). ${p.title}. ${p.journal}. https://doi.org/${p.doi}.${version ? ` Platform version ${version}.` : ""}`;
}

export function citationBibtex() {
  const p = SITE.paper;
  return `@article{ulimwengu${p.year}fsfsi,
  author  = {${p.authorsBib}},
  title   = {${p.title}},
  journal = {${p.journal}},
  year    = {${p.year}},
  doi     = {${p.doi}}
}
`;
}

export function citationRis() {
  const p = SITE.paper;
  return [
    "TY  - JOUR",
    "AU  - Ulimwengu, John",
    "AU  - Kwofie, Emmanuel Amankrah",
    "AU  - Kwofie, Ebenezer Miezah",
    `TI  - ${p.title}`,
    `JO  - ${p.journal}`,
    `PY  - ${p.year}`,
    `DO  - ${p.doi}`,
    "ER  - ",
    "",
  ].join("\n");
}
