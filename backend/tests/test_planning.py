"""Strategic planning and national strategy alignment."""
import copy
import json

import numpy as np
import pytest

from fsfi_platform import assessment as A
from fsfi_platform import planning as PL
from fsfi_platform import store

IDS = ["aurelia", "borealis", "cordova", "deltana"]


def _p(cid):
    return store.get(cid)


def test_next_labels():
    assert PL.next_labels("t5", 3) == ["t6", "t7", "t8"]
    assert PL.next_labels("2024", 2) == ["2025", "2026"]
    assert PL.next_labels("FY2023", 1) == ["FY2024"]
    assert PL.next_labels("base", 2) == ["base+1", "base+2"]


def test_curves():
    for c in PL.CURVES:
        assert PL.progress_fraction(0, 5, c) == 0.0
        assert PL.progress_fraction(5, 5, c) == pytest.approx(1.0)
    assert PL.progress_fraction(1, 4, "frontloaded") > PL.progress_fraction(1, 4, "linear") > \
        PL.progress_fraction(1, 4, "smoothstep")


@pytest.mark.parametrize("cid", IDS)
def test_plan_full_pace_reaches_optimum_in_year_one(cid):
    p = _p(cid)
    pl = PL.plan(p, horizon=3, growth=0.0, pace=1.0)
    base = A.record(p)[-1]
    assert pl["years"][0]["fsfsi"] == pytest.approx(base["fsfsi_opt"], rel=1e-9)
    # with a flat envelope the business-as-usual point-in-time index is today's
    assert all(y["bau_fsfsi"] == pytest.approx(base["fsfsi"], rel=1e-9) for y in pl["years"])
    assert all(y["envelope"] == pytest.approx(base["F"]) for y in pl["years"])


@pytest.mark.parametrize("cid", IDS)
def test_plan_invariants(cid):
    p = _p(cid)
    pl = PL.plan(p, horizon=6, growth=0.04, pace=0.5)
    json.dumps(pl, allow_nan=False)
    assert len(pl["years"]) == 6
    for y in pl["years"]:
        assert sum(c["share"] for c in y["components"].values()) == pytest.approx(1.0)
        assert y["fsfsi"] <= y["bau_fsfsi"] + 1e-12  # moving toward the optimum never raises the index
    env = [y["envelope"] for y in pl["years"]]
    assert all(b > a for a, b in zip(env, env[1:]))
    assert pl["years"][-1]["year_target"] == pytest.approx(pl["target"])
    assert pl["summary"]["composition_gain"] >= -1e-12


@pytest.mark.parametrize("cid", IDS)
def test_required_growth_hits_target(cid):
    p = _p(cid)
    pl = PL.plan(p, horizon=5, target_reduction=0.25)
    g = pl["summary"]["required_growth"]
    assert g is not None
    again = PL.plan(p, horizon=5, target_reduction=0.25, growth=g + 1e-5)
    assert again["summary"]["reached"]
    below = PL.plan(p, horizon=5, target_reduction=0.25, growth=g - 1e-3)
    assert not below["summary"]["reached"]


def test_plan_bad_params():
    p = _p("aurelia")
    for kw in (dict(horizon=0), dict(horizon=99), dict(curve="zigzag"), dict(pace=0), dict(pace=1.5),
               dict(target_reduction=1.2), dict(target=-1.0)):
        with pytest.raises(A.AssessmentError):
            PL.plan(p, **kw)


@pytest.mark.parametrize("cid", IDS)
def test_strategy_report(cid):
    p = _p(cid)
    r = PL.strategy_report(p)
    json.dumps(r, allow_nan=False)
    assert r["strategy"]["source"] == "demonstration"
    for k in ("actual", "optimum", "plan"):
        assert 0.0 <= r["alignment"][k] <= 1.0
    for k in ("target_share", "actual_share", "optimal_share", "plan_share"):
        assert sum(a[k] for a in r["areas"]) == pytest.approx(1.0)
    ix = r["index"]
    # the strategy-consistent optimum sits between the optimum and anything else that respects the split
    assert ix["optimum"] <= ix["strategy_optimum"] + 1e-12
    assert 0.0 < ix["efficiency_strategy"] <= 1.0
    assert len(r["history"]) == len(p["years"])
    assert {t["status"] for t in r["tracking"]["targets"]} <= {"achieved", "on_track", "behind", "off_track", "no_data"}


def test_alignment_score_bounds():
    s = PL.strategy_of({"components": [{"id": c} for c in ("a", "b")],
                        "strategy": {"areas": [{"code": "X", "target_share": 3, "components": ["a"]},
                                               {"code": "Y", "target_share": 1, "components": ["b"]}]}})
    assert PL.alignment_score(s, {"X": 0.75, "Y": 0.25}) == pytest.approx(1.0)
    assert PL.alignment_score(s, {"X": 0.0, "Y": 1.0}) == pytest.approx(0.25)


def test_strategy_matching_optimum_has_no_cost():
    """A strategy whose target split is the optimum's split costs nothing against the optimum."""
    p = copy.deepcopy(_p("borealis"))
    base = A.record(p)[-1]
    comp_ids = [c["id"] for c in p["components"]]
    opt = PL._component_shares(base["x"].comps, base["fopt"], comp_ids)
    p["strategy"] = {"name": "test", "areas": [{"code": c, "name": c, "target_share": opt[c], "components": [c]}
                                               for c in comp_ids], "targets": []}
    r = PL.strategy_report(p, key="test-matching-optimum")
    assert r["alignment"]["optimum"] == pytest.approx(1.0)
    assert r["index"]["strategy_cost"] == pytest.approx(0.0, abs=1e-9)


def test_strategy_component_in_two_areas_rejected():
    p = copy.deepcopy(_p("aurelia"))
    p["strategy"] = {"areas": [{"code": "A", "target_share": 1, "components": ["markets"]},
                               {"code": "B", "target_share": 1, "components": ["markets"]}]}
    with pytest.raises(A.AssessmentError):
        PL.strategy_report(p, key="test-two-areas")


def test_endpoints(client):
    r = client.get("/api/countries/aurelia/plan", params={"horizon": 4, "growth": 0.03, "pace": 0.5})
    assert r.status_code == 200
    j = r.json()
    assert len(j["years"]) == 4 and j["params"]["pace"] == 0.5
    r = client.get("/api/countries/deltana/strategy", params={"weighting": "equal"})
    assert r.status_code == 200 and len(r.json()["areas"]) == 4
    assert client.get("/api/countries/aurelia/plan", params={"curve": "zigzag"}).status_code == 422
    assert client.get("/api/countries/nowhere/strategy").status_code == 404
