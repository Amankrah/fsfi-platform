"use client";

import useSWR, { type SWRConfiguration } from "swr";
import type {
  Assessment,
  BudgetLinesPage,
  CalibrateResult,
  Controls,
  CountryProfile,
  CountrySummary,
  DraftRequest,
  DraftScore,
  Evidence,
  Framework,
  Health,
  InvestmentRequest,
  InvestmentResult,
  MappingResult,
  Plan,
  PlanParams,
  ResponseForm,
  StrategyReport,
  ScaleCurves,
  TimeSeries,
  Weighting,
  WeightsReport,
  YearRecord,
} from "./types";

export const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8010/api").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  detail: unknown;
  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

/** Thrown when the API cannot be reached at all (backend not running). */
export class ApiOfflineError extends Error {
  constructor() {
    super("API offline");
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

/** Spec: year, q, page, page_size. stage/component/indicator are backend extensions. */
export interface BudgetLinesQuery {
  year?: string;
  q?: string;
  page?: number;
  page_size?: number;
  stage?: string;
  component?: string;
  indicator?: string;
}

function qs(params?: Query): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

function messageFrom(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "detail" in body) {
    const d = (body as { detail: unknown }).detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) {
      return d
        .map((e) => (e && typeof e === "object" && "msg" in e ? String((e as { msg: unknown }).msg) : JSON.stringify(e)))
        .join("; ");
    }
  }
  return fallback;
}

export async function request<T>(path: string, init?: RequestInit & { query?: Query }): Promise<T> {
  const url = `${API_BASE}${path}${qs(init?.query)}`;
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { Accept: "application/json", ...(init?.headers ?? {}) } });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiOfflineError();
  }
  const text = await res.text();
  let body: unknown = undefined;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) throw new ApiError(res.status, messageFrom(body, `${res.status} ${res.statusText}`), body);
  return body as T;
}

function json<T>(path: string, method: string, data: unknown, signal?: AbortSignal): Promise<T> {
  return request<T>(path, {
    method,
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json" },
    signal,
  });
}

function upload<T>(path: string, file: File): Promise<T> {
  const fd = new FormData();
  fd.append("file", file);
  return request<T>(path, { method: "POST", body: fd });
}

const enc = encodeURIComponent;

function ctlQuery(c: Partial<Controls>): Query {
  return { year: c.year, weighting: c.weighting, scenario: c.scenario, response: c.response };
}

/* ----------------------------------------------------------------- endpoints */

export const api = {
  health: () => request<Health>("/health"),
  framework: () => request<Framework>("/framework"),
  countries: () => request<CountrySummary[]>("/countries"),
  country: (id: string) => request<CountryProfile>(`/countries/${enc(id)}`),
  createCountry: (p: Partial<CountryProfile>) => json<CountryProfile>("/countries", "POST", p),
  updateCountry: (id: string, p: Partial<CountryProfile>) => json<CountryProfile>(`/countries/${enc(id)}`, "PUT", p),
  deleteCountry: (id: string) => request<unknown>(`/countries/${enc(id)}`, { method: "DELETE" }),
  cloneCountry: (id: string, name: string) => json<CountryProfile>(`/countries/${enc(id)}/clone`, "POST", { name }),
  assessment: (id: string, c: Partial<Controls>) =>
    request<Assessment>(`/countries/${enc(id)}/assessment`, { query: ctlQuery(c) }),
  timeseries: (id: string, c: Partial<Controls>) =>
    request<TimeSeries>(`/countries/${enc(id)}/timeseries`, { query: ctlQuery({ ...c, year: undefined }) }),
  scale: (id: string, c: Partial<Controls>) =>
    request<ScaleCurves>(`/countries/${enc(id)}/scale`, { query: ctlQuery({ ...c, year: undefined }) }),
  weights: (id: string, c: Partial<Controls>) =>
    request<WeightsReport>(`/countries/${enc(id)}/weights`, { query: { year: c.year, scenario: c.scenario } }),
  budgetLines: (id: string, q: BudgetLinesQuery) =>
    request<BudgetLinesPage>(`/countries/${enc(id)}/budget-lines`, { query: { ...q } }),
  draft: (id: string, body: DraftRequest, signal?: AbortSignal) =>
    json<DraftScore>(`/countries/${enc(id)}/draft`, "POST", body, signal),
  calibrate: (id: string, body: { weighting?: Weighting; scenario?: string; response?: ResponseForm; apply?: boolean } = {}) =>
    json<CalibrateResult>(`/countries/${enc(id)}/calibrate`, "POST", body),
  assess: (body: {
    profile: CountryProfile;
    year: string;
    weighting?: Weighting;
    scenario?: string;
    response?: ResponseForm;
  }, signal?: AbortSignal) => json<Assessment>("/assess", "POST", body, signal),
  runMapping: (file: File, countryId?: string) =>
    upload<MappingResult>(`/mapping/run${countryId ? `?country_id=${enc(countryId)}` : ""}`, file),
  importRecords: (file: File) => upload<YearRecord[]>("/import/records", file),
  evidence: () => request<Evidence>("/evidence"),
  plan: (id: string, c: Partial<Controls>, p: PlanParams) =>
    request<Plan>(`/countries/${enc(id)}/plan`, { query: { ...ctlQuery({ ...c, year: undefined }), ...p } }),
  investment: (id: string, body: InvestmentRequest) =>
    json<InvestmentResult>(`/countries/${enc(id)}/investment`, "POST", body),
  strategy: (id: string, c: Partial<Controls>, p: PlanParams) =>
    request<StrategyReport>(`/countries/${enc(id)}/strategy`, { query: { ...ctlQuery({ ...c, year: undefined }), ...p } }),
};

