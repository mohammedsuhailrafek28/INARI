import { z } from "zod";
import { ownerKeyOf } from "./inari/owner";
import { importedAlertRows, importedDashboardSummary, importedMonthSummary, importedRecentTransactions, loadImportedModel } from "./inari/importedModel";
import { isImportedMode } from "./inari/service";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { inariRouter } from "./inari/router";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import {
  getAllDemoProfiles,
  getDemoProfileById,
  getUserActiveProfile,
  setUserActiveProfile,
  getTransactionsByProfile,
  getGoalsByProfile,
  getAlertsByProfile,
  getSavingsStreak,
  getBadgesByProfile,
  updateFinancialHealthScore,
  getMonthlyTransactionSummary,
  getDatabaseHealth,
} from "./db";
import { ENV, getConfigWarnings } from "./_core/env";
import {
  getProfileMetrics,
  calculateHealthScore,
  generateRecommendations,
  getSpendingBreakdown,
  getUnusualExpenses,
  getSavingsOpportunities,
} from "./financialEngine";
import {
  answerWealthAdvisorQuestion,
  buildWealthContextForUser,
  buildPredictionBundle,
  buildEventTimeline,
  classifyAdvisorIntentForSession,
  createAdvisorAnswerGeneratedEvent,
  createAdvisorQuestionAskedEvent,
  eventStore,
  buildNotificationDigest,
  notificationStore,
  publishEventSafely,
  publishPredictionEvents,
  publishWealthContextEvents,
  getPersistenceHealth,
  buildTelemetryHealth,
  buildTelemetryMetrics,
  buildTelemetryTimeline,
  inMemoryTelemetryStore,
  measureAsync,
  analyzeQuestion,
} from "./wealth";
import { buildAdvisorSessionContext } from "./wealth/memory/advisorSession";
import {
  clearConversationHistory,
  getConversationHistory,
  rememberAdvisorExchange,
} from "./wealth/memory/conversationMemory";
import {
  getPreferenceProfile,
  updatePreferenceProfile,
} from "./wealth/memory/preferenceMemory";

const preferencePatchSchema = z
  .object({
    riskTolerance: z.enum(["conservative", "balanced", "growth"]).optional(),
    investmentInterest: z.enum(["low", "moderate", "high"]).optional(),
    preferredLanguage: z.literal("english").optional(),
    voiceEnabled: z.boolean().optional(),
    goalPriority: z.enum(["emergencyFund", "debt", "investing", "savings"]).optional(),
  })
  .strict();

const notificationQuerySchema = z
  .object({
    limit: z.number().int().min(1).max(100).optional(),
    status: z.enum(["unread", "read", "dismissed"]).optional(),
    category: z
      .enum(["advisor", "goal", "recommendation", "risk", "alert", "prediction", "system"])
      .optional(),
  })
  .optional();

const telemetryQuerySchema = z
  .object({
    limit: z.number().int().min(1).max(500).optional(),
  })
  .optional();

async function getOrCreateActiveDemoProfileId(userId: number) {
  const userProfile = await getUserActiveProfile(userId);
  if (userProfile) return userProfile.demoProfileId;

  const profiles = await getAllDemoProfiles();
  const firstProfile = profiles[0];
  if (!firstProfile) return null;

  await setUserActiveProfile(userId, firstProfile.id);
  return firstProfile.id;
}

