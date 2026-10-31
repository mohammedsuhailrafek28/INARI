import inariLogo from "@/assets/inari/inari-logo.svg";
import { DashboardNavbar, type DashboardNavLink } from "@/components/layout/DashboardNavbar";
import { SavingsOpportunityCard } from "@/components/spending/SavingsOpportunityCard";
import { SpendingBreakdownChart, type SpendingCategoryDatum } from "@/components/spending/SpendingBreakdownChart";
import { SpendingCategoryList } from "@/components/spending/SpendingCategoryList";
import { SpendingInsightCard } from "@/components/spending/SpendingInsightCard";
import { UnusualExpenseCard } from "@/components/spending/UnusualExpenseCard";
import { EmptyState } from "@/components/wealth/EmptyState";
import { ErrorState } from "@/components/wealth/ErrorState";
import { FinancialMetricCard } from "@/components/wealth/FinancialMetricCard";
import { LoadingSkeleton } from "@/components/wealth/LoadingSkeleton";
import { SectionHeader } from "@/components/wealth/SectionHeader";
import { TransactionList } from "@/components/wealth/TransactionList";
import { Button } from "@/components/ui/button";
import {
  formatCurrencyINR,
  formatPercentage,
  formatTitle,
} from "@/lib/formatters";
import { trpc } from "@/lib/trpc";
import { DemoNotice, ModeBanner, appLinks, useInariMode } from "@/components/inari/kit";
import { BalancesPanel, ClaimsPanel, ManualEntryPanel, SubscriptionsPanel, TransactionReview } from "@/components/inari/panels";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  AlertTriangle,
  CircleDollarSign,
  Layers3,
  Lightbulb,
  ReceiptText,
  TrendingDown,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

const spendingLinks: DashboardNavLink[] = appLinks("/spending");

const categoryColors = [
  "#0c8577",
  "#f4791f",
  "#3b82f6",
  "#12a394",
  "#e0a63c",
  "#7b8b88",
  "#d94b4b",
];

