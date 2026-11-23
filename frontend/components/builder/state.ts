import type { Breaks, BudgetLine, Component, CountryProfile, Framework, Indicator, YearRecord } from "@/lib/types";

export interface Cell {
  observed: string;
  benchmark: string;
  allocation: string;
}

export interface Draft {
  version: 1;
  startedFrom: string | null;
  name: string;
  tagline: string;
  description: string;
  currency: string;
  components: (Component & { included: boolean })[];
  indicators: (Indicator & { included: boolean; custom?: boolean })[];
  years: string[];
  data: Record<string, Record<string, Cell>>;
  sensitivities: Record<string, number>;
  ahp: number[][];
  ahpEdited: boolean;
  dependency: Record<string, number[][]>;
  persistence: Record<string, [number, number]>;
  breaks: Breaks;
  budget_lines?: BudgetLine[];
}

const s = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "" : String(+v.toFixed(6)));

export function fromFramework(fw: Framework): Draft {
  const years = ["t0"];
  return {
    version: 1,
    startedFrom: null,
    name: "",
    tagline: "",
    description: "",
    currency: "CU m",
    components: fw.components.map((c) => ({ ...c, included: true })),
    indicators: fw.indicators.map((i) => ({ ...i, included: true })),
    years,
    data: { t0: {} },
    sensitivities: { ...fw.defaults.sensitivities },
    ahp: fw.defaults.ahp_matrix.map((r) => [...r]),
    ahpEdited: false,
    dependency: Object.fromEntries(Object.entries(fw.defaults.dependency_matrices).map(([k, m]) => [k, m.map((r) => [...r])])),
    persistence: { ...fw.defaults.persistence },
    breaks: fw.defaults.breaks,
  };
}

export function fromProfile(p: CountryProfile, fw: Framework | undefined): Draft {
  const used = new Set(p.indicators.map((i) => i.code));
  const fwInds = fw?.indicators ?? [];
  const indicators = [
    ...p.indicators.map((i) => ({ ...i, included: true, custom: !fwInds.some((f) => f.code === i.code) })),
    ...fwInds.filter((i) => !used.has(i.code)).map((i) => ({ ...i, included: false })),
  ];
  const usedC = new Set(p.components.map((c) => c.id));
  const components = [
    ...p.components.map((c) => ({ ...c, included: true })),
    ...(fw?.components ?? []).filter((c) => !usedC.has(c.id)).map((c) => ({ ...c, included: false })),
  ];
  // matrices from the profile are in the profile's component order; extend with defaults (identity/zero) for extra comps
  const C = components.length;
  const n = p.components.length;
  const pad = (m: number[][], diag: number, off: number) =>
    Array.from({ length: C }, (_, i) => Array.from({ length: C }, (_, j) => (i < n && j < n ? m[i][j] : i === j ? diag : off)));
  const data: Draft["data"] = {};
  p.years.forEach((y) => {
    data[y.year] = {};
    Object.entries(y.indicators).forEach(([code, iy]) => {
      data[y.year][code] = { observed: s(iy.observed), benchmark: s(iy.benchmark), allocation: s(iy.allocation) };
    });
  });
  return {
    version: 1,
    startedFrom: p.id,
    name: "",
    tagline: p.tagline ? `Based on ${p.name}` : "",
    description: p.description,
    currency: p.currency,
    components,
    indicators,
    years: p.years.map((y) => y.year),
    data,
    sensitivities: { ...(fw?.defaults.sensitivities ?? {}), ...p.sensitivities },
    ahp: pad(p.ahp_matrix, 1, 1),
    ahpEdited: false,
    dependency: Object.fromEntries(Object.entries(p.dependency_matrices).map(([k, m]) => [k, pad(m, 0, 0.3)])),
    persistence: { ...(fw?.defaults.persistence ?? {}), ...p.persistence },
    breaks: p.breaks,
    budget_lines: p.budget_lines,
  };
}

const num = (v: string) => {
  if (v === undefined || v === null) return null;
  const t = String(v).trim();
  if (!t) return null;
  const x = Number(t);
  return Number.isFinite(x) ? x : NaN;
};

