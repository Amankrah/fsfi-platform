"""Masking checks before publication.

These tests need the private masking files of the paper's restricted data (a deny list and the empirical results
file), which sit beside the platform only in the author's working copy. In a public clone they are absent and every
test here skips. The file holds no restricted value: it reads them at run time and asserts only summary statistics.
"""
import base64
import binascii
import codecs
import fnmatch
import json
import math
import os
import re
from pathlib import Path

import numpy as np
import pytest

BACKEND = Path(__file__).resolve().parents[1]
PLATFORM = BACKEND.parent
PRIVATE = PLATFORM.parent / "docs" / "paper" / "results" / "private"
DENY = PRIVATE / "deny_tokens.txt"
EMPIRICAL = PLATFORM.parent / "docs" / "paper" / "results" / "empirical.json"

# Data-source citations in data/indicators.csv: legitimate, needed for reproducibility.
WHITELIST = {"world bank", "fao", "unicef"}

# ISO 4217 codes of African currencies, packed without separators so that this file
# never holds one of them as a word; unpacked in threes at run time.
_PACKED = ("AOABIFBWPCDFCVEDJFDZDEGPERNETBGHSGMDGNFKESKMFLRDLSLLYDMADMGAMROMRUMURMWKMZNNADNGNRWFSCRSDGSHPSLE"
           "SLLSOSSSPSTDSTNSZLTNDTZSUGXXAFXOFZARZMWZWLZWG")
CURRENCY_CODES = {_PACKED[i:i + 3] for i in range(0, len(_PACKED), 3)}

TEXT_SUFFIXES = {".py", ".json", ".csv", ".md", ".txt", ".ts", ".tsx", ".js", ".mjs", ".cjs", ".css", ".html", ".toml",
                 ".yml", ".yaml", ".cfg", ".ini", ".example", ".svg", ".rs", ".lock", ""}


def _need(*paths):
    missing = [p.name for p in paths if not p.exists()]
    if missing:
        pytest.skip("private masking files not available: " + ", ".join(missing))


# ---------------------------------------------------------------------------
# Files git would commit (honouring every .gitignore inside fsfi-platform)
# ---------------------------------------------------------------------------

def _gitignore_rules(d: Path):
    f = d / ".gitignore"
    out = []
    if f.exists():
        for raw in f.read_text(encoding="utf-8", errors="replace").splitlines():
            s = raw.strip()
            if not s or s.startswith("#"):
                continue
            neg = s.startswith("!")
            s = s[1:] if neg else s
            dir_only = s.endswith("/")
            s = s.strip("/")
            anchored = "/" in s or raw.strip().lstrip("!").startswith("/")
            out.append((s, neg, dir_only, anchored))
    return out


def _ignored(path: Path, is_dir: bool, stack) -> bool:
    ignored = False
    for base, rules in stack:
        rel = path.relative_to(base).as_posix()
        for pat, neg, dir_only, anchored in rules:
            if dir_only and not is_dir:
                continue
            hit = fnmatch.fnmatchcase(rel, pat) if anchored else fnmatch.fnmatchcase(path.name, pat)
            if hit:
                ignored = not neg
    return ignored


def tracked_files():
    out = []

    def walk(d: Path, stack):
        stack = stack + [(d, _gitignore_rules(d))]
        for p in sorted(d.iterdir()):
            if p.name == ".git":
                continue
            if p.is_dir():
                if not _ignored(p, True, stack):
                    walk(p, stack)
            elif not _ignored(p, False, stack):
                out.append(p)

    walk(PLATFORM, [])
    return out


def _texts():
    for f in tracked_files():
        if f.suffix.lower() not in TEXT_SUFFIXES:
            continue
        try:
            yield f, f.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue


def _rel(f):
    return f.relative_to(PLATFORM).as_posix()


# ---------------------------------------------------------------------------
# Deny tokens, plain and encoded
# ---------------------------------------------------------------------------

def _deny_patterns():
    toks = []
    for line in DENY.read_text(encoding="utf-8").splitlines():
        t = line.strip()
        if t and not t.startswith("#") and t.lower() not in WHITELIST:
            toks.append(t)
    return [(t, re.compile(r"(?<![A-Za-z0-9])" + re.escape(t) + r"(?![A-Za-z0-9])", re.IGNORECASE)) for t in toks]


def _printable(b: bytes) -> str | None:
    s = b.decode("utf-8", errors="ignore")
    if not s or sum(32 <= ord(c) < 127 for c in s) < 0.9 * len(s):
        return None
    return s


