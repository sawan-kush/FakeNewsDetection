import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { api } from "../api";
import type { AnalysisResult, HistoryItem } from "../types";
import { MODE_LABEL, VERDICT_COLOR, VERDICT_TEXT } from "../lib/format";
import { ResultView } from "../components/ResultView";

export function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<AnalysisResult | null>(null);

  const load = () => api.history().then((r) => { setItems(r.items); setErr(null); }).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const view = (id: string) => api.historyItem(id).then(setOpen).catch((e) => setErr(e.message));
  const del = async (id: string) => { await api.deleteHistoryItem(id).catch((e) => setErr(e.message)); load(); };
  const clear = async () => {
    if (!window.confirm("Delete all saved analyses? This cannot be undone.")) return;
    await api.clearHistory().catch((e) => setErr(e.message)); load();
  };

  if (open) {
    return <ResultView result={open} onBack={() => setOpen(null)} backLabel="Back to history" />;
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-4xl font-medium">History</h1>
        {items && items.length > 0 && <button className="btn-secondary" onClick={clear}><Trash2 size={16} /> Delete all</button>}
      </div>

      {err && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-verdict-contradicted">{err}</p>}
      {items && items.length === 0 && (
        <div className="card mt-8 p-8 text-center">
          <p className="font-serif text-xl">Nothing saved yet</p>
          <p className="mt-1 text-sm text-ink-muted">Check something with “Save to history” ticked and it will appear here.</p>
          <a href="#/" className="btn-primary mt-5">Check something</a>
        </div>
      )}
      {items && items.length > 0 && (
        <ul className="mt-8 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white shadow-card">
          {items.map((it) => (
            <li key={it.id} className="flex flex-wrap items-center gap-3 p-4 sm:px-5">
              <button className="min-w-0 flex-1 text-left" onClick={() => view(it.id)}>
                <p className="truncate font-serif text-lg">{it.preview || "(no headline)"}</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {new Date(it.created_at).toLocaleString()} · {MODE_LABEL[it.mode]} · {it.source_count} source{it.source_count === 1 ? "" : "s"}
                </p>
              </button>
              {it.verdict
                ? <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${VERDICT_COLOR[it.verdict].bg} ${VERDICT_COLOR[it.verdict].text}`}>{VERDICT_TEXT[it.verdict]}</span>
                : <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">Verification unavailable</span>}
              <button className="btn-ghost px-2" aria-label={`Delete analysis: ${it.preview}`} onClick={() => del(it.id)}><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}