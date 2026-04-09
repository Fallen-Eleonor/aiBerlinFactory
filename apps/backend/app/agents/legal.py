from __future__ import annotations

from app.data import EVIDENCE_LIBRARY
from app.models import AnalyzeRequest, LegalChecklistItem, LegalOutput
from app.services.narrative import investor_intent


def recommend_entity(request: AnalyzeRequest) -> tuple[str, str, list[str], str]:
    raising = investor_intent(request.goals)
    capital = request.available_capital_eur
    foreign_founder = request.founder_background.foreign_founder

    if capital < 25_000 and not raising:
        return (
            "UG (haftungsbeschraenkt)",
            "Available capital is below EUR 25,000 and the current brief does not require immediate investor-standard governance, so a UG is the fastest and most capital-efficient route.",
            [
                "Min. capital can stay low while preserving a later GmbH conversion path.",
                "Formation costs remain lower than a full GmbH setup.",
                "The team can validate demand before locking in a larger capital structure.",
            ],
            "Retain 25% of annual profits until the company reaches the EUR 25,000 level typically associated with a later GmbH conversion.",
        )

    rationale = [
        "Investor-facing fundraising strongly favors a GmbH over a UG.",
        "Capital is already sufficient to support the standard German limited-liability structure.",
        "Starting directly as a GmbH avoids a later legal conversion and extra notary work.",
    ]
    if foreign_founder:
        rationale.append("A GmbH also helps present a clearer governance package for cross-border founder setups.")

    return (
        "GmbH",
        "The company reads as investor-ready or sufficiently capitalized, so a GmbH is the cleaner long-term structure for German incorporation.",
        rationale,
        "If the founder team stays below the EUR 25,000 threshold, it can still start as a UG and convert later once the financing plan is clearer.",
    )


def estimate_costs(entity: str) -> tuple[int, int]:
    if entity == "UG (haftungsbeschraenkt)":
        return 900, 4
    return 3_800, 7


def build_incorporation_steps(request: AnalyzeRequest, entity: str) -> list[LegalChecklistItem]:
    capital_text = "EUR 12,500 initial payment" if entity == "GmbH" else "Lean initial capital deposit"
    return [
        LegalChecklistItem(
            title="IHK Namenscheck",
            description=f"Validate the company name for {request.company_name} with the local IHK before the notary draft is finalized.",
            owner="Founder + IHK",
            eta="1-3 days",
            estimated_cost_eur=0,
        ),
        LegalChecklistItem(
            title="Gesellschaftsvertrag",
            description="Prepare the articles of association and shareholder structure for the notary appointment.",
            owner="Founder + Notary",
            eta="2-4 days",
            estimated_cost_eur=250,
        ),
        LegalChecklistItem(
            title="Notartermin",
            description="Sign the incorporation documents and management appointment with a German notary.",
            owner="Founder + Notary",
            eta="1 day",
            estimated_cost_eur=650,
        ),
        LegalChecklistItem(
            title="Stammkapital",
            description=f"Open the business account and complete the {capital_text} transfer before Handelsregister filing.",
            owner="Founder + Bank",
            eta="3-7 days",
            estimated_cost_eur=0,
        ),
        LegalChecklistItem(
            title="Handelsregister",
            description="The notary files the company with the Amtsgericht and the entity becomes active after registration.",
            owner="Notary + Amtsgericht",
            eta="2-6 weeks",
            estimated_cost_eur=150,
        ),
    ]


def build_post_incorporation_steps(request: AnalyzeRequest) -> list[LegalChecklistItem]:
    return [
        LegalChecklistItem(
            title="Gewerbeanmeldung",
            description=f"Register the trade locally in {request.bundesland} once Handelsregister entry is complete.",
            owner="Founder + Gewerbeamt",
            eta="1 day",
            estimated_cost_eur=35,
        ),
        LegalChecklistItem(
            title="Finanzamt registration",
            description="Submit the tax registration questionnaire and request the Steuernummer and USt-IdNr.",
            owner="Founder + Finanzamt",
            eta="1-2 weeks",
            estimated_cost_eur=0,
        ),
        LegalChecklistItem(
            title="Business banking live",
            description="Finalize cards, accounting connections, and expense flows after the capital deposit clears.",
            owner="Founder + Bank",
            eta="2-5 days",
            estimated_cost_eur=0,
        ),
        LegalChecklistItem(
            title="Compliance pages",
            description="Publish Impressum, Datenschutzerklaerung, and cookie consent before public launch.",
            owner="Founder + Ops",
            eta="1-2 days",
            estimated_cost_eur=0,
        ),
    ]


def build_legal_output(request: AnalyzeRequest) -> LegalOutput:
    entity, reasoning, entity_rationale, conversion_note = recommend_entity(request)
    estimated_cost_eur, estimated_weeks = estimate_costs(entity)
    foreign_founder = request.founder_background.foreign_founder
    score = 72 if entity == "UG (haftungsbeschraenkt)" else 84
    if foreign_founder:
        score = max(score - 3, 55)

    narrative = (
        f"{request.company_name} can move onto a notary-ready German formation path with a recommended {entity} structure. "
        f"The next gate is a clean name check, notary appointment, and capital deposit sequence across roughly {estimated_weeks} weeks."
    )

    if foreign_founder:
        conversion_note = (
            f"{conversion_note} Because the founder setup is cross-border, budget extra time for passport, apostille, and translation requirements."
        )

    return LegalOutput(
        recommended_entity=entity,
        reasoning=reasoning,
        entity_rationale=entity_rationale,
        incorporation_steps=build_incorporation_steps(request, entity),
        post_incorporation_checklist=build_post_incorporation_steps(request),
        documents=[
            "gesellschaftsvertrag.docx",
            "founder-resolution-summary.txt",
            "handelsregister-checklist.txt",
        ],
        estimated_cost_eur=estimated_cost_eur,
        estimated_weeks=estimated_weeks,
        score=score,
        narrative=narrative,
        conversion_note=conversion_note,
        evidence=EVIDENCE_LIBRARY["legal"],
    )
