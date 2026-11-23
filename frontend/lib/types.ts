// Types mirror PLATFORM_SPEC.md §3 exactly. Do not drift from the contract.

export type Direction = "higher" | "lower";
export type Weighting = "hybrid" | "equal" | "expert" | "network" | "financial";
export type ResponseForm = "exponential" | "hyperbolic";
export type StressClass = "low" | "medium" | "high" | "critical";
export type Diagnosis = "at_benchmark" | "unfunded_gap" | "partially_funded_gap" | "funded_gap";

export interface Component {
  id: string;
  name: string;
  short: string;
}

export interface Indicator {
  code: string;
  name: string;
  component: string;
  direction: Direction;
  unit?: string;
  benchmark_type?: string;
}

export interface IndicatorYear {
  observed: number | null;
  benchmark: number;
  allocation: number;
}

export interface YearRecord {
  year: string;
  envelope: number;
  indicators: Record<string, IndicatorYear>;
}

export interface Breaks {
  indicator: number[];
  component: number[];
  system: number[];
  coverage: number[];
}

export interface BudgetLine {
  id: number;
  year: string;
  agency: string;
  sub_programme: string;
  line: string;
  budget_tag: string;
  amount: number;
  indicator: string | null;
  component: string | null;
  line_class: "specific" | "supportive" | null;
  rule: string | null;
  stage: string | null;
}

export interface CountryProfile {
  id: string;
  name: string;
  tagline: string;
  description: string;
  kind: "synthetic" | "custom";
  currency: string;
  components: Component[];
  indicators: Indicator[];
  sensitivities: Record<string, number>;
  ahp_matrix: number[][];
  dependency_matrices: Record<string, number[][]>;
  persistence: Record<string, [number, number]>;
  breaks: Breaks;
  years: YearRecord[];
  budget_lines?: BudgetLine[];
  created_at: string;
  updated_at: string;
}

export interface CountrySummary {
  id: string;
  name: string;
  tagline: string;
  kind: "synthetic" | "custom";
  currency: string;
  years: string[];
  n_indicators: number;
  latest: {
    year: string;
    fsfsi: number;
    fsfsi_acc: number;
    efficiency: number;
    stress_class: StressClass;
  };
  /** backend extension: per-year headline series */
  series?: { year: string; fsfsi: number; efficiency: number }[];
}

export interface IndicatorResult {
  code: string;
  name: string;
  component: string;
  direction: Direction;
  gap: number;
  imputed: boolean;
  allocation: number;
  share: number;
  stress: number;
  acc_stress: number;
  coverage: number;
  weight: number;
  stress_class: StressClass;
  diagnosis: Diagnosis;
  optimal_allocation: number;
  optimal_share: number;
  marginal_return: number;
}

export interface ComponentResult {
  id: string;
  name: string;
  weight: number;
  share: number;
  stress: number;
  acc_stress: number;
  mean_gap: number;
  coverage: number;
  stress_class: StressClass;
  diagnosis: Diagnosis;
  optimal_share: number;
  shift_pp: number;
  held_optimal_share: number;
  held_shift_pp: number;
  n_indicators: number;
  n_imputed: number;
}

export interface DiagnosisSummary {
  diagnosis: Diagnosis;
  count: number;
  envelope_share: number;
  stress_share: number;
}

export interface SystemResult {
  fsfsi: number;
  fsfsi_acc: number;
  fsfsi_opt: number;
  fsfsi_opt_held: number;
  efficiency: number;
  efficiency_held: number;
  efficiency_fixed_t0: number;
  elasticity: number;
  envelope: number;
  envelope_index: number;
  envelope_multiple: number;
  envelope_multiple_held: number;
  front_loaded_10pct: number;
  financing_response: number;
  stress_class: StressClass;
  lambda: number;
  ahp_cr: number;
}

export interface Assessment {
  country_id: string;
  year: string;
  weighting: Weighting;
  scenario: string;
  response: ResponseForm;
  system: SystemResult;
  components: ComponentResult[];
  indicators: IndicatorResult[];
  diagnosis_summary: DiagnosisSummary[];
  front_loaded: { moved: number; captured: number }[];
  meta: { engine: "rust" | "reference"; compute_ms: number; breaks: Breaks };
}

export interface TimeSeriesYear {
  year: string;
  fsfsi: number;
  fsfsi_acc: number;
  efficiency: number;
  efficiency_fixed_t0: number;
  envelope_index: number;
  n_assessed: number;
  n_imputed: number;
  components: Record<string, { stress: number; acc_stress: number; share: number }>;
  diagnosis_summary: DiagnosisSummary[];
}

export interface TimeSeries {
  country_id: string;
  weighting: Weighting;
  scenario: string;
  response: ResponseForm;
  years: TimeSeriesYear[];
}

export interface ScaleCurve {
  year: string;
  response: ResponseForm;
  efficiency: number[];
  elasticity: number;
  own_multiple: number;
  own_efficiency: number;
}