export const downloads = {
  mappingTemplate: `${API_BASE}/mapping/template`,
  indicatorsTemplate: `${API_BASE}/templates/indicators.csv`,
  recordsTemplate: `${API_BASE}/templates/records.csv`,
};

/* --------------------------------------------------------------------- hooks */

const base: SWRConfiguration = {
  revalidateOnFocus: false,
  keepPreviousData: true,
  shouldRetryOnError: (err: unknown) => !(err instanceof ApiError && err.status < 500),
  errorRetryCount: 2,
};

export function useHealth() {
  return useSWR<Health>(["health"], () => api.health(), { ...base, refreshInterval: 30_000 });
}

export function useFramework() {
  return useSWR<Framework>(["framework"], () => api.framework(), base);
}

export function useCountries() {
  return useSWR<CountrySummary[]>(["countries"], () => api.countries(), base);
}

export function useCountry(id: string | undefined) {
  return useSWR<CountryProfile>(id ? ["country", id] : null, () => api.country(id!), base);
}

export function useAssessment(id: string | undefined, c: Partial<Controls>) {
  return useSWR<Assessment>(
    id ? ["assessment", id, c.year ?? "", c.weighting, c.scenario, c.response] : null,
    () => api.assessment(id!, c),
    base,
  );
}

export function useTimeSeries(id: string | undefined, c: Partial<Controls>) {
  return useSWR<TimeSeries>(
    id ? ["timeseries", id, c.weighting, c.scenario, c.response] : null,
    () => api.timeseries(id!, c),
    base,
  );
}

export function useScale(id: string | undefined, c: Partial<Controls>) {
  return useSWR<ScaleCurves>(
    id ? ["scale", id, c.weighting, c.scenario, c.response] : null,
    () => api.scale(id!, c),
    base,
  );
}

export function useWeights(id: string | undefined, c: Partial<Controls>) {
  return useSWR<WeightsReport>(
    id ? ["weights", id, c.year ?? "", c.scenario] : null,
    () => api.weights(id!, c),
    base,
  );
}

export function useBudgetLines(id: string | undefined, q: BudgetLinesQuery) {
  return useSWR<BudgetLinesPage>(
    id
      ? ["budget-lines", id, q.year ?? "", q.q ?? "", q.page ?? 1, q.page_size ?? 25, q.stage ?? "", q.component ?? "", q.indicator ?? ""]
      : null,
    () => api.budgetLines(id!, q),
    base,
  );
}

export function useEvidence() {
  return useSWR<Evidence>(["evidence"], () => api.evidence(), base);
}

/** One assessment per year (used by the indicator drawer for series). */
export function useAllYearAssessments(id: string | undefined, years: string[] | undefined, c: Partial<Controls>) {
  return useSWR<Assessment[]>(
    id && years && years.length ? ["assessments-all", id, years.join(","), c.weighting, c.scenario, c.response] : null,
    () => Promise.all(years!.map((y) => api.assessment(id!, { ...c, year: y }))),
    base,
  );
}

const planKey = (p: PlanParams) => [p.horizon, p.target_reduction, p.growth, p.curve, p.pace];

export function usePlan(id: string | undefined, c: Partial<Controls>, p: PlanParams) {
  return useSWR<Plan>(
    id ? ["plan", id, c.weighting, c.scenario, c.response, ...planKey(p)] : null,
    () => api.plan(id!, c, p),
    base,
  );
}

export function useStrategy(id: string | undefined, c: Partial<Controls>, p: PlanParams) {
  return useSWR<StrategyReport>(
    id ? ["strategy", id, c.weighting, c.scenario, c.response, ...planKey(p)] : null,
    () => api.strategy(id!, c, p),
    base,
  );
}

export function useInvestment(id: string | undefined, body: InvestmentRequest | null) {
  return useSWR<InvestmentResult>(
    id && body ? ["investment", id, JSON.stringify(body)] : null,
    () => api.investment(id!, body!),
    base,
  );
}

export function isOffline(err: unknown): boolean {
  return err instanceof ApiOfflineError;
}
