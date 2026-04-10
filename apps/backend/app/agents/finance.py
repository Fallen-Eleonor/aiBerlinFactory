from __future__ import annotations

from app.data import EVIDENCE_LIBRARY, GEWERBESTEUER_RATES, SALARY_BENCHMARKS
from app.models import AnalyzeRequest, FinanceOutput, FinanceScenario, FundingProgram, SalaryBenchmark
from app.services.narrative import deep_tech_intent, format_eur, investor_intent


EMPLOYER_LOAD = 1.2


def midpoint(low: int, high: int) -> int:
    return int((low + high) / 2)


def stage_for_request(request: AnalyzeRequest) -> str:
    if request.available_capital_eur >= 25_000 or investor_intent(request.goals):
        return "seed_ready"
    if request.available_capital_eur >= 12_000:
        return "structured_bootstrap"
    return "bootstrapped"


def monthly_cost_from_roles(roles: tuple[str, ...]) -> int:
    annual_gross = sum(midpoint(*SALARY_BENCHMARKS[role]) for role in roles)
    return int(annual_gross * EMPLOYER_LOAD / 12)


def deep_tech_company(request: AnalyzeRequest) -> bool:
    return deep_tech_intent(request.industry, request.goals)


def estimate_salary_budget(request: AnalyzeRequest) -> int:
    stage = stage_for_request(request)
    founder_count_adjustment = max(request.founder_count - 1, 0)

    if stage == "seed_ready":
        base = 5_800 + founder_count_adjustment * 800
        if deep_tech_company(request):
            base += 1_000
        return base
    if stage == "structured_bootstrap":
        return 2_300 + founder_count_adjustment * 450
    return 850 + founder_count_adjustment * 200


def fixed_costs(request: AnalyzeRequest) -> int:
    stage = stage_for_request(request)
    if stage == "seed_ready":
        return 2_200
    if stage == "structured_bootstrap":
        return 1_400
    return 700


def compute_monthly_burn(request: AnalyzeRequest) -> int:
    return estimate_salary_budget(request) + fixed_costs(request)


