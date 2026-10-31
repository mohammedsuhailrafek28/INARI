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
  "reconcile",
  "listSubscriptions", "getSubscriptions", "confirmSubscription",
  "simulate",
  "ask", "askAdvisor", "analyzeIntent",
  "monthlyReport", "getMonthlyReport", "listReportMonths",
  "getGoals", "upsertGoal", "deleteGoal",
  "createClaim", "listClaims", "claimMatches", "confirmClaimMatch", "undoClaimMatch", "cancelClaim",
  "manualEntryPreview", "manualEntryCommit", "dataCoverage", "emiCheck",
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
  reconcile: "implemented",
  listSubscriptions: "implemented", getSubscriptions: "implemented", confirmSubscription: "implemented",
  simulate: "implemented",
  ask: "implemented", askAdvisor: "implemented", analyzeIntent: "implemented",
  monthlyReport: "implemented", getMonthlyReport: "implemented", listReportMonths: "implemented",
  getGoals: "implemented", upsertGoal: "implemented", deleteGoal: "implemented",
  createClaim: "implemented", listClaims: "implemented", claimMatches: "implemented", confirmClaimMatch: "implemented",
  undoClaimMatch: "implemented", cancelClaim: "implemented",
  manualEntryPreview: "implemented", manualEntryCommit: "implemented", dataCoverage: "implemented", emiCheck: "implemented",
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
  /** Additive (optional): for PDF imports, the 1-based page and line the row was read from. Never contains statement text. */
  evidence: z.object({ page: z.number().int().positive(), line: z.number().int().positive() }).optional(),
  /** Additive (optional): the user's explicit reconciliation decision. The row is never deleted. */
  reconciliation: z.object({
    decision: z.enum(["excluded_duplicate", "excluded_card_double_count", "kept_separate"]),
    decidedAt: z.string(),
  }).optional(),
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
  /** Additive. What the user sets aside per month for this goal; projections need it. Upsert replaces the whole goal. */
  monthlyContribution: z.number().min(0).optional(),
});
export type GoalInput = z.infer<typeof GoalInput>;
export const Goal = z.object({
  id: z.string(), goalType: GoalInput.shape.goalType, name: z.string(),
  targetAmount: z.number(), currentAmount: z.number(), timelineMonths: z.number().int().nullable(),
  priority: z.enum(["low", "medium", "high"]), progressPercent: z.number(),
  projectedCompletion: IsoDate.nullable(),
  /* Additive, all optional. */
  remainingAmount: z.number().optional(),
  monthlyContribution: z.number().nullable().optional(),
  requiredMonthly: z.number().nullable().optional(),
  status: z.enum(["completed", "on_track", "behind", "no_contribution", "no_deadline"]).optional(),
  notes: z.array(z.string()).optional(),
});
export type Goal = z.infer<typeof Goal>;
export const GoalsOutput = z.object({
  ...impl, items: z.array(Goal), dataSource: DataSource,
  /** Additive. monthlySurplus is null until a complete month is imported; withinSurplus is null then too. */
  summary: z.object({
    totalMonthlyContributions: z.number(), monthlySurplus: z.number().nullable(), withinSurplus: z.boolean().nullable(),
  }).optional(),
  warnings: z.array(z.string()).optional(),
});
export type GoalsOutput = z.infer<typeof GoalsOutput>;
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
  /* Additive, all optional (older clients may ignore them). When status is "insufficient_data", `totals` are zeros and must not be shown. */
  period: z.object({
    from: IsoDate, to: IsoDate, daysInMonth: z.number().int(), daysElapsed: z.number().int(),
    partial: z.boolean(), reason: z.string().nullable(),
  }).optional(),
  drift: z.object({
    status: z.enum(["ok", "insufficient_history"]),
    baselineMonths: z.array(YearMonth),
    items: z.array(z.object({
      category: Category, amount: z.number(), baselineAverage: z.number(), changePercent: z.number().nullable(),
      direction: z.enum(["up", "down"]), provisional: z.boolean(), evidenceTransactionIds: z.array(z.string()),
    })),
  }).optional(),
  /** Additive. User-entered goals as of the report; absent or empty when the user has none. */
  goals: z.array(z.object({
    id: z.string(), name: z.string(), progressPercent: z.number(), status: z.string(),
    monthlyContribution: z.number().nullable(), projectedCompletion: IsoDate.nullable(),
  })).optional(),
  obligations: z.array(z.object({
    label: z.string(), kind: z.enum(["subscription", "rent", "emi"]), monthlyAmount: z.number(), evidenceTransactionIds: z.array(z.string()),
  })).optional(),
  /** Things the report could not use because the user never provided them (never guessed). */
  unknowns: z.array(z.string()).optional(),
  guardrails: z.object({ status: z.enum(["passed", "modified", "refused"]), reasons: z.array(z.string()) }).optional(),
});
export type MonthlyReport = z.infer<typeof MonthlyReport>;
export const ReconcileInput = z.object({
  transactionIds: z.array(z.string()).min(1).max(50),
  decision: z.enum(["exclude_duplicate", "exclude_card_double_count", "keep_separate", "undo"]),
});
export const ReconcileOutput = z.object({ ...impl, updated: z.number().int() });
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
/** Follow-up memory. The server keeps no conversation state: the client echoes back `context` from the previous response. */
export const AdvisorContext = z.object({
  intent: Intent, amount: z.number().nullable(), category: Category.nullable(),
  month: YearMonth.nullable().optional(), merchant: z.string().nullable().optional(),
});
export type AdvisorContext = z.infer<typeof AdvisorContext>;
export const AskInput = z.object({
  question: z.string().trim().min(1).max(1000), locale: z.literal("en").default("en"),
  /** Additive (optional) */
  previous: AdvisorContext.optional(),
});
export const AdvisorProposedAction = z.object({
  type: z.enum(["correct_category", "reconcile", "confirm_subscription", "import_data", "set_balances"]),
  title: z.string(), description: z.string(),
  /** The procedure the client should call after the user confirms, with ready-made input. The advisor never performs it. */
  procedure: z.string(), input: z.record(z.string(), z.unknown()),
  requiresConfirmation: z.literal(true),
  /** Additive. true = `input` can be sent to `procedure` exactly as given once the user confirms. false = the client must first collect the fields in `missingFields` from the user. */
  inputComplete: z.boolean().optional(),
  missingFields: z.array(z.string()).optional(),
});
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
  /* Additive, all optional. */
  evidence: z.array(DataQualityNote).optional(),
  assumptions: z.array(z.string()).optional(),
  limitations: z.array(z.string()).optional(),
  proposedActions: z.array(AdvisorProposedAction).optional(),
  /** Echo this back as `previous` on the next question to keep a follow-up conversation going. */
  context: AdvisorContext.optional(),
  /** Always states how the answer was produced. llmUsed is true only if a model actually ran. */
  engine: z.object({ kind: z.enum(["deterministic", "llm"]), llmUsed: z.boolean(), model: z.string().nullable() }).optional(),
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


