export type EmploymentStatus = "full_time" | "part_time" | "student" | "other";

export type Bundesland =
  | "Baden-Wuerttemberg"
  | "Bayern"
  | "Berlin"
  | "Brandenburg"
  | "Bremen"
  | "Hamburg"
  | "Hessen"
  | "Mecklenburg-Vorpommern"
  | "Niedersachsen"
  | "Nordrhein-Westfalen"
  | "Rheinland-Pfalz"
  | "Saarland"
  | "Sachsen"
  | "Sachsen-Anhalt"
  | "Schleswig-Holstein"
  | "Thueringen";

export type FounderBackground = {
  university_affiliation: boolean;
  research_spinout: boolean;
  foreign_founder: boolean;
  employment_status: EmploymentStatus;
};

export type AnalyzeRequest = {
  company_name: string;
  industry: string;
  bundesland: Bundesland;
  founder_count: number;
  available_capital_eur: number;
  goals: string;
  founder_background: FounderBackground;
};

export type DemoPersona = {
  id: string;
  title: string;
  founder: string;
  summary: string;
  request: AnalyzeRequest;
};

export type JobQueuedResponse = {
  job_id: string;
  status: "queued";
};

export type JobSummary = {
  job_id: string;
  status: string;
  created_at: string;
  company_name: string;
  bundesland: Bundesland;
  analysis_mode: "gemini" | "deterministic";
  has_result: boolean;
  completed_tasks: number;
  total_tasks: number;
  latest_message: string | null;
};

export type JobDetails = {
  job_id: string;
  status: string;
  created_at: string;
  company_name: string;
  has_result: boolean;
  analysis_mode: "gemini" | "deterministic";
  last_message: string | null;
};

export type JobTaskStatePayload = {
  tasks: Record<string, boolean>;
};

export type StatusEventType =
  | "job_started"
  | "orchestrator_update"
  | "agent_started"
  | "agent_progress"
  | "agent_completed"
  | "agent_failed"
  | "interaction_answered"
  | "interaction_completed"
  | "agent_rerun_started"
  | "agent_rerun_completed"
  | "coordination_event"
  | "job_completed"
  | "job_failed";

export type StatusEvent = {
  type: StatusEventType;
  timestamp: string;
  job_id: string;
  agent?: string | null;
  message: string;
  detail: Record<string, string | number | boolean>;
};

export type EvidenceReference = {
  title: string;
  issuer: string;
  rationale: string;
};

export type DownloadLink = {
  kind: string;
  url: string;
};

export type LegalChecklistItem = {
  title: string;
  description: string;
  owner: string;
  eta: string;
  estimated_cost_eur: number | null;
};

export type LegalOutput = {
  recommended_entity: string;
  reasoning: string;
  entity_rationale: string[];
  incorporation_steps: LegalChecklistItem[];
  post_incorporation_checklist: LegalChecklistItem[];
  documents: string[];
  estimated_cost_eur: number;
  estimated_weeks: number;
  score: number;
  narrative: string;
  conversion_note: string;
  evidence: EvidenceReference[];
  document_metadata: Record<string, string>;
};

export type FinanceScenario = {
  label: string;
  runway_months: number;
  monthly_burn_eur: number;
  note: string;
};

export type FundingProgram = {
  name: string;
  eligible: boolean;
  max_amount_eur: number | null;
  summary: string;
};

export type SalaryBenchmark = {
  role: string;
  annual_gross_low_eur: number;
  annual_gross_high_eur: number;
  contract_type: string;
};

export type FinanceOutput = {
  currency: "EUR";
  monthly_burn_eur: number;
  runway_months: Record<string, number>;
  scenarios: FinanceScenario[];
  recommended_raise_eur: number;
  recommended_raise_timing_month: number;
  tax_notes: string[];
  funding_programs: FundingProgram[];
  salary_benchmarks: SalaryBenchmark[];
  eligibility: Record<string, boolean>;
  chart_data: Array<{
    month: number;
    cash_base: number;
    cash_conservative: number;
    cash_optimistic: number;
  }>;
  assumptions: string[];
  score: number;
  narrative: string;
  evidence: EvidenceReference[];
};

export type HiringFlag = {
  title: string;
  severity: "info" | "warning" | "critical";
  description: string;
};

export type HiringRole = {
  title: string;
  priority: "now" | "next" | "later";
  contract_type: string;
  annual_cost_low_eur: number;
  annual_cost_high_eur: number;
  rationale: string;
};

export type OrgNode = {
  title: string;
  reports_to: string;
  focus: string;
};

export type HiringOutput = {
  stage: string;
  recommendation: string;
  first_roles: HiringRole[];
  suggested_contract_types: string[];
  org_structure: OrgNode[];
  employment_law_flags: HiringFlag[];
  milestones: string[];
  score: number;
  narrative: string;
  evidence: EvidenceReference[];
};

export type OpsChecklistItem = {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  owner: string;
};

export type ToolRecommendation = {
  category: string;
  tool: string;
  why: string;
  compliance_note: string;
};

export type OpsOutput = {
  dsgvo_checklist: OpsChecklistItem[];
  tool_stack: ToolRecommendation[];
  required_setups: string[];
  e_invoicing_note: string;
  compliance_highlights: string[];
  score: number;
  narrative: string;
  evidence: EvidenceReference[];
};

export type ScoreBreakdownItem = {
  label: string;
  value: number;
  weight: number;
};

export type MissionLogEntry = {
  title: string;
  message: string;
  source: string;
  target: string;
  offset_seconds: number;
};

export type OverviewOutput = {
  recommended_entity: string;
  runway_months_base: number;
  health_score: number;
  health_label: string;
  next_step: string;
  next_milestone: string;
  score_breakdown: ScoreBreakdownItem[];
};

export type AnalysisResult = {
  overview: OverviewOutput;
  legal: LegalOutput;
  finance: FinanceOutput;
  hiring: HiringOutput;
  ops: OpsOutput;
  mission_log: MissionLogEntry[];
  downloads: DownloadLink[];
};

export type InteractionFieldOption = {
  label: string;
  value: string;
};

export type InteractionField = {
  id: string;
  label: string;
  input_type: "text" | "textarea" | "select" | "boolean" | "number";
  placeholder: string | null;
  options: InteractionFieldOption[];
};

export type AgentInteraction = {
  id: string;
  agent: "legal" | "finance" | "hiring" | "ops";
  kind: "input" | "review" | "approval";
  state: "open" | "answered" | "approved" | "completed";
  title: string;
  question: string;
  why_it_matters: string;
  next_impact: string;
  field: InteractionField | null;
  review_notes: string[];
  linked_download_kind: string | null;
  answer: string | number | boolean | null;
  created_at: string;
  answered_at: string | null;
};

export type JobInteractionListPayload = {
  interactions: AgentInteraction[];
};

export type InteractionAnswerResponse = {
  status: "accepted";
  interaction: AgentInteraction;
  result: AnalysisResult;
};
