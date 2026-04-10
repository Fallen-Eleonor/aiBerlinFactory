from __future__ import annotations

import os
from pathlib import Path

from fastapi import BackgroundTasks, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from dotenv import load_dotenv

from app.data import DEMO_PERSONAS
from app.models import (
    AnalyzeRequest,
    AnalysisResult,
    ChatMessage,
    DemoPersona,
    JobChatHistoryPayload,
    JobChatRequest,
    JobDetails,
    JobSummary,
    JobTaskStatePayload,
    QueuedResponse,
)
from app.services.ai import GeminiAgentService
from app.services.chat import DashboardChatService
from app.services.jobs import JobStore, now_utc
from app.services.orchestrator import Orchestrator


BASE_DIR = Path(__file__).resolve().parent.parent
GENERATED_DIR = BASE_DIR / "generated"
DATA_DIR = BASE_DIR / "data"
JOBS_DIR = DATA_DIR / "jobs"
GENERATED_DIR.mkdir(parents=True, exist_ok=True)
JOBS_DIR.mkdir(parents=True, exist_ok=True)
load_dotenv(BASE_DIR / ".env")

job_store = JobStore(storage_dir=JOBS_DIR)
agent_ai = GeminiAgentService()
orchestrator = Orchestrator(job_store=job_store, generated_dir=GENERATED_DIR, agent_ai=agent_ai)
chat_service = DashboardChatService(agent_ai=agent_ai, generated_dir=GENERATED_DIR)


def resolve_client_id(request: Request, client_id: str | None = None) -> str:
    return client_id or request.headers.get("x-startup-os-client-id") or "public-demo"


def allowed_origins() -> list[str]:
    configured = os.getenv("STARTUP_OS_ALLOWED_ORIGINS") or os.getenv("STARTUP_OS_CORS_ORIGINS")
    if configured:
        return [origin.strip() for origin in configured.split(",") if origin.strip()]

    return [
        "https://efficient-blessing-production.up.railway.app",
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3002",
    ]


