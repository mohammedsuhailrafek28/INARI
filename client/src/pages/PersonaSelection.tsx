import { INARI_EMBLEM as inariLogo } from "@/lib/brand";
import { PersonaCard } from "@/components/onboarding/PersonaCard";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/wealth/EmptyState";
import { ErrorState } from "@/components/wealth/ErrorState";
import { LoadingSkeleton } from "@/components/wealth/LoadingSkeleton";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type DemoProfile = RouterOutputs["profiles"]["list"][number];

type PersonaPresentation = {
  name: string;
  profession: string;
  city: string;
  age: number;
  incomeLabel: string;
  goal: string;
  challenge: string;
  riskProfile: string;
  avatarTone: "teal" | "amber" | "slate";
};

const personaByProfileName: Record<string, PersonaPresentation> = {
  "Salaried Beginner": {
    name: "Arjun Sharma",
    profession: "Software Engineer",
    city: "Chennai",
    age: 25,
    incomeLabel: "₹75,000",
    riskProfile: "Moderate",
    goal: "Buy first home",
    challenge: "Emergency fund only covers 3 months",
    avatarTone: "teal",
  },
  "Family-Focused": {
    name: "Priya Nair",
    profession: "HR Manager",
    city: "Bengaluru",
    age: 38,
    incomeLabel: "₹1.2L",
    riskProfile: "Conservative",
    goal: "Children's education",
    challenge: "Planning long-term investments",
    avatarTone: "amber",
  },
  "High Spender": {
    name: "Ravi Mehta",
    profession: "Startup Founder",
    city: "Mumbai",
    age: 34,
    incomeLabel: "Variable monthly income",
    riskProfile: "Aggressive",
    goal: "Scale business while growing personal wealth",
    challenge: "Irregular cash flow",
    avatarTone: "slate",
  },
};

const approvedProfileNames = new Set(Object.keys(personaByProfileName));

function routeTo(path: string) {
  window.history.pushState(null, "", path);
  window.dispatchEvent(new Event("wealthverse:navigation"));
}

