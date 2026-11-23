"""Reference implementation of the FSFSI equations (port of fsfsi_reference/model.py and classification.py).

Every function implements one published equation. Method parameters (expert pairwise matrices, dependency
matrices, blend coefficients, persistence rates, cut-points) are read from data/method_parameters.json.
The port adds optional matrix / component-list arguments so that a country profile can carry its own
parameters, and the hyperbolic response of the simulation study. With default arguments every function
returns exactly what the published reference returns.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np

PARAMS = json.loads((Path(__file__).resolve().parent / "data" / "method_parameters.json").read_text(encoding="utf-8"))
COMPONENTS = tuple(PARAMS["component_order"])
RESPONSES = ("exponential", "hyperbolic")


# ---------------------------------------------------------------------------
# Gap, stress, coverage (Eqs. gap, stress)
# ---------------------------------------------------------------------------

def gap(observed, benchmark, higher_is_better=None) -> float:
    """Directional bounded performance gap; symmetric form where no direction is set."""
    x, b = float(observed), float(benchmark)
    if abs(x) < 1e-6 and abs(b) < 1e-6:
        return 0.0
    if x < 0 or b < 0:
        raise ValueError("observed and benchmark must be non-negative")
    if higher_is_better is True:
        g = 0.0 if x >= b else (b - x) / b
    elif higher_is_better is False:
        g = 0.0 if (x <= b or x < 1e-6) else (x - b) / x
    else:
        m = max(x, b)
        g = 0.0 if m < 1e-6 else abs(x - b) / m
    return float(min(1.0, max(0.0, g)))


def stress(delta, f, alpha, response="exponential"):
    """upsilon = delta * exp(-alpha f)  (hyperbolic: delta / (1 + alpha f))."""
    d, x = np.asarray(delta, float), np.asarray(alpha, float) * np.asarray(f, float)
    if response == "hyperbolic":
        return d / (1.0 + x)
    return d * np.exp(-x)


def coverage(f, alpha, response="exponential"):
    """c = 1 - exp(-alpha f) (hyperbolic: alpha f / (1 + alpha f)), the share of the gap absorbed by financing."""
    x = np.asarray(alpha, float) * np.asarray(f, float)
    if response == "hyperbolic":
        return x / (1.0 + x)
    return 1.0 - np.exp(-x)


def coverage_from(gap_, stress_, eps=1e-6):
    """c = 1 - upsilon / delta (None where there is no gap)."""
    g = float(gap_)
    if g <= eps:
        return None
    return min(1.0, max(0.0, 1.0 - float(stress_) / g))


# ---------------------------------------------------------------------------
# Weights (Eqs. hybrid, pagerank)
# ---------------------------------------------------------------------------

def _normalise(v):
    v = np.asarray(v, float)
    s = v.sum()
    return np.full(len(v), 1.0 / len(v)) if s <= 0 else v / s


def ahp(matrix=None, scenario="normal_operations"):
    """Principal eigenvector of a pairwise-comparison matrix by the power method, with lambda_max,
    consistency index and consistency ratio CR = CI / RI."""
    A = np.asarray(matrix if matrix is not None else PARAMS["ahp_matrices"][scenario], float)
    n = len(A)
    pm = PARAMS["ahp_power_method"]
    v = np.full(n, 1.0 / n)
    lam = 0.0
    for _ in range(pm["max_iterations"]):
        nv = A @ v
        ok = np.abs(v) > 1e-15
        lam = float(np.mean(nv[ok] / v[ok])) if ok.any() else 0.0
        nv = nv / np.abs(nv).sum()
        diff = np.abs(v - nv).sum()
        v = nv
        if diff < pm["tolerance"]:
            break
    ci = (lam - n) / (n - 1) if n > 1 else 0.0
    ri = PARAMS["random_index"][n] if n < len(PARAMS["random_index"]) else 1.59
    cr = ci / ri if ri > 0 else 0.0
    return dict(weights=_normalise(v), lambda_max=lam, ci=ci, cr=cr, consistent=cr < pm["consistency_threshold"])


def pagerank(matrix=None, scenario="normal_operations"):
    """PageRank as published: T_cc' = M_cc' / sum_k M_kc', w <- (1-d)/N + d T w, renormalised each step."""
    M = np.asarray(matrix if matrix is not None else PARAMS["dependency_matrices"][scenario], float)
    n = len(M)
    p = PARAMS["pagerank"]
    col = M.sum(0)
    T = np.where(col > 0, M / np.where(col > 0, col, 1), 1.0 / n)
    w = np.full(n, 1.0 / n)
    for _ in range(p["max_iterations"]):
        nw = (1 - p["damping"]) / n + p["damping"] * (T @ w)
        s = nw.sum()
        if s > 0:
            nw = nw / s
        diff = np.abs(w - nw).sum()
        w = nw
        if diff < p["tolerance"]:
            break
    return _normalise(w)


