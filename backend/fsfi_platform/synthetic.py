"""Deterministic (seeded) generator of the four fictional demonstration countries.

Each country has six fiscal years t0..t5, the 37-indicator framework (about 31 assessed a year), currency
"DU m" (demo units, millions) and several hundred synthetic budget lines a year. The lines are run through the
ported mapper and each indicator's allocation is the sum of the money the mapper assigns to it, so the profile
reproduces its own budget exactly. Shapes come from the synthetic demonstration calibration
(calibration_demo.json), which is itself drawn from the stylised archetype priors documented below
(ARCHETYPES and the *_PRIOR constants); no parameter is fitted to any country's data and all values are fictional.
Each country's stress and coverage class breaks are calibrated by Fisher-Jenks on its own synthetic record.

    python -m fsfi_platform.synthetic                # regenerate data/countries/<id>.json and print headlines
    python -m fsfi_platform.synthetic --calibration  # redraw data/calibration_demo.json from the priors first
"""
from __future__ import annotations

import copy
import json
import math
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from . import framework as FW
from .engine import kkt
from .engine import reference as R
from .mapping import mapper, run_mapping

HERE = Path(__file__).resolve().parent
CAL_PATH = HERE / "data" / "calibration_demo.json"
GENERATOR_VERSION = "2026.11.23-1"
YEARS = [f"t{i}" for i in range(6)]
CURRENCY = "DU m"
CODES = [i["code"] for i in FW.INDICATORS]
COMP_OF = {i["code"]: i["component"] for i in FW.INDICATORS}
HIGHER = {i["code"]: i["direction"] == "higher" for i in FW.INDICATORS}

# ---------------------------------------------------------------------------
# Archetype priors of the demonstration calibration
# ---------------------------------------------------------------------------
# Stylised component shares of four budget archetypes. The centres are set a priori from each archetype's story
# (round numbers, chosen without reference to any country's budget). A country's mean component shares are one
# Dirichlet draw around its archetype centre with concentration ARCHETYPE_KAPPA (low, so the draw moves well away
# from the centre); each year then adds Dirichlet noise around that country mean.
ARCHETYPES = {
    # roads, storage, processing and irrigation first
    "infrastructure_heavy": {"crop_production": 0.18, "animal_systems": 0.07, "post_harvest": 0.25, "markets": 0.24,
                             "nutrition": 0.06, "finance": 0.05, "research": 0.05, "environment": 0.10},
    # money spread almost evenly across the eight components
    "balanced": {"crop_production": 0.14, "animal_systems": 0.12, "post_harvest": 0.12, "markets": 0.12,
                 "nutrition": 0.13, "finance": 0.11, "research": 0.13, "environment": 0.13},
    # partner-financed production, livestock and natural-resource projects
    "aid_dependent": {"crop_production": 0.20, "animal_systems": 0.15, "post_harvest": 0.08, "markets": 0.08,
                      "nutrition": 0.15, "finance": 0.06, "research": 0.12, "environment": 0.16},
    # nutrition and social programmes lead, markets last
    "nutrition_led": {"crop_production": 0.15, "animal_systems": 0.14, "post_harvest": 0.08, "markets": 0.06,
                      "nutrition": 0.32, "finance": 0.07, "research": 0.08, "environment": 0.10},
}
ARCHETYPE_KAPPA = 30.0
# Within a component, each archetype splits money over the indicators by a symmetric Dirichlet(WITHIN_ALPHA) draw.
WITHIN_ALPHA = 2.0
# Share of each component's money financed by partners (on-budget projects tagged "external"): Beta draws with
# these means and concentration EXTERNAL_KAPPA. Only the aid-dependent country carries partner finance.
EXTERNAL_PRIOR = {"crop_production": 0.65, "animal_systems": 0.35, "post_harvest": 0.55, "markets": 0.25,
                  "nutrition": 0.75, "finance": 0.20, "research": 0.60, "environment": 0.40}
EXTERNAL_KAPPA = 12.0
# Mean indicator gap by component (Beta with precision GAP_PHI) and the probability that an indicator is imputed.
GAP_PRIOR = {"crop_production": 0.45, "animal_systems": 0.55, "post_harvest": 0.50, "markets": 0.40,
             "nutrition": 0.50, "finance": 0.60, "research": 0.45, "environment": 0.55}
