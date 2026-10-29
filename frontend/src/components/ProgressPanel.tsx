import { AlertTriangle, Check, Circle, Loader2, MinusCircle } from "lucide-react";
import type { Stage } from "../types";

const ICON = {
  pending: <Circle size={18} className="text-slate-300" />,
  running: <Loader2 size={18} className="animate-spin text-indigo-600" />,
  done: <Check size={18} className="text-teal-600" />,
  failed: <AlertTriangle size={18} className="text-verdict-mixed" />,
  skipped: <MinusCircle size={18} className="text-slate-400" />,
};

/** Renders stage status exactly as reported by the backend job: nothing here is simulated. */
export function ProgressPanel({ stages }: { stages: Stage[] }) {
  return (
    <section className="card p-5 sm:p-6" aria-live="polite" aria-label="Analysis progress">
      <h2 className="text-xl font-medium">Checking your news</h2>
      <ol className="mt-5 space-y-3">
        {stages.map((s) => (
          <li key={s.id} className="flex items-start gap-3">
            <span className="mt-0.5">{ICON[s.status]}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className={`text-[15px] ${s.status === "pending" ? "text-ink-muted" : "font-medium"}`}>{s.label}</span>
                {s.seconds != null && <span className="text-xs tabular-nums text-ink-muted">{s.seconds}s</span>}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}