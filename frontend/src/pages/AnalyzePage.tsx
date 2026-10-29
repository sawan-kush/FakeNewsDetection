import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { api } from "../api";
import type { AnalysisResult, Health, Stage } from "../types";
import { InputCard, Submission } from "../components/InputCard";
import { ProgressPanel } from "../components/ProgressPanel";
import { ResultView } from "../components/ResultView";

const FALLBACK_LIMITS: Health["limits"] = { headline_min: 10, headline_max: 300, article_min: 50, article_max: 20000 };
const INITIAL_STAGES: Stage[] = ["Understanding the claim", "Checking writing style", "Searching the web", "Comparing with sources", "Preparing your report"]
  .map((label, i) => ({ id: String(i), label, status: "pending", detail: "", seconds: null }));
const FRIENDLY_OFFLINE = "We can't connect right now. Please try again in a moment.";

export function AnalyzePage() {
  const [limits, setLimits] = useState<Health["limits"]>(FALLBACK_LIMITS);
  const [canSave, setCanSave] = useState(true);
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [stages, setStages] = useState<Stage[]>(INITIAL_STAGES);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | undefined>();
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const reset = useCallback(() => {
    window.clearTimeout(timer.current);
    setPhase("idle"); setResult(null); setError(null);
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    api.health().then((h) => { setLimits(h.limits); setCanSave(h.history_enabled); }).catch(() => setError(FRIENDLY_OFFLINE));
    // Browser Back / logo / "Analyze" link: leaving "#/results" returns to the home form.
    const onHash = () => {
      const h = window.location.hash;
      if ((h === "" || h === "#/" || h === "#") && phaseRef.current !== "idle") reset();
    };
    window.addEventListener("hashchange", onHash);
    return () => { window.removeEventListener("hashchange", onHash); window.clearTimeout(timer.current); };
  }, [reset]);

  const poll = useCallback((jobId: string) => {
    api.job(jobId).then((snap) => {
      if (phaseRef.current === "idle") return; // user went back while running
      setStages(snap.stages);
      if (snap.status === "running") { timer.current = window.setTimeout(() => poll(jobId), 500); return; }
      if (snap.status === "error" || !snap.result) { setError("Something went wrong. Please try again."); setPhase("idle"); return; }
      setResult(snap.result); setPhase("done");
      window.location.hash = "#/results";   // gives the browser Back button something to return from
      window.scrollTo({ top: 0 });
    }).catch(() => { setError(FRIENDLY_OFFLINE); setPhase("idle"); });
  }, []);

  const submit = async (s: Submission) => {
    setError(null); setResult(null); setStages(INITIAL_STAGES); setPhase("running");
    try {
      const { job_id } = await api.startAnalysis({ mode: s.mode, headline: s.headline, text: s.text, save_history: s.save });
      poll(job_id);
    } catch (e: any) { setError(e?.status === 400 ? e.message : FRIENDLY_OFFLINE); setPhase("idle"); }
  };

  const goHome = () => { window.location.hash = "#/"; };

  if (phase === "done" && result) return <ResultView result={result} onBack={goHome} />;

  return (
    <div>
      <section className="max-w-3xl">
        <h1 className="text-4xl font-medium leading-[1.1] sm:text-6xl">Separate claims from evidence.</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft">
          Paste a headline or an article. TruthLens checks it against sources on the web and tells you what the evidence says.
        </p>
      </section>

      <div className="mt-8">
        <InputCard limits={limits} busy={phase === "running"} canSave={canSave} onSubmit={submit} />
      </div>
      {error && (
        <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-verdict-contradicted">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />{error}
        </p>
      )}
      {phase === "running" && <div className="mt-6"><ProgressPanel stages={stages} /></div>}
    </div>
  );
}