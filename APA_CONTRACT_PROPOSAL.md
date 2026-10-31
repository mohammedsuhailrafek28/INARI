# INARI API Contract Proposal (file name kept as requested: APA_CONTRACT_PROPOSAL)

Purpose: let the frontend developer build in parallel against stable TypeScript types while the backend is implemented.
Status: **proposal, nothing implemented.** Existing procedures keep working unchanged; everything below is additive under a new `inari` router so `main`-compatible UI code does not break.

"SaaS TypeScript contracts" is read as **shared TypeScript API contracts** between server and client. [A]

## 1. Ground rules (verified against the current code)

| Topic | Rule | Basis |
|---|---|---|
| Transport | tRPC 11 over `/api/trpc`, `superjson` | [V] `_core/trpc.ts` |
| Dates | `Date` objects over the wire (superjson). Calendar dates without time use `YYYY-MM-DD` strings (`IsoDate`) | [V] existing routes return `Date`; chosen to avoid timezone drift |
| Money | **INR only.** API uses rupees as `number` with at most 2 decimals (consistent with existing `WealthContext`). Ledger internally uses integer paise; contract exposes both `amount` (rupees) and `amountPaise` on ledger rows | existing code uses float rupees [V]; paise is new |
| Auth | All procedures are `protectedProcedure`. Identity strategy decision D2 in the plan | [V] |
| Errors | `TRPCError` with `code` plus `cause.inari = { code: InariErrorCode, details }` (see 5) | design |
| Versioning | `contractVersion: "inari.v1"` returned by `inari.meta`; additive changes only | design |
| Where types live | `shared/inari/contracts.ts` (importable by client via `@shared/inari/contracts`, alias exists) | [V] `@shared` alias in tsconfig/vite/vitest |
| Frontend typing | Use `RouterOutputs` / `RouterInputs` from `AppRouter` as well; the shared file is the source of Zod schemas and exported types | [V] tRPC already used on the client (`client/src/lib/trpc.ts`) |
| Unblocking the frontend | Backend first publishes the router with **stub implementations returning fixtures** (hour 1 of the plan), so the UI can call real procedures immediately | plan |

## 2. Shared contract file (`shared/inari/contracts.ts`)

