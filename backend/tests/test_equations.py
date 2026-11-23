"""Every equation of the Methods against the published reference implementation."""
import math

import numpy as np
import pytest

from fsfi_platform import assessment as A
from fsfi_platform.engine import kkt
from fsfi_platform.engine import reference as R

SCENARIOS = list(R.PARAMS["dependency_matrices"])
METHODS = ["hybrid", "equal", "expert", "network", "financial"]


def _random_case(rng, n=31, F=None):
    d = rng.beta(2, 2, n)
    d[rng.random(n) < 0.15] = 0.0
    F = F or float(rng.uniform(300, 3000))
    a = rng.uniform(0.2, 15, n) / F
    w = rng.dirichlet(np.ones(n) * 3)
    f = rng.dirichlet(np.ones(n) * 0.7) * F
    return d, a, w, f, F


# --- gap, imputation, stress, coverage ------------------------------------------------------------

@pytest.mark.parametrize("x,b,hib", [(2.0, 4.0, True), (5.0, 4.0, True), (0.0, 4.0, True), (6.0, 4.0, False),
                                     (3.0, 4.0, False), (0.0, 0.0, None), (80.0, 100.0, None), (0.0, 5.0, False)])
def test_gap_matches_reference(orig, x, b, hib):
    assert R.gap(x, b, hib) == orig.gap(x, b, hib)


def test_gap_formulas():
    assert R.gap(3.0, 4.0, True) == pytest.approx(0.25)
    assert R.gap(6.0, 4.0, False) == pytest.approx(2.0 / 6.0)
    assert R.gap(5.0, 4.0, True) == 0.0 and R.gap(3.0, 4.0, False) == 0.0


def test_imputation_placeholder(profiles):
    """Observed null -> 0.5 x benchmark (higher) or 1.5 x benchmark (lower): gaps 1/2 and 1/3."""
    p = profiles["aurelia"]
    x = A.year_inputs(p, 5)
    for code, d, imp, direction in zip(x.codes, x.delta, x.imputed, x.directions):
        if imp:
            assert d == pytest.approx(0.5 if direction == "higher" else 1.0 / 3.0)
    assert x.imputed.sum() >= 5


def test_stress_coverage(orig):
    rng = np.random.default_rng(1)
    d, a, w, f, F = _random_case(rng)
    assert np.allclose(R.stress(d, f, a), orig.stress(d, f, a), atol=1e-15)
    assert np.allclose(R.coverage(f, a), orig.coverage(f, a), atol=1e-15)
    assert np.allclose(kkt.stress(d, f, a), d * np.exp(-a * f))
    assert np.allclose(kkt.stress(d, f, a, "hyperbolic"), d / (1 + a * f))
    assert np.allclose(kkt.coverage(f, a, "hyperbolic"), a * f / (1 + a * f))
    # coverage = 1 - stress / gap where the gap is positive
    pos = d > 0
    assert np.allclose(kkt.coverage(f, a)[pos], 1 - kkt.stress(d, f, a)[pos] / d[pos])


# --- weights ----------------------------------------------------------------------------------------

@pytest.mark.parametrize("scenario", SCENARIOS)
def test_weight_vectors(orig, scenario):
    a1, a0 = R.ahp(scenario=scenario), orig.ahp(scenario=scenario)
    assert np.allclose(a1["weights"], a0["weights"], atol=1e-15) and a1["cr"] == pytest.approx(a0["cr"])
    assert np.allclose(R.pagerank(scenario=scenario), orig.pagerank(scenario=scenario), atol=1e-15)
    assert np.allclose(R.cascade(scenario=scenario), orig.cascade(scenario=scenario), atol=1e-15)


def test_ahp_cr_published():
    assert R.ahp(scenario="normal_operations")["cr"] < 0.1


@pytest.mark.parametrize("method", METHODS)
@pytest.mark.parametrize("scenario", SCENARIOS)
def test_indicator_weights_platform_vs_reference(orig, profiles, method, scenario):
    p = profiles["aurelia"]
    x = A.year_inputs(p, 5)
    w, _ = A.indicator_weights(p, x.comps, x.f, method, scenario)
    w0 = orig.indicator_weights(x.comps, x.f, method, scenario)
    assert np.allclose(w, w0, atol=1e-12)
    assert w.sum() == pytest.approx(1.0)


def test_hybrid_blend():
    h = R.PARAMS["hybrid_coefficients"]
    assert (h["ahp"], h["pagerank"], h["cascade"], h["financial"]) == (0.35, 0.30, 0.25, 0.10)


# --- index, optimum, efficiency -------------------------------------------------------------------

