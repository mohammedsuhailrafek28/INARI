import { INARI_EMBLEM, INARI_LOGO_FULL, INARI_LOGO_FULL_SIZE } from "@/lib/brand";
import { cn } from "@/lib/utils";

/** Emblem-only crop of the official logo, on a small ivory tile so it reads on forest-green backgrounds. */
export function BrandEmblem({ size = 44, className }: { size?: number; className?: string }) {
  return (
    <img
      src={INARI_EMBLEM}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={cn("brand-emblem", className)}
      style={{ width: size, height: size }}
      decoding="async"
    />
  );
}

/** Compact lockup for navigation: emblem crop plus the INARI wordmark as text. */
export function BrandLockup({ href, label, size = 44, className }: { href: string; label: string; size?: number; className?: string }) {
  return (
    <a className={cn("brand-lockup", className)} href={href} aria-label={label}>
      <BrandEmblem size={size} />
      <span className="brand-wordmark">INARI</span>
    </a>
  );
}

/** The full official logo (emblem and wordmark). Never place another INARI label beside it. */
export function BrandFull({ width = 160, className }: { width?: number; className?: string }) {
  return (
    <img
      src={INARI_LOGO_FULL}
      alt="INARI"
      width={width}
      height={Math.round((width * INARI_LOGO_FULL_SIZE.height) / INARI_LOGO_FULL_SIZE.width)}
      className={cn("brand-full", className)}
      style={{ width, height: "auto", aspectRatio: `${INARI_LOGO_FULL_SIZE.width} / ${INARI_LOGO_FULL_SIZE.height}` }}
      decoding="async"
    />
  );
}