export const appRouter = router({
  system: systemRouter,
  inari: inariRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // ============ Demo Profiles ============
  profiles: router({
    list: publicProcedure.query(async () => {
      return getAllDemoProfiles();
    }),

    getById: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return getDemoProfileById(input.id);
    }),

    setActive: protectedProcedure
      .input(z.object({ demoProfileId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await setUserActiveProfile(ctx.user.id, input.demoProfileId);
        return { success: true };
      }),

    getActive: protectedProcedure.query(async ({ ctx }) => {
      const demoProfileId = await getOrCreateActiveDemoProfileId(ctx.user.id);
      if (!demoProfileId) return null;
      return getDemoProfileById(demoProfileId);
    }),
  }),

  // ============ Dashboard ============
  dashboard: router({
    getSummary: protectedProcedure.query(async ({ ctx }) => {
      const imported = await loadImportedModel(ownerKeyOf(ctx));
      if (imported) {
        const recs = imported.metrics ? generateRecommendations(imported.metrics) : [];
        return importedDashboardSummary(imported, recs);
      }
      const demoProfileId = await getOrCreateActiveDemoProfileId(ctx.user.id);
      if (!demoProfileId) return null;
      const profile = await getDemoProfileById(demoProfileId);
      if (!profile) return null;

      const metrics = await getProfileMetrics(demoProfileId);
      if (!metrics) return null;

      const healthScore = calculateHealthScore(metrics);
      const recommendations = generateRecommendations(metrics);
      const topRecommendations = recommendations.slice(0, 3);

      // Update health score in database
      await updateFinancialHealthScore(demoProfileId, healthScore);

      const streak = await getSavingsStreak(demoProfileId);
      const badges = await getBadgesByProfile(demoProfileId);

      return {
        profile: {
          name: profile.name,
          age: profile.age,
          occupation: profile.occupation,
          riskProfile: profile.riskProfile,
        },
        financialHealth: healthScore,
        monthlyIncome: parseFloat(profile.monthlyIncome.toString()),
        monthlyExpenses: parseFloat(profile.monthlyExpenses.toString()),
        savingsRate: parseFloat(profile.savingsRate.toString()),
        investmentBalance: parseFloat(profile.investmentBalance.toString()),
        emergencyFundBalance: parseFloat(profile.emergencyFundBalance.toString()),
        creditCardDebt: parseFloat(profile.creditCardDebt.toString()),
        topRecommendations: topRecommendations.map((r) => ({
          recommendation: r.recommendation,
          expectedBenefit: r.expectedBenefit,
          riskLevel: r.riskLevel,
          confidenceScore: r.confidenceScore,
          reasons: r.reasons,
          category: r.category,
        })),
        savingsStreak: streak?.currentStreak || 0,
        badges: badges.map((b) => ({
          badgeType: b.badgeType,
          title: b.title,
          description: b.description,
        })),
      };
    }),
  }),

  // ============ Spending Insights ============
  spending: router({
    getBreakdown: protectedProcedure.query(async ({ ctx }) => {
      const imported = await loadImportedModel(ownerKeyOf(ctx));
      if (imported) return imported.spendingBreakdown;
      const demoProfileId = await getOrCreateActiveDemoProfileId(ctx.user.id);
      if (!demoProfileId) return {};

      const breakdown = await getSpendingBreakdown(demoProfileId);
      return breakdown;
    }),

    getUnusual: protectedProcedure.query(async ({ ctx }) => {
      const imported = await loadImportedModel(ownerKeyOf(ctx));
      if (imported) {
        return imported.unusualExpenses.map((u) => ({ date: u.date, category: u.category, amount: u.amount, description: u.description }));
      }
      const demoProfileId = await getOrCreateActiveDemoProfileId(ctx.user.id);
      if (!demoProfileId) return [];

      const unusual = await getUnusualExpenses(demoProfileId);
      return unusual.map((u) => ({
        date: u.date,
        category: u.category,
        amount: parseFloat(u.amount.toString()),
        description: u.description,
      }));
    }),

    getOpportunities: protectedProcedure.query(async ({ ctx }) => {
      const imported = await loadImportedModel(ownerKeyOf(ctx));
      if (imported) return imported.opportunities;
      const demoProfileId = await getOrCreateActiveDemoProfileId(ctx.user.id);
      if (!demoProfileId) return [];

      return getSavingsOpportunities(demoProfileId);
    }),
  }),

  // ============ Goals ============
  goals: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      // Imported mode has no persona goals; user-defined goals arrive with inari.getGoals.
      if (await isImportedMode(ownerKeyOf(ctx))) return [];
      const demoProfileId = await getOrCreateActiveDemoProfileId(ctx.user.id);
      if (!demoProfileId) return [];

      const goals = await getGoalsByProfile(demoProfileId);
      return goals.map((g) => ({
        id: g.id,
        goalType: g.goalType,
        targetAmount: parseFloat(g.targetAmount.toString()),
        currentAmount: parseFloat(g.currentAmount.toString()),
        timelineMonths: g.timelineMonths,
        priority: g.priority,
        monthlyContribution: Math.round(
          parseFloat(g.targetAmount.toString()) / g.timelineMonths
        ),
      }));
    }),
  }),

  // ============ Recommendations ============
  recommendations: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const imported = await loadImportedModel(ownerKeyOf(ctx));
      const demoProfileId = imported ? null : await getOrCreateActiveDemoProfileId(ctx.user.id);
      if (!imported && !demoProfileId) return [];

      const metrics = imported ? imported.metrics : await getProfileMetrics(demoProfileId!);
      if (!metrics) return [];

      const recs = generateRecommendations(metrics);
      return recs.map((r) => ({
        recommendation: r.recommendation,
        expectedBenefit: r.expectedBenefit,
        riskLevel: r.riskLevel,
        confidenceScore: r.confidenceScore,
        reasons: r.reasons,
        category: r.category,
      }));
    }),
  }),

  // ============ Wealth Intelligence Layer ============
  wealth: router({
    getContext: protectedProcedure.query(async ({ ctx }) => {
      const wealthContext = await buildWealthContextForUser(ctx.user.id, ownerKeyOf(ctx));
      if (wealthContext) {
        await publishWealthContextEvents(ctx.user.id, wealthContext);
      }
      return wealthContext;
    }),

    getInsights: protectedProcedure.query(async ({ ctx }) => {
      const wealthContext = await buildWealthContextForUser(ctx.user.id, ownerKeyOf(ctx));
      return wealthContext?.insights ?? [];
    }),

    getRiskProfile: protectedProcedure.query(async ({ ctx }) => {
      const wealthContext = await buildWealthContextForUser(ctx.user.id, ownerKeyOf(ctx));
      return wealthContext?.riskProfile ?? null;
    }),

    getPersistenceHealth: protectedProcedure.query(async () => {
      return getPersistenceHealth();
    }),

    getSystemHealth: protectedProcedure.query(async () => {
      const [persistence, database] = await Promise.all([
        getPersistenceHealth(),
        getDatabaseHealth(),
      ]);
      const warnings = [...getConfigWarnings(), ...persistence.warnings];
      const status =
        database.status === "unavailable" && !ENV.isDemoMode
          ? "degraded"
          : persistence.status === "unavailable"
            ? "degraded"
            : "ok";

      return {
        status,
        environment: ENV.isProduction ? "production" : "development",
        demoMode: ENV.isDemoMode,
        persistence,
        database,
        warnings: Array.from(new Set(warnings)),
        version: process.env.npm_package_version ?? "1.0.0",
        timestamp: new Date().toISOString(),
      };
    }),

    getTelemetryMetrics: protectedProcedure
      .input(telemetryQuerySchema)
      .query(async ({ input, ctx }) => {
        const events = await inMemoryTelemetryStore.getRecentEvents(ctx.user.id, {
          limit: input?.limit ?? 500,
        });
        return buildTelemetryMetrics(events);
      }),

    getTelemetryHealth: protectedProcedure
      .input(telemetryQuerySchema)
      .query(async ({ input, ctx }) => {
        const events = await inMemoryTelemetryStore.getRecentEvents(ctx.user.id, {
          limit: input?.limit ?? 500,
        });
        return buildTelemetryHealth(events);
      }),

    getTelemetryTimeline: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(100).optional() }).optional())
      .query(async ({ input, ctx }) => {
        const events = await inMemoryTelemetryStore.getRecentEvents(ctx.user.id, {
          limit: input?.limit ?? 25,
        });
        return buildTelemetryTimeline(events, input?.limit ?? 25);
      }),

    clearTelemetry: protectedProcedure.mutation(async ({ ctx }) => {
      await inMemoryTelemetryStore.clear(ctx.user.id);
      return { success: true };
    }),

    analyzeQuestion: protectedProcedure
      .input(z.object({ question: z.string().trim().min(1).max(600) }))
      .query(async ({ input, ctx }) => {
        const wealthContext = await buildWealthContextForUser(ctx.user.id, ownerKeyOf(ctx));
        const advisorSession = wealthContext
          ? await buildAdvisorSessionContext(ctx.user.id, wealthContext)
          : undefined;
        return analyzeQuestion(input.question, { session: advisorSession });
      }),

    getPredictions: protectedProcedure.query(async ({ ctx }) => {
      return measureAsync("wealth.getPredictions", "route", ctx.user.id, async () => {
        const wealthContext = await buildWealthContextForUser(ctx.user.id, ownerKeyOf(ctx));
        if (!wealthContext) return null;
        const advisorSession = await buildAdvisorSessionContext(ctx.user.id, wealthContext);
        const bundle = buildPredictionBundle(wealthContext, advisorSession);
        await publishPredictionEvents(ctx.user.id, bundle);
        return bundle;
      });
    }),

    getMonthlyOutlook: protectedProcedure.query(async ({ ctx }) => {
      return measureAsync("wealth.getMonthlyOutlook", "route", ctx.user.id, async () => {
        const wealthContext = await buildWealthContextForUser(ctx.user.id, ownerKeyOf(ctx));
        if (!wealthContext) return null;
        const advisorSession = await buildAdvisorSessionContext(ctx.user.id, wealthContext);
        const bundle = buildPredictionBundle(wealthContext, advisorSession);
        await publishPredictionEvents(ctx.user.id, bundle);
        return bundle.monthlyOutlook;
      });
    }),

    getEvents: protectedProcedure
      .input(
        z
          .object({
            limit: z.number().int().min(1).max(100).optional(),
            category: z
              .enum([
                "advisor",
                "goal",
                "recommendation",
                "risk",
                "alert",
                "prediction",
                "profile",
                "system",
              ])
              .optional(),
          })
          .optional()
      )
      .query(async ({ input, ctx }) => {
        const userId = String(ctx.user.id);
        if (input?.category) {
          return eventStore.getEventsByCategory(userId, input.category, input.limit ?? 20);
        }
        return eventStore.getRecentEvents(userId, input?.limit ?? 20);
      }),

    getEventTimeline: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(20).optional() }).optional())
      .query(async ({ input, ctx }) => {
        const events = await eventStore.getRecentEvents(String(ctx.user.id), input?.limit ?? 10);
        return buildEventTimeline(events, input?.limit ?? 10);
      }),

    clearEvents: protectedProcedure.mutation(async ({ ctx }) => {
      await eventStore.clearEvents(String(ctx.user.id));
      return { success: true };
    }),

    getNotifications: protectedProcedure
      .input(notificationQuerySchema)
      .query(async ({ input, ctx }) => {
        return notificationStore.getNotifications(String(ctx.user.id), input ?? {});
      }),

    getUnreadNotificationCount: protectedProcedure.query(async ({ ctx }) => {
      return notificationStore.getUnreadCount(String(ctx.user.id));
    }),

    markNotificationRead: protectedProcedure
      .input(z.object({ notificationId: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        await notificationStore.markRead(String(ctx.user.id), input.notificationId);
        return { success: true };
      }),

    markAllNotificationsRead: protectedProcedure.mutation(async ({ ctx }) => {
      await notificationStore.markAllRead(String(ctx.user.id));
      return { success: true };
    }),

    dismissNotification: protectedProcedure
      .input(z.object({ notificationId: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        await notificationStore.dismiss(String(ctx.user.id), input.notificationId);
        return { success: true };
      }),

    clearNotifications: protectedProcedure.mutation(async ({ ctx }) => {
      await notificationStore.clearNotifications(String(ctx.user.id));
      return { success: true };
    }),

    getNotificationDigest: protectedProcedure.query(async ({ ctx }) => {
      const userId = String(ctx.user.id);
      const [notifications, events] = await Promise.all([
        notificationStore.getNotifications(userId, { limit: 100 }),
        eventStore.getRecentEvents(userId, 100),
      ]);
      return buildNotificationDigest(notifications, events);
    }),

    getMemory: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(20).optional() }).optional())
      .query(async ({ input, ctx }) => {
        return getConversationHistory(ctx.user.id, undefined, input?.limit ?? 20);
      }),

    clearMemory: protectedProcedure.mutation(async ({ ctx }) => {
      await clearConversationHistory(ctx.user.id);
      return { success: true };
    }),

    getPreferences: protectedProcedure.query(async ({ ctx }) => {
      return getPreferenceProfile(ctx.user.id);
    }),

    updatePreferences: protectedProcedure
      .input(preferencePatchSchema)
      .mutation(async ({ input, ctx }) => {
        return updatePreferenceProfile(ctx.user.id, input);
      }),

    askAdvisor: protectedProcedure
      .input(z.object({ question: z.string().trim().min(3).max(600) }))
      .mutation(async ({ input, ctx }) => {
        return measureAsync("wealth.askAdvisor", "advisor", ctx.user.id, async () => {
          await publishEventSafely(createAdvisorQuestionAskedEvent(ctx.user.id, input.question, "avatar"));
          const wealthContext = await buildWealthContextForUser(ctx.user.id, ownerKeyOf(ctx));
          if (!wealthContext) {
            return {
              answer:
                "I cannot answer with numbers yet: there is no financial data to work from. Import a bank statement that covers at least one full month, or switch to the demo data.",
              summary: "No financial context is available yet.",
              keyInsights: ["No complete month of imported data was found."],
              suggestedNextActions: ["Import a statement covering a full month, then ask again."],
              followUpQuestions: ["How can I improve my score?"],
              relatedMetrics: [],
              confidenceLevel: "low" as const,
              mode: "fallback" as const,
              disclaimer:
                "This is educational demo guidance, not licensed financial advice. Review decisions with a qualified financial professional before acting.",
            };
          }

          const advisorSession = await buildAdvisorSessionContext(ctx.user.id, wealthContext);
          const response = await answerWealthAdvisorQuestion(input.question, advisorSession);
          await publishEventSafely(createAdvisorAnswerGeneratedEvent(ctx.user.id, response));
          await rememberAdvisorExchange(
            ctx.user.id,
            input.question,
            response,
            classifyAdvisorIntentForSession(input.question, advisorSession)
          );
          return response;
        });
      }),
  }),

  // ============ AI Advisor Compatibility Route ============
  advisor: router({
    ask: protectedProcedure
      .input(
        z.object({
          question: z.string().trim().min(3).max(600),
          dashboardSummary: z.unknown().optional(),
          spendingBreakdown: z.unknown().optional(),
          goals: z.unknown().optional(),
          recommendations: z.unknown().optional(),
          recentTransactions: z.unknown().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        return measureAsync("advisor.ask", "advisor", ctx.user.id, async () => {
          await publishEventSafely(createAdvisorQuestionAskedEvent(ctx.user.id, input.question, "avatar"));
          const wealthContext = await buildWealthContextForUser(ctx.user.id, ownerKeyOf(ctx));
          if (!wealthContext) {
            return {
              answer:
                "I cannot answer with numbers yet: there is no financial data to work from. Import a bank statement that covers at least one full month, or switch to the demo data.",
              summary: "No financial context is available yet.",
              keyInsights: ["No complete month of imported data was found."],
              suggestedNextActions: ["Import a statement covering a full month, then ask again."],
              followUpQuestions: ["How can I improve my score?"],
              relatedMetrics: [],
              confidenceLevel: "low" as const,
              mode: "fallback" as const,
              disclaimer:
                "This is educational demo guidance, not licensed financial advice. Review decisions with a qualified financial professional before acting.",
            };
          }

          const advisorSession = await buildAdvisorSessionContext(ctx.user.id, wealthContext);
          const response = await answerWealthAdvisorQuestion(input.question, advisorSession);
          await publishEventSafely(createAdvisorAnswerGeneratedEvent(ctx.user.id, response));
          await rememberAdvisorExchange(
            ctx.user.id,
            input.question,
            response,
            classifyAdvisorIntentForSession(input.question, advisorSession)
          );
          return response;
        });
      }),
  }),

  // ============ Alerts ============
  alerts: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      if (await isImportedMode(ownerKeyOf(ctx))) {
        const context = await buildWealthContextForUser(ctx.user.id, ownerKeyOf(ctx));
        return importedAlertRows(context?.alerts ?? []);
      }
      const demoProfileId = await getOrCreateActiveDemoProfileId(ctx.user.id);
      if (!demoProfileId) return [];

      const alerts = await getAlertsByProfile(demoProfileId);
      return alerts.map((a) => ({
        id: a.id,
        alertType: a.alertType,
        title: a.title,
        message: a.message,
        severity: a.severity,
        isRead: a.isRead,
        createdAt: a.createdAt,
      }));
    }),
  }),

  // ============ Transactions ============
  transactions: router({
    recent: protectedProcedure.query(async ({ ctx }) => {
      const imported = await loadImportedModel(ownerKeyOf(ctx));
      if (imported) return importedRecentTransactions(imported, 50);
      const demoProfileId = await getOrCreateActiveDemoProfileId(ctx.user.id);
      if (!demoProfileId) return [];

      const txns = await getTransactionsByProfile(demoProfileId, 50);
      return txns.map((t) => ({
        id: t.id,
        date: t.date,
        category: t.category,
        amount: parseFloat(t.amount.toString()),
        type: t.type,
        description: t.description,
      }));
    }),

    summary: protectedProcedure.query(async ({ ctx }) => {
      const imported = await loadImportedModel(ownerKeyOf(ctx));
      if (imported) return importedMonthSummary(imported);
      const demoProfileId = await getOrCreateActiveDemoProfileId(ctx.user.id);
      if (!demoProfileId) return { income: 0, expenses: 0, investments: 0 };

      return getMonthlyTransactionSummary(demoProfileId);
    }),
  }),
});

export type AppRouter = typeof appRouter;
