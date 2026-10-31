import { cn } from "@/lib/utils";
import type { ElementType, ReactNode } from "react";

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type SectionHeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  action?: ReactNode;
  align?: "left" | "center";
  headingLevel?: HeadingLevel;
  className?: string;
};

export function SectionHeader({
  title,
  description,
  eyebrow,
  action,
  align = "left",
  headingLevel = 2,
  className,
}: SectionHeaderProps) {
  const Heading = `h${headingLevel}` as ElementType;

  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        align === "center" && "items-center text-center sm:flex-col sm:items-center",
        className
      )}
    >
      <div className={cn("max-w-2xl", align === "center" && "mx-auto")}>
        {eyebrow ? (
          <p className="mb-2 text-[13px] font-semibold uppercase tracking-[0.14em] text-wv-primary">
            {eyebrow}
          </p>
        ) : null}
        <Heading className="font-display text-[length:var(--wv-section-title)] font-bold leading-[1.12] tracking-[-0.03em] text-wv-text">
          {title}
        </Heading>
        {description ? (
          <p className="mt-2 text-[15px] font-normal leading-6 text-wv-text-secondary sm:text-[17px]">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