GAP_PHI = 6.0
IMPUTED_P = 0.4
# Sensitivity alpha times the t0 envelope, per component (round illustrative values).
SENSITIVITY_ALPHA_F = {"crop_production": 12.0, "animal_systems": 10.0, "post_harvest": 9.0, "markets": 6.0,
                       "nutrition": 8.0, "finance": 11.0, "research": 7.0, "environment": 9.0}
CALIBRATION_SEED = 20261123


def demo_calibration(seed: int = CALIBRATION_SEED) -> dict:
    """Draw the demonstration calibration from the archetype priors above (deterministic for a given seed)."""
    rng = np.random.default_rng(seed)
    comps = FW.COMPONENT_ORDER
    by_arch, within = {}, {}
    for name, centre in ARCHETYPES.items():
        m = np.array([centre[c] for c in comps])
        s = rng.dirichlet(ARCHETYPE_KAPPA * m / m.sum())
        by_arch[name] = {c: round(float(v), 4) for c, v in zip(comps, s)}
        w = {}
        for comp in comps:
            codes = [c for c in CODES if COMP_OF[c] == comp]
            draw = rng.dirichlet(np.full(len(codes), WITHIN_ALPHA))
            w.update({c: round(float(v), 4) for c, v in zip(codes, draw)})
        within[name] = w
    ext = {}
    for c in comps:
        mu = EXTERNAL_PRIOR[c]
        ext[c] = round(float(rng.beta(mu * EXTERNAL_KAPPA, (1 - mu) * EXTERNAL_KAPPA)), 4)
    imputed = [bool(rng.random() < IMPUTED_P) for _ in CODES]
    return {
        "note": ("DEMONSTRATION calibration: synthetic. Drawn from the stylised archetype priors documented in "
                 "fsfi_platform/synthetic.py (ARCHETYPES, EXTERNAL_PRIOR, GAP_PRIOR, SENSITIVITY_ALPHA_F); it is not "
                 "fitted to any country and does not reproduce the paper."),
        "source": "synthetic demonstration", "demonstration_only": True, "seed": seed,
        "framework": {"codes": CODES, "components": [COMP_OF[c] for c in CODES],
                      "higher_is_better": [HIGHER[c] for c in CODES], "imputed_pattern": imputed,
                      "component_order": comps},
        "priors": {"archetypes": ARCHETYPES, "archetype_kappa": ARCHETYPE_KAPPA, "within_alpha": WITHIN_ALPHA,
                   "external_mean": EXTERNAL_PRIOR, "external_kappa": EXTERNAL_KAPPA, "gap_mean": GAP_PRIOR,
                   "gap_phi": GAP_PHI, "imputed_probability": IMPUTED_P},
        "sensitivity_alphaF_by_component": dict(SENSITIVITY_ALPHA_F),
        "gaps": {"phi": GAP_PHI, "components": {c: {"mu": GAP_PRIOR[c]} for c in comps}},
        "shares": {"by_archetype": by_arch, "within_by_archetype": within},
        "external": {"component_share": ext},
        "thresholds": {k: list(v) for k, v in R.PARAMS["cut_points_published"].items()},
        "persistence": {k: list(v) for k, v in R.PARAMS["persistence"].items()},
    }


def write_demo_calibration(seed: int = CALIBRATION_SEED) -> dict:
    cal = demo_calibration(seed)
    CAL_PATH.write_text(json.dumps(cal, indent=1) + "\n", encoding="utf-8")
    return cal


CAL = json.loads(CAL_PATH.read_text(encoding="utf-8"))

# Illustrative benchmark levels (fictional reference values in each indicator's unit)
BENCHMARK = {
    "IND-01": 4.6, "IND-02": 32.0, "IND-03": 145.0, "IND-04": 78.0, "IND-05": 0.82,
    "IND-06": 3200.0, "IND-07": 210.0, "IND-08": 45.0, "IND-09": 4.0, "IND-10": 32.0,
    "IND-11": 6.0, "IND-12": 950000.0, "IND-13": 60.0, "IND-14": 35.0, "IND-15": 85.0,
    "IND-16": 70.0, "IND-17": 1400.0, "IND-18": 8.0, "IND-19": 55.0,
    "IND-20": 9.0, "IND-21": 5.0, "IND-22": 7.5, "IND-23": 65.0, "IND-24": 95.0,
    "IND-25": 40.0, "IND-26": 12.0, "IND-27": 30.0, "IND-28": 75.0,
    "IND-29": 70.0, "IND-30": 1.0, "IND-31": 45.0, "IND-32": 50.0,
    "IND-33": 60.0, "IND-34": 8.0, "IND-35": 1.2, "IND-36": 20.0, "IND-37": 12000.0,
}

