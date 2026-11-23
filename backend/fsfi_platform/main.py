"""FSFI Platform API (prefix /api). Run: uvicorn fsfi_platform.main:app --port 8010"""
from __future__ import annotations

import csv
import io
import logging
import os
from contextlib import asynccontextmanager
from typing import List, Optional

from pydantic import BaseModel, Field
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse

from . import assessment as A
from . import evidence as EV
from . import framework as FW
from . import investor as INV
from . import planning as PL
from . import store
from .engine import get_engine
from .mapping import parse_budget_csv, run_mapping, template_csv
from .schemas import (Assessment, AssessRequest, BudgetLinesPage, CalibrateRequest, CalibrateResult, CloneRequest,
                      CountryProfile, CountryProfileIn, CountrySummary, DraftRequest, DraftScore, Health, MappingResult,
                      ScaleCurves, TimeSeries, WeightsReport, YearRecord)

VERSION = "1.0.0"
log = logging.getLogger("fsfi_platform")


@asynccontextmanager
async def lifespan(app: FastAPI):
    written = store.ensure_synthetic()
    if written:
        log.info("generated synthetic countries: %s", written)
    get_engine()
    for cid in store.list_ids():  # warm the caches
        try:
            p = store.get(cid)
            A.assessment(p, key=store.cache_key(p))
        except Exception:  # pragma: no cover
            log.exception("warm-up failed for %s", cid)
    EV.load()
    yield