```ts
import { z } from "zod";

export const CONTRACT_VERSION = "inari.v1" as const;

/* ---------- primitives ---------- */
export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);          // calendar date in IST
export const YearMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);    // "2026-09"
export type IsoDate = z.infer<typeof IsoDate>;
export type YearMonth = z.infer<typeof YearMonth>;

export const DataSource = z.enum(["imported", "demo"]);
export type DataSource = z.infer<typeof DataSource>;

export const SourceKind = z.enum(["csv", "pdf", "sms", "manual"]);
export type SourceKind = z.infer<typeof SourceKind>;

/* ---------- taxonomy ---------- */
export const CATEGORIES = [
  "salary", "other_income", "rent", "emi", "groceries", "dining", "fuel", "transport",
  "utilities", "subscription", "shopping", "entertainment", "health", "insurance",
  "education", "travel", "investment", "savings", "fees_tax", "cash", "transfer", "other",
] as const;
export const Category = z.enum(CATEGORIES);
export type Category = z.infer<typeof Category>;

export const CategorySource = z.enum(["rule", "learned", "user", "llm", "unclassified"]);
export type CategorySource = z.infer<typeof CategorySource>;

export const Instrument = z.enum(["upi", "card", "neft", "imps", "rtgs", "atm", "cash", "cheque", "auto_debit", "other"]);
export type Instrument = z.infer<typeof Instrument>;

/* ---------- ledger ---------- */
export const LedgerTransaction = z.object({
  id: z.string(),                       // stable server id
  fingerprint: z.string(),              // dedupe key
  batchId: z.string(),
  source: SourceKind,
  postedOn: IsoDate,
  amountPaise: z.number().int().positive(),   // always positive; direction below
  amount: z.number(),                          // rupees, derived
  direction: z.enum(["debit", "credit"]),
  merchant: z.string().nullable(),             // cleaned
  narration: z.string(),                       // original (sanitised, max 255)
  instrument: Instrument,
  accountLabel: z.string().nullable(),         // e.g. "HDFC ••1234" (never full number)
  category: Category,
  categorySource: CategorySource,
  categoryConfidence: z.number().min(0).max(1),
  isTransfer: z.boolean(),
  isRecurring: z.boolean(),
  possibleDuplicateOf: z.string().nullable(),
  balanceAfterPaise: z.number().int().nullable(),
});
export type LedgerTransaction = z.infer<typeof LedgerTransaction>;

/* ---------- import ---------- */
export const ImportSourceInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("csv"), filename: z.string().max(200), content: z.string().max(6_000_000), bankHint: z.string().optional() }),
  z.object({ kind: z.literal("sms"), text: z.string().max(500_000) }),
  z.object({ kind: z.literal("pdf"), filename: z.string().max(200), contentBase64: z.string().max(8_000_000), password: z.string().max(100).optional() }),
]);
export type ImportSourceInput = z.infer<typeof ImportSourceInput>;

export const ImportPreviewRow = z.object({
  rowNumber: z.number().int(),
  status: z.enum(["accepted", "duplicate", "possible_duplicate", "rejected", "ignored"]),
  reason: z.string().nullable(),
  transaction: LedgerTransaction.omit({ id: true, batchId: true }).nullable(),
});
export type ImportPreviewRow = z.infer<typeof ImportPreviewRow>;

export const ImportPreview = z.object({
  previewId: z.string(),                 // valid 30 min, commit with importCommit
  source: SourceKind,
  detectedFormat: z.string(),            // e.g. "hdfc-csv-v1", "generic-csv"
  counts: z.object({ total: z.number().int(), accepted: z.number().int(), duplicate: z.number().int(),
                     possibleDuplicate: z.number().int(), rejected: z.number().int(), ignored: z.number().int() }),
  period: z.object({ from: IsoDate, to: IsoDate }).nullable(),
  rows: z.array(ImportPreviewRow).max(200),    // first 200 only
  warnings: z.array(z.string()),
  needsUserInput: z.array(z.enum(["account_label", "bank", "pdf_password"])),
});
export type ImportPreview = z.infer<typeof ImportPreview>;

export const ImportBatch = z.object({
  batchId: z.string(),
  source: SourceKind,
  filename: z.string().nullable(),
  importedAt: z.date(),
  counts: ImportPreview.shape.counts,
  period: ImportPreview.shape.period,
  status: z.enum(["committed", "undone"]),
});
export type ImportBatch = z.infer<typeof ImportBatch>;

/* ---------- user-provided balances (cannot be derived from transactions) ---------- */
export const BalancesInput = z.object({
  emergencyFund: z.number().min(0).max(1e10).nullable(),
  investments: z.number().min(0).max(1e10).nullable(),
  creditCardDebt: z.number().min(0).max(1e10).nullable(),
  age: z.number().int().min(16).max(100).optional(),
  riskPreference: z.enum(["conservative", "moderate", "aggressive"]).optional(),
});
export type BalancesInput = z.infer<typeof BalancesInput>;

/* ---------- snapshot (what drives every screen) ---------- */
export const FieldProvenance = z.enum(["observed", "estimated", "user_input", "missing"]);
export const Snapshot = z.object({
  dataSource: DataSource,
  dataAsOf: IsoDate.nullable(),
  coverage: z.object({ monthsCovered: z.number(), completeMonths: z.number().int(), firstDate: IsoDate.nullable(), lastDate: IsoDate.nullable(), transactionCount: z.number().int() }),
  monthlyIncome: z.number(),
  monthlyExpenses: z.number(),
  monthlySurplus: z.number(),
  savingsRate: z.number(),                       // percent 0-100
  balances: z.object({ emergencyFund: z.number().nullable(), investments: z.number().nullable(), creditCardDebt: z.number().nullable() }),
  provenance: z.object({
    income: FieldProvenance, expenses: FieldProvenance, savingsRate: FieldProvenance,
    emergencyFund: FieldProvenance, investments: FieldProvenance, creditCardDebt: FieldProvenance,
  }),
  dataQuality: z.array(z.object({ code: z.string(), severity: z.enum(["info", "warning"]), message: z.string() })),
});
export type Snapshot = z.infer<typeof Snapshot>;

/* ---------- categories & corrections ---------- */
export const CorrectionInput = z.object({
  transactionId: z.string(),
  category: Category,
  applyToMerchant: z.boolean().default(false),
});
export type CorrectionInput = z.infer<typeof CorrectionInput>;

export const LearnedRule = z.object({
  ruleId: z.string(), merchantKey: z.string(), category: Category, createdAt: z.date(), appliedCount: z.number().int(),
});
export type LearnedRule = z.infer<typeof LearnedRule>;

export const CategoryBreakdownItem = z.object({
  category: Category, amount: z.number(), sharePercent: z.number(), transactionCount: z.number().int(),
  previousMonthAmount: z.number().nullable(), changePercent: z.number().nullable(),
});
export type CategoryBreakdownItem = z.infer<typeof CategoryBreakdownItem>;

/* ---------- subscriptions ---------- */
export const Subscription = z.object({
  id: z.string(), merchant: z.string(), cadence: z.enum(["weekly", "monthly", "quarterly", "yearly"]),
  typicalAmount: z.number(), monthlyEquivalent: z.number(), annualCost: z.number(),
  lastChargedOn: IsoDate, nextExpectedOn: IsoDate, occurrences: z.number().int(),
  confidence: z.number().min(0).max(1),
  flags: z.array(z.enum(["price_increase", "possible_duplicate", "inactive", "new"])),
  priceChange: z.object({ from: z.number(), to: z.number() }).nullable(),
});
export type Subscription = z.infer<typeof Subscription>;

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

export const Metric = z.object({ label: z.string(), baseline: z.number().nullable(), scenario: z.number().nullable(), delta: z.number().nullable(), unit: z.enum(["inr", "percent", "score", "months", "date"]) });
export const SimulationResult = z.object({
  scenario: Scenario,
  metrics: z.array(Metric),                      // surplus, savingsRate, healthScore, emergencyMonths
  goals: z.array(z.object({ goalId: z.string(), goalName: z.string(), baselineCompletion: IsoDate.nullable(), scenarioCompletion: IsoDate.nullable(), monthsSaved: z.number().nullable() })),
  assumptions: z.array(z.string()),
  warnings: z.array(z.string()),
  disclaimer: z.string(),
});
export type SimulationResult = z.infer<typeof SimulationResult>;

/* ---------- goals ---------- */
export const GoalInput = z.object({
  goalType: z.enum(["emergency_fund", "house", "car", "education", "retirement", "travel", "wedding", "gadget", "debt_free", "custom"]),
  name: z.string().max(80).optional(),
  targetAmount: z.number().positive(), currentAmount: z.number().min(0).default(0),
  targetDate: IsoDate.optional(), timelineMonths: z.number().int().min(1).max(600).optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
});
export type GoalInput = z.infer<typeof GoalInput>;

/* ---------- monthly report ---------- */
export const MonthlyReport = z.object({
  month: YearMonth, generatedAt: z.date(), dataSource: DataSource,
  status: z.enum(["ok", "insufficient_data"]),
  totals: z.object({ income: z.number(), expenses: z.number(), savings: z.number(), savingsRate: z.number(), investments: z.number() }),
  previousMonth: z.object({ income: z.number(), expenses: z.number(), savingsRate: z.number() }).nullable(),
  categories: z.array(CategoryBreakdownItem),
  topMerchants: z.array(z.object({ merchant: z.string(), amount: z.number(), count: z.number().int() })),
  unusualTransactions: z.array(LedgerTransaction.pick({ id: true, postedOn: true, merchant: true, amount: true, category: true })),
  subscriptions: z.object({ monthlyTotal: z.number(), changes: z.array(z.string()) }),
  goals: z.array(z.object({ goalId: z.string(), goalName: z.string(), progressPercent: z.number(), status: z.enum(["ahead", "onTrack", "behind", "stalled"]) })),
  healthScore: z.object({ start: z.number().nullable(), end: z.number(), category: z.enum(["poor", "fair", "good", "excellent"]) }),
  actions: z.array(z.object({ title: z.string(), reason: z.string(), expectedImpactInr: z.number().nullable() })).max(3),
  narrative: z.object({ headline: z.string(), body: z.string(), mode: z.enum(["llm", "fallback"]) }),
  dataQuality: Snapshot.shape.dataQuality,
  disclaimer: z.string(),
});
export type MonthlyReport = z.infer<typeof MonthlyReport>;

/* ---------- advisor (additive to existing AdvisorResponse) ---------- */
export const InariAdvisorResponse = z.object({
  answer: z.string(), summary: z.string(),
  keyInsights: z.array(z.string()), suggestedNextActions: z.array(z.string()), followUpQuestions: z.array(z.string()),
  relatedMetrics: z.array(z.object({ label: z.string(), value: z.string() })),
  confidenceLevel: z.enum(["low", "medium", "high"]),
  mode: z.enum(["llm", "fallback"]),
  disclaimer: z.string(),
  // new
  dataSource: DataSource,
  dataAsOf: IsoDate.nullable(),
  guardrail: z.object({ status: z.enum(["passed", "modified", "refused"]), reasons: z.array(z.string()) }),
  actions: z.array(z.discriminatedUnion("type", [
    z.object({ type: z.literal("open_screen"), route: z.string() }),
    z.object({ type: z.literal("run_simulation"), scenario: Scenario }),
    z.object({ type: z.literal("review_category"), transactionId: z.string() }),
  ])).default([]),
});
export type InariAdvisorResponse = z.infer<typeof InariAdvisorResponse>;

/* ---------- errors ---------- */
export const INARI_ERROR_CODES = [
  "UNSUPPORTED_FORMAT", "FILE_TOO_LARGE", "TOO_MANY_ROWS", "PARSE_FAILED", "PASSWORD_REQUIRED",
  "SCANNED_PDF_UNSUPPORTED", "PREVIEW_EXPIRED", "NO_DATA", "INSUFFICIENT_DATA", "INVALID_SCENARIO",
  "GUARDRAIL_REFUSED", "LLM_UNAVAILABLE", "NOT_FOUND", "CONFLICT",
] as const;
export type InariErrorCode = (typeof INARI_ERROR_CODES)[number];
```