# Line templates that fire each indicator's rule (verified at generation time against the mapper)
TEMPLATES = {
    "IND-01": ["Crop production and productivity", "Agricultural production intensification", "Food crops productivity programme",
               "Inputs for smallholder crops"],
    "IND-02": ["Irrigation scheme development", "Small scale irrigation equipment", "Irrigation canals rehabilitation",
               "Dams and irrigation works"],
    "IND-03": ["Fertiliser subsidy for smallholders", "Lime and compost distribution", "Soil fertility improvement",
               "NPK and urea procurement"],
    "IND-04": ["Certified seed multiplication", "Improved planting materials", "Quality seed production",
               "Cassava cuttings for growers"],
    "IND-05": ["Vegetable and fruit production support", "Horticulture development", "Crop diversification grants"],
    "IND-06": ["Dairy development", "Dairy value chain support", "Smallholder dairy programme"],
    "IND-07": ["Slaughterhouse upgrade", "Poultry production support", "Beekeeping and honey production",
               "Animal feeds supply"],
    "IND-08": ["Artificial insemination and improved breeds", "Heifers for smallholders", "Breeding stock improvement"],
    "IND-09": ["Vaccination of cattle", "Veterinary services and animal health", "Tick control and dipping"],
    "IND-10": ["Fish hatchery and fingerlings", "Aquaculture development", "Small livestock distributed to smallholders"],
    "IND-11": ["Post harvest dryers and hermetic bags", "Maize shellers and threshing", "Tarpaulins for drying"],
    "IND-12": ["Grain warehouses and silos", "Strategic grain reserves", "Storage facilities construction"],
    "IND-13": ["Cold chain equipment", "Cold rooms at aggregation points", "Refrigerated vans for perishables"],
    "IND-14": ["Agro processing and value addition", "Milling plants support", "Packaging and processing units"],
    "IND-15": ["Food safety laboratory and certification", "Phytosanitary inspection services", "Quality standards enforcement"],
    "IND-16": ["Construction of feeder roads", "Rehabilitation of bridges and culverts", "Wholesale market construction",
               "Modern markets construction", "Market access improvement"],
    "IND-17": ["Export promotion", "Cross border trade facilitation", "Agricultural exports development"],
    "IND-18": ["Market information and prices", "Price monitoring system"],
    "IND-19": ["Farmer cooperatives strengthening", "Producer organisations support"],
    "IND-20": ["Stunting reduction and micronutrient supplements", "Drinking water supply and sanitation",
               "Growth monitoring and child feeding", "Hospital equipment"],
    "IND-21": ["Cash transfers to vulnerable households", "Public works for food insecure areas", "Social protection programme"],
    "IND-22": ["Community outreach sessions", "Programme field operations"],
    "IND-23": ["Animal protein consumption promotion", "Protein intake improvement"],
    "IND-24": ["Food self sufficiency programme", "Import substitution for staples"],
    "IND-25": ["Agricultural credit guarantee", "Matching grants for farm loans", "Microfinance support"],
    "IND-26": ["Refinancing facility for rural lenders", "Lending to agriculture facility"],
    "IND-27": ["Crop insurance scheme", "Livestock insurance premiums"],
    "IND-28": ["Community outreach sessions", "Programme field operations"],
    "IND-29": ["Extension services and farmer field days", "Farmers trained in good agricultural practices",
               "Demonstration plots"],
    "IND-30": ["Agricultural research and new varieties", "Germplasm and tissue culture"],
    "IND-31": ["Mechanisation and tractors hire", "Farm machinery centres"],
    "IND-32": ["Climate smart agriculture and conservation agriculture", "Agroecology trials",
               "Climate resilience of farming systems"],
    "IND-33": ["Terracing and soil conservation", "Reforestation and watershed protection", "Agroforestry trees planting"],
    "IND-34": ["Soil erosion control", "Land degradation monitoring"],
    "IND-35": ["Greenhouse gas emissions reduction and biogas", "Clean cooking stoves"],
    "IND-36": ["Community outreach sessions", "Programme field operations"],
    "IND-37": ["Disaster early warning and weather services", "Flood risk management"],
}
# indicators reached through a sub-programme rule (rules_platform.json)
SUBPROG_ROUTED = {"IND-22": "Dietary diversity promotion", "IND-28": "Mobile money for farmers",
                  "IND-36": "Water use efficiency"}

