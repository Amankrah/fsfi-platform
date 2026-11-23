"""External investor programmes.

A development partner or private investor brings money outside the national envelope and earmarks it for chosen
indicators or components. The programme is scored three ways:

1. Latest year: the index with and without the programme's yearly amount added to the actual allocation, against
   the best use of the same money anywhere in the system and the best use within the programme's own selection
   (value for money = reduction achieved / best reduction).
2. Over the plan: the accumulated index of the national plan alone and of the plan with the programme on top, for
   the years the programme disburses (it stops afterwards and its effect decays at the persistence rates).
3. Against the national strategy: where the programme's money lands across the priority areas, and how much of it
   goes to areas the national budget leaves below their target share.

The best addition on top of an allocation f has a closed form: with the exponential response,
delta e^{-alpha (f + x)} = (delta e^{-alpha f}) e^{-alpha x}; with the hyperbolic response,
delta / (1 + alpha (f + x)) = delta' / (1 + alpha' x) with delta' = delta / (1 + alpha f), alpha' = alpha / (1 + alpha f).
Either way it is the KKT optimum (Eq. kkt) of the residual problem.
"""
from __future__ import annotations

import numpy as np

from . import assessment as A
from . import planning as PL
from .engine import kkt
from .engine import reference as R

SPLITS = ("equal", "best")


def best_addition(delta, f, alpha, w, amount, mask, response="exponential"):
    """Stress-minimising split of `amount` over the indicators in `mask`, on top of allocation f."""
    x = np.zeros(len(delta))
    if amount <= 0 or not mask.any():
        return x
    if response == "hyperbolic":
        k = 1.0 + alpha * f
        d2, a2 = delta / k, alpha / k
    else:
        d2, a2 = delta * np.exp(-alpha * f), alpha
    xm, _ = kkt.optimum(d2[mask], a2[mask], w[mask], amount, response)
    x[mask] = xm
    return x


def _split(delta, f, alpha, w, amount, mask, split, response):
    if split == "best":
        return best_addition(delta, f, alpha, w, amount, mask, response)
    x = np.zeros(len(delta))
    n = int(mask.sum())
    if n:
        x[mask] = amount / n
    return x


