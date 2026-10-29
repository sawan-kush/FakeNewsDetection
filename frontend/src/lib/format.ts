import type { AnalysisResult, Mode, Relation, Verdict } from "../types";

export const MODE_LABEL: Record<Mode, string> = { headline: "Headline", article: "Full article", both: "Headline + article" };

export const VERDICT_TEXT: Record<Verdict, string> = {
  supported: "Supported by evidence",
  contradicted: "Contradicted by evidence",
  mixed: "Mixed or conflicting evidence",
  insufficient: "Insufficient evidence",
};
export const VERDICT_COLOR: Record<Verdict, { text: string; bg: string; border: string }> = {
  supported: { text: "text-verdict-supported", bg: "bg-teal-50", border: "border-teal-600" },
  contradicted: { text: "text-verdict-contradicted", bg: "bg-red-50", border: "border-verdict-contradicted" },
  mixed: { text: "text-verdict-mixed", bg: "bg-amber-50", border: "border-verdict-mixed" },
  insufficient: { text: "text-verdict-insufficient", bg: "bg-slate-100", border: "border-slate-400" },
};
export const RELATION_TEXT: Record<Relation, string> = { supports: "Supports", contradicts: "Contradicts", inconclusive: "Inconclusive" };

export const pct = (x: number, digits = 1) => `${(x * 100).toFixed(digits)}%`;

export function formatDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? raw : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** Plain-text report for "Copy report". Never invents content: only reflects the result object. */
export function buildReport(r: AnalysisResult): string {
  const L: string[] = [];
  L.push("TRUTHLENS REPORT", `Generated: ${r.created_at}`, `Input mode: ${r.mode}`);
  if (r.input.headline) L.push(`Headline: ${r.input.headline}`);
  L.push("");
  L.push("EVIDENCE-BASED VERDICT");
  if (r.verification.status === "ok" && r.verification.verdict) {
    L.push(VERDICT_TEXT[r.verification.verdict]);
    if (r.verification.summary) L.push(r.verification.summary);
  } else {
    L.push("Unavailable");
    if (r.verification.message) L.push(r.verification.message);
  }
  L.push("", "WRITING-STYLE CHECK (not a fact-check)");
  if (r.ml.available && r.ml.result) {
    const m = r.ml.result;
    L.push(`Resembles ${m.label} news (${pct(m.probability, 0)} confidence)`);
  } else L.push(r.ml.error ?? "Unavailable");
  L.push("", "CLAIMS");
  for (const c of r.claims) {
    L.push(`${c.id}. ${c.text}`, `   Verdict: ${c.verdict ? VERDICT_TEXT[c.verdict] : "not assessed"}`);
    if (c.explanation) L.push(`   ${c.explanation}`);
    if (c.correction) L.push(`   Evidence says: ${c.correction}`);
  }
  L.push("", "SOURCES");
  for (const e of r.evidence) {
    L.push(`${e.id}. ${e.title} (${e.domain}, ${e.quality.tier}${e.published ? `, ${formatDate(e.published)}` : ""})`, `   ${e.url}`);
  }
  if (r.verification.limitations?.length) {
    L.push("", "LIMITATIONS");
    r.verification.limitations.forEach((x) => L.push(`- ${x}`));
  }
  return L.join("\n");
}

export const EXAMPLES: { label: string; mode: Mode; headline: string; text: string }[] = [
  { label: "Wrong year", mode: "headline", headline: "Chandrayaan-3 landed on the Moon in 2024.", text: "" },
  {
    label: "Health claim", mode: "headline",
    headline: "Drinking eight glasses of water a day is required for good health, scientists confirm.", text: "",
  },
  {
    label: "Short article", mode: "both",
    headline: "India's Chandrayaan-3 lander touches down near the Moon's south pole",
    text: "India's Chandrayaan-3 mission landed its Vikram lander near the lunar south pole, the space agency said. The Pragyan rover later rolled out to begin measurements of the surface. India became the fourth country to achieve a soft landing on the Moon.",
  },
];