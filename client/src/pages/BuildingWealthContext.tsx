import { INARI_EMBLEM as inariLogo } from "@/lib/brand";
import {
  ContextBuildingChecklist,
  type ContextChecklistItem,
} from "@/components/onboarding/ContextBuildingChecklist";
import { ContextProgress } from "@/components/onboarding/ContextProgress";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/wealth/ErrorState";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";

const checklistLabels = [
  "Understanding your financial profile",
  "Analyzing spending behaviour",
  "Evaluating financial health",
  "Assessing risk tolerance",
  "Preparing personalized recommendations",
  "Initializing INARI",
];

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(media.matches);
    const update = () => setPrefersReducedMotion(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return prefersReducedMotion;
}

export default function BuildingWealthContext() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const utils = trpc.useUtils();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [progress, setProgress] = useState(0);
  const [backendReady, setBackendReady] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const navigationScheduledRef = useRef(false);

  const activeProfileQuery = trpc.profiles.getActive.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchOnWindowFocus: false,
  });
  const wealthContextQuery = trpc.wealth.getContext.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const duration = prefersReducedMotion ? 700 : 2600;
    const interval = prefersReducedMotion ? 100 : 90;
    const startedAt = Date.now();

    const timer = window.setInterval(() => {
      setProgress((current) => {
        if (backendReady) return Math.min(100, current + (prefersReducedMotion ? 30 : 8));

        const elapsed = Date.now() - startedAt;
        const next = Math.min(96, Math.round((elapsed / duration) * 100));
        return Math.max(current, next);
      });
    }, interval);

    return () => window.clearInterval(timer);
  }, [backendReady, prefersReducedMotion]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    if (!activeProfileQuery.data || !wealthContextQuery.data) return;
    if (activeProfileQuery.isError || wealthContextQuery.isError) return;

    let cancelled = false;
    const complete = async () => {
      await Promise.allSettled([
        utils.dashboard.getSummary.prefetch(),
        utils.wealth.getPredictions.prefetch(),
        utils.goals.list.prefetch(),
        utils.recommendations.list.prefetch(),
        utils.spending.getBreakdown.prefetch(),
        utils.transactions.recent.prefetch(),
      ]);
      if (cancelled) return;
      setBackendReady(true);
    };

    complete();
    return () => {
      cancelled = true;
    };
  }, [
    activeProfileQuery.data,
    activeProfileQuery.isError,
    authLoading,
    isAuthenticated,
    prefersReducedMotion,
    setLocation,
    utils,
    wealthContextQuery.data,
    wealthContextQuery.isError,
  ]);

  useEffect(() => {
    if (!backendReady || progress < 100 || navigationScheduledRef.current) return;

    navigationScheduledRef.current = true;
    setIsComplete(true);
    const timeout = window.setTimeout(() => {
      setLocation("/dashboard");
    }, prefersReducedMotion ? 350 : 850);

    return () => window.clearTimeout(timeout);
  }, [backendReady, prefersReducedMotion, progress, setLocation]);

  const activeIndex = Math.min(
    checklistLabels.length - 1,
    Math.floor((progress / 100) * checklistLabels.length)
  );

  const checklistItems: ContextChecklistItem[] = useMemo(
    () =>
      checklistLabels.map((label, index) => ({
        label,
        active: index === activeIndex && progress < 100,
        complete: progress === 100 || index < activeIndex,
      })),
    [activeIndex, progress]
  );

  const hasError =
    (!authLoading && !isAuthenticated) ||
    activeProfileQuery.isError ||
    wealthContextQuery.isError ||
    (!activeProfileQuery.isLoading &&
      !wealthContextQuery.isLoading &&
      isAuthenticated &&
      !activeProfileQuery.data);

  if (hasError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#123C32] px-4 py-10 text-white">
        <div className="w-full max-w-xl">
          <ErrorState
            title="We could not build your financial context"
            message="Choose a demo persona again so INARI can activate a valid profile before opening the dashboard."
            className="border-white/10 bg-white text-wv-text"
          />
          <div className="mt-5 text-center">
            <Button
              type="button"
              className="bg-[#D9B56B] text-[#17211f] hover:bg-[#b7f0dd]"
              onClick={() => setLocation("/choose-profile")}
            >
              Return to choose profile
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#123C32] px-4 py-10 text-white">
      <div
        className="absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.32) 1px, transparent 0)",
          backgroundSize: "24px 24px",
        }}
        aria-hidden="true"
      />
      <div className="absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top,rgba(150,228,202,0.18),transparent_58%)]" />
      <div
        className="absolute left-1/2 top-1/2 size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#D9B56B]/10 opacity-60 motion-safe:animate-pulse"
        aria-hidden="true"
      />

      <section className="relative w-full max-w-lg text-center" aria-labelledby="context-title">
        <img
          src={inariLogo}
          alt="Official INARI logo"
          className={cn(
            "mx-auto size-20 rounded-2xl object-contain shadow-[0_0_50px_rgba(150,228,202,0.18)]",
            !isComplete && "motion-safe:animate-pulse",
            isComplete && "ring-2 ring-[#D9B56B]/40"
          )}
        />
        <p className="mt-7 text-[10px] font-bold uppercase tracking-[0.22em] text-white/38">
          This should take just a few seconds.
        </p>
        <h1 id="context-title" className="mt-3 font-display text-[34px] font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-[40px]">
          Building Your Financial Twin
        </h1>
        <p className="mx-auto mt-3 max-w-md text-[15px] font-normal leading-6 text-white/58 sm:text-[17px]">
          Analyzing your financial profile to generate personalized insights.
        </p>

        <div
          className={cn(
            "mx-auto mt-8 rounded-[28px] border bg-white/[0.035] p-7 text-left shadow-[0_30px_90px_-55px_rgba(0,0,0,0.9)] backdrop-blur transition-all duration-500",
            isComplete ? "border-[#D9B56B]/24 bg-[#D9B56B]/[0.055]" : "border-white/7"
          )}
        >
          <ContextBuildingChecklist items={checklistItems} />
          <ContextProgress value={progress} className="mt-8" />
        </div>

        <p className="mt-7 text-xs text-white/42" role="status" aria-live="polite">
          {isComplete
            ? "Financial twin ready. Opening your dashboard."
            : `Preparing INARI intelligence: ${Math.round(progress)} percent.`}
        </p>

        <div className="mt-8 text-[10px] font-bold uppercase tracking-[0.22em] text-white/38">
          INARI Intelligence System
          <span className="mt-1 block text-[9px] font-medium tracking-[0.2em] text-white/24">
            Safe demo onboarding
          </span>
        </div>
      </section>
    </main>
  );
}