export interface BuildIssue {
  step: number;
  message: string;
}

/** Convert the editable draft into a CountryProfile body (spec §3). */
export function toProfile(d: Draft): { profile: CountryProfile; issues: BuildIssue[] } {
  const issues: BuildIssue[] = [];
  if (!d.name.trim()) issues.push({ step: 0, message: "Give the country a name." });
  const idx = d.components.map((c, i) => (c.included ? i : -1)).filter((i) => i >= 0);
  const comps = idx.map((i) => d.components[i]);
  const compIds = new Set(comps.map((c) => c.id));
  if (!comps.length) issues.push({ step: 1, message: "Include at least one component." });
  const inds = d.indicators.filter((i) => i.included && compIds.has(i.component));
  if (!inds.length) issues.push({ step: 1, message: "Include at least one indicator." });
  const codes = new Set(inds.map((i) => i.code));

  const slice = (m: number[][]) => idx.map((i) => idx.map((j) => m[i]?.[j] ?? (i === j ? 1 : 0)));

  const years: YearRecord[] = [];
  d.years.forEach((y) => {
    const row = d.data[y] ?? {};
    const out: YearRecord["indicators"] = {};
    Object.entries(row).forEach(([code, c]) => {
      if (!codes.has(code)) return;
      const b = num(c.benchmark);
      if (b === null) return;
      const o = num(c.observed);
      const a = num(c.allocation) ?? 0;
      if (Number.isNaN(b) || Number.isNaN(o as number) || Number.isNaN(a)) {
        issues.push({ step: 2, message: `${y} · ${code}: values must be numbers.` });
        return;
      }
      if (b < 0 || a < 0 || (o !== null && o < 0)) {
        issues.push({ step: 2, message: `${y} · ${code}: values must be non-negative.` });
        return;
      }
      out[code] = { observed: o, benchmark: b, allocation: a };
    });
    const envelope = Object.values(out).reduce((acc, v) => acc + v.allocation, 0);
    if (Object.keys(out).length) years.push({ year: y, envelope, indicators: out });
  });
  if (!years.length) issues.push({ step: 2, message: "Enter a benchmark for at least one indicator in one year." });
  years.forEach((y) => {
    if (y.envelope <= 0) issues.push({ step: 3, message: `${y.year}: no allocations entered.` });
  });

  const now = new Date().toISOString();
  const profile: CountryProfile = {
    id: "",
    name: d.name.trim() || "Untitled",
    tagline: d.tagline,
    description: d.description,
    kind: "custom",
    currency: d.currency || "CU m",
    components: comps.map(({ id, name, short }) => ({ id, name, short })),
    indicators: inds.map(({ code, name, component, direction, unit, benchmark_type }) => ({
      code,
      name,
      component,
      direction,
      ...(unit ? { unit } : {}),
      ...(benchmark_type ? { benchmark_type } : {}),
    })),
    sensitivities: Object.fromEntries(comps.map((c) => [c.id, d.sensitivities[c.id] ?? 0.001])),
    ahp_matrix: slice(d.ahp),
    dependency_matrices: Object.fromEntries(Object.entries(d.dependency).map(([k, m]) => [k, slice(m)])),
    persistence: Object.fromEntries(comps.map((c) => [c.id, d.persistence[c.id] ?? [0.4, 0.15]])),
    breaks: d.breaks,
    years,
    ...(d.budget_lines?.length ? { budget_lines: d.budget_lines.filter((l) => !l.indicator || codes.has(l.indicator)) } : {}),
    created_at: now,
    updated_at: now,
  };
  return { profile, issues };
}

/** Body for POST /api/countries and the profile of POST /api/assess (id + kind left to the server). */
export function toRequestBody(p: CountryProfile): Partial<CountryProfile> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, kind, created_at, updated_at, ...rest } = p;
  return rest;
}

export const STORAGE_KEY = "fsfi-builder-draft-v1";

export function nextCustomCode(d: Draft) {
  let k = 1;
  const codes = new Set(d.indicators.map((i) => i.code));
  while (codes.has(`CUS-${String(k).padStart(2, "0")}`)) k++;
  return `CUS-${String(k).padStart(2, "0")}`;
}