def cascade(matrix=None, scenario="normal_operations"):
    """Direct dependencies plus half of the second-order dependencies reached through them, normalised."""
    M = np.asarray(matrix if matrix is not None else PARAMS["dependency_matrices"][scenario], float)
    n = len(M)
    d2 = PARAMS["cascade_second_order_damping"]
    imp = np.zeros(n)
    for i in range(n):
        prim = sum(M[i, j] for j in range(n) if j != i)
        sec = sum(M[i, j] * sum(M[j, k] for k in range(n) if k != i and k != j) * d2 for j in range(n) if j != i)
        imp[i] = prim + sec
    if imp.max() > 0:
        imp = imp / imp.max()
    return _normalise(imp)


def financial(component_alloc: dict, components=COMPONENTS) -> np.ndarray:
    """Each component's share of the envelope (equal shares if the envelope is zero)."""
    a = np.array([float(component_alloc.get(k, 0.0)) for k in components])
    return a / a.sum() if a.sum() > 0 else np.full(len(a), 1.0 / len(a))


def hybrid_from_vectors(wa, wp, wc, wf, coefficients=None) -> np.ndarray:
    h = coefficients or PARAMS["hybrid_coefficients"]
    return _normalise(h["ahp"] * np.asarray(wa) + h["pagerank"] * np.asarray(wp)
                      + h["cascade"] * np.asarray(wc) + h["financial"] * np.asarray(wf))


def hybrid(component_alloc: dict, scenario="normal_operations") -> dict:
    """omega proportional to 0.35 AHP + 0.30 PageRank + 0.25 cascade + 0.10 budget share."""
    wa = ahp(scenario=scenario)["weights"]
    w = hybrid_from_vectors(wa, pagerank(scenario=scenario), cascade(scenario=scenario), financial(component_alloc))
    return dict(zip(COMPONENTS, w))


def component_weights(component_alloc: dict, method="hybrid", scenario="normal_operations") -> dict | None:
    if method == "equal":
        return None
    if method == "expert":
        return dict(zip(COMPONENTS, ahp(scenario=scenario)["weights"]))
    if method == "network":
        return dict(zip(COMPONENTS, pagerank(scenario=scenario)))
    if method == "financial":
        return dict(zip(COMPONENTS, financial(component_alloc)))
    return hybrid(component_alloc, scenario)


def indicator_weights(components, alloc, method="hybrid", scenario="normal_operations") -> np.ndarray:
    """omega_i = omega_c(i) / n_c(i), renormalised; equal weighting gives 1/N."""
    components = list(components)
    n = len(components)
    ca, nc = {}, {}
    for k, f in zip(components, alloc):
        ca[k] = ca.get(k, 0.0) + float(f)
        nc[k] = nc.get(k, 0) + 1
    cw = component_weights(ca, method, scenario)
    if cw is None:
        return np.full(n, 1.0 / n)
    w = np.array([cw.get(k, 1.0 / 8.0) / nc[k] for k in components])
    return w / w.sum() if w.sum() > 0 else np.full(n, 1.0 / n)


# ---------------------------------------------------------------------------
# System index, optimum, efficiency (Eqs. index, opt, kkt, efficiency)
# ---------------------------------------------------------------------------

def system_index(delta, f, alpha, w, response="exponential") -> float:
    return float(np.sum(np.asarray(w, float) * stress(delta, f, alpha, response)))