def compute_runway(capital: int, monthly_burn: int) -> int:
    if monthly_burn <= 0:
        return 24
    return max(1, capital // monthly_burn)


def build_chart_data(capital: int, burn: int) -> list[dict[str, int]]:
    data: list[dict[str, int]] = []
    conservative_burn = int(burn * 1.15)
    optimistic_burn = int(burn * 0.85)
    for month in range(0, 25):
        data.append(
            {
                "month": month,
                "cash_base": max(capital - burn * month, 0),
                "cash_conservative": max(capital - conservative_burn * month, 0),
                "cash_optimistic": max(capital - optimistic_burn * month, 0),
            }
        )
    return data


def eligibility(request: AnalyzeRequest) -> dict[str, bool]:
    deep_tech = deep_tech_company(request)
    return {
        "exist": request.founder_background.university_affiliation and request.available_capital_eur < 25_000,
        "kfw": request.available_capital_eur <= 125_000,
        "eic": request.founder_background.research_spinout or deep_tech,
        "htgf": deep_tech or investor_intent(request.goals),
    }


def build_funding_programs(request: AnalyzeRequest, flags: dict[str, bool]) -> list[FundingProgram]:
    return [
        FundingProgram(
            name="EXIST-Gruenderstipendium",
            eligible=flags["exist"],
            max_amount_eur=36_000,
            summary="Best fit for university-linked founders who need non-dilutive support before fundraising.",
        ),
        FundingProgram(
            name="KfW StartGeld",
            eligible=flags["kfw"],
            max_amount_eur=125_000,
            summary="Debt capital for young German companies that need early operating runway.",
        ),
        FundingProgram(
            name="EIC Accelerator",
            eligible=flags["eic"],
            max_amount_eur=2_500_000,
            summary="Relevant for deep-tech companies that can support an EU-scale innovation case.",
        ),
        FundingProgram(
            name="HTGF readiness",
            eligible=flags["htgf"],
            max_amount_eur=1_000_000,
            summary="Signal that the company should prepare investor-facing materials for a German pre-seed process.",
        ),
    ]


def build_salary_benchmarks(stage: str) -> list[SalaryBenchmark]:
    roles = ["Junior Developer", "Senior Developer", "Product Manager", "Werkstudent"]
    if stage == "seed_ready":
        roles.append("Data or ML Engineer")

    unique_roles: list[str] = []
    for role in roles:
        if role not in unique_roles:
            unique_roles.append(role)

    return [
        SalaryBenchmark(
            role=role,
            annual_gross_low_eur=SALARY_BENCHMARKS[role][0],
            annual_gross_high_eur=SALARY_BENCHMARKS[role][1],
            contract_type="Werkstudent" if role == "Werkstudent" else "Full-time employee",
        )
        for role in unique_roles
    ]


def build_finance_output(request: AnalyzeRequest) -> FinanceOutput:
    burn = compute_monthly_burn(request)
    available = request.available_capital_eur
    conservative_burn = int(burn * 1.15)
    optimistic_burn = int(burn * 0.85)
    runway_months = {
        "conservative": compute_runway(available, conservative_burn),
        "base": compute_runway(available, burn),
        "optimistic": compute_runway(available, optimistic_burn),
    }
    trade_tax = GEWERBESTEUER_RATES[request.bundesland]
    elig = eligibility(request)
    stage = stage_for_request(request)
    recommended_raise = 650_000 if stage == "seed_ready" else 150_000 if stage == "structured_bootstrap" else 90_000
    recommended_raise_timing_month = max(runway_months["base"] - 4, 1)
    assumptions = [
        "Employer costs use a 20% load on gross salary.",
        "Runway is modeled against available cash only and excludes revenue upside.",
        "Hiring burn uses phased hiring timing rather than assuming every benchmark role starts on day one.",
        f"Gewerbesteuer for {request.bundesland} is modeled at roughly {trade_tax}%.",
    ]

    if elig["exist"]:
        assumptions.append("EXIST can extend non-dilutive runway if the university link is active.")

    narrative = (
        f"Estimated monthly burn is {format_eur(burn)} with a base runway of {runway_months['base']} months. "
        f"To avoid operating on the edge, start raise preparation by month {recommended_raise_timing_month} and target about {format_eur(recommended_raise)}."
    )

    return FinanceOutput(
        monthly_burn_eur=burn,
        runway_months=runway_months,
        scenarios=[
            FinanceScenario(
                label="conservative",
                runway_months=runway_months["conservative"],
                monthly_burn_eur=conservative_burn,
                note="Adds hiring and tooling sooner, compressing runway.",
            ),
            FinanceScenario(
                label="base",
                runway_months=runway_months["base"],
                monthly_burn_eur=burn,
                note="Balanced path using the current plan and timing.",
            ),
            FinanceScenario(
                label="optimistic",
                runway_months=runway_months["optimistic"],
                monthly_burn_eur=optimistic_burn,
                note="Assumes a leaner team ramp and tighter vendor spend.",
            ),
        ],
        recommended_raise_eur=recommended_raise,
        recommended_raise_timing_month=recommended_raise_timing_month,
        tax_notes=[
            "Koerperschaftsteuer is generally 15% on profits.",
            f"Gewerbesteuer in the selected Bundesland is modeled at about {trade_tax}%.",
            "Employer social cost is modeled with a 20% uplift on gross salary.",
            "Umsatzsteuer is usually 19%, with different handling if the company remains very small.",
        ],
        funding_programs=build_funding_programs(request, elig),
        salary_benchmarks=build_salary_benchmarks(stage),
        eligibility=elig,
        chart_data=build_chart_data(available, burn),
        assumptions=assumptions,
        score=58 if stage == "bootstrapped" else 68 if stage == "structured_bootstrap" else 80,
        narrative=narrative,
        evidence=EVIDENCE_LIBRARY["finance"],
    )
