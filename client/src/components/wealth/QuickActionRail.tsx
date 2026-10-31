import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type QuickAction = {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

export type QuickActionRailProps = {
  actions: QuickAction[];
  className?: string;
};

export function QuickActionRail({ actions, className }: QuickActionRailProps) {
  return (
    <section
      className={cn(
        "rounded-[var(--wv-radius-card)] border border-wv-border bg-wv-surface p-4 shadow-wv-card",
        className
      )}
      aria-labelledby="quick-actions-heading"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="quick-actions-heading" className="text-base font-bold text-wv-text">
            Quick actions
          </h2>
          <p className="text-sm text-wv-text-secondary">
            Move to the next useful INARI workspace.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.href}
                asChild
                variant="outline"
                className="min-h-14 justify-start border-wv-border text-left text-wv-text hover:bg-wv-background"
              >
                <a href={action.href} aria-label={action.label}>
                  <Icon className="size-4 text-wv-primary" aria-hidden="true" />
                  <span>
                    <span className="block text-sm font-bold">{action.label}</span>
                    <span className="block text-xs font-normal text-wv-muted">
                      {action.description}
                    </span>
                  </span>
                </a>
              </Button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
