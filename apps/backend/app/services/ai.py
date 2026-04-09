from __future__ import annotations

import os
import asyncio
from typing import Any, TypeVar

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel
from typing_extensions import TypedDict

from app.models import AnalyzeRequest, FinanceOutput, HiringOutput, LegalOutput, OpsOutput


ModelT = TypeVar("ModelT", bound=BaseModel)


class LegalNarrativePatch(BaseModel):
    reasoning: str
    narrative: str


class FinanceNarrativePatch(BaseModel):
    narrative: str
    assumptions: list[str]


class HiringNarrativePatch(BaseModel):
    recommendation: str
    narrative: str


class OpsNarrativePatch(BaseModel):
    narrative: str
    e_invoicing_note: str


class EnrichmentState(TypedDict):
    messages: list[Any]
    patch: BaseModel | None


class GeminiAgentService:
    def __init__(self) -> None:
        self.provider_name = "gemini-langchain"
        self.model_name = os.getenv("STARTUP_OS_GEMINI_MODEL", "gemini-2.5-flash")
        self.api_version = os.getenv("GOOGLE_GENAI_API_VERSION", "beta")
        self.timeout_seconds = float(os.getenv("STARTUP_OS_AGENT_TIMEOUT_SECONDS", "20"))
        self.api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        self.use_vertex = os.getenv("GOOGLE_GENAI_USE_VERTEXAI", "").lower() == "true"
        self.project = os.getenv("GOOGLE_CLOUD_PROJECT")
        self.location = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
        self._graphs: dict[type[BaseModel], Any] = {}

    @property
    def enabled(self) -> bool:
        if self.use_vertex:
            return bool(self.project and self.location)
        return bool(self.api_key)

    async def enrich_legal(self, request: AnalyzeRequest, output: LegalOutput) -> LegalOutput:
        patch = await self._generate_json(
            system_instruction=(
                "You are a German startup incorporation specialist. "
                "Refine legal reasoning without changing entity choice, costs, timelines, or listed steps. "
                "Never invent legal steps not present in the deterministic result."
            ),
            prompt=self._render_prompt("legal", request, output),
            response_schema=LegalNarrativePatch,
        )
        output.reasoning = patch.reasoning
        output.narrative = patch.narrative
        return output

    async def enrich_finance(self, request: AnalyzeRequest, output: FinanceOutput) -> FinanceOutput:
        patch = await self._generate_json(
            system_instruction=(
                "You are a German startup CFO. Refine the narrative and assumptions only. "
                "Do not change any EUR amounts, runway values, tax items, or eligibility flags."
            ),
            prompt=self._render_prompt("finance", request, output),
            response_schema=FinanceNarrativePatch,
        )
        output.narrative = patch.narrative
        output.assumptions = patch.assumptions
        return output

    async def enrich_hiring(self, request: AnalyzeRequest, output: HiringOutput) -> HiringOutput:
        patch = await self._generate_json(
            system_instruction=(
                "You are a German hiring strategist for early-stage startups. "
                "Refine the recommendation and narrative only. "
                "Keep employment-law cautions conservative."
            ),
            prompt=self._render_prompt("hiring", request, output),
            response_schema=HiringNarrativePatch,
        )
        output.recommendation = patch.recommendation
        output.narrative = patch.narrative
        return output

    async def enrich_ops(self, request: AnalyzeRequest, output: OpsOutput) -> OpsOutput:
        patch = await self._generate_json(
            system_instruction=(
                "You are a Germany-focused startup operations lead. "
                "Refine the narrative and e-invoicing note only. "
                "Do not remove privacy obligations or add unsupported compliance claims."
            ),
            prompt=self._render_prompt("ops", request, output),
            response_schema=OpsNarrativePatch,
        )
        output.narrative = patch.narrative
        output.e_invoicing_note = patch.e_invoicing_note
        return output

    async def _generate_json(self, system_instruction: str, prompt: str, response_schema: type[ModelT]) -> ModelT:
        if not self.enabled:
            raise RuntimeError("Gemini is not configured.")

        graph = self._graphs.get(response_schema)
        if graph is None:
            graph = self._build_graph(response_schema)
            self._graphs[response_schema] = graph
        state = await asyncio.wait_for(
            graph.ainvoke(
                {
                    "messages": [
                        SystemMessage(content=system_instruction),
                        HumanMessage(content=prompt),
                    ],
                    "patch": None,
                }
            ),
            timeout=self.timeout_seconds,
        )
        patch = state.get("patch")
        if patch is None:
            raise RuntimeError("LangGraph enrichment returned no patch.")
        if not isinstance(patch, response_schema):
            raise RuntimeError(f"Unexpected patch type: {type(patch)!r}")
        return patch

    def _build_graph(self, response_schema: type[ModelT]):
        structured_model = self._build_llm().with_structured_output(response_schema, method="json_schema")

        async def generate_patch(state: EnrichmentState) -> dict[str, BaseModel]:
            patch = await structured_model.ainvoke(state["messages"])
            return {"patch": patch}

        builder = StateGraph(EnrichmentState)
        builder.add_node("generate_patch", generate_patch)
        builder.add_edge(START, "generate_patch")
        builder.add_edge("generate_patch", END)
        return builder.compile()

    def _build_llm(self) -> ChatGoogleGenerativeAI:
        kwargs: dict[str, Any] = {
            "model": self.model_name,
            "temperature": 0.2,
            "timeout": self.timeout_seconds,
        }
        if self.use_vertex:
            kwargs.update(
                {
                    "vertexai": True,
                    "project": self.project,
                    "location": self.location,
                }
            )
        else:
            kwargs["google_api_key"] = self.api_key
        return ChatGoogleGenerativeAI(**kwargs)

    @staticmethod
    def _render_prompt(agent_name: str, request: AnalyzeRequest, output: BaseModel) -> str:
        return (
            f"Agent: {agent_name}\n"
            "Task: Improve the language quality of the structured result while preserving all hard facts.\n"
            "Return only the fields required by the schema.\n\n"
            f"Startup brief:\n{request.model_dump_json(indent=2)}\n\n"
            f"Deterministic result:\n{output.model_dump_json(indent=2)}\n"
        )
