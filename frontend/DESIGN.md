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
- `next/font/google` for Inter (all screen text and figures), IBM Plex Mono (indicator codes and mapping rules) and
  Source Serif 4 (printed pages only).
  Self-hosted at build time.
- Removed: `motion` (all animation), the dark-mode toggle, gradients, glass and blur effects, grain textures, count-up
  numbers, pill buttons and decorative icons.

## Tokens (`app/globals.css`)

Cool slate neutrals carry most of the screen; there is one brand colour (forest green), one second data colour (steel
blue) and amber for highlights only. Red and green are kept for meaning and are not used as decoration.

| Token | Hex | Use |
|---|---|---|
| `--paper` | `#F6F8FA` | Page background |
| `--ivory` | `#EEF2F6` | Panels, side navigation, table header fill |
| `--surface` | `#FFFFFF` | Tables, cards, inputs, figures |
| `--ink` | `#111C2D` | Body text (16.1:1 on paper) |
| `--ink-muted` | `#3F4D60` | Secondary text (7.6:1 on ivory) |
| `--ink-subtle` | `#586579` | Metadata, axis labels; the lightest text colour allowed (5.3:1 on ivory) |
| `--evergreen` | `#0E3B2E` | Brand: headings, navigation bar, primary buttons, focus ring |
| `--green-700` | `#17634C` | Links (6.4:1 on ivory) |
| `--steel` | `#2F5D8C` | Second data colour: budget share, draft, shift towards the optimum |
| `--saffron-bright` | `#D9A93A` | Decorative accent on evergreen only (active navigation marker) |
| `--saffron` / `--saffron-mark` | `#9A6208` | Amber highlight marks and reference lines (4.8:1 on paper) |
| `--saffron-ink` | `#7F5206` | Amber text on light (synthetic-data badge) |
| `--neutral-mark` | `#758396` | Reference marks, money given up at the optimum, low stress |
| `--alert` | `#B42318` | Errors |
| `--positive` / `--warning` | `#047857` / `#C4520E` | Semantic only |
| `--rule` | `#E1E6ED` | Dividers and table row lines |
| `--rule-strong` | `#7D8CA0` | Input borders and chart axes (3.2:1 on paper) |

Older chart code still uses `--canvas`, `--line` and `--ink-N`; these are aliases of the tokens above.

**Diagnosis.** Unfunded gap `#B42318` (red), partially funded `#D9A13B` (light amber, ink text on the fill), funded
gap `#1F64A8` (blue), at benchmark `#047857` (green). **Stress classes** form a ramp that darkens with severity: low
`--neutral-mark` drawn hollow, medium `#D9A13B`, high `#C4520E`, critical `#8E1B12`. Both sets pass the `dataviz`
validator for colour-vision-deficient and normal-vision separation (diagnosis: worst adjacent pair ΔE 15.1 deutan,
16.0 normal). The light amber sits at 2.3:1 on white, so it never appears without a text label, and every chart has a
table view. Reallocation charts use steel (receives money) and slate (gives money up), so that red, amber and green
keep their diagnostic meaning.

**Heatmaps** use one hue, evergreen over white. The middle of the ramp is skipped so each cell's number keeps 4.5:1
(ink on the light half, white on the dark half).

**Elevation and corners.** Cards carry a faint `shadow-sm`; popovers, menus and dialogs use `--elevation`. Corners are 4 px
on controls and badges, 6 px on inputs and 8 px on cards.

**Focus.** 2 px evergreen outline with a 2 px paper offset on every interactive element; saffron outline on the
evergreen header. `scroll-padding` keeps focused targets clear of the sticky header and the draft-scoring footer.

## Type

Inter for every heading, label, table and figure. It is a neo-grotesque drawn for screens, with tabular lining figures,
and two character variants are switched on to separate look-alike glyphs: `cv05` (l with a tail) and `cv08` (I with
serifs). Tables, chart axes, KPIs and numeric inputs use `tabular-nums lining-nums slashed-zero`, so columns align and 0
reads differently from O. IBM Plex Mono is kept for indicator codes and mapping rules. Printed pages are set in Source
Serif 4.

Scale: 13 px (`text-micro`, `text-xs`: axis ticks, badges, table headers), 14 px (`text-small`, `t-caption`), 15 px
(`text-ui`, `t-ui`: controls, navigation, table body), 16 px body, 18 px lead, then `t-h4` 17, `t-h3` 20, `t-h2` 28,
`t-h1` 36 and `t-display` 48 px on wide screens. Nothing on screen is set below 13 px. Headings are semibold with
slightly tightened tracking. Reading text sits in a 68-character measure. The custom size names are registered with
`tailwind-merge` in `lib/utils.ts`; without that, `cn()` reads them as colours and drops one of a size/colour pair.

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