AGENCY = {
    "crop_production": "Agriculture & Livestock", "animal_systems": "Agriculture & Livestock",
    "post_harvest": "Trade & Industry", "markets": "Infrastructure & Transport", "nutrition": "Health & Nutrition",
    "finance": "Finance & Planning", "research": "Agricultural Research Board", "environment": "Environment & Land",
}
SUBPROGRAMMES = {
    "crop_production": ["Crop intensification", "Smallholder farming systems"], "animal_systems": ["Livestock development"],
    "post_harvest": ["Agro-industry", "Storage and handling"], "markets": ["Rural access", "Market development"],
    "nutrition": ["Child nutrition", "Community health"], "finance": ["Rural finance"],
    "research": ["Research and innovation services", "Advisory services"],
    "environment": ["Natural resources", "Climate services"],
}
TAG = {"crop_production": "agricultural development", "animal_systems": "agricultural development",
       "post_harvest": "agricultural development", "markets": "infrastructure", "nutrition": "nutrition",
       "finance": "agricultural development", "research": "agricultural development", "environment": "climate change"}
OVERHEAD_TEXTS = ["Staff salaries", "Internal audit reports", "Administration and support services",
                  "Monitoring and evaluation", "Arrears settlement"]
# no-pathway lines placed by the residual stage: tag -> (target indicator, texts)
NP_LINES = {
    "infrastructure": ("IND-16", ["Electricity grid extension", "Urban master plan works", "Broadband internet for offices"]),
    "nutrition": ("IND-20", ["Fuel purchase", "Census and statistics"]),
    "agricultural development": ("IND-29", ["Classrooms construction", "Tourism promotion"]),
    "climate change": ("IND-33", ["Solid waste management", "Census and statistics"]),
    "social assistance": ("IND-21", ["Broadband internet for offices"]),
}
SOCIAL_AGENCY = "Social Protection"
EXTERNAL_AGENCY = "Partner-financed projects"
OVERHEAD_RATE = 0.06

ALWAYS = {"IND-16", "IND-20", "IND-21", "IND-29", "IND-33"}

_EXT = CAL["external"]["component_share"]
# the aid-dependent country loses most partner money at t3 on its five most partner-financed components
_WITHDRAWN = sorted(_EXT, key=lambda c: -_EXT[c])[:5]