@pytest.mark.parametrize("cid", ["aurelia", "borealis", "cordova", "deltana"])
@pytest.mark.parametrize("method", METHODS)
def test_assessment_matches_reference_assess(orig, profiles, cid, method):
    p = profiles[cid]
    for yi in range(len(p["years"])):
        x = A.year_inputs(p, yi)
        ref = orig.assess(x.delta, x.f, x.alpha, x.comps, method, "normal_operations")
        c = A.core(p, yi, method, "normal_operations", "exponential")
        assert c["fsfsi"] == pytest.approx(ref["fsfsi"], abs=1e-12)
        assert c["fsfsi_opt"] == pytest.approx(ref["fsfsi_opt"], abs=1e-12)
        assert c["E"] == pytest.approx(ref["efficiency"], abs=1e-12)
        # the Rust optimum (FSFI_ENGINE=rust) stops its bisection at an absolute 1e-6 budget tolerance
        tol = 1e-5 if c["engine_functions"]["optimum"] == "rust" else 1e-9
        assert np.max(np.abs(c["fopt"] - ref["f_opt"])) / c["F"] < tol


def test_closed_form_optimum_equals_reference_bisection(orig):
    rng = np.random.default_rng(7)
    for _ in range(300):
        d, a, w, f, F = _random_case(rng)
        f1, lam = kkt.optimum(d, a, w, F)
        f0 = orig.optimum(d, a, w, F)
        assert np.max(np.abs(f1 - f0)) / F < 1e-9
        assert f1.sum() == pytest.approx(F, rel=1e-12)


def test_closed_form_hyperbolic_equals_bracketed_root():
    rng = np.random.default_rng(8)
    for _ in range(200):
        d, a, w, f, F = _random_case(rng)
        f1, _ = kkt.optimum(d, a, w, F, "hyperbolic")
        f0 = R.optimum_hyperbolic(d, a, w, F)
        assert np.max(np.abs(f1 - f0)) / F < 1e-9


@pytest.mark.parametrize("response", ["exponential", "hyperbolic"])
def test_kkt_property(response):
    """Equal weighted marginal returns (= lambda) on funded indicators; <= lambda on unfunded ones."""
    rng = np.random.default_rng(11)
    for _ in range(100):
        d, a, w, f, F = _random_case(rng)
        fo, lam = kkt.optimum(d, a, w, F, response)
        r = kkt.marginal_return(d, fo, a, w, response)
        funded = fo > 1e-9 * F
        assert np.allclose(r[funded], lam, rtol=1e-9)
        assert np.all(r[~funded] <= lam * (1 + 1e-9))
        # optimum beats random feasible allocations
        assert kkt.index(d, fo, a, w, response) <= kkt.index(d, f, a, w, response) + 1e-15


def test_efficiency_bounds(profiles):
    for p in profiles.values():
        for yi in range(len(p["years"])):
            for resp in ("exponential", "hyperbolic"):
                c = A.core(p, yi, "hybrid", "normal_operations", resp)
                assert 0 < c["E"] <= 1
    assert R.efficiency(0.0, 0.0) == 1.0


def test_scale_property():
    """Scaling every alpha by k is the same as scaling the envelope by k."""
    rng = np.random.default_rng(3)
    for k in (0.3, 2.0, 5.0):
        d, a, w, f, F = _random_case(rng)
        for resp in ("exponential", "hyperbolic"):
            s1 = kkt.index(d, f, a * k, w, resp)
            s2 = kkt.index(d, f * k, a, w, resp)
            assert s1 == pytest.approx(s2, rel=1e-12)
            o1 = kkt.index(d, kkt.optimum(d, a * k, w, F, resp)[0], a * k, w, resp)
            o2 = kkt.index(d, kkt.optimum(d, a, w, F * k, resp)[0], a, w, resp)
            assert o1 == pytest.approx(o2, rel=1e-9)


@pytest.mark.parametrize("response", ["exponential", "hyperbolic"])
def test_elasticity_analytic_vs_numeric(response):
    rng = np.random.default_rng(5)
    for _ in range(60):
        d, a, w, f, F = _random_case(rng)
        an = A.elasticity(d, f, a, w, response)
        nu = A.elasticity_numeric(d, f, a, w, response)
        assert an == pytest.approx(nu, abs=2e-6)


def test_elasticity_matches_assessment(profiles):
    a = A.assessment(profiles["aurelia"])
    p = profiles["aurelia"]
    x = A.year_inputs(p, 5)
    c = A.core(p, 5, "hybrid", "normal_operations", "exponential")
    assert a["system"]["elasticity"] == pytest.approx(A.elasticity_numeric(x.delta, c["f"], x.alpha, c["w"], "exponential"), abs=2e-6)


def test_composition_only_efficiency_matches_reference(orig, profiles):
    p = profiles["aurelia"]
    x = A.year_inputs(p, 5)
    x0 = A.year_inputs(p, 0)
    ref = orig.composition_only_efficiency(x.delta, x.f, x.alpha, x.comps, float(x0.f.sum()))
    a = A.assessment(p)
    assert a["system"]["efficiency_fixed_t0"] == pytest.approx(ref, abs=1e-12)


