"""Rust engine versus the reference implementation."""
import numpy as np
import pytest

from fsfi_platform import assessment as A
from fsfi_platform import engine as ENG
from fsfi_platform.engine import kkt
from fsfi_platform.engine import rust

pytestmark = pytest.mark.skipif(not rust.AVAILABLE, reason="fsfi_engine not installed")


def _cases(n_cases=200, seed=99):
    rng = np.random.default_rng(seed)
    for _ in range(n_cases):
        n = 31
        d = rng.beta(2, 2, n)
        d[rng.random(n) < 0.15] = 0.0
        F = float(rng.uniform(300, 3000))
        a = rng.uniform(0.2, 15, n) / F
        w = rng.dirichlet(np.ones(n) * 3)
        f = rng.dirichlet(np.ones(n) * 0.7) * F
        yield d, a, w, f, F


def test_rust_index_equals_reference():
    for d, a, w, f, F in _cases():
        assert abs(rust.index(d, f, a, w) - kkt.index(d, f, a, w)) <= 1e-9


def test_rust_component_stress_and_efficiency():
    for d, a, w, f, F in _cases(50):
        for i in range(5):
            assert abs(rust.component_stress(d[i], f[i], a[i]) - d[i] * np.exp(-a[i] * f[i])) <= 1e-12
        fs = kkt.index(d, f, a, w)
        fo = kkt.index(d, kkt.optimum(d, a, w, F)[0], a, w)
        assert abs(rust.efficiency(fs, fo) - min(1.0, fo / fs)) <= 1e-12


def test_rust_optimum_close_to_reference():
    """The index at the Rust optimum agrees to 1e-9; its allocations agree only to ~1e-6 of the envelope
    (absolute 1e-6 stopping tolerance in its bisection), which is why `auto` takes the reference optimum."""
    worst_alloc = worst_idx = 0.0
    for d, a, w, f, F in _cases():
        fr, lam_r = rust.optimum(d, a, w, F)
        f0, lam0 = kkt.optimum(d, a, w, F)
        worst_alloc = max(worst_alloc, float(np.max(np.abs(fr - f0))) / F)
        worst_idx = max(worst_idx, abs(kkt.index(d, fr, a, w) - kkt.index(d, f0, a, w)))
        assert fr.sum() == pytest.approx(F, rel=1e-9)
    assert worst_idx <= 1e-9
    assert worst_alloc < 1e-5


def test_auto_engine_choice_is_honest():
    e = ENG._build("auto")
    ag = e.agreement
    assert e.functions["index"] == ("rust" if ag["index_max_abs_diff"] <= 1e-9 else "reference")
    assert e.functions["optimum"] == ("rust" if ag["optimum_allocation_max_diff_share_of_envelope"] <= 1e-9 else "reference")
    assert e.label() == ("rust" if e.functions["index"] == e.functions["optimum"] == "rust" else "reference")
    assert e.label("hyperbolic") == "reference"


def test_assessment_same_under_rust_and_reference(profiles):
    p = profiles["aurelia"]
    er, e0 = ENG._build("rust"), ENG._build("reference")
    for yi in range(len(p["years"])):
        cr = A.core(p, yi, "hybrid", "normal_operations", "exponential", engine=er)
        c0 = A.core(p, yi, "hybrid", "normal_operations", "exponential", engine=e0)
        assert cr["engine"] == "rust" and c0["engine"] == "reference"
        assert abs(cr["fsfsi"] - c0["fsfsi"]) <= 1e-9
        assert abs(cr["fsfsi_opt"] - c0["fsfsi_opt"]) <= 1e-9
        assert abs(cr["E"] - c0["E"]) <= 1e-9
