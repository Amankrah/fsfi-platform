"""Full assessment pipeline (Methods of the paper): gaps and imputation, stress, weights, index, KKT optimum
(and the hold-benchmark variant), efficiency at the actual and at a fixed envelope, elasticity (Proposition 1),
scale curves, envelope equivalent, front-loaded curve, financing response, accumulated stress, classes and
diagnosis. Works on plain profile dicts (CountryProfile JSON)."""
from __future__ import annotations

import hashlib
import json
import math
import time
from collections import OrderedDict
from dataclasses import dataclass

import numpy as np

from .engine import get_engine, kkt
from .engine import reference as R

WEIGHTINGS = ("hybrid", "equal", "expert", "network", "financial")
RESPONSES = ("exponential", "hyperbolic")
DIAGNOSES = ("at_benchmark", "unfunded_gap", "partially_funded_gap", "funded_gap")
SCALE_MULTIPLES = [float(x) for x in np.geomspace(0.1, 8.0, 40)]
FRONT_GRID = [round(float(x), 4) for x in np.linspace(0.0, 1.0, 41)]
ENVELOPE_MULTIPLE_CAP = 1000.0
DEFAULT_SCENARIO = "normal_operations"


class AssessmentError(ValueError):
    pass


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def finite(x, default=0.0):
    """Recursively replace NaN / inf by `default` so that responses are valid JSON."""
    if isinstance(x, float):
        return x if math.isfinite(x) else default
    if isinstance(x, (np.floating,)):
        v = float(x)
        return v if math.isfinite(v) else default
    if isinstance(x, (np.integer,)):
        return int(x)
    if isinstance(x, dict):
        return {k: finite(v, default) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [finite(v, default) for v in x]
    if isinstance(x, np.ndarray):
        return [finite(v, default) for v in x.tolist()]
    return x


def profile_key(profile: dict) -> str:
    return hashlib.sha1(json.dumps(profile, sort_keys=True, default=str).encode()).hexdigest()


_VEC_CACHE: dict = {}


def _matrix_vectors(ahp_m, dep_m):
    """AHP (weights, CR), PageRank and cascade vectors for a pair of matrices (cached by content)."""
    key = json.dumps([ahp_m, dep_m])
    v = _VEC_CACHE.get(key)
    if v is None:
        a = R.ahp(np.asarray(ahp_m, float))
        v = (np.asarray(a["weights"]), float(a["cr"]), R.pagerank(np.asarray(dep_m, float)), R.cascade(np.asarray(dep_m, float)))
        if len(_VEC_CACHE) > 256:
            _VEC_CACHE.clear()
        _VEC_CACHE[key] = v
    return v


def scenario_matrices(profile: dict, scenario: str):
    deps = profile.get("dependency_matrices") or {}
    if scenario not in deps:
        raise AssessmentError(f"unknown scenario '{scenario}'; available: {sorted(deps)}")
    ahp_ms = profile.get("ahp_matrices") or {}
    ahp_m = ahp_ms.get(scenario) or profile["ahp_matrix"]
    return ahp_m, deps[scenario]


def hybrid_coefficients(profile: dict) -> dict:
    return profile.get("hybrid_coefficients") or R.PARAMS["hybrid_coefficients"]


def resolve_year(profile: dict, year: str | None) -> int:
    years = [y["year"] for y in profile.get("years", [])]
    if not years:
        raise AssessmentError("profile has no years")
    if year is None or year == "":
        return len(years) - 1
    if year not in years:
        raise AssessmentError(f"unknown year '{year}'; available: {years}")
    return years.index(year)


# ---------------------------------------------------------------------------
# One year: inputs and core computation
# ---------------------------------------------------------------------------

@dataclass
class YearInputs:
    year: str
    codes: list
    names: list
    comps: list
    directions: list
    delta: np.ndarray
    imputed: np.ndarray
    f: np.ndarray
    alpha: np.ndarray


def year_inputs(profile: dict, yi: int, allocations: dict | None = None) -> YearInputs:
    yr = profile["years"][yi]
    comp_ids = [c["id"] for c in profile["components"]]
    sens = profile["sensitivities"]
    codes, names, comps, dirs, delta, imp, f, alpha = [], [], [], [], [], [], [], []
    for ind in profile["indicators"]:
        code = ind["code"]
        iy = yr["indicators"].get(code)
        if iy is None or ind["component"] not in comp_ids:
            continue
        b = float(iy["benchmark"])
        hib = ind["direction"] == "higher"
        obs = iy.get("observed")
        imputed = obs is None
        if imputed:
            obs = 0.5 * b if hib else 1.5 * b
        g = R.gap(float(obs), b, hib)
        alloc = float(allocations.get(code, iy["allocation"])) if allocations is not None else float(iy["allocation"])
        if alloc < 0:
            raise AssessmentError(f"negative allocation for {code} in {yr['year']}")
        codes.append(code)
        names.append(ind["name"])
        comps.append(ind["component"])
        dirs.append(ind["direction"])
        delta.append(g)
        imp.append(imputed)
        f.append(alloc)
        alpha.append(float(sens.get(ind["component"], 0.0)))
    if not codes:
        raise AssessmentError(f"no assessed indicators in {yr['year']}")
    return YearInputs(yr["year"], codes, names, comps, dirs, np.array(delta), np.array(imp, bool), np.array(f),
                      np.array(alpha))


def component_weight_vector(profile, comps_of_ind, f, weighting, scenario):
    """Component weights (profile component order) for the given method; None for equal weighting."""
    comp_ids = [c["id"] for c in profile["components"]]
    ahp_m, dep_m = scenario_matrices(profile, scenario)
    wa, cr, wp, wc = _matrix_vectors(ahp_m, dep_m)
    ca = {}
    for k, v in zip(comps_of_ind, f):
        ca[k] = ca.get(k, 0.0) + float(v)
    wf = R.financial(ca, comp_ids)
    if weighting == "equal":
        cw = None
    elif weighting == "expert":
        cw = wa
    elif weighting == "network":
        cw = wp
    elif weighting == "financial":
        cw = wf
    elif weighting == "hybrid":
        cw = R.hybrid_from_vectors(wa, wp, wc, wf, hybrid_coefficients(profile))
    else:
        raise AssessmentError(f"unknown weighting '{weighting}'")
    return cw, dict(ahp=wa, pagerank=wp, cascade=wc, financial=wf, cr=cr)


def indicator_weights(profile, comps_of_ind, f, weighting, scenario):
    comp_ids = [c["id"] for c in profile["components"]]
    cw, vec = component_weight_vector(profile, comps_of_ind, f, weighting, scenario)
    n = len(comps_of_ind)
    if cw is None:
        return np.full(n, 1.0 / n), vec
    nc = {}
    for k in comps_of_ind:
        nc[k] = nc.get(k, 0) + 1
    cmap = dict(zip(comp_ids, cw))
    w = np.array([cmap.get(k, 0.0) / nc[k] for k in comps_of_ind])
    return (w / w.sum() if w.sum() > 0 else np.full(n, 1.0 / n)), vec


def core(profile, yi, weighting, scenario, response, allocations=None, envelope_multiplier=1.0, engine=None):
    eng = engine or get_engine()
    x = year_inputs(profile, yi, allocations)
    f = x.f * float(envelope_multiplier)
    F = float(f.sum())
    w, vec = indicator_weights(profile, x.comps, f, weighting, scenario)
    s = kkt.stress(x.delta, f, x.alpha, response)
    fs = eng.index(x.delta, f, x.alpha, w, response)
    fopt, lam = eng.optimum(x.delta, x.alpha, w, F, response)
    fso = kkt.index(x.delta, fopt, x.alpha, w, response)
    E = eng.efficiency(fs, fso, response)
    return dict(x=x, f=f, F=F, w=w, vec=vec, stress=s, fsfsi=fs, fopt=fopt, lam=lam, fsfsi_opt=fso, E=E,
                engine=eng.label(response), engine_functions=eng.used(response))


# ---------------------------------------------------------------------------
# Derived quantities
# ---------------------------------------------------------------------------

def elasticity(delta, f, alpha, w, response, lam=None, fopt=None) -> float:
    """d ln E / d ln F = F (sum_i s_i r_i / FSFSI - lambda / FSFSI*) (Proposition 1, Eq. elasticity), with
    r_i = -w_i d upsilon_i / d f_i at the actual allocation and lambda the multiplier of the optimum."""
    F = float(np.sum(f))
    fs = kkt.index(delta, f, alpha, w, response)
    if F <= 0 or fs <= 0:
        return 0.0
    if fopt is None or lam is None:
        fopt, lam = kkt.optimum(delta, alpha, w, F, response)
    fso = kkt.index(delta, fopt, alpha, w, response)
    if fso <= 0:
        return 0.0
    r = kkt.marginal_return(delta, f, alpha, w, response)
    return float(np.sum(f * r) / fs - F * lam / fso)


def elasticity_numeric(delta, f, alpha, w, response, h=1e-5) -> float:
    """Central difference of ln E in ln F (weights held fixed), for verification."""
    def lnE(k):
        ff = f * k
        fs = kkt.index(delta, ff, alpha, w, response)
        fo, _ = kkt.optimum(delta, alpha, w, float(ff.sum()), response)
        return math.log(kkt.index(delta, fo, alpha, w, response) / fs)
    return (lnE(math.exp(h)) - lnE(math.exp(-h))) / (2 * h)


def efficiency_at(delta, shares, alpha, w, F, response) -> float:
    f = shares * F
    fs = kkt.index(delta, f, alpha, w, response)
    if fs <= 0:
        return 1.0
    fo, _ = kkt.optimum(delta, alpha, w, F, response)
    return float(min(1.0, kkt.index(delta, fo, alpha, w, response) / fs))


def envelope_multiple(delta, f, alpha, w, target, response) -> float:
    """m such that FSFSI(m f) = target at unchanged shares (bisection on ln m)."""
    def g(m):
        return kkt.index(delta, f * m, alpha, w, response) - target
    if g(1.0) <= 0:
        return 1.0
    lo, hi = 0.0, math.log(2.0)
    while g(math.exp(hi)) > 0:
        lo = hi
        hi *= 2
        if math.exp(hi) > ENVELOPE_MULTIPLE_CAP:
            if g(ENVELOPE_MULTIPLE_CAP) > 0:
                return ENVELOPE_MULTIPLE_CAP
            hi = math.log(ENVELOPE_MULTIPLE_CAP)
            break
    for _ in range(100):
        mid = 0.5 * (lo + hi)
        if g(math.exp(mid)) > 0:
            lo = mid
        else:
            hi = mid
        if hi - lo < 1e-13:
            break
    return float(math.exp(0.5 * (lo + hi)))


def front_loaded(delta, f, fopt, alpha, w, response, grid=FRONT_GRID):
    """Share of the full index reduction captured by moving a share s of the envelope along the optimal
    direction: f(s) = f + s'(f* - f), s' = min(1, s F / D), D = sum max(0, f* - f)."""
    F = float(np.sum(f))
    D = float(np.sum(np.maximum(fopt - f, 0.0)))
    fs = kkt.index(delta, f, alpha, w, response)
    fso = kkt.index(delta, fopt, alpha, w, response)
    full = fs - fso
    out = []
    for s in grid:
        if full <= 1e-15 or D <= 0:
            out.append({"moved": float(s), "captured": 1.0 if s > 0 else 0.0})
            continue
        sp = min(1.0, s * F / D)
        v = kkt.index(delta, f + sp * (fopt - f), alpha, w, response)
        out.append({"moved": float(s), "captured": float(min(1.0, max(0.0, (fs - v) / full)))})
    return out


def held_optimum(delta, f, alpha, w, held_mask, response):
    """Hold the budgets of indicators at or near benchmark at their actual values; reallocate the rest."""
    out = f.copy()
    free = ~held_mask
    if not free.any():
        return out
    F_rest = float(np.sum(f[free]))
    fo, _ = kkt.optimum(delta[free], alpha[free], w[free], F_rest, response)
    out[free] = fo
    return out


# ---------------------------------------------------------------------------
# Record: all years for one parameter set (cached)
# ---------------------------------------------------------------------------

_RECORD_CACHE: "OrderedDict[tuple, list]" = OrderedDict()


def _cache_get(cache, key, maxsize=256):
    v = cache.get(key)
    if v is not None:
        cache.move_to_end(key)
    return v


def _cache_put(cache, key, value, maxsize=256):
    cache[key] = value
    cache.move_to_end(key)
    while len(cache) > maxsize:
        cache.popitem(last=False)


def breaks_of(profile):
    b = profile.get("breaks") or R.PARAMS["cut_points_published"]
    return {k: list(b[k]) for k in ("indicator", "component", "system", "coverage")}


def record(profile, weighting="hybrid", scenario=DEFAULT_SCENARIO, response="exponential", key=None):
    """Core results for every year plus accumulated stress (Eq. ema) with the profile's persistence rates."""
    ck = (key or profile_key(profile), weighting, scenario, response, get_engine().mode)
    hit = _cache_get(_RECORD_CACHE, ck)
    if hit is not None:
        return hit
    rates = {c: tuple(v) for c, v in (profile.get("persistence") or {}).items()}
    prev = None
    out = []
    for yi in range(len(profile["years"])):
        c = core(profile, yi, weighting, scenario, response)
        x = c["x"]
        cmap = dict(zip(x.codes, x.comps))
        prev, acc = R.accumulated_step(prev, dict(zip(x.codes, c["stress"])), cmap, c["fsfsi"], rates)
        c["acc"] = np.array([prev[k] for k in x.codes])
        c["fsfsi_acc"] = float(acc)
        out.append(c)
    _cache_put(_RECORD_CACHE, ck, out)
    return out


# ---------------------------------------------------------------------------
# Labels, components, summaries
# ---------------------------------------------------------------------------

def indicator_labels(delta, stress, br):
    return [R.diagnose(d, s, br["indicator"], br["coverage"]) for d, s in zip(delta, stress)]


def diagnosis_summary(labels, f, stress):
    F = float(np.sum(f))
    S = float(np.sum(stress))
    out = []
    for lab in DIAGNOSES:
        m = np.array([l == lab for l in labels], bool)
        out.append({"diagnosis": lab, "count": int(m.sum()),
                    "envelope_share": float(f[m].sum() / F) if F > 0 else 0.0,
                    "stress_share": float(stress[m].sum() / S) if S > 0 else 0.0})
    return out


def _coverage_from_means(mean_gap, mean_stress):
    c = R.coverage_from(mean_gap, mean_stress, R.GAP_EPS)
    return c


def component_rows(profile, c, br, fopt_held=None, acc=None):
    x = c["x"]
    F = c["F"]
    rows = []
    comps = np.array(x.comps)
    for comp in profile["components"]:
        cid = comp["id"]
        m = comps == cid
        n = int(m.sum())
        if n == 0:
            rows.append({"id": cid, "name": comp["name"], "weight": 0.0, "share": 0.0, "stress": 0.0, "acc_stress": 0.0,
                         "mean_gap": 0.0, "coverage": 0.0, "stress_class": "low", "diagnosis": "at_benchmark",
                         "optimal_share": 0.0, "shift_pp": 0.0, "held_optimal_share": 0.0, "held_shift_pp": 0.0,
                         "n_indicators": 0, "n_imputed": 0})
            continue
        share = float(c["f"][m].sum() / F) if F > 0 else 0.0
        opt_share = float(c["fopt"][m].sum() / F) if F > 0 else 0.0
        held_share = float(fopt_held[m].sum() / F) if (F > 0 and fopt_held is not None) else opt_share
        mg = float(x.delta[m].mean())
        ms = float(c["stress"][m].mean())
        cov = _coverage_from_means(mg, ms)
        if cov is None:
            cov = float(kkt.coverage(c["f"][m], x.alpha[m]).mean())
        rows.append({
            "id": cid, "name": comp["name"], "weight": float(c["w"][m].sum()), "share": share, "stress": ms,
            "acc_stress": float(acc[m].mean()) if acc is not None else ms, "mean_gap": mg, "coverage": float(cov),
            "stress_class": R.classify(ms, br["component"]),
            "diagnosis": R.diagnose(mg, ms, br["indicator"], br["coverage"]),
            "optimal_share": opt_share, "shift_pp": (opt_share - share) * 100.0,
            "held_optimal_share": held_share, "held_shift_pp": (held_share - share) * 100.0,
            "n_indicators": n, "n_imputed": int(x.imputed[m].sum()),
        })
    return rows


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def check_params(profile, weighting, scenario, response):
    if weighting not in WEIGHTINGS:
        raise AssessmentError(f"unknown weighting '{weighting}'")
    if response not in RESPONSES:
        raise AssessmentError(f"unknown response '{response}'")
    scenario_matrices(profile, scenario)


def assessment(profile, year=None, weighting="hybrid", scenario=DEFAULT_SCENARIO, response="exponential", key=None):
    t0 = time.perf_counter()
    check_params(profile, weighting, scenario, response)
    yi = resolve_year(profile, year)
    rec = record(profile, weighting, scenario, response, key)
    c = rec[yi]
    x = c["x"]
    br = breaks_of(profile)
    f, F, w, d, a = c["f"], c["F"], c["w"], x.delta, x.alpha
    stress = c["stress"]
    labels = indicator_labels(d, stress, br)
    held = np.array([l == "at_benchmark" for l in labels], bool)
    fopt_held = held_optimum(d, f, a, w, held, response)
    fso_held = kkt.index(d, fopt_held, a, w, response)
    shares = f / F if F > 0 else np.zeros_like(f)
    F0 = rec[0]["F"]
    E_t0 = efficiency_at(d, shares, a, w, F0, response) if F > 0 else 1.0
    F_last = rec[-1]["F"]
    E_last = efficiency_at(d, shares, a, w, F_last, response) if F > 0 else 1.0
    el = elasticity(d, f, a, w, response, c["lam"], c["fopt"])
    m = envelope_multiple(d, f, a, w, c["fsfsi_opt"], response)
    m_held = envelope_multiple(d, f, a, w, fso_held, response)
    fl = front_loaded(d, f, c["fopt"], a, w, response)
    fl10 = next(p["captured"] for p in fl if abs(p["moved"] - 0.1) < 1e-9)
    wd = float(np.sum(w * d))
    fin_resp = 1.0 - c["fsfsi"] / wd if wd > 0 else 0.0
    r = kkt.marginal_return(d, f, a, w, response)
    cov = kkt.coverage(f, a, response)
    fs = c["fsfsi"]
    ind_rows = []
    for i, code in enumerate(x.codes):
        ind_rows.append({
            "code": code, "name": x.names[i], "component": x.comps[i], "direction": x.directions[i],
            "gap": float(d[i]), "imputed": bool(x.imputed[i]), "allocation": float(f[i]),
            "share": float(shares[i]), "stress": float(stress[i]), "acc_stress": float(c["acc"][i]),
            "coverage": float(cov[i]), "weight": float(w[i]),
            "stress_class": R.classify(stress[i], br["indicator"]), "diagnosis": labels[i],
            "optimal_allocation": float(c["fopt"][i]), "optimal_share": float(c["fopt"][i] / F) if F > 0 else 0.0,
            "marginal_return": float(r[i]),
        })
    comp_rows = component_rows(profile, c, br, fopt_held, c["acc"])
    E_held = float(min(1.0, fso_held / fs)) if fs > 0 else 1.0
    out = {
        "country_id": profile.get("id", ""), "year": x.year, "weighting": weighting, "scenario": scenario,
        "response": response,
        "system": {
            "fsfsi": fs, "fsfsi_acc": c["fsfsi_acc"], "fsfsi_opt": c["fsfsi_opt"], "fsfsi_opt_held": fso_held,
            "efficiency": c["E"], "efficiency_held": E_held, "efficiency_fixed_t0": E_t0,
            "efficiency_fixed_latest": E_last, "elasticity": el, "envelope": F,
            "envelope_index": F / F0 * 100.0 if F0 > 0 else 100.0, "envelope_multiple": m,
            "envelope_multiple_held": m_held, "front_loaded_10pct": fl10, "financing_response": fin_resp,
            "stress_class": R.classify(fs, br["system"]), "lambda": c["lam"], "ahp_cr": c["vec"]["cr"],
        },
        "components": comp_rows,
        "indicators": ind_rows,
        "diagnosis_summary": diagnosis_summary(labels, f, stress),
        "front_loaded": fl,
        "meta": {"engine": c["engine"], "engine_functions": c["engine_functions"], "compute_ms": 0.0, "breaks": br},
    }
    out = finite(out)
    out["meta"]["compute_ms"] = (time.perf_counter() - t0) * 1000.0
    return out


def timeseries(profile, weighting="hybrid", scenario=DEFAULT_SCENARIO, response="exponential", key=None):
    check_params(profile, weighting, scenario, response)
    rec = record(profile, weighting, scenario, response, key)
    br = breaks_of(profile)
    F0 = rec[0]["F"]
    years = []
    for c in rec:
        x = c["x"]
        F = c["F"]
        shares = c["f"] / F if F > 0 else np.zeros_like(c["f"])
        labels = indicator_labels(x.delta, c["stress"], br)
        comps = {}
        xc = np.array(x.comps)
        for comp in profile["components"]:
            m = xc == comp["id"]
            if m.any():
                comps[comp["id"]] = {"stress": float(c["stress"][m].mean()), "acc_stress": float(c["acc"][m].mean()),
                                     "share": float(shares[m].sum())}
            else:
                comps[comp["id"]] = {"stress": 0.0, "acc_stress": 0.0, "share": 0.0}
        years.append({
            "year": x.year, "fsfsi": c["fsfsi"], "fsfsi_acc": c["fsfsi_acc"], "efficiency": c["E"],
            "efficiency_fixed_t0": efficiency_at(x.delta, shares, x.alpha, c["w"], F0, response) if F > 0 else 1.0,
            "envelope": F, "envelope_index": F / F0 * 100.0 if F0 > 0 else 100.0,
            "n_assessed": len(x.codes), "n_imputed": int(x.imputed.sum()),
            "stress_class": R.classify(c["fsfsi"], br["system"]),
            "components": comps, "diagnosis_summary": diagnosis_summary(labels, c["f"], c["stress"]),
        })
    return finite({"country_id": profile.get("id", ""), "weighting": weighting, "scenario": scenario,
                   "response": response, "years": years})


def scale_curves(profile, weighting="hybrid", scenario=DEFAULT_SCENARIO, key=None):
    check_params(profile, weighting, scenario, "exponential")
    rec = record(profile, weighting, scenario, "exponential", key)
    F_ref = rec[-1]["F"]
    curves = []
    for c in rec:
        x = c["x"]
        F = c["F"]
        shares = c["f"] / F if F > 0 else np.full(len(c["f"]), 1.0 / len(c["f"]))
        w = c["w"]
        for resp in RESPONSES:
            eff = [efficiency_at(x.delta, shares, x.alpha, w, mm * F_ref, resp) for mm in SCALE_MULTIPLES]
            curves.append({"year": x.year, "response": resp, "efficiency": eff,
                           "elasticity": elasticity(x.delta, c["f"], x.alpha, w, resp),
                           "own_multiple": F / F_ref if F_ref > 0 else 1.0,
                           "own_efficiency": efficiency_at(x.delta, shares, x.alpha, w, F, resp)})
    return finite({"country_id": profile.get("id", ""), "reference_year": rec[-1]["x"].year,
                   "reference_envelope": F_ref, "multiples": SCALE_MULTIPLES, "curves": curves})


def weights_report(profile, year=None, scenario=DEFAULT_SCENARIO):
    yi = resolve_year(profile, year)
    x = year_inputs(profile, yi)
    cw, vec = component_weight_vector(profile, x.comps, x.f, "hybrid", scenario)
    _, dep = scenario_matrices(profile, scenario)
    return finite({
        "country_id": profile.get("id", ""), "year": x.year, "scenario": scenario,
        "components": [c["id"] for c in profile["components"]],
        "vectors": {"ahp": vec["ahp"], "pagerank": vec["pagerank"], "cascade": vec["cascade"],
                    "financial": vec["financial"], "hybrid": cw},
        "hybrid_coefficients": hybrid_coefficients(profile),
        "ahp_cr": vec["cr"], "dependency_matrix": dep, "scenarios": list(profile["dependency_matrices"].keys()),
    })


def draft_score(profile, year=None, component_shares=None, indicator_allocations=None, envelope_multiplier=1.0,
                weighting="hybrid", scenario=DEFAULT_SCENARIO, response="exponential", key=None):
    t0 = time.perf_counter()
    check_params(profile, weighting, scenario, response)
    yi = resolve_year(profile, year)
    base = year_inputs(profile, yi)
    F = float(base.f.sum())
    alloc = dict(zip(base.codes, base.f.tolist()))
    if component_shares:
        # given shares are fractions of the envelope; components not given keep their actual money; the
        # result is rescaled to the year's envelope
        comps = np.array(base.comps)
        codes_arr = np.array(base.codes)
        for cid in set(base.comps):
            if cid not in component_shares:
                continue
            m = comps == cid
            target = max(0.0, float(component_shares[cid])) * F
            cur = base.f[m]
            within = cur / cur.sum() if cur.sum() > 0 else np.full(m.sum(), 1.0 / m.sum())
            for code, v in zip(codes_arr[m], within * target):
                alloc[str(code)] = float(v)
        tot = sum(alloc.values())
        if tot <= 0:
            raise AssessmentError("component_shares must sum to a positive value")
        alloc = {k: v * F / tot for k, v in alloc.items()}
    if indicator_allocations:
        for k, v in indicator_allocations.items():
            if k in alloc:
                alloc[k] = max(0.0, float(v))
    mult = float(envelope_multiplier or 1.0)
    if mult <= 0:
        raise AssessmentError("envelope_multiplier must be positive")
    c = core(profile, yi, weighting, scenario, response, allocations=alloc, envelope_multiplier=mult)
    actual = record(profile, weighting, scenario, response, key)[yi]
    br = breaks_of(profile)
    labels = indicator_labels(c["x"].delta, c["stress"], br)
    comps = component_rows(profile, c, br)
    out = {
        "fsfsi": c["fsfsi"], "efficiency": c["E"], "fsfsi_opt": c["fsfsi_opt"],
        "stress_class": R.classify(c["fsfsi"], br["system"]),
        "components": [{"id": r["id"], "share": r["share"], "stress": r["stress"]} for r in comps],
        "diagnosis_summary": diagnosis_summary(labels, c["f"], c["stress"]),
        "delta_vs_actual": c["fsfsi"] - actual["fsfsi"], "envelope": c["F"], "compute_ms": 0.0,
    }
    out = finite(out)
    out["compute_ms"] = (time.perf_counter() - t0) * 1000.0
    return out


def calibrate(profile, weighting="hybrid", scenario=DEFAULT_SCENARIO, response="exponential", key=None):
    """Fisher-Jenks breaks on the country's record: 4 stress classes on indicator-years (point-in-time and
    accumulated pooled), 4 on component-years (pooled likewise; the system uses the component breaks) and 3
    coverage classes on indicator-years with a positive gap."""
    if len(profile.get("years", [])) < 3:
        raise AssessmentError("calibration needs a record of at least 3 years")
    rec = record(profile, weighting, scenario, response, key)
    ind, comp, cov = [], [], []
    for c in rec:
        x = c["x"]
        ind += list(c["stress"]) + list(c["acc"])
        xc = np.array(x.comps)
        for cid in set(x.comps):
            m = xc == cid
            comp += [float(c["stress"][m].mean()), float(c["acc"][m].mean())]
        pos = x.delta > R.GAP_EPS
        cov += list(1.0 - c["stress"][pos] / x.delta[pos])
    if len(ind) < 4 or len(comp) < 4 or len(cov) < 3:
        raise AssessmentError("not enough observations to calibrate")
    bi, gi = R.jenks(ind, 4)
    bc, gc = R.jenks(comp, 4)
    bv, gv = R.jenks(cov, 3)
    mins = R.PARAMS["classification_rules"]["minimum_observations"]
    n = {"indicator": len(ind), "component": len(comp), "coverage": len(cov)}
    warnings = [f"{k}: {n[k]} observations, below the recommended minimum of {mins[k]}" for k in n if n[k] < mins[k]]
    return finite({"breaks": {"indicator": bi, "component": bc, "system": bc, "coverage": bv},
                   "gvf": {"indicator": gi, "component": gc, "coverage": gv}, "n": n,
                   "published": breaks_of({"breaks": R.PARAMS["cut_points_published"]}), "warnings": warnings})


def summary(profile, key=None):
    rec = record(profile, "hybrid", DEFAULT_SCENARIO, "exponential", key)
    br = breaks_of(profile)
    last = rec[-1]
    return finite({
        "id": profile["id"], "name": profile["name"], "tagline": profile.get("tagline", ""), "kind": profile["kind"],
        "currency": profile.get("currency", ""), "years": [y["year"] for y in profile["years"]],
        "n_indicators": len(profile["indicators"]),
        "latest": {"year": last["x"].year, "fsfsi": last["fsfsi"], "fsfsi_acc": last["fsfsi_acc"],
                   "efficiency": last["E"], "stress_class": R.classify(last["fsfsi"], br["system"])},
        "series": [{"year": c["x"].year, "fsfsi": c["fsfsi"], "efficiency": c["E"]} for c in rec],
    })
