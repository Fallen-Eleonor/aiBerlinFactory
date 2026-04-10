from __future__ import annotations

from app.models import AnalyzeRequest, DemoPersona, FounderBackground


GEWERBESTEUER_RATES = {
    "Baden-Wuerttemberg": 15,
    "Bayern": 14,
    "Berlin": 14,
    "Brandenburg": 14,
    "Bremen": 16,
    "Hamburg": 16,
    "Hessen": 15,
    "Mecklenburg-Vorpommern": 14,
    "Niedersachsen": 15,
    "Nordrhein-Westfalen": 16,
    "Rheinland-Pfalz": 15,
    "Saarland": 15,
    "Sachsen": 15,
    "Sachsen-Anhalt": 14,
    "Schleswig-Holstein": 14,
    "Thueringen": 14,
}

BUNDESLAENDER = list(GEWERBESTEUER_RATES.keys())

SALARY_BENCHMARKS = {
    "Junior Developer": (50_000, 58_000),
    "Senior Developer": (80_000, 92_000),
    "Product Manager": (70_000, 82_000),
    "Data or ML Engineer": (70_000, 90_000),
    "Founders Associate": (48_000, 60_000),
    "Operations Manager": (42_000, 56_000),
    "Werkstudent": (14_400, 18_600),
}

OPS_TOOL_STACK = [
    {
        "category": "Accounting",
        "tool": "DATEV",
        "why": "Steuerberater-ready bookkeeping backbone for German reporting.",
        "compliance_note": "Use DATEV export or direct integration from day one.",
    },
    {
        "category": "Accounting",
        "tool": "Lexoffice",
        "why": "Simple invoicing and bookkeeping for early-stage teams.",
        "compliance_note": "Good bridge until the tax advisor wants fuller DATEV workflows.",
    },
    {
        "category": "Banking",
        "tool": "Qonto",
        "why": "Fast business banking with a German IBAN and clean team controls.",
        "compliance_note": "Suitable for Stammkapital deposit and day-one operations.",
    },
    {
        "category": "Payroll",
        "tool": "Personio",
        "why": "Hiring, contracts, and payroll operations in one place.",
        "compliance_note": "Pair with local legal review for contract templates.",
    },
    {
        "category": "Privacy",
        "tool": "Usercentrics",
        "why": "Widely used cookie consent platform with Germany-first posture.",
        "compliance_note": "Configure opt-in by default for non-essential cookies.",
    },
]

EVIDENCE_LIBRARY = {
    "legal": [
        {
            "title": "GmbHG and UG capital structure rules",
            "issuer": "Bundesministerium der Justiz",
            "rationale": "Anchors the UG versus GmbH recommendation in the German limited-liability company framework.",
            "url": "https://www.gesetze-im-internet.de/gmbhg/",
        },
        {
            "title": "IHK name-check and registration guidance",
            "issuer": "Industrie- und Handelskammer",
            "rationale": "Supports the sequence around name validation, notary preparation, and register filing.",
            "url": "https://www.ihk.de/",
        },
    ],
    "finance": [
        {
            "title": "EXIST Gruenderstipendium programme rules",
            "issuer": "Bundesministerium fuer Wirtschaft und Klimaschutz",
            "rationale": "Supports non-dilutive funding eligibility logic for university-linked founders.",
            "url": "https://www.exist.de/",
        },
        {
            "title": "KfW StartGeld overview",
            "issuer": "KfW",
            "rationale": "Supports early debt-financing availability for young German companies.",
            "url": "https://www.kfw.de/",
        },
        {
            "title": "Bundesland Gewerbesteuer assumptions",
            "issuer": "Startup OS deterministic model",
            "rationale": "Documents the location-based trade-tax rate used in the runway model.",
            "url": None,
        },
    ],
    "hiring": [
        {
            "title": "Werkstudent and probation norms",
            "issuer": "German employment-law practice",
            "rationale": "Explains why the first hiring plan favors student leverage and probationary caution.",
            "url": "https://www.personio.com/hr-lexicon/werkstudent/",
        },
        {
            "title": "Dismissal protection thresholds",
            "issuer": "Kanzlei / labor-law guidance baseline",
            "rationale": "Supports the warning around stricter employment protections as headcount rises.",
            "url": "https://www.gesetze-im-internet.de/kschg/",
        },
    ],
    "ops": [
        {
            "title": "DSGVO controller and processor obligations",
            "issuer": "European data-protection regime",
            "rationale": "Supports the privacy checklist, AVV requirements, and processor inventory.",
            "url": "https://gdpr-info.eu/",
        },
        {
            "title": "German B2B e-invoicing rollout",
            "issuer": "Federal tax and invoicing guidance",
            "rationale": "Supports the recommendation to choose accounting tools that can receive compliant e-invoices.",
            "url": "https://www.bundesfinanzministerium.de/",
        },
    ],
}

