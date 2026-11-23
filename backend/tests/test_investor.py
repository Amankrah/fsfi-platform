"""External investor programmes."""
import json

import numpy as np
import pytest

from fsfi_platform import assessment as A
from fsfi_platform import investor as INV
from fsfi_platform import store
from fsfi_platform.engine import kkt

IDS = ["aurelia", "borealis", "cordova", "deltana"]


@pytest.mark.parametrize("response", ["exponential", "hyperbolic"])
def test_best_addition_is_residual_optimum(response):
    """The closed form beats random splits of the same money on top of the allocation."""
    rng = np.random.default_rng(7)
    n = 12
    d, a, w = rng.uniform(0.05, 0.9, n), rng.uniform(0.001, 0.02, n), rng.dirichlet(np.ones(n))
    f = rng.uniform(0, 80, n)
    mask = np.ones(n, bool)
    x = INV.best_addition(d, f, a, w, 100.0, mask, response)
    assert x.sum() == pytest.approx(100.0) and (x >= 0).all()
    best = kkt.index(d, f + x, a, w, response)
    for _ in range(200):
        y = rng.dirichlet(np.ones(n)) * 100.0
        assert best <= kkt.index(d, f + y, a, w, response) + 1e-12


@pytest.mark.parametrize("cid", IDS)
@pytest.mark.parametrize("split", ["equal", "best"])
def test_investment_invariants(cid, split):
    p = store.get(cid)
    r = INV.investment(p, components=["nutrition"], indicators=["IND-11"], amount=40, years=3, split=split)
    json.dumps(r, allow_nan=False)
    s = r["snapshot"]
    assert s["fsfsi_with"] <= s["fsfsi"]
    assert s["best_any"] <= s["best_selection"] + 1e-12 <= s["fsfsi_with"] + 2e-12
    assert 0 <= s["value_for_money"] <= s["value_within_selection"] + 1e-12 <= 1 + 1e-9
    if split == "best":
        assert s["value_within_selection"] == pytest.approx(1.0)
    added = sum(i["added"] for i in r["indicators"])
    assert added == pytest.approx(40.0)
    assert sum(a["programme_share"] for a in r["strategy"]["areas"]) == pytest.approx(1.0)
    path = r["plan"]["path"]
    assert [q["disbursed"] for q in path] == [40, 40, 40, 0, 0]
    assert all(q["with_acc"] <= q["plan_acc"] + 1e-12 for q in path)


def test_investment_errors():
    p = store.get("aurelia")
    for kw in (dict(amount=10), dict(amount=0, components=["nutrition"]), dict(amount=10, indicators=["IND-99"]),
               dict(amount=10, components=["nowhere"]), dict(amount=10, components=["nutrition"], split="random"),
               dict(amount=10, components=["nutrition"], years=9)):
        with pytest.raises(A.AssessmentError):
            INV.investment(p, **kw)


def test_investment_endpoint(client):
    r = client.post("/api/countries/borealis/investment",
                    json={"name": "Test", "components": ["finance"], "amount": 25, "split": "best", "horizon": 7})
    assert r.status_code == 200
    j = r.json()
    assert j["programme"]["name"] == "Test" and len(j["plan"]["path"]) == 7
    assert client.post("/api/countries/borealis/investment", json={"amount": 25}).status_code == 422
    assert client.post("/api/countries/borealis/investment", json={"components": ["finance"], "amount": -1}).status_code == 422
