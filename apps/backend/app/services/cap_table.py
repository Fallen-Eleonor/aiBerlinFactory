from __future__ import annotations

from app.models import AnalyzeRequest, CapTableAllocation, CapTableOutput, DilutionPreview, FinanceOutput, LegalOutput


def _round_percent(value: float) -> float:
    return round(value, 1)


def _founder_allocations(request: AnalyzeRequest, option_pool_percent: float, advisor_pool_percent: float) -> list[CapTableAllocation]:
    founder_pool_percent = 100.0 - option_pool_percent - advisor_pool_percent
    founder_count = max(request.founder_count, 1)
    per_founder = _round_percent(founder_pool_percent / founder_count)
    allocations: list[CapTableAllocation] = []
    assigned_total = 0.0

    for index in range(founder_count):
        ownership = per_founder
        if index == founder_count - 1:
            ownership = _round_percent(founder_pool_percent - assigned_total)
        else:
            assigned_total += per_founder
        allocations.append(
            CapTableAllocation(
                holder=f"Founder {index + 1}",
                role="Managing director candidate" if index == 0 else "Co-founder",
                ownership_percent=ownership,
                notes="Standard 4-year vesting with a 1-year cliff is recommended once outside investors enter the cap table.",
            )
        )

    return allocations


def _option_pool_percent(request: AnalyzeRequest, finance: FinanceOutput) -> float:
    if finance.eligibility.get("htgf") or request.available_capital_eur >= 25_000:
        return 10.0
    if request.founder_count >= 3:
        return 8.0
    return 6.0


def _advisor_pool_percent(request: AnalyzeRequest) -> float:
    return 3.0 if request.founder_count == 1 else 2.0


def build_cap_table_output(request: AnalyzeRequest, legal: LegalOutput, finance: FinanceOutput) -> CapTableOutput:
    option_pool_percent = _option_pool_percent(request, finance)
    advisor_pool_percent = _advisor_pool_percent(request)
    allocations = _founder_allocations(request, option_pool_percent, advisor_pool_percent)
    founder_pool_percent = _round_percent(sum(allocation.ownership_percent for allocation in allocations))

    if finance.eligibility.get("htgf"):
        pre_money_eur = 2_500_000
        new_money_eur = 750_000
        round_name = "Pre-seed equity round"
    elif request.available_capital_eur >= 25_000:
        pre_money_eur = 1_500_000
        new_money_eur = 400_000
        round_name = "Angel round"
    else:
        pre_money_eur = 750_000
        new_money_eur = 150_000
        round_name = "Bridge / micro-seed round"

    dilution_percent = _round_percent((new_money_eur / (pre_money_eur + new_money_eur)) * 100)
    founder_pool_post_raise_percent = _round_percent(founder_pool_percent * (1 - dilution_percent / 100))

    summary = (
        f"{request.company_name} should stay founder-controlled now, reserve {option_pool_percent:.0f}% for the first hires, "
        f"and keep a small {advisor_pool_percent:.0f}% advisory pool for legal, finance, or scientific support."
    )

    entity_fit = (
        "A GmbH pairs well with a cleaner investor-ready equity story."
        if legal.recommended_entity == "GmbH"
        else "A UG can still support a disciplined founder split today and convert later once financing is clearer."
    )

    return CapTableOutput(
        entity_fit=entity_fit,
        summary=summary,
        founder_pool_percent=founder_pool_percent,
        option_pool_percent=option_pool_percent,
        advisor_pool_percent=advisor_pool_percent,
        allocations=allocations,
        dilution_preview=DilutionPreview(
            round_name=round_name,
            pre_money_eur=pre_money_eur,
            new_money_eur=new_money_eur,
            dilution_percent=dilution_percent,
            founder_pool_post_raise_percent=founder_pool_post_raise_percent,
            notes="This is a presentation-grade dilution preview, not a legal financing document.",
        ),
        evidence=[
            {
                "title": "BMJ GmbH framework",
                "issuer": "Bundesministerium der Justiz",
                "rationale": "Supports the recommendation to keep the ownership structure simple and incorporation-ready.",
                "url": "https://www.gesetze-im-internet.de/gmbhg/",
            },
            {
                "title": "German VC ecosystem expectations",
                "issuer": "Startup OS founder-readiness model",
                "rationale": "Supports the use of an ESOP reserve and a simple founder-controlled cap table before a pre-seed round.",
                "url": None,
            },
        ],
    )
