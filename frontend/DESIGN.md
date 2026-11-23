# FSFSI platform: design system

This file records how the frontend implements `docs/design_research/FSFI_DESIGN_BRIEF.md`. The brief is binding; where
this file and the brief differ, the brief wins and this file should be corrected.

## Stack

- Next.js 16 (App Router), React 19, TypeScript, Tailwind v4.
- shadcn/ui components copied into `components/ui/` (configuration in `components.json`), on Radix primitives from the
  `radix-ui` package and `class-variance-authority`, re-themed: 2 px radius on controls, 4 px on panels, no shadows on
  static content, the brief's tokens throughout.
- TanStack Table v8 for every data grid (`components/data-table.tsx`).
- Recharts 3 for charts, always inside the one shared `Figure` component (`components/charts/figure.tsx`).
- `next/font/google` for Source Serif 4 (headings), IBM Plex Sans (UI, body, tables) and IBM Plex Mono (codes).
  Self-hosted at build time.
- Removed: `motion` (all animation), the dark-mode toggle, gradients, glass and blur effects, grain textures, count-up
  numbers, pill buttons and decorative icons.

## Tokens (`app/globals.css`)

| Token | Hex | Use |
|---|---|---|
| `--paper` | `#FBF8F2` | Page background |
| `--ivory` | `#F6F1E7` | Alternate bands, side navigation, table header fill |
| `--surface` | `#FFFFFF` | Tables, panels, inputs, figures |
| `--ink` | `#1F2A27` | Body text (13.96:1 on paper) |
| `--ink-muted` | `#4A5A55` | Secondary text |
| `--ink-subtle` | `#5C6B66` | Metadata, axis labels; the lightest text colour allowed |
| `--evergreen` | `#0F3D33` | Headings, navigation bar, primary buttons, focus ring |
| `--saffron-bright` | `#C9A227` | Decorative accent on evergreen only (active navigation marker) |
| `--saffron` / `--saffron-mark` | `#9A7814` | Saffron chart marks on light backgrounds (3.68:1) |
| `--saffron-ink` | `#7A5F0E` | Saffron-family text on light (synthetic-data badge) |
| `--green-700` | `#2C5B4D` | Links, secondary series |
| `--green-500` | `#5F8476` | Lighter series |
| `--neutral-mark` | `#7F8C88` | Reference marks, "at benchmark" |
| `--alert` | `#B8461F` | Unfunded gap, critical stress, errors |
| `--rule` | `#E6DDCB` | Decorative dividers and table row lines |
| `--rule-strong` | `#8C8574` | Input borders and chart axes (3.26:1) |

Older chart code still uses `--canvas`, `--line` and `--ink-N`; these are aliases of the tokens above.

**Diagnosis and stress classes.** Unfunded gap / critical: `--alert`. Partially funded / medium: `--green-500`.
Funded / high: `--evergreen`. At benchmark / low: `--neutral-mark`, drawn hollow (outline on white) wherever it sits
beside filled marks. The three filled colours pass the `dataviz` validator for CVD and normal-vision separation
(worst pair ΔE 10.4 deutan, 19.4 normal). The validator flags the brand ramp's low chroma and evergreen's lightness as
outside its categorical band; that is accepted because the classes are ordinal and are always labelled in text
(badges, direct labels, legends), so colour never carries meaning alone.

**Heatmaps** use one hue, evergreen over white. The middle of the ramp is skipped so each cell's number keeps 4.5:1
(ink on the light half, white on the dark half).

**Elevation.** One shadow (`--elevation`) for popovers, menus and dialogs only; `shadow-sm`/`md` resolve to none.

**Focus.** 2 px evergreen outline with a 2 px paper offset on every interactive element; saffron outline on the
evergreen header. `scroll-padding` keeps focused targets clear of the sticky header and the draft-scoring footer.

## Type

Source Serif 4 for `h1`/`h2` and the landing statement; IBM Plex Sans for everything else. Scale classes `t-display`,
`t-h1`, `t-h2`, `t-h3`, `t-h4`, `t-lead`, `t-ui`, `t-caption`, `t-micro` follow brief §5.3. Tables, charts, KPIs and the
context bar use `tabular-nums lining-nums`. No chart or table text is below 12 px. Reading text sits in a 68-character
measure.

