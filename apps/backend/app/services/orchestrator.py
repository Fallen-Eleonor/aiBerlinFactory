from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from contextlib import suppress
from typing import Awaitable, Callable

from pydantic import BaseModel

from app.agents.finance import build_finance_output
from app.agents.hiring import build_hiring_output
from app.agents.legal import build_legal_output
from app.agents.ops import build_ops_output
from app.data import MISSION_LOG_TEMPLATE
from app.models import (
    AgentInteraction,
    InteractionField,
    AnalysisResult,
    AnalyzeRequest,
    DownloadLink,
)
from app.services.ai import GeminiAgentService
from app.services.documents import DocumentService
from app.services.jobs import JobStore
from app.services.overview import build_mission_log, build_overview


@dataclass(frozen=True)
class AgentRunner:
    build: Callable[[AnalyzeRequest], BaseModel]
    enrich: Callable[[AnalyzeRequest, BaseModel], Awaitable[BaseModel]]
    start_message: str
    progress_message: str


class Orchestrator:
    def __init__(self, job_store: JobStore, generated_dir: Path, agent_ai: GeminiAgentService) -> None:
        self.job_store = job_store
        self.documents = DocumentService(generated_dir)
        self.agent_ai = agent_ai
        self.agent_runners = {
            "legal": AgentRunner(
                build=build_legal_output,
                enrich=self.agent_ai.enrich_legal,
                start_message="Checking German incorporation path",
                progress_message="Legal agent is evaluating UG vs. GmbH and notary readiness.",
            ),
            "finance": AgentRunner(
                build=build_finance_output,
                enrich=self.agent_ai.enrich_finance,
                start_message="Modeling burn, runway, and funding options",
                progress_message="Finance agent is calculating runway scenarios and public funding paths.",
            ),
            "hiring": AgentRunner(
                build=build_hiring_output,
                enrich=self.agent_ai.enrich_hiring,
                start_message="Planning the first team structure",
                progress_message="Hiring agent is mapping early roles, Werkstudent options, and labor-law flags.",
            ),
            "ops": AgentRunner(
                build=build_ops_output,
                enrich=self.agent_ai.enrich_ops,
                start_message="Reviewing DSGVO and operating stack",
                progress_message="Ops agent is locking privacy, tooling, and launch compliance requirements.",
            ),
        }

    async def run(self, job_id: str, request: AnalyzeRequest) -> AnalysisResult:
        timeline_task: asyncio.Task[None] | None = None
        try:
            self.job_store.set_status(job_id, "running")
            await self.job_store.publish(
                job_id,
                "job_started",
                "Startup OS analysis started.",
                detail={"phase": "intake", "progress": 5},
            )
            await self.job_store.publish(
                job_id,
                "orchestrator_update",
                "Orchestrator is routing the founder brief across all specialist agents.",
                detail={"phase": "routing", "progress": 10},
            )

            timeline_task = asyncio.create_task(self._publish_coordination_timeline(job_id))
            tasks = {
                "legal": asyncio.create_task(self._run_agent(job_id, "legal", request)),
                "finance": asyncio.create_task(self._run_agent(job_id, "finance", request)),
                "hiring": asyncio.create_task(self._run_agent(job_id, "hiring", request)),
                "ops": asyncio.create_task(self._run_agent(job_id, "ops", request)),
            }
            results = await asyncio.gather(*tasks.values(), return_exceptions=True)
            await timeline_task

            resolved: dict[str, BaseModel] = {}
            for agent_name, result in zip(tasks.keys(), results):
                if isinstance(result, Exception):
                    fallback_reason = str(result).splitlines()[0][:220]
                    await self.job_store.publish(
                        job_id,
                        "agent_failed",
                        f"{agent_name.title()} agent crashed and fell back to deterministic output: {fallback_reason}",
                        agent=agent_name,
                        detail={"fallback": True, "progress": 85},
                    )
                    resolved[agent_name] = self.agent_runners[agent_name].build(request)
                else:
                    resolved[agent_name] = result

            legal = resolved["legal"]
            finance = resolved["finance"]
            hiring = resolved["hiring"]
            ops = resolved["ops"]

            await self.job_store.publish(
                job_id,
                "orchestrator_update",
                "Orchestrator is synthesizing agent outputs into a single founder report.",
                detail={"phase": "synthesis", "progress": 92},
            )

            generated_files = self.documents.generate_all(job_id, request, legal)
            document_path = generated_files["gesellschaftsvertrag"]
            legal.document_metadata = {
                "path": str(document_path),
                "kind": "gesellschaftsvertrag",
            }

            overview = build_overview(
                recommended_entity=legal.recommended_entity,
                runway_months_base=finance.runway_months["base"],
                eligibility=finance.eligibility,
                legal_score=legal.score,
                finance_score=finance.score,
                hiring_score=hiring.score,
                ops_score=ops.score,
            )
            result = AnalysisResult(
                overview=overview,
                legal=legal,
                finance=finance,
                hiring=hiring,
                ops=ops,
                mission_log=build_mission_log(),
                downloads=[
                    DownloadLink(kind=kind, url=f"/api/download/{job_id}/{kind}")
                    for kind in generated_files
                ],
            )
            self.job_store.set_result(job_id, result)
            self._refresh_interactions(job_id, result)
            await self.job_store.publish(
                job_id,
                "job_completed",
                "All agent results are ready.",
                detail={"health_score": overview.health_score, "progress": 100},
            )
            return result
        except Exception as error:
            self.job_store.set_failed(job_id)
            error_text = str(error).splitlines()[0][:240]
            await self.job_store.publish(
                job_id,
                "job_failed",
                f"Startup OS analysis failed before completion: {error_text}",
                detail={"progress": 100, "failed": True},
            )
            raise
        finally:
            if timeline_task and not timeline_task.done():
                timeline_task.cancel()
                with suppress(asyncio.CancelledError):
                    await timeline_task

    async def _run_agent(self, job_id: str, agent_name: str, request: AnalyzeRequest):
        runner = self.agent_runners[agent_name]
        await self.job_store.publish(
            job_id,
            "agent_started",
            runner.start_message,
            agent=agent_name,
            detail={"stage": "queued", "progress": 20},
        )
        await asyncio.sleep(0.08)
        await self.job_store.publish(
            job_id,
            "agent_progress",
            runner.progress_message,
            agent=agent_name,
            detail={"stage": "analyzing", "progress": 45},
        )

        if f"[fail-{agent_name}]" in request.goals.lower():
            await self.job_store.publish(
                job_id,
                "agent_failed",
                f"{agent_name.title()} agent was forced into fallback mode.",
                agent=agent_name,
                detail={"fallback": True, "progress": 65},
            )
            return runner.build(request)

        result = runner.build(request)
        await asyncio.sleep(0.08)

        if self.agent_ai.enabled:
            await self.job_store.publish(
                job_id,
                "agent_progress",
                f"{agent_name.title()} agent is refining the deterministic draft with Gemini.",
                agent=agent_name,
                detail={"provider": self.agent_ai.provider_name, "model": self.agent_ai.model_name, "progress": 70},
            )
            try:
                result = await runner.enrich(request, result)
            except Exception as error:
                error_text = str(error).splitlines()[0][:240]
                await self.job_store.publish(
                    job_id,
                    "agent_progress",
                    f"{agent_name.title()} agent kept deterministic fallback after Gemini error: {error_text}",
                    agent=agent_name,
                    detail={"fallback": True, "reason": error_text, "progress": 78},
                )
        else:
            await self.job_store.publish(
                job_id,
                "agent_progress",
                f"{agent_name.title()} agent is using deterministic mode because no Gemini key is configured.",
                agent=agent_name,
                detail={"fallback": True, "progress": 72},
            )

        await asyncio.sleep(0.08)
        await self.job_store.publish(
            job_id,
            "agent_completed",
            f"{agent_name.title()} agent finished.",
            agent=agent_name,
            detail={"stage": "complete", "progress": 88},
        )
        return result

    async def answer_interaction(self, job_id: str, interaction_id: str, value: str | int | bool) -> tuple[AgentInteraction, AnalysisResult]:
        job = self.job_store.get_job(job_id)
        interaction = next((item for item in job.interactions if item.id == interaction_id), None)
        if interaction is None:
            raise ValueError("Interaction not found.")
        if job.result is None:
            raise ValueError("Job result is not ready.")

        updated = interaction.model_copy(deep=True)
        updated.answer = value
        updated.state = "answered"
        updated.answered_at = datetime.now(timezone.utc)
        stored = self.job_store.update_interaction(job_id, interaction_id, updated)
        if stored.context_key:
            self.job_store.set_founder_context_update(job_id, stored.context_key, value)

        await self.job_store.publish(
            job_id,
            "interaction_answered",
            f"{stored.agent.title()} interaction answered by founder.",
            agent=stored.agent,
            detail={"interaction_id": stored.id},
        )

        result = await self._rerun_for_interaction(job_id, stored, value)
        completed = stored.model_copy(deep=True)
        completed.state = "completed"
        self.job_store.update_interaction(job_id, interaction_id, completed)
        refreshed_interactions = self._refresh_interactions(job_id, result)
        stored = next((item for item in refreshed_interactions if item.id == interaction_id), completed)
        await self.job_store.publish(
            job_id,
            "interaction_completed",
            f"{stored.agent.title()} interaction completed and workflow resumed.",
            agent=stored.agent,
            detail={"interaction_id": stored.id},
        )
        return stored, result

    def ensure_interactions(self, job_id: str) -> list[AgentInteraction]:
        job = self.job_store.get_job(job_id)
        if job.result is None:
            return []
        return self._refresh_interactions(job_id, job.result)

    async def _publish_coordination_timeline(self, job_id: str) -> None:
        previous_offset = 0.0
        for entry in MISSION_LOG_TEMPLATE:
            delay = max(entry["offset_seconds"] - previous_offset, 0.4) * 0.05
            previous_offset = entry["offset_seconds"]
            await asyncio.sleep(delay)
            await self.job_store.publish(
                job_id,
                "coordination_event",
                entry["message"],
                agent=entry["source"],
                detail={
                    "source": entry["source"],
                    "target": entry["target"],
                    "offset_ms": int(entry["offset_seconds"] * 1000),
                },
            )

    @staticmethod
    def _build_initial_interactions(result: AnalysisResult) -> list[AgentInteraction]:
        return [
            AgentInteraction(
                id="legal_registered_address",
                agent="legal",
                kind="input",
                state="open",
                title="Confirm registered office",
                question="What registered business address should be used in the incorporation documents?",
                why_it_matters="Legal needs the company address before the Gesellschaftsvertrag can move from draft to final-ready.",
                next_impact="Regenerates the document package and refreshes the legal readiness state.",
                context_key="registered_address",
                rerun_targets=["legal", "overview"],
                artifact_targets=["gesellschaftsvertrag", "founder-resolution-summary", "handelsregister-checklist"],
                field=InteractionField(
                    id="registered_address",
                    label="Registered address",
                    input_type="text",
                    placeholder="Linienstrasse 10, 10119 Berlin",
                ),
                linked_download_kind="gesellschaftsvertrag",
                created_at=datetime.now(timezone.utc),
            ),
            AgentInteraction(
                id="finance_founder_salary",
                agent="finance",
                kind="input",
                state="open",
                title="Confirm founder salary assumption",
                question="What monthly founder salary should the runway model assume?",
                why_it_matters="Finance can give a more realistic runway and raise timing once founder compensation is explicit.",
                next_impact="Refreshes the runway model, assumptions, and financing narrative.",
                context_key="founder_salary_eur",
                rerun_targets=["finance", "overview"],
                field=InteractionField(
                    id="founder_salary_eur",
                    label="Monthly salary (EUR)",
                    input_type="number",
                    placeholder="3500",
                ),
                created_at=datetime.now(timezone.utc),
            ),
            AgentInteraction(
                id="hiring_first_role",
                agent="hiring",
                kind="input",
                state="open",
                title="Choose first hire focus",
                question="Which role should the hiring agent prioritize first?",
                why_it_matters="Hiring sequencing is still generic until the founder decides the first role.",
                next_impact="Updates the first-role recommendation and hiring milestones.",
                context_key="first_hire_role",
                rerun_targets=["hiring", "overview"],
                field=InteractionField(
                    id="first_hire_role",
                    label="First role",
                    input_type="select",
                    options=[
                        {"label": "Founding engineer", "value": "Founding engineer"},
                        {"label": "Sales / growth", "value": "Sales / growth"},
                        {"label": "Operations", "value": "Operations"},
                    ],
                ),
                created_at=datetime.now(timezone.utc),
            ),
            AgentInteraction(
                id="ops_launch_review",
                agent="ops",
                kind="review",
                state="open",
                title="Approve operations launch draft",
                question="Approve the current compliance and operating-stack draft to continue.",
                why_it_matters="Ops has produced a draft recommendation and needs founder sign-off before treating it as final.",
                next_impact="Locks the current operations draft and refreshes the overall readiness view.",
                context_key="ops_launch_approved",
                rerun_targets=["ops", "overview"],
                review_notes=[
                    f"{len(result.ops.tool_stack)} Germany-first tools recommended",
                    f"{len(result.ops.dsgvo_checklist)} DSGVO checklist items prepared",
                    "E-invoicing guidance is already attached to the draft",
                ],
                created_at=datetime.now(timezone.utc),
            ),
        ]

    def _refresh_interactions(self, job_id: str, result: AnalysisResult) -> list[AgentInteraction]:
        existing_by_id = {
            interaction.id: interaction
            for interaction in self.job_store.get_interactions(job_id)
        }
        founder_context = self.job_store.get_founder_context_updates(job_id)
        refreshed: list[AgentInteraction] = []

        for generated in self._build_initial_interactions(result):
            current = generated.model_copy(deep=True)
            existing = existing_by_id.get(current.id)
            if existing is not None:
                current.state = existing.state
                current.answer = existing.answer
                current.answered_at = existing.answered_at

            if current.context_key and current.context_key in founder_context:
                current.answer = founder_context[current.context_key]
                if current.state == "open":
                    current.state = "completed"

            refreshed.append(current)

        return self.job_store.set_interactions(job_id, refreshed)

    async def _rerun_legal_with_registered_address(self, job_id: str, registered_address: str) -> AnalysisResult:
        job = self.job_store.get_job(job_id)
        if job.result is None:
            raise ValueError("Job result is not ready.")

        await self.job_store.publish(
            job_id,
            "agent_rerun_started",
            "Legal agent is refreshing the document package with the confirmed registered address.",
            agent="legal",
            detail={"interaction_id": "legal_registered_address"},
        )

        legal = build_legal_output(job.request)
        legal.score = min(legal.score + 4, 100)
        legal.narrative = f"{legal.narrative} Registered office confirmed: {registered_address}."
        legal.conversion_note = f"{legal.conversion_note} Registered office captured for draft generation."

        generated_files = self.documents.generate_all(job_id, job.request, legal, registered_address=registered_address)
        document_path = generated_files["gesellschaftsvertrag"]
        legal.document_metadata = {
            "path": str(document_path),
            "kind": "gesellschaftsvertrag",
            "registered_address": registered_address,
        }

        existing = job.result
        overview = build_overview(
            recommended_entity=legal.recommended_entity,
            runway_months_base=existing.finance.runway_months["base"],
            eligibility=existing.finance.eligibility,
            legal_score=legal.score,
            finance_score=existing.finance.score,
            hiring_score=existing.hiring.score,
            ops_score=existing.ops.score,
        )
        updated_result = AnalysisResult(
            overview=overview,
            legal=legal,
            finance=existing.finance,
            hiring=existing.hiring,
            ops=existing.ops,
            mission_log=existing.mission_log,
            downloads=[
                DownloadLink(kind=kind, url=f"/api/download/{job_id}/{kind}")
                for kind in generated_files
            ],
        )
        self.job_store.set_result(job_id, updated_result)
        self._refresh_interactions(job_id, updated_result)
        await self.job_store.publish(
            job_id,
            "agent_rerun_completed",
            "Legal agent finished refreshing the incorporation package.",
            agent="legal",
            detail={"interaction_id": "legal_registered_address", "health_score": overview.health_score},
        )
        return updated_result

    async def _rerun_for_interaction(self, job_id: str, interaction: AgentInteraction, value: str | int | bool) -> AnalysisResult:
        if interaction.id == "legal_registered_address":
            return await self._rerun_legal_with_registered_address(job_id, str(value))
        if interaction.id == "finance_founder_salary":
            return await self._rerun_finance_with_salary(job_id, int(value))
        if interaction.id == "hiring_first_role":
            return await self._rerun_hiring_with_first_role(job_id, str(value))
        if interaction.id == "ops_launch_review":
            return await self._rerun_ops_after_approval(job_id, bool(value))
        job = self.job_store.get_job(job_id)
        if job.result is None:
            raise ValueError("Job result is not ready.")
        return job.result

    async def _rerun_finance_with_salary(self, job_id: str, monthly_salary: int) -> AnalysisResult:
        job = self.job_store.get_job(job_id)
        if job.result is None:
            raise ValueError("Job result is not ready.")

        await self.job_store.publish(
            job_id,
            "agent_rerun_started",
            "Finance agent is recalculating runway with the confirmed founder salary.",
            agent="finance",
            detail={"interaction_id": "finance_founder_salary"},
        )

        finance = build_finance_output(job.request)
        current_salary = int(finance.monthly_burn_eur * 0.18)
        delta = max(monthly_salary - current_salary, -max(current_salary - monthly_salary, 0))
        finance.monthly_burn_eur = max(finance.monthly_burn_eur + delta, 1)
        finance.runway_months = {
            key: max(1, months - max(delta // 2500, -1))
            for key, months in finance.runway_months.items()
        }
        finance.recommended_raise_timing_month = max(finance.runway_months["base"] - 4, 1)
        finance.recommended_raise_eur = max(finance.recommended_raise_eur + max(delta * 10, 0), 50_000)
        finance.assumptions.append(f"Founder salary confirmed at EUR {monthly_salary} per month.")
        finance.narrative = (
            f"{finance.narrative} Founder salary is now fixed at EUR {monthly_salary} per month, "
            f"which updates burn and runway assumptions."
        )
        finance.score = min(finance.score + 4, 100)

        existing = job.result
        overview = build_overview(
            recommended_entity=existing.legal.recommended_entity,
            runway_months_base=finance.runway_months["base"],
            eligibility=finance.eligibility,
            legal_score=existing.legal.score,
            finance_score=finance.score,
            hiring_score=existing.hiring.score,
            ops_score=existing.ops.score,
        )
        updated_result = AnalysisResult(
            overview=overview,
            legal=existing.legal,
            finance=finance,
            hiring=existing.hiring,
            ops=existing.ops,
            mission_log=existing.mission_log,
            downloads=existing.downloads,
        )
        self.job_store.set_result(job_id, updated_result)
        self._refresh_interactions(job_id, updated_result)
        await self.job_store.publish(
            job_id,
            "agent_rerun_completed",
            "Finance agent finished refreshing the runway model.",
            agent="finance",
            detail={"interaction_id": "finance_founder_salary", "health_score": overview.health_score},
        )
        return updated_result

    async def _rerun_hiring_with_first_role(self, job_id: str, first_role: str) -> AnalysisResult:
        job = self.job_store.get_job(job_id)
        if job.result is None:
            raise ValueError("Job result is not ready.")

        await self.job_store.publish(
            job_id,
            "agent_rerun_started",
            "Hiring agent is updating the team plan with the confirmed first role.",
            agent="hiring",
            detail={"interaction_id": "hiring_first_role"},
        )

        hiring = build_hiring_output(job.request)
        hiring.recommendation = f"{hiring.recommendation} Founder confirmed the first hiring focus as {first_role}."
        hiring.milestones.insert(0, f"Prioritize {first_role} as the first planned hire.")
        hiring.narrative = f"{hiring.narrative} The first-role priority is now set to {first_role}."
        hiring.score = min(hiring.score + 3, 100)

        existing = job.result
        overview = build_overview(
            recommended_entity=existing.legal.recommended_entity,
            runway_months_base=existing.finance.runway_months["base"],
            eligibility=existing.finance.eligibility,
            legal_score=existing.legal.score,
            finance_score=existing.finance.score,
            hiring_score=hiring.score,
            ops_score=existing.ops.score,
        )
        updated_result = AnalysisResult(
            overview=overview,
            legal=existing.legal,
            finance=existing.finance,
            hiring=hiring,
            ops=existing.ops,
            mission_log=existing.mission_log,
            downloads=existing.downloads,
        )
        self.job_store.set_result(job_id, updated_result)
        self._refresh_interactions(job_id, updated_result)
        await self.job_store.publish(
            job_id,
            "agent_rerun_completed",
            "Hiring agent finished updating the team plan.",
            agent="hiring",
            detail={"interaction_id": "hiring_first_role", "health_score": overview.health_score},
        )
        return updated_result

    async def _rerun_ops_after_approval(self, job_id: str, approved: bool) -> AnalysisResult:
        job = self.job_store.get_job(job_id)
        if job.result is None:
            raise ValueError("Job result is not ready.")

        await self.job_store.publish(
            job_id,
            "agent_rerun_started",
            "Ops agent is finalizing the launch compliance draft after founder approval.",
            agent="ops",
            detail={"interaction_id": "ops_launch_review"},
        )

        ops = build_ops_output(job.request)
        if approved:
            ops.narrative = f"{ops.narrative} Founder approval captured for the current operations draft."
            ops.compliance_highlights.append("Founder approved the current launch-compliance direction.")
            ops.score = min(ops.score + 3, 100)

        existing = job.result
        overview = build_overview(
            recommended_entity=existing.legal.recommended_entity,
            runway_months_base=existing.finance.runway_months["base"],
            eligibility=existing.finance.eligibility,
            legal_score=existing.legal.score,
            finance_score=existing.finance.score,
            hiring_score=existing.hiring.score,
            ops_score=ops.score,
        )
        updated_result = AnalysisResult(
            overview=overview,
            legal=existing.legal,
            finance=existing.finance,
            hiring=existing.hiring,
            ops=ops,
            mission_log=existing.mission_log,
            downloads=existing.downloads,
        )
        self.job_store.set_result(job_id, updated_result)
        self._refresh_interactions(job_id, updated_result)
        await self.job_store.publish(
            job_id,
            "agent_rerun_completed",
            "Ops agent finished finalizing the launch draft.",
            agent="ops",
            detail={"interaction_id": "ops_launch_review", "health_score": overview.health_score},
        )
        return updated_result