def investment(profile, indicators=None, components=None, amount=0.0, years=None, split="equal", name="",
               weighting="hybrid", scenario=A.DEFAULT_SCENARIO, response="exponential", key=None,
               plan_params: dict | None = None):
    A.check_params(profile, weighting, scenario, response)
    if split not in SPLITS:
        raise A.AssessmentError(f"unknown split '{split}'; use one of {list(SPLITS)}")
    amount = float(amount or 0.0)
    if amount <= 0:
        raise A.AssessmentError("amount must be positive (money added per year)")
    pp = dict(PL.PLAN_DEFAULTS)
    pp.update({k: v for k, v in (plan_params or {}).items() if v is not None})
    horizon = int(pp.get("horizon", 5))
    years = horizon if years is None else int(years)
    if not 1 <= years <= horizon:
        raise A.AssessmentError(f"years must be between 1 and the plan horizon ({horizon})")

    rec = A.record(profile, weighting, scenario, response, key)
    base = rec[-1]
    x = base["x"]
    d, a, w, f, F = x.delta, x.alpha, base["w"], base["f"], base["F"]
    codes = np.array(x.codes)
    comps = np.array(x.comps)
    sel_codes = set(indicators or [])
    sel_comps = set(components or [])
    unknown = sel_codes - set(x.codes)
    if unknown:
        raise A.AssessmentError(f"indicators not assessed in {x.year}: {sorted(unknown)}")
    comp_ids = [c["id"] for c in profile["components"]]
    bad = sel_comps - set(comp_ids)
    if bad:
        raise A.AssessmentError(f"unknown components: {sorted(bad)}")
    mask = np.isin(codes, list(sel_codes)) | np.isin(comps, list(sel_comps))
    if not mask.any():
        raise A.AssessmentError("select at least one indicator or component")
    br = A.breaks_of(profile)
    names = {c["id"]: c["name"] for c in profile["components"]}

    # 1. latest year
    add = _split(d, f, a, w, amount, mask, split, response)
    add_best_any = best_addition(d, f, a, w, amount, np.ones(len(d), bool), response)
    add_best_sel = best_addition(d, f, a, w, amount, mask, response)
    fs0 = base["fsfsi"]
    fs1 = kkt.index(d, f + add, a, w, response)
    fs_any = kkt.index(d, f + add_best_any, a, w, response)
    fs_sel = kkt.index(d, f + add_best_sel, a, w, response)
    # the same money given to the national budget in today's proportions
    fs_prop = kkt.index(d, f * (1 + amount / F), a, w, response) if F > 0 else fs0
    s0 = kkt.stress(d, f, a, response)
    s1 = kkt.stress(d, f + add, a, response)
    red, red_any, red_sel = fs0 - fs1, fs0 - fs_any, fs0 - fs_sel

    ind_rows = []
    for i in range(len(d)):
        if add[i] <= 0 and add_best_any[i] <= 1e-12 and not mask[i]:
            continue
        ind_rows.append({
            "code": x.codes[i], "name": x.names[i], "component": x.comps[i], "selected": bool(mask[i]),
            "added": float(add[i]), "best_added": float(add_best_any[i]), "allocation": float(f[i]),
            "gap": float(d[i]), "stress": float(s0[i]), "stress_with": float(s1[i]),
            "reduction": float(w[i] * (s0[i] - s1[i])),
            "diagnosis": R.diagnose(float(d[i]), float(s0[i]), br["indicator"], br["coverage"]),
        })
    ind_rows.sort(key=lambda r: -r["reduction"])
    comp_rows = []
    for c in comp_ids:
        m = comps == c
        if not m.any():
            continue
        comp_rows.append({
            "id": c, "name": names[c], "added": float(add[m].sum()), "best_added": float(add_best_any[m].sum()),
            "stress": float(s0[m].mean()), "stress_with": float(s1[m].mean()),
            "reduction": float(np.sum(w[m] * (s0[m] - s1[m]))),
        })

    # 2. over the plan
    plan = PL.plan(profile, weighting=weighting, scenario=scenario, response=response, key=key, _rec=rec,
                   **{k: pp[k] for k in ("horizon", "target_reduction", "target", "growth", "curve", "pace") if k in pp})
    prm = plan["params"]
    labels = [y["year"] for y in plan["years"]]

    def extra(k, f_t):
        if k > years:
            return np.zeros(len(d))
        return _split(d, f_t, a, w, amount, mask, split, response)

    alone = PL._project(base, profile, prm["horizon"], prm["growth"], prm["pace"], response, detail=False)
    withp = PL._project(base, profile, prm["horizon"], prm["growth"], prm["pace"], response, detail=False,
                        extra=extra)
    tgt = plan["target"]
    path, first_with = [], None
    for k, (lab, p0, p1, py) in enumerate(zip(labels, alone, withp, plan["years"]), start=1):
        if first_with is None and p1["fsfsi_acc"] <= tgt + 1e-12:
            first_with = lab
        path.append({"year": lab, "step": k, "disbursed": amount if k <= years else 0.0,
                     "plan_fsfsi": p0["fsfsi"], "with_fsfsi": p1["fsfsi"],
                     "plan_acc": p0["fsfsi_acc"], "with_acc": p1["fsfsi_acc"], "year_target": py["year_target"]})
    end0, end1 = alone[-1]["fsfsi_acc"], withp[-1]["fsfsi_acc"]

    # 3. against the strategy
    strat = PL.strategy_of(profile)
    prog_c = {c: float(add[comps == c].sum()) for c in comp_ids}
    prog_a = PL.area_shares(strat, prog_c)
    act_a = PL.area_shares(strat, PL._component_shares(x.comps, f, comp_ids))
    tot_t = strat["_target_total"]
    areas, under = [], 0.0
    for ar in strat["areas"]:
        code = ar["code"]
        t = float(ar["target_share"]) / tot_t
        sh = prog_a[code] / amount
        dev = (act_a[code] - t) * 100.0
        if dev < 0:
            under += sh
        areas.append({"code": code, "name": ar["name"], "programme_share": sh, "target_share": t,
                      "actual_share": act_a[code], "deviation_pp": dev,
                      "actual_share_with": (act_a[code] * F + prog_a[code]) / (F + amount)})
    al_before = PL.alignment_score(strat, act_a)
    al_after = PL.alignment_score(strat, {k: act_a[k] * F + prog_a[k] for k in act_a})

    out = {
        "country_id": profile.get("id", ""), "year": x.year, "weighting": weighting, "scenario": scenario,
        "response": response,
        "programme": {"name": name or "Investor programme", "split": split, "amount": amount, "years": years,
                      "total": amount * years, "n_indicators": int(mask.sum()),
                      "indicators": [str(c) for c in codes[mask]], "components": sorted(sel_comps),
                      "share_of_envelope": amount / F if F > 0 else 0.0},
        "snapshot": {
            "fsfsi": fs0, "fsfsi_with": fs1, "reduction": red, "reduction_pct": red / fs0 if fs0 > 0 else 0.0,
            "best_any": fs_any, "best_selection": fs_sel, "national_proportional": fs_prop,
            "value_for_money": red / red_any if red_any > 0 else 0.0,
            "value_within_selection": red / red_sel if red_sel > 0 else 0.0,
            "vs_national": (red / (fs0 - fs_prop)) if fs0 - fs_prop > 0 else 0.0,
            "reduction_per_100": red / amount * 100.0,
            "stress_class": R.classify(fs0, br["system"]), "stress_class_with": R.classify(fs1, br["system"]),
        },
        "indicators": ind_rows,
        "components": comp_rows,
        "plan": {"params": prm, "target": tgt, "end_year": labels[-1], "plan_end": end0, "with_end": end1,
                 "additional_reduction": end0 - end1, "plan_reached": end0 <= tgt + 1e-12,
                 "with_reached": end1 <= tgt + 1e-12, "first_year_with": first_with,
                 "first_year_plan": plan["summary"]["first_year_on_target"], "path": path},
        "strategy": {"name": strat.get("name", "National strategy"), "areas": areas,
                     "under_target_share": under, "alignment_before": al_before, "alignment_after": al_after},
    }
    return A.finite(out)
