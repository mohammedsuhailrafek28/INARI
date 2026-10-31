import { formatCurrencyINR, formatPercentage, formatTitle } from "@/lib/formatters";
import { Activity, Lightbulb, ShieldCheck, Target } from "lucide-react";
import type { ReactNode } from "react";

export type AdvisorContextRecommendation = {
  title: string;
  category: string;
  riskLevel: string;
  confidenceScore: number;
};

export type AdvisorContextPanelProps = {
  healthScore?: number;
  savingsRate?: number;
  monthlySurplus?: number;
  riskProfile?: string;
  activeGoals: number;
  recommendations: AdvisorContextRecommendation[];
};

export function AdvisorContextPanel({
  healthScore,
  savingsRate,
  monthlySurplus,
  riskProfile,
  activeGoals,
  recommendations,
}: AdvisorContextPanelProps) {
  return (
    <section className="rounded-[var(--wv-radius-card)] border border-wv-border bg-wv-surface p-5 shadow-wv-card">
      <h2 className="text-base font-bold text-wv-text">Profile context</h2>
      <p className="mt-2 text-sm leading-6 text-wv-text-secondary">
        The advisor uses available INARI profile data, not live bank data.
      </p>
      <div className="mt-5 grid gap-3">
        <ContextMetric
          icon={<Activity className="size-4" aria-hidden="true" />}
          label="Financial health"
          value={typeof healthScore === "number" ? `${healthScore}/100` : "Unavailable"}
        />
        <ContextMetric
          icon={<ShieldCheck className="size-4" aria-hidden="true" />}
          label="Risk profile"
          value={formatTitle(riskProfile)}
        />
        <ContextMetric
          icon={<Target className="size-4" aria-hidden="true" />}
          label="Active goals"
          value={String(activeGoals)}
        />
        <ContextMetric
          icon={<Lightbulb className="size-4" aria-hidden="true" />}
          label="Savings rate"
          value={typeof savingsRate === "number" ? formatPercentage(savingsRate) : "Unavailable"}
        />
        <ContextMetric
          icon={<Activity className="size-4" aria-hidden="true" />}
          label="Monthly surplus"
          value={typeof monthlySurplus === "number" ? formatCurrencyINR(monthlySurplus) : "Unavailable"}
        />
      </div>

      <div className="mt-6 border-t border-wv-border pt-5">
        <h3 className="text-sm font-bold text-wv-text">Recommendation context</h3>
        <div className="mt-3 space-y-3">
          {recommendations.length > 0 ? (
            recommendations.slice(0, 3).map((recommendation) => (
              <div
                key={`${recommendation.category}-${recommendation.title}`}
                className="rounded-[var(--wv-radius-form)] bg-wv-background p-3"
              >
                <p className="text-sm font-bold text-wv-text">{recommendation.title}</p>
                <p className="mt-1 text-xs leading-5 text-wv-muted">
                  {formatTitle(recommendation.category)} · {formatTitle(recommendation.riskLevel)} risk ·{" "}
                  {formatPercentage(recommendation.confidenceScore)} confidence
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm leading-6 text-wv-text-secondary">
              No recommendation context is available for this profile yet.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function ContextMetric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[var(--wv-radius-form)] bg-wv-background p-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-white text-wv-primary">
        {icon}
      </div>
      <div>
        <p className="text-xs font-semibold text-wv-muted">{label}</p>
        <p className="mt-0.5 text-sm font-bold text-wv-text">{value}</p>
      </div>
    </div>
  );
}