app = FastAPI(title="FSFI Platform API", version=VERSION, lifespan=lifespan)
# Comma-separated list of allowed browser origins. In production the frontend and the API share one origin
# (nginx serves /api), so this only matters for local development.
_ORIGINS = [o.strip() for o in os.environ.get(
    "FSFI_CORS_ORIGINS", "http://localhost:3010,http://127.0.0.1:3010").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(A.AssessmentError)
async def _assessment_error(_, exc):
    return JSONResponse(status_code=422, content={"detail": str(exc)})


@app.exception_handler(store.Invalid)
async def _invalid(_, exc):
    return JSONResponse(status_code=422, content={"detail": str(exc)})


def _get(cid: str) -> dict:
    try:
        return store.get(cid)
    except store.NotFound:
        raise HTTPException(404, f"country '{cid}' not found")


def _ic(p: dict) -> dict:
    return {i["code"]: i["component"] for i in p["indicators"]}


# ---------------------------------------------------------------------------

@app.get("/api/health", response_model=Health)
def health():
    e = get_engine()
    return {"status": "ok", "engine": e.name, "version": VERSION, "engine_mode": e.mode,
            "rust_available": e.rust_available, "engine_functions": e.used("exponential"),
            "rust_agreement": {k: float(v) for k, v in e.agreement.items()}}


@app.get("/api/framework")
def framework():
    return FW.framework_payload()


@app.get("/api/countries", response_model=List[CountrySummary])
def countries():
    out = []
    for cid in store.list_ids():
        try:
            p = store.get(cid)
        except Exception as exc:  # a broken custom file must not take the gallery down
            log.warning("cannot read %s: %s", cid, exc)
            continue
        try:
            out.append(A.summary(p, key=store.cache_key(p)))
        except Exception as exc:  # e.g. a custom country without years yet
            log.info("no assessment for %s: %s", cid, exc)
            out.append({"id": p["id"], "name": p.get("name", p["id"]), "tagline": p.get("tagline", ""),
                        "kind": p.get("kind", "custom"), "currency": p.get("currency", ""),
                        "years": [y["year"] for y in p.get("years", [])], "n_indicators": len(p.get("indicators", [])),
                        "latest": {"year": "", "fsfsi": 0.0, "fsfsi_acc": 0.0, "efficiency": 1.0, "stress_class": "low"},
                        "series": []})
    return out


@app.get("/api/countries/{cid}", response_model=CountryProfile)
def country(cid: str):
    return _get(cid)


@app.post("/api/countries", response_model=CountryProfile, status_code=201)
def create_country(body: CountryProfileIn):
    p = store.create(body.model_dump(exclude_none=True))
    return p


@app.put("/api/countries/{cid}", response_model=CountryProfile)
def update_country(cid: str, body: CountryProfileIn):
    _get(cid)
    try:
        return store.update(cid, body.model_dump(exclude_none=True))
    except store.ReadOnly:
        raise HTTPException(403, "synthetic countries are read-only; clone it to edit")


@app.delete("/api/countries/{cid}")
def delete_country(cid: str):
    _get(cid)
    try:
        store.delete(cid)
    except store.ReadOnly:
        raise HTTPException(403, "synthetic countries are read-only")
    return {"deleted": cid}


@app.post("/api/countries/{cid}/clone", response_model=CountryProfile, status_code=201)
def clone_country(cid: str, body: CloneRequest):
    _get(cid)
    if not body.name.strip():
        raise HTTPException(422, "name is required")
    return store.clone(cid, body.name.strip())


@app.get("/api/countries/{cid}/assessment", response_model=Assessment)
def country_assessment(cid: str, year: Optional[str] = None, weighting: str = "hybrid",
                       scenario: str = "normal_operations", response: str = "exponential"):
    p = _get(cid)
    return A.assessment(p, year, weighting, scenario, response, key=store.cache_key(p))


@app.get("/api/countries/{cid}/timeseries", response_model=TimeSeries)
def country_timeseries(cid: str, weighting: str = "hybrid", scenario: str = "normal_operations",
                       response: str = "exponential"):
    p = _get(cid)
    return A.timeseries(p, weighting, scenario, response, key=store.cache_key(p))


@app.get("/api/countries/{cid}/scale", response_model=ScaleCurves)
def country_scale(cid: str, weighting: str = "hybrid", scenario: str = "normal_operations"):
    p = _get(cid)
    return A.scale_curves(p, weighting, scenario, key=store.cache_key(p))


@app.get("/api/countries/{cid}/weights", response_model=WeightsReport)
def country_weights(cid: str, year: Optional[str] = None, scenario: str = "normal_operations"):
    p = _get(cid)
    return A.weights_report(p, year, scenario)


def _plan_params(horizon, target_reduction, target, growth, curve, pace):
    return dict(horizon=horizon, target_reduction=target_reduction, target=target, growth=growth, curve=curve,
                pace=pace)


@app.get("/api/countries/{cid}/plan")
def country_plan(cid: str, horizon: int = 5, target_reduction: float = 0.20, target: Optional[float] = None,
                 growth: float = 0.05, curve: str = "smoothstep", pace: float = 1.0, weighting: str = "hybrid",
                 scenario: str = "normal_operations", response: str = "exponential"):
    """Multi-year strategic plan from the latest assessed year."""
    p = _get(cid)
    return PL.plan(p, weighting=weighting, scenario=scenario, response=response, key=store.cache_key(p),
                   **_plan_params(horizon, target_reduction, target, growth, curve, pace))


@app.get("/api/countries/{cid}/strategy")
def country_strategy(cid: str, horizon: int = 5, target_reduction: float = 0.20, target: Optional[float] = None,
                     growth: float = 0.05, curve: str = "smoothstep", pace: float = 1.0, weighting: str = "hybrid",
                     scenario: str = "normal_operations", response: str = "exponential"):
    """Alignment of the actual allocation, the optimum and the plan with the national strategy."""
    p = _get(cid)
    return PL.strategy_report(p, weighting, scenario, response, key=store.cache_key(p),
                              plan_params=_plan_params(horizon, target_reduction, target, growth, curve, pace))


class InvestmentRequest(BaseModel):
    name: str = ""
    indicators: List[str] = []
    components: List[str] = []
    amount: float = Field(gt=0, description="money added per year, in the country's currency")
    years: Optional[int] = None
    split: str = "equal"
    weighting: str = "hybrid"
    scenario: str = "normal_operations"
    response: str = "exponential"
    horizon: int = 5
    target_reduction: float = 0.20
    target: Optional[float] = None
    growth: float = 0.05
    curve: str = "smoothstep"
    pace: float = 1.0


@app.post("/api/countries/{cid}/investment")
def country_investment(cid: str, body: InvestmentRequest):
    """An external investor's programme scored against the best use of the same money, the plan and the strategy."""
    p = _get(cid)
    b = body.model_dump()
    pp = _plan_params(b.pop("horizon"), b.pop("target_reduction"), b.pop("target"), b.pop("growth"), b.pop("curve"),
                      b.pop("pace"))
    return INV.investment(p, key=store.cache_key(p), plan_params=pp, **b)


@app.get("/api/countries/{cid}/budget-lines", response_model=BudgetLinesPage)
def budget_lines(cid: str, year: Optional[str] = None, q: Optional[str] = None, page: int = Query(1, ge=1),
                 page_size: int = Query(50, ge=1, le=1000), indicator: Optional[str] = None,
                 component: Optional[str] = None, stage: Optional[str] = None):
    p = _get(cid)
    items = p.get("budget_lines") or []
    present = {ln["year"] for ln in items}
    known = [y["year"] for y in p["years"]]
    years = [y for y in known if y in present] + sorted(present - set(known))
    if year:
        items = [ln for ln in items if ln["year"] == year]
    if indicator:
        items = [ln for ln in items if ln.get("indicator") == indicator]
    if component:
        items = [ln for ln in items if ln.get("component") == component]
    if stage:
        items = [ln for ln in items if ln.get("stage") == stage]
    if q:
        ql = q.lower()
        items = [ln for ln in items if any(ql in str(ln.get(k) or "").lower()
                                           for k in ("line", "sub_programme", "agency", "budget_tag", "indicator", "rule"))]
    total = len(items)
    start = (page - 1) * page_size
    return {"items": items[start:start + page_size], "total": total, "page": page, "page_size": page_size, "years": years}


@app.get("/api/countries/{cid}/budget-summary", response_model=MappingResult)
def budget_summary(cid: str, year: Optional[str] = None):
    """Extension: mapping summary of the country's stored budget lines (lines omitted)."""
    p = _get(cid)
    lines = [ln for ln in (p.get("budget_lines") or []) if not year or ln["year"] == year]
    res = run_mapping(lines, _ic(p)) if lines else {"lines": [], "summary": {"by_indicator": {}, "by_component": {},
                                                                              "by_stage": {}, "unassigned_amount": 0.0,
                                                                              "total_amount": 0.0}}
    res["lines"] = []
    return res


@app.post("/api/countries/{cid}/draft", response_model=DraftScore)
def draft(cid: str, body: DraftRequest):
    p = _get(cid)
    return A.draft_score(p, body.year, body.component_shares, body.indicator_allocations, body.envelope_multiplier or 1.0,
                         body.weighting, body.scenario, body.response, key=store.cache_key(p))


@app.post("/api/countries/{cid}/calibrate", response_model=CalibrateResult)
def calibrate(cid: str, body: Optional[CalibrateRequest] = None):
    p = _get(cid)
    body = body or CalibrateRequest()
    res = A.calibrate(p, body.weighting, body.scenario, body.response, key=store.cache_key(p))
    res["applied"] = False
    if body.apply:
        if p["kind"] == "synthetic":
            raise HTTPException(403, "synthetic countries are read-only; clone it to recalibrate")
        q = dict(p)
        q["breaks"] = res["breaks"]
        store.update(cid, q)
        res["applied"] = True
    return res


@app.post("/api/assess", response_model=Assessment)
def assess(body: AssessRequest):
    p = store.normalise(body.profile.model_dump(exclude_none=True), kind="custom",
                        keep_id=body.profile.id or "preview")
    return A.assessment(p, body.year, body.weighting, body.scenario, body.response)


@app.post("/api/mapping/run", response_model=MappingResult)
async def mapping_run(file: UploadFile = File(...), country_id: Optional[str] = None):
    raw = await file.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")
    try:
        lines = parse_budget_csv(text)
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    ic = _ic(_get(country_id)) if country_id else {i["code"]: i["component"] for i in FW.INDICATORS}
    return run_mapping(lines, ic)


def _csv_response(text: str, name: str):
    return PlainTextResponse(text, media_type="text/csv",
                             headers={"Content-Disposition": f'attachment; filename="{name}"'})


@app.get("/api/mapping/template")
def mapping_template():
    return _csv_response(template_csv(), "budget_lines_template.csv")


@app.get("/api/templates/indicators.csv")
def indicators_template():
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(["code", "name", "component", "direction", "unit", "benchmark_type"])
    for i in FW.INDICATORS:
        w.writerow([i["code"], i["name"], i["component"], i["direction"], i["unit"] or "", i["benchmark_type"] or ""])
    return _csv_response(buf.getvalue(), "indicators_template.csv")


@app.get("/api/templates/records.csv")
def records_template():
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(["year", "code", "observed", "benchmark", "allocation"])
    w.writerow(["t0", "IND-01", "2.1", "4.6", "35.5"])
    w.writerow(["t0", "IND-03", "", "145", "60"])
    w.writerow(["t0", "IND-20", "31.5", "9", "120"])
    w.writerow(["t1", "IND-01", "2.3", "4.6", "38"])
    return _csv_response(buf.getvalue(), "records_template.csv")


@app.post("/api/import/records", response_model=List[YearRecord])
async def import_records(file: UploadFile = File(...)):
    raw = await file.read()
    text = raw.decode("utf-8-sig", errors="replace")
    rdr = csv.DictReader(io.StringIO(text))
    need = ["year", "code", "observed", "benchmark", "allocation"]
    cols = [c.strip().lower() for c in (rdr.fieldnames or [])]
    missing = [c for c in need if c not in cols]
    if missing:
        raise HTTPException(422, f"missing columns: {missing}; expected {need}")
    years: dict = {}
    for n, r in enumerate(rdr, start=2):
        r = {k.strip().lower(): (v or "").strip() for k, v in r.items() if k}
        if not any(r.values()):
            continue
        try:
            obs = float(r["observed"]) if r["observed"] not in ("", "NA", "na", "null") else None
            bench = float(r["benchmark"])
            alloc = float(r["allocation"] or 0)
        except ValueError:
            raise HTTPException(422, f"line {n}: observed, benchmark and allocation must be numbers")
        if bench < 0 or alloc < 0 or (obs is not None and obs < 0):
            raise HTTPException(422, f"line {n}: values must be non-negative")
        y = years.setdefault(r["year"], {"year": r["year"], "envelope": 0.0, "indicators": {}})
        y["indicators"][r["code"]] = {"observed": obs, "benchmark": bench, "allocation": alloc}
        y["envelope"] += alloc
    return list(years.values())


@app.get("/api/evidence")
def evidence():
    return A.finite(EV.load(), default=None)
