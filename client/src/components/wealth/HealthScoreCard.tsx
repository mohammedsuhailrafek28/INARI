import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type HealthScoreBreakdown = {
  label: string;
  score: number;
  description?: string;
  /** true when the user has not provided the balance this component needs; shown as "Not provided", never as 0 */
  unknown?: boolean;
};

export type HealthScoreCardProps = {
  score: number;
  category: string;
  description: string;
  breakdown: HealthScoreBreakdown[];
  projection?: string;
  className?: string;
};

export function HealthScoreCard({
  score,
  category,
  description,
  breakdown,
  projection,
  className,
}: HealthScoreCardProps) {
  const safeScore = clampScore(score);

  return (
    <Card
      className={cn(
        "rounded-[var(--wv-radius-card)] border-wv-border bg-wv-surface py-0 shadow-[0_24px_70px_-48px_rgba(12,133,119,0.42)] transition-shadow duration-300 hover:shadow-[0_28px_80px_-50px_rgba(12,133,119,0.52)]",
        className
      )}
    >
      <CardContent className="p-6">
        <div className="grid gap-6 lg:grid-cols-[220px_1fr] lg:items-center">
          <div className="text-center lg:text-left">
            <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-wv-primary">
              Financial health
            </p>
            <div
              className="mx-auto mt-5 flex size-36 items-center justify-center rounded-full border-[14px] border-wv-primary/20 bg-wv-background lg:mx-0"
              aria-label={`Financial health score ${safeScore} out of 100`}
            >
              <div>
                <p className="font-display text-[var(--wv-metric-number)] font-extrabold leading-none tracking-[-0.03em] text-wv-text tabular-nums">
                  {safeScore}
                </p>
                <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-wv-muted">out of 100</p>
              </div>
            </div>
            <p className="mt-4 text-[20px] font-bold capitalize leading-tight text-wv-text">
              {category}
            </p>
            <p className="mt-2 text-[15px] font-normal leading-6 text-wv-text-secondary">
              {description}
            </p>
            {projection ? (
              <p className="mt-3 rounded-md bg-wv-background px-3 py-2 text-xs font-semibold text-wv-primary">
                {projection}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {breakdown.map((item) => {
              const itemScore = clampScore(item.score);
              return (
                <div
                  key={item.label}
                  className="rounded-[var(--wv-radius-form)] border border-wv-border bg-wv-background p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-[14px] font-semibold text-wv-text">{item.label}</h3>
                    <span className="text-[14px] font-semibold text-wv-primary tabular-nums">
                      {item.unknown ? "Not provided" : `${itemScore}/100`}
                    </span>
                  </div>
                  <Progress
                    value={item.unknown ? 0 : itemScore}
                    className="mt-3 h-2 bg-wv-border"
                    aria-label={`${item.label} score ${itemScore} out of 100`}
                  />
                  {item.description ? (
                    <p className="mt-2 text-[13px] font-normal leading-5 text-wv-text-secondary">
                      {item.description}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}
