"""Apply an assignment rule set to budget lines (port of the public mapping/mapper.py).

Deterministic: no statistical or generative model takes part.

    load_rules(path)            the rule set (default: rules_generic.json beside this file, plus the platform's
                                sub-programme rules in rules_platform.json for indicators that the generic
                                phrase rules do not reach)
    classify(line, rules)       first pass on one line -> (target, rule id, stage)
    map_lines(lines, rules)     full assignment with the pro-rata apportionment of overhead and the residual stage

A line is a dict with: row, fy (fiscal year), agency (code, any hashable), subprog (sub-programme name),
line (text), tag (budget tag), w (amount).
"""
import json
import re
from functools import lru_cache
from pathlib import Path

HERE = Path(__file__).resolve().parent


def norm(s):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", str(s).lower())).strip()


def load_rules(path=None, with_examples=True, platform=True):
    d = json.loads(Path(path or HERE / "rules_generic.json").read_text(encoding="utf-8"))
    st = {k: [(r["id"], r["target"], re.compile(r["pattern"])) for r in v] for k, v in d["stages"].items()}
    ex = d.get("example_withheld_stages", {}) if with_examples else {}
    pre, sub, agy = list(ex.get("PRE", [])), list(ex.get("SUB", [])), dict(ex.get("AGY", {}))
    if platform and (HERE / "rules_platform.json").exists():
        p = json.loads((HERE / "rules_platform.json").read_text(encoding="utf-8"))
        pre += p.get("PRE", [])
        sub += p.get("SUB", [])
        agy.update(p.get("AGY", {}))
    st["PRE"] = [(r["id"], r["target"], re.compile(r["pattern"]), set(str(a) for a in (r.get("agencies") or [])) or None,
                  re.compile(r["subprogramme_pattern"]) if r.get("subprogramme_pattern") else None) for r in pre]
    st["SUB"] = [(r["id"], r["target"], re.compile(r["pattern"])) for r in sub]
    st["AGY"] = {str(k): (v["id"], v["target"]) for k, v in agy.items()}
    st["RES_DEFAULT"] = (d["residual_default"]["id"], d["residual_default"]["target"])
    st["ORDER"] = d["order"]
    return st


@lru_cache(maxsize=1)
def default_rules():
    return load_rules()


def _sub_or_agency(line, R, allow_oh=True):
    sp = norm(line["subprog"])
    for rid, t, rx in R["SUB"]:
        if rx.search(sp) and (allow_oh or t != "OH"):
            return t, rid, "SUB"
    a = R["AGY"].get(str(line["agency"]))
    if a and (allow_oh or a[1] != "OH"):
        return a[1], a[0], "AGY"
    return None


def residual(line, R):
    tag = norm(line["tag"])
    for rid, t, rx in R["RES"]:
        if rx.search(tag):
            return t, rid
    return R["RES_DEFAULT"][1], R["RES_DEFAULT"][0]


def classify(line, R):
    txt, sp = norm(line["line"]), norm(line["subprog"])
    for rid, t, rx, ag, sprx in R["PRE"]:
        if ag is not None and str(line["agency"]) not in ag:
            continue
        if sprx is not None and not sprx.search(sp):
            continue
        if rx.search(txt):
            return t, rid, "PRE"
    for stage in ("OHS", "DICT_ROADS", "DICT", "LATE"):
        for rid, t, rx in R[stage]:
            if rx.search(txt):
                return t, rid, stage
    hit = _sub_or_agency(line, R)
    if hit:
        return hit
    t, rid = residual(line, R)
    return t, rid, "RES"


def _shares(money):
    tot = sum(v for v in (money or {}).values() if v > 0)
    return {k: v / tot for k, v in sorted(money.items()) if v > 0} if tot > 0 else None


def map_lines(lines, R=None):
    """One record per line: row, indicator (largest share), alloc ({indicator: share}), np_share, rule, stage,
    cls (specific, overhead, overhead_no_pathway, no_pathway, residual)."""
    R = R or default_rules()
    first = {x["row"]: classify(x, R) for x in lines}
    g3, g2, g1 = {}, {}, {}
    for x in sorted(lines, key=lambda z: z["row"]):
        t = first[x["row"]][0]
        if t == "OH":
            continue
        for g, k in ((g3, (x["agency"], norm(x["subprog"]), x["fy"])), (g2, (x["agency"], x["fy"])), (g1, x["agency"])):
            d = g.setdefault(k, {})
            d[t] = d.get(t, 0.0) + x["w"]
    out = []
    for x in lines:
        t, rid, stage = first[x["row"]]
        res_ind, res_rid = residual(x, R)
        if t == "OH":
            sh, how = None, None
            for g, k, h in ((g3, (x["agency"], norm(x["subprog"]), x["fy"]), "sub-programme-year"),
                            (g2, (x["agency"], x["fy"]), "agency-year"), (g1, x["agency"], "agency")):
                sh = _shares(g.get(k))
                if sh:
                    how = h
                    break
            if sh is None:
                hit = _sub_or_agency(x, R, allow_oh=False)
                sh, how = ({hit[0]: 1.0}, hit[1]) if hit else ({"NP": 1.0}, "none")
            np_share = sh.get("NP", 0.0)
            alloc = {}
            for k, v in sh.items():
                k2 = res_ind if k == "NP" else k
                alloc[k2] = alloc.get(k2, 0.0) + v
            cls = "overhead" if np_share < 1.0 else "overhead_no_pathway"
            rid = "%s>OH:%s" % (rid, how) + (">%s" % res_rid if np_share > 0 else "")
        elif t == "NP":
            alloc, np_share, cls = {res_ind: 1.0}, 1.0, "no_pathway"
            rid = "%s>%s" % (rid, res_rid)
        else:
            alloc, np_share = {t: 1.0}, 0.0
            cls = "residual" if stage == "RES" else "specific"
        top = sorted(alloc.items(), key=lambda kv: (-kv[1], kv[0]))[0][0]
        out.append(dict(row=x["row"], indicator=top, alloc=alloc, np_share=np_share, rule=rid, stage=stage, cls=cls))
    return out


def read_budget(path=None):
    """The synthetic budget beside this file, as line dicts plus the expected assignment of each row."""
    import csv
    lines, expected = [], {}
    with open(path or HERE / "synthetic_budget.csv", encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            row = int(r["row"])
            lines.append(dict(row=row, fy=r["year"], agency=int(r["agency"]), subprog=r["sub_programme"], line=r["line"],
                              tag=r["budget_tag"], w=float(r["amount"])))
            expected[row] = (r["expected_indicator"], r["expected_class"], r["expected_rule"])
    return lines, expected