export interface ScaleCurves {
  country_id: string;
  reference_year: string;
  multiples: number[];
  curves: ScaleCurve[];
}

export interface WeightsReport {
  country_id: string;
  year: string;
  scenario: string;
  components: string[];
  vectors: { ahp: number[]; pagerank: number[]; cascade: number[]; financial: number[]; hybrid: number[] };
  ahp_cr: number;
  dependency_matrix: number[][];
  scenarios: string[];
}

export interface MappingResult {
  lines: BudgetLine[];
  summary: {
    by_indicator: Record<string, number>;
    by_component: Record<string, number>;
    by_stage: Record<string, { lines: number; amount: number }>;
    unassigned_amount: number;
    total_amount: number;
  };
}

export interface DraftScore {
  fsfsi: number;
  efficiency: number;
  fsfsi_opt: number;
  stress_class: StressClass;
  components: { id: string; share: number; stress: number }[];
  diagnosis_summary: DiagnosisSummary[];
  delta_vs_actual: number;
  compute_ms: number;
}

export interface DraftRequest {
  year: string;
  component_shares?: Record<string, number>;
  indicator_allocations?: Record<string, number>;
  envelope_multiplier?: number;
  weighting?: Weighting;
  scenario?: string;
  response?: ResponseForm;
}

export interface Health {
  status: "ok";
  engine: string;
  version: string;
}

export interface FrameworkDefaults {
  ahp_matrix: number[][];
  dependency_matrices: Record<string, number[][]>;
  hybrid_coefficients: Record<string, number>;
  persistence: Record<string, [number, number]>;
  breaks: Breaks;
  sensitivities: Record<string, number>;
}

export interface Framework {
  components: Component[];
  indicators: Indicator[];
  defaults: FrameworkDefaults;
}

export interface BudgetLinesPage {
  items: BudgetLine[];
  total: number;
}

export interface CalibrateResult {
  breaks: Breaks;
  gvf: { indicator: number; component: number; coverage: number };
  n: { indicator: number; component: number; coverage: number };
  published: Breaks;
  warnings: string[];
  applied: boolean;
}

/** /api/evidence is "flattened" per the spec; fields are optional and defensively read. */
export interface EvidenceRecovery {
  sign_rate_all?: number | null;
  sign_rate_material?: number | null;
  sign_rate_material_mcse?: number | null;
  gap_blind_sign_rate_material?: number | null;
  constant_rule_sign_rate_material?: number | null;
  gain_over_gap_blind?: number | null;
  diagnosis_accuracy?: number | null;
  diagnosis_kappa?: number | null;
}
export interface EvidenceE1 extends EvidenceRecovery {
  experiment: string;
  scenario: string;
  country: string;
  response: ResponseForm;
  arm: string;
}
export interface EvidenceE2 extends EvidenceRecovery {
  scenario: string;
  country: string;
  response: ResponseForm;
  sigma_c: number;
  sigma_i: number;
  bias: number;
}
export interface EvidenceE5 extends EvidenceRecovery {
  experiment: string;
  scenario: string;
  country: string;
  mechanism: string;
  q: number;
  sigma_c: number;
}
export interface EvidenceE6 {
  scenario: string;
  channel: string;
  offbudget: number;
  withdrawal_share: number;
  registered_share_point?: number | null;
  sign_rate_material_t2?: number | null;
  sign_rate_material_t3?: number | null;
  [k: string]: unknown;
}
export interface Evidence {
  source?: string;
  master_seed?: number | null;
  n_rep?: number;
  mcse_target_proportion?: number | null;
  materiality_pp?: number | null;
  countries?: { id: string; name: string; demo_country?: string; design: string }[];
  e1?: EvidenceE1[];
  e2?: EvidenceE2[];
  e5?: EvidenceE5[];
  e6?: EvidenceE6[];
  verification?: Record<string, number | null>;
}

export interface Controls {
  year?: string;
  weighting: Weighting;
  scenario: string;
  response: ResponseForm;
}

/* ------------------------------------------------------------ planning and strategy alignment */

export type PlanCurve = "linear" | "smoothstep" | "frontloaded";

export interface PlanParams {
  horizon: number;
  target_reduction: number;
  growth: number;
  curve: PlanCurve;
  pace: number;
}

export interface PlanYear {
  year: string;
  step: number;
  envelope: number;
  additional: number;
  fsfsi: number;
  fsfsi_acc: number;
  year_target: number;
  on_track: boolean;
  bau_fsfsi: number;
  bau_fsfsi_acc: number;
  stress_class: StressClass;
  components: Record<string, { share: number; stress: number; acc_stress: number }>;
}

export interface PlanComponent {
  id: string;
  name: string;
  share: number;
  end_share: number;
  shift_pp: number;
  stress: number;
  acc_stress: number;
  end_acc_stress: number;
  bau_end_acc_stress: number;
  change_pct: number;
  end_class: StressClass;
}