## 3. Router surface (`inari.*`)

```ts
// shared/inari/router-shape.ts  (documentation of what appRouter.inari will expose)
import type {
  ImportSourceInput, ImportPreview, ImportBatch, BalancesInput, Snapshot, LedgerTransaction, CorrectionInput,
  LearnedRule, CategoryBreakdownItem, Subscription, Scenario, SimulationResult, GoalInput, MonthlyReport,
  InariAdvisorResponse, YearMonth, Category, DataSource,
} from "./contracts";

export interface InariApi {
  meta: { query(): { contractVersion: "inari.v1"; dataSource: DataSource; limits: { maxCsvBytes: number; maxSmsChars: number; maxPdfBytes: number }; features: Record<"csv"|"sms"|"pdf"|"llm"|"durableStore", boolean> } };

  // --- import (two-step so the user can review) ---
  importPreview:  { mutation(input: ImportSourceInput): ImportPreview };
  importCommit:   { mutation(input: { previewId: string; accountLabel?: string }): ImportBatch };
  importUndo:     { mutation(input: { batchId: string }): ImportBatch };
  importHistory:  { query(): ImportBatch[] };

  // --- data source & balances ---
  setBalances:    { mutation(input: BalancesInput): Snapshot };
  getSnapshot:    { query(): Snapshot };
  useDemoData:    { mutation(input: { enabled: boolean }): { dataSource: DataSource } };
  clearMyData:    { mutation(input: { confirm: "DELETE" }): { deletedTransactions: number } };

  // --- ledger & categories ---
  listTransactions: { query(input: { month?: YearMonth; category?: Category; q?: string; needsReview?: boolean; cursor?: string; limit?: number }): { items: LedgerTransaction[]; nextCursor: string | null } };
  correctCategory:  { mutation(input: CorrectionInput): { updated: number; breakdown: CategoryBreakdownItem[] } };
  listLearnedRules: { query(): LearnedRule[] };
  deleteLearnedRule:{ mutation(input: { ruleId: string }): { success: true } };
  getBreakdown:     { query(input: { month: YearMonth }): CategoryBreakdownItem[] };

  // --- insights ---
  listSubscriptions: { query(): { items: Subscription[]; monthlyTotal: number; annualTotal: number } };
  simulate:          { mutation(input: { scenario: Scenario }): SimulationResult };
  monthlyReport:     { query(input: { month: YearMonth }): MonthlyReport };
  listReportMonths:  { query(): YearMonth[] };

  // --- goals (user-owned; replaces demo goals when dataSource = imported) ---
  upsertGoal: { mutation(input: GoalInput & { id?: string }): { id: string } };
  deleteGoal: { mutation(input: { id: string }): { success: true } };

  // --- advisor ---
  ask: { mutation(input: { question: string; locale?: "en" | "hi" }): InariAdvisorResponse };
}
```