COUNTRIES = {
    "aurelia": dict(
        seed=4101, name="Republic of Aurelia", tagline="Infrastructure-heavy allocator", archetype="infrastructure_heavy",
        description=("A fictional country that puts most of its food-system money into roads, market places, storage, "
                     "processing and irrigation, with thin funding for research, animal systems, environment and "
                     "finance. About a quarter of indicator gaps are imputed and the envelope grows by about two thirds "
                     "over six years. Synthetic demonstration data."),
        F0=820.0, growth=0.60, alpha_scale=1.0, gap_scale=1.0, p0=0.15, imputed="pattern", kappa_c=600.0,
        kappa_w=300.0, gap_means=None, near_optimal=None, external=None, never={"IND-23", "IND-24", "IND-26", "IND-28"},
        drop_pool=["IND-13", "IND-14", "IND-24", "IND-31", "IND-34", "IND-35", "IND-07", "IND-18"], n_drop=2,
    ),
    "borealis": dict(
        seed=4202, name="Borealis", tagline="Near-optimal allocator", archetype="balanced",
        description=("A fictional country that allocates close to its own optimum: money follows weighted gaps and "
                     "sensitivities, every gap is measured, and efficiency stays high across the record. Synthetic "
                     "demonstration data."),
        F0=1150.0, growth=0.55, alpha_scale=1.0, gap_scale=0.9, p0=0.12, imputed="none", kappa_c=600.0, kappa_w=300.0,
        gap_means=None, near_optimal=0.5, external=None, never={"IND-26", "IND-28", "IND-36"},
        drop_pool=["IND-13", "IND-14", "IND-24", "IND-31", "IND-34", "IND-07"], n_drop=3,
    ),
    "cordova": dict(
        seed=4303, name="Cordova", tagline="Aid-dependent", archetype="aid_dependent",
        description=("A fictional country where partners finance a large share of the food-system budget through "
                     "projects on budget (lines tagged external). A partner withdrawal at t3 removes most external "
                     "project money on the five most partner-financed components, and the record shows the jump in "
                     "stress and its slow decay. Synthetic demonstration data."),
        F0=640.0, growth=0.80, alpha_scale=2.0, gap_scale=1.0, p0=0.12, imputed="pattern", kappa_c=600.0,
        kappa_w=300.0, gap_slope=-0.004, gap_means=None, near_optimal=None,
        external=dict(share={**_EXT, **{c: max(0.85, _EXT[c]) for c in _WITHDRAWN}}, withdrawn=_WITHDRAWN,
                      factor={"t3": 0.05, "t4": 0.2, "t5": 0.3}),
        never={"IND-23", "IND-26", "IND-28", "IND-36"},
        drop_pool=["IND-13", "IND-14", "IND-24", "IND-31", "IND-34", "IND-35", "IND-07", "IND-18"], n_drop=2,
    ),
    "deltana": dict(
        seed=4404, name="Deltana", tagline="Nutrition-led, divergent gaps", archetype="nutrition_led",
        description=("A fictional country whose budget is led by nutrition and social programmes, with component gap "
                     "means drawn far apart: nutrition, animal systems, environment and finance near their benchmarks, "
                     "markets, post-harvest and research far from them. Every gap is measured, so the divergence is "
                     "not masked by imputed values. Synthetic demonstration data."),
        F0=760.0, growth=0.70, alpha_scale=1.0, gap_scale=1.0, p0=0.10, imputed="none", kappa_c=600.0, kappa_w=300.0,
        gap_floor=0.05,
        gap_means={"crop_production": 0.80, "animal_systems": 0.25, "post_harvest": 0.70, "markets": 0.85,
                   "nutrition": 0.20, "finance": 0.30, "research": 0.75, "environment": 0.25},
        near_optimal=None, external=None, never={"IND-23", "IND-26", "IND-28", "IND-36"},
        drop_pool=["IND-13", "IND-14", "IND-24", "IND-31", "IND-34", "IND-35", "IND-07", "IND-18"], n_drop=2,
    ),
}
COUNTRY_IDS = list(COUNTRIES)


# ---------------------------------------------------------------------------
# Gaps, observed values, assessed sets
# ---------------------------------------------------------------------------

def _assessed_sets(cfg, rng):
    out = []
    pool = [c for c in cfg["drop_pool"] if c not in ALWAYS]
    for _ in YEARS:
        drop = set(rng.choice(pool, size=cfg["n_drop"], replace=False)) | set(cfg["never"])
        out.append([c for c in CODES if c not in drop])
    return out


def _gap_paths(cfg, rng):
    comp_mu = {c: v["mu"] for c, v in CAL["gaps"]["components"].items()}
    comp_mu.update(cfg["gap_means"] or {})
    p0 = {c: cfg["p0"] for c in comp_mu}
    p0.update(cfg.get("p0_by_component") or {})
    phi = CAL["gaps"]["phi"]
    gaps = {}
    for code in CODES:
        mu = min(0.95, max(0.03, comp_mu[COMP_OF[code]] * cfg["gap_scale"]))
        if rng.random() < p0[COMP_OF[code]]:
            g0 = rng.uniform(0.0, 0.12)
            slope, noise = 0.0, 0.01
        else:
            g0 = float(np.clip(rng.beta(mu * phi, (1 - mu) * phi), cfg.get("gap_floor", 0.22), 0.92))
            slope, noise = rng.normal(cfg.get("gap_slope", -0.008), 0.01), 0.018
        path = []
        g = g0
        for t in range(len(YEARS)):
            if t > 0:
                g = g + slope + rng.normal(0, noise)
            path.append(float(np.clip(g, 0.0, 0.93)))
        gaps[code] = path
    return gaps


