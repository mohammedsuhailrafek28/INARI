/**
 * SYNTHETIC fixtures matching shared/inari/contracts.ts.
 * Every value here is invented for UI development. They are NOT calculations.
 * Stub procedures return these with implementation: "stub".
 */
import type {
  Snapshot, ImportPreview, ImportBatch, LedgerTransaction, SimulationResult, Subscription,
  MonthlyReport, IntentAnalysis, InariAdvisorResponse, Goal, CategoryBreakdownItem, LearnedRule,
} from "./contracts";

export const FIXTURE_DISCLAIMER =
  "Synthetic demo data. Educational guidance only, not licensed financial advice.";

export const sampleTransaction: LedgerTransaction = {
  id: "fx-txn-1", fingerprint: "fx-fp-1", batchId: "fx-batch-1", source: "csv",
  postedOn: "2026-09-03", amountPaise: 45000, amount: 450, direction: "debit",
  merchant: "Swiggy", narration: "UPI/DR/000000000001/SWIGGY (synthetic)", instrument: "upi",
  accountLabel: "Demo Bank ••0000", category: "dining", categorySource: "rule", categoryConfidence: 0.9,
  correctedFrom: null, isTransfer: false, isRecurring: false, possibleDuplicateOf: null, balanceAfterPaise: null,
};

export const sampleTransactions: LedgerTransaction[] = [
  sampleTransaction,
  { ...sampleTransaction, id: "fx-txn-2", fingerprint: "fx-fp-2", postedOn: "2026-09-01", amountPaise: 8500000, amount: 85000,
    direction: "credit", merchant: "Acme Pvt Ltd", narration: "NEFT SALARY SEP (synthetic)", instrument: "neft",
    category: "salary", categoryConfidence: 0.95 },
  { ...sampleTransaction, id: "fx-txn-3", fingerprint: "fx-fp-3", postedOn: "2026-09-05", amountPaise: 64900, amount: 649,
    merchant: "Netflix", narration: "AUTOPAY NETFLIX (synthetic)", instrument: "auto_debit", category: "subscription", isRecurring: true },
];

export const sampleSnapshot: Snapshot = {
  implementation: "stub",
  dataSource: "imported", dataAsOf: "2026-09-30",
  coverage: { monthsCovered: 3, completeMonths: 3, firstDate: "2026-07-01", lastDate: "2026-09-30", transactionCount: 142 },
  monthlyIncome: 85000, monthlyExpenses: 52000, monthlySurplus: 33000, savingsRate: 38.8,
  balances: { emergencyFund: null, investments: null, creditCardDebt: null },
  provenance: {
    income: "observed", expenses: "observed", savingsRate: "observed",
    emergencyFund: "missing", investments: "missing", creditCardDebt: "missing",
  },
  missing: ["emergencyFund", "investments", "creditCardDebt"],
  dataQuality: [{ code: "BALANCES_UNKNOWN", severity: "info", message: "Balances are unknown until you enter them." }],
};

export const sampleBatch: ImportBatch = {
  implementation: "stub", batchId: "fx-batch-1", source: "csv", filename: "demo_statement.csv",
  importedAt: new Date("2026-10-31T09:00:00.000Z"),
  counts: { total: 142, accepted: 138, duplicate: 3, possibleDuplicate: 1, rejected: 0, ignored: 0 },
  period: { from: "2026-07-01", to: "2026-09-30" }, status: "committed",
};

export const samplePreview: ImportPreview = {
  implementation: "stub", previewId: "fx-preview-1", source: "csv", detectedFormat: "generic-csv",
  counts: sampleBatch.counts, period: sampleBatch.period,
  rows: [
    { rowNumber: 2, status: "accepted", reason: null,
      transaction: (({ id, batchId, ...rest }) => rest)(sampleTransaction) },
    { rowNumber: 9, status: "duplicate", reason: "Same date, amount and narration as row 3", transaction: null },
  ],
  warnings: ["1 row looks like a possible duplicate and needs review."], needsUserInput: [],
};

export const sampleBreakdown: CategoryBreakdownItem[] = [
  { category: "rent", amount: 22000, sharePercent: 42.3, transactionCount: 1, previousMonthAmount: 22000, changePercent: 0 },
  { category: "dining", amount: 7800, sharePercent: 15, transactionCount: 14, previousMonthAmount: 6100, changePercent: 27.9 },
];

