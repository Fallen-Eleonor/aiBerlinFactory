import { getClientId } from "@/lib/client-id";
import {
  AnalysisResult,
  AnalyzeRequest,
  ChatMessage,
  DemoPersona,
  JobChatHistoryPayload,
  JobDetails,
  JobQueuedResponse,
  JobSummary,
  JobTaskStatePayload,
  StatusEvent,
} from "@/lib/types";

const LOCAL_DEV_API_BASE_URL = "http://localhost:8000";

function resolveApiBaseUrl() {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }

  if (process.env.NODE_ENV !== "production") {
    return LOCAL_DEV_API_BASE_URL;
  }

  throw new Error("NEXT_PUBLIC_API_BASE_URL is required in production. Point it to your deployed backend.");
}

function toApiUrl(path: string) {
  return `${resolveApiBaseUrl()}${path}`;
}

type FetchOptions = Omit<RequestInit, "headers"> & {
  headers?: HeadersInit;
  clientId?: string;
};

function withQuery(url: string, clientId: string) {
  const baseUrl = resolveApiBaseUrl();
  const resolved = new URL(url, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  resolved.searchParams.set("client_id", clientId);
  return resolved.toString();
}

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const clientId = options.clientId ?? getClientId();
  const response = await fetch(toApiUrl(path), {
    ...options,
    headers: {
      "x-startup-os-client-id": clientId,
      ...(options.headers ?? {}),
    },
    cache: options.cache ?? "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed for ${path}`);
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

export async function fetchJobChat(jobId: string, clientId?: string): Promise<ChatMessage[]> {
  const payload = await apiFetch<JobChatHistoryPayload>(`/api/jobs/${jobId}/chat`, { clientId });
  return payload.messages;
}

export async function sendJobChatMessage(jobId: string, message: string, clientId?: string): Promise<ChatMessage[]> {
  const payload = await apiFetch<JobChatHistoryPayload>(`/api/jobs/${jobId}/chat`, {
    method: "POST",
    clientId,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message }),
  });
  return payload.messages;
}

export async function fetchResult(jobId: string, clientId?: string): Promise<AnalysisResult | null> {
  const resolvedClientId = clientId ?? getClientId();
  const response = await fetch(toApiUrl(`/api/result/${jobId}`), {
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
    throw new Error(detail || "Failed to load result.");
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
