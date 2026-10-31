import { Bot, Sparkles } from "lucide-react";

export type AdvisorIdentityProps = {
  isSpeaking?: boolean;
  statusLabel: string;
};

export function AdvisorIdentity({
  isSpeaking = false,
  statusLabel,
}: AdvisorIdentityProps) {
  return (
    <section className="rounded-[var(--wv-radius-card)] border border-wv-border bg-wv-surface p-5 text-center shadow-wv-card">
      <div className="mx-auto flex size-28 items-center justify-center rounded-[28px] border border-wv-border bg-wv-background text-wv-primary">
        <Bot className={isSpeaking ? "size-14 animate-pulse" : "size-14"} strokeWidth={1.5} aria-hidden="true" />
      </div>
      <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-wv-primary">
        INARI Advisor
      </p>
      <h2 className="mt-2 text-2xl font-bold text-wv-text">INARI Advisor</h2>
      <p className="mt-2 text-sm leading-6 text-wv-text-secondary">
        A digital wealth guidance interface powered by your current INARI profile.
      </p>
      <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-wv-background px-3 py-2 text-sm font-semibold text-wv-text-secondary">
        <span
          className={isSpeaking ? "size-2 rounded-full bg-wv-primary" : "size-2 rounded-full bg-wv-success"}
          aria-hidden="true"
        />
        <Sparkles className="size-4 text-wv-primary" aria-hidden="true" />
        {statusLabel}
      </div>
    </section>
  );
}
