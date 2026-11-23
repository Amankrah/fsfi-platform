"""API smoke tests for every endpoint of PLATFORM_SPEC section 3."""
import json

import pytest

IDS = ["aurelia", "borealis", "cordova", "deltana"]


def _finite(r):
    json.dumps(r.json(), allow_nan=False)  # raises on NaN / inf
    return r.json()


def test_health(client):
    j = _finite(client.get("/api/health"))
    assert j["status"] == "ok" and j["engine"] in ("rust", "reference") and j["version"]
    assert set(j["engine_functions"]) == {"index", "optimum", "efficiency"}


def test_cors(client):
    r = client.options("/api/health", headers={"Origin": "http://localhost:3010", "Access-Control-Request-Method": "GET"})
    assert r.headers.get("access-control-allow-origin") == "http://localhost:3010"
    r = client.get("/api/health", headers={"Origin": "http://127.0.0.1:3010"})
    assert r.headers.get("access-control-allow-origin") == "http://127.0.0.1:3010"


def test_framework(client):
    j = _finite(client.get("/api/framework"))
    assert len(j["components"]) == 8 and len(j["indicators"]) == 37
    assert [i["code"] for i in j["indicators"]] == [f"IND-{k:02d}" for k in range(1, 38)]
    d = j["defaults"]
    for k in ("ahp_matrix", "dependency_matrices", "hybrid_coefficients", "persistence", "breaks", "sensitivities"):
        assert k in d
    assert len(d["dependency_matrices"]) == 5
    names = {i["code"]: i["name"] for i in j["indicators"]}
    assert names["IND-03"].startswith("Fertilizer") and names["IND-16"].startswith("Share of production marketed")


def test_countries_list(client):
    j = _finite(client.get("/api/countries"))
    ids = [c["id"] for c in j]
    assert ids[:4] == IDS
    for c in j[:4]:
        assert c["kind"] == "synthetic" and c["currency"] == "DU m" and c["years"] == [f"t{i}" for i in range(6)]
        assert set(c["latest"]) == {"year", "fsfsi", "fsfsi_acc", "efficiency", "stress_class"}


@pytest.mark.parametrize("cid", IDS)
def test_country_profile(client, cid):
    j = _finite(client.get(f"/api/countries/{cid}"))
    for k in ("id", "name", "tagline", "description", "kind", "currency", "components", "indicators", "sensitivities",
              "ahp_matrix", "dependency_matrices", "persistence", "breaks", "years", "budget_lines", "created_at", "updated_at"):
        assert k in j
    y = j["years"][0]
    iy = next(iter(y["indicators"].values()))
    assert set(iy) == {"observed", "benchmark", "allocation"}
    assert any(v["observed"] is None for yr in j["years"] for v in yr["indicators"].values()) == (cid in ("aurelia", "cordova"))


def test_unknown_country(client):
    assert client.get("/api/countries/nowhere").status_code == 404
    assert client.get("/api/countries/nowhere/assessment").status_code == 404


ASSESS_KEYS = {"country_id", "year", "weighting", "scenario", "response", "system", "components", "indicators",
               "diagnosis_summary", "front_loaded", "meta"}
SYSTEM_KEYS = {"fsfsi", "fsfsi_acc", "fsfsi_opt", "fsfsi_opt_held", "efficiency", "efficiency_held", "efficiency_fixed_t0",
               "elasticity", "envelope", "envelope_index", "envelope_multiple", "envelope_multiple_held", "front_loaded_10pct",
               "financing_response", "stress_class", "lambda", "ahp_cr"}
IND_KEYS = {"code", "name", "component", "direction", "gap", "imputed", "allocation", "share", "stress", "acc_stress",
            "coverage", "weight", "stress_class", "diagnosis", "optimal_allocation", "optimal_share", "marginal_return"}
COMP_KEYS = {"id", "name", "weight", "share", "stress", "acc_stress", "mean_gap", "coverage", "stress_class", "diagnosis",
             "optimal_share", "shift_pp", "held_optimal_share", "held_shift_pp", "n_indicators", "n_imputed"}


@pytest.mark.parametrize("cid", IDS)
@pytest.mark.parametrize("params", ["", "?year=t2&weighting=equal&scenario=climate_shock&response=hyperbolic",
                                    "?weighting=expert&scenario=financial_crisis", "?weighting=network&scenario=pandemic_disruption",
                                    "?weighting=financial&scenario=political_instability"])
def test_assessment(client, cid, params):
    j = _finite(client.get(f"/api/countries/{cid}/assessment{params}"))
    assert ASSESS_KEYS <= set(j) and SYSTEM_KEYS <= set(j["system"])
    assert IND_KEYS <= set(j["indicators"][0]) and COMP_KEYS <= set(j["components"][0])
    assert j["meta"]["engine"] in ("rust", "reference") and j["meta"]["compute_ms"] >= 0
    assert set(j["meta"]["breaks"]) == {"indicator", "component", "system", "coverage"}
    assert len(j["components"]) == 8
    assert {"moved", "captured"} == set(j["front_loaded"][0])


