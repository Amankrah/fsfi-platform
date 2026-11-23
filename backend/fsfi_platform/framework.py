"""The reference framework: eight components and 37 indicators.

Component order follows method_parameters.json (the order of the expert and dependency matrices).
Indicator codes IND-01..IND-37 follow the targets of the mapping rule set (rules_generic.json), e.g. IND-03
fertilizer use (rule D03-FERT), IND-16 share of production marketed (transport and market infrastructure,
rules D16-TRANSPORT / D16-MARKET), IND-20 stunting (child nutrition, WASH and health rules).
"""
from __future__ import annotations

import copy
import csv
import json
import re
from functools import lru_cache
from pathlib import Path

from .engine import reference as R

HERE = Path(__file__).resolve().parent

COMPONENT_ORDER = list(R.COMPONENTS)

COMPONENT_META = {
    "markets": ("Markets", "Markets"),
    "crop_production": ("Crop production", "Crops"),
    "nutrition": ("Nutrition", "Nutrition"),
    "research": ("Research & extension", "Research"),
    "post_harvest": ("Post-harvest", "Post-harvest"),
    "environment": ("Environment", "Environment"),
    "animal_systems": ("Animal systems", "Animal"),
    "finance": ("Finance", "Finance"),
}

COMPONENTS = [{"id": c, "name": COMPONENT_META[c][0], "short": COMPONENT_META[c][1]} for c in COMPONENT_ORDER]

# code -> indicator name as in data/indicators.csv
CODE_TO_NAME = {
    "IND-01": "Cereal yield (t/ha)",
    "IND-02": "Irrigated land (%)",
    "IND-03": "Fertilizer use (kg/ha)",
    "IND-04": "Improved seed adoption (%)",
    "IND-05": "Crop diversification index",
    "IND-06": "Milk yield per cow",
    "IND-07": "Meat productivity (kg/head)",
    "IND-08": "Improved breed share (%)",
    "IND-09": "Animal mortality rate (%)",
    "IND-10": "Protein availability (g/day)",
    "IND-11": "Post-harvest loss (%)",
    "IND-12": "Storage capacity (MT)",
    "IND-13": "Cold chain coverage (%)",
    "IND-14": "Share processed exports (%)",
    "IND-15": "Food safety certification (%)",
    "IND-16": "Share of production marketed (%)",
    "IND-17": "Export revenue",
    "IND-18": "Price volatility index",
    "IND-19": "Cooperative participation (%)",
    "IND-20": "Stunting rate (%)",
    "IND-21": "Food insecurity (%)",
    "IND-22": "Dietary diversity score",
    "IND-23": "Protein adequacy (g/day)",
    "IND-24": "Food self-sufficiency (%)",
    "IND-25": "Farmers with credit (%)",
    "IND-26": "Ag credit share (%)",
    "IND-27": "Insured farmers (%)",
    "IND-28": "Mobile finance penetration (%)",
    "IND-29": "Farmers receiving extension (%)",
    "IND-30": "R&D spending (% ag GDP)",
    "IND-31": "Mechanization rate (%)",
    "IND-32": "CSA adoption (%)",
    "IND-33": "Land under conservation (%)",
    "IND-34": "Soil erosion risk (%)",
    "IND-35": "GHG intensity",
    "IND-36": "Irrigation water efficiency (%)",
    "IND-37": "Disaster-affected land (ha)",
}

UNIT_OVERRIDES = {"IND-06": "litres/cow/year", "IND-05": "index (0-1)", "IND-17": "DU m", "IND-18": "index",
                  "IND-22": "score (0-10)", "IND-35": "kg CO2e/kg"}


def _unit(name: str, code: str) -> str | None:
    if code in UNIT_OVERRIDES:
        return UNIT_OVERRIDES[code]
    m = re.search(r"\(([^)]*)\)\s*$", name)
    return m.group(1) if m else None


def _load_indicators():
    rows = {}
    with open(HERE / "data" / "indicators.csv", encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            rows[r["name"]] = r
    out = []
    for code, name in CODE_TO_NAME.items():
        r = rows[name]
        out.append({
            "code": code,
            "name": name,
            "component": r["component"],
            "direction": "higher" if r["direction"].startswith("higher") else "lower",
            "unit": _unit(name, code),
            "benchmark_type": r["benchmark_type"],
        })
    return out


INDICATORS = _load_indicators()
INDICATOR_BY_CODE = {i["code"]: i for i in INDICATORS}


def defaults() -> dict:
    P = R.PARAMS
    return {
        "ahp_matrix": copy.deepcopy(P["ahp_matrices"]["normal_operations"]),
        "ahp_matrices": copy.deepcopy(P["ahp_matrices"]),
        "dependency_matrices": copy.deepcopy(P["dependency_matrices"]),
        "hybrid_coefficients": dict(P["hybrid_coefficients"]),
        "persistence": {k: list(v) for k, v in P["persistence"].items()},
        "breaks": {k: list(v) for k, v in P["cut_points_published"].items()},
        "sensitivities": default_sensitivities(),
    }


@lru_cache(maxsize=1)
def _alpha_f0() -> dict:
    cal = json.loads((HERE / "data" / "calibration_demo.json").read_text(encoding="utf-8"))
    return {c: float(cal["sensitivity_alphaF_by_component"][c]) for c in COMPONENT_ORDER}


def default_sensitivities(envelope_t0: float = 1000.0) -> dict:
    """alpha per component per currency unit for an envelope of `envelope_t0` units at t0, from the alpha * F0
    values of the synthetic demonstration calibration (calibration_demo.json)."""
    return {c: v / envelope_t0 for c, v in _alpha_f0().items()}


def framework_payload() -> dict:
    return {"components": copy.deepcopy(COMPONENTS), "indicators": copy.deepcopy(INDICATORS), "defaults": defaults()}
