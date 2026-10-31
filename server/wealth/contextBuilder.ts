import {
  getAlertsByProfile,
  getAllDemoProfiles,
  getDemoProfileById,
  getGoalsByProfile,
  getTransactionsByProfile,
  getUserActiveProfile,
  setUserActiveProfile,
} from "../db";
import {
  calculateHealthScore,
  getProfileMetrics,
  getSavingsOpportunities,
  getSpendingBreakdown,
  getUnusualExpenses,
} from "../financialEngine";
import { generateWealthAlerts } from "./alertEngine";
import { generateInsights } from "./insightEngine";
import { generateWealthRecommendations } from "./recommendationEngine";
import { profileWealthRisk } from "./riskProfiler";
import { loadImportedModel, toWealthDraft } from "../inari/importedModel";
import type {
  WealthAlert,
  WealthContext,
  WealthContextDraft,
  WealthGoal,
  WealthTransaction,
} from "./types";

async function getOrCreateActiveDemoProfileId(userId: number) {
  const userProfile = await getUserActiveProfile(userId);
  if (userProfile) return userProfile.demoProfileId;

  const profiles = await getAllDemoProfiles();
  const firstProfile = profiles[0];
  if (!firstProfile) return null;

  await setUserActiveProfile(userId, firstProfile.id);
  return firstProfile.id;
}

const parseAmount = (value: { toString(): string }) => parseFloat(value.toString());

function normalizeGoal(goal: any): WealthGoal {
  const targetAmount = parseAmount(goal.targetAmount);
  const currentAmount = parseAmount(goal.currentAmount);
  const timelineMonths = Math.max(goal.timelineMonths || 1, 1);

  return {
    id: goal.id,
    goalType: goal.goalType,
    targetAmount,
    currentAmount,
    timelineMonths,
    priority: goal.priority,
    monthlyContribution: Math.round(targetAmount / timelineMonths),
    progressPercent: Math.min(100, (currentAmount / Math.max(targetAmount, 1)) * 100),
  };
}

function normalizeTransaction(transaction: any): WealthTransaction {
  return {
    id: transaction.id,
    date: transaction.date,
    category: transaction.category,
    amount: parseAmount(transaction.amount),
    type: transaction.type,
    description: transaction.description,
  };
}

function normalizeStoredAlert(alert: any): WealthAlert {
  const severity =
    alert.severity === "high" ? "high" : alert.severity === "info" ? "info" : "medium";

  return {
    id: `stored-${alert.id}`,
    type:
      alert.alertType === "low_emergency_fund"
        ? "emergencyFund"
        : alert.alertType === "high_credit_usage"
          ? "overspending"
          : "opportunity",
    severity,
    title: alert.title,
    message: alert.message,
    suggestedAction: "Review this alert before increasing discretionary spending or investment risk.",
    relatedMetric: alert.alertType,
  };
}

/**
 * `ownerKey` (ledger owner) switches the context to the user's imported data. When that owner has imported data but
 * income/expenses are not derivable yet (no complete month), this returns null rather than falling back to the persona.
 */
export async function buildWealthContextForUser(userId: number, ownerKey?: string): Promise<WealthContext | null> {
  if (ownerKey) {
    const model = await loadImportedModel(ownerKey);
    if (model !== undefined) {
      const draft = toWealthDraft(model);
      return draft ? completeContext(draft, []) : null;
    }
  }
  const demoProfileId = await getOrCreateActiveDemoProfileId(userId);
  if (!demoProfileId) return null;

  const [profile, metrics] = await Promise.all([
    getDemoProfileById(demoProfileId),
    getProfileMetrics(demoProfileId),
  ]);
  if (!profile || !metrics) return null;

  const [
    spendingBreakdown,
    goals,
    recentTransactions,
    unusualExpenses,
    opportunities,
    storedAlerts,
  ] = await Promise.all([
    getSpendingBreakdown(demoProfileId),
    getGoalsByProfile(demoProfileId),
    getTransactionsByProfile(demoProfileId, 8),
    getUnusualExpenses(demoProfileId),
    getSavingsOpportunities(demoProfileId),
    getAlertsByProfile(demoProfileId),
  ]);

  const draft: WealthContextDraft = {
    dataSource: "demo",
    activeProfile: {
      id: profile.id,
      name: profile.name,
      age: profile.age,
      occupation: profile.occupation,
      riskProfile: profile.riskProfile,
    },
    monthlyIncome: metrics.monthlyIncome,
    monthlyExpenses: metrics.monthlyExpenses,
    monthlySurplus: metrics.monthlyIncome - metrics.monthlyExpenses,
    savingsRate: metrics.savingsRate,
    financialHealthScore: calculateHealthScore(metrics),
    spendingBreakdown,
    goals: goals.map(normalizeGoal),
    recentTransactions: recentTransactions.map(normalizeTransaction),
    unusualExpenses: unusualExpenses.map(normalizeTransaction),
    opportunities,
    metrics,
  };

  return completeContext(draft, storedAlerts.map(normalizeStoredAlert));
}

function completeContext(draft: WealthContextDraft, storedAlerts: WealthAlert[]): WealthContext {
  const recommendations = generateWealthRecommendations(draft);
  const riskProfile = profileWealthRisk({ ...draft, recommendations });
  const insights = generateInsights({ ...draft, recommendations, riskProfile });
  const generatedAlerts = generateWealthAlerts({
    ...draft,
    recommendations,
    riskProfile,
    insights,
  });
  const alerts = [...storedAlerts, ...generatedAlerts];

  return {
    ...draft,
    recommendations,
    riskProfile,
    insights,
    alerts,
  };
}
