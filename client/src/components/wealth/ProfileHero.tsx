import { Button } from "@/components/ui/button";
import { formatTitle } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { AlertTriangle, HeartPulse, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

export type ProfileHeroProps = {
  profileName: string;
  occupation?: string | null;
  riskProfile?: string | null;
  summary: string;
  insight?: string;
  healthScore?: number;
  biggestRisk?: string;
  aiRecommendation?: string;
  onAskAdvisor?: () => void;
  className?: string;
};

export function ProfileHero({
  profileName,
  occupation,
  riskProfile,
  summary,
  insight,
  healthScore,
  biggestRisk,
  aiRecommendation,
  onAskAdvisor,
  className,
}: ProfileHeroProps) {
  const attentionItems = [
    {
      label: "Financial Health Score",
      value: typeof healthScore === "number" ? `${healthScore}/100` : "Review",
      icon: <HeartPulse className="size-4" aria-hidden="true" />,
    },
    {
      label: "Biggest Financial Risk",
      value: biggestRisk ?? "Monitor alerts",
      icon: <AlertTriangle className="size-4" aria-hidden="true" />,
    },
    {
      label: "Today's AI Recommendation",
      value: aiRecommendation ?? insight ?? "Ask advisor",
      icon: <Sparkles className="size-4" aria-hidden="true" />,
    },
  ];

  return (
    <section
      className={cn(
        "rounded-[var(--wv-radius-card)] border border-wv-border bg-wv-surface p-5 shadow-wv-card sm:p-6",
        className
      )}
      aria-labelledby="dashboard-title"
    >
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-wv-primary">
            Financial command centre
          </p>
          <h1
            id="dashboard-title"
            className="mt-2 font-display text-[var(--wv-dashboard-greeting)] font-bold leading-[1.1] tracking-[-0.03em] text-wv-text"
          >
            Good Morning, {profileName}.
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] font-normal leading-6 text-wv-text-secondary sm:text-[17px]">
            Here's what deserves your attention today. {summary}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {occupation ? <HeroPill label={formatTitle(occupation)} /> : null}
            {riskProfile ? <HeroPill label={`${formatTitle(riskProfile)} risk profile`} /> : null}
          </div>
        </div>
        <div className="grid gap-3 lg:min-w-[460px] lg:grid-cols-3">
          {attentionItems.map((item) => (
            <AttentionTile key={item.label} {...item} />
          ))}
        </div>
        <div className="rounded-[var(--wv-radius-form)] border border-wv-border bg-wv-background p-4 lg:max-w-sm">
          <div className="flex gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-wv-primary text-white">
              <Sparkles className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-[20px] font-bold leading-tight text-wv-text">Next best signal</h2>
              <p className="mt-1 text-[15px] font-normal leading-6 text-wv-text-secondary">
                {insight ?? "Review your dashboard sections for the latest profile signals."}
              </p>
              {onAskAdvisor ? (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3 min-h-10 border-wv-border text-wv-text hover:bg-wv-surface"
                  onClick={onAskAdvisor}
                >
                  Ask advisor
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AttentionTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-[var(--wv-radius-form)] border border-wv-border bg-white p-4 shadow-wv-low transition-all duration-300 hover:-translate-y-0.5 hover:border-wv-primary/20">
      <div className="flex items-center gap-2 text-wv-primary">
        {icon}
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-wv-text-secondary">
          {label}
        </p>
      </div>
      <p className="mt-2 line-clamp-2 font-display text-xl font-extrabold leading-tight tracking-[-0.03em] text-wv-text">
        {value}
      </p>
    </div>
  );
}

function HeroPill({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-wv-background px-3 py-1 text-xs font-semibold text-wv-text-secondary">
      {label}
    </span>
  );
}
