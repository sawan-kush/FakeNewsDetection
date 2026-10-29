import { describe, expect, it } from "vitest";
import { buildReport, formatDate, pct } from "./format";
import type { AnalysisResult } from "../types";

const base: AnalysisResult = {
  id: "1", created_at: "2026-01-01T00:00:00Z", mode: "headline",
  input: { headline: "Chandrayaan-3 landed in 2024.", text_preview: "" },
  ml: { available: true, result: { label: "real", probability: 0.91, probabilities: { fake: 0.09, real: 0.91 }, model_name: "Logistic Regression", mode: "headline", probabilities_calibrated: true, smoke_test_model: false, disclaimer: "d" } },
  claims: [{ id: "C1", text: "Chandrayaan-3 landed in 2024.", queries: ["q"], extracted_by: "llm", verdict: "contradicted", verdict_label: "Contradicted by evidence", explanation: "Wrong year.", correction: "Landed 23 Aug 2023.", assessments: [] }],
  evidence: [{ id: "E1", url: "https://www.isro.gov.in/x", title: "ISRO", domain: "isro.gov.in", quality: { tier: "official", meaning: "m" }, published: null, passages: [], relevance: 1, retrieval: { page_fetched: true, error: null }, claim_ids: ["C1"] }],
  verification: { available: true, status: "ok", verdict: "contradicted", verdict_label: "Contradicted by evidence", summary: "Landing was in 2023.", limitations: ["One source"], model: "m" },
  warnings: [], quality_legend: {} as any, timings: { total_seconds: 1 },
};

describe("buildReport", () => {
  it("includes verdict, separate ML section, sources and limitations", () => {
    const t = buildReport(base);
    expect(t).toContain("Contradicted by evidence");
    expect(t).toContain("ML PREDICTION (not a factual verdict)");
    expect(t).toContain("real (91% calibrated probability)");
    expect(t).toContain("https://www.isro.gov.in/x");
    expect(t).toContain("- One source");
  });
  it("marks verification unavailable instead of inventing a verdict", () => {
    const t = buildReport({ ...base, verification: { ...base.verification, status: "unavailable", verdict: null, message: "No key." } });
    expect(t).toContain("Unavailable");
    expect(t).not.toContain("Supported by evidence");
  });
  it("handles unavailable ML", () => {
    expect(buildReport({ ...base, ml: { available: false, error: "no model" } })).toContain("Unavailable: no model");
  });
});

describe("helpers", () => {
  it("formats percentages and dates safely", () => {
    expect(pct(0.1234)).toBe("12.3%");
    expect(formatDate(null)).toBeNull();
    expect(formatDate("not a date")).toBe("not a date");
    expect(formatDate("2023-08-23")).toMatch(/2023/);
  });
});
