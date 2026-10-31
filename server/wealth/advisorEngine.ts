import { ENV } from "../_core/env";
import { isKnown } from "./known";
import { invokeLLM } from "../_core/llm";
import { logger } from "../_core/logger";
import {
  EDUCATIONAL_DISCLAIMER,
  type AdvisorIntent,
  type AdvisorResponse,
  type WealthContext,
} from "./types";
import type { AdvisorSessionContext } from "./memory/types";
import { buildPredictionBundle } from "./predictions";
import { analyzeQuestion } from "./nlp";

const currency = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;

const includesAny = (question: string, terms: string[]) =>
  terms.some((term) => question.toLowerCase().includes(term));

const topSpending = (context: WealthContext) =>
  Object.entries(context.spendingBreakdown).sort((a, b) => b[1] - a[1])[0];

const emergencyMonths = (context: WealthContext) =>
  context.metrics.emergencyFundBalance / Math.max(context.monthlyExpenses, 1);

const emergencyLabel = (context: WealthContext) =>
  isKnown(context.metrics, "emergencyFund") ? `${emergencyMonths(context).toFixed(1)} months` : "not provided yet";

export function classifyAdvisorIntent(question: string): AdvisorIntent {
  return analyzeQuestion(question).intent;
}

function toAdvisorSession(input: WealthContext | AdvisorSessionContext): AdvisorSessionContext {
  if ("wealthContext" in input) return input;
  return {
    wealthContext: input,
    conversationHistory: [],
    preferences: {
      riskTolerance: "balanced",
      investmentInterest: "moderate",
      preferredLanguage: "english",
      voiceEnabled: true,
      goalPriority: "emergencyFund",
    },
  };
}

export function classifyAdvisorIntentForSession(
  question: string,
  session: AdvisorSessionContext
): AdvisorIntent {
  const analysis = analyzeQuestion(question, { session });
  const directIntent = analysis.intent;
  if (directIntent !== "general") return directIntent;

  const normalized = analysis.normalizedQuestion;
  const lastMemory = session.conversationHistory.at(-1);
  if (!lastMemory) return directIntent;

  if (
    includesAny(normalized, ["that", "it", "you mentioned", "what about"]) &&
    lastMemory.intent === "investmentReadiness"
  ) {
    return "emergencyFund";
  }

  return directIntent;
}

function baseInsights(context: WealthContext) {
  const insights = context.insights.slice(0, 4).map((insight) => insight.summary);
  if (insights.length > 0) return insights;
  return [
    `Financial health score is ${context.financialHealthScore.overallScore}/100 (${context.financialHealthScore.category}).`,
    `Savings rate is ${context.savingsRate.toFixed(1)}%.`,
    `Monthly surplus is ${currency(context.monthlySurplus)}.`,
  ];
}

function monthlyActions(context: WealthContext, session?: AdvisorSessionContext) {
  const alertActions = context.alerts
    .filter((alert) => alert.severity === "high" || alert.severity === "medium")
    .map((alert) => alert.suggestedAction);
  const recommendationActions = context.recommendations.map((rec) => rec.nextAction);
  const insightActions = context.insights.map((insight) => insight.suggestedAction);
  const preferenceActions =
    session?.preferences.riskTolerance === "conservative"
      ? [
          "Prioritize emergency fund and debt reduction before increasing market risk.",
        ]
      : session?.preferences.riskTolerance === "growth"
        ? ["Review surplus utilization for goal-based investing after safety buffers are protected."]
        : [];

  return [...preferenceActions, ...alertActions, ...recommendationActions, ...insightActions]
    .filter(Boolean)
    .filter((action, index, all) => all.indexOf(action) === index)
    .slice(0, 3);
}

