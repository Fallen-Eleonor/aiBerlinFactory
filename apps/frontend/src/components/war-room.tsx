"use client";

import { useEffect, useRef, useState } from "react";
import { MissionLogEntry, StatusEvent } from "@/lib/types";

// ── Types ────────────────────────────────────────────────────────────────────

type AgentKey = "legal" | "finance" | "hiring" | "ops";
type NodeKey = AgentKey | "brain";
type NodeStatus = "idle" | "running" | "complete" | "failed";

type AgentState = {
  status: string;
  message: string;
};

type Bubble = {
  id: number;
  from: NodeKey;
  to: NodeKey;
  color: string;
};

// ── Config ───────────────────────────────────────────────────────────────────

const NODE_CFG: Record<NodeKey, { cx: number; cy: number; color: string; label: string; icon: string }> = {
  brain:   { cx: 300, cy: 200, color: "#6C63FF", label: "Orchestrator", icon: "🧠" },
  legal:   { cx: 100, cy: 75,  color: "#7B2FBE", label: "Legal",        icon: "⚖️" },
  finance: { cx: 500, cy: 75,  color: "#00C9A7", label: "Finance",      icon: "💶" },
  hiring:  { cx: 100, cy: 325, color: "#10B981", label: "Hiring",       icon: "👥" },
  ops:     { cx: 500, cy: 325, color: "#F59E0B", label: "Ops",          icon: "⚙️" },
};

const AGENT_THOUGHTS: Record<AgentKey, string[]> = {
  legal: [
    "Reviewing initial capital...",
    "Checking §5a GmbHG...",
    "UG (haftungsbeschränkt) recommended ✓",
    "Generating Handelsregister checklist...",
    "Preparing Gesellschaftsvertrag...",
    "Legal analysis complete ✓",
  ],
  finance: [
    "Loading Berlin salary benchmarks...",
    "Calculating employer load: +20%...",
    "Generating 18-month financial model...",
    "Burn rate calculated...",
    "Checking EXIST grant eligibility...",
    "KfW StartGeld available ✓",
    "Financial plan complete ✓",
  ],
  hiring: [
    "Reviewing team size and budget...",
    "Checking Werkstudent model...",
    "Scheinselbstständigkeit risk: LOW ✓",
    "First role: Senior Developer — Remote...",
    "6-month Probezeit planned...",
    "Hiring plan complete ✓",
  ],
  ops: [
    "Reviewing DSGVO compliance...",
    "Impressum + Datenschutzerklärung required ✓",
    "Generating tool-stack recommendation...",
    "Vercel + Supabase + Stripe configured...",
    "Cookie opt-in requires explicit consent ✓",
    "Operations setup complete ✓",
  ],
};

const AGENT_KEYS: AgentKey[] = ["legal", "finance", "hiring", "ops"];

// ── Path helpers ─────────────────────────────────────────────────────────────

function getPath(from: NodeKey, to: NodeKey): string {
  const f = NODE_CFG[from];
  const t = NODE_CFG[to];
  const cx = (f.cx + t.cx) / 2;
  const cy = (f.cy + t.cy) / 2;
  return `M ${f.cx} ${f.cy} Q ${cx} ${cy} ${t.cx} ${t.cy}`;
}

function nodeStatus(state: AgentState | undefined): NodeStatus {
  if (!state) return "idle";
  if (state.status === "complete") return "complete";
  if (state.status === "failed") return "failed";
  if (state.status === "running") return "running";
  return "idle";
}

// ── Typewriter hook ───────────────────────────────────────────────────────────

