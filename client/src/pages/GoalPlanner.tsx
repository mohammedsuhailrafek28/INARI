import { PageSections } from "@/components/inari/LedgerOverview";
import { INARI_EMBLEM as inariLogo } from "@/lib/brand";
import { DashboardNavbar, type DashboardNavLink } from "@/components/layout/DashboardNavbar";
import { ContributionOverview } from "@/components/goals/ContributionOverview";
import { GoalFocusPanel } from "@/components/goals/GoalFocusPanel";
import {
  GoalProgressDistribution,
  type GoalProgressDistributionCounts,
} from "@/components/goals/GoalProgressDistribution";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/wealth/EmptyState";
import { ErrorState } from "@/components/wealth/ErrorState";
import { FinancialMetricCard } from "@/components/wealth/FinancialMetricCard";
import { GoalCard } from "@/components/wealth/GoalCard";
import { LoadingSkeleton } from "@/components/wealth/LoadingSkeleton";
import { SectionHeader } from "@/components/wealth/SectionHeader";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  formatCurrencyINR,
  formatPercentage,
  formatTitle,
} from "@/lib/formatters";
import { trpc } from "@/lib/trpc";
import { DemoNotice, ModeBanner, appLinks, useInariMode } from "@/components/inari/kit";
import { BalancesPanel, GoalsPanel, WhatIfPanel } from "@/components/inari/panels";
import {
  CalendarClock,
  CircleDollarSign,
  Flag,
  PiggyBank,
  Target,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

type Goal = {
  id: number;
  goalType: string;
  targetAmount: number;
  currentAmount: number;
  timelineMonths: number;
  priority: string;
  monthlyContribution: number;
};

type GoalWithProgress = Goal & {
  progress: number;
  remainingAmount: number;
  statusLabel: string;
};

const goalLinks: DashboardNavLink[] = appLinks("/goals");

const priorityRank: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export default function GoalPlanner() {
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const mode = useInariMode();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const profilesQuery = trpc.profiles.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const activeProfileQuery = trpc.profiles.getActive.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchOnWindowFocus: false,
  });
  const personaGoalsQuery = trpc.goals.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const inariGoalsQuery = trpc.inari.getGoals.useQuery(undefined, {
    enabled: isAuthenticated && mode.imported,
  });
  // Imported mode shows only goals the user created; persona goals are never mixed in.
  const goalsQuery = mode.imported
    ? {
        isLoading: inariGoalsQuery.isLoading,
        isError: inariGoalsQuery.isError,
        refetch: inariGoalsQuery.refetch,
        data: (inariGoalsQuery.data?.items ?? []).map((g) => ({
          id: g.id as unknown as number,
          goalType: g.name,
          targetAmount: g.targetAmount,
          currentAmount: g.currentAmount,
          timelineMonths: g.timelineMonths ?? 0,
          priority: g.priority,
          monthlyContribution: g.monthlyContribution ?? 0,
        })),
      }
    : personaGoalsQuery;

  const setActiveProfileMutation = trpc.profiles.setActive.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.profiles.getActive.invalidate(),
        utils.goals.list.invalidate(),
      ]);
    },
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/");
  }, [authLoading, isAuthenticated, setLocation]);

  const profileOptions = useMemo(
    () =>
      (mode.imported ? [] : profilesQuery.data ?? []).map((profile) => ({
        id: profile.id,
        label: profile.name,
      })),
    [profilesQuery.data, mode.imported]
  );

  const goals = useMemo(
    () => normalizeGoals(goalsQuery.data ?? []),
    [goalsQuery.data]
  );

  const sortedGoals = useMemo(
    () =>
      [...goals].sort((a, b) => {
        const priorityDifference = getPriorityRank(a.priority) - getPriorityRank(b.priority);
        if (priorityDifference !== 0) return priorityDifference;
        const progressDifference = a.progress - b.progress;
        if (progressDifference !== 0) return progressDifference;
        return a.timelineMonths - b.timelineMonths;
      }),
    [goals]
  );

  const summary = useMemo(() => buildGoalSummary(goals), [goals]);
  const focusGoal = useMemo(() => chooseFocusGoal(goals), [goals]);
  const distribution = useMemo(() => buildDistribution(goals), [goals]);
  const profileLabel = mode.imported ? "Your imported data" : activeProfileQuery.data?.name;
  const isSwitchingProfile = setActiveProfileMutation.isPending;
  const isPrimaryLoading =
    authLoading || activeProfileQuery.isLoading || goalsQuery.isLoading || isSwitchingProfile;
  const hasPrimaryError = profilesQuery.isError || activeProfileQuery.isError || goalsQuery.isError;

  const retry = async () => {
    await Promise.all([
      profilesQuery.refetch(),
      activeProfileQuery.refetch(),
      goalsQuery.refetch(),
    ]);
  };

  const handleProfileChange = (profileId: number) => {
    if (!profileId || profileId === activeProfileQuery.data?.id) return;
    setActiveProfileMutation.mutate({ demoProfileId: profileId });
  };

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  if (authLoading) {
    return (
      <GoalFrame
        userName={user?.name ?? "Demo User"}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        onLogout={handleLogout}
      >
        <LoadingSkeleton variant="page-section" />
      </GoalFrame>
    );
  }

  if (!isAuthenticated) return null;

  if (hasPrimaryError) {
    return (
      <GoalFrame
        userName={user?.name ?? "Demo User"}
        profileLabel={profileLabel}
        profileOptions={profileOptions}
        activeProfileId={activeProfileQuery.data?.id ?? null}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        onProfileChange={handleProfileChange}
        onLogout={handleLogout}
      >
        <ErrorState
          title="Goals could not load"
          message="We could not load goal data safely. Retry the demo data request or check local app configuration."
          onRetry={retry}
        />
      </GoalFrame>
    );
  }

  if (isPrimaryLoading) {
    return (
      <GoalFrame
        userName={user?.name ?? "Demo User"}
        profileLabel={profileLabel ?? "Loading profile"}
        profileOptions={profileOptions}
        activeProfileId={activeProfileQuery.data?.id ?? null}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        onProfileChange={handleProfileChange}
        onLogout={handleLogout}
        profileSwitchDisabled
      >
        <LoadingSkeleton variant="page-section" />
      </GoalFrame>
    );
  }

  return (
    <GoalFrame
      userName={user?.name ?? "Demo User"}
      profileLabel={profileLabel}
      profileOptions={profileOptions}
      activeProfileId={activeProfileQuery.data?.id ?? null}
      mobileMenuOpen={mobileMenuOpen}
      setMobileMenuOpen={setMobileMenuOpen}
      onProfileChange={handleProfileChange}
      onLogout={handleLogout}
      profileSwitchDisabled={isSwitchingProfile}
    >
      <div className="space-y-6">
        <ModeBanner />
        <DemoNotice />
        {mode.imported && <PageSections items={[{"href": "#my-goals", "label": "Your goals"}, {"href": "/recommendations#whatif", "label": "Test a goal scenario"}]} />}
        <section className="rounded-[var(--wv-radius-card)] border border-wv-border bg-wv-surface p-5 shadow-wv-card sm:p-6">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-wv-primary">
                Goal planning
              </p>
              <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-wv-text sm:text-3xl">
                Goal Planner
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-wv-text-secondary sm:text-base">
                Turn long-term priorities into visible, trackable progress.
              </p>
              {profileLabel && !mode.imported ? (
                <p className="mt-3 text-sm font-semibold text-wv-primary">
                  Active profile: {profileLabel}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild variant="outline" className="min-h-11 border-wv-border text-wv-text">
                <a href="/dashboard">Back to dashboard</a>
              </Button>
              <Button asChild className="min-h-11 bg-wv-accent text-white hover:bg-wv-accent-hover">
                <a href="/recommendations">Review recommendations</a>
              </Button>
            </div>
          </div>
        </section>

        <section>
          <SectionHeader
            title="Goal summary"
            description={mode.imported ? "Summary values come from the goals you created and the balances you confirmed." : "Summary values are derived from active-profile goal records."}
          />
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
            <FinancialMetricCard
              title="Active goals"
              value={String(goals.length)}
              subtitle="Goals returned for this profile"
              trend="Planning"
              icon={<Target className="size-5" aria-hidden="true" />}
            />
            <FinancialMetricCard
              title="Total target"
              value={formatCurrencyINR(summary.totalTarget)}
              subtitle="Combined goal targets"
              trend="Target"
              icon={<Flag className="size-5" aria-hidden="true" />}
            />
            <FinancialMetricCard
              title="Saved so far"
              value={formatCurrencyINR(summary.totalCurrent)}
              subtitle="Current amount across goals"
              trend="Funded"
              trendDirection="up"
              icon={<PiggyBank className="size-5" aria-hidden="true" />}
            />
            <FinancialMetricCard
              title="Combined progress"
              value={formatPercentage(summary.combinedProgress)}
              subtitle={`${formatCurrencyINR(summary.totalRemaining)} remaining`}
              trend="Display only"
              icon={<TrendingUp className="size-5" aria-hidden="true" />}
            />
            <FinancialMetricCard
              title="Monthly contribution"
              value={formatCurrencyINR(summary.totalMonthlyContribution)}
              subtitle="Combined planned contribution"
              trend="Monthly"
              icon={<CircleDollarSign className="size-5" aria-hidden="true" />}
            />
          </div>
        </section>

        {goals.length === 0 ? (
          <EmptyState
            title={mode.imported ? "You have not created a goal yet" : "No financial goals are available for this profile yet"}
            description={mode.imported ? "Create one below. Goals use only the amounts you enter; nothing is assumed." : "Goal records will appear here when the active profile includes planning data."}
          />
        ) : (
          <>
            <GoalFocusPanel
              goalName={focusGoal?.goalType}
              priority={focusGoal?.priority}
              remainingAmount={focusGoal?.remainingAmount}
              progress={focusGoal?.progress}
              timelineMonths={focusGoal?.timelineMonths}
              reason={buildFocusReason(focusGoal)}
            />

            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <ContributionOverview
                totalMonthlyContribution={summary.totalMonthlyContribution}
                items={sortedGoals.map((goal) => ({
                  id: goal.id,
                  name: goal.goalType,
                  priority: goal.priority,
                  monthlyContribution: goal.monthlyContribution,
                }))}
              />
              <GoalProgressDistribution
                counts={distribution}
                totalGoals={goals.length}
              />
            </div>

            <section>
              <SectionHeader
                title="Goals by priority"
                description="Sorted by priority first, then lower funding progress, then shorter timeline."
              />
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {sortedGoals.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    title={goal.goalType}
                    currentAmount={goal.currentAmount}
                    targetAmount={goal.targetAmount}
                    priority={goal.priority}
                    monthlyContribution={goal.monthlyContribution}
                    timelineMonths={goal.timelineMonths}
                    statusLabel={goal.statusLabel}
                  />
                ))}
              </div>
            </section>
          </>
        )}

        {mode.imported ? (
          <>
            <GoalsPanel />
            <div className="grid gap-6 xl:grid-cols-2">
              <WhatIfPanel />
              <BalancesPanel />
            </div>
          </>
        ) : null}

        <section className="rounded-[var(--wv-radius-card)] border border-wv-border bg-wv-surface p-5 shadow-wv-card">
          <div className="flex items-start gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-wv-background text-wv-primary">
              <CalendarClock className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-bold text-wv-text">Planning note</h2>
              <p className="mt-2 text-sm leading-6 text-wv-text-secondary">
                Goal projections are based on available profile data and do not
                guarantee future outcomes. Monthly contribution fields are shown
                as planning inputs, not affordability verdicts.
              </p>
            </div>
          </div>
        </section>
      </div>
    </GoalFrame>
  );
}

