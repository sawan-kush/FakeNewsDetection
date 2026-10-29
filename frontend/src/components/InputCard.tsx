import { useState } from "react";
import { Eraser, Loader2, Search } from "lucide-react";

const EXAMPLES = [
  "Drinking eight glasses of water a day is required for good health, scientists confirm.",
  "The Great Wall of China is visible from the Moon with the naked eye.",
  "NASA's Artemis II mission carried astronauts around the Moon.",
];

export function InputCard({ min, max, busy, onSubmit }: {
  min: number; max: number; busy: boolean; onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const [touched, setTouched] = useState(false);
  const trimmed = text.trim();
  const error = !trimmed ? "Paste a headline or article first."
    : trimmed.length < min ? `Please enter at least ${min} characters.`
    : trimmed.length > max ? `Text is over ${max.toLocaleString()} characters.` : null;

  const submit = () => {
    setTouched(true);
    if (error || busy) return;
    onSubmit(trimmed);
  };

  return (
    <section className="card p-4 sm:p-6">
      <label htmlFor="news" className="text-xl font-medium font-serif">What should we check?</label>
      <textarea id="news" className="field mt-3 min-h-[180px] resize-y leading-relaxed" value={text} disabled={busy}
        placeholder="Paste a news headline or the full article here…" onChange={(e) => setText(e.target.value)} />
      <div className="mt-1.5 flex justify-between text-xs text-ink-muted">
        <span role="alert" className="text-red-700">{touched && error ? error : ""}</span>
        <span className="tabular-nums">{text.length.toLocaleString()} / {max.toLocaleString()}</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-ink-muted">Try an example:</span>
        {EXAMPLES.map((ex, i) => (
          <button key={i} disabled={busy} onClick={() => { setText(ex); setTouched(false); }}
            className="rounded-full border border-line px-3 py-1 text-sm text-ink-soft hover:border-indigo-600 hover:text-indigo-700 disabled:opacity-50">
            Example {i + 1}
          </button>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-end gap-2 border-t border-line pt-5">
        <button className="btn-ghost" onClick={() => { setText(""); setTouched(false); }} disabled={busy || !text}>
          <Eraser size={16} /> Clear
        </button>
        <button className="btn-primary px-6" onClick={submit} disabled={busy}>
          {busy ? <><Loader2 size={16} className="animate-spin" /> Searching the web…</> : <><Search size={16} /> Analyze News</>}
        </button>
      </div>
    </section>
  );
}