function relatedMetricsForIntent(intent: AdvisorIntent, context: WealthContext) {
  const topCategory = topSpending(context);
  const base = [
    { label: "Health score", value: `${context.financialHealthScore.overallScore}/100` },
    { label: "Savings rate", value: `${context.savingsRate.toFixed(1)}%` },
    { label: "Monthly surplus", value: currency(context.monthlySurplus) },
  ];

  if (intent === "investmentReadiness") {
    return [
      { label: "Emergency fund", value: emergencyLabel(context) },
      { label: "Risk profile", value: context.riskProfile.profile },
      { label: "Unusual expenses", value: `${context.unusualExpenses.length}` },
    ];
  }
  if (intent === "reduceSpending" && topCategory) {
    return [
      { label: "Top category", value: topCategory[0] },
      { label: "Top category spend", value: currency(topCategory[1]) },
      { label: "Monthly expenses", value: currency(context.monthlyExpenses) },
    ];
  }
  if (intent === "riskReview") {
    return [
      { label: "Risk capacity", value: `${context.riskProfile.profile} (${context.riskProfile.score}/100)` },
      { label: "Open alerts", value: `${context.alerts.length}` },
      { label: "Emergency fund", value: emergencyLabel(context) },
    ];
  }
  return base;
}

function followUpsForIntent(
  intent: AdvisorIntent,
  context: WealthContext,
  session: AdvisorSessionContext
): string[] {
  const questions: Record<AdvisorIntent, string[]> = {
    improveScore: [
      "Which score component is weakest?",
      "What should I do this month?",
      "Can I start investing?",
    ],
    reduceSpending: [
      "Where can I save the most?",
      "What should I cut first?",
      "How does this affect my goals?",
    ],
    goalProgress: [
      "Which goal needs attention?",
      "Am I saving enough monthly?",
      "What should I do this month?",
    ],
    investmentReadiness: [
      "What risk should I avoid?",
      "How much surplus do I have?",
      "What is my biggest financial risk?",
    ],
    riskReview: [
      "How do I reduce this risk?",
      "Should I invest now?",
      "What should I focus on this month?",
    ],
    monthlyPlan: [
      "Can I start investing?",
      "Where can I save the most?",
      "Which goal needs attention?",
    ],
    emergencyFund: [
      "How much emergency fund do I need?",
      "Can I invest before fixing this?",
      "What should I do this month?",
    ],
    debt: [
      "Should I pay debt or invest first?",
      "How does debt affect my score?",
      "What is my biggest financial risk?",
    ],
    forecast: [
      "What should I focus on next month?",
      "What is my biggest financial risk?",
      "When will I reach my emergency fund?",
    ],
    goalForecast: [
      "How much should I save monthly?",
      "Which goal needs attention?",
      "What should I focus on next month?",
    ],
    spendingForecast: [
      "Where can I save the most?",
      "What happens if I reduce spending by ₹5000?",
      "How does this affect my goals?",
    ],
    notificationReview: [
      "What is my most important alert?",
      "What should I do this month?",
      "What is my biggest financial risk?",
    ],
    eventHistory: [
      "What changed recently?",
      "Show my latest recommendation activity.",
      "What should I do next?",
    ],
    general: [
      "How can I improve my score?",
      "Can I start investing?",
      "What should I do this month?",
    ],
  };

  const dynamic = context.goals[0]
    ? [`Am I on track for my ${context.goals[0].goalType.replace(/_/g, " ")} goal?`]
    : [];
  const memoryFollowUps = session.conversationHistory.at(-1)
    ? [`What about the ${session.conversationHistory.at(-1)?.intent.replace(/([A-Z])/g, " $1").toLowerCase()} point you mentioned?`]
    : [];
  return [...memoryFollowUps, ...questions[intent], ...dynamic]
    .filter((question, index, all) => all.indexOf(question) === index)
    .slice(0, 4);
}

function confidenceForIntent(intent: AdvisorIntent, context: WealthContext): AdvisorResponse["confidenceLevel"] {
  if (intent === "general") return "medium";
  if (context.insights.length >= 2 || context.alerts.length >= 1) return "high";
  return "medium";
}

