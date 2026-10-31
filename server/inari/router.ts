/**
 * Additive `inari.*` tRPC router.
 * Procedures whose status is "stub" in shared/inari/contracts.ts PROCEDURE_STATUS return
 * SYNTHETIC FIXTURES labelled implementation:"stub". They are never financial calculations.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  AnalyzeIntentInput, AskInput, BalancesInput, BreakdownOutput, CATEGORIES, CategoriesOutput, ClearMyDataInput,
  ClearMyDataOutput, ConfirmSubscriptionInput, CONTRACT_VERSION, CorrectionInput, CorrectionResult, GoalIdOutput,
  GoalInput, GoalsOutput, ImportBatch, ImportHistoryOutput, ImportPreview, ImportSourceInput, InariAdvisorResponse,
  IntentAnalysis, LearnedRulesOutput, ListTransactionsInput, ListTransactionsOutput, MetaOutput, MonthlyReport,
  PROCEDURE_STATUS, ReportMonthsOutput, SimulateInput, SimulationResult, Snapshot, SubscriptionsOutput,
  SuccessOutput, YearMonth, DataSource, type Category,
} from "../../shared/inari/contracts";
import * as fx from "../../shared/inari/fixtures";
import { guarded } from "./errors";
import { getLedgerRepository } from "./ledger";
import {
  commitImport, correctCategory, deleteLearnedRule, getBreakdown, getSnapshotFor, previewImport, setBalances,
  setUseDemo, undoImport, isImportedMode, listSubscriptionsFor, decideSubscription,
} from "./service";
import { loadImportedModel } from "./importedModel";
import { runSimulation } from "./simulate";
import { analyzeIntentText } from "./nlp/intent";

const LIMITS = { maxCsvBytes: 5_000_000, maxSmsChars: 500_000, maxPdfBytes: 6_000_000 } as const;

/** All INARI procedures require an identity and operate only on that identity's data. */
const ownerProcedure = protectedProcedure.use(({ ctx, next }) =>
  next({ ctx: { ...ctx, ownerKey: ctx.inariUserKey ?? `user:${ctx.user.openId}` } })
);

const CATEGORY_LABELS: Record<Category, { label: string; kind: "income" | "expense" | "neutral" }> = {
  salary: { label: "Salary", kind: "income" },
  other_income: { label: "Other income", kind: "income" },
  rent: { label: "Rent", kind: "expense" },
  emi: { label: "EMI / loan", kind: "expense" },
  groceries: { label: "Groceries", kind: "expense" },
  dining: { label: "Dining & delivery", kind: "expense" },
  fuel: { label: "Fuel", kind: "expense" },
  transport: { label: "Transport", kind: "expense" },
  utilities: { label: "Utilities & bills", kind: "expense" },
  subscription: { label: "Subscriptions", kind: "expense" },
  shopping: { label: "Shopping", kind: "expense" },
  entertainment: { label: "Entertainment", kind: "expense" },
  health: { label: "Health", kind: "expense" },
  insurance: { label: "Insurance", kind: "expense" },
  education: { label: "Education", kind: "expense" },
  travel: { label: "Travel", kind: "expense" },
  investment: { label: "Investments", kind: "neutral" },
  savings: { label: "Savings", kind: "neutral" },
  fees_tax: { label: "Fees & taxes", kind: "expense" },
  cash: { label: "Cash withdrawal", kind: "expense" },
  transfer: { label: "Transfers", kind: "neutral" },
  other: { label: "Other", kind: "expense" },
};

const stub = <T>(value: T) => value; // marker helper: fixtures already carry implementation:"stub"

// ---------- stub procedures (shared so aliases reuse the same object) ----------
const askProcedure = ownerProcedure.input(AskInput).output(InariAdvisorResponse).mutation(() => stub(fx.sampleAdvisor));
const listTransactionsProcedure = ownerProcedure
  .input(ListTransactionsInput)
  .output(ListTransactionsOutput)
  .query(async ({ ctx, input }) => {
    const all = await getLedgerRepository().listTransactions(ctx.ownerKey, {
      month: input?.month, category: input?.category, q: input?.q, needsReview: input?.needsReview,
    });
    const limit = input?.limit ?? 50;
    const offset = input?.cursor ? Math.max(0, Number.parseInt(input.cursor, 10) || 0) : 0;
    const items = all.slice(offset, offset + limit);
    const next = offset + limit < all.length ? String(offset + limit) : null;
    const dataSource: z.infer<typeof DataSource> = (await getLedgerRepository().listBatches(ctx.ownerKey)).some(
      b => b.status === "committed"
    )
      ? "imported"
      : "demo";
    return { implementation: "implemented" as const, items, nextCursor: next, dataSource };
  });
const listLearnedRulesProcedure = ownerProcedure.output(LearnedRulesOutput).query(async ({ ctx }) => ({
  implementation: "implemented" as const,
  items: (await getLedgerRepository().listRules(ctx.ownerKey)).map(r => ({ ...r, createdAt: new Date(r.createdAt) })),
}));
const listSubscriptionsProcedure = ownerProcedure.output(SubscriptionsOutput).query(({ ctx }) => guarded(() => listSubscriptionsFor(ctx.ownerKey)));
const monthlyReportProcedure = ownerProcedure
  .input(z.object({ month: YearMonth }))
  .output(MonthlyReport)
  .query(() => fx.sampleReport);

