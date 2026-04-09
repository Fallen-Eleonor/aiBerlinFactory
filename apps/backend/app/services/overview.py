from __future__ import annotations

from app.data import MISSION_LOG_TEMPLATE
from app.models import MissionLogEntry, OverviewOutput, ScoreBreakdownItem


SCORE_WEIGHTS = {
    "Rechtsform": 25,
    "Finanzen": 35,
    "Team": 20,
    "Betrieb": 20,
}


def build_score_breakdown(legal_score: int, finance_score: int, hiring_score: int, ops_score: int) -> list[ScoreBreakdownItem]:
    return [
        ScoreBreakdownItem(label="Rechtsform", value=legal_score, weight=SCORE_WEIGHTS["Rechtsform"]),
        ScoreBreakdownItem(label="Finanzen", value=finance_score, weight=SCORE_WEIGHTS["Finanzen"]),
        ScoreBreakdownItem(label="Team", value=hiring_score, weight=SCORE_WEIGHTS["Team"]),
        ScoreBreakdownItem(label="Betrieb", value=ops_score, weight=SCORE_WEIGHTS["Betrieb"]),
    ]


def calculate_health_score(score_breakdown: list[ScoreBreakdownItem]) -> int:
    return round(sum((item.value * item.weight) for item in score_breakdown) / 100)


def health_label(score: int) -> str:
    if score >= 85:
        return "INVESTMENT-BEREIT"
    if score >= 70:
        return "SEED-BEREIT"
    if score >= 55:
        return "IN PROGRESS"
    return "FRUEHE PHASE"


def determine_next_step(eligibility: dict[str, bool], entity: str) -> str:
    if eligibility.get("exist"):
        return "EXIST application prep"
    if entity == "UG (haftungsbeschraenkt)":
        return "Notary booking"
    return "Investor deck and cap table prep"


def determine_next_milestone(runway_months: int, eligibility: dict[str, bool]) -> str:
    if eligibility.get("kfw") and runway_months < 12:
        return "Extend runway with KfW-ready banking and accounting package"
    if eligibility.get("exist"):
        return "Package university proof and project narrative for EXIST"
    return "Lock the first hire plan before expanding burn"


def build_overview(
    recommended_entity: str,
    runway_months_base: int,
    eligibility: dict[str, bool],
    legal_score: int,
    finance_score: int,
    hiring_score: int,
    ops_score: int,
) -> OverviewOutput:
    score_breakdown = build_score_breakdown(legal_score, finance_score, hiring_score, ops_score)
    score = calculate_health_score(score_breakdown)
    return OverviewOutput(
        recommended_entity=recommended_entity,
        runway_months_base=runway_months_base,
        health_score=score,
        health_label=health_label(score),
        next_step=determine_next_step(eligibility, recommended_entity),
        next_milestone=determine_next_milestone(runway_months_base, eligibility),
        score_breakdown=score_breakdown,
    )


def build_mission_log() -> list[MissionLogEntry]:
    return [MissionLogEntry(**entry) for entry in MISSION_LOG_TEMPLATE]
