import { ReactNode } from "react";
import { Search } from "lucide-react";

export type Route = "analyze" | "history";
const NAV: { id: Route; label: string; href: string }[] = [
  { id: "analyze", label: "Analyze", href: "#/" },
  { id: "history", label: "History", href: "#/history" },
];

export function Layout({ route, children }: { route: Route; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <a href="#/" className="flex items-center gap-2.5" aria-label="TruthLens home">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink text-white"><Search size={16} strokeWidth={2.4} /></span>
            <span className="font-serif text-xl font-semibold tracking-tight">TruthLens</span>
          </a>
          <nav className="flex items-center gap-1" aria-label="Main">
            {NAV.map((n) => (
              <a key={n.id} href={n.href} aria-current={route === n.id ? "page" : undefined}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${route === n.id ? "bg-white font-medium text-ink shadow-sm ring-1 ring-line" : "text-ink-muted hover:text-ink"}`}>
                {n.label}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">{children}</main>
    </div>
  );
}