function useTypewriter(agent: AgentKey, isRunning: boolean) {
  const [idx, setIdx] = useState(0);
  const thoughts = AGENT_THOUGHTS[agent];

  useEffect(() => {
    if (!isRunning) { setIdx(0); return; }
    const interval = setInterval(() => {
      setIdx((prev) => (prev + 1) % thoughts.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [isRunning, thoughts.length]);

  return isRunning ? thoughts[idx] : "";
}

// ── Agent Node SVG component ──────────────────────────────────────────────────

function AgentNode({
  id,
  status,
  thought,
}: {
  id: NodeKey;
  status: NodeStatus;
  thought?: string;
}) {
  const cfg = NODE_CFG[id];
  const isActive = status === "running";
  const isDone = status === "complete";
  const isFailed = status === "failed";

  const ringColor =
    isDone ? "#10B981" : isFailed ? "#ef4444" : isActive ? cfg.color : "rgba(255,255,255,0.08)";

  const ringWidth = isActive || isDone ? 2.5 : 1;
  const opacity = status === "idle" ? 0.45 : 1;

  return (
    <g style={{ opacity, transition: "opacity 0.4s" }}>
      {/* Glow halo (shown when active or done) */}
      {(isActive || isDone) && (
        <circle
          cx={cfg.cx}
          cy={cfg.cy}
          r={34}
          fill="none"
          stroke={ringColor}
          strokeWidth={1}
          opacity={0.3}
          style={{ filter: `blur(8px)` }}
        />
      )}

      {/* Main circle */}
      <circle
        cx={cfg.cx}
        cy={cfg.cy}
        r={28}
        fill="rgba(0,0,0,0.7)"
        stroke={ringColor}
        strokeWidth={ringWidth}
        style={{ transition: "stroke 0.4s, stroke-width 0.3s" }}
      />

      {/* Pulse ring on active */}
      {isActive && (
        <circle
          cx={cfg.cx}
          cy={cfg.cy}
          r={28}
          fill="none"
          stroke={cfg.color}
          strokeWidth={1.5}
          opacity={0.5}
          style={{
            animation: "agent-pulse 2s ease-in-out infinite",
          }}
        />
      )}

      {/* Icon */}
      <text
        x={cfg.cx}
        y={cfg.cy + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={16}
        style={{ userSelect: "none" }}
      >
        {isDone ? "✓" : cfg.icon}
      </text>

      {/* Label below */}
      <text
        x={cfg.cx}
        y={cfg.cy + 42}
        textAnchor="middle"
        fill={isDone ? "#10B981" : cfg.color}
        fontSize={10}
        fontWeight={600}
        letterSpacing={1}
        style={{ textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace", transition: "fill 0.4s" }}
      >
        {isDone ? "Completed" : cfg.label}
      </text>

      {/* Thought bubble for running agents */}
      {isActive && thought && (
        <g>
          <rect
            x={id === "finance" || id === "ops" ? cfg.cx - 150 : cfg.cx + 4}
            y={cfg.cy - 58}
            width={146}
            height={24}
            rx={6}
            fill="rgba(0,0,0,0.8)"
            stroke={cfg.color}
            strokeWidth={0.8}
            opacity={0.9}
          />
          <text
            x={id === "finance" || id === "ops" ? cfg.cx - 77 : cfg.cx + 77}
            y={cfg.cy - 42}
            textAnchor="middle"
            fill={cfg.color}
            fontSize={7.5}
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {thought.length > 22 ? thought.slice(0, 22) + "…" : thought}
          </text>
        </g>
      )}
    </g>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function WarRoom({
  states,
  events,
  missionLog,
  completed,
}: {
  states: Record<string, AgentState>;
  events: StatusEvent[];
  missionLog: MissionLogEntry[];
  completed: boolean;
}) {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const bubbleId = useRef(0);
  const prevEventCount = useRef(0);

  // Typewriter per agent
  const legalThought = useTypewriter("legal", states["legal"]?.status === "running");
  const financeThought = useTypewriter("finance", states["finance"]?.status === "running");
  const hiringThought = useTypewriter("hiring", states["hiring"]?.status === "running");
  const opsThought = useTypewriter("ops", states["ops"]?.status === "running");

  const thoughts: Record<AgentKey, string> = {
    legal: legalThought,
    finance: financeThought,
    hiring: hiringThought,
    ops: opsThought,
  };

  // Add bubble on new events
  useEffect(() => {
    const newEvents = events.slice(prevEventCount.current);
    prevEventCount.current = events.length;

    for (const event of newEvents) {
      if (!event.agent) continue;
      const agent = event.agent as AgentKey;
      if (!AGENT_KEYS.includes(agent)) continue;

      const from: NodeKey = event.type === "agent_started" ? "brain" : agent;
      const to: NodeKey = event.type === "agent_started" ? agent : "brain";
      const color = NODE_CFG[agent].color;
      const id = ++bubbleId.current;

      setBubbles((prev) => [...prev, { id, from, to, color }]);
      setTimeout(() => {
        setBubbles((prev) => prev.filter((b) => b.id !== id));
      }, 1400);
    }
  }, [events]);

  const brainStatus: NodeStatus =
    completed || events.some((e) => e.type === "job_completed")
      ? "complete"
      : events.some((e) => e.type === "job_failed")
      ? "failed"
      : events.some((e) => e.type === "job_started")
      ? "running"
      : "idle";

  const allDone = completed || AGENT_KEYS.every((k) => states[k]?.status === "complete");
  const fallbackEntries = missionLog.slice(-6);

  return (
    <section className="liquid-glass glass-border-soft rounded-[2rem] p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="section-title">Agent War Room</p>
          <h2 className="mt-2 text-2xl font-semibold">Parallel AI orchestration</h2>
        </div>
        <div className="flex items-center gap-2">
          {allDone ? (
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold tracking-widest"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                background: "rgba(16,185,129,0.15)",
                color: "#10B981",
                border: "1px solid rgba(16,185,129,0.3)",
              }}
            >
              ✓ Completed
            </span>
          ) : events.length > 0 ? (
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold tracking-widest"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                background: "rgba(108,99,255,0.15)",
                color: "#a89dff",
                border: "1px solid rgba(108,99,255,0.3)",
                animation: "agent-pulse 2s ease-in-out infinite",
              }}
            >
              ⬤ Live
            </span>
          ) : completed && fallbackEntries.length > 0 ? (
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
              Loaded from saved mission log
            </span>
          ) : (
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
              Waiting for backend...
            </span>
          )}
        </div>
      </div>

      {/* SVG Orchestration Graph */}
      <div className="mt-6 overflow-hidden rounded-2xl" style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.05)" }}>
        <svg
          viewBox="0 0 600 400"
          className="w-full"
          style={{ maxHeight: 340 }}
        >
          {/* Connection lines — base */}
          {AGENT_KEYS.map((agent) => (
            <path
              key={`line-${agent}`}
              d={getPath(agent, "brain")}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
              strokeDasharray="6 4"
            />
          ))}

          {/* Connection lines — active overlay */}
          {AGENT_KEYS.map((agent) => {
            const st = nodeStatus(states[agent]);
            if (st === "idle") return null;
            const color = NODE_CFG[agent].color;
            return (
              <path
                key={`line-active-${agent}`}
                d={getPath(agent, "brain")}
                fill="none"
                stroke={color}
                strokeWidth={1.5}
                strokeDasharray="6 4"
                opacity={st === "complete" ? 0.35 : 0.6}
                style={{
                  animation: st === "running" ? "dash-flow 1.2s linear infinite" : undefined,
                }}
              />
            );
          })}

          {/* Animated bubbles */}
          {bubbles.map((b) => (
            <circle key={b.id} r={5} fill={b.color} opacity={0.9}>
              <animateMotion
                dur="1.2s"
                begin="0s"
                repeatCount="1"
                path={getPath(b.from, b.to)}
              />
            </circle>
          ))}

          {/* Agent nodes */}
          {AGENT_KEYS.map((agent) => (
            <AgentNode key={agent} id={agent} status={nodeStatus(states[agent])} thought={thoughts[agent]} />
          ))}

          {/* Brain node */}
          <AgentNode id="brain" status={brainStatus} />
        </svg>
      </div>

      {/* Agent status cards */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {AGENT_KEYS.map((agent) => {
          const state = states[agent] ?? { status: "waiting", message: "Awaiting orchestration" };
          const cfg = NODE_CFG[agent];
          const st = nodeStatus(state);
          return (
            <div
              key={agent}
              className="rounded-[1.25rem] p-4 transition-all"
              style={{
                background: st === "running"
                  ? `${cfg.color}12`
                  : st === "complete"
                  ? "rgba(16,185,129,0.07)"
                  : "rgba(255,255,255,0.02)",
                border: `1px solid ${
                  st === "running"
                    ? `${cfg.color}40`
                    : st === "complete"
                    ? "rgba(16,185,129,0.3)"
                    : "rgba(255,255,255,0.06)"
                }`,
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{cfg.icon}</span>
                  <p className="text-sm font-semibold">{cfg.label}</p>
                </div>
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    background:
                      st === "complete" ? "#10B981"
                      : st === "failed" ? "#ef4444"
                      : st === "running" ? cfg.color
                      : "rgba(255,255,255,0.15)",
                    animation: st === "running" ? "agent-pulse 1.5s ease-in-out infinite" : undefined,
                  }}
                />
              </div>
              <p
                className="mt-1.5 text-xs uppercase tracking-wider"
                style={{ color: "rgba(255,255,255,0.4)", fontFamily: "'JetBrains Mono', monospace" }}
              >
                {state.status}
              </p>
              <p className="mt-1 text-xs leading-5" style={{ color: "rgba(255,255,255,0.6)" }}>
                {thoughts[agent] || state.message}
              </p>
            </div>
          );
        })}
      </div>

      {/* Live event log */}
      <div
        className="mt-5 rounded-[1.5rem] p-4"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Live Event Log</p>
          <span
            className="text-xs uppercase tracking-wider"
            style={{ color: "rgba(255,255,255,0.35)", fontFamily: "'JetBrains Mono', monospace" }}
          >
            {events.length} events
          </span>
        </div>
        <div className="mt-3 grid gap-1.5">
          {events.length === 0 ? (
            fallbackEntries.length > 0 ? (
              fallbackEntries.map((entry, index) => (
                <div
                  key={`${entry.title}-${entry.offset_seconds}`}
                  className="flex items-start gap-3 rounded-xl px-3 py-2 text-xs"
                  style={{ color: index === fallbackEntries.length - 1 ? "#fff" : "rgba(255,255,255,0.45)" }}
                >
                  <span
                    className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: "rgba(108,99,255,0.75)", marginTop: 4 }}
                  />
                  <span className="flex-1 leading-5">{entry.message}</span>
                  <span
                    className="shrink-0"
                    style={{ fontFamily: "'JetBrains Mono', monospace", color: "rgba(255,255,255,0.2)" }}
                  >
                    +{entry.offset_seconds.toFixed(1)}s
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                Waiting for backend events...
              </p>
            )
          ) : (
            events.slice(-6).map((event, i) => {
              const isLatest = i === Math.min(events.length, 6) - 1;
              const agentColor = event.agent ? NODE_CFG[event.agent as NodeKey]?.color : undefined;
              return (
                <div
                  key={`${event.timestamp}-${event.message}`}
                  className="flex items-start gap-3 rounded-xl px-3 py-2 text-xs transition-all"
                  style={{
                    background: isLatest ? "rgba(255,255,255,0.04)" : "transparent",
                    color: isLatest ? "#fff" : "rgba(255,255,255,0.45)",
                  }}
                >
                  {agentColor && (
                    <span
                      className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: agentColor, marginTop: 4 }}
                    />
                  )}
                  <span className="flex-1 leading-5">{event.message}</span>
                  <span
                    className="shrink-0"
                    style={{ fontFamily: "'JetBrains Mono', monospace", color: "rgba(255,255,255,0.2)" }}
                  >
                    {new Date(event.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
