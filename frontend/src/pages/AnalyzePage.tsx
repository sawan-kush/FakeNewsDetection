import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { api } from "../api";
import type { AnalysisResult, Health } from "../types";
import { InputCard } from "../components/InputCard";
import { ResultView } from "../components/ResultView";

export function AnalyzePage() {
  const [limits, setLimits] = useState<Health["limits"]>({ min: 10, max: 8000 });
  const [keyMissing, setKeyMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.health()
      .then((h) => { setLimits(h.limits); setKeyMissing(!h.groq_configured); })
      .catch((e) => setError(e?.message ?? "Cannot reach the backend."));
  }, []);

  const submit = async (text: string) => {
    setError(null); setBusy(true);
    try {
      setResult(await api.analyze(text));
      window.scrollTo({ top: 0 });
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (result) return <ResultView result={result} onBack={() => { setResult(null); setError(null); }} />;

  return (
    <div>
      <section className="max-w-3xl">
        <h1 className="text-4xl font-medium leading-[1.1] sm:text-6xl">Is this news correct?</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft">
          Paste a headline or an article. We search the web and tell you if it is correct, false or misleading.
        </p>
      </section>

      <div className="mt-8"><InputCard min={limits.min} max={limits.max} busy={busy} onSubmit={submit} /></div>

      {keyMissing && !error && (
        <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />GROQ_API_KEY is not set. Add it to backend/.env and restart the backend.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />{error}
        </p>
      )}
    </div>
  );
}