function GoalFrame({
  children,
  userName,
  profileLabel,
  profileOptions = [],
  activeProfileId,
  mobileMenuOpen,
  setMobileMenuOpen,
  onProfileChange,
  onLogout,
  profileSwitchDisabled = false,
}: {
  children: React.ReactNode;
  userName: string;
  profileLabel?: string;
  profileOptions?: { id: number; label: string }[];
  activeProfileId?: number | null;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean | ((current: boolean) => boolean)) => void;
  onProfileChange?: (profileId: number) => void;
  onLogout: () => void;
  profileSwitchDisabled?: boolean;
}) {
  return (
    <div className="min-h-screen bg-wv-background text-wv-text">
      <DashboardNavbar
        logoSrc={inariLogo}
        links={goalLinks}
        userName={userName}
        profileLabel={profileLabel}
        profileOptions={profileOptions}
        activeProfileId={activeProfileId}
        onProfileChange={onProfileChange}
        profileSwitchDisabled={profileSwitchDisabled}
        mobileMenuOpen={mobileMenuOpen}
        onMobileMenuClick={() => setMobileMenuOpen((open) => !open)}
        onLogout={onLogout}
      />
      <main id="workspace-content" tabIndex={-1} className="mx-auto max-w-[var(--wv-content-width)] px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}

function normalizeGoals(rawGoals: Goal[]): GoalWithProgress[] {
  return rawGoals.map((goal) => {
    const targetAmount = safeNumber(goal.targetAmount);
    const currentAmount = safeNumber(goal.currentAmount);
    const progress = clampPercent(targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0);
    return {
      ...goal,
      targetAmount,
      currentAmount,
      monthlyContribution: Math.max(safeNumber(goal.monthlyContribution), 0),
      timelineMonths: Math.max(Math.round(safeNumber(goal.timelineMonths)), 0),
      priority: goal.priority || "low",
      progress,
      remainingAmount: Math.max(targetAmount - currentAmount, 0),
      statusLabel: getStatusLabel(progress),
    };
  });
}

function buildGoalSummary(goals: GoalWithProgress[]) {
  const totalTarget = goals.reduce((sum, goal) => sum + goal.targetAmount, 0);
  const totalCurrent = goals.reduce((sum, goal) => sum + goal.currentAmount, 0);
  const totalMonthlyContribution = goals.reduce(
    (sum, goal) => sum + goal.monthlyContribution,
    0
  );
  const combinedProgress = clampPercent(totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0);
  return {
    totalTarget,
    totalCurrent,
    totalRemaining: Math.max(totalTarget - totalCurrent, 0),
    totalMonthlyContribution,
    combinedProgress,
  };
}

function chooseFocusGoal(goals: GoalWithProgress[]) {
  if (goals.length === 0) return undefined;
  const highPriority = goals
    .filter((goal) => goal.priority.toLowerCase() === "high" && goal.progress < 100)
    .sort((a, b) => a.progress - b.progress);
  if (highPriority[0]) return highPriority[0];

  const highestMonthly = [...goals].sort(
    (a, b) => b.monthlyContribution - a.monthlyContribution
  )[0];
  if (highestMonthly && highestMonthly.monthlyContribution > 0) return highestMonthly;

  return [...goals].sort((a, b) => b.progress - a.progress)[0];
}

function buildDistribution(goals: GoalWithProgress[]): GoalProgressDistributionCounts {
  return goals.reduce<GoalProgressDistributionCounts>(
    (counts, goal) => {
      if (goal.progress >= 90) counts.nearlyComplete += 1;
      else if (goal.progress >= 60) counts.advanced += 1;
      else if (goal.progress >= 25) counts.building += 1;
      else counts.early += 1;
      return counts;
    },
    { early: 0, building: 0, advanced: 0, nearlyComplete: 0 }
  );
}

function buildFocusReason(goal?: GoalWithProgress) {
  if (!goal) {
    return "No goal records are available yet, so INARI cannot identify a planning focus.";
  }
  if (goal.priority.toLowerCase() === "high" && goal.progress < 100) {
    return `${formatTitle(goal.goalType)} is a high-priority goal with ${formatCurrencyINR(goal.remainingAmount)} still remaining.`;
  }
  if (goal.monthlyContribution > 0) {
    return `${formatTitle(goal.goalType)} currently has the largest monthly contribution requirement among available goals.`;
  }
  return `${formatTitle(goal.goalType)} is closest to completion based on current funded percentage.`;
}

function getPriorityRank(priority: string) {
  return priorityRank[priority.toLowerCase()] ?? 99;
}

function getStatusLabel(progress: number) {
  if (progress >= 90) return "Nearly complete";
  if (progress >= 60) return "Advanced";
  if (progress >= 25) return "Building";
  return "Early stage";
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function safeNumber(value: number | null | undefined) {
  return Number.isFinite(value) ? Number(value) : 0;
}
