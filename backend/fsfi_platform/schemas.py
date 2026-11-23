"""Pydantic v2 models mirroring the TypeScript types of PLATFORM_SPEC.md section 3.

Fields marked "extension" are additions to the contract (documented in the spec); all contract fields are
present with the contract's names and types."""
from __future__ import annotations

from typing import Dict, List, Literal, Optional, Tuple

from pydantic import BaseModel, ConfigDict, Field

Direction = Literal["higher", "lower"]
Weighting = Literal["hybrid", "equal", "expert", "network", "financial"]
Response = Literal["exponential", "hyperbolic"]
StressClass = Literal["low", "medium", "high", "critical"]
Diagnosis = Literal["at_benchmark", "unfunded_gap", "partially_funded_gap", "funded_gap"]
Engine = Literal["rust", "reference"]


class _M(BaseModel):
    model_config = ConfigDict(extra="ignore")


class Component(_M):
    id: str
    name: str
    short: str


class Indicator(_M):
    code: str
    name: str
    component: str
    direction: Direction
    unit: Optional[str] = None
    benchmark_type: Optional[str] = None


class IndicatorYear(_M):
    observed: Optional[float] = None
    benchmark: float
    allocation: float = Field(ge=0)


class YearRecord(_M):
    year: str
    envelope: float = 0.0
    indicators: Dict[str, IndicatorYear]


class Breaks(_M):
    indicator: List[float]
    component: List[float]
    system: List[float]
    coverage: List[float]


class BudgetLine(_M):
    id: int
    year: str
    agency: str
    sub_programme: str
    line: str
    budget_tag: str
    amount: float
    indicator: Optional[str] = None
    component: Optional[str] = None
    line_class: Optional[Literal["specific", "supportive"]] = None
    rule: Optional[str] = None
    stage: Optional[str] = None


class CountryProfile(_M):
    id: str
    name: str
    tagline: str = ""
    description: str = ""
    kind: Literal["synthetic", "custom"]
    currency: str
    components: List[Component]
    indicators: List[Indicator]
    sensitivities: Dict[str, float]
    ahp_matrix: List[List[float]]
    dependency_matrices: Dict[str, List[List[float]]]
    persistence: Dict[str, Tuple[float, float]]
    breaks: Breaks
    years: List[YearRecord]
    budget_lines: Optional[List[BudgetLine]] = None
    created_at: str
    updated_at: str
    # extensions
    ahp_matrices: Optional[Dict[str, List[List[float]]]] = None
    hybrid_coefficients: Optional[Dict[str, float]] = None
    strategy: Optional[dict] = None  # extension: national strategy for the alignment analysis


class CountryProfileIn(_M):
    """Body of POST /api/countries, PUT /api/countries/{id} and the profile of POST /api/assess: as CountryProfile
    with id, kind, timestamps and method parameters optional (framework defaults fill what is missing)."""
    id: Optional[str] = None
    name: str
    tagline: str = ""
    description: str = ""
    kind: Optional[Literal["synthetic", "custom"]] = None
    currency: str = "CU m"
    components: Optional[List[Component]] = None
    indicators: Optional[List[Indicator]] = None
    sensitivities: Optional[Dict[str, float]] = None
    ahp_matrix: Optional[List[List[float]]] = None
    dependency_matrices: Optional[Dict[str, List[List[float]]]] = None
    persistence: Optional[Dict[str, Tuple[float, float]]] = None
    breaks: Optional[Breaks] = None
    years: List[YearRecord] = []
    budget_lines: Optional[List[BudgetLine]] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    ahp_matrices: Optional[Dict[str, List[List[float]]]] = None
    hybrid_coefficients: Optional[Dict[str, float]] = None
    strategy: Optional[dict] = None  # extension: national strategy for the alignment analysis


class SummaryLatest(_M):
    year: str
    fsfsi: float
    fsfsi_acc: float
    efficiency: float
    stress_class: StressClass


class SeriesPoint(_M):
    year: str
    fsfsi: float
    efficiency: float


class CountrySummary(_M):
    id: str
    name: str
    tagline: str
    kind: Literal["synthetic", "custom"]
    currency: str
    years: List[str]
    n_indicators: int
    latest: SummaryLatest
    series: List[SeriesPoint] = []  # extension: FSFSI / E per year for sparklines


class IndicatorResult(_M):
    code: str
    name: str
    component: str
    direction: Direction
    gap: float
    imputed: bool
    allocation: float
    share: float
    stress: float
    acc_stress: float
    coverage: float
    weight: float
    stress_class: StressClass
    diagnosis: Diagnosis
    optimal_allocation: float
    optimal_share: float
    marginal_return: float


class ComponentResult(_M):
    id: str
    name: str
    weight: float
    share: float
    stress: float
    acc_stress: float
    mean_gap: float
    coverage: float
    stress_class: StressClass
    diagnosis: Diagnosis
    optimal_share: float
    shift_pp: float
    held_optimal_share: float
    held_shift_pp: float
    n_indicators: int
    n_imputed: int