def _decoded_fragments(text: str):
    for m in re.finditer(r"(?<![\d.])(?:\d{2,3}\s*,\s*){3,}\d{2,3}(?![\d.])", text):
        nums = [int(x) for x in re.findall(r"\d+", m.group(0))]
        if all(32 <= n <= 126 for n in nums):
            yield "char codes", "".join(map(chr, nums))
    for m in re.finditer(r"[A-Za-z0-9+/_-]{16,}={0,2}", text):
        s = m.group(0)
        for alt in (s, s.replace("-", "+").replace("_", "/")):
            try:
                d = _printable(base64.b64decode(alt + "=" * (-len(alt) % 4), validate=True))
            except (binascii.Error, ValueError):
                continue
            if d:
                yield "base64", d
                break
    for m in re.finditer(r"(?<![0-9A-Za-z])(?:[0-9a-fA-F]{2}){8,}(?![0-9A-Za-z])", text):
        d = _printable(bytes.fromhex(m.group(0)))
        if d:
            yield "hex", d


def test_tracked_file_walk_honours_gitignore():
    _need(DENY)
    files = {_rel(f) for f in tracked_files()}
    assert "README.md" in files and "backend/fsfi_platform/synthetic.py" in files
    assert not any(p.startswith(("backend/.venv/", "frontend/node_modules/", "frontend/.next/")) for p in files)
    assert "PLATFORM_SPEC.md" not in files


def test_no_deny_tokens():
    _need(DENY)
    pats = _deny_patterns()
    assert pats
    hits = []
    for f, text in _texts():
        rot = codecs.encode(text, "rot13")
        for tok, rx in pats:
            if rx.search(text):
                hits.append((_rel(f), "plain", len(tok)))
            if len(tok) >= 5 and rx.search(rot):
                hits.append((_rel(f), "rot13", len(tok)))
        for how, frag in _decoded_fragments(text):
            for tok, rx in pats:
                if rx.search(frag):
                    hits.append((_rel(f), how, len(tok)))
    # report file, encoding and token length only, never the token
    assert not hits, hits


def test_whitelisted_names_only_as_data_sources():
    _need(DENY)
    rx = re.compile(r"\b(world bank|fao|unicef)\b", re.IGNORECASE)
    files = sorted({_rel(f) for f, text in _texts() if rx.search(text)})
    assert set(files) <= {"backend/fsfi_platform/data/indicators.csv", "backend/tests/test_masking_platform.py"}, files


# ---------------------------------------------------------------------------
# Currency and magnitudes
# ---------------------------------------------------------------------------

def test_no_african_currency_codes():
    _need(DENY)
    rx = re.compile(r"(?<![A-Za-z0-9])(" + "|".join(sorted(CURRENCY_CODES)) + r")(?![A-Za-z0-9])")
    hits = [(_rel(f), m.group(1)) for f, text in _texts() for m in rx.finditer(text)]
    assert not hits, hits


def test_no_bn_billion_million_next_to_numbers():
    _need(DENY)
    # bounded on both sides so that base64 integrity hashes (package-lock.json) do not match
    rx = re.compile(r"(?<![A-Za-z0-9+/])(\d[\d,.]*\s*(bn|billions?|millions?)|(bn|billions?|millions?)\s*\d[\d,.]*)"
                    r"(?![A-Za-z0-9+/])", re.IGNORECASE)
    hits = [(_rel(f), m.group(0)) for f, text in _texts() for m in rx.finditer(text)]
    assert not hits, hits


# ---------------------------------------------------------------------------
# Restricted numbers
# ---------------------------------------------------------------------------

def _empirical():
    return json.loads(EMPIRICAL.read_text(encoding="utf-8"))


def _restricted_six_dp(d):
    keys = ("coverage", "stress", "cumulative")
    vals = set()

    def add(v):
        if isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v):
            vals.add(f"{float(v):.6f}")

    for k, v in d.items():
        if k.startswith(("calibration.", "series.")) and any(s in k.rsplit(".", 1)[-1] for s in keys):
            add(v)
    for r in d.get("calibration.indicator_years") or []:
        for k in keys:
            add(r.get(k))
    vals.discard("0.000000")
    vals.discard("1.000000")
    return vals


def test_no_six_decimal_literal_equals_restricted_value():
    _need(EMPIRICAL)
    restricted = _restricted_six_dp(_empirical())
    assert restricted
    rx = re.compile(r"(?<![\w.])-?\d+\.\d{6}(?![\d])")
    hits = [(_rel(f), i) for f, text in _texts() for i, m in enumerate(rx.finditer(text))
            if f"{float(m.group(0)):.6f}" in restricted]
    assert not hits, hits


def test_default_cut_points_are_round_and_not_restricted():
    _need(EMPIRICAL)
    from fsfi_platform.engine import reference as R

    restricted = {float(v) for v in _restricted_six_dp(_empirical())}
    for v in R.PARAMS["cut_points_published"].values():
        for x in v:
            assert round(x, 2) == x
            assert all(abs(x - r) > 1e-9 for r in restricted)


