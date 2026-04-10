"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  fetchJobDetails,
  fetchJobRequest,
  fetchJobTasks,
  fetchJobs,
  fetchResult,
  openStatusStream,
  updateJobTasks,
} from "@/lib/api";
import { getClientId } from "@/lib/client-id";
import { AnalyzeRequest, AnalysisResult, JobDetails, JobSummary, StatusEvent } from "@/lib/types";
import { ResultsTabs } from "@/components/results-tabs";
import { DashboardChat } from "@/components/dashboard-chat";
import { WarRoom } from "@/components/war-room";

const initialAgentStates = {
  legal: { status: "waiting", message: "Awaiting orchestration" },
  finance: { status: "waiting", message: "Awaiting orchestration" },
  hiring: { status: "waiting", message: "Awaiting orchestration" },
  ops: { status: "waiting", message: "Awaiting orchestration" },
};

const AGENT_KEYS = ["legal", "finance", "hiring", "ops"] as const;

function formatEur(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function healthTone(score: number) {
  if (score >= 85) return { color: "#a89dff", bg: "rgba(108,99,255,0.15)", border: "rgba(108,99,255,0.4)" };
  if (score >= 70) return { color: "#10B981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.35)" };
  if (score >= 55) return { color: "#F59E0B", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.35)" };
  return { color: "rgba(255,255,255,0.45)", bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.1)" };
}

function completedAgentStates() {
  return {
    legal: { status: "complete", message: "Legal agent finished." },
    finance: { status: "complete", message: "Finance agent finished." },
    hiring: { status: "complete", message: "Hiring agent finished." },
    ops: { status: "complete", message: "Ops agent finished." },
  };
}

function displayScoreLabel(label: string) {
  if (label === "Rechtsform") return "Entity";
  if (label === "Finanzen") return "Finance";
  if (label === "Betrieb") return "Operations";
  return label;
}

function biggestRisk(result: AnalysisResult, jobRequest: AnalyzeRequest | null) {
  if (result.finance.runway_months.base <= 4) {
    return "Short runway before the next financing milestone.";
  }
  if (jobRequest?.founder_background.foreign_founder) {
    return "Cross-border founder setup can slow banking and notarization.";
  }
  if (result.ops.score < 72) {
    return "Compliance setup still needs tightening before launch.";
  }
  return "The first hiring wave must stay disciplined to preserve runway.";
}

function bestFundingPath(result: AnalysisResult) {
  const eligibleProgram = result.finance.funding_programs.find((program) => program.eligible);
  return eligibleProgram?.name ?? "Investor-led pre-seed round";
}

export function DashboardShell({ jobId }: { jobId: string }) {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [jobDetails, setJobDetails] = useState<JobDetails | null>(null);
  const [jobRequest, setJobRequest] = useState<AnalyzeRequest | null>(null);
  const [history, setHistory] = useState<JobSummary[]>([]);
  const [tasks, setTasks] = useState<Record<string, boolean>>({});
  const [events, setEvents] = useState<StatusEvent[]>([]);
  const [agentStates, setAgentStates] = useState(initialAgentStates);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  useEffect(() => {
    const clientId = getClientId();
    let mounted = true;
    let source: EventSource | null = null;
    let completed = false;

    async function refreshHistory() {
      const jobs = await fetchJobs(clientId);
      if (mounted) {
        setHistory(jobs);
      }
    }

    async function refreshDetails() {
      const [details, requestPayload, taskPayload] = await Promise.all([
        fetchJobDetails(jobId, clientId),
        fetchJobRequest(jobId, clientId),
        fetchJobTasks(jobId, clientId),
      ]);

      if (!mounted) {
        return;
      }

      setJobDetails(details);
      setJobRequest(requestPayload);
      setTasks(taskPayload.tasks);
    }

    async function bootstrap() {
      try {
        const [details, requestPayload, taskPayload, jobs, existingResult] = await Promise.all([
          fetchJobDetails(jobId, clientId),
          fetchJobRequest(jobId, clientId),
          fetchJobTasks(jobId, clientId),
          fetchJobs(clientId),
          fetchResult(jobId, clientId),
        ]);

        if (!mounted) {
          return;
        }

        setJobDetails(details);
        setJobRequest(requestPayload);
        setTasks(taskPayload.tasks);
        setHistory(jobs);

        if (existingResult) {
          completed = true;
          setResult(existingResult);
          setAgentStates(completedAgentStates());
        }
      } catch (error) {
        if (mounted) {
          setLoadingError(error instanceof Error ? error.message : "Failed to load dashboard context.");
        }
      }

      source = openStatusStream(
        jobId,
        async (event) => {
          if (!mounted) {
            return;
          }

          setEvents((current) => [...current, event]);

          if (AGENT_KEYS.includes(event.agent as (typeof AGENT_KEYS)[number])) {
            setAgentStates((current) => ({
              ...current,
              [event.agent as keyof typeof current]: {
                status:
                  event.type === "agent_completed"
                    ? "complete"
                    : event.type === "agent_failed"
                      ? "failed"
                      : "running",
                message: event.message,
              },
            }));
          }

          if (event.type === "job_completed") {
            completed = true;
            const [completedResult] = await Promise.all([
              fetchResult(jobId, clientId),
              refreshDetails(),
              refreshHistory(),
            ]);
            if (completedResult && mounted) {
              setResult(completedResult);
              setAgentStates(completedAgentStates());
            }
            source?.close();
          }

          if (event.type === "job_failed") {
            completed = true;
            setLoadingError(event.message);
            source?.close();
          }
        },
        clientId,
      );

      source.onerror = () => {
        void (async () => {
          if (completed) {
            return;
          }

          try {
            const maybeResult = await fetchResult(jobId, clientId);
            if (maybeResult && mounted) {
              completed = true;
              setResult(maybeResult);
              setAgentStates(completedAgentStates());
              source?.close();
              return;
            }
          } catch {
            // Ignore and show the stream error below.
          }

          if (mounted) {
            setLoadingError("Status stream disconnected before completion. The backend may have restarted or the SSE connection may have dropped.");
          }
        })();
      };
    }

    void bootstrap();
    return () => {
      mounted = false;
      source?.close();
    };
  }, [jobId]);

  const scoreSegments = useMemo(() => result?.overview.score_breakdown ?? [], [result]);
  const companyName = jobRequest?.company_name ?? jobDetails?.company_name ?? "Startup OS Job";
  const healthColors = result ? healthTone(result.overview.health_score) : null;

  async function handleTaskToggle(key: string, checked: boolean) {
    const clientId = getClientId();
    const previous = tasks;
    const next = { ...previous, [key]: checked };
    setTasks(next);

    try {
      const payload = await updateJobTasks(jobId, next, clientId);
      setTasks(payload.tasks);
      setLoadingError(null);
    } catch (error) {
      setTasks(previous);
      setLoadingError(error instanceof Error ? error.message : "Failed to persist checklist state.");
    }
  }

  return (
    <main className="aurora-page mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-5 py-8 md:px-8">
      <div className="aurora-orb" />
      <header className="liquid-glass glass-border-soft flex flex-col gap-6 rounded-[2rem] p-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <Link href="/" className="text-xs transition" style={{ color: "rgba(255,255,255,0.35)" }}>
              ← Startup OS
            </Link>
            <span style={{ color: "rgba(255,255,255,0.15)" }}>/</span>
            <p className="section-title">Dashboard</p>
          </div>
          <h1 className="mt-1 text-4xl font-semibold">{companyName}</h1>
          <p className="glass-muted mt-3 max-w-3xl text-sm leading-7">
            Four specialist agents analyze the founder brief. This view now stays in sync with the backend across request context, task state, downloads, and job history.
          </p>
          {jobRequest ? (
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {[
                jobRequest.bundesland,
                `${jobRequest.founder_count} founders`,
                formatEur(jobRequest.available_capital_eur),
                jobRequest.industry,
              ].map((item) => (
                <span
                  key={item}
                  className="rounded-full px-3 py-1.5"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.68)" }}
                >
                  {item}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {result && healthColors ? (
          <div className="flex flex-col items-end gap-3">
            <div
              className="rounded-2xl px-5 py-4 text-right"
              style={{ background: healthColors.bg, border: `1px solid ${healthColors.border}` }}
            >
              <p className="section-title">Readiness score</p>
              <p className="numeric mt-1 text-3xl font-bold" style={{ color: healthColors.color }}>
                {result.overview.health_score}
                <span className="text-lg" style={{ color: "rgba(255,255,255,0.3)" }}>/100</span>
              </p>
              <p className="mt-1 text-xs font-semibold tracking-widest" style={{ fontFamily: "'JetBrains Mono', monospace", color: healthColors.color }}>
                {result.overview.health_label}
              </p>
            </div>
          </div>
        ) : (
          <div className="glass-pill rounded-[1.5rem] px-5 py-4">
            <p className="section-title">Job ID</p>
            <p className="numeric mt-2 text-sm">{jobId}</p>
          </div>
        )}
      </header>

      <WarRoom
        states={agentStates}
        events={events}
        missionLog={result?.mission_log ?? []}
        completed={Boolean(result) || jobDetails?.status === "completed"}
      />

      {loadingError ? (
        <div className="liquid-glass glass-border-soft rounded-[1.5rem] p-5 text-sm text-red-300">{loadingError}</div>
      ) : null}

      {result ? (
        <>
          <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="liquid-glass glass-border-soft rounded-[2rem] p-6">
              <p className="section-title">Executive summary</p>
              <h2 className="mt-2 text-3xl font-semibold">{result.overview.recommended_entity}</h2>
              <p className="glass-muted mt-4 max-w-2xl text-sm leading-7">{result.legal.narrative}</p>
              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="glass-soft rounded-[1.5rem] p-4">
                  <p className="section-title">Runway</p>
                  <p className="numeric mt-2 text-2xl font-semibold">{result.overview.runway_months_base} months</p>
                </div>
                <div className="glass-soft rounded-[1.5rem] p-4">
                  <p className="section-title">Monthly burn</p>
                  <p className="numeric mt-2 text-2xl font-semibold">{formatEur(result.finance.monthly_burn_eur)}</p>
                </div>
                <div className="glass-soft rounded-[1.5rem] p-4">
                  <p className="section-title">Next step</p>
                  <p className="mt-2 text-lg font-semibold">{result.overview.next_step}</p>
                </div>
                <div className="glass-soft rounded-[1.5rem] p-4">
                  <p className="section-title">Next milestone</p>
                  <p className="mt-2 text-sm font-semibold">{result.overview.next_milestone}</p>
                </div>
                <div className="glass-soft rounded-[1.5rem] p-4">
                  <p className="section-title">Best funding path</p>
                  <p className="mt-2 text-sm font-semibold">{bestFundingPath(result)}</p>
                </div>
                <div className="glass-soft rounded-[1.5rem] p-4">
                  <p className="section-title">Biggest risk</p>
                  <p className="mt-2 text-sm font-semibold">{biggestRisk(result, jobRequest)}</p>
                </div>
              </div>
            </div>

            <div className="liquid-glass glass-border-soft rounded-[2rem] p-6">
              <p className="section-title">Score breakdown</p>
              <div className="mt-5 grid gap-3">
                {scoreSegments.map((segment) => {
                  const colors: Record<string, string> = {
                    Entity: "#7B2FBE",
                    Finance: "#00C9A7",
                    Team: "#10B981",
                    Operations: "#F59E0B",
                  };
                  const color = colors[segment.label] ?? "#6C63FF";
                  return (
                    <div key={segment.label}>
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span>{displayScoreLabel(segment.label)}</span>
                        <span className="numeric text-xs" style={{ color }}>{segment.value}</span>
                      </div>
                      <div className="h-2 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <div className="h-2 rounded-full" style={{ width: `${segment.value}%`, background: color, opacity: 0.85 }} />
                      </div>
                      <p className="mt-1 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                        Weight: {segment.weight}%
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <DashboardChat jobId={jobId} companyName={companyName} enabled={Boolean(result)} />

          <ResultsTabs result={result} tasks={tasks} onTaskToggle={handleTaskToggle} />

          <section className="liquid-glass glass-border-soft rounded-[2rem] p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="section-title">Recent analyses</p>
                <h2 className="mt-2 text-2xl font-semibold">Job history</h2>
              </div>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "'JetBrains Mono', monospace" }}>
                {history.length} jobs
              </span>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {history.map((job) => (
                <Link
                  key={job.job_id}
                  href={`/dashboard/${job.job_id}`}
                  className="rounded-[1.5rem] px-4 py-4 transition hover:bg-white/5"
                  style={{
                    background: job.job_id === jobId ? "rgba(108,99,255,0.12)" : "rgba(255,255,255,0.02)",
                    border: job.job_id === jobId ? "1px solid rgba(108,99,255,0.35)" : "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold">{job.company_name}</p>
                      <p className="mt-1 text-xs" style={{ color: "rgba(255,255,255,0.42)" }}>
                        {job.bundesland} · {new Date(job.created_at).toLocaleString("en-GB")}
                      </p>
                    </div>
                    <span
                      className="rounded-full px-2 py-0.5 text-xs"
                      style={{
                        background: job.has_result ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.05)",
                        color: job.has_result ? "#10B981" : "rgba(255,255,255,0.4)",
                      }}
                    >
                      {job.status}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                    <span>
                      Tasks: {job.completed_tasks}/{job.total_tasks}
                    </span>
                    <span>{job.latest_message ?? "No events yet"}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </>
      ) : (
        <section className="liquid-glass glass-border-soft rounded-[2rem] p-8">
          <p className="section-title">Awaiting result</p>
          <h2 className="mt-2 text-3xl font-semibold">The dashboard will render once all agent outputs arrive.</h2>
          <p className="glass-muted mt-4 max-w-2xl text-sm leading-7">
            The orchestrator already streams progress. If the backend is running, this state should switch automatically without a manual refresh.
          </p>
        </section>
      )}
    </main>
  );
}
