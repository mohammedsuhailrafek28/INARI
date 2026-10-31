import { getDemoProfileById, getTransactionsByProfile } from "./db";
import { isKnown, type KnownFlags } from "./wealth/known";
import { generateLegacyRecommendationsFromMetrics } from "./wealth/recommendationEngine";

export interface FinancialMetrics {
  monthlyIncome: number;
  monthlyExpenses: number;
  savingsRate: number;
  investmentBalance: number;
  emergencyFundBalance: number;
  creditCardDebt: number;
  riskProfile: "conservative" | "moderate" | "aggressive";
  /**
   * Which user-supplied balances are actually known. Omitted = all known (legacy demo profiles).
   * When a flag is false the matching numeric field is a placeholder 0 and MUST NOT be reasoned about.
   */
  known?: KnownFlags;
}

export interface HealthScore {
  overallScore: number;
  savingsScore: number;
  investmentScore: number;
  debtScore: number;
  emergencyFundScore: number;
  category: "poor" | "fair" | "good" | "excellent";
  /** true when some components were unknown and the score only reflects the known ones */
  partial?: boolean;
  unknownComponents?: Array<"investment" | "debt" | "emergencyFund">;
}

export interface Recommendation {
  recommendation: string;
  expectedBenefit: string;
  riskLevel: "low" | "moderate" | "high";
  confidenceScore: number;
  reasons: string[];
  category: "savings" | "investment" | "debt_management" | "emergency_fund" | "spending";
}

export function calculateHealthScore(metrics: FinancialMetrics): HealthScore {
  const savingsScore = Math.min(25, Math.max(0, metrics.savingsRate * 0.25));
  const investmentRatio = metrics.investmentBalance / Math.max(1, metrics.monthlyIncome);
  const investmentScore = Math.min(25, Math.max(0, Math.min(investmentRatio * 10, 25)));
  const debtRatio = metrics.creditCardDebt / Math.max(1, metrics.monthlyIncome);
  const debtScore = Math.max(0, 25 - Math.min(debtRatio * 25, 25));
  const monthsOfExpenses = metrics.emergencyFundBalance / Math.max(1, metrics.monthlyExpenses);
  const emergencyFundScore = Math.min(25, Math.max(0, monthsOfExpenses * 4.17));

  const unknownComponents: NonNullable<HealthScore["unknownComponents"]> = [];
  if (!isKnown(metrics, "investments")) unknownComponents.push("investment");
  if (!isKnown(metrics, "creditCardDebt")) unknownComponents.push("debt");
  if (!isKnown(metrics, "emergencyFund")) unknownComponents.push("emergencyFund");
  const parts = [
    savingsScore,
    ...(isKnown(metrics, "investments") ? [investmentScore] : []),
    ...(isKnown(metrics, "creditCardDebt") ? [debtScore] : []),
    ...(isKnown(metrics, "emergencyFund") ? [emergencyFundScore] : []),
  ];
  // Unknown components are excluded and the rest rescaled to 0-100, instead of being scored as zero.
  const overallScore =
    unknownComponents.length === 0
      ? Math.round(savingsScore + investmentScore + debtScore + emergencyFundScore)
      : Math.round((parts.reduce((a, b) => a + b, 0) / (parts.length * 25)) * 100);

  let category: HealthScore["category"];
  if (overallScore >= 80) category = "excellent";
  else if (overallScore >= 60) category = "good";
  else if (overallScore >= 40) category = "fair";
  else category = "poor";

  return {
    overallScore,
    savingsScore: Math.round(savingsScore),
    investmentScore: Math.round(investmentScore),
    debtScore: Math.round(debtScore),
    emergencyFundScore: Math.round(emergencyFundScore),
    category,
    ...(unknownComponents.length ? { partial: true, unknownComponents } : {}),
  };
}

export function generateRecommendations(metrics: FinancialMetrics): Recommendation[] {
  return generateLegacyRecommendationsFromMetrics(metrics);
}

export async function getProfileMetrics(demoProfileId: number): Promise<FinancialMetrics | null> {
  const p = await getDemoProfileById(demoProfileId);
  if (!p) return null;

  return {
    monthlyIncome: parseFloat(p.monthlyIncome.toString()),
    monthlyExpenses: parseFloat(p.monthlyExpenses.toString()),
    savingsRate: parseFloat(p.savingsRate.toString()),
    investmentBalance: parseFloat(p.investmentBalance.toString()),
    emergencyFundBalance: parseFloat(p.emergencyFundBalance.toString()),
    creditCardDebt: parseFloat(p.creditCardDebt.toString()),
    riskProfile: p.riskProfile,
  };
}

export async function getSpendingBreakdown(demoProfileId: number) {
  const txns = await getTransactionsByProfile(demoProfileId);
  const breakdown: Record<string, number> = {};

  txns.forEach((t) => {
    if (t.type === "expense") {
      const category = t.category;
      const amount = parseFloat(t.amount.toString());
      breakdown[category] = (breakdown[category] || 0) + amount;
    }
  });

  return breakdown;
}

export async function getUnusualExpenses(demoProfileId: number) {
  const txns = await getTransactionsByProfile(demoProfileId);
  const expenses = txns.filter((t) => t.type === "expense");
  if (expenses.length < 3) return [];

  const amounts = expenses.map((e) => parseFloat(e.amount.toString()));
  const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const stdDev = Math.sqrt(
    amounts.reduce((sq, n) => sq + Math.pow(n - avg, 2), 0) / amounts.length
  );

  return expenses
    .filter((e) => {
      const amount = parseFloat(e.amount.toString());
      return amount > avg + 2 * stdDev;
    })
    .slice(0, 5);
}

export async function getSavingsOpportunities(demoProfileId: number) {
  const breakdown = await getSpendingBreakdown(demoProfileId);
  const opportunities: Array<{ category: string; amount: number; suggestion: string }> = [];

  if (breakdown["subscription"]) {
    const reduction = breakdown["subscription"] * 0.2;
    opportunities.push({
      category: "subscription",
      amount: reduction,
      suggestion: `Cancel unused subscriptions and save ₹${Math.round(reduction)}`,
    });
  }

  if (breakdown["entertainment"]) {
    const reduction = breakdown["entertainment"] * 0.15;
    opportunities.push({
      category: "entertainment",
      amount: reduction,
      suggestion: `Reduce entertainment spending and save ₹${Math.round(reduction)}`,
    });
  }

  if (breakdown["food"]) {
    const reduction = breakdown["food"] * 0.1;
    opportunities.push({
      category: "food",
      amount: reduction,
      suggestion: `Optimize food spending through meal planning and save ₹${Math.round(reduction)}`,
    });
  }

  return opportunities.sort((a, b) => b.amount - a.amount);
}