### 3.1 Existing procedures and what changes for the frontend

| Existing procedure | Behaviour after INARI | Frontend impact |
|---|---|---|
| `wealth.getContext`, `dashboard.getSummary`, `goals.list`, `spending.*`, `transactions.*`, `recommendations.list`, `wealth.getPredictions`, `wealth.askAdvisor`, `advisor.ask` | Same shape. Source switches to imported snapshot when present. | None required. Adds optional `dataSource` / `dataAsOf` fields on `WealthContext`; UI should show a "Using your data / Demo data" badge. |
| `profiles.*` | Demo personas only. | Show only while `dataSource = demo`. |

Compatibility promise: existing field names and types are not removed or renamed; only added.

## 4. Frontend usage examples

```ts
const preview = await trpc.inari.importPreview.mutate({ kind: "csv", filename: file.name, content: await file.text() });
if (preview.counts.rejected > 0) showRowErrors(preview.rows.filter(r => r.status === "rejected"));
const batch = await trpc.inari.importCommit.mutate({ previewId: preview.previewId });
await utils.invalidate();                      // every query recomputes from the new snapshot
```

Invalidate-everything after `importCommit`, `importUndo`, `setBalances`, `useDemoData`, `correctCategory`, `upsertGoal`, `deleteGoal`. Pure read mutations (`simulate`, `importPreview`) do not need invalidation.

