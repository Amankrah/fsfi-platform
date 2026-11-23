"""Adapter over the compiled fsfi_engine extension (exponential response only)."""
from __future__ import annotations

import numpy as np

try:  # pragma: no cover - depends on the installed wheel
    import fsfi_engine as _fe

    AVAILABLE = all(hasattr(_fe, n) for n in ("py_system_fsfsi", "py_optimal_allocation", "py_efficiency_index"))
    VERSION = getattr(_fe, "__version__", "0.1.0")
except Exception:  # pragma: no cover
    _fe = None
    AVAILABLE = False
    VERSION = None


def _l(x):
    return [float(v) for v in np.asarray(x, float)]


def index(delta, f, alpha, w) -> float:
    return float(_fe.py_system_fsfsi(_l(delta), _l(f), _l(alpha), _l(w)))


def optimum(delta, alpha, w, F):
    """Return (f*, lambda); lambda is read off the funded indicators (w alpha upsilon(f*) is equal on them)."""
    d, a, ww = np.asarray(delta, float), np.asarray(alpha, float), np.asarray(w, float)
    f = np.asarray(_fe.py_optimal_allocation(_l(d), _l(a), _l(ww), float(F)), float)
    r = ww * a * np.clip(d, 0, 1) * np.exp(-a * f)
    funded = f > 0
    lam = float(np.median(r[funded])) if funded.any() else 0.0
    return f, lam


def efficiency(fs, fso) -> float:
    return float(_fe.py_efficiency_index(float(fs), float(fso)))


def component_stress(gap, allocation, sensitivity) -> float:
    return float(_fe.py_component_stress(float(gap), float(allocation), float(sensitivity)))
