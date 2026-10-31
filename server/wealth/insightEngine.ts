import { isKnown } from "./known";
import type { WealthContextDraft, WealthInsight } from "./types";

const currency = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;

const topSpending = (breakdown: Record<string, number>) =>
  Object.entries(breakdown).sort((a, b) => b[1] - a[1])[0];

export function generateInsights(context: WealthContextDraft): WealthInsight[] {
  const insights: WealthInsight[] = [];
  const emergencyMonths =
    context.metrics.emergencyFundBalance / Math.max(context.monthlyExpenses, 1);
  const largestSpend = topSpending(context.spendingBreakdown);

  if (context.savingsRate >= 25) {
    insights.push({
      id: "win-high-savings-rate",
      type: "win",
      title: "Strong savings rate",
      summary: `You are saving ${context.savingsRate.toFixed(1)}% of monthly income.`,
      severity: "info",
      evidence: [`Income: ${currency(context.monthlyIncome)}`, `Expenses: ${currency(context.monthlyExpenses)}`],
      suggestedAction: "Protect this habit before increasing investment risk.",
      confidence: 92,
    });
  } else if (context.savingsRate < 15) {
    insights.push({
      id: "warning-low-savings-rate",
      type: "warning",
      title: "Savings rate needs attention",
      summary: `Savings rate is ${context.savingsRate.toFixed(1)}%, below the common 20% benchmark.`,
      severity: "medium",
      evidence: [`Monthly surplus: ${currency(context.monthlySurplus)}`],
      suggestedAction: "Pick one discretionary category and reduce it by 10% this month.",
      confidence: 86,
    });
  }

  if (largestSpend) {
    const [category, amount] = largestSpend;
    const share = amount / Math.max(context.monthlyExpenses, 1);
    insights.push({
      id: `opportunity-top-spend-${category}`,
      type: share > 0.25 ? "warning" : "opportunity",
      title: `${category} is the largest spending category`,
      summary: `${category} accounts for ${currency(amount)} of visible expenses.`,
      severity: share > 0.25 ? "medium" : "info",
      evidence: [`Category share: ${(share * 100).toFixed(1)}% of monthly expenses`],
      suggestedAction: `Try a 10% reduction in ${category} and review impact after two weeks.`,
      confidence: 78,
    });
  }

  if (isKnown(context.metrics, "emergencyFund") && emergencyMonths < 3) {
    insights.push({
      id: "risk-emergency-fund-low",
      type: "risk",
      title: "Emergency fund below target",
      summary: `Emergency fund covers ${emergencyMonths.toFixed(1)} months of expenses.`,
      severity: "high",
      evidence: [`Balance: ${currency(context.metrics.emergencyFundBalance)}`, `Monthly expenses: ${currency(context.monthlyExpenses)}`],
      suggestedAction: `Build toward at least ${currency(context.monthlyExpenses * 3)} before taking new risk.`,
      confidence: 95,
    });
  }

  context.goals.forEach((goal) => {
    if (goal.progressPercent < 25 && goal.timelineMonths <= 24) {
      insights.push({
        id: `goal-pressure-${goal.goalType}`,
        type: "goal",
        title: `${goal.goalType.replace(/_/g, " ")} goal may need attention`,
        summary: `Progress is ${goal.progressPercent.toFixed(1)}% with ${goal.timelineMonths} months planned.`,
        severity: goal.priority === "high" ? "high" : "medium",
        evidence: [`Current: ${currency(goal.currentAmount)}`, `Target: ${currency(goal.targetAmount)}`],
        suggestedAction: `Review whether ${currency(goal.monthlyContribution)} per month is realistic.`,
        confidence: 74,
      });
    }
  });

  if (context.financialHealthScore.overallScore >= 70) {
    insights.push({
      id: "trend-health-stable",
      type: "trend",
      title: "Financial health is stable",
      summary: `Score is ${context.financialHealthScore.overallScore}/100 (${context.financialHealthScore.category}).`,
      severity: "info",
      evidence: [
        `Savings score: ${context.financialHealthScore.savingsScore}/25`,
        `Debt score: ${context.financialHealthScore.debtScore}/25`,
      ],
      suggestedAction: "Maintain cash-flow discipline and review goals monthly.",
      confidence: 84,
    });
  }

  context.opportunities.slice(0, 1).forEach((opportunity) => {
    insights.push({
      id: `opportunity-save-${opportunity.category}`,
      type: "opportunity",
      title: "Savings opportunity found",
      summary: opportunity.suggestion,
      severity: "info",
      evidence: [`Estimated monthly savings: ${currency(opportunity.amount)}`],
      suggestedAction: opportunity.suggestion,
      confidence: 76,
    });
  });

  return insights;
}
