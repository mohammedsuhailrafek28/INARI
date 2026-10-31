import { describe, expect, it } from "vitest";
import type { WealthContext } from "../types";
import { buildGoalForecasts } from "./goalForecast";
import { buildHealthForecast } from "./healthForecast";
import { buildMonthlyOutlook } from "./monthlyOutlook";
import { buildPredictionBundle } from "./predictionEngine";
import { buildSpendingForecasts } from "./spendingForecast";

function createContext(overrides: Partial<WealthContext> = {}): WealthContext {
  const context: WealthContext = {
    activeProfile: {
      id: 1,
      name: "Prediction Demo",
      age: 32,
      occupation: "Engineer",
      riskProfile: "moderate",
    },
    monthlyIncome: 100000,
    monthlyExpenses: 65000,
    monthlySurplus: 35000,
    savingsRate: 35,
    financialHealthScore: {
      overallScore: 70,
      savingsScore: 18,
      investmentScore: 18,
      debtScore: 17,
      emergencyFundScore: 17,
      category: "good",
    },
    spendingBreakdown: {
      shopping: 25000,
      food: 12000,
      subscription: 3000,
    },
    goals: [
      {
        id: 1,
        goalType: "emergency_fund",
        targetAmount: 300000,
        currentAmount: 150000,
        timelineMonths: 12,
        priority: "high",
        monthlyContribution: 25000,
        progressPercent: 50,
      },
    ],
    recommendations: [
      {
        id: "rec-1",
        category: "savings",
        title: "Protect surplus",
        summary: "Keep surplus directed to goals.",
        reasoning: ["Savings rate is strong"],
        expectedImpact: "Improves resilience",
        effort: "low",
        riskLevel: "low",
        priority: "medium",
        nextAction: "Move surplus to emergency fund first.",
        educationalDisclaimer: "This is educational demo guidance, not licensed financial advice.",
        legacy: {
          recommendation: "Protect surplus",
          expectedBenefit: "Improves resilience",
          riskLevel: "low",
          confidenceScore: 80,
          reasons: ["Savings rate is strong"],
          category: "emergency_fund",
        },
      },
    ],
    alerts: [],
    recentTransactions: [
      {
        id: 1,
        date: new Date("2026-06-01"),
        category: "shopping",
        amount: 25000,
        type: "expense",
        description: "Shopping",
      },
    ],
    unusualExpenses: [],
    opportunities: [
      {
        category: "subscription",
        amount: 600,
        suggestion: "Cancel unused subscriptions and save ₹600",
      },
    ],
    riskProfile: {
      profile: "balanced",
      score: 70,
      explanation: "Balanced profile.",
      constraints: ["Protect emergency fund."],
      suitableActions: ["Goal-based SIP review."],
      unsuitableActions: ["Invest emergency reserves."],
    },
    insights: [
      {
        id: "insight-1",
        type: "opportunity",
        title: "Subscription savings",
        summary: "Subscription optimization can improve surplus.",
        severity: "info",
        evidence: ["Subscription opportunity exists"],
        suggestedAction: "Cancel unused subscriptions.",
        confidence: 90,
      },
    ],
    metrics: {
      monthlyIncome: 100000,
      monthlyExpenses: 65000,
      savingsRate: 35,
      investmentBalance: 250000,
      emergencyFundBalance: 150000,
      creditCardDebt: 0,
      riskProfile: "moderate",
    },
  };

  return { ...context, ...overrides };
}

describe("prediction health forecast", () => {
  it("clamps health forecast scores between 0 and 100", () => {
    const high = buildHealthForecast(
      createContext({
        financialHealthScore: {
          overallScore: 99,
          savingsScore: 25,
          investmentScore: 25,
          debtScore: 25,
          emergencyFundScore: 24,
          category: "excellent",
        },
        savingsRate: 80,
      })
    );
    const low = buildHealthForecast(
      createContext({
        financialHealthScore: {
          overallScore: 1,
          savingsScore: 0,
          investmentScore: 0,
          debtScore: 1,
          emergencyFundScore: 0,
          category: "poor",
        },
        monthlySurplus: -10000,
        savingsRate: -10,
      })
    );

    expect(high.projected90DayScore).toBeLessThanOrEqual(100);
    expect(low.projected90DayScore).toBeGreaterThanOrEqual(0);
  });

  it("projects improvement for strong savings rate without high alerts", () => {
    const forecast = buildHealthForecast(createContext());

    expect(forecast.direction).toBe("improving");
    expect(forecast.projected30DayScore).toBeGreaterThan(forecast.currentScore);
  });

  it("reduces or stabilizes projection when high alerts exist", () => {
    const forecast = buildHealthForecast(
      createContext({
        alerts: [
          {
            id: "high-alert",
            type: "emergencyFund",
            severity: "high",
            title: "Emergency fund low",
            message: "Emergency fund needs attention.",
            suggestedAction: "Rebuild emergency fund.",
            relatedMetric: "emergencyFundBalance",
          },
        ],
      })
    );

    expect(forecast.projected90DayScore).toBeLessThanOrEqual(forecast.currentScore + 1);
  });
});

describe("prediction goal forecast", () => {
  it("handles a reached goal", () => {
    const forecasts = buildGoalForecasts(
      createContext({
        goals: [
          {
            id: 2,
            goalType: "car",
            targetAmount: 100000,
            currentAmount: 100000,
            timelineMonths: 10,
            priority: "medium",
            monthlyContribution: 0,
            progressPercent: 100,
          },
        ],
      })
    );

    expect(forecasts[0]?.status).toBe("ahead");
    expect(forecasts[0]?.monthsRemaining).toBe(0);
  });

  it("handles zero contribution and negative surplus", () => {
    const forecasts = buildGoalForecasts(
      createContext({
        monthlySurplus: -5000,
        goals: [
          {
            id: 3,
            goalType: "education",
            targetAmount: 200000,
            currentAmount: 50000,
            timelineMonths: 12,
            priority: "high",
            monthlyContribution: 0,
            progressPercent: 25,
          },
        ],
      })
    );

    expect(forecasts[0]?.status).toBe("stalled");
    expect(forecasts[0]?.projectedCompletionDate).toBeNull();
  });
});

describe("prediction spending and outlook", () => {
  it("returns category direction for spending forecasts", () => {
    const forecasts = buildSpendingForecasts(createContext());

    expect(forecasts.length).toBeGreaterThan(0);
    expect(["increasing", "stable", "decreasing"]).toContain(forecasts[0]?.direction);
  });

  it("monthly outlook includes top risk and opportunity", () => {
    const context = createContext();
    const health = buildHealthForecast(context);
    const goals = buildGoalForecasts(context);
    const spending = buildSpendingForecasts(context);
    const outlook = buildMonthlyOutlook(context, health, goals, spending);

    expect(outlook.topRisk.length).toBeGreaterThan(0);
    expect(outlook.topOpportunity.length).toBeGreaterThan(0);
    expect(outlook.forecastSummary).toContain("INARI projects");
  });

  it("builds a full prediction bundle from demo context", () => {
    const bundle = buildPredictionBundle(createContext());

    expect(bundle.generatedAt).toEqual(expect.any(String));
    expect(bundle.healthForecast.currentScore).toBe(70);
    expect(bundle.goalForecasts.length).toBeGreaterThan(0);
    expect(bundle.spendingForecasts.length).toBeGreaterThan(0);
    expect(bundle.monthlyOutlook.monthLabel.length).toBeGreaterThan(0);
  });
});