def optimum(delta, alpha, w, F, tol=1e-14, max_iter=400) -> np.ndarray:
    """Closed-form KKT optimum f_i = max{0, ln(w_i delta_i alpha_i / lambda) / alpha_i}, lambda by bisection
    (on log lambda) on the budget constraint; indicators with w delta alpha = 0 receive nothing."""
    d = np.clip(np.asarray(delta, float), 0, 1)
    a = np.asarray(alpha, float)
    p = np.asarray(w, float) * d * a
    act = p > 0
    out = np.zeros(len(d))
    if not act.any() or F <= 0:
        return np.full(len(d), F / len(d)) if F > 0 else out
    pa, aa = p[act], a[act]
    lo, hi = np.log(np.min(pa * np.exp(-aa * F))), np.log(np.max(pa))

    def total(ll):
        return np.maximum(np.log(pa / np.exp(ll)) / aa, 0).sum()
    for _ in range(max_iter):
        mid = (lo + hi) / 2
        if total(mid) > F:
            lo = mid
        else:
            hi = mid
        if hi - lo < tol:
            break
    fa = np.maximum(np.log(pa / np.exp((lo + hi) / 2)) / aa, 0)
    fa *= F / fa.sum()
    out[act] = fa
    return out


def optimum_hyperbolic(delta, alpha, w, F) -> np.ndarray:
    """KKT optimum under upsilon = delta / (1 + alpha f): f_i = max{0, (sqrt(w_i delta_i alpha_i / lambda) - 1) / alpha_i}
    (port of the simulation study's truth.optimum with form='hyp' and no offsets; bracketed root in log lambda)."""
    from scipy.optimize import brentq

    d = np.clip(np.asarray(delta, float), 0.0, 1.0)
    a = np.asarray(alpha, float)
    p = np.asarray(w, float) * d * a
    n = len(d)
    act = p > 0
    out = np.zeros(n)
    if not np.any(act) or F <= 0:
        return np.full(n, F / n) if F > 0 else out
    pa, aa = p[act], a[act]
    hi = np.max(pa)
    lo = np.min(pa / (1 + aa * F) ** 2)

    def g(loglam):
        return np.maximum((np.sqrt(pa / np.exp(loglam)) - 1.0) / aa, 0.0).sum() - F

    ll = brentq(g, np.log(lo) - 1e-9, np.log(hi) + 1e-9, xtol=1e-14, rtol=1e-14, maxiter=500)
    fa = np.maximum((np.sqrt(pa / np.exp(ll)) - 1.0) / aa, 0.0)
    s = fa.sum()
    if s > 0:
        fa *= F / s
    out[act] = fa
    return out


def efficiency(fsfsi, fsfsi_opt) -> float:
    """E = min(1, FSFSI* / FSFSI)."""
    if fsfsi <= 0:
        return 1.0
    return float(min(1.0, fsfsi_opt / fsfsi))


def composition_only_efficiency(delta, shares, alpha, components, F_ref, method="hybrid", scenario="normal_operations"):
    """E with the year's shares and gaps and the allocations rescaled to a reference envelope (scale property)."""
    f = np.asarray(shares, float) / np.sum(shares) * F_ref
    w = indicator_weights(components, f, method, scenario)
    fs = system_index(delta, f, alpha, w)
    return efficiency(fs, system_index(delta, optimum(delta, alpha, w, F_ref), alpha, w))


def assess(gaps, alloc, alpha, components, method="hybrid", scenario="normal_operations") -> dict:
    """One assessment: weights, stresses, index, optimum and E."""
    d = np.asarray(gaps, float)
    f = np.asarray(alloc, float)
    a = np.asarray(alpha, float)
    w = indicator_weights(components, f, method, scenario)
    s = stress(d, f, a)
    fs = float(np.sum(w * s))
    fopt = optimum(d, a, w, float(f.sum()))
    fso = system_index(d, fopt, a, w)
    return dict(weights=w, stress=s, fsfsi=fs, f_opt=fopt, fsfsi_opt=fso, efficiency=efficiency(fs, fso))


