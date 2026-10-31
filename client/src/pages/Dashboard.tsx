import inariLogo from "@/assets/inari/inari-logo.svg";
import { DashboardNavbar, type DashboardNavLink } from "@/components/layout/DashboardNavbar";
import { AlertCard } from "@/components/wealth/AlertCard";
import { EmptyState } from "@/components/wealth/EmptyState";
import { ErrorState } from "@/components/wealth/ErrorState";
import { FinancialMetricCard } from "@/components/wealth/FinancialMetricCard";
import { GoalCard } from "@/components/wealth/GoalCard";
import { HealthScoreCard } from "@/components/wealth/HealthScoreCard";
import { LoadingSkeleton } from "@/components/wealth/LoadingSkeleton";
import { ProfileHero } from "@/components/wealth/ProfileHero";
import { QuickActionRail, type QuickAction } from "@/components/wealth/QuickActionRail";
import { RecommendationCard } from "@/components/wealth/RecommendationCard";
import { SectionHeader } from "@/components/wealth/SectionHeader";
import { TransactionList } from "@/components/wealth/TransactionList";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { DemoNotice, ModeBanner, appLinks } from "@/components/inari/kit";
import { CoveragePanel, SubscriptionsPanel, TrendPanel } from "@/components/inari/panels";
import {
  formatCompactCurrencyINR,
  formatCurrencyINR,
  formatPercentage,
  formatTitle,
} from "@/lib/formatters";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  AlertTriangle,
  BadgeCheck,
  Bell,
  Bot,
  CircleDollarSign,
  CreditCard,
  Goal,
  Landmark,
  Lightbulb,
  LogOut,
  PiggyBank,
  ReceiptText,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

const dashboardLinks: DashboardNavLink[] = appLinks("/dashboard");

const quickActions: QuickAction[] = [
  {
    label: "Import statement",
    description: "CSV, PDF or SMS",
    href: "/import",
    icon: ReceiptText,
  },
  {
    label: "View spending",
    description: "Open cashflow detail",
    href: "/spending",
    icon: ReceiptText,
  },
  {
    label: "Review goals",
    description: "Track progress",
    href: "/goals",
    icon: Target,
  },
  {
    label: "Recommendations",
    description: "See next actions",
    href: "/recommendations",
    icon: Lightbulb,
  },
  {
    label: "Ask advisor",
    description: "Open INARI Advisor",
    href: "/avatar",
    icon: Bot,
  },
];