def _observed(code, gap):
    b = BENCHMARK[code]
    if HIGHER[code]:
        x = b * (1.0 - gap)
    else:
        x = b / (1.0 - gap)
    return float(f"{x:.6g}")


def _imputed_set(cfg):
    out = set()
    if cfg["imputed"] == "pattern":
        fw = CAL["framework"]
        out = {c for c, imp in zip(fw["codes"], fw["imputed_pattern"]) if imp}
    return (out - set(cfg.get("imputed_remove", ()))) | set(cfg.get("imputed_add", ()))


# ---------------------------------------------------------------------------
# Allocations
# ---------------------------------------------------------------------------

def _envelopes(cfg, rng):
    g = (1.0 + cfg["growth"]) ** (1 / 5) - 1
    F = [cfg["F0"]]
    for _ in range(5):
        F.append(F[-1] * (1 + g + rng.normal(0, 0.015)))
    return np.array(F)


def _component_shares(cfg, rng):
    base = CAL["shares"]["by_archetype"][cfg["archetype"]]
    comps = FW.COMPONENT_ORDER
    m = np.array([base[c] for c in comps])
    m = m / m.sum()
    out = []
    for _ in YEARS:
        s = rng.dirichlet(cfg["kappa_c"] * m)
        out.append(dict(zip(comps, s)))
    return out


def _within_shares(cfg, rng, assessed):
    wm = CAL["shares"]["within_by_archetype"][cfg["archetype"]]
    floor = 0.004
    out = {}
    for comp in FW.COMPONENT_ORDER:
        codes = [c for c in assessed if COMP_OF[c] == comp]
        if not codes:
            continue
        m = np.array([max(wm[c], floor) for c in codes])
        m = m / m.sum()
        s = rng.dirichlet(cfg["kappa_w"] * m)
        s = np.maximum(s, 1e-3)
        s = s / s.sum()
        out.update(dict(zip(codes, s)))
    return out


# ---------------------------------------------------------------------------
# Budget lines
# ---------------------------------------------------------------------------

def _check_templates():
    Rr = mapper.default_rules()
    for code, texts in TEMPLATES.items():
        comp = COMP_OF[code]
        sp = SUBPROG_ROUTED.get(code, SUBPROGRAMMES[comp][0])
        for t in texts:
            got = mapper.classify(dict(line=t, subprog=sp, agency=AGENCY[comp], tag=TAG[comp]), Rr)[0]
            if got != code:
                raise AssertionError(f"template '{t}' for {code} maps to {got}")


def _split(rng, amount, k):
    if k <= 1:
        return [amount]
    return list(rng.dirichlet(np.ones(k) * 2.0) * amount)


def _lines_for_year(rng, year, targets: dict, ext_targets: dict, tag_np_share=0.12):
    """targets: indicator -> domestic money; ext_targets: indicator -> external (partner) money."""
    lines = []
    groups = {}  # (agency, subprog) -> specific money (for overhead)

    def add(agency, subprog, text, tag, amount):
        amount = round(float(amount), 3)
        if amount <= 0:
            return 0.0
        lines.append(dict(year=year, agency=agency, sub_programme=subprog, line=text, budget_tag=tag, amount=amount))
        return amount

    for code, amt in targets.items():
        comp = COMP_OF[code]
        np_amt = 0.0
        np_tag = None
        for tag, (tgt, _) in NP_LINES.items():
            if tgt == code:
                np_tag = tag
        if np_tag is not None:
            np_amt = amt * tag_np_share
        spec = (amt - np_amt) / (1.0 + OVERHEAD_RATE)
        agency = SOCIAL_AGENCY if code == "IND-21" else AGENCY[comp]
        subs = [SUBPROG_ROUTED[code]] if code in SUBPROG_ROUTED else SUBPROGRAMMES[comp]
        k = int(np.clip(round(2 + 1.6 * math.log1p(amt / 8.0)), 2, 14))
        for part in _split(rng, spec, k):
            sp = subs[int(rng.integers(len(subs)))]
            got = add(agency, sp, TEMPLATES[code][int(rng.integers(len(TEMPLATES[code])))], TAG[comp], part)
            groups[(agency, sp, TAG[comp])] = groups.get((agency, sp, TAG[comp]), 0.0) + got
        if np_amt > 0:
            texts = NP_LINES[np_tag][1]
            for part in _split(rng, np_amt, 2):
                add(agency, "General services", texts[int(rng.integers(len(texts)))], np_tag, part)
    for code, amt in ext_targets.items():
        if amt <= 0:
            continue
        comp = COMP_OF[code]
        spec = amt / (1.0 + OVERHEAD_RATE)
        sp = SUBPROG_ROUTED[code] if code in SUBPROG_ROUTED else f"Partner project: {FW.COMPONENT_META[comp][0].lower()}"
        k = int(np.clip(round(1 + 1.2 * math.log1p(amt / 8.0)), 1, 8))
        for part in _split(rng, spec, k):
            got = add(EXTERNAL_AGENCY, sp, TEMPLATES[code][int(rng.integers(len(TEMPLATES[code])))], "external", part)
            groups[(EXTERNAL_AGENCY, sp, "external")] = groups.get((EXTERNAL_AGENCY, sp, "external"), 0.0) + got
    # overhead pro rata inside each agency / sub-programme / year group
    for (agency, sp, tag), money in groups.items():
        oh = money * OVERHEAD_RATE
        if oh <= 0.01:
            continue
        for part in _split(rng, oh, 1 if oh < 5 else 2):
            add(agency, sp, OVERHEAD_TEXTS[int(rng.integers(len(OVERHEAD_TEXTS)))], tag, part)
    return lines


