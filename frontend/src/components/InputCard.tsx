import { useState } from "react";
import { Eraser, Loader2, Search } from "lucide-react";
import type { Health, Mode } from "../types";
import { EXAMPLES, MODE_LABEL } from "../lib/format";

export interface Submission { mode: Mode; headline: string; text: string; save: boolean }
const MODES: Mode[] = ["headline", "article", "both"];

export function InputCard({ limits, busy, canSave, onSubmit }: {
  limits: Health["limits"]; busy: boolean; canSave: boolean; onSubmit: (s: Submission) => void;
}) {
  const [mode, setMode] = useState<Mode>("headline");
  const [headline, setHeadline] = useState("");
  const [text, setText] = useState("");
  const [save, setSave] = useState(true);
  const [touched, setTouched] = useState(false);

  const needH = mode !== "article", needT = mode !== "headline";
  const hTrim = headline.trim(), tTrim = text.trim();
  const errors: string[] = [];
  if (needH) {
    if (!hTrim) errors.push("Enter a headline.");
    else if (hTrim.length < limits.headline_min) errors.push(`Headline needs at least ${limits.headline_min} characters.`);
    else if (hTrim.length > limits.headline_max) errors.push(`Headline is over ${limits.headline_max} characters.`);
  }
  if (needT) {
    if (!tTrim) errors.push("Paste the article text.");
    else if (tTrim.length < limits.article_min) errors.push(`Article text needs at least ${limits.article_min} characters.`);
    else if (tTrim.length > limits.article_max) errors.push(`Article text is over ${limits.article_max.toLocaleString()} characters.`);
  }

  const submit = () => {
    setTouched(true);
    if (errors.length || busy) return;
    onSubmit({ mode, headline: needH ? hTrim : "", text: needT ? tTrim : "", save: save && canSave });
  };
  const clear = () => { setHeadline(""); setText(""); setTouched(false); };

  return (
    <section className="card p-4 sm:p-6" aria-labelledby="input-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="input-title" className="text-xl font-medium">What should we check?</h2>
        <div role="tablist" aria-label="Input mode" className="inline-flex rounded-lg bg-slate-100 p-1">
          {MODES.map((m) => (
            <button key={m} role="tab" aria-selected={mode === m} disabled={busy}
              onClick={() => { setMode(m); setTouched(false); }}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${mode === m ? "bg-white font-medium text-ink shadow-sm" : "text-ink-muted hover:text-ink"}`}>
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-5">
        {needH && (
          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <label htmlFor="headline" className="text-sm font-medium">Headline</label>
              <span className={`text-xs tabular-nums ${headline.length > limits.headline_max ? "text-verdict-contradicted" : "text-ink-muted"}`}>{headline.length} / {limits.headline_max}</span>
            </div>
            <input id="headline" className="field" value={headline} disabled={busy} maxLength={limits.headline_max + 200}
              placeholder="e.g. Chandrayaan-3 landed on the Moon in 2024." onChange={(e) => setHeadline(e.target.value)} />
          </div>
        )}
        {needT && (
          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <label htmlFor="article" className="text-sm font-medium">Article text</label>
              <span className={`text-xs tabular-nums ${text.length > limits.article_max ? "text-verdict-contradicted" : "text-ink-muted"}`}>{text.length.toLocaleString()} / {limits.article_max.toLocaleString()}</span>
            </div>
            <textarea id="article" className="field min-h-[180px] resize-y leading-relaxed" value={text} disabled={busy}
              placeholder="Paste the full article here." onChange={(e) => setText(e.target.value)} />
          </div>
        )}
      </div>

      {touched && errors.length > 0 && (
        <ul role="alert" className="mt-4 space-y-1 text-sm text-verdict-contradicted">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="text-sm text-ink-muted">Try an example:</span>
        {EXAMPLES.map((ex) => (
          <button key={ex.label} className="rounded-full border border-line px-3 py-1 text-sm text-ink-soft hover:border-indigo-600 hover:text-indigo-700 disabled:opacity-50"
            disabled={busy} onClick={() => { setMode(ex.mode); setHeadline(ex.headline); setText(ex.text); setTouched(false); }}>
            {ex.label}
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
        <label className={`flex items-center gap-2 text-sm ${canSave ? "text-ink-soft" : "text-slate-400"}`}>
          <input type="checkbox" className="h-4 w-4 accent-indigo-600" checked={save && canSave} disabled={!canSave || busy} onChange={(e) => setSave(e.target.checked)} />
          Save to local history
        </label>
        <div className="flex items-center gap-2">
          <button className="btn-ghost" onClick={clear} disabled={busy || (!headline && !text)}><Eraser size={16} /> Clear</button>
          <button className="btn-primary px-6" onClick={submit} disabled={busy}>
            {busy ? <><Loader2 size={16} className="animate-spin" /> Analyzing</> : <><Search size={16} /> Analyze News</>}
          </button>
        </div>
      </div>
    </section>
  );
}
