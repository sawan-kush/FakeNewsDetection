export type Verdict = "correct" | "false" | "misleading" | "unverified";

export interface ClaimCheck { claim: string; verdict: Verdict; explanation: string }
export interface Source { title: string; url: string }

export interface AnalysisResult {
  verdict: Verdict;
  confidence: number;
  summary: string;
  claims: ClaimCheck[];
  sources: Source[];
  searched: boolean;
  model: string;
  seconds: number;
}

export interface Health {
  status: string;
  groq_configured: boolean;
  model: string;
  limits: { min: number; max: number };
}