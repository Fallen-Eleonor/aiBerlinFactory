from app.agents.finance import build_finance_output, compute_monthly_burn
from app.agents.legal import build_legal_output
from app.models import AnalyzeRequest, FounderBackground
from app.services.overview import build_overview


def make_request(**overrides):
    payload = {
        "company_name": "TechVision",
        "industry": "B2B SaaS",
        "bundesland": "Berlin",
        "founder_count": 2,
        "available_capital_eur": 8_000,
        "goals": "Validate before fundraising",
        "founder_background": FounderBackground(
            university_affiliation=True,
            research_spinout=False,
            employment_status="full_time",
        ),
    }
    payload.update(overrides)
    return AnalyzeRequest(**payload)


def test_legal_recommends_ug_for_bootstrapped_case():
    result = build_legal_output(make_request())
    assert result.recommended_entity == "UG (haftungsbeschraenkt)"


def test_legal_recommends_gmbh_for_investor_ready_case():
    result = build_legal_output(make_request(available_capital_eur=50_000, goals="Raise a seed round immediately"))
    assert result.recommended_entity == "GmbH"


def test_finance_applies_employer_load_and_fixed_costs():
    burn = compute_monthly_burn(make_request())
    assert burn > 1_150


def test_finance_eligibility_detects_exist_and_kfw():
    result = build_finance_output(make_request())
    assert result.eligibility["exist"] is True
    assert result.eligibility["kfw"] is True


def test_finance_eligibility_detects_eic_for_research_spinout():
    result = build_finance_output(make_request(industry="Robotics", founder_background=FounderBackground(
        university_affiliation=True,
        research_spinout=True,
        employment_status="full_time",
    )))
    assert result.eligibility["eic"] is True


def test_overview_uses_weighted_scores_and_exist_next_step():
    finance = build_finance_output(make_request())
    overview = build_overview(
        recommended_entity="UG (haftungsbeschraenkt)",
        runway_months_base=finance.runway_months["base"],
        eligibility=finance.eligibility,
        legal_score=72,
        finance_score=58,
        hiring_score=62,
        ops_score=74,
    )

    assert overview.health_score == 66
    assert overview.health_label == "IN PROGRESS"
    assert overview.next_step == "EXIST application prep"
