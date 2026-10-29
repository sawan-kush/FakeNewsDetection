import type { AnalysisResult, Health, HistoryItem, JobSnapshot, Metrics, Mode } from "./types";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...init });
  } catch {
    throw new ApiError("Cannot reach the TruthLens backend. Is it running on port 5000?", 0);
  }
  let body: any = null;
  try { body = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok) throw new ApiError(body?.error ?? `Request failed (${res.status})`, res.status);
  return body as T;
}

export const api = {
  health: () => request<Health>("/api/health"),
  startAnalysis: (p: { mode: Mode; headline: string; text: string; save_history: boolean }) =>
    request<{ job_id: string }>("/api/analyze", { method: "POST", body: JSON.stringify(p) }),
  job: (id: string) => request<JobSnapshot>(`/api/analyze/${id}`),
  metrics: () => request<Metrics>("/api/model/metrics"),
  history: () => request<{ items: HistoryItem[] }>("/api/history"),
  historyItem: (id: string) => request<AnalysisResult>(`/api/history/${id}`),
  deleteHistoryItem: (id: string) => request<{ deleted: string }>(`/api/history/${id}`, { method: "DELETE" }),
  clearHistory: () => request<{ deleted: number }>("/api/history", { method: "DELETE" }),
};