# ---------------------------------------------------------------------------
# Demonstration calibration and synthetic countries versus the restricted shares
# ---------------------------------------------------------------------------

R_MAX = 0.6          # correlation with the restricted share vector must stay below this
NEAR = 0.2           # a share within +-20% of the restricted share counts as near
NEAR_MAX = 0.5       # at most half of the components (or indicators) may be near


def _restricted_shares(d, comps):
    by = {c: [] for c in comps}
    for k, v in d.items():
        if k.startswith("calibration.component_shares."):
            by[k.rsplit(".", 1)[-1]].append(float(v))
    comp = np.array([np.mean(by[c]) for c in comps])
    comp = comp / comp.sum()
    ext = np.array([float(d["calibration.external_share_pooled." + c]) for c in comps])
    w = {}
    for r in d["calibration.indicator_years"]:
        if r.get("within_component_share_pct") is not None:
            w.setdefault(r["code"], []).append(float(r["within_component_share_pct"]) / 100.0)
    return comp, ext, {k: float(np.mean(v)) for k, v in w.items()}


def _similarity(s, p):
    s, p = np.asarray(s, float), np.asarray(p, float)
    r = float(np.corrcoef(s, p)[0, 1]) if s.std() > 0 and p.std() > 0 else float("nan")
    near = int(np.sum(np.abs(s - p) <= NEAR * np.abs(p)))
    return r, near, len(p)


def _check(label, s, p, out):
    r, near, n = _similarity(s, p)
    out.append((label, round(r, 3), near, n))
    assert not (r >= R_MAX), (label, round(r, 3))
    assert near <= NEAR_MAX * n, (label, near, n)


def _country_shares(p, comps, comp_of):
    comp = np.zeros(len(comps))
    within = {}
    for y in p["years"]:
        ct = {c: 0.0 for c in comps}
        for code, iy in y["indicators"].items():
            ct[comp_of[code]] += iy["allocation"]
        tot = sum(ct.values())
        comp += np.array([ct[c] / tot for c in comps])
        for code, iy in y["indicators"].items():
            if ct[comp_of[code]] > 0:
                within.setdefault(code, []).append(iy["allocation"] / ct[comp_of[code]])
    ext = None
    if any(ln["budget_tag"] == "external" for ln in p["budget_lines"]):
        e = {c: 0.0 for c in comps}
        t = {c: 0.0 for c in comps}
        for ln in p["budget_lines"]:
            c = ln.get("component")
            if c is not None:
                t[c] += ln["amount"]
                if ln["budget_tag"] == "external":
                    e[c] += ln["amount"]
        ext = [e[c] / t[c] for c in comps]
    return comp / len(p["years"]), {k: float(np.mean(v)) for k, v in within.items()}, ext


def test_demo_calibration_is_not_the_restricted_calibration():
    _need(EMPIRICAL)
    from fsfi_platform import synthetic as S

    comps = S.FW.COMPONENT_ORDER
    pc, pe, pw = _restricted_shares(_empirical(), comps)
    cal, out = S.CAL, []
    for arch, sh in cal["shares"]["by_archetype"].items():
        _check(f"calibration {arch} components", [sh[c] for c in comps], pc, out)
        w = cal["shares"]["within_by_archetype"][arch]
        codes = [k for k in w if k in pw]
        _check(f"calibration {arch} within", [w[k] for k in codes], [pw[k] for k in codes], out)
    _check("calibration external", [cal["external"]["component_share"][c] for c in comps], pe, out)
    print(out)


@pytest.mark.parametrize("cid", ["aurelia", "borealis", "cordova", "deltana"])
def test_synthetic_country_is_not_the_restricted_record(profiles, cid):
    _need(EMPIRICAL)
    from fsfi_platform import synthetic as S

    comps = S.FW.COMPONENT_ORDER
    pc, pe, pw = _restricted_shares(_empirical(), comps)
    comp, within, ext = _country_shares(profiles[cid], comps, S.COMP_OF)
    out = []
    _check(f"{cid} components", comp, pc, out)
    codes = [k for k in within if k in pw]
    _check(f"{cid} within", [within[k] for k in codes], [pw[k] for k in codes], out)
    if ext is not None:
        _check(f"{cid} external", ext, pe, out)
    print(out)


def test_generator_reads_no_restricted_file():
    """The generator and the platform code never point at the private directory."""
    _need(DENY)
    for f in (BACKEND / "fsfi_platform").rglob("*.py"):
        text = f.read_text(encoding="utf-8")
        assert "results/private" not in text and "empirical.json" not in text, f
    assert os.path.basename(__file__) == "test_masking_platform.py"