export default function PersonaSelection() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const utils = trpc.useUtils();
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const profilesQuery = trpc.profiles.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const setActiveProfileMutation = trpc.profiles.setActive.useMutation({
    onMutate: () => setMutationError(null),
    onSuccess: async () => {
      await Promise.all([
        utils.profiles.getActive.invalidate(),
        utils.dashboard.getSummary.invalidate(),
        utils.wealth.getContext.invalidate(),
        utils.wealth.getPredictions.invalidate(),
        utils.goals.list.invalidate(),
        utils.alerts.list.invalidate(),
        utils.transactions.recent.invalidate(),
        utils.recommendations.list.invalidate(),
        utils.spending.getBreakdown.invalidate(),
        utils.spending.getUnusual.invalidate(),
        utils.spending.getOpportunities.invalidate(),
        utils.wealth.getEventTimeline.invalidate(),
        utils.wealth.getNotifications.invalidate(),
      ]);
      setLocation("/building-context");
    },
    onError: () => {
      setMutationError(
        "We could not activate this demo persona. Please retry or enter through demo sign-in first."
      );
    },
  });

  const profiles = (profilesQuery.data ?? []).filter((profile) =>
    approvedProfileNames.has(profile.name)
  );
  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedProfileId) ?? profiles[0],
    [profiles, selectedProfileId]
  );

  const isSubmitting = setActiveProfileMutation.isPending;
  const disabled = authLoading || isSubmitting;

  const continueWithProfile = (profileId: number | null) => {
    const id = profileId ?? selectedProfile?.id;
    if (!id || disabled) return;
    if (!isAuthenticated) {
      setMutationError("Start demo access first, then choose a persona.");
      return;
    }
    setSelectedProfileId(id);
    setActiveProfileMutation.mutate({ demoProfileId: id });
  };

  return (
    <main className="min-h-screen bg-wv-background text-wv-text">
      <header className="border-b border-wv-border/70 bg-wv-surface/95 backdrop-blur">
        <div className="mx-auto flex min-h-14 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-md text-sm font-bold text-wv-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wv-primary focus-visible:ring-offset-2"
          >
            <img src={inariLogo} alt="Official INARI logo" className="size-8 rounded-md object-contain" />
            <span>INARI</span>
          </a>
          <span className="hidden text-[10px] font-bold uppercase tracking-[0.22em] text-wv-text-secondary sm:inline">
            Onboarding Experience
          </span>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-16 lg:px-8">
        <div className="text-center">
          <p className="inline-flex items-center gap-2 rounded-full bg-wv-primary/8 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-wv-primary">
            <Sparkles className="size-4" aria-hidden />
            Interactive demo
          </p>
          <h1 className="mt-5 font-display text-3xl font-bold tracking-tight text-wv-primary-dark sm:text-5xl">
            Choose your Financial Profile
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-wv-text-secondary sm:text-base">
            Select a demo profile to experience personalized financial intelligence tailored
            to a real INARI persona.
          </p>
        </div>

        {profilesQuery.isLoading || authLoading ? (
          <div className="mt-10">
            <LoadingSkeleton variant="page-section" />
          </div>
        ) : profilesQuery.isError ? (
          <ErrorState
            className="mx-auto mt-10 max-w-2xl"
            title="Profiles could not load"
            message="We could not load the demo personas safely. Retry the profile request."
            onRetry={() => profilesQuery.refetch()}
          />
        ) : profiles.length === 0 ? (
          <EmptyState
            className="mx-auto mt-10 max-w-2xl"
            title="No demo profiles available"
            description="Seed or enable demo data before starting the interactive INARI demo."
          />
        ) : (
          <>
            <div
              className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
              role="list"
              aria-label="Demo financial personas"
            >
              {profiles.map((profile) => (
                <div key={profile.id} role="listitem">
                  <PersonaCard
                    id={profile.id}
                    {...personaByProfileName[profile.name]}
                    selected={(selectedProfileId ?? selectedProfile?.id) === profile.id}
                    disabled={disabled}
                    onSelect={setSelectedProfileId}
                    onContinue={continueWithProfile}
                  />
                </div>
              ))}
            </div>

            {mutationError ? (
              <div
                className="mx-auto mt-6 max-w-xl rounded-[var(--wv-radius-form)] border border-wv-error/30 bg-wv-error/8 px-4 py-3 text-center text-sm text-wv-error"
                role="alert"
              >
                {mutationError}
              </div>
            ) : null}

            <div className="mt-10 flex flex-col items-center gap-4 text-center">
              <Button
                type="button"
                className="min-h-12 rounded-full bg-wv-accent px-8 text-white hover:bg-wv-accent-hover"
                onClick={() => continueWithProfile(selectedProfile?.id ?? null)}
                disabled={disabled || !selectedProfile}
              >
                {isSubmitting ? "Activating persona..." : "Continue"}
              </Button>
              <p className="text-xs text-wv-muted">Not sure which one to pick?</p>
              <button
                type="button"
                className="rounded-md text-[10px] font-bold uppercase tracking-[0.18em] text-wv-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wv-primary focus-visible:ring-offset-2"
                onClick={() => routeTo("/")}
              >
                Browse all features
              </button>
            </div>
          </>
        )}

        {!isAuthenticated && !authLoading ? (
          <div className="mx-auto mt-8 max-w-xl rounded-[var(--wv-radius-card)] border border-wv-border bg-wv-surface p-5 text-center shadow-wv-low">
            <p className="text-sm leading-6 text-wv-text-secondary">
              Demo mode is needed to activate a persona. If OAuth is configured,
              sign in first; in local demo mode, this route activates automatically.
            </p>
            <Button asChild className="mt-4 bg-wv-primary text-white hover:bg-wv-primary-dark">
              <a href="/login">Go to sign in</a>
            </Button>
          </div>
        ) : null}
      </section>

      <footer className="border-t border-wv-border bg-wv-surface px-4 py-6 text-xs text-wv-muted sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-semibold text-wv-text">INARI</span>
          <span>© 2026 INARI. Financial insights for a calmer future.</span>
        </div>
      </footer>
    </main>
  );
}
