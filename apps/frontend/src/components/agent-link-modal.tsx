"use client";

import { useMemo, useState } from "react";

import { AgentInteraction, AnalyzeRequest, AnalysisResult } from "@/lib/types";

type AgentKey = "legal" | "finance" | "hiring" | "ops";

type LinkState = "needs_input" | "review_ready" | "ready";

type LinkField = {
  id: string;
  label: string;
  type: "text" | "textarea" | "number" | "select" | "boolean";
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
};

type AgentLink = {
  agent: AgentKey;
  title: string;
  subtitle: string;
  state: LinkState;
  requestLabel: string;
  why: string;
  nextImpact: string;
  field?: LinkField;
  reviewNotes?: string[];
  answer?: string | number | boolean | null;
};

type ChatMessage = {
  role: "assistant" | "user";
  text: string;
};

const AGENT_META: Record<AgentKey, { label: string; color: string; icon: string }> = {
  legal: { label: "Legal", color: "#7B2FBE", icon: "⚖️" },
  finance: { label: "Finance", color: "#00C9A7", icon: "€" },
  hiring: { label: "Hiring", color: "#10B981", icon: "👥" },
  ops: { label: "Operations", color: "#F59E0B", icon: "⚙️" },
};

const AGENT_SUBTITLES: Record<AgentKey, string> = {
  legal: "Document finalization checkpoint",
  finance: "Runway confidence checkpoint",
  hiring: "Team sequencing checkpoint",
  ops: "Human approval checkpoint",
};

function buildLinks(interactions: AgentInteraction[]): AgentLink[] {
  return interactions.map((interaction) => ({
    agent: interaction.agent,
    title: interaction.title,
    subtitle: AGENT_SUBTITLES[interaction.agent],
    state: interaction.state === "completed" ? "ready" : interaction.kind === "review" ? "review_ready" : "needs_input",
    requestLabel: interaction.question,
    why: interaction.why_it_matters,
    nextImpact: interaction.next_impact,
    field: interaction.field
      ? {
          id: interaction.field.id,
          label: interaction.field.label,
          type: interaction.field.input_type,
          placeholder: interaction.field.placeholder ?? undefined,
          options: interaction.field.options,
        }
      : undefined,
    reviewNotes: interaction.review_notes.length > 0 ? interaction.review_notes : undefined,
    answer: interaction.answer,
  }));
}

function stateChip(state: LinkState, color: string) {
  if (state === "needs_input") {
    return {
      label: "Needs Input",
      bg: "rgba(239,68,68,0.14)",
      border: "rgba(239,68,68,0.28)",
      text: "#fca5a5",
    };
  }

  if (state === "review_ready") {
    return {
      label: "Review Ready",
      bg: "rgba(245,158,11,0.14)",
      border: "rgba(245,158,11,0.28)",
      text: "#fbbf24",
    };
  }

  return {
    label: "Ready",
    bg: ${color}16,
    border: ${color}35,
    text: color,
  };
}

function initialValue(link: AgentLink): string {
  if (link.field?.type === "select") {
    return link.field.options?.[0]?.value ?? "";
  }
  return "";
}

function explainQuestion(
  agent: AgentKey,
  question: string,
  link: AgentLink,
  result: AnalysisResult,
  request: AnalyzeRequest | null,
): string {
  const normalized = question.toLowerCase();

  if (normalized.includes("gesellschaftsvertrag")) {
    return "The Gesellschaftsvertrag is the articles of association for the company. It defines the company name, legal form, shareholders, and core incorporation structure. Legal needs accurate founder details before that draft can be treated as final-ready.";
  }

  if (normalized.includes("why")  normalized.includes("matter")) {
    return link.why;
  }

  if (normalized.includes("what changes")  normalized.includes("next")) {
    return link.nextImpact;
  }

  if (normalized.includes("runway")) {
    return Finance currently shows ${result.finance.runway_months.base} months of base runway at about EUR ${result.finance.monthly_burn_eur.toLocaleString("en-GB")} monthly burn. Confirming founder salary helps tighten that model.;
  }