export interface PlanSummary {
  final_fsfsi: number;
  final_fsfsi_acc: number;
  bau_final_fsfsi_acc: number;
  reduction: number;
  bau_reduction: number;
  reached: boolean;
  first_year_on_target: string | null;
  years_on_track: number;
  cumulative_additional: number;
  final_envelope: number;
  required_growth: number | null;
  composition_gain: number;
  residual_high: string[];
}

export interface Plan {
  country_id: string;
  weighting: Weighting;
  scenario: string;
  response: ResponseForm;
  params: PlanParams;
  base: { year: string; fsfsi: number; fsfsi_acc: number; envelope: number; efficiency: number };
  target: number;
  summary: PlanSummary;
  years: PlanYear[];
  components: PlanComponent[];
  assumptions: string[];
}

export type TargetStatus = "achieved" | "on_track" | "behind" | "off_track" | "no_data";

export interface StrategyTarget {
  code: string;
  area: string;
  indicator: string;
  name: string;
  component: string;
  direction: Direction;
  unit?: string | null;
  baseline: number | null;
  current: number | null;
  benchmark: number | null;
  target: number | null;
  expected: number | null;
  progress: number | null;
  expected_progress: number;
  status: TargetStatus;
  stress: number | null;
  diagnosis: Diagnosis | null;
}

export interface StrategyArea {
  code: string;
  name: string;
  description: string;
  components: { id: string; name: string }[];
  n_indicators: number;
  target_share: number;
  actual_share: number;
  optimal_share: number;
  plan_share: number;
  deviation_pp: number;
  acc_stress: number;
  plan_end_acc_stress: number;
  bau_end_acc_stress: number;
  plan_reduction_pct: number;
  targets: number;
  targets_on_track: number;
}

export interface StrategyReport {
  country_id: string;
  year: string;
  strategy: { name: string; source: string; description: string; unmapped_components: string[] };
  alignment: { actual: number; optimum: number; plan: number };
  index: {
    actual: number;
    optimum: number;
    strategy_optimum: number;
    efficiency_actual: number;
    efficiency_strategy: number;
    strategy_gain: number;
    strategy_cost: number;
  };
  areas: StrategyArea[];
  history: { year: string; alignment: number; shares: Record<string, number> }[];
  tracking: {
    start: string;
    target_year: string;
    periods: number;
    elapsed: number;
    latest: string;
    expected_progress: number;
    targets: StrategyTarget[];
  };
  plan: { params: PlanParams; target: number; summary: PlanSummary; end_year: string };
}

/* ------------------------------------------------------------ external investor programmes */

export type InvestmentSplit = "equal" | "best";

export interface InvestmentRequest extends Partial<PlanParams> {
  name?: string;
  indicators: string[];
  components: string[];
  amount: number;
  years?: number;
  split: InvestmentSplit;
  weighting?: Weighting;
  scenario?: string;
  response?: ResponseForm;
}

export interface InvestmentIndicator {
  code: string;
  name: string;
  component: string;
  selected: boolean;
  added: number;
  best_added: number;
  allocation: number;
  gap: number;
  stress: number;
  stress_with: number;
  reduction: number;
  diagnosis: Diagnosis;
}

export interface InvestmentResult {
  country_id: string;
  year: string;
  programme: {
    name: string;
    split: InvestmentSplit;
    amount: number;
    years: number;
    total: number;
    n_indicators: number;
    indicators: string[];
    components: string[];
    share_of_envelope: number;
  };
  snapshot: {
    fsfsi: number;
    fsfsi_with: number;
    reduction: number;
    reduction_pct: number;
    best_any: number;
    best_selection: number;
    national_proportional: number;
    value_for_money: number;
    value_within_selection: number;
    vs_national: number;
    reduction_per_100: number;
    stress_class: StressClass;
    stress_class_with: StressClass;
  };
  indicators: InvestmentIndicator[];
  components: { id: string; name: string; added: number; best_added: number; stress: number; stress_with: number; reduction: number }[];
  plan: {
    params: PlanParams;
    target: number;
    end_year: string;
    plan_end: number;
    with_end: number;
    additional_reduction: number;
    plan_reached: boolean;
    with_reached: boolean;
    first_year_with: string | null;
    first_year_plan: string | null;
    path: {
      year: string;
      step: number;
      disbursed: number;
      plan_fsfsi: number;
      with_fsfsi: number;
      plan_acc: number;
      with_acc: number;
      year_target: number;
    }[];
  };
  strategy: {
    name: string;
    areas: {
      code: string;
      name: string;
      programme_share: number;
      target_share: number;
      actual_share: number;
      actual_share_with: number;
      deviation_pp: number;
    }[];
    under_target_share: number;
    alignment_before: number;
    alignment_after: number;
  };
}
