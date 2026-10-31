import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LogOut, Menu, RefreshCcw, UserRound } from "lucide-react";
import type { ReactNode } from "react";

export type DashboardNavLink = {
  label: string;
  href: string;
  isActive?: boolean;
};

export type DashboardProfileOption = {
  id: number;
  label: string;
};

export type DashboardNavbarProps = {
  logoSrc?: string;
  brandName?: string;
  links: DashboardNavLink[];
  userName?: string;
  profileLabel?: string;
  profileOptions?: DashboardProfileOption[];
  activeProfileId?: number | null;
  onProfileChange?: (profileId: number) => void;
  profileSwitchDisabled?: boolean;
  onLogout?: () => void;
  mobileMenuOpen?: boolean;
  onMobileMenuClick?: () => void;
  className?: string;
  children?: ReactNode;
};

export function DashboardNavbar({
  logoSrc,
  brandName = "INARI",
  links,
  userName,
  profileLabel,
  profileOptions = [],
  activeProfileId,
  onProfileChange,
  profileSwitchDisabled = false,
  onLogout,
  mobileMenuOpen = false,
  onMobileMenuClick,
  className,
  children,
}: DashboardNavbarProps) {
  return (
    <header
      className={cn(
        "border-b border-white/15 bg-wv-primary-dark text-white shadow-wv-low",
        className
      )}
    >
      <div className="mx-auto flex min-h-16 max-w-[var(--wv-content-width)] items-center gap-4 px-4 sm:px-6 lg:px-8">
        <a
          href="/dashboard"
          className="inline-flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-wv-primary-dark"
          aria-label={`${brandName} dashboard`}
        >
          {logoSrc ? (
            <img src={logoSrc} alt="Official INARI logo" className="h-10 w-auto rounded-md" />
          ) : (
            <span className="flex size-10 items-center justify-center rounded-md bg-white/12">
              <UserRound className="size-5" aria-hidden="true" />
            </span>
          )}
          <span className="font-display text-base font-bold tracking-[-0.03em]">{brandName}</span>
        </a>

        <nav
          className="hidden flex-1 items-center justify-center gap-1 lg:flex"
          aria-label="Dashboard navigation"
        >
          {links.map((link) => (
            <a
              key={`${link.href}-${link.label}`}
              href={link.href}
              aria-current={link.isActive ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-2 text-[15px] font-medium text-white/78 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-wv-primary-dark",
                link.isActive && "bg-white/12 font-semibold text-white"
              )}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {children}
          <Button
            asChild
            variant="outline"
            className="hidden min-h-10 border-white/30 bg-transparent text-white hover:bg-white/10 md:inline-flex"
          >
            <a href="/choose-profile" aria-label="Switch persona with guided onboarding">
              <RefreshCcw className="size-4" aria-hidden="true" />
              Switch Persona
            </a>
          </Button>
          <ProfileControl
            userName={userName}
            profileLabel={profileLabel}
            profileOptions={profileOptions}
            activeProfileId={activeProfileId}
            onProfileChange={onProfileChange}
            disabled={profileSwitchDisabled}
            className="hidden sm:block"
          />
          {onLogout ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="hidden border-white/30 bg-transparent text-white hover:bg-white/10 sm:inline-flex"
              onClick={onLogout}
              aria-label="Log out"
            >
              <LogOut className="size-4" aria-hidden="true" />
            </Button>
          ) : null}
          {onMobileMenuClick ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="border-white/30 bg-transparent text-white hover:bg-white/10 lg:hidden"
              onClick={onMobileMenuClick}
              aria-expanded={mobileMenuOpen}
              aria-controls="dashboard-mobile-navigation"
              aria-label={
                mobileMenuOpen
                  ? "Close dashboard navigation"
                  : "Open dashboard navigation"
              }
            >
              <Menu className="size-4" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </div>
      {mobileMenuOpen ? (
        <nav
          id="dashboard-mobile-navigation"
          className="border-t border-white/15 px-4 py-4 lg:hidden"
          aria-label="Mobile dashboard navigation"
        >
          <div className="flex flex-col gap-2">
            {links.map((link) => (
              <a
                key={`mobile-${link.href}-${link.label}`}
                href={link.href}
                aria-current={link.isActive ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-3 text-[15px] font-medium text-white/78 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-wv-primary-dark",
                  link.isActive && "bg-white/12 font-semibold text-white"
                )}
              >
                {link.label}
              </a>
            ))}
            <a
              href="/choose-profile"
              className="rounded-md px-3 py-3 text-[15px] font-medium text-white/78 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-wv-primary-dark"
            >
              Switch Persona
            </a>
            <ProfileControl
              userName={userName}
              profileLabel={profileLabel}
              profileOptions={profileOptions}
              activeProfileId={activeProfileId}
              onProfileChange={onProfileChange}
              disabled={profileSwitchDisabled}
              className="mt-2"
            />
          </div>
        </nav>
      ) : null}
    </header>
  );
}

function ProfileControl({
  userName,
  profileLabel,
  profileOptions,
  activeProfileId,
  onProfileChange,
  disabled,
  className,
}: {
  userName?: string;
  profileLabel?: string;
  profileOptions: DashboardProfileOption[];
  activeProfileId?: number | null;
  onProfileChange?: (profileId: number) => void;
  disabled: boolean;
  className?: string;
}) {
  if (profileOptions.length > 0 && onProfileChange) {
    return (
      <label className={cn("block", className)}>
        <span className="sr-only">Active profile</span>
        <select
          value={activeProfileId ?? ""}
          disabled={disabled}
          onChange={(event) => onProfileChange(Number(event.target.value))}
          className="min-h-10 max-w-48 rounded-md border border-white/25 bg-wv-primary-dark px-3 py-2 text-[15px] font-semibold text-white outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-wv-primary-dark disabled:cursor-not-allowed disabled:opacity-70"
          aria-label="Switch active profile"
        >
          {profileOptions.map((profile) => (
            <option key={profile.id} value={profile.id} className="bg-white text-wv-text">
              {profile.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (!profileLabel && !userName) return null;

  return (
    <div
      className={cn(
        "rounded-md border border-white/25 px-3 py-2 text-left",
        className
      )}
      aria-label="Current profile"
    >
      <span className="block text-[13px] font-semibold uppercase tracking-[0.1em] text-white/65">{profileLabel ?? "Profile"}</span>
      <span className="block max-w-40 truncate text-[15px] font-semibold">
        {userName ?? "Demo User"}
      </span>
    </div>
  );
}