## Components

| Component | File | Notes |
|---|---|---|
| Button, Card, Badge, Tabs, Breadcrumb, Accordion, Select, Segmented (ToggleGroup), Slider, Switch, Tooltip, Sheet, Dialog, Table, Separator, Skeleton, Input | `components/ui/*` | shadcn/ui, re-themed |
| `DataTable` | `components/data-table.tsx` | `<caption>`, `scope`, sortable headers with `aria-sort` and a live region, right-aligned numbers, units in headers, sticky header, frozen first column, zebra rows, CSV export |
| `Figure` | `components/charts/figure.tsx` | The single chart wrapper: finding-led title, subtitle with unit and year, Chart / Table / Download CSV tabs on the same rows, source line (from `FigureSourceProvider`), notes |
| `Kpi`, `KpiRow` | `components/kpi.tsx` | Value, unit, reference year, comparison and a visible one-line definition; four per row at most |
| Context bar | `components/shell/country-shell.tsx` | Assessment year, budget envelope, data vintage, model version |
| Charts | `components/charts/*` | Sorted bars (component stress), diverging bars (reallocation), dumbbell (current vs optimal), paired bars (budget vs stress by diagnosis), bullet bars (draft scoring), dot plot and small multiples (comparison), lines, heatmaps. No pie, donut, gauge or radar |
| `CitationBlock` | `components/citation-block.tsx` | Copy, BibTeX, RIS; DOI placeholder in `lib/site.ts` |
| `MethodDiagram`, `DisplayMath` | `components/method-diagram.tsx`, `components/math.tsx` | Six-stage pipeline; equations as native MathML |
| Empty, loading, error states | `components/states.tsx` | Skeletons shaped like the final layout; errors in plain language with a technical-detail disclosure |

Column definitions shared by tables and figure CSVs live in `lib/columns.tsx` and `lib/csv.ts`.

## Page structure

| Route | Layout |
|---|---|
| `/` | Hero (21:9 photograph with baked evergreen overlay), then sections in argument order: questions answered, method in brief, one live chart from the API, audience, citation, partners |
| `/method` | 3:1 header image; six numbered steps, each with equation, plain-language paragraph, a worked example read live from a demonstration assessment, and assumptions; sticky table of contents |
| `/assessments` | All countries as a sortable table; build, clone and delete |
| `/countries` | Country comparison: filter bar with active-filter chips, sortable table, dot plot for two to four pinned countries, small multiples on one scale |
| `/score` | Explainer above the draft-scoring tool, with a country picker |
| `/countries/[id]/*` | Workspace: left step navigation (disclosure menu below 1024 px), breadcrumb, `h1`, context bar, controls, then the page. Overview: KPI row, ranked component stress, reallocation diverging bar, component table, indicator diagnosis plane. Draft scoring: entry table on the left, live score and bullet bars on the right, sticky footer with Save, Export, Print and Reset |
| `/data` | Licence in plain words; datasets grouped as Inputs, Outputs, Code and API; data dictionary; API use; data versions |
| `/about` | Purpose, team, governance, citation, version history, partners, licence, photo credits, contact |
| `/builder` | Six-step wizard for a new country |

Every number on the site comes from the API at render time; demonstration countries carry a "Synthetic
demonstration data" badge wherever they are named.

## Print

`@media print` hides navigation, controls and tabs, sets a white page and an 11 pt serif body, widens figures to the
column, breaks before each major section and prints the page URL and access date at the foot of every page.

## Photography

Six photographs from the brief's verified list, cropped to fixed ratios, toned (duotone #0F3D33 / #F6F1E7, or a
desaturated evergreen overlay behind the hero text), converted to WebP with all metadata removed by
`scripts/process-images.mjs`. Photographer, source URL, licence, treatment and the candidates rejected are in
`public/images/CREDITS.md`; the About page lists the same credits.

## Checks

- `npm run typecheck`, `npm run lint`, `npm run build`.
- `scripts/screenshot.cjs` takes full-page screenshots of every route at 1440 px and 390 px and reports horizontal
  overflow (Playwright supplied through `NODE_PATH`; output in the git-ignored `scripts/screenshots/`).
