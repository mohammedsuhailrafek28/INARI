import type { WealthContext } from "../types";
import type { GoalForecast, HealthForecast, MonthlyOutlook, SpendingForecast } from "./types";

const nextMonthLabel = () =>
  new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(
    new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
  );

export function buildMonthlyOutlook(
  context: WealthContext,
  healthForecast: HealthForecast,
  goalForecasts: GoalForecast[],
  spendingForecasts: SpendingForecast[]
): MonthlyOutlook {
  const projectedSpend = spendingForecasts.reduce(
    (sum, forecast) => sum + forecast.projectedMonthlySpend,
    0
  );
  const spendingDelta = projectedSpend
    ? projectedSpend - spendingForecasts.reduce((sum, forecast) => sum + forecast.currentMonthlySpend, 0)
    : 0;
  const expectedSurplus = Math.round(context.monthlySurplus - spendingDelta);
  const expectedSavingsRate =
    context.monthlyIncome > 0 ? Math.round((expectedSurplus / context.monthlyIncome) * 1000) / 10 : 0;

  const topAlert =
    context.alerts.find((alert) => alert.severity === "high") ??
    context.alerts.find((alert) => alert.severity === "medium") ??
    context.alerts[0];
  const behindGoal = goalForecasts.find((goal) => goal.status === "behind" || goal.status === "stalled");
  const decreasingSpend = spendingForecasts.find((forecast) => forecast.direction === "decreasing");
  const topRecommendation = context.recommendations[0];

  const topRisk =
    topAlert?.title ??
    behindGoal?.goalName ??
    (healthForecast.direction === "declining" ? "Financial health score may soften" : "No major risk detected");
  const topOpportunity =
    decreasingSpend?.suggestedAction ??
    topRecommendation?.nextAction ??
    context.insights.find((insight) => insight.type === "opportunity")?.suggestedAction ??
    "Keep surplus consistent and review goals weekly.";
  const recommendedFocus = topAlert?.suggestedAction
    ? topAlert.suggestedAction
    : behindGoal
      ? `Stabilize ${behindGoal.goalName} funding.`
      : topOpportunity;

  return {
    monthLabel: nextMonthLabel(),
    expectedSurplus,
    expectedSavingsRate,
    topRisk,
    topOpportunity,
    recommendedFocus,
    forecastSummary: `For ${nextMonthLabel()}, INARI projects a ${healthForecast.direction} health-score trend with expected surplus near ₹${expectedSurplus.toLocaleString("en-IN")}.`,
    confidence:
      healthForecast.confidence === "high" && spendingForecasts.some((forecast) => forecast.confidence === "high")
        ? "high"
        : "medium",
  };
}
