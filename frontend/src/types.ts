export type Mode = "headline" | "article" | "both";
export type Verdict = "supported" | "contradicted" | "mixed" | "insufficient";
export type Relation = "supports" | "contradicts" | "inconclusive";
export type Tier = "official" | "scientific" | "news" | "factcheck" | "reference" | "unrated";

export interface MlResult {
  label: "fake" | "real";
  probability: number;
  probabilities: { fake: number; real: number };
  model_name: string;
  mode: Mode;
  probabilities_calibrated: boolean;
  smoke_test_model: boolean;
  disclaimer: string;
}
export interface Assessment { evidence_id: string; relation: Relation; rationale: string }
export interface Claim {
  id: string; text: string; queries: string[]; extracted_by: string;
  verdict: Verdict | null; verdict_label: string | null; explanation: string | null;
  correction: string | null; assessments: Assessment[];
}
export interface Passage { text: string; origin: "page" | "search_snippet"; relevance: number }
export interface Evidence {
  id: string; url: string; title: string; domain: string;
  quality: { tier: Tier; meaning: string };
  published: string | null; passages: Passage[]; relevance: number;
  retrieval: { page_fetched: boolean; error: string | null }; claim_ids: string[];
}
export interface Verification {
  available: boolean; status: "ok" | "unavailable"; reason?: string; message?: string;
  verdict: Verdict | null; verdict_label: string | null; summary: string | null;
  limitations: string[]; model: string;
}
export interface AnalysisResult {
  id: string; created_at: string; mode: Mode;
  input: { headline: string; text_preview: string };
  ml: { available: boolean; result?: MlResult; error?: string };
  claims: Claim[]; evidence: Evidence[]; verification: Verification;
  warnings: string[]; quality_legend: Record<Tier, string>;
  timings: { total_seconds: number };
}
export interface Stage { id: string; label: string; status: "pending" | "running" | "done" | "failed" | "skipped"; detail: string; seconds: number | null }
export interface JobSnapshot { job_id: string; status: "running" | "done" | "error"; stages: Stage[]; error: string | null; result: AnalysisResult | null }
export interface Health {
  status: string;
  model: { available_modes: Mode[]; trained: boolean; smoke_test: boolean | null };
  services: { brave_configured: boolean; groq_configured: boolean; groq_model: string | null };
  history_enabled: boolean;
  limits: { headline_max: number; headline_min: number; article_max: number; article_min: number };
}
export interface HistoryItem { id: string; created_at: string; mode: Mode; preview: string; ml_label: string | null; verdict: Verdict | null; source_count: number }

export interface ConfusionMatrix { labels: string[]; matrix: number[][] }
export interface EvalMetrics {
  n: number; accuracy: number; precision_macro: number; recall_macro: number; macro_f1: number;
  precision_fake: number; recall_fake: number; f1_fake: number; brier_score: number; confusion_matrix: ConfusionMatrix;
}
export interface Metrics {
  trained_at: string; smoke_test: boolean;
  dataset: { name: string; label_mapping: Record<string, string>; cleaning: Record<string, any> };
  tfidf_params: Record<string, unknown>; seed: number; environment: Record<string, string>; total_training_seconds: number;
  modes: Record<Mode, {
    sizes: { train: number; val: number; test: number }; selected_model: string; selection_rule: string;
    models: Record<string, { fit_seconds: number; validation: EvalMetrics; test: EvalMetrics }>;
  }>;
}
