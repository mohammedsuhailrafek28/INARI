/**
 * INARI shared API contracts (server + client).
 * Source proposal: APA_CONTRACT_PROPOSAL.md. Additive to the existing WealthVerse API.
 *
 * Conventions
 *  - Money: INR only. `amount` fields are rupees (number, <= 2 decimals); ledger rows also carry integer `amountPaise`.
 *  - Dates: calendar dates are `YYYY-MM-DD` strings in IST; instants are `Date` (superjson).
 *  - Every response carries `implementation`: "stub" means fixture data, NOT a real calculation.
 */
import { z } from "zod";

export const CONTRACT_VERSION = "inari.v1" as const;

/* ---------- status of each procedure (kept in sync by a test) ---------- */
export const ImplementationStatus = z.enum(["stub", "implemented"]);
export type ImplementationStatus = z.infer<typeof ImplementationStatus>;

export const PROCEDURE_NAMES = [
  "meta",
  "getSnapshot", "setBalances", "useDemoData", "clearMyData",
  "importPreview", "importCommit", "importUndo", "importHistory",
  "listTransactions", "getTransactions",
  "getCategories", "correctCategory", "listLearnedRules", "getLearnedRules", "deleteLearnedRule", "getBreakdown",
  "listSubscriptions", "getSubscriptions", "confirmSubscription",
  "simulate",
  "ask", "askAdvisor", "analyzeIntent",
  "monthlyReport", "getMonthlyReport", "listReportMonths",
  "getGoals", "upsertGoal", "deleteGoal",
] as const;
export type ProcedureName = (typeof PROCEDURE_NAMES)[number];

/** Aliases: both names call the same procedure. Canonical = proposal name. */
export const PROCEDURE_ALIASES: Partial<Record<ProcedureName, ProcedureName>> = {
  getTransactions: "listTransactions",
  getLearnedRules: "listLearnedRules",
  getSubscriptions: "listSubscriptions",
  askAdvisor: "ask",
  getMonthlyReport: "monthlyReport",
};

/**
 * Status registry. A procedure is "implemented" only when real logic + tests exist.
 * Updated by the backend in the same commit that implements the procedure.
 */
export const PROCEDURE_STATUS: Record<ProcedureName, ImplementationStatus> = {
  meta: "implemented",
  getSnapshot: "implemented", setBalances: "implemented", useDemoData: "implemented", clearMyData: "implemented",
  importPreview: "implemented", importCommit: "implemented", importUndo: "implemented", importHistory: "implemented",
  listTransactions: "implemented", getTransactions: "implemented",
  getCategories: "implemented", correctCategory: "implemented", listLearnedRules: "implemented", getLearnedRules: "implemented",
  deleteLearnedRule: "implemented", getBreakdown: "implemented",
  listSubscriptions: "implemented", getSubscriptions: "implemented", confirmSubscription: "implemented",
  simulate: "implemented",
  ask: "stub", askAdvisor: "stub", analyzeIntent: "implemented",
  monthlyReport: "stub", getMonthlyReport: "stub", listReportMonths: "stub",
  getGoals: "stub", upsertGoal: "stub", deleteGoal: "stub",
};

/* ---------- primitives ---------- */
export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const YearMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export type IsoDate = z.infer<typeof IsoDate>;
export type YearMonth = z.infer<typeof YearMonth>;

export const DataSource = z.enum(["imported", "demo"]);
export type DataSource = z.infer<typeof DataSource>;

export const SourceKind = z.enum(["csv", "pdf", "sms", "manual"]);
export type SourceKind = z.infer<typeof SourceKind>;

const impl = { implementation: ImplementationStatus };

/* ---------- taxonomy ---------- */
export const CATEGORIES = [
  "salary", "other_income", "rent", "emi", "groceries", "dining", "fuel", "transport",
  "utilities", "subscription", "shopping", "entertainment", "health", "insurance",
  "education", "travel", "investment", "savings", "fees_tax", "cash", "transfer", "other",
] as const;
export const Category = z.enum(CATEGORIES);
export type Category = z.infer<typeof Category>;

/** Precedence (highest first): user > learned > rule > llm > unclassified. */
export const CategorySource = z.enum(["user", "learned", "rule", "llm", "unclassified"]);
export type CategorySource = z.infer<typeof CategorySource>;

export const Instrument = z.enum(["upi", "card", "neft", "imps", "rtgs", "atm", "cash", "cheque", "auto_debit", "other"]);
export type Instrument = z.infer<typeof Instrument>;

