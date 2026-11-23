"""Exact water-filling solution of the KKT conditions (Eq. kkt) for both response forms.

The reference finds the multiplier by bisection; here the active set is found by sorting the zero-spending
marginal returns p_i = w_i delta_i alpha_i, which gives the same optimum in closed form (tested against the
reference to 1e-9) in a few microseconds, so scale curves and draft scoring stay fast.
"""
from __future__ import annotations

import numpy as np


def stress(delta, f, alpha, response="exponential"):
    x = alpha * f
    if response == "hyperbolic":
        return delta / (1.0 + x)
    return delta * np.exp(-x)


def coverage(f, alpha, response="exponential"):
    x = alpha * f
    if response == "hyperbolic":
        return x / (1.0 + x)
    return 1.0 - np.exp(-x)


def marginal_return(delta, f, alpha, w, response="exponential"):
    """r_i = -w_i d upsilon_i / d f_i (w alpha upsilon for the exponential form)."""
    x = alpha * f
    if response == "hyperbolic":
        return w * alpha * delta / (1.0 + x) ** 2
    return w * alpha * delta * np.exp(-x)


def index(delta, f, alpha, w, response="exponential") -> float:
    return float(np.sum(w * stress(delta, f, alpha, response)))


def optimum(delta, alpha, w, F, response="exponential"):
    """Return (f*, lambda). Indicators with w delta alpha = 0 receive nothing; with no such indicator the
    envelope is split equally (as in the reference)."""
    d = np.clip(np.asarray(delta, float), 0.0, 1.0)
    a = np.asarray(alpha, float)
    p = np.asarray(w, float) * d * a
    n = len(d)
    out = np.zeros(n)
    act = np.flatnonzero(p > 0)
    if F <= 0:
        return out, float(np.max(p)) if n else 0.0
    if act.size == 0:
        return np.full(n, F / n), 0.0
    order = act[np.argsort(-p[act], kind="stable")]
    ps, inv_a = p[order], 1.0 / a[order]
    if response == "hyperbolic":
        num = np.cumsum(np.sqrt(ps) * inv_a)
        den = F + np.cumsum(inv_a)
        lam_k = (num / den) ** 2
    else:
        lam_k = np.exp((np.cumsum(np.log(ps) * inv_a) - F) / np.cumsum(inv_a))
    nxt = np.append(ps[1:], 0.0)
    k = int(np.argmax(lam_k >= nxt))
    lam = float(lam_k[k])
    sel = order[: k + 1]
    if response == "hyperbolic":
        fa = (np.sqrt(p[sel] / lam) - 1.0) / a[sel]
    else:
        fa = (np.log(p[sel]) - np.log(lam)) / a[sel]
    fa = np.maximum(fa, 0.0)
    s = fa.sum()
    if s > 0:
        fa *= F / s
    out[sel] = fa
    return out, lam
