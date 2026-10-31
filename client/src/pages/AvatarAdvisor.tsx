import inariLogo from "@/assets/inari/inari-logo.svg";
import { AdvisorContextPanel } from "@/components/advisor/AdvisorContextPanel";
import { AdvisorIdentity } from "@/components/advisor/AdvisorIdentity";
import {
  AdvisorMessage,
  type AdvisorMessageView,
  type AdvisorResponseView,
} from "@/components/advisor/AdvisorMessage";
import { PromptChip } from "@/components/advisor/PromptChip";
import { VoiceControls } from "@/components/advisor/VoiceControls";
import { DashboardNavbar, type DashboardNavLink } from "@/components/layout/DashboardNavbar";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/wealth/ErrorState";
import { LoadingSkeleton } from "@/components/wealth/LoadingSkeleton";
import { SectionHeader } from "@/components/wealth/SectionHeader";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  formatCurrencyINR,
  formatPercentage,
  formatTitle,
  normalizeFinancialText,
} from "@/lib/formatters";
import { trpc } from "@/lib/trpc";
import { DemoNotice, ModeBanner, appLinks, useInariMode } from "@/components/inari/kit";
import type { AdvisorContext, InariAdvisorResponse } from "@shared/inari/contracts";
import { Bot, Send, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

type AdvisorResponse = AdvisorResponseView;

const advisorLinks: DashboardNavLink[] = appLinks("/avatar");

const defaultQuestions = [
  "How is my financial health?",
  "What should I focus on first?",
  "Which goal needs attention?",
  "Where can I reduce spending?",
  "Explain my top recommendation",
  "What risks should I review?",
];

export default function AvatarAdvisor() {
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const mode = useInariMode();
  const [inariContext, setInariContext] = useState<AdvisorContext | undefined>(undefined);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [conversation, setConversation] = useState<AdvisorMessageView[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [lastSpokenAnswer, setLastSpokenAnswer] = useState("");

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
  const recommendationsQuery = trpc.recommendations.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const advisorMutation = trpc.wealth.askAdvisor.useMutation({
    onSuccess: (response) => {
      const advisorResponse = normalizeAdvisorResponse(response);
      setConversation((messages) => [
        ...messages,
        {
          id: createId("assistant"),
          role: "assistant",
          response: advisorResponse,
          createdAt: new Date(),
          status: "complete",
        },
      ]);
      setLastSpokenAnswer(advisorResponse.answer);
      speak(advisorResponse.answer);
    },
    onError: (error) => {
      const fallback: AdvisorResponse = {
        answer: "I could not generate guidance safely right now. Please try again in a moment.",
        summary: "Advisor request failed",
        keyInsights: ["The advisor route returned an error."],
        suggestedNextActions: ["Try the question again.", "Review dashboard context meanwhile."],
        followUpQuestions: defaultQuestions.slice(0, 3),
        relatedMetrics: [],
        confidenceLevel: "low",
        mode: "fallback",
        disclaimer: "This is educational demo guidance, not licensed financial advice.",
      };
      setConversation((messages) => [
        ...messages,
        {
          id: createId("assistant-error"),
          role: "assistant",
          response: {
            ...fallback,
            answer: `${fallback.answer} ${error.message ? "The technical details were hidden for safety." : ""}`.trim(),
          },
          createdAt: new Date(),
          status: "error",
        },
      ]);
    },
  });

  const inariAsk = trpc.inari.ask.useMutation({
    onSuccess: (response) => {
      setInariContext(response.context);
      const advisorResponse = fromInari(response);
      setConversation((messages) => [
        ...messages,
        { id: createId("assistant"), role: "assistant", response: advisorResponse, createdAt: new Date(), status: "complete" },
      ]);
      setLastSpokenAnswer(advisorResponse.answer);
      speak(advisorResponse.answer);
    },
    onError: (error) => {
      setConversation((messages) => [
        ...messages,
        {
          id: createId("assistant-error"),
          role: "assistant",
          response: {
            answer: `I could not answer that: ${error.message}. Your question was not answered; please try again.`,
            summary: "Advisor request failed",
            keyInsights: [],
            suggestedNextActions: ["Try the question again."],
            confidenceLevel: "low",
            mode: "fallback",
            disclaimer: "This is educational demo guidance, not licensed financial advice.",
          },
          createdAt: new Date(),
          status: "error",
        },
      ]);
    },
  });
  const isAsking = advisorMutation.isPending || inariAsk.isPending;

  const setActiveProfileMutation = trpc.profiles.setActive.useMutation({
    onSuccess: async () => {
      stopSpeaking();
      setConversation([]);
      setQuestion("");
      await Promise.all([
        utils.profiles.getActive.invalidate(),
        utils.dashboard.getSummary.invalidate(),
        utils.wealth.getContext.invalidate(),
        utils.recommendations.list.invalidate(),
      ]);
    },
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/");
  }, [authLoading, isAuthenticated, setLocation]);

  useEffect(() => {
    setSpeechSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => stopSpeaking();
  }, []);

  const profileOptions = useMemo(
    () =>
      (mode.imported ? [] : profilesQuery.data ?? []).map((profile) => ({
        id: profile.id,
        label: profile.name,
      })),
    [profilesQuery.data, mode.imported]
  );

  const recommendations = useMemo(
    () =>
      (recommendationsQuery.data ?? []).map((recommendation) => ({
        title: normalizeFinancialText(recommendation.recommendation),
        category: recommendation.category,
        riskLevel: normalizeRisk(recommendation.riskLevel),
        confidenceScore: clampPercent(recommendation.confidenceScore),
      })),
    [recommendationsQuery.data]
  );

  const suggestedQuestions = useMemo(() => {
    const questions = [...defaultQuestions];
    const topGoal = wealthContextQuery.data?.goals?.[0];
    const topRecommendation = recommendations[0];
    const topAlert = wealthContextQuery.data?.alerts?.[0];
    if (topGoal) {
      questions.push(`Which step helps my ${formatTitle(topGoal.goalType)} goal?`);
    }
    if (topRecommendation) {
      questions.push(`Explain ${topRecommendation.title}`);
    }
    if (topAlert) {
      questions.push(`What should I do about ${topAlert.title}?`);
    }
    return questions.filter((item, index, all) => all.indexOf(item) === index).slice(0, 8);
  }, [recommendations, wealthContextQuery.data]);

  const profileLabel = mode.imported ? "Your imported data" : activeProfileQuery.data?.name;
  const isSwitchingProfile = setActiveProfileMutation.isPending;
  const isPrimaryLoading =
    authLoading ||
    activeProfileQuery.isLoading ||
    dashboardQuery.isLoading ||
    wealthContextQuery.isLoading ||
    recommendationsQuery.isLoading ||
    isSwitchingProfile;
  const hasPrimaryError =
    profilesQuery.isError ||
    activeProfileQuery.isError ||
    dashboardQuery.isError ||
    wealthContextQuery.isError ||
    recommendationsQuery.isError;

  const retry = async () => {
    await Promise.all([
      profilesQuery.refetch(),
      activeProfileQuery.refetch(),
      dashboardQuery.refetch(),
      wealthContextQuery.refetch(),
      recommendationsQuery.refetch(),
    ]);
  };

  const handleProfileChange = (profileId: number) => {
    if (!profileId || profileId === activeProfileQuery.data?.id) return;
    setActiveProfileMutation.mutate({ demoProfileId: profileId });
  };

  const handleLogout = async () => {
    stopSpeaking();
    await logout();
    setLocation("/");
  };

  const askAdvisor = (rawQuestion: string) => {
    const trimmed = rawQuestion.trim();
    if (trimmed.length < 3 || isAsking) return;
    stopSpeaking();
    setConversation((messages) => [
      ...messages,
      {
        id: createId("user"),
        role: "user",
        content: trimmed,
        createdAt: new Date(),
        status: "complete",
      },
    ]);
    if (mode.imported) inariAsk.mutate({ question: trimmed, locale: "en", ...(inariContext ? { previous: inariContext } : {}) });
    else advisorMutation.mutate({ question: trimmed });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = question.trim();
    if (trimmed.length < 3 || isAsking) return;
    askAdvisor(trimmed);
    setQuestion("");
  };

  const speak = (text: string) => {
    if (isMuted || !speechSupported || typeof window === "undefined") return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.96;
    utterance.pitch = 1;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  function stopSpeaking() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }

  if (authLoading) {
    return (
      <AdvisorFrame
        userName={user?.name ?? "Demo User"}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        onLogout={handleLogout}
      >
        <LoadingSkeleton variant="page-section" />
      </AdvisorFrame>
    );
  }

  if (!isAuthenticated) return null;

  if (hasPrimaryError) {
    return (
      <AdvisorFrame
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
          title="Advisor context could not load"
          message="We could not load the advisor context safely. Retry the demo data request or check local app configuration."
          onRetry={retry}
        />
      </AdvisorFrame>
    );
  }

  if (isPrimaryLoading) {
    return (
      <AdvisorFrame
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
      </AdvisorFrame>
    );
  }

  const dashboard = dashboardQuery.data;
  const wealthContext = wealthContextQuery.data;
  const healthScore =
    dashboard?.financialHealth?.overallScore ?? wealthContext?.financialHealthScore.overallScore;
  const savingsRate = dashboard?.savingsRate ?? wealthContext?.savingsRate;
  const monthlySurplus = wealthContext?.monthlySurplus;
  const activeGoals = wealthContext?.goals?.length ?? 0;
  const riskProfile = wealthContext?.riskProfile?.profile ?? dashboard?.profile.riskProfile;
  const emergencyCoverageMonths =
    dashboard && dashboard.monthlyExpenses && dashboard.monthlyExpenses > 0 && dashboard.emergencyFundBalance !== null
      ? Math.round((dashboard.emergencyFundBalance / dashboard.monthlyExpenses) * 10) / 10
      : null;
  const firstName = mode.imported ? "there" : (profileLabel ?? dashboard?.profile.name ?? "there").split(" ")[0];
  const welcomeMessage: AdvisorMessageView = {
    id: `welcome-${activeProfileQuery.data?.id ?? "demo"}`,
    role: "assistant",
    createdAt: new Date(),
    status: "complete",
    response: {
      answer:
        emergencyCoverageMonths !== null
          ? `Welcome back, ${firstName}. I've reviewed your financial profile. Your emergency fund should ideally cover 9 months of expenses, and you are currently at about ${emergencyCoverageMonths} months. Would you like me to explain why this matters?`
          : `Welcome back, ${firstName}. I've reviewed your financial profile and highlighted the areas most worth your attention today. Would you like me to start with your emergency fund, goals, or spending risks?`,
      summary: "Profile review ready",
      keyInsights: [
        healthScore ? `Financial health score: ${healthScore}/100.` : "Financial health context is ready.",
        savingsRate !== undefined ? `Savings rate: ${formatPercentage(savingsRate)}.` : "Savings rate is available in your dashboard.",
      ],
      suggestedNextActions: [
        "Review your emergency fund coverage.",
        "Ask which financial risk deserves attention first.",
      ],
      followUpQuestions: [
        "Why does my emergency fund matter?",
        "What should I focus on first?",
        "How can I improve my financial health?",
      ],
      relatedMetrics: [
        ...(healthScore ? [{ label: "Health score", value: `${healthScore}/100` }] : []),
        ...(emergencyCoverageMonths !== null
          ? [{ label: "Emergency cover", value: `${emergencyCoverageMonths} months` }]
          : []),
      ],
      confidenceLevel: "medium",
      mode: "fallback",
      disclaimer: "This is educational demo guidance, not licensed financial advice.",
      ...(mode.imported
        ? { inari: { engineLabel: "Deterministic · no language model", guardrail: "passed", limitations: [], assumptions: [], evidence: [], clarification: null, actions: [] } }
        : {}),
    },
  };
  const latestAssistant =
    [...conversation].reverse().find((message) => message.role === "assistant") ?? welcomeMessage;

  return (
    <AdvisorFrame
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
                Voice-first money coach
              </p>
              <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-wv-text sm:text-3xl">
                INARI Advisor
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-wv-text-secondary sm:text-base">
                {mode.imported ? "Ask about your own imported statements. Answers are calculated deterministically from your ledger (no language model is used); money-changing actions always wait for your confirmation. Type, or dictate with Wispr Flow into the box below." : "Explore explainable guidance based on the sample persona. Import a statement to ask about your own data."}
              </p>
              {profileLabel && !mode.imported ? (
                <p className="mt-3 text-sm font-semibold text-wv-primary">
                  Active profile: {profileLabel}
                </p>
              ) : null}
            </div>
            <Button asChild className="min-h-11 bg-wv-accent text-white hover:bg-wv-accent-hover">
              <a href="/recommendations">Review recommendations</a>
            </Button>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.45fr_0.75fr]">
          <main className="space-y-6">
            <section className="rounded-[var(--wv-radius-card)] border border-wv-border bg-wv-surface p-5 shadow-wv-card">
              <div className="flex gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-wv-background text-wv-primary">
                  <Bot className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-wv-text">Your INARI money coach</h2>
                  <p className="mt-2 text-sm leading-6 text-wv-text-secondary">
                    Ask about health score, goals, spending, recommendations, and risk review.
                    This conversation is available for the current session.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <SectionHeader
                title="Conversation"
                description="Use a prompt or type a supported finance question."
              />
              <div
                className="mt-4 space-y-4"
                aria-live="polite"
                aria-label="Advisor conversation"
              >
                {conversation.length === 0 ? (
                  <AdvisorMessage
                    message={welcomeMessage}
                    onFollowUp={askAdvisor}
                    onSpeak={speak}
                    speaking={isSpeaking}
                    muted={isMuted}
                    disabled={isAsking}
                  />
                ) : (
                  conversation.map((message) => (
                    <AdvisorMessage
                      key={message.id}
                      message={message}
                      onFollowUp={askAdvisor}
                      onSpeak={speak}
                      speaking={isSpeaking}
                      muted={isMuted}
                      disabled={isAsking}
                    />
                  ))
                )}
                {isAsking ? (
                  <div className="rounded-[var(--wv-radius-card)] border border-wv-border bg-wv-surface p-5 text-sm font-semibold text-wv-text-secondary shadow-wv-card">
                    INARI Advisor is preparing a response...
                  </div>
                ) : null}
              </div>
            </section>

            <section className="rounded-[var(--wv-radius-card)] border border-wv-border bg-wv-surface p-5 shadow-wv-card">
              <h2 className="text-base font-bold text-wv-text">Suggested prompts</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {suggestedQuestions.map((prompt) => (
                  <PromptChip
                    key={prompt}
                    question={prompt}
                    onSelect={askAdvisor}
                    disabled={isAsking}
                  />
                ))}
              </div>
            </section>

            <form
              className="rounded-[var(--wv-radius-card)] border border-wv-border bg-wv-surface p-5 shadow-wv-card"
              onSubmit={handleSubmit}
            >
              <label htmlFor="advisor-question" className="text-base font-bold text-wv-text">
                Ask a question
              </label>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <textarea
                  id="advisor-question"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="What should I focus on this month?"
                  className="min-h-24 flex-1 rounded-[var(--wv-radius-form)] border border-wv-border bg-white px-4 py-3 text-sm text-wv-text outline-none focus-visible:ring-2 focus-visible:ring-wv-primary focus-visible:ring-offset-2"
                  disabled={isAsking}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                />
                <Button
                  type="submit"
                  className="min-h-11 bg-wv-primary text-white hover:bg-wv-primary-dark sm:self-start"
                  disabled={isAsking || question.trim().length < 3}
                  aria-label="Send question to advisor"
                >
                  <Send className="size-4" aria-hidden="true" />
                  Send
                </Button>
              </div>
              <p className="mt-3 text-xs leading-5 text-wv-muted">
                Press Enter to send, or Shift+Enter for a new line.
              </p>
            </form>
          </main>

          <aside className="space-y-6">
            <AdvisorIdentity
              isSpeaking={isSpeaking}
              statusLabel={isSpeaking ? "Speaking" : isAsking ? "Thinking" : "Ready"}
            />
            <VoiceControls
              supported={speechSupported}
              muted={isMuted}
              speaking={isSpeaking}
              canReplay={Boolean(lastSpokenAnswer || latestAssistant)}
              onToggleMute={() => {
                setIsMuted((value) => !value);
                stopSpeaking();
              }}
              onStop={stopSpeaking}
              onReplay={() => {
                const answer =
                  lastSpokenAnswer ||
                  (latestAssistant?.role === "assistant" ? latestAssistant.response.answer : "");
                if (answer) speak(answer);
              }}
            />
            <AdvisorContextPanel
              healthScore={healthScore}
              savingsRate={savingsRate}
              monthlySurplus={monthlySurplus}
              riskProfile={riskProfile}
              activeGoals={activeGoals}
              recommendations={recommendations}
            />
            <section className="rounded-[var(--wv-radius-card)] border border-wv-border bg-wv-surface p-5 shadow-wv-card">
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-wv-primary" aria-hidden="true" />
                <div>
                  <h2 className="text-base font-bold text-wv-text">Safety note</h2>
                  <p className="mt-2 text-sm leading-6 text-wv-text-secondary">
                    INARI provides educational financial insights only. It does not
                    guarantee outcomes, execute transactions, or replace qualified professional advice.
                  </p>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </AdvisorFrame>
  );
}

function AdvisorFrame({
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
        links={advisorLinks}
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

function fromInari(r: InariAdvisorResponse): AdvisorResponseView {
  return {
    answer: r.answer,
    summary: r.summary,
    keyInsights: r.keyInsights,
    suggestedNextActions: r.suggestedNextActions,
    followUpQuestions: r.followUpQuestions,
    relatedMetrics: r.relatedMetrics,
    confidenceLevel: r.confidenceLevel,
    mode: "fallback",
    disclaimer: r.disclaimer,
    inari: {
      engineLabel: r.engine?.llmUsed ? "Model-assisted" : "Deterministic · no language model",
      guardrail: r.guardrail.status,
      limitations: r.limitations ?? [],
      assumptions: r.assumptions ?? [],
      evidence: (r.evidence ?? []).map((e) => e.message),
      clarification: r.intent?.needsClarification ? r.intent.clarificationQuestion : null,
      actions: r.proposedActions ?? [],
    },
  };
}

function normalizeAdvisorResponse(response: AdvisorResponse): AdvisorResponse {
  return {
    ...response,
    answer: normalizeFinancialText(response.answer),
    summary: response.summary ? normalizeFinancialText(response.summary) : response.summary,
    keyInsights: response.keyInsights.map(normalizeFinancialText),
    suggestedNextActions: response.suggestedNextActions.map(normalizeFinancialText),
    followUpQuestions: response.followUpQuestions?.map(normalizeFinancialText),
    disclaimer: normalizeFinancialText(response.disclaimer),
  };
}

function normalizeRisk(value: string) {
  const normalized = value?.toLowerCase();
  if (normalized === "moderate") return "medium";
  if (normalized === "high" || normalized === "medium" || normalized === "low") {
    return normalized;
  }
  return "medium";
}

function clampPercent(value: number | null | undefined) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Number(value)));
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
