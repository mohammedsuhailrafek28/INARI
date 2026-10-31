import inariLogo from "@/assets/inari/inari-logo.svg";
import { DashboardNavbar, type DashboardNavLink } from "@/components/layout/DashboardNavbar";
import { PriorityRecommendation } from "@/components/recommendations/PriorityRecommendation";
import {
  RecommendationFilters,
  type RecommendationSort,
} from "@/components/recommendations/RecommendationFilters";
import {
  RecommendationGroup,
  type RecommendationGroupItem,
} from "@/components/recommendations/RecommendationGroup";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/wealth/EmptyState";
import { ErrorState } from "@/components/wealth/ErrorState";
import { FinancialMetricCard } from "@/components/wealth/FinancialMetricCard";
import { LoadingSkeleton } from "@/components/wealth/LoadingSkeleton";
import { SectionHeader } from "@/components/wealth/SectionHeader";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  formatPercentage,
  formatTitle,
  normalizeFinancialText,
} from "@/lib/formatters";
import { trpc } from "@/lib/trpc";
import { DemoNotice, ModeBanner, appLinks, useInariMode } from "@/components/inari/kit";
import { EmiPanel, ReportPanel, SubscriptionsPanel, WhatIfPanel } from "@/components/inari/panels";
import {
  BarChart3,
  Gauge,
  Lightbulb,
  ListChecks,
  ShieldAlert,
  Tags,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

type Recommendation = {
  recommendation: string;
  expectedBenefit: string;
  riskLevel: string;
  confidenceScore: number;
  reasons: string[];
  category: string;
};

type RecommendationViewModel = RecommendationGroupItem & {
  originalIndex: number;
  normalizedRisk: string;
};

const recommendationLinks: DashboardNavLink[] = appLinks("/recommendations");

export default function Recommendations() {
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const mode = useInariMode();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedRisk, setSelectedRisk] = useState("all");
  const [sort, setSort] = useState<RecommendationSort>("priority");

  const profilesQuery = trpc.profiles.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const activeProfileQuery = trpc.profiles.getActive.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchOnWindowFocus: false,
  });
  const recommendationsQuery = trpc.recommendations.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const setActiveProfileMutation = trpc.profiles.setActive.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.profiles.getActive.invalidate(),
        utils.recommendations.list.invalidate(),
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

  const recommendations = useMemo(
    () => normalizeRecommendations(recommendationsQuery.data ?? []),
    [recommendationsQuery.data]
  );
  const categories = useMemo(
    () => Array.from(new Set(recommendations.map((rec) => rec.category))).sort(),
    [recommendations]
  );
  const risks = useMemo(
    () => Array.from(new Set(recommendations.map((rec) => rec.normalizedRisk))).sort(),
    [recommendations]
  );
  const summary = useMemo(() => buildSummary(recommendations), [recommendations]);
  const filteredRecommendations = useMemo(
    () =>
      sortRecommendations(
        recommendations.filter((recommendation) => {
          const categoryMatch =
            selectedCategory === "all" || recommendation.category === selectedCategory;
          const riskMatch =
            selectedRisk === "all" || recommendation.normalizedRisk === selectedRisk;
          return categoryMatch && riskMatch;
        }),
        sort
      ),
    [recommendations, selectedCategory, selectedRisk, sort]
  );
  const groupedRecommendations = useMemo(
    () => groupByCategory(filteredRecommendations),
    [filteredRecommendations]
  );
  const priorityRecommendation = useMemo(
    () => choosePriorityRecommendation(recommendations),
    [recommendations]
  );

  const profileLabel = mode.imported ? "Your imported data" : activeProfileQuery.data?.name;
  const isSwitchingProfile = setActiveProfileMutation.isPending;
  const isPrimaryLoading =
    authLoading ||
    activeProfileQuery.isLoading ||
    recommendationsQuery.isLoading ||
    isSwitchingProfile;
  const hasPrimaryError =
    profilesQuery.isError || activeProfileQuery.isError || recommendationsQuery.isError;

  const retry = async () => {
    await Promise.all([
      profilesQuery.refetch(),
      activeProfileQuery.refetch(),
      recommendationsQuery.refetch(),
    ]);
  };

  const resetFilters = () => {
    setSelectedCategory("all");
    setSelectedRisk("all");
    setSort("priority");
  };

  const handleProfileChange = (profileId: number) => {
    if (!profileId || profileId === activeProfileQuery.data?.id) return;
    setSelectedCategory("all");
    setSelectedRisk("all");
    setSort("priority");
    setActiveProfileMutation.mutate({ demoProfileId: profileId });
  };

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  if (authLoading) {
    return (
      <RecommendationFrame
        userName={user?.name ?? "Demo User"}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        onLogout={handleLogout}
      >
        <LoadingSkeleton variant="page-section" />
      </RecommendationFrame>
    );
  }

  if (!isAuthenticated) return null;

  if (hasPrimaryError) {
    return (
      <RecommendationFrame
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
          title="Recommendations could not load"
          message="We could not load recommendations safely. Retry the demo data request or check local app configuration."
          onRetry={retry}
        />
      </RecommendationFrame>
    );
  }

  if (isPrimaryLoading) {
    return (
      <RecommendationFrame
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
      </RecommendationFrame>
    );
  }

  return (
    <RecommendationFrame
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
        <section className="rounded-[var(--wv-radius-card)] border border-wv-border bg-wv-surface p-5 shadow-wv-card sm:p-6">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-wv-primary">
                Financial guidance
              </p>
              <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-wv-text sm:text-3xl">
                Recommendations
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-wv-text-secondary sm:text-base">
                Review the guidance generated from your current financial profile
                and understand why each suggestion appears.
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
                <a href="/avatar">Ask the advisor</a>
              </Button>
            </div>
          </div>
        </section>

        <section>
          <SectionHeader
            title="Recommendation summary"
            description="Summary values are calculated from active-profile recommendation records."
          />
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <FinancialMetricCard
              title="Active recommendations"
              value={String(recommendations.length)}
              subtitle="Returned for this profile"
              trend="Guidance"
              icon={<Lightbulb className="size-5" aria-hidden="true" />}
            />
            <FinancialMetricCard
              title="High risk"
              value={String(summary.highRiskCount)}
              subtitle="Risk context labelled high"
              trend="Review"
              trendDirection={summary.highRiskCount > 0 ? "down" : "flat"}
              icon={<ShieldAlert className="size-5" aria-hidden="true" />}
            />
            <FinancialMetricCard
              title="Average confidence"
              value={formatPercentage(summary.averageConfidence)}
              subtitle="Rule-match strength"
              trend="Confidence"
              icon={<Gauge className="size-5" aria-hidden="true" />}
            />
            <FinancialMetricCard
              title="Categories"
              value={String(summary.categoryCount)}
              subtitle="Distinct recommendation categories"
              trend="Grouped"
              icon={<Tags className="size-5" aria-hidden="true" />}
            />
            <FinancialMetricCard
              title="Top category"
              value={formatTitle(summary.topCategory)}
              subtitle="Most common category"
              trend="Focus"
              icon={<BarChart3 className="size-5" aria-hidden="true" />}
            />
          </div>
        </section>

        {recommendations.length === 0 ? (
          <EmptyState
            title="No active recommendations are available for this profile"
            description="Recommendations will appear when enough profile data matches the recommendation rules."
          />
        ) : (
          <>
            <PriorityRecommendation
              title={priorityRecommendation?.title}
              expectedBenefit={priorityRecommendation?.expectedBenefit}
              category={priorityRecommendation?.category}
              riskLevel={priorityRecommendation?.normalizedRisk}
              confidenceScore={priorityRecommendation?.confidenceScore}
              reason={buildPriorityReason(priorityRecommendation)}
            />

            <RecommendationFilters
              categories={categories}
              risks={risks}
              selectedCategory={selectedCategory}
              selectedRisk={selectedRisk}
              sort={sort}
              onCategoryChange={setSelectedCategory}
              onRiskChange={setSelectedRisk}
              onSortChange={setSort}
              onReset={resetFilters}
            />

            {filteredRecommendations.length === 0 ? (
              <EmptyState
                title="No recommendations match the selected filters"
                description="Reset filters to see all active recommendations for this profile."
                action={{
                  label: "Reset filters",
                  onClick: resetFilters,
                }}
              />
            ) : (
              <section className="space-y-6">
                <SectionHeader
                  title="Grouped recommendations"
                  description={`${filteredRecommendations.length} of ${recommendations.length} recommendations shown.`}
                />
                <div className="space-y-8">
                  {Object.entries(groupedRecommendations).map(([category, items]) => (
                    <RecommendationGroup
                      key={category}
                      category={category}
                      recommendations={items}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {mode.imported ? (
          <div className="space-y-6" data-testid="inari-plan-tools">
            <ReportPanel />
            <div className="grid gap-6 xl:grid-cols-2">
              <WhatIfPanel />
              <EmiPanel />
            </div>
            <SubscriptionsPanel />
          </div>
        ) : (
          <EmiPanel />
        )}

        <section className="rounded-[var(--wv-radius-card)] border border-wv-border bg-wv-surface p-5 shadow-wv-card">
          <div className="flex items-start gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-wv-background text-wv-primary">
              <ListChecks className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-bold text-wv-text">Guidance note</h2>
              <p className="mt-2 text-sm leading-6 text-wv-text-secondary">
                Recommendations are educational insights based on available profile
                data and do not guarantee financial or investment outcomes. Consult
                a qualified professional before making major financial decisions.
              </p>
            </div>
          </div>
        </section>
      </div>
    </RecommendationFrame>
  );
}

function RecommendationFrame({
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
        links={recommendationLinks}
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

function normalizeRecommendations(rawRecommendations: Recommendation[]): RecommendationViewModel[] {
  return rawRecommendations.map((recommendation, index) => {
    const confidenceScore = clampConfidence(recommendation.confidenceScore);
    const category = recommendation.category || "general";
    const normalizedRisk = normalizeRisk(recommendation.riskLevel);
    return {
      id: `${category}-${index}-${recommendation.recommendation}`,
      title: normalizeFinancialText(
        recommendation.recommendation || "Untitled recommendation"
      ),
      category,
      expectedBenefit: normalizeFinancialText(
        recommendation.expectedBenefit || "No expected benefit text is available."
      ),
      riskLevel: normalizedRisk,
      normalizedRisk,
      confidenceScore,
      reasons: (recommendation.reasons ?? []).map(normalizeFinancialText),
      originalIndex: index,
    };
  });
}

function buildSummary(recommendations: RecommendationViewModel[]) {
  const categoryCounts = recommendations.reduce<Record<string, number>>((counts, recommendation) => {
    counts[recommendation.category] = (counts[recommendation.category] ?? 0) + 1;
    return counts;
  }, {});
  const topCategory =
    Object.entries(categoryCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ??
    "None";
  const averageConfidence =
    recommendations.length > 0
      ? recommendations.reduce((sum, recommendation) => sum + recommendation.confidenceScore, 0) /
        recommendations.length
      : 0;
  return {
    highRiskCount: recommendations.filter((recommendation) => recommendation.normalizedRisk === "high").length,
    averageConfidence,
    categoryCount: Object.keys(categoryCounts).length,
    topCategory,
  };
}

function choosePriorityRecommendation(recommendations: RecommendationViewModel[]) {
  if (recommendations.length === 0) return undefined;
  const highRisk = recommendations.find((recommendation) => recommendation.normalizedRisk === "high");
  if (highRisk) return highRisk;
  return [...recommendations].sort((a, b) => {
    const confidenceDifference = b.confidenceScore - a.confidenceScore;
    if (confidenceDifference !== 0) return confidenceDifference;
    return a.originalIndex - b.originalIndex;
  })[0];
}

function buildPriorityReason(recommendation?: RecommendationViewModel) {
  if (!recommendation) {
    return "No recommendation data is available yet.";
  }
  if (recommendation.normalizedRisk === "high") {
    return "Selected first because it carries a high risk context and deserves review.";
  }
  return "Selected because it has the strongest confidence score among available recommendations.";
}

function sortRecommendations(
  recommendations: RecommendationViewModel[],
  sort: RecommendationSort
) {
  return [...recommendations].sort((a, b) => {
    if (sort === "confidenceHigh") return b.confidenceScore - a.confidenceScore;
    if (sort === "confidenceLow") return a.confidenceScore - b.confidenceScore;
    if (sort === "category") {
      return a.category.localeCompare(b.category) || a.originalIndex - b.originalIndex;
    }
    const riskDifference = getRiskRank(b.normalizedRisk) - getRiskRank(a.normalizedRisk);
    if (riskDifference !== 0) return riskDifference;
    const confidenceDifference = b.confidenceScore - a.confidenceScore;
    if (confidenceDifference !== 0) return confidenceDifference;
    return a.originalIndex - b.originalIndex;
  });
}

function groupByCategory(recommendations: RecommendationViewModel[]) {
  return recommendations.reduce<Record<string, RecommendationViewModel[]>>((groups, recommendation) => {
    if (!groups[recommendation.category]) groups[recommendation.category] = [];
    groups[recommendation.category].push(recommendation);
    return groups;
  }, {});
}

function normalizeRisk(riskLevel: string) {
  const normalized = riskLevel?.toLowerCase();
  if (normalized === "moderate") return "medium";
  if (normalized === "high" || normalized === "medium" || normalized === "low") {
    return normalized;
  }
  return "medium";
}

function getRiskRank(risk: string) {
  if (risk === "high") return 3;
  if (risk === "medium") return 2;
  if (risk === "low") return 1;
  return 0;
}

function clampConfidence(value: number | null | undefined) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Number(value)));
}
