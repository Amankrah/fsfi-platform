// Checks live API payloads against the field lists of lib/types.ts (PLATFORM_SPEC.md §3).
// Usage: node scripts/contract-check.mjs [apiBase]
const BASE = process.argv[2] ?? process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8010/api";

const SPEC = {
  CountrySummary: ["id", "name", "tagline", "kind", "currency", "years", "n_indicators", "latest"],
  "CountrySummary.latest": ["year", "fsfsi", "fsfsi_acc", "efficiency", "stress_class"],
  CountryProfile: ["id", "name", "tagline", "description", "kind", "currency", "components", "indicators", "sensitivities", "ahp_matrix", "dependency_matrices", "persistence", "breaks", "years", "created_at", "updated_at"],
  Assessment: ["country_id", "year", "weighting", "scenario", "response", "system", "components", "indicators", "diagnosis_summary", "front_loaded", "meta"],
  "Assessment.system": ["fsfsi", "fsfsi_acc", "fsfsi_opt", "fsfsi_opt_held", "efficiency", "efficiency_held", "efficiency_fixed_t0", "elasticity", "envelope", "envelope_index", "envelope_multiple", "envelope_multiple_held", "front_loaded_10pct", "financing_response", "stress_class", "lambda", "ahp_cr"],
  IndicatorResult: ["code", "name", "component", "direction", "gap", "imputed", "allocation", "share", "stress", "acc_stress", "coverage", "weight", "stress_class", "diagnosis", "optimal_allocation", "optimal_share", "marginal_return"],
  ComponentResult: ["id", "name", "weight", "share", "stress", "acc_stress", "mean_gap", "coverage", "stress_class", "diagnosis", "optimal_share", "shift_pp", "held_optimal_share", "held_shift_pp", "n_indicators", "n_imputed"],
  DiagnosisSummary: ["diagnosis", "count", "envelope_share", "stress_share"],
  "Assessment.meta": ["engine", "compute_ms", "breaks"],
  TimeSeries: ["country_id", "weighting", "scenario", "response", "years"],
  TimeSeriesYear: ["year", "fsfsi", "fsfsi_acc", "efficiency", "efficiency_fixed_t0", "envelope_index", "n_assessed", "n_imputed", "components", "diagnosis_summary"],
  ScaleCurves: ["country_id", "reference_year", "multiples", "curves"],
  ScaleCurve: ["year", "response", "efficiency", "elasticity", "own_multiple", "own_efficiency"],
  WeightsReport: ["country_id", "year", "scenario", "components", "vectors", "ahp_cr", "dependency_matrix", "scenarios"],
  BudgetLinesPage: ["items", "total"],
  BudgetLine: ["id", "year", "agency", "sub_programme", "line", "budget_tag", "amount", "indicator", "component", "line_class", "rule", "stage"],
  DraftScore: ["fsfsi", "efficiency", "fsfsi_opt", "stress_class", "components", "diagnosis_summary", "delta_vs_actual", "compute_ms"],
  Health: ["status", "engine", "version"],
  Framework: ["components", "indicators", "defaults"],
  "Framework.defaults": ["ahp_matrix", "dependency_matrices", "hybrid_coefficients", "persistence", "breaks", "sensitivities"],
};

let problems = 0;
function check(name, obj) {
  if (obj === null || typeof obj !== "object") {
    console.log(`✗ ${name}: not an object`);
    problems++;
    return;
  }
  const want = SPEC[name];
  const missing = want.filter((k) => !(k in obj));
  const nulls = want.filter((k) => k in obj && obj[k] === null && !["indicator", "component", "line_class", "rule", "stage"].includes(k));
  const extra = Object.keys(obj).filter((k) => !want.includes(k));
  if (missing.length || nulls.length) {
    problems++;
    console.log(`✗ ${name}: missing [${missing.join(", ")}] null [${nulls.join(", ")}]`);
  } else console.log(`✓ ${name}${extra.length ? `  (extensions: ${extra.join(", ")})` : ""}`);
}

async function get(path, init) {
  const r = await fetch(BASE + path, init);
  const t = await r.text();
  if (!r.ok) {
    problems++;
    console.log(`✗ ${init?.method ?? "GET"} ${path} → ${r.status} ${t.slice(0, 200)}`);
    return null;
  }
  return JSON.parse(t);
}

const h = await get("/health");
if (h) check("Health", h);
const fw = await get("/framework");
if (fw) {
  check("Framework", fw);
  check("Framework.defaults", fw.defaults);
}
const list = await get("/countries");
for (const c of list ?? []) {
  check("CountrySummary", c);
  check("CountrySummary.latest", c.latest);
}
for (const c of list ?? []) {
  console.log(`\n== ${c.id}`);
  const p = await get(`/countries/${c.id}`);
  if (p) check("CountryProfile", p);
  for (const q of ["", "?weighting=equal&response=hyperbolic&scenario=" + Object.keys(p?.dependency_matrices ?? {}).at(-1)]) {
    const a = await get(`/countries/${c.id}/assessment${q}`);
    if (!a) continue;
    check("Assessment", a);
    check("Assessment.system", a.system);
    check("Assessment.meta", a.meta);
    check("IndicatorResult", a.indicators[0]);
    check("ComponentResult", a.components[0]);
    check("DiagnosisSummary", a.diagnosis_summary[0]);
    const s = a.system;
    console.log(`   fsfsi=${s.fsfsi.toFixed(3)} E=${s.efficiency.toFixed(3)} el=${s.elasticity.toFixed(3)} mult=${s.envelope_multiple.toFixed(2)} fl10=${s.front_loaded_10pct.toFixed(3)} labels=${a.diagnosis_summary.map((d) => d.diagnosis + ":" + d.count).join(",")} front_loaded=${a.front_loaded.length}pts`);
  }
  const ts = await get(`/countries/${c.id}/timeseries`);
  if (ts) {
    check("TimeSeries", ts);
    check("TimeSeriesYear", ts.years[0]);
  }
  const sc = await get(`/countries/${c.id}/scale`);
  if (sc) {
    check("ScaleCurves", sc);
    check("ScaleCurve", sc.curves[0]);
    console.log(`   scale: ${sc.multiples.length} multiples [${sc.multiples[0]}..${sc.multiples.at(-1)}], responses ${[...new Set(sc.curves.map((x) => x.response))].join("/")}`);
  }
  const w = await get(`/countries/${c.id}/weights`);
  if (w) check("WeightsReport", w);
  const bl = await get(`/countries/${c.id}/budget-lines?page=1&page_size=5`);
  if (bl) {
    check("BudgetLinesPage", bl);
    if (bl.items[0]) check("BudgetLine", bl.items[0]);
  }
  if (p) {
    const latest = p.years.at(-1).year;
    const d = await get(`/countries/${c.id}/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year: latest, envelope_multiplier: 1.5 }),
    });
    if (d) check("DraftScore", d);
  }
}
const ev = await get("/evidence");
if (ev) console.log(`\nevidence keys: ${Object.keys(ev).join(", ")}`);
console.log(`\n${problems ? `${problems} problem(s)` : "all checks passed"}`);
process.exit(problems ? 1 : 0);
