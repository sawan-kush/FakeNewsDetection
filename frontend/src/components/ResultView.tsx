import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardCheck, Copy, ExternalLink, HelpCircle, XCircle } from "lucide-react";
import type { AnalysisResult, Evidence, Relation, Verdict } from "../types";
import { MODE_LABEL, RELATION_TEXT, VERDICT_COLOR, VERDICT_TEXT, buildReport, formatDate, pct } from "../lib/format";
import { SourceBadge } from "./SourceBadge";

const REL_ICON: Record<Relation, JSX.Element> = {
  supports: <CheckCircle2 size={15} className="text-teal-600" />,
  contradicts: <XCircle size={15} className="text-verdict-contradicted" />,
  inconclusive: <HelpCircle size={15} className="text-slate-500" />,
};

function VerdictChip({ v }: { v: Verdict | null }) {
  if (!v) return <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">Not assessed</span>;
  const c = VERDICT_COLOR[v];
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}>{VERDICT_TEXT[v]}</span>;
}

function VerdictBanner({ r }: { r: AnalysisResult }) {
  const v = r.verification;
  if (v.status !== "ok" || !v.verdict) {
    return (
      <div className="card border-l-4 border-l-verdict-mixed p-5 sm:p-6" role="status">
        <div className="flex items-center gap-2 text-verdict-mixed"><AlertTriangle size={18} /><span className="text-sm font-medium">Factual verification unavailable</span></div>
        <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-ink-soft">{v.message}</p>
      </div>
    );
  }
  const c = VERDICT_COLOR[v.verdict];
  return (
    <div className={`card border-l-4 p-5 sm:p-7 ${c.border}`}>
      <p className="text-sm text-ink-muted">Evidence-based verdict</p>
      <h2 className={`mt-1 text-3xl font-medium sm:text-4xl ${c.text}`}>{VERDICT_TEXT[v.verdict]}</h2>
      {v.summary && <p className="mt-3 max-w-3xl font-serif text-lg leading-relaxed text-ink-soft">{v.summary}</p>}
    </div>
  );
}

function MlCard({ r }: { r: AnalysisResult }) {
  const m = r.ml.result;
  return (
    <section className="card p-5" aria-labelledby="ml-title">
      <h3 id="ml-title" className="text-lg font-medium">Writing style</h3>
      <p className="text-xs text-ink-muted">Not a fact-check</p>
      {r.ml.available && m ? (
        <>
          <p className="mt-4 text-2xl font-medium">
            Resembles <span className={m.label === "fake" ? "text-verdict-contradicted" : "text-teal-700"}>{m.label}</span> news
          </p>
          <div className="mt-3" role="img" aria-label={`${pct(m.probabilities.fake, 0)} fake, ${pct(m.probabilities.real, 0)} real`}>
            <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="bg-verdict-contradicted/80" style={{ width: pct(m.probabilities.fake, 1) }} />
              <div className="bg-teal-600/80" style={{ width: pct(m.probabilities.real, 1) }} />
            </div>
            <div className="mt-1.5 flex justify-between text-xs tabular-nums text-ink-muted"><span>Fake {pct(m.probabilities.fake, 0)}</span><span>Real {pct(m.probabilities.real, 0)}</span></div>
          </div>
          {m.probability < 0.7 && <p className="mt-3 text-sm text-verdict-mixed">Low confidence: treat this as a rough hint only.</p>}
          <p className="mt-4 text-sm leading-relaxed text-ink-soft">This only looks at how the text is written, not whether it is true.</p>
        </>
      ) : (
        <p className="mt-4 text-sm text-ink-soft">{r.ml.error ?? "Not available right now."}</p>
      )}
    </section>
  );
}

function evidenceRelations(r: AnalysisResult): Map<string, Set<Relation>> {
  const map = new Map<string, Set<Relation>>();
  r.claims.forEach((c) => c.assessments.forEach((a) => {
    if (!map.has(a.evidence_id)) map.set(a.evidence_id, new Set());
    map.get(a.evidence_id)!.add(a.relation);
  }));
  return map;
}