def test_assessment_bad_params(client):
    assert client.get("/api/countries/aurelia/assessment?year=t9").status_code == 422
    assert client.get("/api/countries/aurelia/assessment?scenario=meteor").status_code == 422
    assert client.get("/api/countries/aurelia/assessment?weighting=random").status_code == 422
    assert client.get("/api/countries/aurelia/assessment?response=linear").status_code == 422


@pytest.mark.parametrize("cid", IDS)
def test_timeseries(client, cid):
    j = _finite(client.get(f"/api/countries/{cid}/timeseries"))
    assert len(j["years"]) == 6
    y = j["years"][0]
    for k in ("year", "fsfsi", "fsfsi_acc", "efficiency", "efficiency_fixed_t0", "envelope_index", "n_assessed", "n_imputed",
              "components", "diagnosis_summary"):
        assert k in y
    assert y["envelope_index"] == pytest.approx(100.0)
    assert set(next(iter(y["components"].values()))) == {"stress", "acc_stress", "share"}


def test_scale(client):
    j = _finite(client.get("/api/countries/aurelia/scale"))
    assert j["reference_year"] == "t5" and len(j["multiples"]) == 40
    assert len(j["curves"]) == 12
    c = j["curves"][0]
    assert len(c["efficiency"]) == 40 and {"year", "response", "elasticity", "own_multiple", "own_efficiency"} <= set(c)
    assert all(0 < e <= 1 for cc in j["curves"] for e in cc["efficiency"])
    last = [cc for cc in j["curves"] if cc["year"] == "t5" and cc["response"] == "exponential"][0]
    assert last["own_multiple"] == pytest.approx(1.0)


def test_weights(client):
    j = _finite(client.get("/api/countries/aurelia/weights?scenario=climate_shock"))
    assert len(j["components"]) == 8 and set(j["vectors"]) == {"ahp", "pagerank", "cascade", "financial", "hybrid"}
    assert all(sum(v) == pytest.approx(1.0) for v in j["vectors"].values())
    assert j["ahp_cr"] < 0.1 and len(j["scenarios"]) == 5 and len(j["dependency_matrix"]) == 8


def test_budget_lines(client):
    j = _finite(client.get("/api/countries/aurelia/budget-lines?year=t5&q=road&page=1&page_size=5"))
    assert j["total"] > 0 and len(j["items"]) <= 5
    ln = j["items"][0]
    assert {"id", "year", "agency", "sub_programme", "line", "budget_tag", "amount", "indicator", "component", "line_class",
            "rule", "stage"} <= set(ln)
    assert all(it["year"] == "t5" for it in j["items"])
    all_ = client.get("/api/countries/aurelia/budget-lines?page_size=1000").json()
    assert all_["total"] >= 600
    s = _finite(client.get("/api/countries/aurelia/budget-summary?year=t5"))
    assert s["summary"]["total_amount"] > 0


def test_draft(client):
    a = client.get("/api/countries/aurelia/assessment").json()
    shares = {c["id"]: c["share"] for c in a["components"]}
    j = _finite(client.post("/api/countries/aurelia/draft", json={"year": "t5", "component_shares": shares}))
    assert j["fsfsi"] == pytest.approx(a["system"]["fsfsi"], abs=1e-9)
    assert j["delta_vs_actual"] == pytest.approx(0.0, abs=1e-9)
    opt = {c["id"]: c["optimal_share"] for c in a["components"]}
    j2 = _finite(client.post("/api/countries/aurelia/draft", json={"component_shares": opt}))
    assert j2["delta_vs_actual"] < 0
    j3 = _finite(client.post("/api/countries/aurelia/draft", json={"envelope_multiplier": 2.0, "response": "hyperbolic"}))
    assert j3["fsfsi"] < a["system"]["fsfsi"]
    j4 = _finite(client.post("/api/countries/aurelia/draft", json={"indicator_allocations": {"IND-27": 50.0}}))
    for k in ("fsfsi", "efficiency", "fsfsi_opt", "stress_class", "components", "diagnosis_summary", "delta_vs_actual", "compute_ms"):
        assert k in j4


def test_calibrate_endpoint(client):
    j = _finite(client.post("/api/countries/aurelia/calibrate"))
    assert set(j["breaks"]) == {"indicator", "component", "system", "coverage"} and "gvf" in j
    assert client.post("/api/countries/aurelia/calibrate", json={"apply": True}).status_code == 403


def test_assess_stateless(client):
    p = client.get("/api/countries/borealis").json()
    p.pop("budget_lines")
    j = _finite(client.post("/api/assess", json={"profile": p, "year": "t3"}))
    ref = client.get("/api/countries/borealis/assessment?year=t3").json()
    assert j["system"]["fsfsi"] == pytest.approx(ref["system"]["fsfsi"], abs=1e-12)
    # minimal profile: framework defaults fill the method parameters
    minimal = {"name": "Mini", "years": [{"year": "2024", "envelope": 0, "indicators": {
        "IND-01": {"observed": 2.0, "benchmark": 4.0, "allocation": 10},
        "IND-20": {"observed": None, "benchmark": 9.0, "allocation": 30},
        "IND-29": {"observed": 30, "benchmark": 70, "allocation": 5}}}]}
    j = _finite(client.post("/api/assess", json={"profile": minimal}))
    assert len(j["indicators"]) == 3 and j["system"]["envelope"] == pytest.approx(45.0)


