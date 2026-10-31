import { isKnown } from "./known";
import type { FinancialMetrics, Recommendation as LegacyRecommendation } from "../financialEngine";
import {
  EDUCATIONAL_DISCLAIMER,
  type WealthContextDraft,
  type WealthRecommendation,
} from "./types";

const currency = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;

const toLegacy = (rec: WealthRecommendation): LegacyRecommendation => rec.legacy;

function makeRecommendation(
  recommendation: Omit<WealthRecommendation, "educationalDisclaimer" | "legacy"> & {
    legacy: LegacyRecommendation;
  }
): WealthRecommendation {
  return {
    ...recommendation,
    educationalDisclaimer: EDUCATIONAL_DISCLAIMER,
  };
}

export function generateWealthRecommendations(
  context: Pick<
    WealthContextDraft,
    | "monthlyIncome"
    | "monthlyExpenses"
    | "monthlySurplus"
    | "savingsRate"
    | "goals"
    | "metrics"
  >
): WealthRecommendation[] {
  const metrics = context.metrics;
  const recommendations: WealthRecommendation[] = [];
  const emergencyMonths = metrics.emergencyFundBalance / Math.max(metrics.monthlyExpenses, 1);

  if (isKnown(metrics, "emergencyFund") && metrics.emergencyFundBalance < metrics.monthlyExpenses * 3) {
    recommendations.push(
      makeRecommendation({
        id: "emergency-fund-priority",
        category: "savings",
        title: `Build emergency fund to ${currency(metrics.monthlyExpenses * 3)}`,
        summary: "Create a stronger safety buffer before taking additional financial risk.",
        reasoning: [
          `Emergency fund covers ${emergencyMonths.toFixed(1)} months of expenses`,
          "A 3-6 month buffer reduces dependence on high-interest debt",
        ],
        expectedImpact: "Improves resilience against income shocks and unexpected expenses.",
        effort: "medium",
        riskLevel: "low",
        priority: "high",
        nextAction: `Automate a monthly transfer toward ${currency(metrics.monthlyExpenses * 3)}.`,
        legacy: {
          recommendation: `Build your emergency fund to ${currency(metrics.monthlyExpenses * 3)}`,
          expectedBenefit:
            "Protect yourself against unexpected financial hardships with 3-6 months of expenses saved",
          riskLevel: "low",
          confidenceScore: 95,
          reasons: [
            `Current emergency fund covers only ${emergencyMonths.toFixed(1)} months of expenses`,
            "Industry standard recommends 3-6 months of expenses",
            "Provides financial security and peace of mind",
          ],
          category: "emergency_fund",
        },
      })
    );
  }

  if (metrics.savingsRate > 25) {
    const sipAmount = Math.round(metrics.monthlyIncome * 0.05);
    recommendations.push(
      makeRecommendation({
        id: "sip-readiness",
        category: "investment",
        title: `Evaluate SIP increase of ${currency(sipAmount)}`,
        summary: "Your cash flow can support disciplined, goal-aligned investing if safety buffers remain intact.",
        reasoning: [
          `Savings rate is ${metrics.savingsRate.toFixed(1)}%`,
          "Recurring investments can benefit from rupee cost averaging",
          `Profile risk setting is ${metrics.riskProfile}`,
        ],
        expectedImpact: "Builds long-term wealth habits without relying on timing the market.",
        effort: "low",
        riskLevel: metrics.riskProfile === "aggressive" ? "high" : "moderate",
        priority: "medium",
        nextAction: "Confirm emergency fund and goal contributions before changing SIP amount.",
        legacy: {
          recommendation: `Increase your SIP by ${currency(sipAmount)}`,
          expectedBenefit:
            "Accelerate wealth creation through systematic investment with your improved savings capacity",
          riskLevel: "moderate",
          confidenceScore: 88,
          reasons: [
            `Your savings rate is ${metrics.savingsRate.toFixed(1)}% - above average`,
            "Consistent monthly investments benefit from rupee cost averaging",
            "Align with your risk profile and avoid taking more risk than the profile supports",
          ],
          category: "investment",
        },
      })
    );
  }

  if (isKnown(metrics, "creditCardDebt") && metrics.creditCardDebt > metrics.monthlyIncome * 0.5) {
    const payoffTarget = Math.round(metrics.creditCardDebt * 0.3);
    recommendations.push(
      makeRecommendation({
        id: "high-interest-debt-priority",
        category: "debt",
        title: `Prioritize paying down ${currency(payoffTarget)} of credit card debt`,
        summary: "High-interest debt is likely the most urgent drag on financial flexibility.",
        reasoning: [
          `Debt is ${(metrics.creditCardDebt / metrics.monthlyIncome).toFixed(1)}x monthly income`,
          "Credit-card interest can exceed expected investment returns",
        ],
        expectedImpact: "Improves cash flow, stress level, and potential lending readiness.",
        effort: "high",
        riskLevel: "low",
        priority: "high",
        nextAction: "Set a fixed payoff target before adding new market exposure.",
        legacy: {
          recommendation: `Prioritize paying down ${currency(payoffTarget)} of credit card debt`,
          expectedBenefit:
            "Reduce high-interest debt burden and improve your credit score and financial flexibility",
          riskLevel: "high",
          confidenceScore: 92,
          reasons: [
            `Your credit card debt is ${(metrics.creditCardDebt / metrics.monthlyIncome).toFixed(1)}x your monthly income`,
            "Credit card interest rates typically exceed 18% annually",
            "Debt repayment can provide a predictable reduction in interest burden",
          ],
          category: "debt_management",
        },
      })
    );
  }

  if (isKnown(metrics, "creditCardDebt") && metrics.creditCardDebt > 0) {
    recommendations.push(
      makeRecommendation({
        id: "debt-before-new-risk",
        category: "debt",
        title: "Compare debt payoff against new investments",
        summary: "Even manageable credit-card debt should be reviewed before adding new market risk.",
        reasoning: [
          `Current credit card debt is ${currency(metrics.creditCardDebt)}`,
          "Debt reduction is often lower risk than investing stretched cash flow",
          "Lower debt can improve future lending eligibility",
        ],
        expectedImpact: "Improves monthly flexibility and reduces avoidable interest drag.",
        effort: "medium",
        riskLevel: "low",
        priority: metrics.creditCardDebt > metrics.monthlyIncome * 0.5 ? "high" : "medium",
        nextAction: "Set a small fixed debt payoff amount before raising investment contributions.",
        legacy: {
          recommendation: "Compare debt payoff against new investments before adding risk",
          expectedBenefit:
            "High-interest debt reduction can create a predictable improvement to monthly cash flow and financial resilience",
          riskLevel: "low",
          confidenceScore: 86,
          reasons: [
            `Current credit card debt is ${currency(metrics.creditCardDebt)}`,
            "Debt reduction is often lower risk than investing borrowed or stretched cash flow",
            "Lower debt can improve future lending eligibility and lead quality",
          ],
          category: "debt_management",
        },
      })
    );
  }

  if (isKnown(metrics, "investments") && metrics.investmentBalance < metrics.monthlyIncome * 6) {
    recommendations.push(
      makeRecommendation({
        id: "starter-diversified-investing",
        category: "investment",
        title: "Consider diversified, goal-based investing",
        summary: "Investment balance is below a common early wealth-building benchmark for this income level.",
        reasoning: [
          "Investment balance is below six months of income",
          `Risk preference is ${metrics.riskProfile}`,
        ],
        expectedImpact: "Creates a long-term wealth base while keeping risk aligned to profile.",
        effort: "medium",
        riskLevel: metrics.riskProfile === "conservative" ? "low" : "moderate",
        priority: "medium",
        nextAction: "Review suitable diversified options with a qualified professional.",
        legacy: {
          recommendation: "Start investing in diversified mutual funds or stocks",
          expectedBenefit:
            "Build long-term wealth through market-linked investments aligned with your risk tolerance",
          riskLevel: metrics.riskProfile === "conservative" ? "low" : "moderate",
          confidenceScore: 85,
          reasons: [
            "Your investment balance is below recommended levels for your income",
            `Your risk profile is ${metrics.riskProfile} - choose investments accordingly`,
            "Long-term investing benefits from compound growth",
          ],
          category: "investment",
        },
      })
    );
  }

  if (metrics.savingsRate >= 20 && isKnown(metrics, "creditCardDebt") && metrics.creditCardDebt <= metrics.monthlyIncome * 0.5) {
    const starterSip = Math.round(Math.max(0, context.monthlySurplus) * 0.25);
    recommendations.push(
      makeRecommendation({
        id: "starter-sip-readiness",
        category: "habit",
        title: `Evaluate SIP readiness near ${currency(starterSip)}`,
        summary: "A starter recurring investment habit can be safer than a large sudden increase.",
        reasoning: [
          `Savings rate is ${metrics.savingsRate.toFixed(1)}%`,
          `Monthly surplus is ${currency(context.monthlySurplus)}`,
          "Starter SIP sizing should remain sustainable through volatility",
        ],
        expectedImpact: "Builds a disciplined wealth habit while preserving cash-flow room.",
        effort: "low",
        riskLevel: metrics.riskProfile === "conservative" ? "low" : "moderate",
        priority: "medium",
        nextAction: "Choose a small recurring amount only after required bills and goals are covered.",
        legacy: {
          recommendation: `Evaluate SIP readiness with a starter amount near ${currency(starterSip)}`,
          expectedBenefit:
            "Turns excess monthly cash flow into a disciplined wealth-building habit while leaving room for bills and goals",
          riskLevel: metrics.riskProfile === "conservative" ? "low" : "moderate",
          confidenceScore: 78,
          reasons: [
            `Savings rate is ${metrics.savingsRate.toFixed(1)}%, which suggests recurring investment capacity`,
            "A smaller starter SIP is easier to sustain through market volatility",
            "This is educational guidance and should be matched to personal risk tolerance",
          ],
          category: "investment",
        },
      })
    );
  }

  if (metrics.savingsRate < 15) {
    const reduction = Math.round(metrics.monthlyExpenses * 0.1);
    recommendations.push(
      makeRecommendation({
        id: "cashflow-spending-reset",
        category: "cashflow",
        title: `Reduce discretionary spending by ${currency(reduction)}`,
        summary: "Savings rate is below target, so the first wealth lever is cash-flow improvement.",
        reasoning: [
          `Savings rate is ${metrics.savingsRate.toFixed(1)}%`,
          "Small recurring reductions can compound into meaningful savings",
        ],
        expectedImpact: "Creates more room for emergency savings, debt payoff, and goals.",
        effort: "medium",
        riskLevel: "low",
        priority: "high",
        nextAction: "Audit subscriptions, dining, shopping, and entertainment this week.",
        legacy: {
          recommendation: `Review and reduce discretionary spending by ${currency(reduction)}`,
          expectedBenefit:
            "Increase your savings rate and free up capital for investments and financial goals",
          riskLevel: "low",
          confidenceScore: 80,
          reasons: [
            `Your savings rate is ${metrics.savingsRate.toFixed(1)}% - below recommended 20-30%`,
            "Identify subscriptions, dining, and entertainment expenses to optimize",
            "Small reductions compound into significant savings over time",
          ],
          category: "spending",
        },
      })
    );
  }

  if (emergencyMonths >= 3 && context.monthlySurplus > 0) {
    recommendations.push(
      makeRecommendation({
        id: "goal-based-allocation-plan",
        category: "risk",
        title: `Set a ${metrics.riskProfile} goal-based allocation plan`,
        summary: "Separate short-term safety money from long-term wealth-building money.",
        reasoning: [
          `Emergency fund covers ${emergencyMonths.toFixed(1)} months`,
          `Monthly surplus is ${currency(context.monthlySurplus)}`,
        ],
        expectedImpact: "Reduces accidental over-risking while keeping wealth growth intentional.",
        effort: "medium",
        riskLevel:
          metrics.riskProfile === "aggressive"
            ? "high"
            : metrics.riskProfile === "moderate"
              ? "moderate"
              : "low",
        priority: "medium",
        nextAction: "Map each goal to a timeline before selecting investment exposure.",
        legacy: {
          recommendation: `Set a goal-based ${metrics.riskProfile} allocation plan before increasing market exposure`,
          expectedBenefit:
            "Keeps investing aligned with emergency reserves, goal timelines, and risk capacity instead of chasing short-term returns",
          riskLevel:
            metrics.riskProfile === "aggressive"
              ? "high"
              : metrics.riskProfile === "moderate"
                ? "moderate"
                : "low",
          confidenceScore: 82,
          reasons: [
            `Emergency fund covers ${emergencyMonths.toFixed(1)} months of expenses`,
            `Monthly surplus is approximately ${currency(context.monthlySurplus)}`,
            "Goal-based allocation helps separate short-term safety from long-term wealth creation",
          ],
          category: "investment",
        },
      })
    );
  }

  if (context.goals.length > 0) {
    const topGoal = context.goals[0];
    recommendations.push(
      makeRecommendation({
        id: `goal-habit-${topGoal.goalType}`,
        category: "goal",
        title: `Protect the ${topGoal.goalType.replace(/_/g, " ")} goal habit`,
        summary: `Current progress is ${topGoal.progressPercent.toFixed(1)}% toward ${currency(topGoal.targetAmount)}.`,
        reasoning: [`Priority is ${topGoal.priority}`, `Suggested contribution is ${currency(topGoal.monthlyContribution)}`],
        expectedImpact: "Keeps near-term goals visible while the app evaluates investing readiness.",
        effort: "low",
        riskLevel: "low",
        priority: topGoal.priority === "high" ? "high" : "medium",
        nextAction: `Review whether ${currency(topGoal.monthlyContribution)} monthly is realistic.`,
        legacy: {
          recommendation: `Track monthly progress for your ${topGoal.goalType.replace(/_/g, " ")} goal`,
          expectedBenefit: "Improves goal completion visibility and reduces missed contribution risk",
          riskLevel: "low",
          confidenceScore: 77,
          reasons: [
            `Goal progress is ${topGoal.progressPercent.toFixed(1)}%`,
            `Timeline is ${topGoal.timelineMonths} months`,
            "Goal-based planning supports better money allocation",
          ],
          category: "savings",
        },
      })
    );
  }

  return recommendations;
}

export function generateLegacyRecommendationsFromMetrics(metrics: FinancialMetrics): LegacyRecommendation[] {
  const draft = {
    monthlyIncome: metrics.monthlyIncome,
    monthlyExpenses: metrics.monthlyExpenses,
    monthlySurplus: metrics.monthlyIncome - metrics.monthlyExpenses,
    savingsRate: metrics.savingsRate,
    goals: [],
    metrics,
  };

  return generateWealthRecommendations(draft).map(toLegacy);
}
