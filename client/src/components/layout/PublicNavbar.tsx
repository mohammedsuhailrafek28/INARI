import { BrandEmblem } from "@/components/brand/BrandMark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Menu, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

export type PublicNavLink = {
  label: string;
  href: string;
  isActive?: boolean;
};

export type PublicNavbarAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  ariaLabel?: string;
};

export type PublicNavbarProps = {
  logoSrc?: string;
  brandName?: string;
  links: PublicNavLink[];
  actions?: PublicNavbarAction[];
  mobileMenuOpen?: boolean;
  onMobileMenuClick?: () => void;
  className?: string;
  children?: ReactNode;
};

export function PublicNavbar({
  logoSrc,
  brandName = "INARI",
  links,
  actions = [],
  mobileMenuOpen = false,
  onMobileMenuClick,
  className,
  children,
}: PublicNavbarProps) {
  return (
    <header
      className={cn(
        "public-navigation border-b border-wv-border bg-wv-surface text-wv-text",
        className
      )}
    >
      <div className="mx-auto flex min-h-16 max-w-[var(--wv-content-width)] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <a
          href="/"
          className="inline-flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wv-primary focus-visible:ring-offset-2"
          aria-label={`${brandName} home`}
        >
          <BrandEmblem size={44} />
          <span className="brand-wordmark">INARI</span>
        </a>

        <nav
          className="hidden items-center gap-1 lg:flex"
          aria-label="Primary navigation"
        >
          {links.map(link => (
            <a
              key={`${link.href}-${link.label}`}
              href={link.href}
              aria-current={link.isActive ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-2 text-[15px] font-medium text-wv-text-secondary transition-colors hover:bg-wv-background hover:text-wv-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wv-primary focus-visible:ring-offset-2",
                link.isActive &&
                  "bg-wv-background font-semibold text-wv-primary"
              )}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {children}
          <div className="hidden items-center gap-2 sm:flex">
            {actions.map(action => (
              <NavbarAction key={action.label} action={action} />
            ))}
          </div>
          {onMobileMenuClick ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="border-wv-border text-wv-text lg:hidden"
              onClick={onMobileMenuClick}
              aria-expanded={mobileMenuOpen}
              aria-controls="public-mobile-navigation"
              aria-label={
                mobileMenuOpen
                  ? "Close navigation menu"
                  : "Open navigation menu"
              }
            >
              <Menu className="size-4" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </div>
      {mobileMenuOpen ? (
        <nav
          id="public-mobile-navigation"
          className="border-t border-wv-border px-4 py-4 lg:hidden"
          aria-label="Mobile primary navigation"
        >
          <div className="flex flex-col gap-2">
            {links.map(link => (
              <a
                key={`mobile-${link.href}-${link.label}`}
                href={link.href}
                aria-current={link.isActive ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-3 text-[15px] font-medium text-wv-text-secondary transition-colors hover:bg-wv-background hover:text-wv-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wv-primary focus-visible:ring-offset-2",
                  link.isActive &&
                    "bg-wv-background font-semibold text-wv-primary"
                )}
              >
                {link.label}
              </a>
            ))}
            {actions.length > 0 ? (
              <div className="mt-2 flex flex-col gap-2 border-t border-wv-border pt-3">
                {actions.map(action => (
                  <NavbarAction
                    key={`mobile-${action.label}`}
                    action={action}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </nav>
      ) : null}
    </header>
  );
}

function NavbarAction({ action }: { action: PublicNavbarAction }) {
  const className =
    action.variant === "primary"
      ? "bg-wv-accent text-white hover:bg-wv-accent-hover"
      : "border-wv-border text-wv-text hover:bg-wv-background";

  if (action.href) {
    return (
      <Button
        asChild
        variant={action.variant === "primary" ? "default" : "outline"}
        className={className}
      >
        <a href={action.href} aria-label={action.ariaLabel}>
          {action.label}
        </a>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant={action.variant === "primary" ? "default" : "outline"}
      className={className}
      onClick={action.onClick}
      aria-label={action.ariaLabel}
    >
      {action.label}
    </Button>
  );
}
