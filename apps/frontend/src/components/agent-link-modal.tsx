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
    bg: `${color}16`,
    border: `${color}35`,
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

  if (normalized.includes("why") || normalized.includes("matter")) {
    return link.why;
  }

  if (normalized.includes("what changes") || normalized.includes("next")) {
    return link.nextImpact;
  }

  if (normalized.includes("runway")) {
    return `Finance currently shows ${result.finance.runway_months.base} months of base runway at about EUR ${result.finance.monthly_burn_eur.toLocaleString("en-GB")} monthly burn. Confirming founder salary helps tighten that model.`;
  }

  if (normalized.includes("address")) {
    return `Legal uses the registered office in the incorporation package and document set. Right now the company is scoped to ${request?.bundesland ?? "the selected Bundesland"}, but the exact street address is still needed for the legal draft.`;
  }

  if (normalized.includes("hire") || normalized.includes("hiring")) {
    return `Hiring is trying to reduce ambiguity in the first-team plan. The current recommendation starts with ${result.hiring.first_roles[0]?.title ?? "an initial support role"}, but your answer can reorder the milestones.`;
  }

  if (normalized.includes("ops") || normalized.includes("compliance") || normalized.includes("privacy")) {
    return `Ops is focused on launch readiness: DSGVO tasks, stack choices, and e-invoicing readiness. Approval here means the founder agrees with the current launch-compliance draft.`;
  }

  return `${AGENT_META[agent].label} is using this workspace to clarify one blocking or confidence-improving detail, then pass the updated context back into the orchestration flow so the outputs can refresh.`;
}