function answerForIntent(
  question: string,
  intent: AdvisorIntent,
  context: WealthContext,
  session: AdvisorSessionContext
) {
  const topCategory = topSpending(context);
  const primaryGoal = context.goals[0];
  const urgentAlert =
    context.alerts.find((alert) => alert.severity === "high") ??
    context.alerts.find((alert) => alert.severity === "medium");
  const riskInsight = context.insights.find((insight) => insight.type === "risk");
  const actions = monthlyActions(context, session);
  const months = emergencyMonths(context);
  const preferencePrefix =
    session.preferences.riskTolerance === "conservative"
      ? "Because your saved preference is conservative, I would protect safety buffers first. "
      : session.preferences.riskTolerance === "growth"
        ? "Because your saved preference is growth-oriented, I would still keep safety buffers intact before using surplus. "
        : "";
  const previousInvestmentQuestion = session.conversationHistory
    .slice()
    .reverse()
    .find((entry) => entry.intent === "investmentReadiness");
  const predictions = buildPredictionBundle(context, session);
  const analysis = analyzeQuestion(question, { session, predictions });
  const normalizedQuestion = analysis.normalizedQuestion;

  switch (intent) {
    case "improveScore":
      return {
        summary: `Health score is ${context.financialHealthScore.overallScore}/100.`,
        answer: `Your financial health score is ${context.financialHealthScore.overallScore}/100 (${context.financialHealthScore.category}). The fastest path is to protect surplus, strengthen emergency coverage, reduce high-interest debt if present, and keep goal contributions consistent.`,
      };
    case "reduceSpending":
    case "spendingForecast":
      if (includesAny(normalizedQuestion, ["keep spending", "what will happen", "spending like this"])) {
        const outlook = predictions.monthlyOutlook;
        const topForecast = predictions.spendingForecasts[0];
        return {
          summary: "Spending forecast is ready.",
          answer: topForecast
            ? `If spending continues like this, INARI projects next month's surplus near ${currency(outlook.expectedSurplus)} with a savings rate around ${outlook.expectedSavingsRate.toFixed(1)}%. The top spending signal is ${topForecast.category}, projected ${topForecast.direction} by ${Math.abs(topForecast.changePercent)}%. ${topForecast.suggestedAction}`
            : `If spending continues like this, INARI projects next month's surplus near ${currency(outlook.expectedSurplus)} with a savings rate around ${outlook.expectedSavingsRate.toFixed(1)}%. Keep monitoring category trends before increasing commitments.`,
        };
      }
      return topCategory
        ? {
            summary: `${topCategory[0]} is the top visible spending category.`,
            answer: `The first category to reduce is ${topCategory[0]} at ${currency(topCategory[1])}. Start with a 10% reduction target, then redirect that amount to emergency savings or your highest-priority goal.`,
          }
        : {
            summary: "Spending data is limited.",
            answer: "I do not see enough categorized spending to pick a category. Classify recent expenses first, then target the largest discretionary bucket.",
          };
    case "goalProgress":
    case "goalForecast":
      if (includesAny(normalizedQuestion, ["when will", "reach my", "completion"])) {
        const matchedForecast =
          predictions.goalForecasts.find((forecast) =>
            normalizedQuestion.includes(forecast.goalName.toLowerCase())
          ) ?? predictions.goalForecasts[0];
        return matchedForecast
          ? {
              summary: `${matchedForecast.goalName} forecast is ${matchedForecast.status}.`,
              answer:
                matchedForecast.monthsRemaining === null
                  ? `I cannot project a reliable completion date for ${matchedForecast.goalName} yet because the contribution estimate is not positive. Suggested monthly contribution is ${currency(matchedForecast.suggestedMonthlyContribution)}.`
                  : `At an estimated contribution of ${currency(matchedForecast.monthlyContributionEstimate)}, ${matchedForecast.goalName} is projected to complete in about ${matchedForecast.monthsRemaining} month${matchedForecast.monthsRemaining === 1 ? "" : "s"}. Status: ${matchedForecast.status}. This assumes current income and contributions remain stable.`,
            }
          : {
              summary: "No goal forecast is available.",
              answer: "I do not see enough goal data to forecast completion. Add a target amount, current amount, and contribution estimate first.",
            };
      }
      return primaryGoal
        ? {
            summary: `${primaryGoal.goalType.replace(/_/g, " ")} is ${primaryGoal.progressPercent.toFixed(1)}% funded.`,
            answer: `Your ${primaryGoal.goalType.replace(/_/g, " ")} goal is ${primaryGoal.progressPercent.toFixed(1)}% funded. With a monthly surplus of ${currency(context.monthlySurplus)}, review whether the suggested ${currency(primaryGoal.monthlyContribution)} monthly contribution is realistic.`,
          }
        : {
            summary: "No active goals are visible.",
            answer: "I do not see active goal data yet. Add a target amount and timeline so INARI can evaluate progress.",
          };
    case "investmentReadiness":
      return months >= 3 && context.monthlySurplus > 0 && context.unusualExpenses.length === 0
        ? {
            summary: "Investment readiness looks reasonable for a demo review.",
            answer: `${preferencePrefix}You may be ready to evaluate investing in an educational, goal-based way. Emergency coverage is ${months.toFixed(1)} months, surplus is ${currency(context.monthlySurplus)}, and your risk capacity is ${context.riskProfile.profile}. Keep emergency reserves intact and avoid concentrated bets.`,
          }
        : {
            summary: "Investment readiness needs caution.",
            answer: `${preferencePrefix}I would be cautious about investing more right now. Emergency coverage is ${months.toFixed(1)} months, surplus is ${currency(context.monthlySurplus)}, and unusual expenses count is ${context.unusualExpenses.length}. Stabilize those first, then revisit SIP sizing.`,
          };
    case "riskReview":
      if (urgentAlert) {
        return {
          summary: urgentAlert.title,
          answer: `Your biggest visible risk is: ${urgentAlert.title}. ${urgentAlert.message} Suggested action: ${urgentAlert.suggestedAction}`,
        };
      }
      if (riskInsight) {
        return {
          summary: riskInsight.title,
          answer: `Your biggest visible risk is: ${riskInsight.title}. ${riskInsight.summary} Suggested action: ${riskInsight.suggestedAction}`,
        };
      }
      return {
        summary: `Risk profile is ${context.riskProfile.profile}.`,
        answer: `Your current risk profile is ${context.riskProfile.profile}. Main constraints: ${context.riskProfile.constraints.join(" ") || "No major constraints detected in demo data."}`,
      };
    case "monthlyPlan":
    case "forecast":
      return {
        summary: `${predictions.monthlyOutlook.monthLabel} outlook is ready.`,
        answer: `This month, use the ${predictions.monthlyOutlook.monthLabel} outlook: expected surplus is about ${currency(predictions.monthlyOutlook.expectedSurplus)} and expected savings rate is ${predictions.monthlyOutlook.expectedSavingsRate.toFixed(1)}%. Focus on: ${predictions.monthlyOutlook.recommendedFocus} Keep the plan narrow so it is easy to execute and review next month.`,
      };
    case "notificationReview":
      return {
        summary: `${context.alerts.length} wealth alerts are visible.`,
        answer:
          context.alerts.length > 0
            ? `The most important visible alert is ${context.alerts[0].title}. ${context.alerts[0].message} Suggested action: ${context.alerts[0].suggestedAction}`
            : "I do not see active wealth alerts in this profile right now. Keep monitoring notifications for unusual spending, goal pressure, and risk changes.",
      };
    case "eventHistory":
      return {
        summary: "Recent product intelligence is available through the event timeline.",
        answer:
          "I can use event history to explain recent advisor, prediction, recommendation, alert, and profile activity. In this demo response, focus on the latest visible insights and alerts before making changes.",
      };
    case "emergencyFund":
      if (!isKnown(context.metrics, "emergencyFund")) {
        return {
          summary: "Emergency fund balance has not been provided.",
          answer: `I cannot tell how many months your emergency fund covers because you have not told me the balance yet. Add it and I will compare it with your average monthly spending of ${currency(context.monthlyExpenses)}.`,
        };
      }
      return {
        summary: `Emergency fund covers ${months.toFixed(1)} months.`,
        answer: `${previousInvestmentQuestion ? "Following up on your investing question: " : ""}Your emergency fund covers about ${months.toFixed(1)} months of expenses. A practical target is at least ${currency(context.monthlyExpenses * 3)} before adding more investment risk.`,
      };
    case "debt":
      if (!isKnown(context.metrics, "creditCardDebt")) {
        return {
          summary: "Credit card debt has not been provided.",
          answer: "I do not know your credit card balance yet, so I cannot say whether debt should come before investing. Tell me the outstanding amount and I will factor it in.",
        };
      }
      return {
        summary: `Credit card debt is ${currency(context.metrics.creditCardDebt)}.`,
        answer:
          context.metrics.creditCardDebt > 0
            ? `You show ${currency(context.metrics.creditCardDebt)} in credit card debt. Treat high-interest payoff as a priority before increasing risky investments, because reducing expensive debt can improve cash flow immediately.`
            : "I do not see credit card debt in this profile. Keep balances paid on time and avoid using debt to fund investments.",
      };
    default:
      return {
        summary: "INARI reviewed your current context.",
        answer: `For ${context.activeProfile.name}, focus on cash-flow stability, emergency reserves, and goal-based decisions that fit a ${context.riskProfile.profile} risk capacity.`,
      };
  }
}

