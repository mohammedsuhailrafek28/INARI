import inariLogo from "@/assets/inari/inari-logo.svg";
import { useAuth } from "@/_core/hooks/useAuth";
import { DashboardNavbar } from "@/components/layout/DashboardNavbar";
import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { appLinks, useInariMode } from "./kit";

/** Page frame for the INARI-native pages (Import Center). Uses the same navbar and design tokens as the original pages. */
export function AppFrame({ active, title, description, children }: { active: string; title: string; description?: string; children: ReactNode }) {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [menu, setMenu] = useState(false);
  const mode = useInariMode();
  useEffect(() => {
    if (!loading && !isAuthenticated) setLocation("/");
  }, [loading, isAuthenticated, setLocation]);
  return (
    <div className="min-h-screen bg-wv-background text-wv-text">
      <DashboardNavbar
        logoSrc={inariLogo}
        links={appLinks(active)}
        userName={user?.name ?? "Demo User"}
        profileLabel={mode.imported ? "Your imported data" : undefined}
        mobileMenuOpen={menu}
        onMobileMenuClick={() => setMenu(o => !o)}
        onLogout={async () => { await logout(); setLocation("/"); }}
      />
      <main className="mx-auto max-w-[var(--wv-content-width)] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <header>
          <h1 className="font-display text-[var(--wv-section-title)] font-bold tracking-[-0.03em]">{title}</h1>
          {description ? <p className="mt-1 max-w-3xl text-[15px] text-wv-text-secondary">{description}</p> : null}
        </header>
        {children}
      </main>
    </div>
  );
}
