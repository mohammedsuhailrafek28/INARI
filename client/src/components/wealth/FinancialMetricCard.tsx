import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from "lucide-react";
import type { ReactNode } from "react";
import { LoadingSkeleton } from "./LoadingSkeleton";

export type MetricTrendDirection = "up" | "down" | "flat";

export type FinancialMetricCardAction = {
  label: string;
  onClick?: () => void;
  href?: string;
  ariaLabel?: string;
};

export type FinancialMetricCardProps = {
  title: string;
  value: ReactNode;
  subtitle?: string;
  icon?: ReactNode;
  trend?: string;
  trendDirection?: MetricTrendDirection;
  trendAriaLabel?: string;
  action?: FinancialMetricCardAction;
  loading?: boolean;
  className?: string;
};

export function FinancialMetricCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendDirection = "flat",
  trendAriaLabel,
  action,
  loading = false,
  className,
}: FinancialMetricCardProps) {
  if (loading) {
    return <LoadingSkeleton variant="metric-card" className={className} />;
  }

  const TrendIcon =
    trendDirection === "up"
      ? ArrowUpRight
      : trendDirection === "down"
        ? ArrowDownRight
        : Minus;

  return (
    <article
      className={cn(
        "group rounded-wv-card border border-wv-border bg-wv-surface p-5 text-wv-text shadow-wv-card transition-all duration-300 hover:-translate-y-0.5 hover:border-wv-primary/20 hover:shadow-[0_26px_74px_-54px_rgba(12,133,119,0.58)]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-wv-text-secondary">{title}</h3>
          <div style={typeof value === "string" && /[a-zA-Z]/.test(value) ? { fontSize: "clamp(1.25rem, 1.8vw, 1.6rem)" } : undefined} className={`mt-2 ${typeof value === "string" && /[a-zA-Z]/.test(value) ? "break-words" : "whitespace-nowrap"} font-display text-[length:var(--wv-metric-number)] font-extrabold leading-none tracking-[-0.03em] tabular-nums`}>{value}</div>
        </div>
        {icon ? (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-wv-background text-wv-primary transition-colors duration-200 group-hover:bg-wv-primary/10">
            {icon}
          </div>
        ) : null}
      </div>

      {subtitle ? (
        <p className="mt-3 text-[15px] font-normal leading-6 text-wv-muted">{subtitle}</p>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-3">
        {trend ? (
          <p
            className={cn(
              "inline-flex items-center gap-1 text-[14px] font-semibold",
              trendDirection === "up" && "text-wv-success",
              trendDirection === "down" && "text-wv-error",
              trendDirection === "flat" && "text-wv-muted"
            )}
            aria-label={trendAriaLabel ?? `Trend ${trendDirection}: ${trend}`}
          >
            <TrendIcon className="size-4" aria-hidden="true" />
            <span>{trend}</span>
          </p>
        ) : (
          <span aria-hidden="true" />
        )}

        {action ? <MetricAction action={action} /> : null}
      </div>
    </article>
  );
}

function MetricAction({ action }: { action: FinancialMetricCardAction }) {
  if (action.href) {
    return (
      <Button asChild variant="ghost" size="sm" className="text-wv-primary hover:bg-wv-background">
        <a href={action.href} aria-label={action.ariaLabel}>
          {action.label}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </a>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="text-wv-primary hover:bg-wv-background"
      onClick={action.onClick}
      aria-label={action.ariaLabel}
    >
      {action.label}
      <ArrowRight className="size-3.5" aria-hidden="true" />
    </Button>
  );
}
