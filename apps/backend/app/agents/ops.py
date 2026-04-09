from __future__ import annotations

from app.data import EVIDENCE_LIBRARY, OPS_TOOL_STACK
from app.models import AnalyzeRequest, OpsChecklistItem, OpsOutput, ToolRecommendation


def build_ops_output(request: AnalyzeRequest) -> OpsOutput:
    foreign_founder = request.founder_background.foreign_founder
    checklist = [
        OpsChecklistItem(
            title="Datenschutzerklaerung",
            description="Publish a German-compliant privacy policy across the website and the product.",
            priority="high",
            owner="Ops + Legal",
        ),
        OpsChecklistItem(
            title="Impressum",
            description="Every public-facing German website needs a valid legal notice before launch.",
            priority="high",
            owner="Ops + Founder",
        ),
        OpsChecklistItem(
            title="Cookie consent",
            description="Configure opt-in consent for analytics and marketing cookies, not pre-checked banners.",
            priority="high",
            owner="Ops",
        ),
        OpsChecklistItem(
            title="AVV with processors",
            description="Sign data-processing agreements with each SaaS vendor that sees personal data.",
            priority="high",
            owner="Ops + Legal",
        ),
        OpsChecklistItem(
            title="Processing register",
            description="Maintain a Verzeichnis von Verarbeitungstaetigkeiten for core product and recruiting workflows.",
            priority="medium",
            owner="Ops",
        ),
        OpsChecklistItem(
            title="DPO threshold",
            description="Flag the Datenschutzbeauftragter requirement if more than 20 people process personal data regularly.",
            priority="medium",
            owner="Founder",
        ),
    ]

    highlights = [
        "Germany expects opt-in cookie consent for non-essential tracking.",
        "A DATEV-compatible accounting flow prevents pain with local tax advisors later.",
        "B2B startups should be ready to receive e-invoices under the German 2025 regime.",
    ]
    if foreign_founder:
        highlights.append("Foreign founders should budget extra setup time for banking and identity verification.")

    return OpsOutput(
        dsgvo_checklist=checklist,
        tool_stack=[ToolRecommendation(**tool) for tool in OPS_TOOL_STACK],
        required_setups=[
            "EU-hosted backend and documented processor list",
            "German IBAN business bank account for incorporation and operations",
            "Accounting workflow that can export into DATEV",
            "Published Impressum and privacy pages before launch",
        ],
        e_invoicing_note="Germany already requires B2B companies to be able to receive compliant e-invoices, so the accounting stack should support ZUGFeRD or XRechnung workflows from the start.",
        compliance_highlights=highlights,
        score=74 if not foreign_founder else 70,
        narrative=f"{request.company_name} should treat privacy, accounting compatibility, and launch compliance as day-one operating infrastructure rather than later clean-up work.",
        evidence=EVIDENCE_LIBRARY["ops"],
    )
