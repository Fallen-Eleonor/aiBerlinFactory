from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


EmploymentStatus = Literal["full_time", "part_time", "student", "other"]
Bundesland = Literal[
    "Baden-Wuerttemberg",
    "Bayern",
    "Berlin",
    "Brandenburg",
    "Bremen",
    "Hamburg",
    "Hessen",
    "Mecklenburg-Vorpommern",
    "Niedersachsen",
    "Nordrhein-Westfalen",
    "Rheinland-Pfalz",
    "Saarland",
    "Sachsen",
    "Sachsen-Anhalt",
    "Schleswig-Holstein",
    "Thueringen",
]


class FounderBackground(BaseModel):
    university_affiliation: bool = False
    research_spinout: bool = False
    foreign_founder: bool = False
    employment_status: EmploymentStatus = "full_time"


class AnalyzeRequest(BaseModel):
    company_name: str = Field(min_length=2, max_length=120)
    industry: str = Field(min_length=2, max_length=120)
    bundesland: Bundesland
    founder_count: int = Field(ge=1, le=10)
    available_capital_eur: int = Field(ge=0, le=10_000_000)
    goals: str = Field(min_length=4, max_length=400)
    founder_background: FounderBackground


class DemoPersona(BaseModel):
    id: str
    title: str
    founder: str
    summary: str
    request: AnalyzeRequest


class QueuedResponse(BaseModel):
    job_id: str
    status: Literal["queued"]


class JobTaskStatePayload(BaseModel):
    tasks: dict[str, bool] = Field(default_factory=dict)


ChatRole = Literal["user", "assistant"]


class ChatMessage(BaseModel):
    role: ChatRole
    content: str = Field(min_length=1, max_length=4_000)
    created_at: datetime


class JobChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2_000)


class JobChatHistoryPayload(BaseModel):
    messages: list[ChatMessage] = Field(default_factory=list)


class JobSummary(BaseModel):
    job_id: str
    status: str
    created_at: datetime
    company_name: str
    bundesland: Bundesland
    analysis_mode: Literal["gemini", "deterministic"]
    has_result: bool
    completed_tasks: int
    total_tasks: int
    latest_message: str | None = None


class JobDetails(BaseModel):
    job_id: str
    status: str
    created_at: datetime
    company_name: str
    has_result: bool
    analysis_mode: Literal["gemini", "deterministic"]
    last_message: str | None = None


class EvidenceReference(BaseModel):
    title: str
    issuer: str
    rationale: str
    url: str | None = None


class DownloadLink(BaseModel):
    kind: str
    url: str


class LegalChecklistItem(BaseModel):
    title: str
    description: str
    owner: str
    eta: str
    estimated_cost_eur: int | None = None


class LegalOutput(BaseModel):
    recommended_entity: str
    reasoning: str
    entity_rationale: list[str]
    incorporation_steps: list[LegalChecklistItem]
    post_incorporation_checklist: list[LegalChecklistItem]
    documents: list[str]
    estimated_cost_eur: int
    estimated_weeks: int
    score: int
    narrative: str
    conversion_note: str
    evidence: list[EvidenceReference] = Field(default_factory=list)
    document_metadata: dict[str, str] = Field(default_factory=dict)


class FinanceScenario(BaseModel):
    label: str
    runway_months: int
    monthly_burn_eur: int
    note: str


class FundingProgram(BaseModel):
    name: str
    eligible: bool
    max_amount_eur: int | None = None
    summary: str


class SalaryBenchmark(BaseModel):
    role: str
    annual_gross_low_eur: int
    annual_gross_high_eur: int
    contract_type: str


class FinanceOutput(BaseModel):
    currency: Literal["EUR"] = "EUR"
    monthly_burn_eur: int
    runway_months: dict[str, int]
    scenarios: list[FinanceScenario]
    recommended_raise_eur: int
    recommended_raise_timing_month: int
    tax_notes: list[str]
    funding_programs: list[FundingProgram]
    salary_benchmarks: list[SalaryBenchmark]
    eligibility: dict[str, bool]
    chart_data: list[dict[str, int]]
    assumptions: list[str]
    score: int
    narrative: str
    evidence: list[EvidenceReference] = Field(default_factory=list)


class CapTableAllocation(BaseModel):
    holder: str
    role: str
    ownership_percent: float
    notes: str


class DilutionPreview(BaseModel):
    round_name: str
    pre_money_eur: int
    new_money_eur: int
    dilution_percent: float
    founder_pool_post_raise_percent: float
    notes: str


class CapTableOutput(BaseModel):
    entity_fit: str
    summary: str
    founder_pool_percent: float
    option_pool_percent: float
    advisor_pool_percent: float
    allocations: list[CapTableAllocation]
    dilution_preview: DilutionPreview
    evidence: list[EvidenceReference] = Field(default_factory=list)


class HiringFlag(BaseModel):
    title: str
    severity: Literal["info", "warning", "critical"]
    description: str


class HiringRole(BaseModel):
    title: str
    priority: Literal["now", "next", "later"]
    contract_type: str
    annual_cost_low_eur: int
    annual_cost_high_eur: int
    rationale: str


class OrgNode(BaseModel):
    title: str
    reports_to: str
    focus: str


class HiringOutput(BaseModel):
    stage: str
    recommendation: str
    first_roles: list[HiringRole]
    suggested_contract_types: list[str]
    org_structure: list[OrgNode]
    employment_law_flags: list[HiringFlag]
    milestones: list[str]
    score: int
    narrative: str
    evidence: list[EvidenceReference] = Field(default_factory=list)


class OpsChecklistItem(BaseModel):
    title: str
    description: str
    priority: Literal["high", "medium", "low"]
    owner: str


class ToolRecommendation(BaseModel):
    category: str
    tool: str
    why: str
    compliance_note: str


class OpsOutput(BaseModel):
    dsgvo_checklist: list[OpsChecklistItem]
    tool_stack: list[ToolRecommendation]
    required_setups: list[str]
    e_invoicing_note: str
    compliance_highlights: list[str]
    score: int
    narrative: str
    evidence: list[EvidenceReference] = Field(default_factory=list)


class ScoreBreakdownItem(BaseModel):
    label: str
    value: int
    weight: int


class MissionLogEntry(BaseModel):
    title: str
    message: str
    source: str
    target: str
    offset_seconds: float


class OverviewOutput(BaseModel):
    recommended_entity: str
    runway_months_base: int
    health_score: int
    health_label: str
    next_step: str
    next_milestone: str
    score_breakdown: list[ScoreBreakdownItem]


class AnalysisResult(BaseModel):
    overview: OverviewOutput
    legal: LegalOutput
    finance: FinanceOutput
    cap_table: CapTableOutput
    hiring: HiringOutput
    ops: OpsOutput
    mission_log: list[MissionLogEntry]
    downloads: list[DownloadLink]


class EventPayload(BaseModel):
    type: str
    timestamp: datetime
    job_id: str
    agent: str | None = None
    message: str
    detail: dict[str, str | int | bool] = Field(default_factory=dict)
