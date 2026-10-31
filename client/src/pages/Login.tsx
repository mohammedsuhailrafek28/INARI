import heroBankingSecurity from "@/assets/wealthverse/hero-banking-security.png";
import { INARI_EMBLEM as inariLogo } from "@/lib/brand";
import { AuthCard } from "@/components/auth/AuthCard";
import { OAuthLoginButton } from "@/components/auth/OAuthLoginButton";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo } from "react";

const DASHBOARD_PATH = "/dashboard";

function replaceRoute(path: string) {
  window.history.replaceState(null, "", path);
  window.dispatchEvent(new Event("wealthverse:navigation"));
}

export default function Login() {
  const { isAuthenticated, loading } = useAuth();
  const loginUrl = useMemo(() => getLoginUrl(), []);
  const isDemoFallback = loginUrl === DASHBOARD_PATH;

  useEffect(() => {
    if (!loading && isAuthenticated) {
      replaceRoute(DASHBOARD_PATH);
    }
  }, [isAuthenticated, loading]);

  const signInLabel = isDemoFallback
    ? "Enter demo workspace"
    : "Continue with secure sign-in";

  return (
    <main className="min-h-screen bg-wv-background text-wv-text">
      <div className="mx-auto grid min-h-screen max-w-[var(--wv-content-width)] gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[1.03fr_0.97fr] lg:px-8 lg:py-8">
        <section
          className="relative hidden overflow-hidden rounded-[var(--wv-radius-card)] bg-wv-primary-dark text-white shadow-wv-card lg:block"
          aria-label="INARI secure access overview"
        >
          <img
            src={heroBankingSecurity}
            width={1120}
            height={500}
            alt="Secure digital banking dashboard illustration"
            className="absolute inset-0 h-full w-full object-cover opacity-72"
            loading="lazy"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-wv-primary-dark/96 via-wv-primary-dark/78 to-wv-primary/42" />
          <div className="relative flex min-h-full flex-col justify-between p-8 xl:p-10">
            <a
              href="/"
              className="inline-flex w-fit items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-wv-primary-dark"
            >
              <img
                src={inariLogo}
                alt="Official INARI logo"
                className="size-10 rounded-md bg-white object-contain p-1"
                loading="lazy"
                decoding="async"
              />
              <span className="font-display text-xl font-bold">INARI</span>
            </a>

            <div className="max-w-xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/24 bg-white/12 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-white">
                <ShieldCheck className="size-4" aria-hidden="true" />
                Session-based access
              </p>
              <h2 className="mt-5 font-display text-4xl font-bold leading-tight tracking-tight xl:text-5xl">
                Your financial workspace starts with a protected session.
              </h2>
              <p className="mt-4 max-w-lg text-base leading-7 text-white/82">
                Your financial insights stay connected to your authenticated
                INARI session, with local demo access available when OAuth
                is not configured.
              </p>
            </div>

            <ul className="grid gap-3 text-sm text-white/82">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-wv-accent" aria-hidden="true" />
                Existing OAuth flow is preserved.
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-wv-accent" aria-hidden="true" />
                Demo mode uses the app's current fallback behavior.
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-wv-accent" aria-hidden="true" />
                INARI provides educational financial insights only.
              </li>
            </ul>
          </div>
        </section>

        <section className="flex min-h-[calc(100vh-3rem)] flex-col justify-center py-8">
          <div className="mx-auto w-full max-w-md">
            <a
              href="/"
              className="mb-8 inline-flex items-center gap-3 rounded-md text-sm font-semibold text-wv-text-secondary transition-colors hover:text-wv-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wv-primary focus-visible:ring-offset-2"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to INARI
            </a>

            {loading || isAuthenticated ? (
              <AuthCard
                eyebrow="Checking access"
                title="Preparing your workspace"
                titleLevel={1}
                description="We are checking your current INARI session before showing sign-in options."
              >
                <div
                  className="flex min-h-28 items-center justify-center gap-3 rounded-[var(--wv-radius-form)] border border-wv-border bg-wv-background text-sm font-medium text-wv-text-secondary"
                  role="status"
                  aria-live="polite"
                >
                  <Loader2 className="size-5 animate-spin text-wv-primary" aria-hidden="true" />
                  Checking session
                </div>
              </AuthCard>
            ) : (
              <AuthCard
                eyebrow="Secure access"
                title="Welcome back"
                titleLevel={1}
                description="Access your financial health, goals, recommendations, and advisor experience."
                footer={
                  <p className="text-xs leading-5 text-wv-muted">
                    INARI provides educational financial insights and does
                    not guarantee investment outcomes. Consult a qualified
                    professional before making financial decisions.
                  </p>
                }
              >
                <div className="space-y-5">
                  <OAuthLoginButton href={loginUrl} label={signInLabel} />

                  <div className="rounded-[var(--wv-radius-form)] border border-wv-border bg-wv-background p-4">
                    <div className="flex gap-3">
                      <LockKeyhole className="mt-0.5 size-5 shrink-0 text-wv-primary" aria-hidden="true" />
                      <div>
                        <h2 className="text-sm font-bold text-wv-text">
                          {isDemoFallback
                            ? "Local demo access is active"
                            : "Secure sign-in is configured"}
                        </h2>
                        <p className="mt-1 text-sm leading-6 text-wv-text-secondary">
                          {isDemoFallback
                            ? "OAuth variables are not configured in this environment, so the existing sign-in action opens the demo workspace."
                            : "The sign-in button opens the configured INARI OAuth flow and returns you to the app after authentication."}
                        </p>
                      </div>
                    </div>
                  </div>

                  <Button
                    asChild
                    variant="outline"
                    className="min-h-11 w-full border-wv-border text-wv-text hover:bg-wv-background"
                  >
                    <a href="/choose-profile">New to INARI? Start Interactive Demo</a>
                  </Button>

                  <p className="text-center text-xs leading-5 text-wv-muted">
                    Password, OTP, password reset, and standalone signup are not
                    available in this prototype yet. Need help?{" "}
                    <a
                      href="/support"
                      className="font-semibold text-wv-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wv-primary focus-visible:ring-offset-2"
                    >
                      Visit Support
                    </a>
                    .
                  </p>
                </div>
              </AuthCard>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