export function buildFallbackAdvisorResponse(
  question: string,
  input: WealthContext | AdvisorSessionContext
): AdvisorResponse {
  const session = toAdvisorSession(input);
  const context = session.wealthContext;
  const analysis = analyzeQuestion(question, { session });
  const intent = classifyAdvisorIntentForSession(question, session);
  const response = answerForIntent(question, intent, context, session);

  return {
    answer: response.answer,
    summary: response.summary,
    keyInsights: baseInsights(context),
    suggestedNextActions: monthlyActions(context, session),
    followUpQuestions: followUpsForIntent(intent, context, session),
    relatedMetrics: relatedMetricsForIntent(intent, context),
    confidenceLevel: analysis.confidence >= 0.9 ? "high" : confidenceForIntent(intent, context),
    mode: "fallback",
    disclaimer: EDUCATIONAL_DISCLAIMER,
  };
}

function normalizeAdvisorResponse(parsed: Partial<AdvisorResponse>, fallback: AdvisorResponse): AdvisorResponse {
  return {
    answer: String(parsed.answer || fallback.answer),
    summary: String(parsed.summary || fallback.summary),
    keyInsights: Array.isArray(parsed.keyInsights)
      ? parsed.keyInsights.map(String).slice(0, 5)
      : fallback.keyInsights,
    suggestedNextActions: Array.isArray(parsed.suggestedNextActions)
      ? parsed.suggestedNextActions.map(String).slice(0, 5)
      : fallback.suggestedNextActions,
    followUpQuestions: Array.isArray(parsed.followUpQuestions)
      ? parsed.followUpQuestions.map(String).slice(0, 5)
      : fallback.followUpQuestions,
    relatedMetrics: Array.isArray(parsed.relatedMetrics)
      ? parsed.relatedMetrics
          .map((metric) => ({
            label: String((metric as { label?: unknown }).label ?? ""),
            value: String((metric as { value?: unknown }).value ?? ""),
          }))
          .filter((metric) => metric.label && metric.value)
          .slice(0, 5)
      : fallback.relatedMetrics,
    confidenceLevel:
      parsed.confidenceLevel === "high" || parsed.confidenceLevel === "low"
        ? parsed.confidenceLevel
        : "medium",
    mode: "llm",
    disclaimer: parsed.disclaimer || EDUCATIONAL_DISCLAIMER,
  };
}

