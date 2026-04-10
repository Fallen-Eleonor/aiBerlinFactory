from pathlib import Path

from fastapi.testclient import TestClient

from app import main
from app.models import AnalyzeRequest, FounderBackground
from app.services.ai import GeminiAgentService
from app.services.chat import DashboardChatService
from app.services.jobs import JobStore
from app.services.orchestrator import Orchestrator


def make_payload() -> dict:
    return AnalyzeRequest(
        company_name="Lifecycle Labs",
        industry="B2B SaaS",
        bundesland="Berlin",
        founder_count=2,
        available_capital_eur=20_000,
        goals="Launch quickly and prepare for a seed round.",
        founder_background=FounderBackground(
            university_affiliation=True,
            research_spinout=False,
            foreign_founder=False,
            employment_status="full_time",
        ),
    ).model_dump(mode="json")


def configure_test_app(tmp_path: Path) -> TestClient:
    generated_dir = tmp_path / "generated"
    jobs_dir = tmp_path / "jobs"
    generated_dir.mkdir(parents=True, exist_ok=True)
    jobs_dir.mkdir(parents=True, exist_ok=True)

    main.GENERATED_DIR = generated_dir
    main.job_store = JobStore(storage_dir=jobs_dir, retention=None)
    main.agent_ai = GeminiAgentService()
    main.orchestrator = Orchestrator(
        job_store=main.job_store,
        generated_dir=generated_dir,
        agent_ai=main.agent_ai,
    )
    main.chat_service = DashboardChatService(agent_ai=main.agent_ai, generated_dir=generated_dir)
    return TestClient(main.app)


def test_api_lifecycle_covers_result_history_tasks_and_downloads(tmp_path):
    client = configure_test_app(tmp_path)
    headers = {"x-startup-os-client-id": "owner-a"}
    query = "?client_id=owner-a"

    personas_response = client.get("/api/demo/personas")
    assert personas_response.status_code == 200
    personas = personas_response.json()
    assert len(personas) >= 1
    assert "request" in personas[0]

    analyze_response = client.post("/api/analyze", json=make_payload(), headers=headers)
    assert analyze_response.status_code == 200
    queued = analyze_response.json()
    job_id = queued["job_id"]

    with client.stream("GET", f"/api/status/{job_id}{query}") as stream_response:
        assert stream_response.status_code == 200
        stream_body = "".join(stream_response.iter_text())

    assert "event: job_started" in stream_body
    assert "event: orchestrator_update" in stream_body
    assert "event: job_completed" in stream_body

    result_response = client.get(f"/api/result/{job_id}{query}")
    assert result_response.status_code == 200
    result_payload = result_response.json()
    assert result_payload["overview"]["recommended_entity"] in {"GmbH", "UG (haftungsbeschraenkt)"}
    assert result_payload["overview"]["health_label"] in {"INVESTMENT-BEREIT", "SEED-BEREIT", "IN PROGRESS", "FRUEHE PHASE"}
    assert len(result_payload["downloads"]) == 3
    assert len(result_payload["mission_log"]) > 0
    assert result_payload["cap_table"]["option_pool_percent"] > 0

    request_response = client.get(f"/api/jobs/{job_id}/request{query}")
    assert request_response.status_code == 200
    request_payload = request_response.json()
    assert request_payload["company_name"] == "Lifecycle Labs"
    assert request_payload["founder_background"]["foreign_founder"] is False

    tasks_response = client.put(
        f"/api/jobs/{job_id}/tasks{query}",
        json={"tasks": {"legal:incorporation:IHK Namenscheck": True, "legal:incorporation:Notartermin": False}},
    )
    assert tasks_response.status_code == 200
    assert tasks_response.json()["tasks"]["legal:incorporation:IHK Namenscheck"] is True

    list_tasks_response = client.get(f"/api/jobs/{job_id}/tasks{query}")
    assert list_tasks_response.status_code == 200
    assert list_tasks_response.json()["tasks"]["legal:incorporation:Notartermin"] is False
    assert len(list_tasks_response.json()["tasks"]) == 15

    history_response = client.get(f"/api/jobs{query}")
    assert history_response.status_code == 200
    jobs = history_response.json()
    assert jobs[0]["job_id"] == job_id
    assert jobs[0]["completed_tasks"] == 1
    assert jobs[0]["total_tasks"] == 15

    details_response = client.get(f"/api/jobs/{job_id}{query}")
    assert details_response.status_code == 200
    details_payload = details_response.json()
    assert details_payload["has_result"] is True
    assert details_payload["company_name"] == "Lifecycle Labs"

    empty_chat_response = client.get(f"/api/jobs/{job_id}/chat{query}")
    assert empty_chat_response.status_code == 200
    assert empty_chat_response.json()["messages"] == []

    chat_response = client.post(
        f"/api/jobs/{job_id}/chat{query}",
        json={"message": "What should I review before the notary?"},
    )
    assert chat_response.status_code == 200
    chat_messages = chat_response.json()["messages"]
    assert len(chat_messages) == 2
    assert chat_messages[0]["role"] == "user"
    assert "notary" in chat_messages[0]["content"].lower()
    assert chat_messages[1]["role"] == "assistant"
    assert len(chat_messages[1]["content"]) > 20

    persisted_chat_response = client.get(f"/api/jobs/{job_id}/chat{query}")
    assert persisted_chat_response.status_code == 200
    assert len(persisted_chat_response.json()["messages"]) == 2

    for kind in [
        "gesellschaftsvertrag",
        "founder-resolution-summary",
        "handelsregister-checklist",
    ]:
        download_response = client.get(f"/api/download/{job_id}/{kind}{query}")
        assert download_response.status_code == 200


def test_api_scopes_job_history_by_client_id(tmp_path):
    client = configure_test_app(tmp_path)
    headers_a = {"x-startup-os-client-id": "owner-a"}
    headers_b = {"x-startup-os-client-id": "owner-b"}

    response_a = client.post("/api/analyze", json=make_payload(), headers=headers_a)
    response_b = client.post("/api/analyze", json=make_payload(), headers=headers_b)

    job_id_a = response_a.json()["job_id"]
    job_id_b = response_b.json()["job_id"]

    history_a = client.get("/api/jobs?client_id=owner-a")
    history_b = client.get("/api/jobs?client_id=owner-b")

    assert [job["job_id"] for job in history_a.json()] == [job_id_a]
    assert [job["job_id"] for job in history_b.json()] == [job_id_b]

    hidden_job = client.get(f"/api/jobs/{job_id_b}?client_id=owner-a")
    assert hidden_job.status_code == 404
    hidden_result = client.get(f"/api/result/{job_id_b}?client_id=owner-a")
    assert hidden_result.status_code == 404
    hidden_download = client.get(f"/api/download/{job_id_b}/gesellschaftsvertrag?client_id=owner-a")
    assert hidden_download.status_code == 404
    hidden_chat = client.get(f"/api/jobs/{job_id_b}/chat?client_id=owner-a")
    assert hidden_chat.status_code == 404
