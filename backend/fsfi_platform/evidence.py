"""Simulation evidence for the Evidence page: headline numbers flattened from the public reproduction package's
results/simulation.json (E1 sign recovery by synthetic country and response, E2 misspecified sensitivities,
E5 imputation, E6 partner withdrawal). The flattened table is cached in data/evidence.json; it is rebuilt from
the source file when that file is available and the cache is missing.

    python -m fsfi_platform.evidence <path to simulation.json>
"""
from __future__ import annotations

import json
import sys
from functools import lru_cache
from pathlib import Path

HERE = Path(__file__).resolve().parent
CACHE = HERE / "data" / "evidence.json"
DEFAULT_SOURCE = HERE.parents[2] / "docs" / "paper" / "public_release" / "fsfsi-reproduction" / "results" / "simulation.json"
RESP = {"exp": "exponential", "hyp": "hyperbolic"}
COUNTRIES = [
    {"id": "A", "name": "Country A", "demo_country": "aurelia",
     "design": "Concentrated allocation, partner finance and imputed gaps"},
    {"id": "B", "name": "Country B", "demo_country": "borealis", "design": "Allocation near its own optimum, measured gaps"},
    {"id": "C", "name": "Country C", "demo_country": "cordova",
     "design": "Aid-dependent, off-budget finance and a planted withdrawal at t3"},
    {"id": "D", "name": "Country D", "demo_country": "deltana", "design": "Country A with component gap means drawn apart"},
]


def _v(d, key, default=None):
    x = d.get(key)
    if x is None:
        return default
    v = x.get("value") if isinstance(x, dict) else x
    return default if v is None else v


def _mcse(d, key):
    x = d.get(key)
    return x.get("mcse") if isinstance(x, dict) else None


def _scenarios(d, exp):
    out = []
    for k in d:
        if k.startswith(exp + ".") and k.endswith(".scenario"):
            out.append(k.split(".")[1])
    return sorted(set(out))


def _recovery(d, p):
    return {
        "sign_rate_all": _v(d, p + "sign_rate_all"),
        "sign_rate_material": _v(d, p + "sign_rate_material"),
        "sign_rate_material_mcse": _mcse(d, p + "sign_rate_material"),
        "gap_blind_sign_rate_all": _v(d, p + "sign_rate_all.gap_blind"),
        "gap_blind_sign_rate_material": _v(d, p + "sign_rate_material.gap_blind"),
        "constant_rule_sign_rate_material": _v(d, p + "sign_rate_material.constant_rule"),
        "gain_over_gap_blind": _v(d, p + "gain_over.gap_blind"),
        "gain_over_gap_blind_mcse": _mcse(d, p + "gain_over.gap_blind"),
        "spearman": _v(d, p + "spearman"),
        "kendall": _v(d, p + "kendall"),
        "diagnosis_accuracy": _v(d, p + "diagnosis_accuracy"),
        "diagnosis_kappa": _v(d, p + "diagnosis_kappa"),
        "e_bias": _v(d, p + "E_bias"),
        "fsfsi_rmse": _v(d, p + "fsfsi_rmse"),
        "n_imputed_mean": _v(d, p + "n_imputed_mean"),
    }


def build(source: Path) -> dict:
    d = json.loads(Path(source).read_text(encoding="utf-8"))
    e1 = []
    for s in _scenarios(d, "E1"):
        p = f"E1.{s}."
        sc = _v(d, p + "scenario")
        e1.append({"experiment": "E1", "scenario": s, "country": sc["arch"], "response": RESP.get(sc["form"], sc["form"]),
                   "arm": sc["arm"], **_recovery(d, p)})
    for s in _scenarios(d, "E1D"):
        p = f"E1D.{s}."
        sc = _v(d, p + "scenario")
        if sc.get("means") != "drawn":
            continue
        e1.append({"experiment": "E1D", "scenario": s, "country": sc["country"],
                   "response": RESP.get(sc["form"], sc["form"]), "arm": sc["arm"], **_recovery(d, p)})
    e2 = []
    for s in _scenarios(d, "E2"):
        p = f"E2.{s}."
        sc = _v(d, p + "scenario")
        e2.append({"scenario": s, "country": sc["arch"], "response": RESP.get(sc["form"], sc["form"]),
                   "sigma_c": sc["sigma_c"], "sigma_i": sc["sigma_i"], "bias": sc["bias"],
                   "e_coverage": _v(d, p + "E_coverage"), **_recovery(d, p)})
    e5 = []
    for prefix in ("E5", "E5s"):
        for s in _scenarios(d, prefix):
            p = f"{prefix}.{s}."
            sc = _v(d, p + "scenario")
            e5.append({"experiment": prefix, "scenario": s, "country": sc["arch"], "mechanism": sc["mechanism"],
                       "q": sc["q"], "sigma_c": sc.get("sigma_c", 0.0), **_recovery(d, p)})
    e6 = []
    for s in _scenarios(d, "E6"):
        p = f"E6.{s}."
        sc = _v(d, p + "scenario")
        row = {"scenario": s, "channel": sc["channel"], "offbudget": sc["offbudget"], "withdrawal_share": sc["w"]}
        for k in ("point_effect", "cum_effect", "true_effect", "registered_share_point", "registered_share_cum",
                  "point_onset_detection", "cum_onset_detection", "true_onset_detectable", "sign_rate_material_t2",
                  "sign_rate_material_t3", "sign_rate_material_gap_blind_t2", "sign_rate_material_gap_blind_t3",
                  "spearman_t2", "spearman_t3"):
            row[k] = _v(d, p + k)
        e6.append(row)
    meta = d.get("meta", {})
    return {
        "source": "results/simulation.json of the public reproduction package (synthetic countries only)",
        "master_seed": meta.get("master_seed"),
        "n_rep": _v(d, "design.n_sim", 1000),
        "mcse_target_proportion": _v(d, "design.mcse_target.proportion"),
        "materiality_pp": _v(d, "design.materiality_pp"),
        "countries": COUNTRIES,
        "e1": e1, "e2": e2, "e5": e5, "e6": e6,
        "verification": {
            "comparators_max_abs_diff": _v(d, "verification.comparators_against_runner.max_abs_diff"),
            "vectorised_index_max_abs_diff": _v(d, "verification.vectorised_index.max_abs_diff_index"),
            "vectorised_efficiency_max_abs_diff": _v(d, "verification.vectorised_index.max_abs_diff_efficiency"),
            "n_compared": _v(d, "verification.vectorised_index.n_compared"),
        },
    }


@lru_cache(maxsize=1)
def load() -> dict:
    if not CACHE.exists() and DEFAULT_SOURCE.exists():
        CACHE.write_text(json.dumps(build(DEFAULT_SOURCE), separators=(",", ":")), encoding="utf-8")
    if not CACHE.exists():
        return {"source": "unavailable", "master_seed": None, "n_rep": 0, "mcse_target_proportion": None,
                "materiality_pp": None, "countries": COUNTRIES, "e1": [], "e2": [], "e5": [], "e6": [], "verification": {}}
    return json.loads(CACHE.read_text(encoding="utf-8"))


if __name__ == "__main__":  # pragma: no cover
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SOURCE
    CACHE.write_text(json.dumps(build(src), separators=(",", ":")), encoding="utf-8")
    print("wrote", CACHE)