export default function SpendingInsights() {
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
  const breakdownQuery = trpc.spending.getBreakdown.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const unusualQuery = trpc.spending.getUnusual.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const opportunitiesQuery = trpc.spending.getOpportunities.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const transactionsQuery = trpc.transactions.recent.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const setActiveProfileMutation = trpc.profiles.setActive.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.profiles.getActive.invalidate(),
        utils.spending.getBreakdown.invalidate(),
        utils.spending.getUnusual.invalidate(),
        utils.spending.getOpportunities.invalidate(),
        utils.transactions.recent.invalidate(),
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

  const categories = useMemo<SpendingCategoryDatum[]>(() => {
    const entries = Object.entries(breakdownQuery.data ?? {})
      .map(([name, amount]) => ({ name, amount: Number(amount) || 0 }))
      .filter((category) => category.amount > 0)
      .sort((a, b) => b.amount - a.amount);
    const total = entries.reduce((sum, category) => sum + category.amount, 0);

    return entries.map((category, index) => ({
      ...category,
      percentage: total > 0 ? (category.amount / total) * 100 : 0,
      color: categoryColors[index % categoryColors.length],
    }));
  }, [breakdownQuery.data]);

  const snapshotQuery = trpc.inari.getSnapshot.useQuery(undefined, { enabled: isAuthenticated && mode.imported });
  const categorySum = categories.reduce((sum, category) => sum + category.amount, 0);
  // imported mode: the exact ledger figure, not a sum of per-category rounded averages
  const totalSpend = mode.imported && snapshotQuery.data?.monthlyExpenses != null ? snapshotQuery.data.monthlyExpenses : categorySum;
  const topCategory = categories[0];
  const opportunities = opportunitiesQuery.data ?? [];
  const totalOpportunity = opportunities.reduce((sum, item) => sum + item.amount, 0);
  const unusual = unusualQuery.data ?? [];
  const recentExpenses = (transactionsQuery.data ?? [])
    .filter((transaction) => transaction.type === "expense")
    .slice(0, 6);
  const largestUnusual = [...unusual].sort((a, b) => b.amount - a.amount)[0];
  const largestOpportunity = opportunities[0];

  const profileLabel = mode.imported ? "Your imported data" : activeProfileQuery.data?.name;
  const isPrimaryLoading =
    authLoading ||
    activeProfileQuery.isLoading ||
    breakdownQuery.isLoading ||
    setActiveProfileMutation.isPending;
  const hasPrimaryError =
    profilesQuery.isError || activeProfileQuery.isError || breakdownQuery.isError;

  const retry = async () => {
    await Promise.all([
      profilesQuery.refetch(),
      activeProfileQuery.refetch(),
      breakdownQuery.refetch(),
      unusualQuery.refetch(),
      opportunitiesQuery.refetch(),
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
      <SpendingFrame
        userName={user?.name ?? "Demo User"}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        onLogout={handleLogout}
      >
        <LoadingSkeleton variant="page-section" />
      </SpendingFrame>
    );
  }

  if (!isAuthenticated) return null;

  if (hasPrimaryError) {
    return (
      <SpendingFrame
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
          title="Spending data could not load"
          message="We could not load category spending safely. Retry the demo data request or check local app configuration."
          onRetry={retry}
        />
      </SpendingFrame>
    );
  }

  if (isPrimaryLoading) {
    return (
      <SpendingFrame
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
      </SpendingFrame>
    );
  }

  const focusInsight = buildFocusInsight({
    largestOpportunity,
    largestUnusual,
    topCategory,
  });

  return (
    <SpendingFrame
      userName={user?.name ?? "Demo User"}
      profileLabel={profileLabel}
      profileOptions={profileOptions}
      activeProfileId={activeProfileQuery.data?.id ?? null}
      mobileMenuOpen={mobileMenuOpen}
      setMobileMenuOpen={setMobileMenuOpen}
      onProfileChange={handleProfileChange}
      onLogout={handleLogout}
      profileSwitchDisabled={setActiveProfileMutation.isPending}
    >
      <div className="space-y-6">
        <ModeBanner />
        <DemoNotice />
        <section className="rounded-[var(--wv-radius-card)] border border-wv-border bg-wv-surface p-5 shadow-wv-card sm:p-6">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-wv-primary">
                Spending analysis
              </p>
              <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-wv-text sm:text-3xl">
                Spending Insights
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-wv-text-secondary sm:text-base">
                Understand where your money goes and which changes could improve
                your monthly position.
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
                <a href="/avatar">Ask advisor</a>
              </Button>
            </div>
          </div>
        </section>

        <section>
          <SectionHeader
            title="Monthly spending summary"
            description={mode.imported ? "Average per month over your latest complete months, from your ledger. Credit-card repayments and refunds are handled by the reconciliation rules." : "Totals are derived from returned transaction categories and spending endpoints."}
          />
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <FinancialMetricCard
              title="Total expenses"
              value={formatCurrencyINR(totalSpend)}
              subtitle="Sum of category totals"
              trend="Expense"
              trendDirection="down"
              icon={<CircleDollarSign className="size-5" aria-hidden="true" />}
            />
            <FinancialMetricCard
              title="Largest category"
              value={topCategory ? formatTitle(topCategory.name) : "None"}
              subtitle={
                topCategory
                  ? `${formatPercentage(topCategory.percentage)} of spending`
                  : "No category data"
              }
              trend="Top category"
              icon={<Layers3 className="size-5" aria-hidden="true" />}
            />
            <FinancialMetricCard
              title="Category count"
              value={String(categories.length)}
              subtitle="Expense categories returned"
              trend="Breakdown"
              icon={<WalletCards className="size-5" aria-hidden="true" />}
            />
            <FinancialMetricCard
              title="Unusual expenses"
              value={String(unusual.length)}
              subtitle="Large expense signals"
              trend="Review"
              trendDirection={unusual.length > 0 ? "down" : "flat"}
              icon={<AlertTriangle className="size-5" aria-hidden="true" />}
            />
            <FinancialMetricCard
              title="Savings opportunity"
              value={formatCurrencyINR(totalOpportunity)}
              subtitle="Estimated monthly adjustment"
              trend="Estimate"
              trendDirection="up"
              icon={<TrendingDown className="size-5" aria-hidden="true" />}
            />
          </div>
        </section>

        {categories.length === 0 ? (
          <EmptyState
            title="No spending category data"
            description="The active profile does not have spending categories available yet."
          />
        ) : (
          <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <SpendingBreakdownChart categories={categories} total={totalSpend} />
            <SpendingCategoryList categories={categories} />
          </section>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          <SpendingInsightCard
            eyebrow="Distribution insight"
            title={
              topCategory
                ? `${formatTitle(topCategory.name)} leads current spending`
                : "No dominant category yet"
            }
            description={
              topCategory
                ? `${formatTitle(topCategory.name)} represents ${formatPercentage(topCategory.percentage)} of recorded expenses. This is a presentation insight derived from category totals.`
                : "Spending category data is not available for this profile yet."
            }
            icon={ReceiptText}
          />
          <SpendingInsightCard
            eyebrow="Focus"
            title={focusInsight.title}
            description={focusInsight.description}
            icon={Lightbulb}
            tone={focusInsight.tone}
            className="lg:col-span-2"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <section>
            <SectionHeader
              title="Unusual expenses"
              description="Expenses shown here are significantly above this profile's typical expense amount."
            />
            <div className="mt-4 grid gap-4">
              {unusualQuery.isError ? (
                <ErrorState
                  title="Unusual expenses could not load"
                  message="The main spending analysis is available, but unusual expense signals could not be loaded."
                  onRetry={() => unusualQuery.refetch()}
                />
              ) : unusual.length > 0 ? (
                unusual.map((item) => (
                  <UnusualExpenseCard
                    key={`${item.date}-${item.description}-${item.amount}`}
                    description={item.description}
                    category={item.category}
                    amount={item.amount}
                    date={item.date}
                  />
                ))
              ) : (
                <EmptyState
                  title="No unusually large expenses"
                  description="No unusually large expenses were detected in the available transaction data."
                />
              )}
            </div>
          </section>

          <section>
            <SectionHeader
              title="Savings opportunities"
              description="Estimated adjustments from the existing savings-opportunity engine."
            />
            <div className="mt-4 grid gap-4">
              {opportunitiesQuery.isError ? (
                <ErrorState
                  title="Savings opportunities could not load"
                  message="The main spending analysis is available, but opportunity estimates could not be loaded."
                  onRetry={() => opportunitiesQuery.refetch()}
                />
              ) : opportunities.length > 0 ? (
                opportunities.map((item, index) => (
                  <SavingsOpportunityCard
                    key={`${item.category}-${item.amount}`}
                    category={item.category}
                    amount={item.amount}
                    suggestion={item.suggestion}
                    priority={index === 0 ? "high" : index === 1 ? "medium" : "low"}
                  />
                ))
              ) : (
                <EmptyState
                  title="No savings opportunities detected"
                  description="The current profile did not return estimated savings opportunities."
                />
              )}
            </div>
          </section>
        </div>

        <section>
          <SectionHeader
            title="Recent expense activity"
            description={mode.imported ? "Latest expense transactions from your imported statements." : "Latest expense transactions from the active demo profile."}
          />
          <div className="mt-4">
            {transactionsQuery.isError ? (
              <ErrorState
                title="Recent transactions could not load"
                message="Spending categories are available, but recent transaction activity could not be loaded."
                onRetry={() => transactionsQuery.refetch()}
              />
            ) : recentExpenses.length > 0 ? (
              <TransactionList transactions={recentExpenses} />
            ) : (
              <EmptyState
                title="No recent expenses"
                description="No recent expense transactions are available for this profile."
              />
            )}
          </div>
        </section>

        {mode.imported ? (
          <div className="space-y-6" data-testid="inari-spending-tools">
            <TransactionReview />
            <div className="grid gap-6 xl:grid-cols-2">
              <ManualEntryPanel />
              <BalancesPanel />
            </div>
            <SubscriptionsPanel />
            <ClaimsPanel />
          </div>
        ) : (
          <section className="rounded-[var(--wv-radius-card)] border border-wv-border bg-wv-surface p-5 shadow-wv-card">
            <h2 className="font-display text-lg font-bold">Review and correct your own transactions</h2>
            <p className="mt-1 text-sm text-wv-text-secondary">Transaction review, category corrections, reconciliation, recurring payments, cash entries and refund tracking work on your imported ledger. <a className="font-semibold underline" href="/import">Import a statement</a> to use them.</p>
          </section>
        )}

        <footer className="border-t border-wv-border pt-5 text-xs leading-5 text-wv-muted">
          Spending insights are educational estimates based on available demo
          transaction data. They do not guarantee savings outcomes.
        </footer>
      </div>
    </SpendingFrame>
  );
}

function SpendingFrame({
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
        links={spendingLinks}
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

function buildFocusInsight({
  largestOpportunity,
  largestUnusual,
  topCategory,
}: {
  largestOpportunity?: { category: string; amount: number; suggestion: string };
  largestUnusual?: { description: string; amount: number; category: string };
  topCategory?: SpendingCategoryDatum;
}) {
  if (largestOpportunity) {
    return {
      title: `${formatTitle(largestOpportunity.category)} offers the clearest savings estimate`,
      description: `${formatCurrencyINR(largestOpportunity.amount)} is the largest available estimated monthly adjustment from the savings-opportunity engine.`,
      tone: "primary" as const,
    };
  }

  if (largestUnusual) {
    return {
      title: `Review ${largestUnusual.description}`,
      description: `${formatCurrencyINR(largestUnusual.amount)} in ${formatTitle(largestUnusual.category)} is the largest unusual expense returned for this profile.`,
      tone: "warning" as const,
    };
  }

  if (topCategory) {
    return {
      title: `Start with ${formatTitle(topCategory.name)}`,
      description: `${formatTitle(topCategory.name)} is the largest category, representing ${formatPercentage(topCategory.percentage)} of recorded expenses.`,
      tone: "primary" as const,
    };
  }

  return {
    title: "Review spending once data is available",
    description: "No category, unusual expense, or opportunity data is available for this profile yet.",
    tone: "primary" as const,
  };
}
