import { isKnown } from "./known";
import type { WealthContextDraft, WealthRiskProfile } from "./types";

export function calculateGoalPressure(context: Pick<WealthContextDraft, "goals" | "monthlySurplus">) {
  const monthlyGoalNeed = context.goals.reduce((sum, goal) => sum + goal.monthlyContribution, 0);
  if (monthlyGoalNeed === 0) return 0;
  return Math.min(100, Math.round((monthlyGoalNeed / Math.max(context.monthlySurplus, 1)) * 100));
}

export function calculateSpendingVolatility(context: Pick<WealthContextDraft, "unusualExpenses" | "monthlyExpenses">) {
  const unusualTotal = context.unusualExpenses.reduce((sum, item) => sum + item.amount, 0);
  return Math.min(100, Math.round((unusualTotal / Math.max(context.monthlyExpenses, 1)) * 100));
}

export function profileWealthRisk(context: WealthContextDraft): WealthRiskProfile {
  const goalPressure = calculateGoalPressure(context);
  const volatility = calculateSpendingVolatility(context);
  const health = context.financialHealthScore.overallScore;

  let score = 45;
  score += Math.min(25, context.savingsRate * 0.5);
  score += Math.min(20, Math.max(0, context.monthlySurplus / Math.max(context.monthlyIncome, 1)) * 100);
  score += health >= 70 ? 10 : health >= 50 ? 2 : -10;
  score -= goalPressure > 80 ? 15 : goalPressure > 50 ? 8 : 0;
  score -= volatility > 25 ? 10 : volatility > 10 ? 4 : 0;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const profile = score >= 75 ? "growth" : score >= 50 ? "balanced" : "conservative";
  const constraints: string[] = [];
  if (context.monthlySurplus <= 0) constraints.push("Monthly surplus is limited or negative.");
  if (goalPressure > 50) constraints.push("Goal contributions may consume a large share of surplus.");
  if (volatility > 10) constraints.push("Recent unusual expenses increase short-term uncertainty.");
  if (isKnown(context.metrics, "emergencyFund") && context.metrics.emergencyFundBalance < context.monthlyExpenses * 3) {
    constraints.push("Emergency fund is below three months of expenses.");
  }

  return {
    profile,
    score,
    explanation: `Risk capacity is ${profile} with a score of ${score}/100 based on savings rate, surplus, health score, goal pressure, and spending volatility.`,
    constraints,
    suitableActions:
      profile === "growth"
        ? ["Goal-based SIP review", "Longer-term diversified allocation planning", "Monthly portfolio check-ins"]
        : profile === "balanced"
          ? ["Emergency fund protection", "Moderate SIP readiness review", "Debt and goal contribution balancing"]
          : ["Emergency fund build-up", "Debt reduction", "Expense stabilization before new market risk"],
    unsuitableActions:
      profile === "growth"
        ? ["Concentrated speculative bets", "Investing emergency reserves"]
        : profile === "balanced"
          ? ["Large lump-sum risk without goal mapping", "Ignoring high-interest debt"]
          : ["Aggressive investing", "Taking new debt to invest", "Reducing insurance or emergency reserves"],
  };
}
