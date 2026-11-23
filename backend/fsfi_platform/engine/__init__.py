"""Engine selection: FSFI_ENGINE = auto | rust | reference.

* reference: every function from the reference implementation (closed-form KKT, numpy index).
* rust: index, optimum and efficiency from the compiled fsfi_engine (exponential response; the hyperbolic
  response, which the extension does not implement, always uses the reference).
* auto: the Rust extension when importable, function by function: a function is taken from Rust only if it
  agrees with the reference to 1e-9 on a seeded battery of realistic inputs, checked once at start-up.
  The Rust optimum stops its bisection at an absolute budget tolerance of 1e-6 and a relative multiplier
  tolerance of 1e-6, so its allocations differ from the reference by up to ~3e-7 of the envelope (the index at
  the optimum agrees to ~1e-14); auto therefore takes the optimum from the reference.

``meta.engine`` of an assessment is "rust" only when Rust computed both the index and the optimum.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from functools import lru_cache

import numpy as np

from . import kkt
from . import rust as _rust

TOL = 1e-9


@dataclass
class Engine:
    mode: str
    functions: dict = field(default_factory=dict)  # function -> "rust" | "reference"
    agreement: dict = field(default_factory=dict)

    @property
    def rust_available(self) -> bool:
        return _rust.AVAILABLE

    def _use(self, fn, response):
        return response == "exponential" and self.functions.get(fn) == "rust"

    def index(self, delta, f, alpha, w, response="exponential") -> float:
        if self._use("index", response):
            return _rust.index(delta, f, alpha, w)
        return kkt.index(delta, f, alpha, w, response)

    def optimum(self, delta, alpha, w, F, response="exponential"):
        if self._use("optimum", response) and F > 0:
            return _rust.optimum(delta, alpha, w, F)
        return kkt.optimum(delta, alpha, w, F, response)

    def efficiency(self, fs, fso, response="exponential") -> float:
        if self._use("efficiency", response):
            return _rust.efficiency(fs, fso)
        if fs <= 0:
            return 1.0
        return float(min(1.0, fso / fs))

    def label(self, response="exponential") -> str:
        return "rust" if (self._use("index", response) and self._use("optimum", response)) else "reference"

    def used(self, response="exponential") -> dict:
        return {k: ("rust" if self._use(k, response) else "reference") for k in ("index", "optimum", "efficiency")}

    @property
    def name(self) -> str:
        """Engine label for default (exponential) assessments."""
        return self.label("exponential")


def compare_rust_reference(n_cases=200, seed=20261122) -> dict:
    """Max absolute differences between Rust and reference on realistic inputs (31 indicators,
    alpha f of order 0.01-5, hybrid-like weights)."""
    if not _rust.AVAILABLE:
        return {}
    rng = np.random.default_rng(seed)
    d_idx = d_opt = d_optidx = d_eff = d_stress = 0.0
    for _ in range(n_cases):
        n = 31
        d = rng.beta(2, 2, n)
        d[rng.random(n) < 0.15] = 0.0
        F = float(rng.uniform(300, 3000))
        a = rng.uniform(0.2, 15, n) / F
        w = rng.dirichlet(np.ones(n) * 3)
        f = rng.dirichlet(np.ones(n) * 0.7) * F
        i_ref, i_rs = kkt.index(d, f, a, w), _rust.index(d, f, a, w)
        fo_ref, _ = kkt.optimum(d, a, w, F)
        fo_rs, _ = _rust.optimum(d, a, w, F)
        o_ref, o_rs = kkt.index(d, fo_ref, a, w), kkt.index(d, fo_rs, a, w)
        d_idx = max(d_idx, abs(i_ref - i_rs))
        d_opt = max(d_opt, float(np.max(np.abs(fo_ref - fo_rs))) / F)
        d_optidx = max(d_optidx, abs(o_ref - o_rs))
        d_eff = max(d_eff, abs(min(1.0, o_ref / i_ref) - _rust.efficiency(i_ref, o_ref)))
        d_stress = max(d_stress, abs(_rust.component_stress(d[0], f[0], a[0]) - d[0] * np.exp(-a[0] * f[0])))
    return {"n_cases": n_cases, "index_max_abs_diff": d_idx, "optimum_allocation_max_diff_share_of_envelope": d_opt,
            "optimum_index_max_abs_diff": d_optidx, "efficiency_max_abs_diff": d_eff,
            "component_stress_max_abs_diff": d_stress, "tolerance": TOL}


@lru_cache(maxsize=4)
def _build(mode: str) -> Engine:
    if mode == "reference" or not _rust.AVAILABLE:
        return Engine(mode=mode, functions={k: "reference" for k in ("index", "optimum", "efficiency")})
    agreement = compare_rust_reference()
    if mode == "rust":
        return Engine(mode=mode, functions={k: "rust" for k in ("index", "optimum", "efficiency")}, agreement=agreement)
    funcs = {
        "index": "rust" if agreement["index_max_abs_diff"] <= TOL else "reference",
        "optimum": "rust" if agreement["optimum_allocation_max_diff_share_of_envelope"] <= TOL else "reference",
        "efficiency": "rust" if agreement["efficiency_max_abs_diff"] <= TOL else "reference",
    }
    return Engine(mode="auto", functions=funcs, agreement=agreement)


def get_engine() -> Engine:
    mode = os.environ.get("FSFI_ENGINE", "auto").strip().lower()
    if mode not in ("auto", "rust", "reference"):
        mode = "auto"
    return _build(mode)