# ---------------------------------------------------------------------------
# Profile assembly
# ---------------------------------------------------------------------------

def _base_profile(cid, cfg):
    d = FW.defaults()
    now = datetime(2026, 11, 22, tzinfo=timezone.utc).isoformat()
    mult = cfg.get("alpha_mult") or {}
    alpha = {c: cfg["alpha_scale"] * mult.get(c, 1.0) * CAL["sensitivity_alphaF_by_component"][c] / cfg["F0"]
             for c in FW.COMPONENT_ORDER}
    return {
        "id": cid, "name": cfg["name"], "tagline": cfg["tagline"], "description": cfg["description"],
        "kind": "synthetic", "currency": CURRENCY, "components": copy.deepcopy(FW.COMPONENTS),
        "indicators": copy.deepcopy(FW.INDICATORS), "sensitivities": alpha,
        "ahp_matrix": d["ahp_matrix"], "ahp_matrices": d["ahp_matrices"], "dependency_matrices": d["dependency_matrices"],
        "hybrid_coefficients": d["hybrid_coefficients"],
        "persistence": d["persistence"], "breaks": d["breaks"], "years": [], "budget_lines": [],
        "created_at": now, "updated_at": now,
    }


def _near_optimal_targets(profile, yi, F, prior, beta):
    """Blend of the year's optimum (hybrid weights at the blended allocation, fixed point) and a prior split."""
    from . import assessment as A

    alloc = dict(prior)
    for _ in range(6):
        for k, v in alloc.items():
            profile["years"][yi]["indicators"][k]["allocation"] = v
        c = A.core(profile, yi, "hybrid", "normal_operations", "exponential")
        fopt = dict(zip(c["x"].codes, c["fopt"]))
        alloc = {k: (1 - beta) * fopt[k] + beta * prior[k] for k in prior}
    return alloc


def mapped_by_year(lines) -> dict:
    """Money the mapper assigns to each indicator (apportioned shares included), by year."""
    raw = [dict(row=ln["id"], fy=ln["year"], agency=ln["agency"], subprog=ln["sub_programme"], line=ln["line"],
                tag=ln["budget_tag"], w=ln["amount"]) for ln in lines]
    by_year = {}
    for m, x in zip(mapper.map_lines(raw), raw):
        for k, share in m["alloc"].items():
            d = by_year.setdefault(x["fy"], {})
            d[k] = d.get(k, 0.0) + x["w"] * share
    return by_year