MISSION_LOG_TEMPLATE = [
    {
        "title": "Legal to Brain",
        "message": "Entity route confirmed for Germany-first incorporation.",
        "source": "legal",
        "target": "orchestrator",
        "offset_seconds": 1.4,
    },
    {
        "title": "Brain to Finance",
        "message": "Capital envelope locked, adjust runway and raise planning.",
        "source": "orchestrator",
        "target": "finance",
        "offset_seconds": 3.2,
    },
    {
        "title": "Finance to Brain",
        "message": "Runway model ready with funding programme checks.",
        "source": "finance",
        "target": "orchestrator",
        "offset_seconds": 6.0,
    },
    {
        "title": "Brain to Hiring",
        "message": "Budget approved for a lean first team and Werkstudent path.",
        "source": "orchestrator",
        "target": "hiring",
        "offset_seconds": 8.3,
    },
    {
        "title": "Hiring to Brain",
        "message": "Org structure and labor-law flags assembled.",
        "source": "hiring",
        "target": "orchestrator",
        "offset_seconds": 11.0,
    },
    {
        "title": "Brain to Ops",
        "message": "Activate DSGVO, accounting, and launch stack recommendations.",
        "source": "orchestrator",
        "target": "ops",
        "offset_seconds": 13.1,
    },
    {
        "title": "Ops to Brain",
        "message": "Compliance baseline and German tooling stack locked.",
        "source": "ops",
        "target": "orchestrator",
        "offset_seconds": 15.9,
    },
    {
        "title": "Brain to All",
        "message": "Synthesis complete, startup readiness score generated.",
        "source": "orchestrator",
        "target": "all",
        "offset_seconds": 18.5,
    },
]

DEMO_PERSONAS = [
    DemoPersona(
        id="max-mueller",
        title="Bootstrapped Solo Founder",
        founder="Max Mueller",
        summary="Berlin SaaS founder with EUR 8k, university link, and a need for a low-cost UG path.",
        request=AnalyzeRequest(
            company_name="TechFlow UG",
            industry="B2B SaaS",
            bundesland="Berlin",
            founder_count=1,
            available_capital_eur=8_000,
            goals="Launch quickly, stay lean, and apply for EXIST before raising later.",
            founder_background=FounderBackground(
                university_affiliation=True,
                research_spinout=False,
                foreign_founder=False,
                employment_status="full_time",
            ),
        ),
    ),
    DemoPersona(
        id="sarah-thomas",
        title="Investor-Ready Deep Tech Team",
        founder="Dr. Sarah Schmidt and Thomas Berger",
        summary="Munich spinout preparing for HTGF conversations with enough capital to justify a GmbH.",
        request=AnalyzeRequest(
            company_name="Quantum Forge",
            industry="Deep tech infrastructure",
            bundesland="Bayern",
            founder_count=2,
            available_capital_eur=60_000,
            goals="Open a GmbH, hire first engineers, and prepare for a seed round with HTGF.",
            founder_background=FounderBackground(
                university_affiliation=True,
                research_spinout=True,
                foreign_founder=False,
                employment_status="full_time",
            ),
        ),
    ),
    DemoPersona(
        id="kamila-nowak",
        title="Non-German Founder Relocating to Berlin",
        founder="Kamila Nowak",
        summary="Marketplace founder who needs plain-language guidance on notary steps and German compliance.",
        request=AnalyzeRequest(
            company_name="MarketBridge",
            industry="Marketplace platform",
            bundesland="Berlin",
            founder_count=1,
            available_capital_eur=18_000,
            goals="Understand the process, stay compliant, and hire a Werkstudent before fundraising.",
            founder_background=FounderBackground(
                university_affiliation=False,
                research_spinout=False,
                foreign_founder=True,
                employment_status="full_time",
            ),
        ),
    ),
]
