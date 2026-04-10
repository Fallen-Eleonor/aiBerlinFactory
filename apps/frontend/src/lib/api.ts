import { getClientId } from "@/lib/client-id";
import {
  AgentInteraction,
  AnalysisResult,
  AnalyzeRequest,
  DemoPersona,
  InteractionAnswerResponse,
  JobDetails,
  JobInteractionListPayload,
  JobQueuedResponse,
  JobSummary,
  JobTaskStatePayload,
  StatusEvent,
} from "@/lib/types";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type FetchOptions = Omit<RequestInit, "headers"> & {
  headers?: HeadersInit;
  clientId?: string;
};

function withQuery(url: string, clientId: string) {
  const resolved = new URL(url, API_BASE_URL);
  resolved.searchParams.set("client_id", clientId);
  return resolved.toString();
}

const VALIDATION_FIELD_LABELS: Record<string, string> = {
  company_name: "Company name",
  industry: "Industry",
  bundesland: "Bundesland",
  founder_count: "Number of founders",
  available_capital_eur: "Available capital",
  goals: "Goals",
  founder_background: "Founder background",
};

function labelForValidationSegment(segment: string): string {
  return VALIDATION_FIELD_LABELS[segment] ?? segment.replace(/_/g, " ");
}

/** Turn FastAPI/Pydantic JSON validation responses into a short user-facing message. */
function formatHttpErrorBody(text: string, fallback: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) {
    return trimmed || fallback;
  }
  try {
    const parsed = JSON.parse(trimmed) as { detail?: unknown };
    if (Array.isArray(parsed.detail)) {
      const messages = parsed.detail.map((item: unknown) => {
        if (item && typeof item === "object" && "msg" in item) {
          const rec = item as { msg?: string; loc?: unknown[] };
          const loc = Array.isArray(rec.loc)
            ? rec.loc.filter((x): x is string => typeof x === "string" && x !== "body")
            : [];
          const field = loc.length > 0 ? labelForValidationSegment(loc[loc.length - 1]!) : null;
          const msg = typeof rec.msg === "string" ? rec.msg : String(rec.msg);
          return field ? `${field}: ${msg}` : msg;
        }
        return String(item);
      });
      return messages.filter(Boolean).join(" ") || fallback;
    }
    if (typeof parsed.detail === "string") {
      return parsed.detail;
    }
  } catch {
    /* keep raw text */
  }
  return trimmed || fallback;
}

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const clientId = options.clientId ?? getClientId();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "x-startup-os-client-id": clientId,
      ...(options.headers ?? {}),
    },
    cache: options.cache ?? "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(formatHttpErrorBody(detail, `Request failed for ${path}`));
  }

  return response.json() as Promise<T>;
}

export async function fetchDemoPersonas(clientId?: string): Promise<DemoPersona[]> {
  return apiFetch<DemoPersona[]>("/api/demo/personas", { clientId });
}

export async function analyzeStartup(payload: AnalyzeRequest, clientId?: string): Promise<JobQueuedResponse> {
  return apiFetch<JobQueuedResponse>("/api/analyze", {
    method: "POST",
    clientId,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function fetchJobs(clientId?: string): Promise<JobSummary[]> {
  return apiFetch<JobSummary[]>("/api/jobs", { clientId });
}

export async function fetchJobDetails(jobId: string, clientId?: string): Promise<JobDetails> {
  return apiFetch<JobDetails>(`/api/jobs/${jobId}`, { clientId });
}

export async function fetchJobRequest(jobId: string, clientId?: string): Promise<AnalyzeRequest> {
  return apiFetch<AnalyzeRequest>(`/api/jobs/${jobId}/request`, { clientId });
}

export async function fetchJobTasks(jobId: string, clientId?: string): Promise<JobTaskStatePayload> {
  return apiFetch<JobTaskStatePayload>(`/api/jobs/${jobId}/tasks`, { clientId });
}

export async function updateJobTasks(jobId: string, tasks: Record<string, boolean>, clientId?: string): Promise<JobTaskStatePayload> {
  return apiFetch<JobTaskStatePayload>(`/api/jobs/${jobId}/tasks`, {
    method: "PUT",
    clientId,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tasks }),
  });
}

export async function fetchJobInteractions(jobId: string, clientId?: string): Promise<AgentInteraction[]> {
  const payload = await apiFetch<JobInteractionListPayload>(`/api/jobs/${jobId}/interactions`, { clientId });
  return payload.interactions;
}

export async function answerJobInteraction(
  jobId: string,
  interactionId: string,
  value: string | number | boolean,
  clientId?: string,
): Promise<InteractionAnswerResponse> {
  return apiFetch<InteractionAnswerResponse>(`/api/jobs/${jobId}/interactions/${interactionId}/answer`, {
    method: "POST",
    clientId,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ value }),
  });
}

export async function fetchResult(jobId: string, clientId?: string): Promise<AnalysisResult | null> {
  const resolvedClientId = clientId ?? getClientId();
  const response = await fetch(`${API_BASE_URL}/api/result/${jobId}`, {
    cache: "no-store",
    headers: {
      "x-startup-os-client-id": resolvedClientId,
    },
  });

  if (response.status === 202) {
    return null;
  }

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(formatHttpErrorBody(detail, "Failed to load result."));
  }

  return response.json();
}

export function openStatusStream(jobId: string, onEvent: (event: StatusEvent) => void, clientId?: string): EventSource {
  const resolvedClientId = clientId ?? getClientId();
  const source = new EventSource(withQuery(`/api/status/${jobId}`, resolvedClientId));
  const eventNames = [
    "job_started",
    "orchestrator_update",
    "agent_started",
    "agent_progress",
    "agent_completed",
    "agent_failed",
    "interaction_answered",
    "interaction_completed",
    "agent_rerun_started",
    "agent_rerun_completed",
    "coordination_event",
    "job_completed",
    "job_failed",
  ];

  for (const eventName of eventNames) {
    source.addEventListener(eventName, (event) => {
      const data = JSON.parse((event as MessageEvent).data) as StatusEvent;
      onEvent(data);
    });
  }

  return source;
}

export function toDownloadUrl(relativeUrl: string, clientId?: string): string {
  return withQuery(relativeUrl, clientId ?? getClientId());
}