def build_country(cid: str) -> dict:
    _check_templates()
    cfg = COUNTRIES[cid]
    rng = np.random.default_rng(cfg["seed"])
    profile = _base_profile(cid, cfg)
    assessed = _assessed_sets(cfg, rng)
    gaps = _gap_paths(cfg, rng)
    imputed = _imputed_set(cfg)
    F = _envelopes(cfg, rng)
    cshares = _component_shares(cfg, rng)

    # targets per year (domestic, external)
    all_targets = []
    for t, year in enumerate(YEARS):
        within = _within_shares(cfg, rng, assessed[t])
        tot = {code: F[t] * cshares[t][COMP_OF[code]] * within[code] for code in assessed[t]}
        # renormalise over components present
        s = sum(tot.values())
        tot = {k: v * F[t] / s for k, v in tot.items()}
        profile["years"].append({"year": year, "envelope": float(F[t]), "indicators": {
            code: {"observed": None if code in imputed else _observed(code, gaps[code][t]),
                   "benchmark": BENCHMARK[code], "allocation": tot[code]} for code in assessed[t]}})
        all_targets.append(tot)

    if cfg["near_optimal"] is not None:
        for t in range(len(YEARS)):
            all_targets[t] = _near_optimal_targets(profile, t, F[t], all_targets[t], cfg["near_optimal"])

    lines = []
    for t, year in enumerate(YEARS):
        dom, ext = dict(all_targets[t]), {}
        if cfg["external"]:
            e = cfg["external"]
            for code, amt in all_targets[t].items():
                comp = COMP_OF[code]
                share = e["share"][comp]
                factor = e["factor"].get(year, 1.0) if comp in e["withdrawn"] else 1.0
                dom[code] = amt * (1 - share)
                ext[code] = amt * share * factor
        lines += _lines_for_year(rng, year, dom, ext)
    for i, ln in enumerate(lines, start=1):
        ln["id"] = i

    res = run_mapping(lines, COMP_OF)
    by_year = mapped_by_year(lines)
    for t, year in enumerate(YEARS):
        yr = profile["years"][t]
        mapped = by_year[year]
        extra = set(mapped) - set(yr["indicators"])
        if extra:
            raise AssertionError(f"{cid} {year}: money mapped to unassessed indicators {sorted(extra)}")
        for code, iy in yr["indicators"].items():
            iy["allocation"] = float(mapped.get(code, 0.0))
        yr["envelope"] = float(sum(iy["allocation"] for iy in yr["indicators"].values()))
    profile["budget_lines"] = res["lines"]
    for ln in profile["budget_lines"]:
        ln.pop("mapping_class", None)
    profile["breaks"] = own_breaks(profile)
    profile["generator_version"] = GENERATOR_VERSION
    return profile


def own_breaks(profile) -> dict:
    """Stress and coverage class breaks calibrated by Fisher-Jenks on the country's own synthetic record, rounded to
    two decimals (strictly increasing after rounding)."""
    from . import assessment as A

    out = {}
    for k, v in A.calibrate(profile)["breaks"].items():
        b = []
        for x in v:
            r = round(float(x), 2)
            if b and r <= b[-1]:
                r = round(b[-1] + 0.01, 2)
            b.append(r)
        out[k] = b
    return out


def build_all() -> dict:
    return {cid: build_country(cid) for cid in COUNTRY_IDS}


def headline(profile) -> dict:
    from . import assessment as A

    a = A.assessment(profile)
    s = a["system"]
    ds = {d["diagnosis"]: (d["count"], round(d["envelope_share"], 3), round(d["stress_share"], 3)) for d in a["diagnosis_summary"]}
    return {"fsfsi": round(s["fsfsi"], 4), "fsfsi_acc": round(s["fsfsi_acc"], 4), "E": round(s["efficiency"], 4),
            "E_t0": round(s["efficiency_fixed_t0"], 4), "elasticity": round(s["elasticity"], 4),
            "multiple": round(s["envelope_multiple"], 3), "fl10": round(s["front_loaded_10pct"], 3),
            "n_imputed": sum(i["imputed"] for i in a["indicators"]), "n": len(a["indicators"]), "diagnosis": ds,
            "ms": round(a["meta"]["compute_ms"], 2)}


if __name__ == "__main__":  # pragma: no cover
    import subprocess
    import sys

    from . import store

    if "--calibration" in sys.argv[1:]:
        write_demo_calibration()
        print("wrote", CAL_PATH)
        # the country configurations read the calibration at import: regenerate in a fresh interpreter
        sys.exit(subprocess.call([sys.executable, "-m", "fsfi_platform.synthetic"]))

    for cid, p in build_all().items():
        store.write_synthetic(p)
        print(cid, len(p["budget_lines"]), json.dumps(headline(p)))
