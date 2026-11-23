"""Multi-year strategic planning and national strategy alignment.

Planning projects the index forward from the latest assessed year. Each plan year has an envelope that grows at a
chosen rate; the composition moves from the actual shares toward the year's optimum (Eq. kkt) at a chosen pace;
point-in-time stress follows the response function and accumulated stress follows Eq. ema with the profile's
persistence rates. Gaps, sensitivities and weights are held at their latest-year values, so the projection shows
what money and composition alone can do. A business-as-usual path with the same envelopes and today's composition
is computed alongside.

Strategy alignment compares the envelope's split across a national strategy's priority areas with the strategy's
target split, for the actual allocation, the optimum and the plan, and tracks the strategy's indicator targets on
the record. A profile can carry its own `strategy`; otherwise the generic demonstration strategy below is used.
"""
from __future__ import annotations

import math
import re

import numpy as np

from . import assessment as A
from .engine import kkt
from .engine import reference as R

CURVES = ("linear", "smoothstep", "frontloaded")
MAX_HORIZON = 15
GROWTH_SEARCH = (-0.10, 1.00)

# ---------------------------------------------------------------------------
# Demonstration strategy (generic; used when a profile carries none)
# ---------------------------------------------------------------------------

DEMO_STRATEGY = {
    "name": "National Food Systems Strategy (demonstration)",
    "source": "demonstration",
    "description": (
        "A generic strategy written for the demonstration countries. It groups the eight components into four "
        "priority areas with target budget shares and sets indicator targets as a share of the baseline gap to "
        "benchmark to close over the strategy period. Replace it with the country's own strategy to use the "
        "alignment analysis in practice."
    ),
    "start": None,  # record year of the baseline; None = the second record year (the first if only one)
    "periods": 6,
    "areas": [
        {"code": "SA1", "name": "Productivity and resilience", "target_share": 0.42,
         "components": ["crop_production", "animal_systems", "environment"],
         "description": "Raise crop and livestock productivity and protect the natural resource base."},
        {"code": "SA2", "name": "Markets and value chains", "target_share": 0.22,
         "components": ["markets", "post_harvest"],
         "description": "Cut losses after harvest and link producers to markets."},
        {"code": "SA3", "name": "Nutrition and food security", "target_share": 0.16,
         "components": ["nutrition"],
         "description": "Improve diets and reduce undernutrition."},
        {"code": "SA4", "name": "Knowledge and finance", "target_share": 0.20,
         "components": ["research", "finance"],
         "description": "Strengthen research, extension and access to finance."},
    ],
    "targets": [
        {"code": "SA1.1", "area": "SA1", "indicator": "IND-04", "gap_closure": 0.5},
        {"code": "SA1.2", "area": "SA1", "indicator": "IND-06", "gap_closure": 0.4},
        {"code": "SA1.3", "area": "SA1", "indicator": "IND-09", "gap_closure": 0.5},
        {"code": "SA1.4", "area": "SA1", "indicator": "IND-33", "gap_closure": 0.4},
        {"code": "SA2.1", "area": "SA2", "indicator": "IND-11", "gap_closure": 0.5},
        {"code": "SA2.2", "area": "SA2", "indicator": "IND-16", "gap_closure": 0.4},
        {"code": "SA2.3", "area": "SA2", "indicator": "IND-19", "gap_closure": 0.4},
        {"code": "SA3.1", "area": "SA3", "indicator": "IND-20", "gap_closure": 0.5},
        {"code": "SA3.2", "area": "SA3", "indicator": "IND-21", "gap_closure": 0.5},
        {"code": "SA3.3", "area": "SA3", "indicator": "IND-22", "gap_closure": 0.4},
        {"code": "SA4.1", "area": "SA4", "indicator": "IND-29", "gap_closure": 0.5},
        {"code": "SA4.2", "area": "SA4", "indicator": "IND-25", "gap_closure": 0.4},
    ],
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def next_labels(last: str, n: int) -> list[str]:
    """Labels of the n years after `last`: 2024 -> 2025..., t5 -> t6..., anything else -> '<last>+k'."""
    m = re.fullmatch(r"(.*?)(\d+)", str(last))
    if m:
        pre, num = m.group(1), int(m.group(2))
        return [f"{pre}{num + k}" for k in range(1, n + 1)]
    return [f"{last}+{k}" for k in range(1, n + 1)]


def progress_fraction(k: int, horizon: int, curve: str) -> float:
    t = min(1.0, max(0.0, k / horizon)) if horizon > 0 else 1.0
    if curve == "smoothstep":
        return t * t * (3 - 2 * t)
    if curve == "frontloaded":
        return 1 - (1 - t) ** 2
    return t


def _component_shares(comps, f, comp_ids):
    F = float(np.sum(f))
    xc = np.array(comps)
    return {c: (float(f[xc == c].sum()) / F if F > 0 else 0.0) for c in comp_ids}


def _component_means(comps, v, comp_ids):
    xc = np.array(comps)
    return {c: (float(v[xc == c].mean()) if (xc == c).any() else 0.0) for c in comp_ids}


def check_plan_params(horizon, growth, curve, pace, target_reduction, target):
    if not 1 <= int(horizon) <= MAX_HORIZON:
        raise A.AssessmentError(f"horizon must be between 1 and {MAX_HORIZON} years")
    if not -0.5 < float(growth) <= 2.0:
        raise A.AssessmentError("growth must be above -0.5 and at most 2.0 (a fraction per year)")
    if curve not in CURVES:
        raise A.AssessmentError(f"unknown curve '{curve}'; use one of {list(CURVES)}")
    if not 0.0 < float(pace) <= 1.0:
        raise A.AssessmentError("pace must be in (0, 1]")
    if target is None and not 0.0 < float(target_reduction) < 1.0:
        raise A.AssessmentError("target_reduction must be in (0, 1)")
    if target is not None and float(target) <= 0:
        raise A.AssessmentError("target must be positive")


# ---------------------------------------------------------------------------
# Projection
# ---------------------------------------------------------------------------

def _project(base, profile, horizon, growth, pace, response, keep_shares=False, detail=True):
    """Project `horizon` years from the base record entry. Returns a list of per-year dicts."""
    x = base["x"]
    d, a, w = x.delta, x.alpha, base["w"]
    F0 = base["F"]
    shares = base["f"] / F0 if F0 > 0 else np.full(len(d), 1.0 / len(d))
    cmap = dict(zip(x.codes, x.comps))
    rates = {c: tuple(v) for c, v in (profile.get("persistence") or {}).items()}
    prev = dict(zip(x.codes, base["acc"]))
    out = []
    for k in range(1, horizon + 1):
        F = F0 * (1.0 + growth) ** k
        if not keep_shares and F > 0:
            fopt, _ = kkt.optimum(d, a, w, F, response)
            shares = shares + pace * (fopt / F - shares)
        f = shares * F
        s = kkt.stress(d, f, a, response)
        fs = kkt.index(d, f, a, w, response)
        prev, acc = R.accumulated_step(prev, dict(zip(x.codes, s)), cmap, fs, rates)
        row = {"F": F, "fsfsi": fs, "fsfsi_acc": float(acc)}
        if detail:
            accv = np.array([prev[c] for c in x.codes])
            row.update(f=f, stress=s, acc=accv)
        out.append(row)
    return out


def _final_acc(base, profile, horizon, growth, pace, response):
    return _project(base, profile, horizon, growth, pace, response, detail=False)[-1]["fsfsi_acc"]


def required_growth(base, profile, horizon, pace, response, target):
    """Smallest constant envelope growth rate that brings the accumulated index to `target` by the last plan
    year (None if even the top of the search range does not)."""
    lo, hi = GROWTH_SEARCH
    if _final_acc(base, profile, horizon, hi, pace, response) > target:
        return None
    if _final_acc(base, profile, horizon, lo, pace, response) <= target:
        return lo
    for _ in range(60):
        mid = 0.5 * (lo + hi)
        if _final_acc(base, profile, horizon, mid, pace, response) <= target:
            hi = mid
        else:
            lo = mid
        if hi - lo < 1e-6:
            break
    return hi


def plan(profile, horizon=5, target_reduction=0.20, target=None, growth=0.05, curve="smoothstep", pace=1.0,
         weighting="hybrid", scenario=A.DEFAULT_SCENARIO, response="exponential", key=None, _rec=None):
    A.check_params(profile, weighting, scenario, response)
    check_plan_params(horizon, growth, curve, pace, target_reduction, target)
    horizon, growth, pace = int(horizon), float(growth), float(pace)
    rec = _rec or A.record(profile, weighting, scenario, response, key)
    base = rec[-1]
    x = base["x"]
    comp_ids = [c["id"] for c in profile["components"]]
    names = {c["id"]: c["name"] for c in profile["components"]}
    br = A.breaks_of(profile)
    acc0 = base["fsfsi_acc"]
    tgt = float(target) if target is not None else acc0 * (1.0 - float(target_reduction))
    labels = next_labels(x.year, horizon)

    path = _project(base, profile, horizon, growth, pace, response)
    bau = _project(base, profile, horizon, growth, pace, response, keep_shares=True)
    F0 = base["F"]

    years = []
    first_on_target = None
    for k, (p, b, lab) in enumerate(zip(path, bau, labels), start=1):
        yt = acc0 - (acc0 - tgt) * progress_fraction(k, horizon, curve)
        sh = _component_shares(x.comps, p["f"], comp_ids)
        st = _component_means(x.comps, p["stress"], comp_ids)
        ac = _component_means(x.comps, p["acc"], comp_ids)
        if first_on_target is None and p["fsfsi_acc"] <= tgt:
            first_on_target = lab
        years.append({
            "year": lab, "step": k, "envelope": p["F"], "additional": p["F"] - F0,
            "fsfsi": p["fsfsi"], "fsfsi_acc": p["fsfsi_acc"], "year_target": yt,
            "on_track": p["fsfsi_acc"] <= yt + 1e-12,
            "bau_fsfsi": b["fsfsi"], "bau_fsfsi_acc": b["fsfsi_acc"],
            "stress_class": R.classify(p["fsfsi"], br["system"]),
            "components": {c: {"share": sh[c], "stress": st[c], "acc_stress": ac[c]} for c in comp_ids},
        })

    base_sh = _component_shares(x.comps, base["f"], comp_ids)
    base_acc = _component_means(x.comps, base["acc"], comp_ids)
    base_st = _component_means(x.comps, base["stress"], comp_ids)
    last = path[-1]
    end_sh = _component_shares(x.comps, last["f"], comp_ids)
    end_acc = _component_means(x.comps, last["acc"], comp_ids)
    bau_acc = _component_means(x.comps, bau[-1]["acc"], comp_ids)
    comp_rows = []
    for c in comp_ids:
        b0 = base_acc[c]
        comp_rows.append({
            "id": c, "name": names[c], "share": base_sh[c], "end_share": end_sh[c],
            "shift_pp": (end_sh[c] - base_sh[c]) * 100.0, "stress": base_st[c], "acc_stress": b0,
            "end_acc_stress": end_acc[c], "bau_end_acc_stress": bau_acc[c],
            "change_pct": ((end_acc[c] - b0) / b0 * 100.0) if b0 > 0 else 0.0,
            "end_class": R.classify(end_acc[c], br["component"]),
        })

    rg = required_growth(base, profile, horizon, pace, response, tgt)
    final = last["fsfsi_acc"]
    out = {
        "country_id": profile.get("id", ""), "weighting": weighting, "scenario": scenario, "response": response,
        "params": {"horizon": horizon, "growth": growth, "curve": curve, "pace": pace,
                   "target_reduction": (1.0 - tgt / acc0) if acc0 > 0 else 0.0},
        "base": {"year": x.year, "fsfsi": base["fsfsi"], "fsfsi_acc": acc0, "envelope": F0,
                 "efficiency": base["E"]},
        "target": tgt,
        "summary": {
            "final_fsfsi": last["fsfsi"], "final_fsfsi_acc": final,
            "bau_final_fsfsi_acc": bau[-1]["fsfsi_acc"],
            "reduction": (acc0 - final) / acc0 if acc0 > 0 else 0.0,
            "bau_reduction": (acc0 - bau[-1]["fsfsi_acc"]) / acc0 if acc0 > 0 else 0.0,
            "reached": final <= tgt + 1e-12, "first_year_on_target": first_on_target,
            "years_on_track": sum(1 for y in years if y["on_track"]),
            "cumulative_additional": float(sum(p["F"] - F0 for p in path)),
            "final_envelope": last["F"], "required_growth": rg,
            "composition_gain": bau[-1]["fsfsi_acc"] - final,
            "residual_high": [r["id"] for r in comp_rows if r["end_class"] in ("high", "critical")],
        },
        "years": years,
        "components": comp_rows,
        "assumptions": [
            "Gaps, sensitivities and weights stay at their latest-year values.",
            "The envelope grows at a constant rate from the latest year.",
            "Each year the composition closes the stated share (pace) of its distance to that year's optimum.",
            "Accumulated stress follows the profile's persistence rates.",
        ],
    }
    return A.finite(out)


# ---------------------------------------------------------------------------
# Strategy alignment
# ---------------------------------------------------------------------------

def strategy_of(profile) -> dict:
    s = profile.get("strategy") or DEMO_STRATEGY
    comp_ids = [c["id"] for c in profile["components"]]
    seen = {}
    for ar in s.get("areas", []):
        for c in ar.get("components", []):
            if c in seen:
                raise A.AssessmentError(f"strategy: component {c} is in two priority areas")
            seen[c] = ar["code"]
    tot = sum(float(ar.get("target_share", 0)) for ar in s.get("areas", []))
    if not s.get("areas") or tot <= 0:
        raise A.AssessmentError("strategy needs priority areas with positive target shares")
    s = dict(s)
    s["_area_of"] = {c: seen.get(c) for c in comp_ids}
    s["_target_total"] = tot
    return s


def area_shares(strategy, comp_shares: dict) -> dict:
    out = {ar["code"]: 0.0 for ar in strategy["areas"]}
    for c, v in comp_shares.items():
        code = strategy["_area_of"].get(c)
        if code:
            out[code] += v
    return out


def alignment_score(strategy, shares: dict) -> float:
    """1 minus the total-variation distance between the area split and the target split (both over the money
    mapped to the strategy): the share of that money already where the strategy puts it."""
    tot_t = strategy["_target_total"]
    tot_s = sum(shares.values())
    if tot_s <= 0:
        return 0.0
    tv = 0.5 * sum(abs(shares[ar["code"]] / tot_s - float(ar["target_share"]) / tot_t) for ar in strategy["areas"])
    return float(max(0.0, 1.0 - tv))


def strategy_optimum(strategy, base, response):
    """Best allocation that respects the target area split: the optimum within each area for its target money."""
    x = base["x"]
    d, a, w, F = x.delta, x.alpha, base["w"], base["F"]
    f = np.zeros(len(d))
    xc = np.array(x.comps)
    present = [ar for ar in strategy["areas"] if np.isin(xc, ar["components"]).any()]
    tot_t = sum(float(ar["target_share"]) for ar in present) or 1.0
    mapped = np.array([strategy["_area_of"].get(c) is not None for c in x.comps])
    F_unmapped = float(base["f"][~mapped].sum())
    f[~mapped] = base["f"][~mapped]
    F_mapped = F - F_unmapped
    for ar in present:
        m = np.isin(xc, ar["components"])
        Fa = F_mapped * float(ar["target_share"]) / tot_t
        fa, _ = kkt.optimum(d[m], a[m], w[m], Fa, response)
        f[m] = fa
    return f


def _observed(profile, yi, code):
    iy = profile["years"][yi]["indicators"].get(code)
    if not iy:
        return None, None
    return iy.get("observed"), iy.get("benchmark")


def track_targets(profile, strategy, rec, br):
    years = [y["year"] for y in profile["years"]]
    start = strategy.get("start")
    si = years.index(start) if start in years else (1 if len(years) > 1 else 0)
    periods = int(strategy.get("periods") or 6)
    li = len(years) - 1
    elapsed = li - si
    expected_frac = min(1.0, max(0.0, elapsed / periods)) if periods > 0 else 1.0
    target_year = next_labels(years[si], periods)[-1] if periods > 0 else years[si]
    ind = {i["code"]: i for i in profile["indicators"]}
    last = rec[-1]
    lx = last["x"]
    pos = {c: k for k, c in enumerate(lx.codes)}
    rows = []
    for t in strategy.get("targets", []):
        code = t["indicator"]
        meta = ind.get(code)
        if meta is None:
            continue
        b0, bench = _observed(profile, si, code)
        cur, bench_l = _observed(profile, li, code)
        bench = bench_l if bench_l is not None else bench
        row = {"code": t["code"], "area": t["area"], "indicator": code, "name": t.get("name") or meta["name"],
               "component": meta["component"], "direction": meta["direction"], "unit": meta.get("unit"),
               "baseline": b0, "current": cur, "benchmark": bench, "target": None, "expected": None,
               "progress": None, "expected_progress": expected_frac, "status": "no_data",
               "stress": None, "diagnosis": None}
        if code in pos:
            k = pos[code]
            row["stress"] = float(last["stress"][k])
            row["diagnosis"] = R.diagnose(float(lx.delta[k]), float(last["stress"][k]), br["indicator"], br["coverage"])
        if b0 is not None and bench is not None:
            b0 = float(b0)
            if t.get("target_value") is not None:
                tv = float(t["target_value"])
            else:
                tv = b0 + float(t.get("gap_closure", 0.5)) * (float(bench) - b0)
            row["target"] = tv
            row["expected"] = b0 + expected_frac * (tv - b0)
            if cur is not None:
                cur = float(cur)
                span = tv - b0
                if abs(span) < 1e-12:
                    prog = 1.0
                else:
                    prog = (cur - b0) / span
                row["progress"] = prog
                if prog >= 1.0 - 1e-9:
                    row["status"] = "achieved"
                elif prog >= expected_frac - 1e-9:
                    row["status"] = "on_track"
                elif prog > 0:
                    row["status"] = "behind"
                else:
                    row["status"] = "off_track"
        rows.append(row)
    return {"start": years[si], "target_year": target_year, "periods": periods, "elapsed": elapsed,
            "latest": years[li], "expected_progress": expected_frac, "targets": rows}


def strategy_report(profile, weighting="hybrid", scenario=A.DEFAULT_SCENARIO, response="exponential", key=None,
                    plan_params: dict | None = None):
    A.check_params(profile, weighting, scenario, response)
    strat = strategy_of(profile)
    rec = A.record(profile, weighting, scenario, response, key)
    base = rec[-1]
    x = base["x"]
    br = A.breaks_of(profile)
    comp_ids = [c["id"] for c in profile["components"]]
    names = {c["id"]: c["name"] for c in profile["components"]}
    d, a, w, F = x.delta, x.alpha, base["w"], base["F"]

    pl = plan(profile, weighting=weighting, scenario=scenario, response=response, key=key, _rec=rec,
              **(plan_params or {}))
    plan_end_comp = pl["years"][-1]["components"]

    f_strat = strategy_optimum(strat, base, response)
    fs_strat = kkt.index(d, f_strat, a, w, response)
    fs_act, fs_opt = base["fsfsi"], base["fsfsi_opt"]

    act_c = _component_shares(x.comps, base["f"], comp_ids)
    opt_c = _component_shares(x.comps, base["fopt"], comp_ids)
    str_c = _component_shares(x.comps, f_strat, comp_ids)
    plan_c = {c: plan_end_comp[c]["share"] for c in comp_ids}
    act_a, opt_a, plan_a = area_shares(strat, act_c), area_shares(strat, opt_c), area_shares(strat, plan_c)

    acc_now = _component_means(x.comps, base["acc"], comp_ids)
    plan_comp = {r["id"]: r for r in pl["components"]}
    tracking = track_targets(profile, strat, rec, br)
    tot_t = strat["_target_total"]
    areas = []
    for ar in strat["areas"]:
        code = ar["code"]
        cs = [c for c in ar["components"] if c in comp_ids]
        n_ind = int(np.isin(np.array(x.comps), cs).sum())
        mean = lambda dct: float(np.mean([dct[c] for c in cs])) if cs else 0.0  # noqa: E731
        tg = [t for t in tracking["targets"] if t["area"] == code]
        areas.append({
            "code": code, "name": ar["name"], "description": ar.get("description", ""),
            "components": [{"id": c, "name": names[c]} for c in cs], "n_indicators": n_ind,
            "target_share": float(ar["target_share"]) / tot_t,
            "actual_share": act_a[code], "optimal_share": opt_a[code], "plan_share": plan_a[code],
            "deviation_pp": (act_a[code] - float(ar["target_share"]) / tot_t) * 100.0,
            "acc_stress": mean(acc_now),
            "plan_end_acc_stress": mean({c: plan_comp[c]["end_acc_stress"] for c in cs}),
            "bau_end_acc_stress": mean({c: plan_comp[c]["bau_end_acc_stress"] for c in cs}),
            "targets": len(tg),
            "targets_on_track": sum(1 for t in tg if t["status"] in ("on_track", "achieved")),
        })
        a_ = areas[-1]
        a_["plan_reduction_pct"] = ((a_["acc_stress"] - a_["plan_end_acc_stress"]) / a_["acc_stress"] * 100.0
                                    if a_["acc_stress"] > 0 else 0.0)

    history = []
    for c in rec:
        sh = area_shares(strat, _component_shares(c["x"].comps, c["f"], comp_ids))
        history.append({"year": c["x"].year, "alignment": alignment_score(strat, sh), "shares": sh})

    unmapped = [c for c in comp_ids if strat["_area_of"].get(c) is None]
    out = {
        "country_id": profile.get("id", ""), "year": x.year, "weighting": weighting, "scenario": scenario,
        "response": response,
        "strategy": {"name": strat.get("name", "National strategy"), "source": strat.get("source", "country"),
                     "description": strat.get("description", ""), "unmapped_components": unmapped},
        "alignment": {
            "actual": alignment_score(strat, act_a), "optimum": alignment_score(strat, opt_a),
            "plan": alignment_score(strat, plan_a),
        },
        "index": {
            "actual": fs_act, "optimum": fs_opt, "strategy_optimum": fs_strat,
            "efficiency_actual": base["E"],
            "efficiency_strategy": float(min(1.0, fs_opt / fs_strat)) if fs_strat > 0 else 1.0,
            "strategy_gain": fs_act - fs_strat,
            "strategy_cost": fs_strat - fs_opt,
        },
        "areas": areas,
        "history": history,
        "tracking": tracking,
        "plan": {"params": pl["params"], "target": pl["target"], "summary": pl["summary"],
                 "end_year": pl["years"][-1]["year"]},
    }
    return A.finite(out)
