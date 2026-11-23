# FSFI Platform: Food System Financing Stress Index

[![DOI](https://zenodo.org/badge/1468185084.svg)](https://doi.org/10.5281/zenodo.24465804)

A general, country-agnostic demonstration platform for the Food System Financing Stress Index (FSFSI) described in
`docs/paper/manuscript.md` ("Joining budget lines to food-system outcomes shows where money falls short").

## What it is

The FSFSI joins an executed food-system budget, line by line, to 37 outcome indicators across eight components and
defines *financing stress* as the part of each indicator's performance gap (its normalised distance from a benchmark)
that spending leaves unfinanced under diminishing returns (υ = δ·e^(−αf); a hyperbolic response δ/(1+αf) is available as
an alternative). The index is the weighted sum of indicator stress. Minimising it within a fixed envelope has a
closed-form (water-filling) solution that equalises weighted marginal returns, and crossing coverage with the gap labels
every indicator as *at or near benchmark*, *unfunded*, *partially funded* or *funded*, which separates gaps money has
not reached from gaps that persist where money is concentrated. The efficiency index E (index at the optimum over index
at the actual allocation) depends on the size of the envelope as well as its composition, so the platform always
reports it at a fixed envelope too. The platform computes all of this for any country and year, under five weightings,
five dependency scenarios and both response forms, and lets a ministry score a draft budget before committing it.

## Architecture

```
fsfi-platform/
  PLATFORM_SPEC.md     shared API/data contract (TypeScript types are normative)
  backend/             FastAPI (Python 3.13), port 8010
    fsfi_platform/
      engine/          reference.py (port of the published equations), kkt.py, rust.py (adapter), get_engine()
      assessment.py    one-year assessment, record, scale curves, weights, draft scoring, Fisher–Jenks calibration
      planning.py      multi-year strategic plan and national strategy alignment (demonstration strategy)
      mapping/         line-level mapper + audited rules (budget line → indicator)
      synthetic.py     seeded generator of the four demo countries
      store.py         JSON-file store (data/countries/<id>.json)
    tests/             pytest suite
  frontend/            Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, port 3010
```

- **Engine.** Index, optimum and efficiency go through `get_engine()`. When the compiled Rust extension `fsfi_engine`
  is importable it is used where it agrees with the reference implementation to 1e-9 (index and efficiency); the
  optimum, and everything the Rust engine lacks, comes from the Python reference. Without the extension the platform
  runs entirely on the reference implementation. `/api/health` and every assessment's `meta` report which engine
  computed what, and the compute time.
- **Frontend.** Data fetched with SWR from the API; URL-synced controls (`?year=&weighting=&scenario=&response=`);
  Recharts and custom SVG charts; KaTeX equations. Design system: evergreen `#0F3D33`, ivory `#F6F1E7`, saffron
  `#C9A227` and their tints only.

## Quick start (Windows, PowerShell)

**Backend** (Python 3.13):

```powershell
cd fsfi-platform\backend
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
# optional: the prebuilt Rust engine wheel (fsfi_engine, cp313 win_amd64); see backend/README.md
.venv\Scripts\python -m uvicorn fsfi_platform.main:app --host 127.0.0.1 --port 8010
```

Health check: <http://127.0.0.1:8010/api/health> · interactive API docs: <http://127.0.0.1:8010/docs>.
On start-up the four synthetic countries are (re)generated into `backend/data/countries/` if missing or produced by an
older generator version; `python -m fsfi_platform.synthetic` regenerates them explicitly and prints their headlines.

**Frontend** (Node 22):

```powershell
cd fsfi-platform\frontend
npm install
copy .env.example .env.local     # NEXT_PUBLIC_API_URL=http://127.0.0.1:8010/api
npm run dev -- --port 3010       # development, http://localhost:3010
npm run build; npm run start     # production build, also on port 3010
```

**Environment variables**

| Variable | Where | Default | Meaning |
|---|---|---|---|
| `FSFI_ENGINE` | backend | `auto` | `auto` (Rust where it matches the reference to 1e-9, else reference), `rust` (force Rust; exponential response only), `reference` |
| `FSFI_DATA_DIR` | backend | `backend/data/countries` | where country profiles are stored |
| `NEXT_PUBLIC_API_URL` | frontend | `http://127.0.0.1:8010/api` | base URL of the API (baked in at build time) |

The backend allows CORS from `http://localhost:3010` and `http://127.0.0.1:3010`.

## The four synthetic countries

All four are fictional, seeded and deterministic: six fiscal years t0–t5, currency "DU m" (demo units, millions),
the 37-indicator framework with about 31 indicators assessed a year, and 800–1,100 synthetic budget lines whose mapped
totals equal the indicator allocations exactly.

Each country starts from one of four stylised budget archetypes (infrastructure-heavy, balanced, aid-dependent,
nutrition-led). The archetype centres are round, a-priori component shares documented in `backend/fsfi_platform/synthetic.py`
(`ARCHETYPES`); the demonstration calibration (`calibration_demo.json`) holds one low-concentration Dirichlet draw around
each centre, symmetric Dirichlet splits within components, Beta draws of partner-finance shares, and illustrative gap
means and sensitivities. Nothing in it is fitted to a real country. Each country's stress and coverage class breaks are
calibrated by Fisher–Jenks on its own synthetic record.

| Country | Design | What it demonstrates |
|---|---|---|
| **Republic of Aurelia**: *infrastructure-heavy allocator* | Most money on roads, market places, storage, processing and irrigation; research, animal systems, environment and finance thinly funded; about a quarter of gaps imputed; envelope growing by about two thirds t0→t5. | A typical diagnosis: unfunded gaps hold a small share of the envelope and most of the stress, efficiency well below 1, a negative elasticity, and an optimum that moves money out of the infrastructure components. |
| **Borealis**: *near-optimal allocator* | Balanced archetype, allocation close to its own optimum, every gap measured. | High efficiency (E ≈ 0.9) and an envelope equivalent near 1×: what a well-composed budget looks like. |
| **Cordova**: *aid-dependent* | Large on-budget partner finance (budget lines tagged `external`) withdrawn at t3 on its five most partner-financed components. | The withdrawal registers in the record: the envelope index drops, point-in-time and accumulated stress jump and decay slowly. |
| **Deltana**: *nutrition-led, divergent gaps* | Nutrition the largest component, component gap means drawn far apart, all gaps measured. | How gap data, as well as money, drive the optimum and the diagnosis. |

## Building the platform for a country

Open **Build for a country** (`/builder`). The six-step wizard keeps a draft in the browser until you save.

1. **Identity**: name, tagline, description and currency label (allocations are entered in this unit; millions
   recommended). Start from the reference framework, or clone a synthetic country to pre-fill every step.
2. **Framework**: include or exclude components, rename them, toggle any of the 37 reference indicators, and add
   custom indicators (name, component, direction, unit). Download the indicator list as CSV
   (`/api/templates/indicators.csv`).
3. **Indicator data**: per year, observed value and benchmark for each indicator. Leave *observed* blank to impute
   (placeholder ½·benchmark when higher is better, 1.5·benchmark when lower is better; flagged as imputed everywhere).
   Indicators without a benchmark in a year are not assessed that year. Or upload a records CSV with the columns
   `year,code,observed,benchmark,allocation` (template: `/api/templates/records.csv`).
4. **Financing**: allocations per indicator and year, or upload executed budget lines with the columns
   `year,agency,sub_programme,line,budget_tag,amount` (template: `/api/mapping/template`). The mapper assigns each line
   to an indicator by audited rules, in order: pre-assigned rules, overhead lines (shared pro rata within their
   sub-programme, agency-year or agency), road and line phrases, late phrases, sub-programme and agency rules, and
   finally a residual by budget tag. It reports what it could not assign, and every year in the file fills that year's
   allocations. The same mapper runs on any country's **Budget lines** page.
5. **Parameters**: sensitivity α per component (choose α so that α·f is roughly 0.2–3 at the component's budget), the
   AHP pairwise matrix with live consistency ratio, dependency matrices per scenario, persistence rates for accumulated
   stress. Published defaults are pre-filled.
6. **Review**: a live assessment (`POST /api/assess`) of the latest year; fix any listed issues, then **Save** to
   create the country and open its dashboard.

Saved custom countries can be cloned or deleted from **Countries**. With three or more years saved, the **Record** page
offers a Fisher–Jenks recalibration of the stress and coverage class breaks from the country's own record
(`POST /api/countries/{id}/calibrate`), with goodness of variance fit and sample-size warnings; **Apply** saves them.

## Data confidentiality

Every country shipped with the platform is synthetic: values are drawn by a seeded generator from a synthetic
demonstration calibration, budget lines are generated from rule templates, and no real country, ministry or currency is
named anywhere. Synthetic countries are read-only through the API and carry a "Synthetic demonstration data" badge in the
UI. Custom countries exist only in the local JSON store (`FSFI_DATA_DIR`) of the machine running the backend.

## Tests

```powershell
cd fsfi-platform\backend
.venv\Scripts\python -m pytest -q          # 168 tests
cd ..\frontend
npm run build                               # type-checks and builds the frontend
node scripts\contract-check.mjs            # optional: checks live API responses against the TypeScript contract
```

The backend suite covers every equation against the published reference implementation, Rust ≈ reference within
1e-9, the KKT optimality conditions, analytic versus numerical elasticity, the mapper against the expected assignment
of the synthetic budget, that each synthetic country's allocations equal its mapped budget lines, the calibration targets
of the demo countries, per-assessment timing (< 50 ms) and every endpoint. `test_masking_platform.py` runs only when the
private masking files of the paper's restricted data are present beside the repository and skips in a public clone.
