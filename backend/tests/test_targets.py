"""Calibration targets of the synthetic countries (PLATFORM_SPEC section 4)."""
import time

import pytest

from fsfi_platform import assessment as A


def _ds(a):
    return {d["diagnosis"]: d for d in a["diagnosis_summary"]}


def test_aurelia_t5_targets(profiles):
    a = A.assessment(profiles["aurelia"], "t5")
    s = a["system"]
    assert 0.20 <= s["fsfsi"] <= 0.40
    assert 0.60 <= s["efficiency"] <= 0.85
    assert s["elasticity"] < 0
    assert 1.5 <= s["envelope_multiple"] <= 3.0
    ds = _ds(a)
    assert all(ds[k]["count"] > 0 for k in A.DIAGNOSES)
    assert ds["unfunded_gap"]["envelope_share"] < 0.25
    assert ds["unfunded_gap"]["stress_share"] > 0.50
    n_imp = sum(i["imputed"] for i in a["indicators"])
    assert 0.15 <= n_imp / len(a["indicators"]) <= 0.40
    assert 28 <= len(a["indicators"]) <= 33


def test_aurelia_infrastructure_heavy(profiles):
    a = A.assessment(profiles["aurelia"], "t5")
    comp = {c["id"]: c for c in a["components"]}
    assert comp["markets"]["share"] + comp["post_harvest"]["share"] >= 0.40
    assert comp["markets"]["share"] + comp["post_harvest"]["share"] + comp["crop_production"]["share"] >= 0.60
    assert max(comp, key=lambda c: comp[c]["share"]) in ("markets", "post_harvest", "crop_production")
    env = [y["envelope"] for y in profiles["aurelia"]["years"]]
    assert 1.4 <= env[-1] / env[0] <= 2.0


def test_synthetic_breaks_are_own_calibration(profiles):
    """Each synthetic country's class breaks are its own Fisher-Jenks calibration, rounded to two decimals."""
    from fsfi_platform import synthetic as S

    for p in profiles.values():
        assert p["breaks"] == S.own_breaks(p)
        for v in p["breaks"].values():
            assert v == sorted(v) and all(round(x, 2) == x for x in v)


def test_borealis_near_optimal(profiles):
    a = A.assessment(profiles["borealis"], "t5")
    assert 0.85 <= a["system"]["efficiency"] <= 0.95
    assert not any(i["imputed"] for i in a["indicators"])


def test_cordova_withdrawal_visible(profiles):
    ts = A.timeseries(profiles["cordova"])
    y = {r["year"]: r for r in ts["years"]}
    assert y["t3"]["envelope_index"] < y["t2"]["envelope_index"] - 20
    assert y["t3"]["fsfsi"] > y["t2"]["fsfsi"] + 0.02
    assert y["t3"]["fsfsi_acc"] > y["t2"]["fsfsi_acc"]


def test_deltana_divergent_gaps(profiles):
    a = A.assessment(profiles["deltana"], "t5")
    gaps = [c["mean_gap"] for c in a["components"] if c["n_indicators"]]
    assert max(gaps) - min(gaps) > 0.4
    comp = {c["id"]: c["share"] for c in a["components"]}
    assert max(comp, key=comp.get) == "nutrition"


@pytest.mark.parametrize("cid", ["aurelia", "borealis", "cordova", "deltana"])
def test_assessment_fast(profiles, cid):
    p = profiles[cid]
    A.assessment(p, "t5", "hybrid", "normal_operations", "hyperbolic")  # warm AHP / PageRank vectors
    A._RECORD_CACHE.clear()
    t = time.perf_counter()
    A.assessment(p, "t5", "equal", "pandemic_disruption", "exponential")
    assert (time.perf_counter() - t) * 1000 < 50