/* ---------- ledger ---------- */
export const LedgerTransaction = z.object({
  id: z.string(),
  fingerprint: z.string(),
  batchId: z.string(),
  source: SourceKind,
  postedOn: IsoDate,
  amountPaise: z.number().int().positive(),
  amount: z.number(),
  direction: z.enum(["debit", "credit"]),
  merchant: z.string().nullable(),
  narration: z.string(),
  instrument: Instrument,
  accountLabel: z.string().nullable(),
  category: Category,
  categorySource: CategorySource,
  categoryConfidence: z.number().min(0).max(1),
  correctedFrom: Category.nullable(),
  isTransfer: z.boolean(),
  isRecurring: z.boolean(),
  possibleDuplicateOf: z.string().nullable(),
  balanceAfterPaise: z.number().int().nullable(),
});
export type LedgerTransaction = z.infer<typeof LedgerTransaction>;

/* ---------- import ---------- */
export const ImportSourceInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("csv"), filename: z.string().max(200), content: z.string().max(6_000_000), bankHint: z.string().max(40).optional() }),
  z.object({ kind: z.literal("sms"), text: z.string().max(500_000) }),
  z.object({ kind: z.literal("pdf"), filename: z.string().max(200), contentBase64: z.string().max(8_000_000), password: z.string().max(100).optional() }),
]);
export type ImportSourceInput = z.infer<typeof ImportSourceInput>;

export const ImportCounts = z.object({
  total: z.number().int(), accepted: z.number().int(), duplicate: z.number().int(),
  possibleDuplicate: z.number().int(), rejected: z.number().int(), ignored: z.number().int(),
});
export type ImportCounts = z.infer<typeof ImportCounts>;

export const ImportPreviewRow = z.object({
  rowNumber: z.number().int(),
  status: z.enum(["accepted", "duplicate", "possible_duplicate", "rejected", "ignored"]),
  reason: z.string().nullable(),
  transaction: LedgerTransaction.omit({ id: true, batchId: true }).nullable(),
});
export type ImportPreviewRow = z.infer<typeof ImportPreviewRow>;

export const ImportPreview = z.object({
  ...impl,
  previewId: z.string(),
  source: SourceKind,
  detectedFormat: z.string(),
  counts: ImportCounts,
  period: z.object({ from: IsoDate, to: IsoDate }).nullable(),
  rows: z.array(ImportPreviewRow).max(200),
  warnings: z.array(z.string()),
  needsUserInput: z.array(z.enum(["account_label", "bank", "pdf_password"])),
});
export type ImportPreview = z.infer<typeof ImportPreview>;

export const ImportBatch = z.object({
  ...impl,
  batchId: z.string(),
  source: SourceKind,
  filename: z.string().nullable(),
  importedAt: z.date(),
  counts: ImportCounts,
  period: z.object({ from: IsoDate, to: IsoDate }).nullable(),
  status: z.enum(["committed", "undone"]),
});
export type ImportBatch = z.infer<typeof ImportBatch>;

export const ImportBatchRecord = ImportBatch.omit({ implementation: true });
export type ImportBatchRecord = z.infer<typeof ImportBatchRecord>;
export const ImportHistoryOutput = z.object({ ...impl, items: z.array(ImportBatchRecord) });
export type ImportHistoryOutput = z.infer<typeof ImportHistoryOutput>;

export const ClearMyDataInput = z.object({ confirm: z.literal("DELETE") });
export const ClearMyDataOutput = z.object({
  ...impl, deletedTransactions: z.number().int(), deletedBatches: z.number().int(), deletedRules: z.number().int(),
});
export type ClearMyDataOutput = z.infer<typeof ClearMyDataOutput>;

/* ---------- balances (cannot be derived from transactions) ---------- */
export const BalancesInput = z.object({
  emergencyFund: z.number().min(0).max(1e10).nullable(),
  investments: z.number().min(0).max(1e10).nullable(),
  creditCardDebt: z.number().min(0).max(1e10).nullable(),
  age: z.number().int().min(16).max(100).optional(),
  riskPreference: z.enum(["conservative", "moderate", "aggressive"]).optional(),
});
export type BalancesInput = z.infer<typeof BalancesInput>;

/* ---------- snapshot ---------- */
export const FieldProvenance = z.enum(["observed", "estimated", "user_input", "missing"]);
export type FieldProvenance = z.infer<typeof FieldProvenance>;