class DiagnosisSummary(_M):
    diagnosis: Diagnosis
    count: int
    envelope_share: float
    stress_share: float


class SystemResult(_M):
    fsfsi: float
    fsfsi_acc: float
    fsfsi_opt: float
    fsfsi_opt_held: float
    efficiency: float
    efficiency_held: float
    efficiency_fixed_t0: float
    efficiency_fixed_latest: float  # extension
    elasticity: float
    envelope: float
    envelope_index: float
    envelope_multiple: float
    envelope_multiple_held: float
    front_loaded_10pct: float
    financing_response: float
    stress_class: StressClass
    # pydantic reserves no name "lambda" but Python does; use an alias
    lambda_: float = Field(alias="lambda", serialization_alias="lambda")
    ahp_cr: float

    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class FrontLoadedPoint(_M):
    moved: float
    captured: float


class EngineFunctions(_M):
    index: Engine
    optimum: Engine
    efficiency: Engine


class AssessmentMeta(_M):
    engine: Engine
    compute_ms: float
    breaks: Breaks
    engine_functions: Optional[EngineFunctions] = None  # extension


class Assessment(_M):
    country_id: str
    year: str
    weighting: Weighting
    scenario: str
    response: Response
    system: SystemResult
    components: List[ComponentResult]
    indicators: List[IndicatorResult]
    diagnosis_summary: List[DiagnosisSummary]
    front_loaded: List[FrontLoadedPoint]
    meta: AssessmentMeta


class TSComponent(_M):
    stress: float
    acc_stress: float
    share: float


class TSYear(_M):
    year: str
    fsfsi: float
    fsfsi_acc: float
    efficiency: float
    efficiency_fixed_t0: float
    envelope_index: float
    n_assessed: int
    n_imputed: int
    components: Dict[str, TSComponent]
    diagnosis_summary: List[DiagnosisSummary]
    envelope: float  # extension
    stress_class: StressClass  # extension


class TimeSeries(_M):
    country_id: str
    weighting: Weighting
    scenario: str
    response: Response
    years: List[TSYear]


class ScaleCurve(_M):
    year: str
    response: Response
    efficiency: List[float]
    elasticity: float
    own_multiple: float
    own_efficiency: float


class ScaleCurves(_M):
    country_id: str
    reference_year: str
    multiples: List[float]
    curves: List[ScaleCurve]
    reference_envelope: float  # extension


class WeightVectors(_M):
    ahp: List[float]
    pagerank: List[float]
    cascade: List[float]
    financial: List[float]
    hybrid: List[float]


class WeightsReport(_M):
    country_id: str
    year: str
    scenario: str
    components: List[str]
    vectors: WeightVectors
    ahp_cr: float
    dependency_matrix: List[List[float]]
    scenarios: List[str]
    hybrid_coefficients: Dict[str, float]  # extension


class BudgetLinesPage(_M):
    items: List[BudgetLine]
    total: int
    page: int  # extension
    page_size: int  # extension
    years: List[str] = []  # extension: years present in the budget


class StageSummary(_M):
    lines: int
    amount: float


class MappingSummary(_M):
    by_indicator: Dict[str, float]
    by_component: Dict[str, float]
    by_stage: Dict[str, StageSummary]
    unassigned_amount: float
    total_amount: float
    no_pathway_amount: float = 0.0  # extension


class MappingResult(_M):
    lines: List[BudgetLine]
    summary: MappingSummary


class DraftComponent(_M):
    id: str
    share: float
    stress: float


class DraftScore(_M):
    fsfsi: float
    efficiency: float
    fsfsi_opt: float
    stress_class: StressClass
    components: List[DraftComponent]
    diagnosis_summary: List[DiagnosisSummary]
    delta_vs_actual: float
    compute_ms: float
    envelope: float  # extension


class DraftRequest(_M):
    year: Optional[str] = None
    component_shares: Optional[Dict[str, float]] = None
    indicator_allocations: Optional[Dict[str, float]] = None
    envelope_multiplier: Optional[float] = 1.0
    weighting: Weighting = "hybrid"
    scenario: str = "normal_operations"
    response: Response = "exponential"


class CalibrateRequest(_M):
    weighting: Weighting = "hybrid"
    scenario: str = "normal_operations"
    response: Response = "exponential"
    apply: bool = False


class CalibrateResult(_M):
    breaks: Breaks
    gvf: Dict[str, float]
    n: Dict[str, int]
    published: Breaks
    warnings: List[str]
    applied: bool = False


class AssessRequest(_M):
    profile: CountryProfileIn
    year: Optional[str] = None
    weighting: Weighting = "hybrid"
    scenario: str = "normal_operations"
    response: Response = "exponential"


class CloneRequest(_M):
    name: str


class Health(_M):
    status: Literal["ok"]
    engine: Engine
    version: str
    # extensions
    engine_mode: str
    rust_available: bool
    engine_functions: EngineFunctions
    rust_agreement: Dict[str, float]
