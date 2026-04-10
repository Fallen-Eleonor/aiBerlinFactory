import asyncio
import json
from datetime import timedelta

from app.agents.finance import build_finance_output
from app.agents.hiring import build_hiring_output
from app.agents.legal import build_legal_output
from app.agents.ops import build_ops_output
from app.models import AnalysisResult, AnalyzeRequest, DownloadLink, FounderBackground
from app.services.cap_table import build_cap_table_output
from app.services.jobs import JobStore, now_utc
from app.services.overview import build_mission_log, build_overview


def make_request() -> AnalyzeRequest:
    return AnalyzeRequest(
        company_name="Persisted Labs",
        industry="B2B SaaS",
        bundesland="Berlin",
        founder_count=2,
        available_capital_eur=18_000,
        goals="Launch quickly and prepare for a future seed round.",
        founder_background=FounderBackground(
            university_affiliation=True,
            research_spinout=False,
            foreign_founder=False,
            employment_status="full_time",
        ),
    )


def build_result(request: AnalyzeRequest, job_id: str) -> AnalysisResult:
    legal = build_legal_output(request)
    finance = build_finance_output(request)
    hiring = build_hiring_output(request)
    ops = build_ops_output(request)
    cap_table = build_cap_table_output(request, legal, finance)
    overview = build_overview(
        recommended_entity=legal.recommended_entity,
        runway_months_base=finance.runway_months["base"],
        eligibility=finance.eligibility,
        legal_score=legal.score,
        finance_score=finance.score,
        hiring_score=hiring.score,
        ops_score=ops.score,
    )
    return AnalysisResult(
        overview=overview,
        legal=legal,
        finance=finance,
        cap_table=cap_table,
        hiring=hiring,
        ops=ops,
        mission_log=build_mission_log(),
        downloads=[DownloadLink(kind="gesellschaftsvertrag", url=f"/api/download/{job_id}/gesellschaftsvertrag")],
    )


def test_job_store_persists_completed_results(tmp_path):
    store = JobStore(tmp_path)
    request = make_request()
    job = store.create_job(request, owner_id="owner-a")
    asyncio.run(store.publish(job.job_id, "job_started", "Analysis started."))
    store.set_result(job.job_id, build_result(request, job.job_id))

    reloaded = JobStore(tmp_path)
    loaded = reloaded.get_job(job.job_id)

    assert loaded.status == "completed"
    assert loaded.result is not None
    assert loaded.result.legal.recommended_entity == "GmbH"
    assert loaded.result.cap_table.option_pool_percent > 0
    assert loaded.events[0].message == "Analysis started."
    assert len(loaded.task_state) == 15


def test_job_store_marks_interrupted_jobs_as_failed(tmp_path):
    store = JobStore(tmp_path)
    request = make_request()
    job = store.create_job(request, owner_id="owner-a")
    store.set_status(job.job_id, "running")

    reloaded = JobStore(tmp_path)
    loaded = reloaded.get_job(job.job_id)

    assert loaded.status == "failed"
    assert loaded.result is None
    assert loaded.events[-1].type == "job_failed"


def test_job_store_persists_explicit_failure(tmp_path):
    store = JobStore(tmp_path)
    request = make_request()
    job = store.create_job(request, owner_id="owner-a")

    store.set_failed(job.job_id)
    asyncio.run(store.publish(job.job_id, "job_failed", "Analysis failed."))

    reloaded = JobStore(tmp_path)
    loaded = reloaded.get_job(job.job_id)

    assert loaded.status == "failed"
    assert loaded.events[-1].type == "job_failed"
    assert loaded.events[-1].message == "Analysis failed."


def test_job_store_cleans_up_expired_jobs(tmp_path):
    expired_job_id = "expired-job"
    expired_path = tmp_path / f"{expired_job_id}.json"
    expired_path.write_text(
        json.dumps(
            {
                "job_id": expired_job_id,
                "status": "completed",
                "created_at": (now_utc() - timedelta(days=10)).isoformat(),
                "request": make_request().model_dump(mode="json"),
                "events": [],
                "result": None,
            }
        ),
        encoding="utf-8",
    )

    JobStore(tmp_path, retention=timedelta(hours=1))

    assert expired_path.exists() is False