DOWNLOAD_SPECS = {
    "gesellschaftsvertrag": {
        "filename": "gesellschaftsvertrag.docx",
        "media_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
    "founder-resolution-summary": {
        "filename": "founder-resolution-summary.txt",
        "media_type": "text/plain; charset=utf-8",
    },
    "handelsregister-checklist": {
        "filename": "handelsregister-checklist.txt",
        "media_type": "text/plain; charset=utf-8",
    },
}

app = FastAPI(title="Startup OS API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins(),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {
        "status": "ok",
        "agent_mode": "gemini" if agent_ai.enabled else "deterministic",
        "model": agent_ai.model_name,
    }


@app.get("/api/demo/personas", response_model=list[DemoPersona])
async def demo_personas() -> list[DemoPersona]:
    return DEMO_PERSONAS


@app.get("/api/jobs", response_model=list[JobSummary])
async def jobs(request: Request, client_id: str | None = None) -> list[JobSummary]:
    return job_store.list_jobs(
        owner_id=resolve_client_id(request, client_id),
        analysis_mode="gemini" if agent_ai.enabled else "deterministic",
    )


@app.post("/api/analyze", response_model=QueuedResponse)
async def analyze(payload: AnalyzeRequest, request: Request, background_tasks: BackgroundTasks) -> QueuedResponse:
    client_id = resolve_client_id(request)
    job = job_store.create_job(payload, owner_id=client_id)
    background_tasks.add_task(orchestrator.run, job.job_id, payload)
    return QueuedResponse(job_id=job.job_id, status="queued")


@app.get("/api/status/{job_id}")
async def status_stream(job_id: str, request: Request, client_id: str | None = None) -> StreamingResponse:
    owner_id = resolve_client_id(request, client_id)
    job_store.get_job_for_owner(job_id, owner_id)
    return StreamingResponse(job_store.stream(job_id), media_type="text/event-stream")


@app.get("/api/result/{job_id}", response_model=AnalysisResult)
async def result(job_id: str, request: Request, client_id: str | None = None):
    job = job_store.get_job_for_owner(job_id, resolve_client_id(request, client_id))
    if job.result is None:
        return JSONResponse(status_code=202, content={"job_id": job_id, "status": job.status})
    return job.result


@app.get("/api/jobs/{job_id}", response_model=JobDetails)
async def job_details(job_id: str, request: Request, client_id: str | None = None) -> JobDetails:
    job = job_store.get_job_for_owner(job_id, resolve_client_id(request, client_id))
    return JobDetails(
        job_id=job.job_id,
        status=job.status,
        created_at=job.created_at,
        company_name=job.request.company_name,
        has_result=job.result is not None,
        analysis_mode="gemini" if agent_ai.enabled else "deterministic",
        last_message=job.events[-1].message if job.events else None,
    )


@app.get("/api/jobs/{job_id}/request", response_model=AnalyzeRequest)
async def job_request(job_id: str, request: Request, client_id: str | None = None) -> AnalyzeRequest:
    job = job_store.get_job_for_owner(job_id, resolve_client_id(request, client_id))
    return job.request


@app.get("/api/jobs/{job_id}/tasks", response_model=JobTaskStatePayload)
async def job_tasks(job_id: str, request: Request, client_id: str | None = None) -> JobTaskStatePayload:
    job_store.get_job_for_owner(job_id, resolve_client_id(request, client_id))
    return JobTaskStatePayload(tasks=job_store.get_task_state(job_id))


@app.put("/api/jobs/{job_id}/tasks", response_model=JobTaskStatePayload)
async def update_job_tasks(job_id: str, payload: JobTaskStatePayload, request: Request, client_id: str | None = None) -> JobTaskStatePayload:
    job_store.get_job_for_owner(job_id, resolve_client_id(request, client_id))
    return JobTaskStatePayload(tasks=job_store.set_task_state(job_id, payload.tasks))


@app.get("/api/jobs/{job_id}/chat", response_model=JobChatHistoryPayload)
async def job_chat_history(job_id: str, request: Request, client_id: str | None = None) -> JobChatHistoryPayload:
    job_store.get_job_for_owner(job_id, resolve_client_id(request, client_id))
    return JobChatHistoryPayload(messages=job_store.get_chat_history(job_id))


@app.post("/api/jobs/{job_id}/chat", response_model=JobChatHistoryPayload)
async def job_chat(
    job_id: str,
    payload: JobChatRequest,
    request: Request,
    client_id: str | None = None,
) -> JobChatHistoryPayload:
    job = job_store.get_job_for_owner(job_id, resolve_client_id(request, client_id))
    if job.result is None:
        raise HTTPException(status_code=409, detail="Chat becomes available after the dashboard analysis is complete.")
    if not payload.message.strip():
        raise HTTPException(status_code=422, detail="Chat message cannot be empty.")

    user_message = ChatMessage(role="user", content=payload.message.strip(), created_at=now_utc())
    history = job_store.append_chat_message(job_id, user_message)
    assistant_text = await chat_service.answer(
        job_id=job_id,
        prompt=user_message.content,
        request=job.request,
        result=job.result,
        task_state=job.task_state,
        history=history[:-1],
    )
    assistant_message = ChatMessage(role="assistant", content=assistant_text, created_at=now_utc())
    history = job_store.append_chat_message(job_id, assistant_message)
    return JobChatHistoryPayload(messages=history)


@app.get("/api/download/{job_id}/{kind}")
async def download(job_id: str, kind: str, request: Request, client_id: str | None = None):
    job = job_store.get_job_for_owner(job_id, resolve_client_id(request, client_id))
    if job.result is None:
        return JSONResponse(status_code=404, content={"detail": "Result not ready"})

    spec = DOWNLOAD_SPECS.get(kind)
    if spec is None:
        return JSONResponse(status_code=404, content={"detail": "Unknown download kind"})

    path = GENERATED_DIR / job_id / spec["filename"]
    if not path.exists():
        return JSONResponse(status_code=404, content={"detail": "File not found"})

    filename = f"{job.request.company_name.replace(' ', '_')}_{spec['filename']}"
    return FileResponse(path, media_type=spec["media_type"], filename=filename)
