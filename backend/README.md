# FSFI Platform: backend

FastAPI service for the Food System Financing Stress Index (FSFSI) demonstration platform. It implements the
paper's Methods (gap and imputation, exponential and hyperbolic stress, five weightings × five scenarios, index,
KKT optimum and its hold-benchmark variant, efficiency at the actual and a fixed envelope, elasticity, scale curves,
envelope equivalent, front-loaded reallocation, accumulated stress, classes and diagnosis) and serves four seeded
synthetic countries plus any number of custom ones. The API contract is `../PLATFORM_SPEC.md` (section 3 and 3a).

## Setup (Windows, PowerShell, Python 3.13)

```powershell
cd fsfi-platform\backend
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
# optional Rust engine: install the prebuilt fsfi_engine wheel from the repository
$whl = Get-ChildItem ..\.. -Recurse -Filter "fsfi_engine-*-cp313-*win_amd64.whl" | Select-Object -First 1
.venv\Scripts\python -m pip install $whl.FullName
```

## Run

```powershell
.venv\Scripts\python -m uvicorn fsfi_platform.main:app --host 127.0.0.1 --port 8010
```

On start-up the four synthetic countries (`aurelia`, `borealis`, `cordova`, `deltana`) are generated into
`data/countries/` if missing or outdated (`python -m fsfi_platform.synthetic` regenerates them and prints the
headline numbers). Custom countries are stored next to them as `<id>.json`. Interactive docs: http://127.0.0.1:8010/docs

Environment variables:

| variable | default | meaning |
|---|---|---|
| `FSFI_ENGINE` | `auto` | `auto` (Rust where it agrees with the reference to 1e-9), `rust`, `reference` |
| `FSFI_DATA_DIR` | `data/countries` | country store |

**Engine.** `auto` uses the Rust index and efficiency (identical to the reference to ~1e-16) and the reference optimum:
the Rust optimum stops its bisection at an absolute 1e-6 tolerance, so its allocations differ from the reference by up
to ~3e-7 of the envelope (the index at its optimum agrees to ~1e-14). `meta.engine` reports `"rust"` only when Rust
computed both the index and the optimum; `meta.engine_functions` and `/api/health` say which function ran where.

## Test

```powershell
.venv\Scripts\python -m pytest -q
```

The suite checks every equation against the published reference implementation (the reproduction package under
`docs/paper/public_release/`; those tests are skipped if it is absent), Rust against reference, the KKT property,
E ∈ (0, 1], the scale property, analytic against numerical elasticity (both responses), the mapper against the
synthetic budget's expected assignment, that each synthetic country's allocations equal its mapped budget lines,
the calibration targets of the demo countries, timing (< 50 ms per assessment) and every endpoint. Tests run on a
temporary copy of the store.

## Layout

```
fsfi_platform/
  main.py            FastAPI app (/api/...), CORS for localhost:3010
  schemas.py         pydantic models = the TypeScript types of the spec
  assessment.py      pipeline: record, assessment, timeseries, scale curves, weights, draft, calibrate
  engine/            reference.py (port of the published equations), kkt.py (exact water-filling), rust.py, get_engine()
  framework.py       8 components, 37 indicators (IND-01..IND-37 as targeted by the mapping rules)
  mapping/           mapper.py + rules_generic.json (ported) + rules_platform.json (sub-programme rules) + synthetic_budget.csv
  synthetic.py       seeded generator of the demo countries (budget lines -> mapper -> allocations)
  evidence.py        flattened simulation results for /api/evidence (data/evidence.json)
  store.py           JSON-file store
```
