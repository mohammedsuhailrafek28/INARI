import { BrandLockup } from "@/components/brand/BrandMark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowUpRight,
  LayoutDashboard,
  Upload,
  ChartNoAxesCombined,
  Target,
  GitBranch,
  MessageSquare,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
export type DashboardNavLink = {
  label: string;
  href: string;
  isActive?: boolean;
};
export type DashboardProfileOption = { id: number; label: string };
export type DashboardNavbarProps = {
  logoSrc?: string;
  brandName?: string;
  links: DashboardNavLink[];
  userName?: string;
  profileLabel?: string;
  profileOptions?: DashboardProfileOption[];
  activeProfileId?: number | null;
  onProfileChange?: (id: number) => void;
  profileSwitchDisabled?: boolean;
  onLogout?: () => void;
  mobileMenuOpen?: boolean;
  onMobileMenuClick?: () => void;
  className?: string;
  children?: ReactNode;
};
const icons = [
  LayoutDashboard,
  Upload,
  ChartNoAxesCombined,
  Target,
  GitBranch,
  MessageSquare,
];
export function DashboardNavbar({
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
  const profile = (
    <div className="navigation-profile">
      {profileOptions.length > 0 && onProfileChange ? (
        <label>
          <span className="navigation-caption">Active fictional persona</span>
          <select
            aria-label="Switch active profile"
            value={activeProfileId ?? ""}
            disabled={profileSwitchDisabled}
            onChange={e => onProfileChange(Number(e.target.value))}
          >
            {profileOptions.map(p => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <>
          <span className="navigation-caption">
            {profileLabel ?? "Your workspace"}
          </span>
          <strong>{userName ?? "Demo session"}</strong>
        </>
      )}
      <a href="/choose-profile">
        Switch persona <ArrowUpRight size={14} />
      </a>
    </div>
  );
  const nav = (mobile = false) => (
    <nav
      aria-label={
        mobile ? "Mobile dashboard navigation" : "Dashboard navigation"
      }
      id={mobile ? "dashboard-mobile-navigation" : undefined}
      className={mobile ? "mobile-app-links" : "desktop-app-links"}
    >
      {links.map((l, i) => {
        const Icon = icons[i] ?? LayoutDashboard;
        return (
          <a
            key={l.href}
            href={l.href}
            aria-current={l.isActive ? "page" : undefined}
            className={cn(l.isActive && "is-active")}
          >
            <Icon size={18} />
            <span>{l.label}</span>
            {l.isActive && <span className="active-dot" />}
          </a>
        );
      })}
    </nav>
  );
  return (
    <>
      <a className="skip-link" href="#workspace-content">
        Skip to workspace
      </a>
      <header className={cn("app-navigation", className)}>
        <div className="navigation-brand">
          <BrandLockup href="/dashboard" label={`${brandName} dashboard`} />
          <span className="navigation-caption">THE LIVING MONEY MODEL</span>
        </div>
        <div className="navigation-mobile-title">
          {links.find(l => l.isActive)?.label ?? "Workspace"}
        </div>
        {nav()}
        <div className="navigation-bottom">
          {children}
          {profile}
          <a className="navigation-home" href="/">
            Back to INARI <ArrowUpRight size={16} />
          </a>
          {onLogout && (
            <Button
              variant="ghost"
              onClick={onLogout}
              className="navigation-logout"
            >
              <LogOut size={16} /> End demo session
            </Button>
          )}
          <p>Educational · Non-advisory</p>
        </div>
        {onMobileMenuClick && (
          <button
            type="button"
            className="navigation-toggle"
            aria-label={
              mobileMenuOpen
                ? "Close dashboard navigation"
                : "Open dashboard navigation"
            }
            aria-expanded={mobileMenuOpen}
            aria-controls="dashboard-mobile-navigation"
            onClick={onMobileMenuClick}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        )}
        {mobileMenuOpen && (
          <div className="navigation-mobile-panel">
            {nav(true)}
            {profile}
            {onLogout && (
              <Button variant="ghost" onClick={onLogout}>
                <LogOut size={16} /> End demo session
              </Button>
            )}
          </div>
        )}
      </header>
    </>
  );
}