/** `transactionIds` lets the UI show the exact rows behind a note (evidence); capped at 50. */
export const DataQualityNote = z.object({
  code: z.string(), severity: z.enum(["info", "warning"]), message: z.string(),
  transactionIds: z.array(z.string()).max(50).optional(),
});

export const Snapshot = z.object({
  ...impl,
  dataSource: DataSource,
  dataAsOf: IsoDate.nullable(),
  coverage: z.object({
    monthsCovered: z.number(), completeMonths: z.number().int(),
    firstDate: IsoDate.nullable(), lastDate: IsoDate.nullable(), transactionCount: z.number().int(),
  }),
  /** null = unknown (never a persona/synthetic value in imported mode) */
  monthlyIncome: z.number().nullable(),
  monthlyExpenses: z.number().nullable(),
  monthlySurplus: z.number().nullable(),
  savingsRate: z.number().nullable(),
  balances: z.object({ emergencyFund: z.number().nullable(), investments: z.number().nullable(), creditCardDebt: z.number().nullable() }),
  provenance: z.object({
    income: FieldProvenance, expenses: FieldProvenance, savingsRate: FieldProvenance,
    emergencyFund: FieldProvenance, investments: FieldProvenance, creditCardDebt: FieldProvenance,
  }),
  missing: z.array(z.string()),
  dataQuality: z.array(DataQualityNote),
});
export type Snapshot = z.infer<typeof Snapshot>;

/* ---------- transactions listing ---------- */
export const ListTransactionsInput = z.object({
  month: YearMonth.optional(), category: Category.optional(), q: z.string().max(100).optional(),
  needsReview: z.boolean().optional(), cursor: z.string().optional(), limit: z.number().int().min(1).max(200).optional(),
}).optional();
export const ListTransactionsOutput = z.object({
  ...impl, items: z.array(LedgerTransaction), nextCursor: z.string().nullable(), dataSource: DataSource,
});
export type ListTransactionsOutput = z.infer<typeof ListTransactionsOutput>;

/* ---------- categories & corrections ---------- */
export const CorrectionInput = z.object({
  transactionId: z.string(), category: Category, applyToMerchant: z.boolean().default(false),
});
export type CorrectionInput = z.infer<typeof CorrectionInput>;

export const CategoryBreakdownItem = z.object({
  category: Category, amount: z.number(), sharePercent: z.number(), transactionCount: z.number().int(),
  previousMonthAmount: z.number().nullable(), changePercent: z.number().nullable(),
});
export type CategoryBreakdownItem = z.infer<typeof CategoryBreakdownItem>;

export const CorrectionResult = z.object({ ...impl, updated: z.number().int(), breakdown: z.array(CategoryBreakdownItem) });
export type CorrectionResult = z.infer<typeof CorrectionResult>;

export const LearnedRule = z.object({
  ruleId: z.string(), merchantKey: z.string(), category: Category, createdAt: z.date(), appliedCount: z.number().int(),
});
export type LearnedRule = z.infer<typeof LearnedRule>;
export const LearnedRulesOutput = z.object({ ...impl, items: z.array(LearnedRule) });
export const CategoriesOutput = z.object({
  ...impl,
  items: z.array(z.object({ id: Category, label: z.string(), kind: z.enum(["income", "expense", "neutral"]) })),
});
export const BreakdownOutput = z.object({ ...impl, month: YearMonth, items: z.array(CategoryBreakdownItem) });

/* ---------- subscriptions ---------- */
export const Subscription = z.object({
  id: z.string(), merchant: z.string(), cadence: z.enum(["weekly", "monthly", "quarterly", "yearly"]),
  status: z.enum(["confirmed", "possible", "dismissed"]),
  typicalAmount: z.number(), monthlyEquivalent: z.number(), annualCost: z.number(),
  lastChargedOn: IsoDate, nextExpectedOn: IsoDate, occurrences: z.number().int(),
  confidence: z.number().min(0).max(1),
  evidenceTransactionIds: z.array(z.string()),
  flags: z.array(z.enum(["price_increase", "possible_duplicate", "inactive", "new"])),
  priceChange: z.object({ from: z.number(), to: z.number() }).nullable(),
});
export type Subscription = z.infer<typeof Subscription>;
export const SubscriptionsOutput = z.object({ ...impl, items: z.array(Subscription), monthlyTotal: z.number(), annualTotal: z.number() });
export const ConfirmSubscriptionInput = z.object({ subscriptionId: z.string(), decision: z.enum(["confirm", "dismiss"]) });

