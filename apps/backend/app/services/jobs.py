from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import AsyncIterator
from uuid import uuid4

from fastapi import HTTPException

from app.models import AnalysisResult, AnalyzeRequest, EventPayload
from app.models import JobSummary


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


TERMINAL_JOB_STATUSES = {"completed", "failed"}


@dataclass
class JobRecord:
    job_id: str
    owner_id: str
    request: AnalyzeRequest
    status: str = "queued"
    created_at: datetime = field(default_factory=now_utc)
    events: list[EventPayload] = field(default_factory=list)
    subscribers: list[asyncio.Queue[EventPayload]] = field(default_factory=list)
    result: AnalysisResult | None = None
    task_state: dict[str, bool] = field(default_factory=dict)


class JobStore:
    def __init__(self, storage_dir: Path, retention: timedelta | None = timedelta(hours=72)) -> None:
        self._jobs: dict[str, JobRecord] = {}
        self._storage_dir = storage_dir
        self._retention = retention
        self._storage_dir.mkdir(parents=True, exist_ok=True)
        self._cleanup_expired_jobs()
        self._load_jobs()

    def create_job(self, request: AnalyzeRequest, owner_id: str) -> JobRecord:
        self._cleanup_expired_jobs()
        job_id = uuid4().hex
        job = JobRecord(job_id=job_id, owner_id=owner_id, request=request)
        self._jobs[job_id] = job
        self._persist_job(job)
        return job

    def get_job(self, job_id: str) -> JobRecord:
        job = self._jobs.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        return job

    def get_job_for_owner(self, job_id: str, owner_id: str) -> JobRecord:
        job = self.get_job(job_id)
        if job.owner_id != owner_id:
            raise HTTPException(status_code=404, detail="Job not found")
        return job

    def has_job(self, job_id: str) -> bool:
        return job_id in self._jobs

    def list_jobs(self, owner_id: str, analysis_mode: str) -> list[JobSummary]:
        jobs = sorted(
            (job for job in self._jobs.values() if job.owner_id == owner_id),
            key=lambda job: job.created_at,
            reverse=True,
        )
        return [
            JobSummary(
                job_id=job.job_id,
                status=job.status,
                created_at=job.created_at,
                company_name=job.request.company_name,
                bundesland=job.request.bundesland,
                analysis_mode=analysis_mode,
                has_result=job.result is not None,
                completed_tasks=sum(1 for completed in job.task_state.values() if completed),
                total_tasks=len(job.task_state),
                latest_message=job.events[-1].message if job.events else None,
            )
            for job in jobs
        ]

    async def publish(self, job_id: str, event_type: str, message: str, agent: str | None = None, detail: dict[str, str | int | bool] | None = None) -> None:
        job = self.get_job(job_id)
        event = EventPayload(
            type=event_type,
            timestamp=now_utc(),
            job_id=job_id,
            agent=agent,
            message=message,
            detail=detail or {},
        )
        job.events.append(event)
        self._persist_job(job)
        for subscriber in list(job.subscribers):
            await subscriber.put(event)

    def set_status(self, job_id: str, status: str) -> None:
        job = self.get_job(job_id)
        job.status = status
        self._persist_job(job)

    def set_result(self, job_id: str, result: AnalysisResult) -> None:
        job = self.get_job(job_id)
        job.result = result
        job.status = "completed"
        self._persist_job(job)

    def set_failed(self, job_id: str) -> None:
        job = self.get_job(job_id)
        job.status = "failed"
        self._persist_job(job)

    def get_task_state(self, job_id: str) -> dict[str, bool]:
        return dict(self.get_job(job_id).task_state)

    def set_task_state(self, job_id: str, tasks: dict[str, bool]) -> dict[str, bool]:
        job = self.get_job(job_id)
        job.task_state = dict(tasks)
        self._persist_job(job)
        return dict(job.task_state)

    async def stream(self, job_id: str) -> AsyncIterator[str]:
        job = self._jobs.get(job_id)
        if not job:
            return
        for event in job.events:
            yield self._serialize_event(event)

        if job.status in TERMINAL_JOB_STATUSES:
            return

        queue: asyncio.Queue[EventPayload] = asyncio.Queue()
        job.subscribers.append(queue)
        try:
            while True:
                event = await queue.get()
                yield self._serialize_event(event)
                if event.type in {"job_completed", "job_failed"}:
                    return
        finally:
            if queue in job.subscribers:
                job.subscribers.remove(queue)

    @staticmethod
    def _serialize_event(event: EventPayload) -> str:
        return f"event: {event.type}\ndata: {event.model_dump_json()}\n\n"

    def _job_path(self, job_id: str) -> Path:
        return self._storage_dir / f"{job_id}.json"

    def _persist_job(self, job: JobRecord) -> None:
        payload = {
            "job_id": job.job_id,
            "owner_id": job.owner_id,
            "status": job.status,
            "created_at": job.created_at.isoformat(),
            "request": job.request.model_dump(mode="json"),
            "events": [event.model_dump(mode="json") for event in job.events],
            "result": job.result.model_dump(mode="json") if job.result else None,
            "task_state": job.task_state,
        }
        path = self._job_path(job.job_id)
        tmp_path = path.with_suffix(".json.tmp")
        tmp_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        tmp_path.replace(path)

    def _load_jobs(self) -> None:
        for path in sorted(self._storage_dir.glob("*.json")):
            try:
                payload = json.loads(path.read_text(encoding="utf-8"))
                job_id = payload["job_id"]
                owner_id = payload.get("owner_id", "public-demo")
                created_at = datetime.fromisoformat(payload["created_at"])
                request = AnalyzeRequest.model_validate(payload["request"])
                events = [EventPayload.model_validate(event) for event in payload.get("events", [])]
                result_payload = payload.get("result")
                result = AnalysisResult.model_validate(result_payload) if result_payload else None
                status = payload.get("status", "queued")
                task_state = {
                    str(key): bool(value)
                    for key, value in payload.get("task_state", {}).items()
                }

                if result is None and status not in TERMINAL_JOB_STATUSES:
                    status = "failed"
                    events.append(
                        EventPayload(
                            type="job_failed",
                            timestamp=now_utc(),
                            job_id=job_id,
                            agent=None,
                            message="A previous analysis run was interrupted before completion. Start a new run to continue.",
                            detail={"recovered": True},
                        )
                    )

                job = JobRecord(
                    job_id=job_id,
                    owner_id=owner_id,
                    request=request,
                    status=status,
                    created_at=created_at,
                    events=events,
                    result=result,
                    task_state=task_state,
                )
                self._jobs[job_id] = job
                self._persist_job(job)
            except Exception:
                continue

    def _cleanup_expired_jobs(self) -> None:
        if self._retention is None:
            return

        cutoff = now_utc() - self._retention
        for path in self._storage_dir.glob("*.json"):
            try:
                payload = json.loads(path.read_text(encoding="utf-8"))
                created_at = datetime.fromisoformat(payload["created_at"])
                if created_at < cutoff:
                    path.unlink(missing_ok=True)
                    self._jobs.pop(payload.get("job_id", ""), None)
            except Exception:
                continue
