"""Budget-line mapping service: runs the deterministic rule set and summarises the result."""
from __future__ import annotations

import csv
import io

from . import mapper

CSV_COLUMNS = ["year", "agency", "sub_programme", "line", "budget_tag", "amount"]


def _line_class(cls: str | None):
    if cls is None:
        return None
    return "specific" if cls == "specific" else "supportive"


def run_mapping(lines: list[dict], indicator_component: dict[str, str], rules=None) -> dict:
    """lines: dicts with year, agency, sub_programme, line, budget_tag, amount (and optional id).
    Returns a MappingResult (lines with assignment + summary)."""
    R = rules or mapper.default_rules()
    raw = []
    for k, ln in enumerate(lines):
        raw.append(dict(row=int(ln.get("id") or k + 1), fy=str(ln["year"]), agency=str(ln["agency"]),
                        subprog=str(ln.get("sub_programme") or ""), line=str(ln.get("line") or ""),
                        tag=str(ln.get("budget_tag") or ""), w=float(ln["amount"])))
    mapped = {m["row"]: m for m in mapper.map_lines(raw, R)}
    out_lines, by_ind, by_comp, by_stage = [], {}, {}, {}
    unassigned = no_pathway = total = 0.0
    for x in raw:
        m = mapped[x["row"]]
        ind = m["indicator"]
        comp = indicator_component.get(ind)
        out_lines.append({"id": x["row"], "year": x["fy"], "agency": x["agency"], "sub_programme": x["subprog"],
                          "line": x["line"], "budget_tag": x["tag"], "amount": x["w"],
                          "indicator": ind if comp else None, "component": comp,
                          "line_class": _line_class(m["cls"]), "rule": m["rule"], "stage": m["stage"],
                          "mapping_class": m["cls"]})
        total += x["w"]
        no_pathway += x["w"] * m["np_share"]
        st = by_stage.setdefault(m["stage"], {"lines": 0, "amount": 0.0})
        st["lines"] += 1
        st["amount"] += x["w"]
        for k, share in m["alloc"].items():
            amt = x["w"] * share
            c = indicator_component.get(k)
            if c is None:
                unassigned += amt
                continue
            by_ind[k] = by_ind.get(k, 0.0) + amt
            by_comp[c] = by_comp.get(c, 0.0) + amt
    return {"lines": out_lines,
            "summary": {"by_indicator": dict(sorted(by_ind.items())), "by_component": by_comp, "by_stage": by_stage,
                        "unassigned_amount": unassigned, "no_pathway_amount": no_pathway, "total_amount": total}}


def parse_budget_csv(text: str) -> list[dict]:
    rdr = csv.DictReader(io.StringIO(text.lstrip("\ufeff")))
    if rdr.fieldnames is None:
        raise ValueError("empty CSV")
    cols = [c.strip().lower() for c in rdr.fieldnames]
    missing = [c for c in CSV_COLUMNS if c not in cols]
    if missing:
        raise ValueError(f"missing columns: {missing}; expected {CSV_COLUMNS}")
    out = []
    for i, r in enumerate(rdr, start=1):
        r = {k.strip().lower(): (v or "").strip() for k, v in r.items() if k}
        if not any(r.values()):
            continue
        try:
            amt = float(r["amount"].replace(",", ""))
        except ValueError:
            raise ValueError(f"row {i}: amount '{r['amount']}' is not a number")
        out.append({"id": i, "year": r["year"], "agency": r["agency"], "sub_programme": r["sub_programme"],
                    "line": r["line"], "budget_tag": r["budget_tag"], "amount": amt})
    return out


def template_csv() -> str:
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(CSV_COLUMNS)
    w.writerow(["t0", "Agriculture & Livestock", "Crop intensification", "Fertiliser subsidy for smallholders",
                "agricultural development", "120.5"])
    w.writerow(["t0", "Infrastructure & Transport", "Rural access", "Construction of feeder roads", "infrastructure",
                "340"])
    w.writerow(["t0", "Health & Nutrition", "Child nutrition", "Stunting reduction and micronutrient supplements",
                "nutrition", "85.25"])
    w.writerow(["t0", "Agriculture & Livestock", "Crop intensification", "Staff salaries", "agricultural development",
                "30"])
    return buf.getvalue()
