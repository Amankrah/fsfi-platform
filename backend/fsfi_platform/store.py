"""JSON-file store: data/countries/<id>.json. Synthetic countries are regenerated when missing or when the
generator version changes; they are read-only. Custom countries support create / update / delete / clone."""
from __future__ import annotations

import copy
import json
import os
import re
import threading
from datetime import datetime, timezone
from pathlib import Path

from . import framework as FW
from .engine import reference as R

BACKEND_DIR = Path(__file__).resolve().parent.parent
_lock = threading.RLock()
_cache: dict[str, tuple[float, dict]] = {}


class NotFound(KeyError):
    pass


class ReadOnly(PermissionError):
    pass


class Invalid(ValueError):
    pass


def data_dir() -> Path:
    d = Path(os.environ.get("FSFI_DATA_DIR") or BACKEND_DIR / "data" / "countries")
    d.mkdir(parents=True, exist_ok=True)
    return d


def _path(cid: str) -> Path:
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,63}", cid or ""):
        raise NotFound(cid)
    return data_dir() / f"{cid}.json"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return (s or "country")[:48]


def _write(p: dict):
    path = _path(p["id"])
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(p, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    os.replace(tmp, path)
    _cache.pop(p["id"], None)


def write_synthetic(p: dict):
    with _lock:
        _write(p)


def ensure_synthetic(force: bool = False) -> list[str]:
    """Generate missing (or outdated) synthetic countries. Returns the ids written."""
    from . import synthetic as S

    written = []
    with _lock:
        for cid in S.COUNTRY_IDS:
            path = _path(cid)
            ok = False
            if path.exists() and not force:
                try:
                    ok = json.loads(path.read_text(encoding="utf-8")).get("generator_version") == S.GENERATOR_VERSION
                except Exception:
                    ok = False
            if not ok:
                _write(S.build_country(cid))
                written.append(cid)
    return written


def get(cid: str) -> dict:
    path = _path(cid)
    with _lock:
        if not path.exists():
            raise NotFound(cid)
        mt = path.stat().st_mtime
        hit = _cache.get(cid)
        if hit and hit[0] == mt:
            return hit[1]
        p = json.loads(path.read_text(encoding="utf-8"))
        _cache[cid] = (mt, p)
        return p


def cache_key(p: dict) -> str:
    return f"{p['id']}|{p.get('updated_at')}|{p.get('generator_version', '')}"


def list_ids() -> list[str]:
    from . import synthetic as S

    ids = [f.stem for f in sorted(data_dir().glob("*.json"))]
    syn = [c for c in S.COUNTRY_IDS if c in ids]
    return syn + [c for c in ids if c not in syn]


def normalise(body: dict, kind="custom", keep_id=None) -> dict:
    """Fill framework defaults, validate shapes and return a complete CountryProfile dict."""
    d = FW.defaults()
    p = {k: v for k, v in body.items() if v is not None}
    p["kind"] = kind
    p["id"] = keep_id or p.get("id") or slugify(p.get("name", "country"))
    p.setdefault("tagline", "")
    p.setdefault("description", "")
    p.setdefault("currency", "CU m")
    p.setdefault("components", copy.deepcopy(FW.COMPONENTS))
    p.setdefault("indicators", copy.deepcopy(FW.INDICATORS))
    comp_ids = [c["id"] for c in p["components"]]
    if len(set(comp_ids)) != len(comp_ids) or not comp_ids:
        raise Invalid("components must be a non-empty list with unique ids")
    default_order = comp_ids == FW.COMPONENT_ORDER
    C = len(comp_ids)
    sens = dict(p.get("sensitivities") or {})
    for c in comp_ids:
        if c not in sens:
            sens[c] = d["sensitivities"].get(c, 0.01)
        if sens[c] < 0:
            raise Invalid(f"sensitivity of {c} must be non-negative")
    p["sensitivities"] = {c: float(sens[c]) for c in comp_ids}
    if "ahp_matrix" not in p:
        if not default_order:
            p["ahp_matrix"] = [[1.0] * C for _ in range(C)]
        else:
            p["ahp_matrix"] = d["ahp_matrix"]
    if "dependency_matrices" not in p:
        if default_order:
            p["dependency_matrices"] = d["dependency_matrices"]
        else:
            p["dependency_matrices"] = {"normal_operations": [[0.0 if i == j else 0.5 for j in range(C)] for i in range(C)]}
    if default_order and "ahp_matrices" not in p and body.get("ahp_matrix") is None:
        p["ahp_matrices"] = d["ahp_matrices"]
    for name, m in [("ahp_matrix", p["ahp_matrix"])] + [(f"dependency_matrices.{k}", v) for k, v in p["dependency_matrices"].items()] \
            + [(f"ahp_matrices.{k}", v) for k, v in (p.get("ahp_matrices") or {}).items()]:
        if len(m) != C or any(len(r) != C for r in m):
            raise Invalid(f"{name} must be {C}x{C} in components order")
    if "normal_operations" not in p["dependency_matrices"]:
        raise Invalid("dependency_matrices must include 'normal_operations'")
    pers = dict(p.get("persistence") or {})
    for c in comp_ids:
        pers.setdefault(c, list(R.PARAMS["persistence"].get(c, R.PARAMS["persistence_fallback"])))
    p["persistence"] = {c: [float(pers[c][0]), float(pers[c][1])] for c in comp_ids}
    p.setdefault("breaks", d["breaks"])
    b = p["breaks"]
    if len(b["indicator"]) != 3 or len(b["component"]) != 3 or len(b["system"]) != 3 or len(b["coverage"]) != 2:
        raise Invalid("breaks need 3 stress cut-points (indicator, component, system) and 2 coverage cut-points")
    codes = [i["code"] for i in p["indicators"]]
    if len(set(codes)) != len(codes):
        raise Invalid("indicator codes must be unique")
    for i in p["indicators"]:
        if i["component"] not in comp_ids:
            raise Invalid(f"indicator {i['code']} has unknown component {i['component']}")
    years = p.get("years") or []
    seen = set()
    for y in years:
        if y["year"] in seen:
            raise Invalid(f"duplicate year {y['year']}")
        seen.add(y["year"])
        for code, iy in y["indicators"].items():
            if code not in codes:
                raise Invalid(f"year {y['year']}: indicator {code} is not in the indicator list")
            if iy.get("allocation", 0) < 0:
                raise Invalid(f"year {y['year']}: negative allocation for {code}")
            if iy.get("benchmark") is None or float(iy["benchmark"]) < 0:
                raise Invalid(f"year {y['year']}: benchmark of {code} must be non-negative")
            if iy.get("observed") is not None and float(iy["observed"]) < 0:
                raise Invalid(f"year {y['year']}: observed value of {code} must be non-negative")
        if not y.get("envelope"):
            y["envelope"] = float(sum(float(iy.get("allocation", 0)) for iy in y["indicators"].values()))
    p["years"] = years
    ts = now_iso()
    p.setdefault("created_at", ts)
    p["updated_at"] = ts
    p.pop("generator_version", None)
    return p


def _unique_id(base: str) -> str:
    cid, k = base, 2
    while _path(cid).exists():
        cid = f"{base}-{k}"
        k += 1
    return cid


def create(body: dict) -> dict:
    with _lock:
        p = normalise(body)
        p["id"] = slugify(p["id"])
        p["id"] = _unique_id(p["id"])
        p["created_at"] = p["updated_at"]
        _write(p)
        return p


def update(cid: str, body: dict) -> dict:
    with _lock:
        cur = get(cid)
        if cur["kind"] == "synthetic":
            raise ReadOnly(cid)
        p = normalise(body, keep_id=cid)
        p["created_at"] = cur.get("created_at", p["updated_at"])
        _write(p)
        return p


def delete(cid: str):
    with _lock:
        cur = get(cid)
        if cur["kind"] == "synthetic":
            raise ReadOnly(cid)
        _path(cid).unlink()
        _cache.pop(cid, None)


def clone(cid: str, name: str) -> dict:
    with _lock:
        src = copy.deepcopy(get(cid))
        src.pop("generator_version", None)
        src["name"] = name
        src["id"] = _unique_id(slugify(name))
        src["kind"] = "custom"
        src["tagline"] = f"Custom copy of {get(cid)['name']}"
        ts = now_iso()
        src["created_at"] = ts
        src["updated_at"] = ts
        _write(src)
        return src