/* ---------- refund watch and reimbursements (additive) ---------- */
export const ClaimKind = z.enum(["refund", "reimbursement"]);
export const ClaimStatus = z.enum(["pending", "overdue", "partially_received", "received", "cancelled"]);
export const Claim = z.object({
  id: z.string(),
  kind: ClaimKind,
  transactionId: z.string(),
  /** the original debit this claim is about; null only if that transaction was later removed */
  original: z.object({ postedOn: IsoDate, amountPaise: z.number().int(), narration: z.string(), merchant: z.string().nullable() }).nullable(),
  counterparty: z.string().nullable(),
  expectedAmountPaise: z.number().int().positive(),
  receivedAmountPaise: z.number().int().nonnegative(),
  outstandingAmountPaise: z.number().int().nonnegative(),
  /** reimbursement only: what the user really spent after others pay their share */
  personalSharePaise: z.number().int().nullable(),
  expectedDate: IsoDate.nullable(),
  status: ClaimStatus,
  settlements: z.array(z.object({ creditTransactionId: z.string(), amountPaise: z.number().int().positive(), confirmedAt: z.string() })),
  note: z.string().nullable(),
  createdAt: z.string(),
});
export type Claim = z.infer<typeof Claim>;
export const CreateClaimInput = z.object({
  kind: ClaimKind,
  transactionId: z.string().max(100),
  /** rupees: the refund promised, or the part of the payment others owe you */
  expectedAmount: z.number().positive().max(1_000_000_000),
  expectedDate: IsoDate.optional(),
  counterparty: z.string().max(60).optional(),
  note: z.string().max(200).optional(),
});
export const ClaimsOutput = z.object({
  ...impl,
  items: z.array(Claim),
  summary: z.object({
    pendingRefundPaise: z.number().int(), overdueRefundCount: z.number().int(),
    outstandingReimbursementPaise: z.number().int(), grossReimbursableSpendPaise: z.number().int(), personalShareOfReimbursablePaise: z.number().int(),
  }),
  notes: z.array(z.string()),
});
export type ClaimsOutput = z.infer<typeof ClaimsOutput>;
export const ClaimMatchesOutput = z.object({
  ...impl,
  claimId: z.string(),
  suggestions: z.array(z.object({
    creditTransactionId: z.string(), postedOn: IsoDate, amountPaise: z.number().int(), availablePaise: z.number().int(),
    narration: z.string(), score: z.number(), reasons: z.array(z.string()),
    requiresConfirmation: z.literal(true), ambiguous: z.boolean(),
  })),
  notes: z.array(z.string()),
});
export const ConfirmClaimMatchInput = z.object({
  claimId: z.string().max(100), creditTransactionId: z.string().max(100),
  /** rupees; defaults to min(claim outstanding, credit still available) */
  amount: z.number().positive().max(1_000_000_000).optional(),
});
export const UndoClaimMatchInput = z.object({ claimId: z.string().max(100), creditTransactionId: z.string().max(100) });

