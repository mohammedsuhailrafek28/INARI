import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Database, FlaskConical, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";

/** Shared building blocks for the INARI ledger panels. Styling uses the existing wv-* design tokens. */

export const inr = (n: number | null | undefined) =>
  n === null || n === undefined ? "Not provided" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
export const inrPaise = (p: number | null | undefined) => (p === null || p === undefined ? "Not provided" : inr(p / 100));
export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Navigation shared by every in-app page. Hrefs are the original WealthVerse routes plus the Import Center. */
export const APP_LINKS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Import", href: "/import" },
  { label: "Spending", href: "/spending" },
  { label: "Goals", href: "/goals" },
  { label: "Recommendations", href: "/recommendations" },
  { label: "Advisor", href: "/avatar" },
];
export const appLinks = (activeHref: string) => APP_LINKS.map(l => ({ ...l, isActive: l.href === activeHref }));

export function Panel({ title, description, children, id, action, className }: { title: string; description?: string; children: ReactNode; id?: string; action?: ReactNode; className?: string }) {
  return (
    <section id={id} className={cn("rounded-wv-card border border-wv-border bg-wv-surface p-5 text-wv-text shadow-wv-card space-y-3", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-bold tracking-[-0.02em]">{title}</h2>
          {description ? <p className="mt-1 text-sm text-wv-text-secondary">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export const Err = ({ msg }: { msg: string | null }) => (msg ? <p role="alert" className="text-sm text-wv-error">Error: {msg}</p> : null);
export const Muted = ({ children }: { children: ReactNode }) => <p className="text-sm text-wv-text-secondary">{children}</p>;
export const Note = ({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" }) => (
  <p className={cn("text-sm", tone === "warn" ? "text-amber-700" : "text-wv-text-secondary")}>{children}</p>
);

export const fieldCls = "rounded-md border border-wv-border bg-wv-surface px-2 py-1.5 text-sm text-wv-text";
export const btnCls = "inline-flex items-center justify-center rounded-md bg-wv-primary px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-wv-primary-dark disabled:cursor-not-allowed disabled:opacity-50";
export const btnGhostCls = "inline-flex items-center justify-center rounded-md border border-wv-border bg-wv-surface px-3 py-1.5 text-sm font-medium text-wv-text transition hover:border-wv-primary/40 disabled:cursor-not-allowed disabled:opacity-50";

/** Whether the signed-in demo identity has imported data. Drives the imported-mode / persona-mode separation. */
export function useInariMode() {
  const meta = trpc.inari.meta.useQuery(undefined, { refetchOnWindowFocus: false });
  return {
    loading: meta.isLoading,
    imported: meta.data?.dataSource === "imported",
    known: !!meta.data,
    storage: meta.data?.storage ?? null,
    error: meta.error ? errMsg(meta.error) : null,
  };
}

/** States which data a page is showing. Persona figures and imported figures are never mixed on one screen. */
export function ModeBanner({ className }: { className?: string }) {
  const mode = useInariMode();
  if (mode.loading || !mode.known) return null;
  return mode.imported ? (
    <div role="note" data-testid="mode-banner" className={cn("flex items-start gap-2 rounded-wv-card border border-wv-primary/30 bg-wv-primary/10 px-4 py-3 text-sm text-wv-text", className)}>
      <Database className="mt-0.5 size-4 shrink-0 text-wv-primary" aria-hidden />
      <span>
        <b>Your imported data.</b> Every figure on this page is calculated from the statements you imported (synthetic demo data only). Balances you have not entered show as “Not provided”.{" "}
        <a className="underline" href="/import">Manage imports</a>
      </span>
    </div>
  ) : (
    <div role="note" data-testid="mode-banner" className={cn("flex items-start gap-2 rounded-wv-card border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900", className)}>
      <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        <b>Sample persona (fictional).</b> The figures below belong to a made-up demo persona, not to you. <a className="underline font-semibold" href="/import">Import a statement</a> to switch every page to your own data.
      </span>
    </div>
  );
}

export function DemoNotice() {
  return (
    <p role="note" className="flex items-start gap-2 rounded-wv-card border border-amber-400 bg-amber-50 px-4 py-2 text-xs text-amber-900">
      <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>Demo build: synthetic data only, never real bank statements. Your session is a temporary per-browser demo identity (not real sign-in) and data is kept in server memory, so it can disappear when the server restarts.</span>
    </p>
  );
}