export const inariRouter = router({
  // ---------- implemented ----------
  meta: ownerProcedure.output(MetaOutput).query(async ({ ctx }) => {
    const repo = getLedgerRepository();
    const hasData = await isImportedMode(ctx.ownerKey);
    const storage = repo.storageInfo();
    return {
      implementation: "implemented" as const,
      contractVersion: CONTRACT_VERSION,
      dataSource: hasData ? ("imported" as const) : ("demo" as const),
      identity: {
        kind: ctx.inariIdentityKind ?? "authenticated",
        productionGrade: false as const,
      },
      storage,
      limits: LIMITS,
      features: {
        ledger: true, csv: true, sms: true, pdf: false, categorization: true, subscriptions: true,
        simulations: true, reports: false, guardrails: false, voiceIntent: true, llm: false,
      },
      procedures: PROCEDURE_STATUS,
    };
  }),

  getCategories: ownerProcedure.output(CategoriesOutput).query(() => ({
    implementation: "implemented" as const,
    items: CATEGORIES.map(id => ({ id, ...CATEGORY_LABELS[id] })),
  })),

  importHistory: ownerProcedure.output(ImportHistoryOutput).query(async ({ ctx }) => {
    const batches = await getLedgerRepository().listBatches(ctx.ownerKey);
    return {
      implementation: "implemented" as const,
      items: batches.map(b => ({ ...b, importedAt: new Date(b.importedAt) })),
    };
  }),

  listTransactions: listTransactionsProcedure,
  getTransactions: listTransactionsProcedure, // alias

  clearMyData: ownerProcedure.input(ClearMyDataInput).output(ClearMyDataOutput).mutation(async ({ ctx }) => {
    const removed = await getLedgerRepository().deleteAll(ctx.ownerKey);
    return {
      implementation: "implemented" as const,
      deletedTransactions: removed.transactions,
      deletedBatches: removed.batches,
      deletedRules: removed.rules,
    };
  }),

  getSnapshot: ownerProcedure.output(Snapshot).query(({ ctx }) => getSnapshotFor(ctx.ownerKey)),
  setBalances: ownerProcedure.input(BalancesInput).output(Snapshot).mutation(({ ctx, input }) => setBalances(ctx.ownerKey, input)),
  useDemoData: ownerProcedure
    .input(z.object({ enabled: z.boolean() }))
    .output(z.object({ implementation: z.literal("implemented"), dataSource: DataSource }))
    .mutation(async ({ ctx, input }) => ({ implementation: "implemented" as const, dataSource: await setUseDemo(ctx.ownerKey, input.enabled) })),

  importPreview: ownerProcedure.input(ImportSourceInput).output(ImportPreview).mutation(({ ctx, input }) => guarded(() => previewImport(ctx.ownerKey, input))),
  importCommit: ownerProcedure
    .input(z.object({ previewId: z.string(), accountLabel: z.string().max(60).optional() }))
    .output(ImportBatch)
    .mutation(({ ctx, input }) => guarded(() => commitImport(ctx.ownerKey, input))),
  importUndo: ownerProcedure
    .input(z.object({ batchId: z.string() }))
    .output(ImportBatch)
    .mutation(({ ctx, input }) => guarded(() => undoImport(ctx.ownerKey, input.batchId))),

  correctCategory: ownerProcedure.input(CorrectionInput).output(CorrectionResult).mutation(({ ctx, input }) =>
    guarded(async () => ({ implementation: "implemented" as const, ...(await correctCategory(ctx.ownerKey, input)) }))
  ),
  listLearnedRules: listLearnedRulesProcedure,
  getLearnedRules: listLearnedRulesProcedure, // alias
  deleteLearnedRule: ownerProcedure
    .input(z.object({ ruleId: z.string() }))
    .output(z.object({ implementation: z.literal("implemented"), success: z.literal(true) }))
    .mutation(({ ctx, input }) =>
      guarded(async () => {
        await deleteLearnedRule(ctx.ownerKey, input.ruleId);
        return { implementation: "implemented" as const, success: true as const };
      })
    ),
  getBreakdown: ownerProcedure
    .input(z.object({ month: YearMonth }))
    .output(BreakdownOutput)
    .query(async ({ ctx, input }) => ({ implementation: "implemented" as const, month: input.month, items: await getBreakdown(ctx.ownerKey, input.month) })),

  listSubscriptions: listSubscriptionsProcedure,
  getSubscriptions: listSubscriptionsProcedure, // alias
  confirmSubscription: ownerProcedure
    .input(ConfirmSubscriptionInput)
    .output(z.object({ implementation: z.literal("implemented"), success: z.literal(true) }))
    .mutation(({ ctx, input }) => guarded(() => decideSubscription(ctx.ownerKey, input.subscriptionId, input.decision))),

  simulate: ownerProcedure.input(SimulateInput).output(SimulationResult).mutation(({ ctx, input }) =>
    guarded(async () => runSimulation(input.scenarios, await loadImportedModel(ctx.ownerKey)))
  ),

  ask: askProcedure,
  askAdvisor: askProcedure, // alias
  analyzeIntent: ownerProcedure.input(AnalyzeIntentInput).output(IntentAnalysis).mutation(({ input }) => analyzeIntentText(input.text, input.previous)),

  monthlyReport: monthlyReportProcedure,
  getMonthlyReport: monthlyReportProcedure, // alias
  listReportMonths: ownerProcedure.output(ReportMonthsOutput).query(() => ({ implementation: "stub" as const, months: ["2026-09"] })),

  getGoals: ownerProcedure.output(GoalsOutput).query(() => ({ implementation: "stub" as const, items: fx.sampleGoals, dataSource: "imported" as const })),
  upsertGoal: ownerProcedure.input(GoalInput).output(GoalIdOutput).mutation(() => ({ implementation: "stub" as const, id: "fx-goal-1" })),
  deleteGoal: ownerProcedure
    .input(z.object({ id: z.string() }))
    .output(SuccessOutput)
    .mutation(() => ({ implementation: "stub" as const, success: true as const })),
});
