from __future__ import annotations

import asyncio
from dataclasses import dataclass
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
