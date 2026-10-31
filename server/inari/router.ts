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
  PROCEDURE_STATUS, ReconcileInput, ReconcileOutput, ReportMonthsOutput, SimulateInput, SimulationResult, Snapshot, SubscriptionsOutput,
  SuccessOutput, YearMonth, DataSource, type Category,
  ClaimKind, ClaimMatchesOutput, ClaimsOutput, ConfirmClaimMatchInput, CreateClaimInput, DataCoverageOutput, EmiCheckInput,
  EmiCheckOutput, ManualEntryCommitInput, ManualEntryCommitOutput, ManualEntryInput, ManualEntryPreviewOutput, UndoClaimMatchInput,
} from "../../shared/inari/contracts";
import * as fx from "../../shared/inari/fixtures";
import { guarded } from "./errors";
import { getLedgerRepository } from "./ledger";
import {
  commitImport, correctCategory, deleteLearnedRule, getBreakdown, getSnapshotFor, previewImport, setBalances,
  setUseDemo, undoImport, isImportedMode, listSubscriptionsFor, decideSubscription, reconcileTransactions,
} from "./service";
import { loadImportedModel } from "./importedModel";
import { runSimulation } from "./simulate";
import { deleteGoalFor, goalsOverview, upsertGoalFor } from "./goals";
import { askAdvisorFor } from "./advisor";
import { cancelClaimFor, claimMatchesFor, confirmClaimMatchFor, createClaimFor, listClaimsFor, undoClaimMatchFor } from "./claims";
import { dataCoverageFor, manualEntryCommitFor, manualEntryPreviewFor } from "./manual";
import { emiCheckFor } from "./emi";
import { monthlyReportFor, reportMonthsFor } from "./report";
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
const askProcedure = ownerProcedure.input(AskInput).output(InariAdvisorResponse).mutation(({ ctx, input }) =>
  guarded(() => askAdvisorFor(ctx.ownerKey, { question: input.question, previous: input.previous }))
);
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
  .query(({ ctx, input }) => guarded(() => monthlyReportFor(ctx.ownerKey, input.month)));

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
        ledger: true, csv: true, sms: true, pdf: true, categorization: true, subscriptions: true,
        simulations: true, reports: true, guardrails: true, voiceIntent: true, llm: false,
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
    .input(z.object({
      previewId: z.string(), accountLabel: z.string().max(60).optional(),
      /** Additive. Possible duplicates are NOT written unless listed here (by rowNumber) or `importAllPossibleDuplicates` is true. */
      importPossibleDuplicateRows: z.array(z.number().int()).max(20_000).optional(),
      importAllPossibleDuplicates: z.boolean().optional(),
    }))
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

  reconcile: ownerProcedure.input(ReconcileInput).output(ReconcileOutput).mutation(({ ctx, input }) => guarded(() => reconcileTransactions(ctx.ownerKey, input))),

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
  listReportMonths: ownerProcedure.output(ReportMonthsOutput).query(async ({ ctx }) => ({ implementation: "implemented" as const, months: await reportMonthsFor(ctx.ownerKey) })),

  getGoals: ownerProcedure.output(GoalsOutput).query(({ ctx }) => guarded(() => goalsOverview(ctx.ownerKey))),
  upsertGoal: ownerProcedure.input(GoalInput).output(GoalIdOutput).mutation(({ ctx, input }) =>
    guarded(async () => ({ implementation: "implemented" as const, id: await upsertGoalFor(ctx.ownerKey, input) }))
  ),
  deleteGoal: ownerProcedure
    .input(z.object({ id: z.string() }))
    .output(SuccessOutput)
    .mutation(({ ctx, input }) =>
      guarded(async () => {
        await deleteGoalFor(ctx.ownerKey, input.id);
        return { implementation: "implemented" as const, success: true as const };
      })
    ),

  // refund watch + reimbursements: claims never create cash; settlement needs an explicit confirmation
  createClaim: ownerProcedure.input(CreateClaimInput).output(GoalIdOutput).mutation(({ ctx, input }) =>
    guarded(async () => ({ implementation: "implemented" as const, id: await createClaimFor(ctx.ownerKey, input) }))
  ),
  listClaims: ownerProcedure.input(z.object({ kind: ClaimKind.optional() }).optional()).output(ClaimsOutput).query(({ ctx, input }) =>
    guarded(() => listClaimsFor(ctx.ownerKey, input?.kind))
  ),
  claimMatches: ownerProcedure.input(z.object({ claimId: z.string().max(100) })).output(ClaimMatchesOutput).query(({ ctx, input }) =>
    guarded(() => claimMatchesFor(ctx.ownerKey, input.claimId))
  ),
  confirmClaimMatch: ownerProcedure.input(ConfirmClaimMatchInput).output(ClaimsOutput).mutation(({ ctx, input }) =>
    guarded(async () => {
      await confirmClaimMatchFor(ctx.ownerKey, input);
      return listClaimsFor(ctx.ownerKey);
    })
  ),
  undoClaimMatch: ownerProcedure.input(UndoClaimMatchInput).output(ClaimsOutput).mutation(({ ctx, input }) =>
    guarded(async () => {
      await undoClaimMatchFor(ctx.ownerKey, input);
      return listClaimsFor(ctx.ownerKey);
    })
  ),
  cancelClaim: ownerProcedure.input(z.object({ claimId: z.string().max(100) })).output(ClaimsOutput).mutation(({ ctx, input }) =>
    guarded(async () => {
      await cancelClaimFor(ctx.ownerKey, input.claimId);
      return listClaimsFor(ctx.ownerKey);
    })
  ),

  // untracked money: preview then explicit commit (idempotent); undo = importUndo(batchId)
  manualEntryPreview: ownerProcedure.input(ManualEntryInput).output(ManualEntryPreviewOutput).mutation(({ ctx, input }) =>
    guarded(() => manualEntryPreviewFor(ctx.ownerKey, input))
  ),
  manualEntryCommit: ownerProcedure.input(ManualEntryCommitInput).output(ManualEntryCommitOutput).mutation(({ ctx, input }) =>
    guarded(() => manualEntryCommitFor(ctx.ownerKey, input))
  ),
  dataCoverage: ownerProcedure.output(DataCoverageOutput).query(({ ctx }) => guarded(() => dataCoverageFor(ctx.ownerKey))),

  // hypothetical only: never writes to the ledger
  emiCheck: ownerProcedure.input(EmiCheckInput).output(EmiCheckOutput).mutation(({ ctx, input }) => guarded(() => emiCheckFor(ctx.ownerKey, input))),
});
