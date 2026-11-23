"""Mapper port and the synthetic countries' budget lines."""
import pytest

from fsfi_platform import framework as FW
from fsfi_platform import synthetic as S
from fsfi_platform.mapping import mapper, run_mapping


@pytest.mark.parametrize("platform", [False, True])
def test_mapper_reproduces_expected_assignment(platform):
    rules = mapper.load_rules(platform=platform)
    lines, expected = mapper.read_budget()
    out = {m["row"]: m for m in mapper.map_lines(lines, rules)}
    for row, (ind, cls, rule) in expected.items():
        assert out[row]["indicator"] == ind, row
        assert out[row]["cls"] == cls, row
        assert out[row]["rule"] == rule, row


def test_platform_rules_reach_unmapped_indicators():
    R = mapper.default_rules()
    for code, sp in S.SUBPROG_ROUTED.items():
        t = mapper.classify(dict(line="Community outreach sessions", subprog=sp, agency="X", tag="nutrition"), R)
        assert t[0] == code


def test_templates_fire_their_rules():
    S._check_templates()


@pytest.mark.parametrize("cid", S.COUNTRY_IDS)
def test_allocations_equal_mapped_budget(profiles, cid):
    p = profiles[cid]
    lines = p["budget_lines"]
    assert 600 <= len(lines) <= 1300
    by_year = S.mapped_by_year(lines)
    for y in p["years"]:
        mapped = by_year[y["year"]]
        assert set(mapped) <= set(y["indicators"])
        for code, iy in y["indicators"].items():
            assert iy["allocation"] == pytest.approx(mapped.get(code, 0.0), rel=1e-12, abs=1e-9)
        assert y["envelope"] == pytest.approx(sum(iy["allocation"] for iy in y["indicators"].values()))
    # the summary of run_mapping agrees with the per-line apportionment
    res = run_mapping(lines, {i["code"]: i["component"] for i in FW.INDICATORS})
    tot = sum(y["envelope"] for y in p["years"])
    assert res["summary"]["total_amount"] == pytest.approx(tot, rel=1e-9)
    assert sum(res["summary"]["by_indicator"].values()) == pytest.approx(tot, rel=1e-9)


def test_generation_is_deterministic(profiles):
    p = S.build_country("aurelia")
    q = profiles["aurelia"]
    assert [y["indicators"] for y in p["years"]] == [y["indicators"] for y in q["years"]]


def test_cordova_external_lines(profiles):
    p = profiles["cordova"]
    ext = {}
    for ln in p["budget_lines"]:
        if ln["budget_tag"] == "external":
            ext[ln["year"]] = ext.get(ln["year"], 0.0) + ln["amount"]
    assert ext["t3"] < 0.5 * ext["t2"]