# ---------------------------------------------------------------------------
# Accumulated stress (Eqs. ema, cumulative)
# ---------------------------------------------------------------------------

def persistence(component):
    return tuple(PARAMS["persistence"].get(component, PARAMS["persistence_fallback"]))


def accumulated_step(prev_cs: dict | None, stress_now: dict, components: dict, fsfsi_now: float, rates=None):
    """One year: CS_i(t) = CS_i(t-1) + rho [upsilon_i(t) - CS_i(t-1)], rho up if worsening else down;
    CS_i = upsilon_i in the first year an indicator is assessed. Returns (CS dict, CumFSFSI)."""
    cs = {}
    for code, v in stress_now.items():
        v = float(v)
        if prev_cs is None:
            new = v
        else:
            p = prev_cs.get(code, v)
            ru, rd = (rates or {}).get(components[code], persistence(components[code]))
            new = p + (ru if v > p else rd) * (v - p)
        cs[code] = new
    if prev_cs is None:
        return cs, float(fsfsi_now)
    su = sum(float(v) for v in stress_now.values())
    return cs, float(fsfsi_now) * sum(cs.values()) / su if su > 0 else float(fsfsi_now)


def accumulated_path(stress_T, codes, components, fsfsi_T, rates=None):
    """Accumulated stress over a record (T x n) and the system cumulative index."""
    cmap = dict(zip(codes, components))
    prev = None
    CS = np.zeros_like(np.asarray(stress_T, float))
    cum = np.zeros(len(fsfsi_T))
    for t in range(len(fsfsi_T)):
        prev, cum[t] = accumulated_step(prev, dict(zip(codes, stress_T[t])), cmap, fsfsi_T[t], rates)
        CS[t] = [prev[c] for c in codes]
    return CS, cum


# ---------------------------------------------------------------------------
# Classification and diagnosis (Eq. diagnosis)
# ---------------------------------------------------------------------------

def jenks(values, k):
    """Fisher-Jenks natural breaks by exact dynamic programming. Returns (upper bounds of the first k-1
    classes, goodness-of-variance fit)."""
    x = np.sort(np.asarray(values, float))
    n = len(x)
    if n < k:
        raise ValueError("need at least k observations")
    S = np.concatenate([[0.0], np.cumsum(x)])
    Q = np.concatenate([[0.0], np.cumsum(x * x)])
    dp = np.full((k + 1, n + 1), np.inf)
    cut = np.zeros((k + 1, n + 1), dtype=int)
    dp[0, 0] = 0.0
    for c in range(1, k + 1):
        for j in range(c, n + 1):
            i = np.arange(c - 1, j)
            m = j - i
            s = S[j] - S[i]
            v = dp[c - 1, i] + (Q[j] - Q[i]) - s * s / m
            b = int(np.argmin(v))
            dp[c, j] = v[b]
            cut[c, j] = i[b]
    breaks = []
    j = n
    for c in range(k, 1, -1):
        i = cut[c, j]
        breaks.append(float(x[i - 1]))
        j = i
    tot = Q[n] - S[n] ** 2 / n
    return breaks[::-1], float(1 - dp[k, n] / tot) if tot > 0 else 1.0


LABELS = tuple(PARAMS["classification_rules"]["labels"])
DIAGNOSES = tuple(PARAMS["classification_rules"]["diagnoses"])
GAP_EPS = PARAMS["classification_rules"]["gap_epsilon"]


def classify(score, breaks, labels=LABELS):
    s = float(score)
    for i, b in enumerate(breaks):
        if s <= b:
            return labels[i]
    return labels[len(breaks)]


def diagnose(gap_, stress_, indicator_breaks, coverage_breaks, eps=GAP_EPS):
    """At benchmark if delta <= b1(indicator); else unfunded, partially funded or funded gap by coverage."""
    g = float(gap_)
    if g <= indicator_breaks[0]:
        return "at_benchmark"
    c = coverage_from(g, stress_, eps)
    if c is None:
        return "at_benchmark"
    if c <= coverage_breaks[0]:
        return "unfunded_gap"
    if c <= coverage_breaks[1]:
        return "partially_funded_gap"
    return "funded_gap"