function parseAdvisorJson(content: string, fallback: AdvisorResponse): AdvisorResponse | null {
  try {
    const parsed = JSON.parse(content) as Partial<AdvisorResponse>;
    if (!parsed.answer) return null;
    return normalizeAdvisorResponse(parsed, fallback);
  } catch {
    return null;
  }
}

export async function answerWealthAdvisorQuestion(
  question: string,
  input: WealthContext | AdvisorSessionContext,
  options: { allowExternalLlm?: boolean } = {}
): Promise<AdvisorResponse> {
  const session = toAdvisorSession(input);
  const fallback = buildFallbackAdvisorResponse(question, session);
  if (!ENV.forgeApiKey || options.allowExternalLlm === false) return fallback;

  try {
    const response = await invokeLLM({
      model: "gpt-4o-mini",
      maxTokens: 900,
      responseFormat: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are INARI's educational wealth intelligence assistant. Classify intent, answer from provided context, avoid licensed financial advice, never promise returns, and always include a disclaimer.",
        },
        {
          role: "user",
          content: JSON.stringify({
            question,
            nlpAnalysis: analyzeQuestion(question, { session }),
            advisorSessionContext: session,
            responseShape: {
              answer: "string",
              summary: "string",
              keyInsights: ["string"],
              suggestedNextActions: ["string"],
              followUpQuestions: ["string"],
              relatedMetrics: [{ label: "string", value: "string" }],
              confidenceLevel: "low | medium | high",
              disclaimer: "string",
            },
          }),
        },
      ],
    });

    const content = response.choices[0]?.message.content;
    const text = typeof content === "string" ? content : JSON.stringify(content);
    return parseAdvisorJson(text, fallback) ?? fallback;
  } catch (error) {
    logger.warn("[WealthAdvisor] LLM unavailable; using fallback mode.", { error });
    return fallback;
  }
}