/* ---------- simulation ---------- */
export const Scenario = z.discriminatedUnion("type", [
  z.object({ type: z.literal("reduce_category"), category: Category, amountPerMonth: z.number().positive().optional(), percent: z.number().min(1).max(100).optional() }),
  z.object({ type: z.literal("cancel_subscriptions"), subscriptionIds: z.array(z.string()).min(1) }),
  z.object({ type: z.literal("change_income"), deltaPerMonth: z.number() }),
  z.object({ type: z.literal("one_off_expense"), amount: z.number().positive(), inMonths: z.number().int().min(0).max(24) }),
  z.object({ type: z.literal("change_goal_contribution"), goalId: z.string(), newMonthly: z.number().min(0) }),
  z.object({ type: z.literal("pay_down_debt"), amountPerMonth: z.number().positive() }),
  z.object({ type: z.literal("start_sip"), amountPerMonth: z.number().positive() }),
]);
export type Scenario = z.infer<typeof Scenario>;

export const SimulateInput = z.object({ scenarios: z.array(Scenario).min(1).max(5) });
export const SimMetric = z.object({
  label: z.string(), baseline: z.number().nullable(), scenario: z.number().nullable(), delta: z.number().nullable(),
  unit: z.enum(["inr", "percent", "score", "months", "date"]),
});
export const SimulationResult = z.object({
  ...impl,
  scenarios: z.array(Scenario),
  status: z.enum(["ok", "insufficient_data"]),
  metrics: z.array(SimMetric),
  goals: z.array(z.object({
    goalId: z.string(), goalName: z.string(),
    baselineCompletion: IsoDate.nullable(), scenarioCompletion: IsoDate.nullable(), monthsSaved: z.number().nullable(),
  })),
  assumptions: z.array(z.string()),
  warnings: z.array(z.string()),
  /** Additive (optional): data-quality notes and baseline facts the numbers rest on. */
  evidence: z.array(DataQualityNote).optional(),
  ledgerUnchanged: z.literal(true),
  disclaimer: z.string(),
});
export type SimulationResult = z.infer<typeof SimulationResult>;

/* ---------- goals ---------- */
export const GoalInput = z.object({
  id: z.string().optional(),
  goalType: z.enum(["emergency_fund", "house", "car", "education", "retirement", "travel", "wedding", "gadget", "debt_free", "custom"]),
  name: z.string().max(80).optional(),
  targetAmount: z.number().positive(), currentAmount: z.number().min(0).default(0),
  timelineMonths: z.number().int().min(1).max(600).optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
});
export type GoalInput = z.infer<typeof GoalInput>;
export const Goal = z.object({
  id: z.string(), goalType: GoalInput.shape.goalType, name: z.string(),
  targetAmount: z.number(), currentAmount: z.number(), timelineMonths: z.number().int().nullable(),
  priority: z.enum(["low", "medium", "high"]), progressPercent: z.number(),
  projectedCompletion: IsoDate.nullable(),
});
export type Goal = z.infer<typeof Goal>;
export const GoalsOutput = z.object({ ...impl, items: z.array(Goal), dataSource: DataSource });
export const GoalIdOutput = z.object({ ...impl, id: z.string() });
export const SuccessOutput = z.object({ ...impl, success: z.literal(true) });

/* ---------- monthly report ---------- */
export const MonthlyReport = z.object({
  ...impl,
  month: YearMonth, generatedAt: z.date(), dataSource: DataSource,
  status: z.enum(["ok", "insufficient_data"]),
  totals: z.object({ income: z.number(), expenses: z.number(), savings: z.number(), savingsRate: z.number(), investments: z.number() }),
  previousMonth: z.object({ income: z.number(), expenses: z.number(), savingsRate: z.number() }).nullable(),
  categories: z.array(CategoryBreakdownItem),
  topMerchants: z.array(z.object({ merchant: z.string(), amount: z.number(), count: z.number().int() })),
  unusualTransactionIds: z.array(z.string()),
  subscriptions: z.object({ monthlyTotal: z.number(), changes: z.array(z.string()) }),
  actions: z.array(z.object({ title: z.string(), reason: z.string(), evidenceTransactionIds: z.array(z.string()), expectedImpactInr: z.number().nullable() })).max(3),
  narrative: z.object({ headline: z.string(), body: z.string(), mode: z.enum(["llm", "fallback"]) }),
  dataQuality: z.array(DataQualityNote),
  disclaimer: z.string(),
});
export type MonthlyReport = z.infer<typeof MonthlyReport>;
export const ReportMonthsOutput = z.object({ ...impl, months: z.array(YearMonth) });

