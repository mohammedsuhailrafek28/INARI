import { isKnown } from "./known";
import type { WealthAlert, WealthContextDraft } from "./types";

const currency = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;

const topSpending = (breakdown: Record<string, number>) =>
  Object.entries(breakdown).sort((a, b) => b[1] - a[1])[0];

export function generateWealthAlerts(context: WealthContextDraft): WealthAlert[] {
  const alerts: WealthAlert[] = [];
  const emergencyMonths =
    context.metrics.emergencyFundBalance / Math.max(context.monthlyExpenses, 1);
  const largestSpend = topSpending(context.spendingBreakdown);

  if (context.savingsRate < 15) {
    alerts.push({
      id: "alert-low-savings-rate",
      type: "lowSavingsRate",
      severity: "medium",
      title: "Savings rate below target",
      message: `Savings rate is ${context.savingsRate.toFixed(1)}%.`,
      suggestedAction: "Reduce one recurring discretionary category this month.",
      relatedMetric: "savingsRate",
    });
  }

  if (isKnown(context.metrics, "emergencyFund") && emergencyMonths < 3) {
    alerts.push({
      id: "alert-emergency-fund",
      type: "emergencyFund",
      severity: "high",
      title: "Emergency fund needs attention",
      message: `Emergency fund covers ${emergencyMonths.toFixed(1)} months of expenses.`,
      suggestedAction: `Build toward ${currency(context.monthlyExpenses * 3)} before increasing risk.`,
      relatedMetric: "emergencyFundBalance",
    });
  }

  if (largestSpend && largestSpend[1] > context.monthlyExpenses * 0.25) {
    alerts.push({
      id: `alert-overspending-${largestSpend[0]}`,
      type: "overspending",
      severity: "medium",
      title: "Large spending category detected",
      message: `${largestSpend[0]} is ${currency(largestSpend[1])}, over 25% of monthly expenses.`,
      suggestedAction: `Set a 10% reduction target for ${largestSpend[0]}.`,
      relatedMetric: largestSpend[0],
    });
  }

  context.unusualExpenses.forEach((expense) => {
    alerts.push({
      id: `alert-unusual-${expense.id ?? expense.category}`,
      type: "unusualExpense",
      severity: "medium",
      title: "Unusual expense detected",
      message: `${expense.description} was ${currency(expense.amount)}.`,
      suggestedAction: "Review whether this was one-time or should be budgeted.",
      relatedMetric: expense.category,
    });
  });

  context.goals.forEach((goal) => {
    if (goal.progressPercent < 25 && goal.priority === "high") {
      alerts.push({
        id: `alert-goal-behind-${goal.goalType}`,
        type: "goalBehind",
        severity: "high",
        title: "Priority goal may be behind",
        message: `${goal.goalType.replace(/_/g, " ")} is ${goal.progressPercent.toFixed(1)}% funded.`,
        suggestedAction: `Review monthly contribution of ${currency(goal.monthlyContribution)}.`,
        relatedMetric: goal.goalType,
      });
    }
  });

  context.opportunities.slice(0, 1).forEach((opportunity) => {
    alerts.push({
      id: `alert-opportunity-${opportunity.category}`,
      type: "opportunity",
      severity: "info",
      title: "Savings opportunity available",
      message: opportunity.suggestion,
      suggestedAction: opportunity.suggestion,
      relatedMetric: opportunity.category,
    });
  });

  return alerts;
}