function EvidenceCard({ e, rels }: { e: Evidence; rels: Set<Relation> | undefined }) {
  const date = formatDate(e.published);
  return (
    <article id={`ev-${e.id}`} className="card scroll-mt-24 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium tabular-nums text-ink-soft">{e.id}</span>
        <SourceBadge tier={e.quality.tier} meaning={e.quality.meaning} />
        {rels && [...rels].map((x) => <span key={x} className="inline-flex items-center gap-1 text-xs text-ink-soft">{REL_ICON[x]}{RELATION_TEXT[x]}</span>)}
      </div>
      <h4 className="mt-2 font-sans text-[15px] font-semibold leading-snug">
        <a href={e.url} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-700 hover:underline">{e.title}</a>
      </h4>
      <p className="mt-0.5 text-xs text-ink-muted">{e.domain}{date ? ` · published ${date}` : " · no publication date found"}</p>
      <div className="mt-3 space-y-2">
        {e.passages.map((p, i) => (
          <blockquote key={i} className="border-l-2 border-indigo-100 pl-3 text-sm leading-relaxed text-ink-soft">
            {p.text}
          </blockquote>
        ))}
      </div>
      <a href={e.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-indigo-700 hover:underline">
        Open source <ExternalLink size={13} />
      </a>
    </article>
  );
}

export function ResultView({ result: r, onBack, backLabel = "Back to home" }: { result: AnalysisResult; onBack?: () => void; backLabel?: string }) {
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState<"all" | Relation | "uncited">("all");
  const rels = useMemo(() => evidenceRelations(r), [r]);
  const counts = useMemo(() => {
    const c = { all: r.evidence.length, supports: 0, contradicts: 0, inconclusive: 0, uncited: 0 };
    r.evidence.forEach((e) => {
      const s = rels.get(e.id);
      if (!s) c.uncited++;
      else s.forEach((x) => c[x]++);
    });
    return c;
  }, [r, rels]);
  const shown = r.evidence.filter((e) => filter === "all" || (filter === "uncited" ? !rels.has(e.id) : rels.get(e.id)?.has(filter)));
  const limitations = r.verification.limitations ?? [];

  const copy = async () => {
    try { await navigator.clipboard.writeText(buildReport(r)); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { window.prompt("Copy the report:", buildReport(r)); }
  };
  const openSources = () => r.evidence.slice(0, 5).forEach((e) => window.open(e.url, "_blank", "noopener,noreferrer"));

  const filters: { id: typeof filter; label: string }[] = [
    { id: "all", label: "All" }, { id: "supports", label: "Supporting" }, { id: "contradicts", label: "Contradicting" },
    { id: "inconclusive", label: "Inconclusive" }, { id: "uncited", label: "Not cited" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {onBack && <button className="btn-secondary" onClick={onBack}><ArrowLeft size={16} /> {backLabel}</button>}
          <p className="text-sm text-ink-muted">{MODE_LABEL[r.mode]} · {new Date(r.created_at).toLocaleDateString()}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={copy}>{copied ? <><ClipboardCheck size={16} /> Copied</> : <><Copy size={16} /> Copy report</>}</button>
          <button className="btn-secondary" onClick={openSources} disabled={!r.evidence.length}><ExternalLink size={16} /> Open sources</button>
        </div>
      </div>

      <VerdictBanner r={r} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-8">
          <section aria-labelledby="claims-title">
            <h3 id="claims-title" className="text-2xl font-medium">Claims checked</h3>
            <div className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white shadow-card">
              {r.claims.map((c) => (
                <div key={c.id} className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="max-w-2xl font-serif text-lg leading-snug"><span className="mr-2 font-sans text-xs text-ink-muted">{c.id}</span>{c.text}</p>
                    <VerdictChip v={c.verdict} />
                  </div>
                  {c.explanation && <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{c.explanation}</p>}
                  {c.correction && (
                    <p className="mt-3 rounded-lg border border-teal-100 bg-teal-50 p-3 text-sm leading-relaxed text-teal-700">
                      <span className="font-semibold">What the evidence says: </span>{c.correction}
                    </p>
                  )}
                  {c.assessments.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {c.assessments.map((a, i) => (
                        <li key={i} className="flex gap-2 text-sm text-ink-soft">
                          <span className="mt-0.5">{REL_ICON[a.relation]}</span>
                          <span><a href={`#ev-${a.evidence_id}`} onClick={(ev) => { ev.preventDefault(); document.getElementById(`ev-${a.evidence_id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }}
                            className="font-medium text-indigo-700 hover:underline">{a.evidence_id}</a> {RELATION_TEXT[a.relation].toLowerCase()}: {a.rationale}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="ev-title">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h3 id="ev-title" className="text-2xl font-medium">Evidence</h3>
              {r.evidence.length > 0 && (
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter evidence">
                  {filters.map((f) => (counts[f.id] > 0 || f.id === "all") && (
                    <button key={f.id} onClick={() => setFilter(f.id)} aria-pressed={filter === f.id}
                      className={`rounded-full border px-3 py-1 text-sm ${filter === f.id ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-line text-ink-soft hover:border-slate-300"}`}>
                      {f.label} <span className="tabular-nums text-ink-muted">{counts[f.id]}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {r.evidence.length === 0 ? (
              <p className="card mt-3 p-5 text-[15px] text-ink-soft">No relevant evidence was retrieved. That does not mean the claims are false.</p>
            ) : (
              <div className="mt-3 space-y-3">{shown.map((e) => <EvidenceCard key={e.id} e={e} rels={rels.get(e.id)} />)}</div>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <MlCard r={r} />
          {limitations.length > 0 && (
            <section className="card p-5">
              <h3 className="text-lg font-medium">Limitations</h3>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-soft">{limitations.map((l) => <li key={l}>{l}</li>)}</ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}