/* ---------- NLP / voice-dictated text ---------- */
export const INTENTS = [
  "spending_question", "category_explanation", "category_correction", "subscription_query",
  "monthly_review", "goal_progress", "what_if", "clarification_followup", "unsafe_request", "unknown",
] as const;
export const Intent = z.enum(INTENTS);
export type Intent = z.infer<typeof Intent>;

export const IntentAnalysis = z.object({
  ...impl,
  rawText: z.string(),
  normalizedText: z.string(),                       // fillers/hesitations removed
  intent: Intent,
  confidence: z.number().min(0).max(1),
  category: Category.nullable(),
  merchant: z.string().nullable(),
  /** Final amount after applying spoken self-corrections ("actually make that 5000") */
  amount: z.number().nullable(),
  amountsMentioned: z.array(z.number()),            // in order; last-corrected wins
  percent: z.number().nullable(),
  period: z.object({ kind: z.enum(["month", "week", "year", "relative"]), value: z.string() }).nullable(),
  scenario: Scenario.nullable(),
  corrections: z.array(z.object({ from: z.number().nullable(), to: z.number(), cue: z.string() })),
  ambiguities: z.array(z.string()),
  needsClarification: z.boolean(),
  clarificationQuestion: z.string().nullable(),
  /** Consequential saved changes always require explicit confirmation */
  requiresConfirmation: z.boolean(),
});
export type IntentAnalysis = z.infer<typeof IntentAnalysis>;
export const AnalyzeIntentInput = z.object({
  text: z.string().trim().min(1).max(1000),
  /** Optional prior turn for follow-ups */
  previous: z.object({ intent: Intent, amount: z.number().nullable(), category: Category.nullable() }).optional(),
});

/* ---------- advisor ---------- */
export const AskInput = z.object({ question: z.string().trim().min(1).max(1000), locale: z.literal("en").default("en") });
export const InariAdvisorResponse = z.object({
  ...impl,
  answer: z.string(), summary: z.string(),
  keyInsights: z.array(z.string()), suggestedNextActions: z.array(z.string()), followUpQuestions: z.array(z.string()),
  relatedMetrics: z.array(z.object({ label: z.string(), value: z.string() })),
  confidenceLevel: z.enum(["low", "medium", "high"]),
  mode: z.enum(["llm", "fallback", "stub"]),
  disclaimer: z.string(),
  dataSource: DataSource,
  dataAsOf: IsoDate.nullable(),
  guardrail: z.object({ status: z.enum(["passed", "modified", "refused"]), reasons: z.array(z.string()) }),
  intent: IntentAnalysis.nullable(),
  simulation: SimulationResult.nullable(),
});
export type InariAdvisorResponse = z.infer<typeof InariAdvisorResponse>;

/* ---------- meta ---------- */
export const MetaOutput = z.object({
  implementation: z.literal("implemented"),
  contractVersion: z.literal(CONTRACT_VERSION),
  dataSource: DataSource,
  identity: z.object({ kind: z.enum(["anonymous_demo", "authenticated"]), productionGrade: z.literal(false) }),
  storage: z.object({ kind: z.enum(["memory", "json"]), durable: z.boolean(), note: z.string() }),
  limits: z.object({ maxCsvBytes: z.number().int(), maxSmsChars: z.number().int(), maxPdfBytes: z.number().int() }),
  features: z.record(z.string(), z.boolean()),
  procedures: z.record(z.string(), ImplementationStatus),
});
export type MetaOutput = z.infer<typeof MetaOutput>;

/* ---------- errors ---------- */
export const INARI_ERROR_CODES = [
  "UNSUPPORTED_FORMAT", "FILE_TOO_LARGE", "TOO_MANY_ROWS", "PARSE_FAILED", "PASSWORD_REQUIRED",
  "SCANNED_PDF_UNSUPPORTED", "PREVIEW_EXPIRED", "NO_DATA", "INSUFFICIENT_DATA", "INVALID_SCENARIO",
  "GUARDRAIL_REFUSED", "LLM_UNAVAILABLE", "NOT_FOUND", "CONFLICT", "FORBIDDEN_OWNER", "NOT_IMPLEMENTED",
  "INVALID_INPUT", "INTERNAL",
] as const;

/** Shape of `error.data.inari` on every failed tRPC call. Never contains user content or raw validation payloads. */
export type InariErrorData = { code: InariErrorCode; fields?: Array<{ path: string; issue: string }> };
export type InariErrorCode = (typeof INARI_ERROR_CODES)[number];
