import { Building2, FlaskConical, HelpCircle, Newspaper, ScanSearch, BookOpen } from "lucide-react";
import type { Tier } from "../types";

export const TIER_INFO: Record<Tier, { label: string; icon: JSX.Element; cls: string }> = {
  official: { label: "Official", icon: <Building2 size={13} />, cls: "bg-indigo-50 text-indigo-700 ring-indigo-100" },
  scientific: { label: "Scientific", icon: <FlaskConical size={13} />, cls: "bg-indigo-50 text-indigo-700 ring-indigo-100" },
  news: { label: "News outlet", icon: <Newspaper size={13} />, cls: "bg-teal-50 text-teal-700 ring-teal-100" },
  factcheck: { label: "Fact-checker", icon: <ScanSearch size={13} />, cls: "bg-teal-50 text-teal-700 ring-teal-100" },
  reference: { label: "Reference", icon: <BookOpen size={13} />, cls: "bg-slate-100 text-slate-600 ring-slate-200" },
  unrated: { label: "Unrated", icon: <HelpCircle size={13} />, cls: "bg-slate-100 text-slate-600 ring-slate-200" },
};

export function SourceBadge({ tier, meaning }: { tier: Tier; meaning: string }) {
  const t = TIER_INFO[tier];
  return (
    <span title={meaning} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${t.cls}`}>
      {t.icon}{t.label}
    </span>
  );
}
