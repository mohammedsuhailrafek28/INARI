import type { FinancialMetrics, HealthScore, Recommendation as LegacyRecommendation } from "../financialEngine";

export const EDUCATIONAL_DISCLAIMER =
  "This is educational demo guidance, not licensed financial advice. Review decisions with a qualified financial professional before acting.";

export type InsightType = "win" | "warning" | "opportunity" | "trend" | "goal" | "risk";
export type Severity = "info" | "medium" | "high";
export type WealthRiskProfileName = "conservative" | "balanced" | "growth";

export type ActiveProfile = {
  id: number;
  name: string;
  age: number;
  occupation: string;
  riskProfile: FinancialMetrics["riskProfile"];
};

export type WealthGoal = {
  id?: number;
  goalType: string;
  targetAmount: number;
  currentAmount: number;
  timelineMonths: number;
  priority: string;
  monthlyContribution: number;
  progressPercent: number;
};

export type WealthTransaction = {
  id?: number;
  date: Date;
  category: string;
  amount: number;
  type: string;
  description: string;
};

export type WealthOpportunity = {
  category: string;
  amount: number;
  suggestion: string;
};

export type WealthInsight = {
  id: string;
  type: InsightType;
  title: string;
  summary: string;
  severity: Severity;
  evidence: string[];
  suggestedAction: string;
  confidence: number;
};

export type WealthRecommendationCategory =
  | "cashflow"
  | "savings"
  | "investment"
  | "debt"
  | "goal"
  | "risk"
  | "habit";

export type WealthRecommendation = {
  id: string;
  category: WealthRecommendationCategory;
  title: string;
  summary: string;
  reasoning: string[];
  expectedImpact: string;
  effort: "low" | "medium" | "high";
  riskLevel: "low" | "moderate" | "high";
  priority: "low" | "medium" | "high";
  nextAction: string;
  educationalDisclaimer: string;
  legacy: LegacyRecommendation;
};

export type WealthAlertType =
  | "overspending"
  | "goalBehind"
  | "lowSavingsRate"
  | "unusualExpense"
  | "emergencyFund"
  | "opportunity";

export type WealthAlert = {
  id: string;
  type: WealthAlertType;
  severity: Severity;
  title: string;
  message: string;
  suggestedAction: string;
  relatedMetric: string;
};

export type WealthRiskProfile = {
  profile: WealthRiskProfileName;
  score: number;
  explanation: string;
  constraints: string[];
  suitableActions: string[];
  unsuitableActions: string[];
};

export type WealthContext = {
  activeProfile: ActiveProfile;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlySurplus: number;
  savingsRate: number;
  financialHealthScore: HealthScore;
  spendingBreakdown: Record<string, number>;
  goals: WealthGoal[];
  recommendations: WealthRecommendation[];
  alerts: WealthAlert[];
  recentTransactions: WealthTransaction[];
  unusualExpenses: WealthTransaction[];
  opportunities: WealthOpportunity[];
  riskProfile: WealthRiskProfile;
  insights: WealthInsight[];
  metrics: FinancialMetrics;
  /** "imported" = derived from the user's ledger; absent/"demo" = seeded persona. */
  dataSource?: "imported" | "demo";
  dataAsOf?: string | null;
  /** user-supplied fields that are still unknown (only set in imported mode) */
  unknownFields?: string[];
};

export type AdvisorResponse = {
  answer: string;
  summary: string;
  keyInsights: string[];
  suggestedNextActions: string[];
  followUpQuestions: string[];
  relatedMetrics: Array<{
    label: string;
    value: string;
  }>;
  confidenceLevel: "low" | "medium" | "high";
  mode: "llm" | "fallback";
  disclaimer: string;
};

export type AdvisorIntent =
  | "improveScore"
  | "reduceSpending"
  | "goalProgress"
  | "investmentReadiness"
  | "riskReview"
  | "monthlyPlan"
  | "emergencyFund"
  | "debt"
  | "forecast"
  | "goalForecast"
  | "spendingForecast"
  | "notificationReview"
  | "eventHistory"
  | "general";

export type WealthContextDraft = Omit<
  WealthContext,
  "recommendations" | "alerts" | "riskProfile" | "insights"
> & {
  recommendations?: WealthRecommendation[];
  alerts?: WealthAlert[];
  riskProfile?: WealthRiskProfile;
  insights?: WealthInsight[];
};
