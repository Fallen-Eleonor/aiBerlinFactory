from __future__ import annotations

from pathlib import Path

from docx import Document

from app.models import AnalysisResult, AnalyzeRequest, ChatMessage
from app.services.ai import GeminiAgentService


DOCUMENT_FILES = {
    "Gesellschaftsvertrag": "gesellschaftsvertrag.docx",
    "Founder Resolution Summary": "founder-resolution-summary.txt",
    "Handelsregister Checklist": "handelsregister-checklist.txt",
}


class DashboardChatService:
    def __init__(self, agent_ai: GeminiAgentService, generated_dir: Path) -> None:
        self.agent_ai = agent_ai
        self.generated_dir = generated_dir

    async def answer(
        self,
        *,
        job_id: str,
        prompt: str,
        request: AnalyzeRequest,
        result: AnalysisResult,
        task_state: dict[str, bool],
        history: list[ChatMessage],
    ) -> str:
        document_context = self._load_document_context(job_id)
        if self.agent_ai.enabled:
            return await self.agent_ai.answer_dashboard_chat(
                prompt=prompt,
                request=request,
                result=result,
                task_state=task_state,
                history=history,
                document_context=document_context,
            )
        return self._fallback_answer(prompt, result, task_state, document_context)

    def _load_document_context(self, job_id: str) -> str:
        output_dir = self.generated_dir / job_id
        if not output_dir.exists():
            return "No generated documents are available yet."

        sections: list[str] = []
        for title, filename in DOCUMENT_FILES.items():
            path = output_dir / filename
            if not path.exists():
                continue

            try:
                if path.suffix == ".docx":
                    raw_text = self._read_docx(path)
                else:
                    raw_text = path.read_text(encoding="utf-8")
            except Exception:
                continue

            cleaned = " ".join(raw_text.split())
            if cleaned:
                sections.append(f"{title}: {cleaned[:1_500]}")

        if not sections:
            return "No generated documents are available yet."
        return "\n\n".join(sections)

    @staticmethod
    def _read_docx(path: Path) -> str:
        document = Document(path)
        return "\n".join(paragraph.text.strip() for paragraph in document.paragraphs if paragraph.text.strip())

    @staticmethod
    def _fallback_answer(
        prompt: str,
        result: AnalysisResult,
        task_state: dict[str, bool],
        document_context: str,
    ) -> str:
        lower_prompt = prompt.lower()
        pending_tasks = [key.split(":")[-1] for key, done in task_state.items() if not done][:5]
        available_documents = [item.kind for item in result.downloads]

        if any(keyword in lower_prompt for keyword in {"legal", "entity", "gmbh", "ug", "notary", "notar", "register"}):
            return (
                f"The current legal recommendation is {result.legal.recommended_entity}. "
                f"{result.legal.reasoning} "
                f"The next legal steps are {', '.join(step.title for step in result.legal.incorporation_steps[:3])}. "
                "Treat this as startup-operating guidance rather than formal legal advice."
            )

        if any(keyword in lower_prompt for keyword in {"document", "documents", "vertrag", "resolution", "checklist"}):
            return (
                f"The dashboard currently has these generated documents: {', '.join(available_documents)}. "
                f"Document context: {document_context[:500]}"
            )

        if any(keyword in lower_prompt for keyword in {"task", "todo", "checklist", "next step"}):
            if pending_tasks:
                return (
                    f"The main open dashboard items are {', '.join(pending_tasks)}. "
                    f"The overall next step from the analysis is: {result.overview.next_step}."
                )
            return "The current checklist is fully marked complete. You can move to the next milestone in the dashboard summary."

        return (
            f"Startup OS recommends {result.legal.recommended_entity} with a readiness score of {result.overview.health_score}/100. "
            f"The next milestone is {result.overview.next_milestone}. "
            f"For document work, the generated files available are {', '.join(available_documents)}."
        )