def test_custom_crud_and_clone(client):
    r = client.post("/api/countries/aurelia/clone", json={"name": "My Aurelia"})
    assert r.status_code == 201
    c = r.json()
    assert c["kind"] == "custom" and c["id"].startswith("my-aurelia")
    cid = c["id"]
    c["tagline"] = "edited"
    r = client.put(f"/api/countries/{cid}", json=c)
    assert r.status_code == 200 and r.json()["tagline"] == "edited"
    assert client.get(f"/api/countries/{cid}/assessment").status_code == 200
    cal = client.post(f"/api/countries/{cid}/calibrate", json={"apply": True}).json()
    assert cal["applied"] is True
    assert client.get(f"/api/countries/{cid}").json()["breaks"] == cal["breaks"]
    assert cid in [x["id"] for x in client.get("/api/countries").json()]
    assert client.delete(f"/api/countries/{cid}").status_code == 200
    assert client.get(f"/api/countries/{cid}").status_code == 404


def test_create_custom_minimal(client):
    body = {"name": "Testland", "currency": "TL m", "years": [
        {"year": "2023", "envelope": 0, "indicators": {"IND-01": {"observed": 2.0, "benchmark": 4.0, "allocation": 10},
                                                       "IND-25": {"observed": None, "benchmark": 40, "allocation": 2}}},
        {"year": "2024", "envelope": 0, "indicators": {"IND-01": {"observed": 2.2, "benchmark": 4.0, "allocation": 12},
                                                       "IND-25": {"observed": 10, "benchmark": 40, "allocation": 3}}}]}
    r = client.post("/api/countries", json=body)
    assert r.status_code == 201
    j = r.json()
    assert j["id"] == "testland" and j["kind"] == "custom" and len(j["components"]) == 8
    assert client.get("/api/countries/testland/timeseries").status_code == 200
    assert client.post("/api/countries/testland/calibrate").status_code == 422  # fewer than 3 years
    bad = dict(body, years=[{"year": "x", "indicators": {"IND-99": {"observed": 1, "benchmark": 1, "allocation": 1}}}])
    assert client.post("/api/countries", json=bad).status_code == 422
    client.delete("/api/countries/testland")


def test_synthetic_read_only(client):
    p = client.get("/api/countries/aurelia").json()
    assert client.put("/api/countries/aurelia", json=p).status_code == 403
    assert client.delete("/api/countries/aurelia").status_code == 403


def test_mapping_endpoints(client):
    t = client.get("/api/mapping/template")
    assert t.status_code == 200 and t.headers["content-type"].startswith("text/csv")
    assert t.text.splitlines()[0] == "year,agency,sub_programme,line,budget_tag,amount"
    r = client.post("/api/mapping/run", files={"file": ("b.csv", t.text.encode(), "text/csv")})
    j = _finite(r)
    assert r.status_code == 200 and len(j["lines"]) == 4
    assert j["lines"][0]["indicator"] == "IND-03" and j["lines"][1]["indicator"] == "IND-16"
    assert j["summary"]["total_amount"] == pytest.approx(120.5 + 340 + 85.25 + 30)
    assert sum(j["summary"]["by_indicator"].values()) == pytest.approx(j["summary"]["total_amount"])
    bad = client.post("/api/mapping/run", files={"file": ("b.csv", b"a,b\n1,2\n", "text/csv")})
    assert bad.status_code == 422


def test_templates_and_record_import(client):
    t = client.get("/api/templates/indicators.csv")
    assert t.status_code == 200 and len(t.text.strip().splitlines()) == 38
    r = client.get("/api/templates/records.csv")
    assert r.text.splitlines()[0] == "year,code,observed,benchmark,allocation"
    imp = client.post("/api/import/records", files={"file": ("r.csv", r.text.encode(), "text/csv")})
    j = _finite(imp)
    assert imp.status_code == 200 and [y["year"] for y in j] == ["t0", "t1"]
    assert j[0]["indicators"]["IND-03"]["observed"] is None
    assert j[0]["envelope"] == pytest.approx(35.5 + 60 + 120)


def test_evidence(client):
    j = _finite(client.get("/api/evidence"))
    assert j["n_rep"] == 1000 and len(j["countries"]) == 4
    assert {r["country"] for r in j["e1"]} >= {"A", "B", "C", "D"}
    assert {r["response"] for r in j["e1"]} == {"exponential", "hyperbolic"}
    assert len(j["e2"]) == 22 and len(j["e5"]) >= 32 and len(j["e6"]) == 10
