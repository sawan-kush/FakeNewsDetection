import type { AnalysisResult, Health } from "./types";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...init });
  } catch {
    throw new ApiError("Cannot reach the backend. Is it running on port 5000? (cd backend && python run.py)", 0);
  }
  let body: any = null;
  try { body = await res.json(); } catch { /* non-JSON body */ }
  if (!res.ok) throw new ApiError(body?.error ?? `Request failed (${res.status})`, res.status);
  return body as T;
}

export const api = {
  health: () => request<Health>("/api/health"),
  analyze: (text: string) =>
    request<AnalysisResult>("/api/analyze", { method: "POST", body: JSON.stringify({ text }) }),
};