/* ---------- manual (user-confirmed) entries and data coverage (additive) ---------- */
export const PaymentType = z.enum(["cash", "upi", "card", "other"]);
export const ManualEntryInput = z.object({
  /** free text such as "I spent 1,200 cash on groceries yesterday"; explicit fields below override what it says */
  text: z.string().max(300).optional(),
  amount: z.number().positive().max(1_000_000_000).optional(),
  direction: z.enum(["debit", "credit"]).optional(),
  category: Category.optional(),
  date: IsoDate.optional(),
  paymentType: PaymentType.optional(),
  description: z.string().max(120).optional(),
});
export const ManualEntryPreviewOutput = z.object({
  ...impl,
  previewId: z.string().nullable(),
  entry: z.object({
    amountPaise: z.number().int().nullable(), direction: z.enum(["debit", "credit"]).nullable(), category: Category.nullable(),
    postedOn: IsoDate, paymentType: PaymentType, narration: z.string(),
  }),
  assumptions: z.array(z.string()),
  needsUserInput: z.array(z.enum(["amount", "direction"])),
  possibleDuplicateOf: z.string().nullable(),
  requiresConfirmation: z.literal(true),
});
export const ManualEntryCommitInput = z.object({ previewId: z.string().max(100), idempotencyKey: z.string().min(8).max(64) });
export const ManualEntryCommitOutput = z.object({
  ...impl, batchId: z.string(), transactionId: z.string(), duplicateSubmission: z.boolean(), source: z.literal("manual"),
});
export const DataCoverageOutput = z.object({
  ...impl,
  observed: z.object({
    transactionCount: z.number().int(), from: IsoDate.nullable(), to: IsoDate.nullable(),
    bySource: z.record(z.string(), z.number().int()),
  }),
  months: z.array(z.object({ month: z.string(), count: z.number().int(), manualCount: z.number().int() })),
  gaps: z.array(z.object({ kind: z.enum(["month_without_transactions", "quiet_period", "no_manual_entries"]), from: IsoDate.nullable(), to: IsoDate.nullable(), detail: z.string() })),
  note: z.string(),
});

/* ---------- EMI reality check (additive; hypothetical only) ---------- */
export const EmiCheckInput = z.object({
  /** rupees */
  cashPrice: z.number().positive().max(1_000_000_000),
  emiMonthly: z.number().positive().max(1_000_000_000),
  months: z.number().int().min(1).max(120),
  downPayment: z.number().nonnegative().max(1_000_000_000).optional(),
  processingFee: z.number().nonnegative().max(1_000_000_000).optional(),
  /** taxes charged on the EMI plan (for example GST on interest or fee), as a rupee amount */
  taxes: z.number().nonnegative().max(1_000_000_000).optional(),
  /** discount or cashback you only get when paying upfront (or lose by taking the EMI) */
  upfrontDiscount: z.number().nonnegative().max(1_000_000_000).optional(),
  /** discount that applies to both options */
  discountBoth: z.number().nonnegative().max(1_000_000_000).optional(),
});
export const EmiCheckOutput = z.object({
  ...impl,
  totalPayableEmiPaise: z.number().int(),
  totalPayableUpfrontPaise: z.number().int(),
  extraCostOfEmiPaise: z.number().int(),
  extraCostPercentOfCash: z.number(),
  isReallyNoCost: z.boolean(),
  monthlyCommitmentPaise: z.number().int(),
  cashLeftAfterUpfrontPurchasePaise: z.number().int().nullable(),
  monthlySurplusPaise: z.number().int().nullable(),
  surplusAfterEmiPaise: z.number().int().nullable(),
  breakdown: z.array(z.object({ label: z.string(), paise: z.number().int() })),
  verdict: z.string(),
  missingTerms: z.array(z.string()),
  assumptions: z.array(z.string()),
  warnings: z.array(z.string()),
  createsNoDebt: z.literal(true),
});
export type EmiCheckOutput = z.infer<typeof EmiCheckOutput>;
export type CreateClaimInput = z.infer<typeof CreateClaimInput>;
export type ManualEntryInput = z.infer<typeof ManualEntryInput>;
