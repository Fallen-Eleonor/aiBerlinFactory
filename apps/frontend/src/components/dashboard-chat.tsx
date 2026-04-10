"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import { fetchJobChat, sendJobChatMessage } from "@/lib/api";
import { ChatMessage } from "@/lib/types";

const STARTER_PROMPTS = [
  "What should I do first on the legal checklist?",
  "Which generated document should I review before the notary?",
  "Summarize the biggest legal risks in simple language.",
];

function formatTimestamp(value: string) {
  return new Date(value).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DashboardChat({
  jobId,
  companyName,
  enabled,
}: {
  jobId: string;
  companyName: string;
  enabled: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!enabled) {
      setMessages([]);
      setLoading(false);
      setHistoryLoaded(false);
      setOpen(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    const timer = window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 80);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      window.clearTimeout(timer);
    };
  }, [open]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) {
      return;
    }

    if (messages.length === 0 && !sending) {
      node.scrollTop = 0;
      return;
    }

    node.scrollTop = node.scrollHeight;
  }, [messages, sending, open]);

  async function loadHistory() {
    if (!enabled || historyLoaded || loading) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const history = await fetchJobChat(jobId);
      setMessages(history);
      setHistoryLoaded(true);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load chat history.");
    } finally {
      setLoading(false);
    }
  }

  async function openChat() {
    setOpen(true);
    await loadHistory();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || sending || !enabled) {
      return;
    }

    const optimisticMessage: ChatMessage = {
      role: "user",
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    const previousMessages = messages;

    setDraft("");
    setSending(true);
    setError(null);
    setMessages((current) => [...current, optimisticMessage]);

    try {
      const nextMessages = await sendJobChatMessage(jobId, trimmed);
      setMessages(nextMessages);
      setHistoryLoaded(true);
    } catch (sendError) {
      setMessages(previousMessages);
      setError(sendError instanceof Error ? sendError.message : "Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  function applyPrompt(prompt: string) {
    setDraft(prompt);
    textareaRef.current?.focus();
  }

  return (
    <>
      {!open ? (
        <div className="fixed right-4 bottom-4 z-40 sm:right-6 sm:bottom-6">
          <button
            type="button"
            onClick={() => void openChat()}
            className="group relative overflow-hidden rounded-[1.75rem] p-[1px] shadow-[0_22px_55px_rgba(0,0,0,0.42)] transition hover:scale-[1.02]"
            style={{
              background: "linear-gradient(135deg, rgba(123,47,190,0.72), rgba(108,99,255,0.9), rgba(0,201,167,0.55))",
            }}
          >
            <span
              className="absolute inset-0 opacity-80"
              style={{
                background:
                  "radial-gradient(circle at top right, rgba(255,255,255,0.24), transparent 42%), radial-gradient(circle at bottom left, rgba(0,201,167,0.16), transparent 40%)",
              }}
            />
            <span
              className="relative flex items-center gap-3 rounded-[calc(1.75rem-1px)] px-4 py-3 backdrop-blur-xl sm:px-5"
              style={{ background: "rgba(8,10,18,0.92)" }}
            >
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.1rem] text-sm font-semibold"
                style={{
                  background: "linear-gradient(145deg, rgba(108,99,255,0.38), rgba(123,47,190,0.2))",
                  border: "1px solid rgba(255,255,255,0.12)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12), 0 0 28px rgba(108,99,255,0.22)",
                }}
              >
                AI
              </span>
              <span className="hidden min-w-0 sm:block">
                <span className="block text-left text-xs uppercase tracking-[0.22em]" style={{ color: "rgba(255,255,255,0.42)" }}>
                  Copilot
                </span>
                <span className="mt-1 block text-left text-sm font-semibold text-white">
                  Ask about docs and legal setup
                </span>
              </span>
              <span
                className="hidden h-2.5 w-2.5 rounded-full sm:block"
                style={{
                  background: enabled ? "#10B981" : "rgba(255,255,255,0.26)",
                  boxShadow: enabled ? "0 0 16px rgba(16,185,129,0.7)" : "none",
                }}
              />
            </span>
          </button>
        </div>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close assistant"
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full"
            style={{ background: "rgba(3,6,13,0.7)", backdropFilter: "blur(12px)" }}
          />

          <div className="pointer-events-none absolute inset-0 flex items-end justify-end p-2 sm:p-6">
            <section
              role="dialog"
              aria-modal="true"
              aria-label="Dashboard Copilot"
              className="liquid-glass glass-border-soft pointer-events-auto relative flex h-[min(88dvh,760px)] max-h-[calc(100dvh-1rem)] min-h-0 w-full flex-col overflow-hidden rounded-[2rem] border shadow-[0_28px_90px_rgba(0,0,0,0.52)] sm:max-w-[29rem] sm:max-h-[calc(100dvh-3rem)]"
              style={{
                background:
                  "linear-gradient(180deg, rgba(12,14,24,0.96) 0%, rgba(7,9,18,0.98) 100%)",
              }}
            >
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-36"
                style={{
                  background:
                    "radial-gradient(circle at top left, rgba(123,47,190,0.24), transparent 42%), radial-gradient(circle at top right, rgba(0,201,167,0.16), transparent 40%)",
                }}
              />

              <header className="relative shrink-0 flex items-start justify-between gap-4 border-b px-5 py-4 sm:px-6" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                <div className="min-w-0">
                  <p className="section-title">Dashboard Copilot</p>
                  <h2 className="mt-2 text-[1.9rem] leading-[1.05] font-semibold">Legal and document assistant</h2>
                  <p className="mt-2 max-w-sm text-sm leading-6" style={{ color: "rgba(255,255,255,0.54)" }}>
                    Grounded in the analysis, checklist state, and generated files for {companyName}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="shrink-0 rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] transition hover:bg-white/6"
                  style={{ color: "rgba(255,255,255,0.56)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  Close
                </button>
              </header>

              <div
                ref={viewportRef}
                className="relative min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6"
              >
                {!enabled ? (
                  <div
                    className="rounded-[1.35rem] px-4 py-5 text-sm leading-7"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    Chat becomes available once the dashboard analysis is finished.
                  </div>
                ) : null}

                {enabled && loading ? (
                  <div
                    className="rounded-[1.35rem] px-4 py-5 text-sm"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    Loading conversation context...
                  </div>
                ) : null}

                {enabled && !loading && messages.length === 0 ? (
                  <div className="grid gap-3">
                    <div
                      className="rounded-[1.35rem] px-4 py-5 text-sm leading-7"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      Ask for a plain-English explanation of a generated document, the next legal action, or what to fix before the notary.
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {STARTER_PROMPTS.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => applyPrompt(prompt)}
                          className="rounded-full px-3 py-2 text-xs transition hover:scale-[1.01]"
                          style={{
                            background: "rgba(108,99,255,0.12)",
                            border: "1px solid rgba(108,99,255,0.26)",
                            color: "#d9d2ff",
                          }}
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-3">
                  {messages.map((message, index) => {
                    const assistant = message.role === "assistant";
                    return (
                      <div
                        key={`${message.created_at}-${index}`}
                        className="rounded-[1.35rem] px-4 py-4"
                        style={{
                          marginLeft: assistant ? 0 : "auto",
                          maxWidth: "90%",
                          background: assistant
                            ? "rgba(255,255,255,0.045)"
                            : "linear-gradient(145deg, rgba(108,99,255,0.22), rgba(123,47,190,0.18))",
                          border: assistant
                            ? "1px solid rgba(255,255,255,0.08)"
                            : "1px solid rgba(108,99,255,0.35)",
                          boxShadow: assistant ? "none" : "0 10px 30px rgba(108,99,255,0.12)",
                        }}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <p
                            className="text-xs font-semibold uppercase tracking-[0.22em]"
                            style={{ color: assistant ? "rgba(255,255,255,0.45)" : "#d9d2ff", fontFamily: "'JetBrains Mono', monospace" }}
                          >
                            {assistant ? "Copilot" : "You"}
                          </p>
                          <p className="text-xs" style={{ color: "rgba(255,255,255,0.32)" }}>
                            {formatTimestamp(message.created_at)}
                          </p>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-7" style={{ color: "rgba(255,255,255,0.84)" }}>
                          {message.content}
                        </p>
                      </div>
                    );
                  })}

                  {sending ? (
                    <div
                      className="rounded-[1.35rem] px-4 py-4"
                      style={{
                        maxWidth: "90%",
                        background: "rgba(255,255,255,0.045)",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <p
                        className="text-xs font-semibold uppercase tracking-[0.22em]"
                        style={{ color: "rgba(255,255,255,0.45)", fontFamily: "'JetBrains Mono', monospace" }}
                      >
                        Copilot
                      </p>
                      <p className="mt-3 text-sm" style={{ color: "rgba(255,255,255,0.62)" }}>
                        Thinking through the dashboard context...
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              <footer className="relative shrink-0 border-t px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                {error ? (
                  <div
                    className="mb-3 rounded-[1.1rem] px-4 py-3 text-sm text-red-200"
                    style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.22)" }}
                  >
                    {error}
                  </div>
                ) : null}

                <form onSubmit={handleSubmit}>
                  <div
                    className="rounded-[1.5rem] p-3"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.07)",
                    }}
                  >
                    <textarea
                      ref={textareaRef}
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder="Ask about the checklist, generated docs, founder resolution, or next actions..."
                      disabled={!enabled || sending}
                      rows={3}
                      className="w-full resize-none bg-transparent px-2 py-2 text-sm leading-7 outline-none placeholder:text-white/25"
                    />
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                        Job-scoped context only.
                      </p>
                      <button
                        type="submit"
                        disabled={!enabled || sending || draft.trim().length === 0}
                        className="rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                        style={{
                          background: "linear-gradient(135deg, #6C63FF, #7B2FBE)",
                          color: "#fff",
                          boxShadow: "0 0 24px rgba(108,99,255,0.28)",
                        }}
                      >
                        {sending ? "Sending..." : "Send"}
                      </button>
                    </div>
                  </div>
                </form>
              </footer>
            </section>
          </div>
        </div>
      ) : null}
    </>
  );
}
