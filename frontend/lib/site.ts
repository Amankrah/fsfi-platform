/** Site-wide editorial constants. No figures live here: every number on the site comes from the API. */

export const SITE = {
  name: "Food System Financing Stress Index",
  short: "FSFSI",
  /** The platform's archived software record (Zenodo). The DOI is the all-versions DOI, which resolves to the latest release. */
  software: {
    authors: "Ulimwengu, J., Kwofie, E. A. and Kwofie, E. M.",
    authorsBib: "Ulimwengu, John and Kwofie, Emmanuel Amankrah and Kwofie, Ebenezer Miezah",
    year: "2026",
    title: "FSFI platform: a web platform for the Food System Financing Stress Index",
    publisher: "Zenodo",
    doi: "10.5281/zenodo.24465804",
    repository: "https://github.com/Amankrah/fsfi-platform",
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
    code: "The platform's source code, including the reference implementation of the published equations and the budget-line mapping rules, is published under the PolyForm Noncommercial License 1.0.0. The high-performance computation library used for national assessments is proprietary.",
  },
} as const;

export function citationText(version?: string) {
  const p = SITE.software;
  return `${p.authors} (${p.year}). ${p.title}${version ? ` (version ${version})` : ""} [software]. ${p.publisher}. https://doi.org/${p.doi}.`;
}

export function citationBibtex(version?: string) {
  const p = SITE.software;
  return `@software{ulimwengu${p.year}fsfiplatform,
  author    = {${p.authorsBib}},
  title     = {${p.title}},
  year      = {${p.year}},
  publisher = {${p.publisher}},${version ? `\n  version   = {${version}},` : ""}
  doi       = {${p.doi}},
  url       = {https://doi.org/${p.doi}}
}
`;
}

export function citationRis(version?: string) {
  const p = SITE.software;
  return [
    "TY  - COMP",
    "AU  - Ulimwengu, John",
    "AU  - Kwofie, Emmanuel Amankrah",
    "AU  - Kwofie, Ebenezer Miezah",
    `TI  - ${p.title}`,
    `PB  - ${p.publisher}`,
    `PY  - ${p.year}`,
    ...(version ? [`ET  - ${version}`] : []),
    `DO  - ${p.doi}`,
    `UR  - https://doi.org/${p.doi}`,
    "ER  - ",
    "",
  ].join("\n");
}