## 5. Error handling

All failures: `TRPCError` plus `cause = { inari: { code, details? } }`. superjson preserves it in `error.data.inari` (formatter added in server).

| Code | tRPC code | UI behaviour |
|---|---|---|
| UNSUPPORTED_FORMAT, PARSE_FAILED | BAD_REQUEST | show row-level errors from preview when available |
| FILE_TOO_LARGE, TOO_MANY_ROWS | PAYLOAD_TOO_LARGE | ask to split the file |
| PASSWORD_REQUIRED | BAD_REQUEST | prompt for PDF password (not stored) |
| SCANNED_PDF_UNSUPPORTED | UNPROCESSABLE_CONTENT | suggest CSV |
| PREVIEW_EXPIRED | NOT_FOUND | restart import |
| NO_DATA / INSUFFICIENT_DATA | PRECONDITION_FAILED | show onboarding / "need more months" state |
| INVALID_SCENARIO | BAD_REQUEST | inline form error |
| GUARDRAIL_REFUSED | OK with `guardrail.status="refused"` | render the refusal as a normal advisor message |
| LLM_UNAVAILABLE | never surfaced | backend silently falls back; `mode:"fallback"` |

## 6. Fixtures the frontend can use today

The backend will ship `shared/inari/fixtures.ts` exporting typed sample values (`sampleSnapshot`, `samplePreview`, `sampleReport`, `sampleSubscriptions`, `sampleSimulation`) that match these schemas, and a mock mode (`INARI_STUB=true`) in which `inari.*` returns them. Until the real implementation lands the frontend can import the same fixtures for Storybook/offline work.

## 7. Open questions for the contract (need your decision)

1. Is `en` + `hi` voice/text required, or English only (as today, `preferredLanguage: "english"` literal)? [A]
2. Should the user be able to undo an import (`importUndo`), or is commit final?
3. Are PDF and SMS in the demo scope? Contract includes them; backend may ship them flagged off (`meta.features`).
4. Real login vs anonymous per-browser identity (decision D2 in the plan).
5. Goal types: contract widens the 5-value enum to 10 values. The frontend dev must not rely on the old enum for imported mode.

## 8. Verified vs assumed

- Verified: tRPC + superjson stack, `@shared` alias, existing response shapes quoted here (`AdvisorResponse`, `WealthContext`), existing router names.
- Not verified: nothing here has been compiled. The Zod snippets are a proposal and have not been run through `tsc`. Zod is v4 in this repo; `z.discriminatedUnion`, `z.infer` and `.default()` are supported, but `.shape` on `.omit()` objects and `PAYLOAD_TOO_LARGE` mapping must be checked at implementation time. [A]
