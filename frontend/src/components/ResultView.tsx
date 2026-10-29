import { AlertTriangle, ArrowLeft, CheckCircle2, ExternalLink, HelpCircle, XCircle } from "lucide-react";
import type { AnalysisResult, Verdict } from "../types";

const STYLE: Record<Verdict, { title: string; text: string; border: string; chip: string; icon: JSX.Element }> = {
  correct: { title: "Correct", text: "text-teal-700", border: "border-l-teal-600", chip: "bg-teal-50 text-teal-700", icon: <CheckCircle2 size={28} /> },
  false: { title: "False", text: "text-red-700", border: "border-l-red-600", chip: "bg-red-50 text-red-700", icon: <XCircle size={28} /> },
  misleading: { title: "Misleading", text: "text-amber-700", border: "border-l-amber-500", chip: "bg-amber-50 text-amber-700", icon: <AlertTriangle size={28} /> },
  unverified: { title: "Could not verify", text: "text-slate-600", border: "border-l-slate-400", chip: "bg-slate-100 text-slate-600", icon: <HelpCircle size={28} /> },
};

// Never trust the backend blindly: an unknown verdict falls back to "unverified" instead of crashing.
const styleOf = (v: string) => STYLE[v as Verdict] ?? STYLE.unverified;

export function ResultView({ result: r, onBack }: { result: AnalysisResult; onBack: () => void }) {
  const s = styleOf(r.verdict);
  const claims = r.claims ?? [];
  const sources = r.sources ?? [];
  return (
    <div className="space-y-6">
      <button className="btn-secondary" onClick={onBack}><ArrowLeft size={16} /> Check another</button>

      <div className={`card border-l-4 p-5 sm:p-7 ${s.border}`}>
        <div className={`flex items-center gap-3 ${s.text}`}>
          {s.icon}
          <h2 className="text-3xl font-medium sm:text-4xl">{s.title}</h2>
        </div>
        {r.verdict !== "unverified" && (
          <p className="mt-2 text-sm text-ink-muted">Confidence: <span className="font-medium tabular-nums">{r.confidence}%</span></p>
        )}
        <p className="mt-4 max-w-3xl font-serif text-lg leading-relaxed text-ink-soft">{r.summary}</p>
        {!r.searched && (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            No web search results were returned for this check, so treat the verdict with caution.
          </p>
        )}
      </div>

      {claims.length > 0 && (
        <section>
          <h3 className="text-2xl font-medium">Claims checked</h3>
          <div className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white shadow-card">
            {claims.map((c, i) => (
              <div key={i} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="max-w-2xl font-serif text-lg leading-snug">{c.claim}</p>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${styleOf(c.verdict).chip}`}>{styleOf(c.verdict).title}</span>
                </div>
                {c.explanation && <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{c.explanation}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="text-2xl font-medium">Sources</h3>
        {sources.length === 0 ? (
          <p className="card mt-3 p-5 text-[15px] text-ink-soft">No sources were returned.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {sources.map((src) => (
              <li key={src.url} className="card p-4">
                <a href={src.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-start justify-between gap-3 text-[15px] font-medium hover:text-indigo-700">
                  <span className="min-w-0">
                    <span className="block truncate">{src.title}</span>
                    <span className="block truncate text-xs font-normal text-ink-muted">{src.url}</span>
                  </span>
                  <ExternalLink size={15} className="mt-1 shrink-0" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-ink-muted">Checked with {r.model} using live web search in {r.seconds}s. AI can make mistakes, so verify important claims yourself.</p>
    </div>
  );
}