import heroFamily from "@/assets/wealthverse/hero-family.png";
import inariLogo from "@/assets/inari/inari-logo.svg";
import { AuthBenefitList } from "@/components/auth/AuthBenefitList";
import { AuthCard } from "@/components/auth/AuthCard";
import { OAuthLoginButton } from "@/components/auth/OAuthLoginButton";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  ArrowLeft,
  BarChart3,
  Loader2,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { useEffect, useMemo } from "react";

const DASHBOARD_PATH = "/dashboard";

const onboardingBenefits = [
  {
    title: "Understand your financial health",
    description:
      "Review spending, savings, debt, goals, and readiness signals in one workspace.",
    icon: <BarChart3 className="size-4" aria-hidden="true" />,
  },
  {
    title: "Set and track meaningful goals",
    description:
      "Use goal progress and forecast context to understand what needs attention.",
    icon: <Target className="size-4" aria-hidden="true" />,
  },
  {
    title: "Receive explainable guidance",
    description:
      "Explore educational recommendations with reasoning, risk labels, and next steps.",
    icon: <Sparkles className="size-4" aria-hidden="true" />,
  },
];

const onboardingSteps = [
  "Choose a guided demo financial persona.",
  "Let INARI build the profile's financial context.",
  "Explore financial health, goals, recommendations, and advisor tools.",
];

function replaceRoute(path: string) {
  window.history.replaceState(null, "", path);
  window.dispatchEvent(new Event("wealthverse:navigation"));
}

export default function Signup() {
  const { isAuthenticated, loading } = useAuth();
  const loginUrl = useMemo(() => getLoginUrl(), []);
  const isDemoFallback = loginUrl === DASHBOARD_PATH;

  useEffect(() => {
    if (!loading && isAuthenticated) {
      replaceRoute(DASHBOARD_PATH);
    }
  }, [isAuthenticated, loading]);

  const setupLabel = isDemoFallback
    ? "Start Interactive Demo"
    : "Create my INARI access";

  return (
    <main className="min-h-screen bg-wv-background text-wv-text">
      <div className="mx-auto grid min-h-screen max-w-[var(--wv-content-width)] gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_1fr] lg:px-8 lg:py-8">
        <section
          className="relative hidden overflow-hidden rounded-[var(--wv-radius-card)] bg-wv-primary-dark text-white shadow-wv-card lg:block"
          aria-label="INARI onboarding overview"
        >
          <img
            src={heroFamily}
            width={1038}
            height={372}
            alt="Family planning finances together"
            className="absolute inset-0 h-full w-full object-cover opacity-76"
            loading="lazy"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-wv-primary-dark/96 via-wv-primary-dark/80 to-wv-primary/38" />
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
                Guided onboarding
              </p>
              <h2 className="mt-5 font-display text-4xl font-bold leading-tight tracking-tight xl:text-5xl">
                Begin with clarity before making financial decisions.
              </h2>
              <p className="mt-4 max-w-lg text-base leading-7 text-white/82">
                INARI helps you enter a session-backed workspace for
                understanding financial health, goals, recommendations, and
                advisor guidance.
              </p>
            </div>

            <AuthBenefitList benefits={onboardingBenefits} />
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
                description="We are checking your current INARI session before showing onboarding options."
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
                eyebrow="Get started"
                title="Begin your INARI experience"
                titleLevel={1}
                description="Continue through secure sign-in to access your financial health, goals, recommendations, and digital advisor experience."
                footer={
                  <p className="text-xs leading-5 text-wv-muted">
                    INARI provides educational financial insights and does
                    not guarantee financial or investment outcomes.
                  </p>
                }
              >
                <div className="space-y-5">
                  <OAuthLoginButton href={isDemoFallback ? "/choose-profile" : loginUrl} label={setupLabel} />

                  <div className="rounded-[var(--wv-radius-form)] border border-wv-border bg-wv-background p-4">
                    <h2 className="text-sm font-bold text-wv-text">
                      What happens next
                    </h2>
                    <ol className="mt-3 space-y-3">
                      {onboardingSteps.map((step, index) => (
                        <li key={step} className="flex gap-3 text-sm text-wv-text-secondary">
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-wv-primary text-xs font-bold text-white">
                            {index + 1}
                          </span>
                          <span className="pt-0.5 leading-5">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <Button
                    asChild
                    variant="outline"
                    className="min-h-11 w-full border-wv-border text-wv-text hover:bg-wv-background"
                  >
                    <a href="/login">Already use INARI? Sign in</a>
                  </Button>

                  <p className="text-center text-xs leading-5 text-wv-muted">
                    Email signup, OTP verification, KYC, and bank linking are
                    not part of this prototype signup flow. Need help?{" "}
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
