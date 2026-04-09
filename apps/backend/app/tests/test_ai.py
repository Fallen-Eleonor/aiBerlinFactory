from app.services.ai import GeminiAgentService


def test_gemini_disabled_without_configuration(monkeypatch):
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_GENAI_USE_VERTEXAI", raising=False)
    monkeypatch.delenv("GOOGLE_CLOUD_PROJECT", raising=False)
    service = GeminiAgentService()
    assert service.enabled is False


def test_gemini_enabled_with_api_key(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.delenv("GOOGLE_GENAI_USE_VERTEXAI", raising=False)
    monkeypatch.delenv("STARTUP_OS_GEMINI_MODEL", raising=False)
    service = GeminiAgentService()
    assert service.enabled is True
    assert service.model_name == "gemini-2.5-flash"
