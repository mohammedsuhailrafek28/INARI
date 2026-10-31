import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowRight, Check, MapPin } from "lucide-react";

export type PersonaCardProps = {
  id: number;
  name: string;
  profession: string;
  city: string;
  age: number;
  incomeLabel: string;
  goal: string;
  challenge: string;
  riskProfile: string;
  avatarTone: "teal" | "amber" | "slate";
  selected: boolean;
  disabled?: boolean;
  onSelect: (id: number) => void;
  onContinue: (id: number) => void;
};

export function PersonaCard({
  id,
  name,
  profession,
  city,
  age,
  incomeLabel,
  goal,
  challenge,
  riskProfile,
  avatarTone,
  selected,
  disabled = false,
  onSelect,
  onContinue,
}: PersonaCardProps) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col rounded-[22px] border bg-wv-surface p-5 text-left shadow-[0_24px_70px_-44px_rgba(12,133,119,0.34)] transition-all duration-300",
        selected
          ? "border-wv-primary shadow-[0_32px_90px_-48px_rgba(0,105,92,0.62)] ring-2 ring-wv-primary/22"
          : "border-wv-border hover:-translate-y-1 hover:border-wv-primary/40 hover:shadow-[0_32px_90px_-50px_rgba(12,133,119,0.48)]",
        disabled && "pointer-events-none opacity-70"
      )}
    >
      <button
        type="button"
        className="absolute inset-0 rounded-[22px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wv-primary focus-visible:ring-offset-4"
        onClick={() => onSelect(id)}
        disabled={disabled}
        aria-pressed={selected}
        aria-label={`Select ${name}`}
      />

      <div className="relative flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div
            className={cn(
              "flex size-14 items-center justify-center rounded-2xl border text-base font-bold shadow-inner",
              avatarTone === "teal" && "border-wv-primary/18 bg-wv-primary/10 text-wv-primary-dark",
              avatarTone === "amber" && "border-wv-accent/20 bg-wv-accent/10 text-wv-accent",
              avatarTone === "slate" && "border-wv-text/10 bg-wv-background text-wv-text"
            )}
            aria-hidden="true"
          >
            {initials}
          </div>
          <span
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold capitalize",
              selected
                ? "border-wv-primary/20 bg-wv-primary/10 text-wv-primary-dark"
                : "border-wv-border bg-wv-background text-wv-text-secondary"
            )}
          >
            {riskProfile}
          </span>
        </div>

        <div className="mt-6 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-[20px] font-bold leading-tight tracking-[-0.03em] text-wv-text">
              {name}
            </h2>
            <p className="mt-1 text-[15px] font-medium text-wv-text-secondary">
              {profession}
            </p>
            <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-normal text-wv-muted">
              <MapPin className="size-3.5" aria-hidden="true" />
              {city} - Age {age}
            </p>
          </div>
          {selected ? (
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-wv-primary text-white shadow-[0_10px_26px_-12px_rgba(12,133,119,0.85)]">
              <Check className="size-4" aria-hidden />
            </span>
          ) : null}
        </div>

        <dl className="mt-5 grid gap-3 text-[13px] font-normal text-wv-muted">
          <div className="rounded-[var(--wv-radius-form)] border border-wv-border bg-wv-background px-3 py-2">
            <dt className="font-semibold uppercase tracking-[0.1em] text-wv-muted">
              Monthly income
            </dt>
            <dd className="mt-1 font-display text-xl font-extrabold tracking-[-0.03em] text-wv-text tabular-nums">
              {incomeLabel}
            </dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-[0.1em] text-wv-muted">
              Current goal
            </dt>
            <dd className="mt-1 text-sm font-semibold leading-5 text-wv-text">
              {goal}
            </dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-[0.1em] text-wv-muted">
              Current challenge
            </dt>
            <dd className="mt-1 text-sm leading-5 text-wv-text-secondary">
              {challenge}
            </dd>
          </div>
        </dl>

        <Button
          type="button"
          className={cn(
            "relative z-10 mt-7 min-h-11 w-full rounded-full shadow-none transition-all duration-200",
            selected
              ? "bg-wv-primary text-white hover:bg-wv-primary-dark hover:shadow-[0_16px_34px_-22px_rgba(0,105,92,0.9)]"
              : "border-wv-border bg-wv-surface text-wv-primary hover:border-wv-primary/35 hover:bg-wv-background"
          )}
          variant={selected ? "default" : "outline"}
          onClick={() => onContinue(id)}
          disabled={disabled}
        >
          Continue
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
    </article>
  );
}