export default function Dashboard() {
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const profilesQuery = trpc.profiles.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const activeProfileQuery = trpc.profiles.getActive.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchOnWindowFocus: false,
  });
  const dashboardQuery = trpc.dashboard.getSummary.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const wealthContextQuery = trpc.wealth.getContext.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const predictionsQuery = trpc.wealth.getPredictions.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const goalsQuery = trpc.goals.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const inariGoalsQuery = trpc.inari.getGoals.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const alertsQuery = trpc.alerts.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const transactionsQuery = trpc.transactions.recent.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const eventTimelineQuery = trpc.wealth.getEventTimeline.useQuery(
    { limit: 3 },
    { enabled: isAuthenticated }
  );
  const notificationsQuery = trpc.wealth.getNotifications.useQuery(
    { limit: 3, status: "unread" },
    { enabled: isAuthenticated }
  );

  const setActiveProfileMutation = trpc.profiles.setActive.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.profiles.getActive.invalidate(),
        utils.dashboard.getSummary.invalidate(),
        utils.wealth.getContext.invalidate(),
        utils.wealth.getPredictions.invalidate(),
        utils.goals.list.invalidate(),
        utils.alerts.list.invalidate(),
        utils.transactions.recent.invalidate(),
        utils.wealth.getEventTimeline.invalidate(),
        utils.wealth.getNotifications.invalidate(),
      ]);
    },
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/");
  }, [authLoading, isAuthenticated, setLocation]);

  const profileOptions = useMemo(
    () =>
      (profilesQuery.data ?? []).map((profile) => ({
        id: profile.id,
        label: profile.name,
      })),
    [profilesQuery.data]
  );

  const isPrimaryLoading =
    authLoading ||
    activeProfileQuery.isLoading ||
    dashboardQuery.isLoading ||
    wealthContextQuery.isLoading;
  const isSwitchingProfile = setActiveProfileMutation.isPending;
  const hasPrimaryError =
    dashboardQuery.isError ||
    wealthContextQuery.isError ||
    activeProfileQuery.isError ||
    profilesQuery.isError;

  const retryDashboard = async () => {
    await Promise.all([
      profilesQuery.refetch(),
      activeProfileQuery.refetch(),
      dashboardQuery.refetch(),
      wealthContextQuery.refetch(),
      predictionsQuery.refetch(),
      goalsQuery.refetch(),
      alertsQuery.refetch(),
      transactionsQuery.refetch(),
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
      <DashboardFrame
        userName={user?.name ?? "Demo User"}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        onLogout={handleLogout}
      >
        <LoadingSkeleton variant="page-section" />
      </DashboardFrame>
    );
  }

  if (!isAuthenticated) return null;

  if (hasPrimaryError) {
    return (
      <DashboardFrame
        userName={user?.name ?? "Demo User"}
        profileOptions={profileOptions}
        activeProfileId={activeProfileQuery.data?.id ?? null}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        onProfileChange={handleProfileChange}
        onLogout={handleLogout}
      >
        <ErrorState
          title="Dashboard could not load"
          message="We could not load the dashboard safely. Retry the demo data request or check local app configuration."
          onRetry={retryDashboard}
        />
      </DashboardFrame>
    );
  }

  if (profilesQuery.data && profilesQuery.data.length === 0) {
    return (
      <DashboardFrame
        userName={user?.name ?? "Demo User"}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        onLogout={handleLogout}
      >
        <EmptyState
          title="No demo profiles available"
          description="Add or seed a demo profile to populate the INARI dashboard."
        />
      </DashboardFrame>
    );
  }

  const data = dashboardQuery.data;
  const wealth = wealthContextQuery.data;

  if (isPrimaryLoading || !data || !wealth || isSwitchingProfile) {
    return (
      <DashboardFrame
        userName={user?.name ?? "Demo User"}
        profileLabel={activeProfileQuery.data?.name ?? "Loading profile"}
        profileOptions={profileOptions}
        activeProfileId={activeProfileQuery.data?.id ?? null}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        onProfileChange={handleProfileChange}
        onLogout={handleLogout}
        profileSwitchDisabled
      >
        <LoadingSkeleton variant="page-section" />
      </DashboardFrame>
    );
  }

  const predictions = predictionsQuery.data;
  const importedNow = (dashboardQuery.data as { dataSource?: string } | undefined)?.dataSource === "imported";
  const goals = importedNow
    ? (inariGoalsQuery.data?.items ?? []).map((g) => ({
        id: g.id,
        goalType: g.name,
        targetAmount: g.targetAmount,
        currentAmount: g.currentAmount,
        priority: g.priority,
        monthlyContribution: g.monthlyContribution ?? 0,
      }))
    : (goalsQuery.data ?? []);
  const alerts = alertsQuery.data ?? [];
  const transactions = (transactionsQuery.data ?? []).slice(0, 5);
  const timeline = eventTimelineQuery.data ?? [];
  const notifications = notificationsQuery.data ?? [];
  const profile = data.profile;
  const imported = (data as { dataSource?: string }).dataSource === "imported";
  const unknownHealth = new Set<string>((data.financialHealth as { unknownComponents?: string[] } | null)?.unknownComponents ?? []);
  const topInsight = wealth.insights[0];
  const topAlert =
    wealth.alerts.find((alert) => alert.severity === "high") ??
    wealth.alerts.find((alert) => alert.severity === "medium") ??
    wealth.alerts[0];
  const nextBestAction =
    topAlert?.suggestedAction ??
    wealth.recommendations[0]?.nextAction ??
    wealth.insights[0]?.suggestedAction ??
    "Review your spending, goals, and recommendations this month.";

  return (
    <DashboardFrame
      userName={user?.name ?? "Demo User"}
      profileLabel={imported ? "Your imported data" : profile.name}
      profileOptions={imported ? [] : profileOptions}
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
        <ProfileHero
          profileName={profile.name}
          occupation={profile.occupation}
          riskProfile={wealth.riskProfile.profile ?? profile.riskProfile}
          summary={`Your monthly surplus is ${formatCurrencyINR(wealth.monthlySurplus)} with a ${formatPercentage(data.savingsRate)} savings rate.`}
          insight={topInsight?.title ?? nextBestAction}
          healthScore={data.financialHealth?.overallScore ?? undefined}
          biggestRisk={topAlert?.title ?? wealth.riskProfile.constraints?.[0] ?? "No high-priority risk"}
          aiRecommendation={nextBestAction}
          onAskAdvisor={() => setLocation("/avatar")}
        />

        <QuickActionRail actions={quickActions} />

        <section className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
          <HealthScoreCard
            score={data.financialHealth?.overallScore ?? 0}
            category={data.financialHealth?.category ?? "poor"}
            description={imported ? "Educational score from your imported statements. Components you have not provided (investments, debt, emergency fund) are left out, not scored as zero. Not a regulated credit score." : "Educational score based on savings, investments, debt, and emergency-fund readiness. It is not a regulated credit score."}
            projection={
              predictions
                ? `90-day projection: ${predictions.healthForecast.projected90DayScore}/100, ${predictions.healthForecast.direction}`
                : undefined
            }
            breakdown={[
              {
                label: "Savings",
                score: data.financialHealth?.savingsScore ?? 0,
                description: "Reflects current savings rate and surplus capacity.",
              },
              {
                label: "Investments",
                unknown: unknownHealth.has("investment"),
                score: data.financialHealth?.investmentScore ?? 0,
                description: "Reflects investment balance and readiness signals.",
              },
              {
                label: "Debt",
                unknown: unknownHealth.has("debt"),
                score: data.financialHealth?.debtScore ?? 0,
                description: "Reflects credit-card debt pressure.",
              },
              {
                label: "Emergency fund",
                unknown: unknownHealth.has("emergencyFund"),
                score: data.financialHealth?.emergencyFundScore ?? 0,
                description: "Reflects available emergency-fund coverage.",
              },
            ]}
          />

          <section
            className="rounded-[var(--wv-radius-card)] border border-wv-border bg-wv-surface p-5 shadow-wv-card"
            aria-labelledby="next-action-title"
          >
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-wv-primary">
              AI-guided priority
            </p>
            <h2 id="next-action-title" className="mt-3 text-xl font-bold text-wv-text">
              {nextBestAction}
            </h2>
            <p className="mt-3 text-sm leading-6 text-wv-text-secondary">
              Based on current alerts, insights, recommendations, and risk profile.
            </p>
            {predictions ? (
              <div className="mt-5 rounded-[var(--wv-radius-form)] bg-wv-background p-4">
                <p className="text-sm font-bold text-wv-text">
                  {predictions.monthlyOutlook.monthLabel} outlook
                </p>
                <p className="mt-1 text-sm leading-6 text-wv-text-secondary">
                  {predictions.monthlyOutlook.forecastSummary}
                </p>
              </div>
            ) : null}
            <Button
              asChild
              className="mt-5 min-h-11 bg-wv-accent text-white hover:bg-wv-accent-hover"
            >
              <a href="/avatar">Ask advisor why</a>
            </Button>
          </section>
        </section>

        <section aria-labelledby="metrics-heading">
          <SectionHeader
            title="Account overview"
            description={imported ? "Income, expenses and savings are calculated from your imported statements. Balances come only from what you confirm on the Spending page." : "Demo banking-style view of income, expenses, savings, investments, emergency fund, and credit-card debt."}
            headingLevel={2}
          />
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FinancialMetricCard
              title="Monthly income"
              value={formatCurrencyINR(data.monthlyIncome)}
              subtitle={imported ? "Average of your latest complete months" : "Active profile income"}
              trend="Income"
              trendDirection="up"
              icon={<Landmark className="size-5" aria-hidden="true" />}
            />
            <FinancialMetricCard
              title="Monthly expenses"
              value={formatCurrencyINR(data.monthlyExpenses)}
              subtitle={imported ? "Average of your latest complete months" : "Current monthly outflow"}
              trend="Expense"
              trendDirection="down"
              icon={<CreditCard className="size-5" aria-hidden="true" />}
            />
            <FinancialMetricCard
              title="Savings rate"
              value={formatPercentage(data.savingsRate)}
              subtitle="Share of monthly income saved"
              trend="Savings"
              trendDirection="up"
              icon={<PiggyBank className="size-5" aria-hidden="true" />}
            />
            <FinancialMetricCard
              title="Investments"
              value={data.investmentBalance === null ? "Not provided" : formatCompactCurrencyINR(data.investmentBalance)}
              subtitle={imported ? "Statements cannot show this; you can enter it" : "Investment balance in demo profile"}
              trend="Portfolio"
              trendDirection="flat"
              icon={<TrendingUp className="size-5" aria-hidden="true" />}
            />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <FinancialMetricCard
              title="Emergency fund"
              value={data.emergencyFundBalance === null ? "Not provided" : formatCurrencyINR(data.emergencyFundBalance)}
              subtitle={imported ? "Statements cannot show this; you can enter it" : "Available emergency reserve"}
              trend="Safety buffer"
              trendDirection="flat"
              icon={<ShieldCheck className="size-5" aria-hidden="true" />}
            />
            <FinancialMetricCard
              title="Credit-card debt"
              value={data.creditCardDebt === null ? "Not provided" : formatCurrencyINR(data.creditCardDebt)}
              subtitle="Debt to monitor before increasing risk"
              trend="Liability"
              trendDirection={(data.creditCardDebt ?? 0) > 0 ? "down" : "flat"}
              icon={<TrendingDown className="size-5" aria-hidden="true" />}
            />
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section aria-labelledby="recommendations-heading">
            <SectionHeader
              title="Recommendations preview"
              description={imported ? "Top recommendations from your imported spending, with the reasons shown." : "Top explainable recommendations from the current profile."}
              action={
                <Button asChild variant="outline" className="border-wv-border text-wv-text">
                  <a href="/recommendations">View all</a>
                </Button>
              }
            />
            <div className="mt-4 grid gap-4">
              {data.topRecommendations.length > 0 ? (
                data.topRecommendations.slice(0, 3).map((recommendation) => (
                  <RecommendationCard
                    key={`${recommendation.category}-${recommendation.recommendation}`}
                    title={recommendation.recommendation}
                    category={recommendation.category}
                    expectedBenefit={recommendation.expectedBenefit}
                    riskLevel={recommendation.riskLevel}
                    confidenceScore={recommendation.confidenceScore}
                    reasons={recommendation.reasons}
                  />
                ))
              ) : (
                <EmptyState
                  title="No recommendations yet"
                  description="Recommendations will appear when enough profile context is available."
                />
              )}
            </div>
          </section>

          <section aria-labelledby="goals-heading">
            <SectionHeader
              title="Goals preview"
              description={imported ? "Goals you have created. Manage them on the Goals page." : "Priority goals from the active profile."}
              action={
                <Button asChild variant="outline" className="border-wv-border text-wv-text">
                  <a href="/goals">View all goals</a>
                </Button>
              }
            />
            <div className="mt-4 grid gap-4">
              {goals.length > 0 ? (
                goals.slice(0, 3).map((goal) => (
                  <GoalCard
                    key={goal.id}
                    title={goal.goalType}
                    currentAmount={goal.currentAmount}
                    targetAmount={goal.targetAmount}
                    priority={goal.priority}
                    monthlyContribution={goal.monthlyContribution}
                  />
                ))
              ) : (
                <EmptyState
                  title="No goals available"
                  description={imported ? "You have not created a goal yet. Add one on the Goals page; INARI only uses amounts you enter." : "Goal cards will appear when the active profile has goal data."}
                />
              )}
            </div>
          </section>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <section aria-labelledby="alerts-heading">
            <SectionHeader
              title="Alerts"
              description={imported ? "Signals found in your imported data." : "Important profile signals to review."}
            />
            <div className="mt-4 grid gap-4">
              {alerts.length > 0 ? (
                alerts.slice(0, 3).map((alert) => (
                  <AlertCard
                    key={alert.id}
                    title={alert.title}
                    message={alert.message}
                    severity={alert.severity}
                    isRead={alert.isRead}
                    createdAt={alert.createdAt}
                  />
                ))
              ) : (
                <EmptyState
                  icon={<Bell className="size-6" aria-hidden="true" />}
                  title="No active financial alerts"
                  description="There are no current dashboard alerts for this profile."
                />
              )}
            </div>
          </section>

          <section aria-labelledby="transactions-heading">
            <SectionHeader
              title="Recent transactions"
              description={imported ? "Most recent transactions from your imported statements." : "Latest activity from the active demo profile."}
            />
            <div className="mt-4">
              {transactions.length > 0 ? (
                <TransactionList transactions={transactions} />
              ) : (
                <EmptyState
                  title="No recent transactions"
                  description="Transactions will appear when data exists for the active profile."
                />
              )}
            </div>
          </section>
        </div>

        {imported ? (
          <div className="grid gap-6 xl:grid-cols-2">
            <TrendPanel />
            <div className="space-y-6">
              <CoveragePanel />
            </div>
            <div className="xl:col-span-2">
              <SubscriptionsPanel />
            </div>
          </div>
        ) : (
          <section className="rounded-[var(--wv-radius-card)] border border-wv-border bg-wv-surface p-5 shadow-wv-card">
            <h2 className="font-display text-lg font-bold">Use your own statements</h2>
            <p className="mt-1 text-sm text-wv-text-secondary">You are looking at a fictional persona. Import a CSV, digital PDF or SMS alerts (synthetic data only) and INARI will rebuild this dashboard, spending, goals, recommendations and advisor from your ledger.</p>
            <Button asChild className="mt-3 bg-wv-accent text-white hover:bg-wv-accent-hover"><a href="/import">Open the Import Center</a></Button>
          </section>
        )}

        {!imported ? <section className="grid gap-4 lg:grid-cols-3" aria-label="Secondary dashboard signals">
          <SecondaryPanel
            title="Savings streak"
            value={`${data.savingsStreak} months`}
            description="A lightweight habit signal from the demo profile."
            icon={<BadgeCheck className="size-5" aria-hidden="true" />}
          />
          <SecondaryPanel
            title="Badges"
            value={`${data.badges.length}`}
            description={
              data.badges[0]?.title ??
              "Badges appear when the active profile has achievement data."
            }
            icon={<Goal className="size-5" aria-hidden="true" />}
          />
          <SecondaryPanel
            title="Activity and notifications"
            value={`${timeline.length + notifications.length}`}
            description="Latest event and unread-notification signals loaded for this session."
            icon={<AlertTriangle className="size-5" aria-hidden="true" />}
          />
        </section> : null}

        <footer className="flex flex-col gap-3 border-t border-wv-border pt-5 text-xs leading-5 text-wv-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            INARI provides educational financial insights and does not guarantee
            financial or investment outcomes.
          </p>
          <a
            href="/support"
            className="font-semibold text-wv-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wv-primary focus-visible:ring-offset-2"
          >
            Support
          </a>
        </footer>
      </div>
    </DashboardFrame>
  );
}

function DashboardFrame({
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
        links={dashboardLinks}
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
      <main className="mx-auto max-w-[var(--wv-content-width)] px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}

function SecondaryPanel({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <article className="rounded-[var(--wv-radius-card)] border border-wv-border bg-wv-surface p-5 shadow-wv-card transition-all duration-300 hover:-translate-y-0.5 hover:border-wv-primary/20 hover:shadow-[0_26px_74px_-54px_rgba(12,133,119,0.58)]">
      <div className="flex items-start gap-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-wv-background text-wv-primary">
          {icon}
        </div>
        <div>
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-wv-text-secondary">{title}</h2>
          <p className="mt-1 font-display text-[var(--wv-metric-number)] font-extrabold leading-none tracking-[-0.03em] text-wv-text tabular-nums">{value}</p>
          <p className="mt-2 text-[15px] font-normal leading-6 text-wv-text-secondary">
            {description}
          </p>
        </div>
      </div>
    </article>
  );
}