export function AgentLinkModal({
  open,
  onClose,
  result,
  request,
  interactions,
  onSubmitInteraction,
}: {
  open: boolean;
  onClose: () => void;
  result: AnalysisResult;
  request: AnalyzeRequest | null;
  interactions: AgentInteraction[];
  onSubmitInteraction: (agent: AgentKey, value: string | number | boolean) => Promise<void>;
}) {
  const links = useMemo(() => buildLinks(interactions), [interactions]);
  const [activeAgent, setActiveAgent] = useState<AgentKey>("legal");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submittingAgent, setSubmittingAgent] = useState<AgentKey | null>(null);
  const [chatDrafts, setChatDrafts] = useState<Record<AgentKey, string>>({
    legal: "",
    finance: "",
    hiring: "",
    ops: "",
  });
  const [chatHistory, setChatHistory] = useState<Record<AgentKey, ChatMessage[]>>({
    legal: [],
    finance: [],
    hiring: [],
    ops: [],
  });
  const activeFallbackAgent = links[0]?.agent ?? "legal";
  const resolvedActiveAgent = links.some((item) => item.agent === activeAgent) ? activeAgent : activeFallbackAgent;
  const link = links.find((item) => item.agent === resolvedActiveAgent) ?? null;
  const meta = AGENT_META[resolvedActiveAgent];
  const chip = link ? stateChip(link.state, meta.color) : stateChip("ready", meta.color);
  const fieldValue = link
    ? answers[link.agent] ?? (link.answer !== null && link.answer !== undefined ? String(link.answer) : initialValue(link))
    : "";
  const chatMessages = useMemo<ChatMessage[]>(() => {
    if (!link) {
      return [];
    }
    const seed: ChatMessage[] = [
      {
        role: "assistant",
        text: link.requestLabel,
      },
      {
        role: "assistant",
        text: link.why,
      },
    ];
    if (link.answer !== null && link.answer !== undefined) {
      seed.push({
        role: "assistant",
        text: `I have already recorded this founder update: ${typeof link.answer === "boolean" ? (link.answer ? "Yes / approved" : "No / rejected") : String(link.answer)}.`,
      });
    }
    return [...seed, ...(chatHistory[link.agent] ?? [])];
  }, [link, chatHistory]);

  if (!open) {
    return null;
  }

  if (!link) {
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
        <div
          className="relative w-full max-w-3xl overflow-hidden rounded-[2rem] border p-8"
          style={{ background: "rgba(8,10,18,0.96)", borderColor: "rgba(255,255,255,0.08)", boxShadow: "0 30px 80px rgba(0,0,0,0.55)" }}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="section-title">Agent Link Workspace</p>
              <h2 className="mt-2 text-2xl font-semibold">No live agent requests yet</h2>
              <p className="glass-muted mt-3 max-w-xl text-sm leading-7">
                The workspace is now driven entirely by backend interactions. It will appear here automatically once the orchestration layer asks for founder input or approval.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-4 py-2 text-sm"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.72)" }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const activeLink = link;

  async function submit() {
    setSubmittingAgent(activeLink.agent);
    const value = !activeLink.field
      ? true
      : activeLink.field.type === "number"
        ? Number(fieldValue)
        : activeLink.field.type === "boolean"
          ? fieldValue === "true"
          : fieldValue;
    try {
      await onSubmitInteraction(activeLink.agent, value);
      if (!(activeLink.agent in answers) && activeLink.field) {
        setAnswers((current) => ({ ...current, [activeLink.agent]: fieldValue }));
      }
    } finally {
      setSubmittingAgent(null);
    }
  }

  function askAgent() {
    const prompt = chatDrafts[activeLink.agent].trim();
    if (!prompt) {
      return;
    }
    const reply = explainQuestion(activeLink.agent, prompt, activeLink, result, request);
    setChatHistory((current) => ({
      ...current,
      [activeLink.agent]: [
        ...(current[activeLink.agent] ?? []),
        { role: "user", text: prompt },
        { role: "assistant", text: reply },
      ],
    }));
    setChatDrafts((current) => ({ ...current, [activeLink.agent]: "" }));
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div
        className="relative w-full max-w-6xl overflow-hidden rounded-[2rem] border"
        style={{ background: "rgba(8,10,18,0.96)", borderColor: "rgba(255,255,255,0.08)", boxShadow: "0 30px 80px rgba(0,0,0,0.55)" }}
      >
        <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <div>
            <p className="section-title">Agent Link Workspace</p>
            <h2 className="mt-1 text-2xl font-semibold">Focused agent ↔ founder interaction</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.72)" }}
          >
            Close
          </button>
        </div>

        <div className="grid min-h-[620px] lg:grid-cols-[260px_1fr_380px]">
          <aside className="border-r p-5" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.015)" }}>
            <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.38)", fontFamily: "'JetBrains Mono', monospace" }}>
              Active Agents
            </p>
            <div className="mt-4 grid gap-3">
              {links.map((item) => {
                const itemMeta = AGENT_META[item.agent];
                const itemChip = stateChip(item.state, itemMeta.color);
                return (
                  <button
                    key={item.agent}
                    type="button"
                    onClick={() => setActiveAgent(item.agent)}
                    className="rounded-[1.25rem] px-4 py-4 text-left transition"
                    style={{
                      background: activeAgent === item.agent ? `${itemMeta.color}12` : "rgba(255,255,255,0.03)",
                      border: `1px solid ${activeAgent === item.agent ? `${itemMeta.color}38` : "rgba(255,255,255,0.08)"}`,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span>{itemMeta.icon}</span>
                      <span className="text-sm font-semibold">{itemMeta.label}</span>
                      <span
                        className="ml-auto shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em]"
                        style={{ background: itemChip.bg, border: `1px solid ${itemChip.border}`, color: itemChip.text, fontFamily: "'JetBrains Mono', monospace" }}
                      >
                        {itemChip.label}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5" style={{ color: "rgba(255,255,255,0.48)" }}>
                      {item.title}
                    </p>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="relative flex items-center justify-center overflow-hidden border-r p-4" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle at 30% 20%, rgba(108,99,255,0.14), transparent 28%), radial-gradient(circle at 75% 75%, rgba(0,201,167,0.1), transparent 28%)",
              }}
            />
            <svg viewBox="60 120 560 320" preserveAspectRatio="xMidYMid meet" className="relative z-10 w-full" style={{ maxHeight: 420 }}>
              <defs>
                <linearGradient id="agent-link-line" x1="0%" x2="100%">
                  <stop offset="0%" stopColor={meta.color} stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0.7" />
                </linearGradient>
              </defs>

              <circle cx="170" cy="260" r="72" fill="rgba(255,255,255,0.03)" stroke={meta.color} strokeWidth="2" />
              <circle cx="510" cy="260" r="72" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />

              <path
                d="M 243 260 C 310 190, 370 330, 437 260"
                fill="none"
                stroke="url(#agent-link-line)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="8 8"
                style={{ animation: "dash-flow 1.5s linear infinite" }}
              />

              <circle cx="170" cy="260" r="30" fill={`${meta.color}22`} stroke={meta.color} strokeWidth="1.5" />
              <circle cx="510" cy="260" r="30" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />

              <text x="170" y="267" textAnchor="middle" fill="#fff" fontSize="22">
                {meta.icon}
              </text>
              <text x="510" y="267" textAnchor="middle" fill="#fff" fontSize="20">
                👤
              </text>

              <text x="170" y="356" textAnchor="middle" fill={meta.color} fontSize="16" fontWeight="700">
                {meta.label} Agent
              </text>
              <text x="170" y="378" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="11">
                {link.subtitle}
              </text>

              <text x="510" y="356" textAnchor="middle" fill="#fff" fontSize="16" fontWeight="700">
                Founder
              </text>
              <text x="510" y="378" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="11">
                Human approval or clarification
              </text>

              <rect x="286" y="232" width="108" height="56" rx="14" fill="rgba(8,10,18,0.9)" stroke="rgba(255,255,255,0.12)" />
              <text x="340" y="253" textAnchor="middle" fill="rgba(255,255,255,0.42)" fontSize="9" letterSpacing="1.8">
                CURRENT LINK
              </text>
              <text x="340" y="275" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="700">
                {chip.label}
              </text>
            </svg>
          </section>

          <section className="overflow-y-auto p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="section-title">Interaction Panel</p>
                <h3 className="mt-2 text-2xl font-semibold">{link.title}</h3>
              </div>
              <span
                className="rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em]"
                style={{ background: chip.bg, border: `1px solid ${chip.border}`, color: chip.text, fontFamily: "'JetBrains Mono', monospace" }}
              >
                {submittingAgent === link.agent ? "Syncing" : chip.label}
              </span>
            </div>

            <div className="mt-6 grid gap-4">
              <div className="rounded-[1.4rem] p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: meta.color, fontFamily: "'JetBrains Mono', monospace" }}>
                  Agent Request
                </p>
                <p className="mt-3 text-base font-medium">{link.requestLabel}</p>
                <p className="mt-3 text-sm leading-6" style={{ color: "rgba(255,255,255,0.62)" }}>
                  {link.why}
                </p>
              </div>

              {link.field && link.state !== "ready" ? (
                <div className="rounded-[1.4rem] p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <label className="grid gap-2">
                    <span className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "'JetBrains Mono', monospace" }}>
                      {link.field.label}
                    </span>

                    {link.field.type === "select" ? (
                      <select
                        value={fieldValue}
                        onChange={(event) => setAnswers((current) => ({ ...current, [link.agent]: event.target.value }))}
                        className="rounded-2xl px-4 py-3 text-sm outline-none"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
                      >
                        {(link.field.options ?? []).map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : link.field.type === "boolean" ? (
                      <div className="flex gap-2">
                        {[
                          { label: "Yes", value: "true" },
                          { label: "No", value: "false" },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setAnswers((current) => ({ ...current, [link.agent]: option.value }))}
                            className="rounded-full px-4 py-2 text-sm font-semibold"
                            style={{
                              background: fieldValue === option.value ? meta.color : "rgba(255,255,255,0.05)",
                              border: fieldValue === option.value ? `1px solid ${meta.color}` : "1px solid rgba(255,255,255,0.08)",
                              color: fieldValue === option.value ? "#fff" : "rgba(255,255,255,0.72)",
                            }}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    ) : link.field.type === "textarea" ? (
                      <textarea
                        value={fieldValue}
                        onChange={(event) => setAnswers((current) => ({ ...current, [link.agent]: event.target.value }))}
                        placeholder={link.field.placeholder}
                        rows={4}
                        className="rounded-2xl px-4 py-3 text-sm outline-none"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
                      />
                    ) : (
                      <input
                        type={link.field.type === "number" ? "number" : "text"}
                        value={fieldValue}
                        onChange={(event) => setAnswers((current) => ({ ...current, [link.agent]: event.target.value }))}
                        placeholder={link.field.placeholder}
                        className="rounded-2xl px-4 py-3 text-sm outline-none"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
                      />
                    )}
                  </label>
                </div>
              ) : null}

              {link.reviewNotes ? (
                <div className="rounded-[1.4rem] p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: meta.color, fontFamily: "'JetBrains Mono', monospace" }}>
                    Review Surface
                  </p>
                  <div className="mt-3 grid gap-2">
                    {link.reviewNotes.map((note) => (
                      <div
                        key={note}
                        className="rounded-xl px-3 py-2 text-sm"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.72)" }}
                      >
                        {note}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="rounded-[1.4rem] p-4" style={{ background: `${meta.color}10`, border: `1px solid ${meta.color}24` }}>
                <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: meta.color, fontFamily: "'JetBrains Mono', monospace" }}>
                  Next Impact
                </p>
                <p className="mt-3 text-sm leading-6" style={{ color: "rgba(255,255,255,0.72)" }}>
                  {link.state === "ready"
                    ? "The agent-human link has been resolved. The next step is now unblocked."
                    : link.nextImpact}
                </p>
              </div>

              {link.answer !== null && link.answer !== undefined ? (
                <div className="rounded-[1.4rem] p-4" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.18)" }}>
                  <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "#6ee7b7", fontFamily: "'JetBrains Mono', monospace" }}>
                    Live Update
                  </p>
                  <p className="mt-3 text-sm font-medium">Founder response recorded</p>
                  <p className="mt-2 text-sm leading-6" style={{ color: "rgba(255,255,255,0.72)" }}>
                    {typeof link.answer === "boolean" ? (link.answer ? "Approved / Yes" : "Rejected / No") : String(link.answer)}
                  </p>
                </div>
              ) : null}

              <div className="rounded-[1.4rem] p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: meta.color, fontFamily: "'JetBrains Mono', monospace" }}>
                    Agent Chat
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {["Why does this matter?", "What changes next?", "What is Gesellschaftsvertrag?"].map((quickAsk) => (
                      <button
                        key={quickAsk}
                        type="button"
                        onClick={() => {
                          setChatDrafts((current) => ({ ...current, [link.agent]: quickAsk }));
                        }}
                        className="rounded-full px-2.5 py-1 text-[11px]"
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.65)" }}
                      >
                        {quickAsk}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-3 max-h-64 overflow-y-auto rounded-2xl p-3" style={{ background: "rgba(0,0,0,0.18)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="grid gap-3">
                    {chatMessages.map((message, index) => (
                      <div
                        key={`${message.role}-${index}`}
                        className="max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-6"
                        style={{
                          marginLeft: message.role === "user" ? "auto" : undefined,
                          background: message.role === "user" ? `${meta.color}20` : "rgba(255,255,255,0.05)",
                          border: message.role === "user" ? `1px solid ${meta.color}35` : "1px solid rgba(255,255,255,0.08)",
                          color: "rgba(255,255,255,0.78)",
                        }}
                      >
                        <p
                          className="mb-1 text-[10px] uppercase tracking-[0.18em]"
                          style={{ color: message.role === "user" ? meta.color : "rgba(255,255,255,0.38)", fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          {message.role === "user" ? "Founder" : `${meta.label} Agent`}
                        </p>
                        <p>{message.text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <input
                    value={chatDrafts[link.agent]}
                    onChange={(event) => setChatDrafts((current) => ({ ...current, [link.agent]: event.target.value }))}
                    placeholder={`Ask ${meta.label} anything about this request...`}
                    className="flex-1 rounded-2xl px-4 py-3 text-sm outline-none"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
                  />
                  <button
                    type="button"
                    onClick={askAgent}
                    className="rounded-full px-4 py-2 text-sm font-semibold"
                    style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
                  >
                    Ask
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <p className="text-xs leading-5" style={{ color: "rgba(255,255,255,0.42)" }}>
                This popup is intentionally isolated from the main dashboard so human-in-the-loop interactions do not clutter the rest of the UI.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full px-4 py-2 text-sm"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.72)" }}
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={submittingAgent === link.agent || link.state === "ready"}
                  className="rounded-full px-5 py-2.5 text-sm font-semibold"
                  style={{ background: meta.color, color: "#fff", boxShadow: `0 0 22px ${meta.color}35`, opacity: submittingAgent === link.agent || link.state === "ready" ? 0.6 : 1 }}
                >
                  {submittingAgent === link.agent ? "Syncing..." : link.state === "ready" ? "Resolved" : link.state === "review_ready" ? "Approve and continue" : "Submit to agent"}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