def test_envelope_multiple_and_front_loaded(profiles):
    p = profiles["aurelia"]
    a = A.assessment(p)
    x = A.year_inputs(p, 5)
    c = A.core(p, 5, "hybrid", "normal_operations", "exponential")
    m = a["system"]["envelope_multiple"]
    assert kkt.index(x.delta, c["f"] * m, x.alpha, c["w"]) == pytest.approx(a["system"]["fsfsi_opt"], abs=1e-12)
    fl = a["front_loaded"]
    caps = [pt["captured"] for pt in fl]
    assert caps[0] == 0.0 and caps[-1] == pytest.approx(1.0) and all(b >= a_ - 1e-12 for a_, b in zip(caps, caps[1:]))
    assert a["system"]["front_loaded_10pct"] == next(pt["captured"] for pt in fl if pt["moved"] == 0.1)


def test_financing_response(profiles):
    p = profiles["aurelia"]
    a = A.assessment(p)
    x = A.year_inputs(p, 5)
    c = A.core(p, 5, "hybrid", "normal_operations", "exponential")
    wd = np.sum(c["w"] * x.delta)
    expect = np.sum(c["w"] * x.delta * (1 - np.exp(-x.alpha * c["f"]))) / wd
    assert a["system"]["financing_response"] == pytest.approx(expect, abs=1e-12)


def test_held_optimum(profiles):
    a = A.assessment(profiles["aurelia"])
    s = a["system"]
    assert s["fsfsi_opt"] <= s["fsfsi_opt_held"] + 1e-12 <= s["fsfsi"] + 1e-12
    held = [i for i in a["indicators"] if i["diagnosis"] == "at_benchmark"]
    assert held
    assert sum(c["held_optimal_share"] for c in a["components"]) == pytest.approx(1.0)


# --- accumulated stress -------------------------------------------------------------------------------

def test_accumulated_matches_reference(orig, profiles):
    p = profiles["cordova"]
    rec = A.record(p)
    codes = sorted(set.intersection(*[set(c["x"].codes) for c in rec]))
    # reference on the full panel of indicators assessed every year
    stress_T, fs_T = [], []
    for c in rec:
        idx = [c["x"].codes.index(k) for k in codes]
        stress_T.append(c["stress"][idx])
        fs_T.append(c["fsfsi"])
    comps = [dict(zip(rec[0]["x"].codes, rec[0]["x"].comps))[k] for k in codes]
    CS, cum = orig.accumulated_path(np.array(stress_T), codes, comps, np.array(fs_T))
    CS2, cum2 = R.accumulated_path(np.array(stress_T), codes, comps, np.array(fs_T))
    assert np.allclose(CS, CS2) and np.allclose(cum, cum2)
    # the platform's record follows the same recursion indicator by indicator
    for t, c in enumerate(rec):
        acc = dict(zip(c["x"].codes, c["acc"]))
        if t == 0:
            assert c["fsfsi_acc"] == pytest.approx(c["fsfsi"])
        for j, k in enumerate(codes):
            if all(k in r["x"].codes for r in rec[: t + 1]):
                assert acc[k] == pytest.approx(CS[t, j], abs=1e-12)


def test_accumulated_system_ratio_form(profiles):
    rec = A.record(profiles["aurelia"])
    for c in rec[1:]:
        assert c["fsfsi_acc"] == pytest.approx(c["fsfsi"] * c["acc"].sum() / c["stress"].sum(), rel=1e-12)


# --- classification, diagnosis, Jenks ------------------------------------------------------------------

def test_jenks_matches_reference(orig):
    rng = np.random.default_rng(2)
    v = rng.beta(1.2, 2.0, 200)
    assert R.jenks(v, 4) == orig.jenks(v, 4)
    assert R.jenks(v, 3) == orig.jenks(v, 3)


def test_diagnosis_and_classes(orig):
    br = R.PARAMS["cut_points_published"]
    for g, s in [(0.1, 0.1), (0.6, 0.58), (0.6, 0.4), (0.6, 0.1), (0.0, 0.0)]:
        assert R.diagnose(g, s, br["indicator"], br["coverage"]) == orig.diagnose(g, s, br["indicator"], br["coverage"])
    assert R.classify(0.1, br["system"]) == "low" and R.classify(0.6, br["system"]) == "critical"


def test_diagnosis_summary_consistent(profiles):
    for p in profiles.values():
        a = A.assessment(p)
        ds = a["diagnosis_summary"]
        assert [d["diagnosis"] for d in ds] == list(A.DIAGNOSES)
        assert sum(d["count"] for d in ds) == len(a["indicators"])
        assert sum(d["envelope_share"] for d in ds) == pytest.approx(1.0)
        assert sum(d["stress_share"] for d in ds) == pytest.approx(1.0)


def test_calibrate(profiles):
    res = A.calibrate(profiles["aurelia"])
    assert len(res["breaks"]["indicator"]) == 3 and len(res["breaks"]["coverage"]) == 2
    assert 0 < res["gvf"]["indicator"] <= 1
    assert res["breaks"]["indicator"] == sorted(res["breaks"]["indicator"])


def test_index_decomposes_by_component(profiles):
    a = A.assessment(profiles["deltana"])
    tot = sum(c["weight"] * c["stress"] for c in a["components"])
    assert tot == pytest.approx(a["system"]["fsfsi"], abs=1e-12)
    assert math.isclose(sum(i["weight"] for i in a["indicators"]), 1.0, abs_tol=1e-12)
