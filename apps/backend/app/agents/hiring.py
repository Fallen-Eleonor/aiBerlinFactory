from __future__ import annotations

from app.data import EVIDENCE_LIBRARY
from app.models import AnalyzeRequest, HiringFlag, HiringOutput, HiringRole, OrgNode
from app.services.narrative import investor_intent


def hiring_stage(request: AnalyzeRequest) -> str:
    if request.available_capital_eur < 10_000 and not investor_intent(request.goals):
        return "pre_incorporation"
    if request.available_capital_eur < 25_000:
        return "bootstrapped_ug"
    return "seed_funded"


def build_hiring_output(request: AnalyzeRequest) -> HiringOutput:
    stage = hiring_stage(request)
    foreign_founder = request.founder_background.foreign_founder

    if stage == "pre_incorporation":
        roles = [
            HiringRole(
                title="Founder complement or advisor",
                priority="now",
                contract_type="Advisor agreement",
                annual_cost_low_eur=6_000,
                annual_cost_high_eur=18_000,
                rationale="Cover legal or finance blind spots without committing to payroll before incorporation.",
            ),
            HiringRole(
                title="Werkstudent operations support",
                priority="next",
                contract_type="Werkstudent",
                annual_cost_low_eur=14_400,
                annual_cost_high_eur=18_600,
                rationale="Low-cost support for research, admin, and founder enablement.",
            ),
        ]
        org_nodes = [
            OrgNode(title="Founder", reports_to="Board", focus="Customer discovery and incorporation"),
            OrgNode(title="External advisor", reports_to="Founder", focus="Finance or legal sparring"),
        ]
        milestones = [
            "Finish incorporation before adding full-time payroll.",
            "Use advisors or students for targeted support only.",
            "Keep founder capacity focused on validation and not bureaucracy.",
        ]
        flags = [
            HiringFlag(
                title="Probezeit",
                severity="info",
                description="A probation period of up to 6 months is standard once full-time hiring starts.",
            ),
            HiringFlag(
                title="Urlaubsanspruch",
                severity="info",
                description="The statutory minimum is 20 paid vacation days on a 5-day week.",
            ),
        ]
        if foreign_founder:
            flags.append(
                HiringFlag(
                    title="Local payroll admin",
                    severity="warning",
                    description="Cross-border founders should align on local payroll and right-to-work paperwork before hiring.",
                )
            )
        return HiringOutput(
            stage=stage,
            recommendation="Keep the org founder-led until the company is incorporated, then add one low-cost support role before any expensive full-time hire.",
            first_roles=roles,
            suggested_contract_types=["Advisor agreement", "Werkstudent contract"],
            org_structure=org_nodes,
            employment_law_flags=flags,
            milestones=milestones,
            score=46,
            narrative="The current brief points to a founder-heavy setup where compliance and burn control matter more than scaling headcount.",
            evidence=EVIDENCE_LIBRARY["hiring"],
        )

    if stage == "bootstrapped_ug":
        return HiringOutput(
            stage=stage,
            recommendation="Build a lean triangle of founder, Werkstudent, and one tightly-scoped specialist before committing to multiple employees.",
            first_roles=[
                HiringRole(
                    title="Werkstudent growth or operations",
                    priority="now",
                    contract_type="Werkstudent",
                    annual_cost_low_eur=14_400,
                    annual_cost_high_eur=18_600,
                    rationale="The cheapest path to extra execution capacity while staying Germany-compliant.",
                ),
                HiringRole(
                    title="Freelance product designer or engineer",
                    priority="next",
                    contract_type="Freelance agreement",
                    annual_cost_low_eur=18_000,
                    annual_cost_high_eur=36_000,
                    rationale="Useful for short bursts of specialist output before a seed round.",
                ),
                HiringRole(
                    title="Operations manager",
                    priority="later",
                    contract_type="Full-time employee",
                    annual_cost_low_eur=42_000,
                    annual_cost_high_eur=56_000,
                    rationale="Adds process stability once incorporation and fundraising are on track.",
                ),
            ],
            suggested_contract_types=["Werkstudent contract", "Freelance agreement", "Fixed-term employee contract"],
            org_structure=[
                OrgNode(title="Founder", reports_to="Board", focus="Product, sales, and incorporation"),
                OrgNode(title="Werkstudent", reports_to="Founder", focus="Research, ops, and lightweight execution"),
                OrgNode(title="Freelance specialist", reports_to="Founder", focus="Design or engineering sprint work"),
            ],
            employment_law_flags=[
                HiringFlag(
                    title="Scheinselbststaendigkeit",
                    severity="warning",
                    description="German authorities can reclassify dependent freelancers as employees and recover contributions retroactively.",
                ),
                HiringFlag(
                    title="Werkstudent rule",
                    severity="info",
                    description="Keep semester work under 20 hours per week to preserve the standard Werkstudent model.",
                ),
                HiringFlag(
                    title="Probezeit",
                    severity="info",
                    description="Use the first 6 months to pressure-test role fit while termination is still simpler.",
                ),
            ],
            milestones=[
                "Use students and narrowly-scoped freelancers before full payroll.",
                "Document autonomy clearly for any freelance relationship.",
                "Promote the first full-time hire only once runway visibility improves.",
            ],
            score=62,
            narrative="This hiring track keeps payroll light, supports a UG setup, and reduces labor-law risk while the company proves its first thesis.",
            evidence=EVIDENCE_LIBRARY["hiring"],
        )

    return HiringOutput(
        stage=stage,
        recommendation="Plan for a seed-stage core team now, but stay disciplined and keep the first wave below the 10-employee threshold.",
        first_roles=[
            HiringRole(
                title="Senior engineer",
                priority="now",
                contract_type="Full-time employee",
                annual_cost_low_eur=80_000,
                annual_cost_high_eur=92_000,
                rationale="Critical for product velocity and technical credibility before or just after financing.",
            ),
            HiringRole(
                title="Product manager",
                priority="next",
                contract_type="Full-time employee",
                annual_cost_low_eur=70_000,
                annual_cost_high_eur=82_000,
                rationale="Keeps roadmap quality high while founders split fundraising and delivery.",
            ),
            HiringRole(
                title="Werkstudent founder support",
                priority="next",
                contract_type="Werkstudent",
                annual_cost_low_eur=14_400,
                annual_cost_high_eur=18_600,
                rationale="Adds leverage without meaningfully increasing cash burn.",
            ),
            HiringRole(
                title="Founders associate or ops lead",
                priority="later",
                contract_type="Full-time employee",
                annual_cost_low_eur=48_000,
                annual_cost_high_eur=60_000,
                rationale="Useful once investor updates, hiring, and finance operations start consuming founder time.",
            ),
        ],
        suggested_contract_types=["Unlimited employee contract", "Werkstudent contract"],
        org_structure=[
            OrgNode(title="CEO", reports_to="Board", focus="Fundraising and go-to-market"),
            OrgNode(title="CTO", reports_to="Board", focus="Architecture and hiring"),
            OrgNode(title="Senior engineer", reports_to="CTO", focus="Core product delivery"),
            OrgNode(title="Product manager", reports_to="CEO", focus="Roadmap and prioritization"),
            OrgNode(title="Werkstudent", reports_to="CEO", focus="Research, ops, and admin support"),
        ],
        employment_law_flags=[
            HiringFlag(
                title="Kuendigungsschutzgesetz",
                severity="warning",
                description="Once the company grows beyond 10 employees, dismissal protections become materially stricter.",
            ),
            HiringFlag(
                title="Probezeit",
                severity="info",
                description="A 6-month probation window is standard and useful for first-team quality control.",
            ),
            HiringFlag(
                title="Minimum vacation",
                severity="info",
                description="Budget for at least 20 working days of paid vacation per employee each year.",
            ),
        ],
        milestones=[
            "Hire the first technical leader before expanding non-core functions.",
            "Use Werkstudent leverage before a second full-time support hire.",
            "Keep headcount disciplined until financing closes and runway extends.",
        ],
        score=78,
        narrative="The company can credibly present a first-team plan, but it should still sequence hires against financing milestones instead of expanding all at once.",
        evidence=EVIDENCE_LIBRARY["hiring"],
    )