export const sampleLearnedRules: LearnedRule[] = [
  { ruleId: "fx-rule-1", merchantKey: "zepto", category: "groceries", createdAt: new Date("2026-10-30T10:00:00.000Z"), appliedCount: 4 },
];

export const sampleSubscriptions: Subscription[] = [
  { id: "fx-sub-1", merchant: "Netflix", cadence: "monthly", status: "possible", typicalAmount: 649, monthlyEquivalent: 649,
    annualCost: 7788, lastChargedOn: "2026-09-05", nextExpectedOn: "2026-10-05", occurrences: 3, confidence: 0.82,
    evidenceTransactionIds: ["fx-txn-3"], flags: [], priceChange: null },
];

export const sampleGoals: Goal[] = [
  { id: "fx-goal-1", goalType: "gadget", name: "Laptop", targetAmount: 90000, currentAmount: 30000, timelineMonths: 12,
    priority: "medium", progressPercent: 33.3, projectedCompletion: "2027-03-31" },
];

export const sampleSimulation: SimulationResult = {
  implementation: "stub",
  scenarios: [{ type: "reduce_category", category: "dining", percent: 30 }],
  status: "ok",
  metrics: [
    { label: "Monthly surplus", baseline: 33000, scenario: 35340, delta: 2340, unit: "inr" },
    { label: "Savings rate", baseline: 38.8, scenario: 41.6, delta: 2.8, unit: "percent" },
  ],
  goals: [{ goalId: "fx-goal-1", goalName: "Laptop", baselineCompletion: "2027-03-31", scenarioCompletion: "2027-02-28", monthsSaved: 1 }],
  assumptions: ["FIXTURE: not a calculation.", "No investment returns, salary growth or interest assumed."],
  warnings: [], ledgerUnchanged: true, disclaimer: FIXTURE_DISCLAIMER,
};

export const sampleIntent: IntentAnalysis = {
  implementation: "stub",
  rawText: "I spend 4000 on food delivery, actually make that 5000, what if I cut it in half",
  normalizedText: "i spend 4000 on food delivery actually make that 5000 what if i cut it in half",
  intent: "what_if", confidence: 0.9, category: "dining", merchant: null, amount: 5000, amountsMentioned: [4000, 5000],
  percent: 50, period: null, scenario: { type: "reduce_category", category: "dining", percent: 50 },
  corrections: [{ from: 4000, to: 5000, cue: "actually make that" }],
  ambiguities: [], needsClarification: false, clarificationQuestion: null, requiresConfirmation: false,
};

export const sampleReport: MonthlyReport = {
  implementation: "stub", month: "2026-09", generatedAt: new Date("2026-10-01T05:00:00.000Z"), dataSource: "imported",
  status: "ok",
  totals: { income: 85000, expenses: 52000, savings: 33000, savingsRate: 38.8, investments: 10000 },
  previousMonth: { income: 85000, expenses: 49000, savingsRate: 42.4 },
  categories: sampleBreakdown, topMerchants: [{ merchant: "Swiggy", amount: 4200, count: 9 }],
  unusualTransactionIds: [], subscriptions: { monthlyTotal: 649, changes: [] },
  actions: [{ title: "Review dining spend", reason: "Dining rose 27.9% vs August (FIXTURE)", evidenceTransactionIds: ["fx-txn-1"], expectedImpactInr: 1800 }],
  narrative: { headline: "FIXTURE: September summary", body: "Placeholder text for UI layout only.", mode: "fallback" },
  dataQuality: [], disclaimer: FIXTURE_DISCLAIMER,
};

export const sampleAdvisor: InariAdvisorResponse = {
  implementation: "stub",
  answer: "FIXTURE: this is placeholder text, not a real answer.", summary: "Stub response",
  keyInsights: [], suggestedNextActions: [], followUpQuestions: ["What if I cut dining by 30%?"],
  relatedMetrics: [], confidenceLevel: "low", mode: "stub", disclaimer: FIXTURE_DISCLAIMER,
  dataSource: "imported", dataAsOf: "2026-09-30",
  guardrail: { status: "passed", reasons: [] }, intent: null, simulation: null,
};
