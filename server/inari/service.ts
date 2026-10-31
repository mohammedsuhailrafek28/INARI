import { randomUUID } from "node:crypto";
import type {
  BalancesInput, Category, CategoryBreakdownItem, ImportBatch, ImportCounts, ImportPreview, ImportSourceInput,
  LedgerTransaction, Snapshot,
} from "../../shared/inari/contracts";
import { CARD_REPAYMENT, classify, merchantKey } from "./categorize";
import { InariError } from "./errors";
import { parseCsvStatement, type Candidate } from "./ingestion/csvImport";
import { parseSmsImport } from "./ingestion/sms";
import { parsePdfStatement } from "./ingestion/pdfImport";
import { detectSubscriptions, isActiveSubscription } from "./recurring";
import { getLedgerRepository } from "./ledger";
import type { CorrectionAudit, StoredBatch, StoredProfile, StoredLearnedRule } from "./ledger/types";
import { isExcluded, isExpenseCategory, computeMonthTotals, deriveFinancialSnapshot, emptySnapshot } from "./snapshot";

export const IMPORT_LIMITS = { maxCsvBytes: 5_000_000, maxRows: 20_000 } as const;
const PREVIEW_TTL_MS = 30 * 60 * 1000;
const MAX_PREVIEWS_PER_USER = 5;

type PreviewRow = { candidate: Candidate; status: "accepted" | "duplicate" | "possible_duplicate"; possibleDuplicateOf: string | null };
type StoredPreview = {
  userKey: string;
  expiresAt: number;
  source: "csv" | "sms" | "pdf";
  filename: string | null;
  rows: PreviewRow[];
  rejectedCount: number;
  ignoredCount: number;
};
const previews = new Map<string, StoredPreview>();

function gcPreviews(now = Date.now()) {
  for (const [id, p] of Array.from(previews.entries())) if (p.expiresAt <= now) previews.delete(id);
}
export const _previewStoreForTests = { size: () => previews.size, clear: () => previews.clear(), expireAll: () => previews.forEach(p => (p.expiresAt = 0)) };

const learnedMap = (rules: StoredLearnedRule[]) => new Map(rules.map(r => [r.merchantKey, r.category] as const));

function periodOf(dates: string[]) {
  if (dates.length === 0) return null;
  const sorted = [...dates].sort();
  return { from: sorted[0], to: sorted[sorted.length - 1] };
}

const hasCommitted = async (userKey: string) => (await getLedgerRepository().listBatches(userKey)).some(b => b.status === "committed");

export async function previewImport(userKey: string, input: ImportSourceInput): Promise<ImportPreview> {
  const source: "csv" | "sms" | "pdf" = input.kind;
  if (input.kind === "csv" && Buffer.byteLength(input.content, "utf8") > IMPORT_LIMITS.maxCsvBytes) {
    throw new InariError("FILE_TOO_LARGE", "The file is larger than 5 MB. Split it into smaller files.");
  }
  gcPreviews();
  const repo = getLedgerRepository();
  const parsed =
    input.kind === "csv"
      ? parseCsvStatement(input.content, { userKey, maxRows: IMPORT_LIMITS.maxRows })
      : input.kind === "pdf"
        ? await parsePdfStatement(input.contentBase64, { userKey, maxRows: IMPORT_LIMITS.maxRows, password: input.password })
        : parseSmsImport(input.text, { userKey });
  if (parsed.candidates.length === 0 && parsed.rejected.length === 0 && (source !== "sms" || parsed.ignored.length === 0)) {
    throw new InariError("PARSE_FAILED", source === "sms" ? "No SMS messages were found in the text." : "No transactions were found in the file.");
  }

  const existing = await repo.listTransactions(userKey);
  const known = new Set(existing.map(t => t.fingerprint));
  const byShape = new Map<string, LedgerTransaction>();
  for (const t of existing) byShape.set(`${t.postedOn}|${t.amountPaise}|${t.direction}`, t);

  const rows: PreviewRow[] = parsed.candidates.map(candidate => {
    if (known.has(candidate.fingerprint)) return { candidate, status: "duplicate", possibleDuplicateOf: null };
    const similar = byShape.get(`${candidate.postedOn}|${candidate.amountPaise}|${candidate.direction}`);
    if (similar) return { candidate, status: "possible_duplicate", possibleDuplicateOf: similar.id };
    return { candidate, status: "accepted", possibleDuplicateOf: null };
  });

  const counts: ImportCounts = {
    total: parsed.candidates.length + parsed.rejected.length + parsed.ignored.length,
    accepted: rows.filter(r => r.status === "accepted").length,
    duplicate: rows.filter(r => r.status === "duplicate").length,
    possibleDuplicate: rows.filter(r => r.status === "possible_duplicate").length,
    rejected: parsed.rejected.length,
    ignored: parsed.ignored.length,
  };
  const importable = rows.filter(r => r.status !== "duplicate");
  const period = periodOf(importable.map(r => r.candidate.postedOn));

  const learned = learnedMap(await repo.listRules(userKey));
  const toTx = (r: PreviewRow) => buildTransaction(r.candidate, r.possibleDuplicateOf, learned, "preview", null);

  // keep the preview payload bounded: problems first, then accepted rows
  const shown: ImportPreview["rows"] = [];
  for (const rej of parsed.rejected) if (shown.length < 100) shown.push({ rowNumber: rej.rowNumber, status: "rejected", reason: rej.reason, transaction: null });
  if (source === "sms" || source === "pdf") {
    for (const ign of parsed.ignored) if (shown.length < 100) shown.push({ rowNumber: ign.rowNumber, status: "ignored", reason: ign.reason, transaction: null });
  }
  for (const r of rows) {
    if (shown.length >= 200) break;
    if (r.status === "accepted") continue;
    const { id: _id, batchId: _b, ...tx } = toTx(r);
    shown.push({
      rowNumber: r.candidate.rowNumber,
      status: r.status,
      reason: r.status === "duplicate" ? "already imported" : "same date, amount and direction as an existing transaction",
      transaction: tx,
    });
  }
  for (const r of rows) {
    if (shown.length >= 200) break;
    if (r.status !== "accepted") continue;
    const { id: _id, batchId: _b, ...tx } = toTx(r);
    shown.push({ rowNumber: r.candidate.rowNumber, status: "accepted", reason: null, transaction: tx });
  }

  const warnings = [...parsed.warnings];
  if (counts.duplicate > 0) warnings.push(`${counts.duplicate} row(s) were already imported and will be skipped.`);
  if (counts.possibleDuplicate > 0) warnings.push(`${counts.possibleDuplicate} row(s) look like existing transactions with different wording; they will be imported and flagged for review.`);
  if (counts.rejected > 0) warnings.push(`${counts.rejected} row(s) could not be read and will be skipped (see reasons).`);
  if (shown.length >= 200 && counts.total > 200) warnings.push("Only the first 200 rows are listed here; counts cover the whole file.");

  // bounded per-user preview cache
  const mine = Array.from(previews.entries()).filter(([, p]) => p.userKey === userKey).sort((a, b) => a[1].expiresAt - b[1].expiresAt);
  while (mine.length >= MAX_PREVIEWS_PER_USER) previews.delete(mine.shift()![0]);

  const previewId = `prev_${randomUUID()}`;
  previews.set(previewId, {
    userKey,
    expiresAt: Date.now() + PREVIEW_TTL_MS,
    source,
    filename: input.kind === "csv" || input.kind === "pdf" ? input.filename.slice(0, 200) : null,
    rows,
    rejectedCount: counts.rejected,
    ignoredCount: counts.ignored,
  });

  return {
    implementation: "implemented",
    previewId,
    source,
    detectedFormat: parsed.format,
    counts,
    period,
    rows: shown,
    warnings,
    needsUserInput: [],
  };
}

function buildTransaction(
  c: Candidate,
  possibleDuplicateOf: string | null,
  learned: ReadonlyMap<string, Category>,
  batchId: string,
  accountLabel: string | null
): LedgerTransaction {
  const cls = c.isTransfer
    ? { category: "transfer" as Category, source: "rule" as const, confidence: 0.9 }
    : classify({ narration: c.narration, merchant: c.merchant, direction: c.direction, learned });
  return {
    id: `txn_${c.fingerprint.slice(0, 24)}`,
    fingerprint: c.fingerprint,
    batchId,
    source: c.source ?? "csv",
    postedOn: c.postedOn,
    amountPaise: c.amountPaise,
    amount: c.amountPaise / 100,
    direction: c.direction,
    merchant: c.merchant,
    narration: c.narration,
    instrument: c.instrument,
    accountLabel,
    category: cls.category,
    categorySource: cls.source,
    categoryConfidence: cls.confidence,
    correctedFrom: null,
    isTransfer: c.isTransfer || cls.category === "transfer",
    isRecurring: false,
    possibleDuplicateOf,
    balanceAfterPaise: c.balanceAfterPaise,
    ...(c.evidence ? { evidence: c.evidence } : {}),
  };
}

const toBatchOutput = (b: StoredBatch): ImportBatch => ({ implementation: "implemented", ...b, importedAt: new Date(b.importedAt) });

export async function commitImport(userKey: string, args: { previewId: string; accountLabel?: string }): Promise<ImportBatch> {
  gcPreviews();
  const preview = previews.get(args.previewId);
  if (!preview || preview.userKey !== userKey) {
    // identical message for "not yours" and "expired": do not reveal other users' previews
    throw new InariError("PREVIEW_EXPIRED", "This import preview has expired or does not exist. Upload the file again.");
  }
  const repo = getLedgerRepository();
  const known = await repo.existingFingerprints(userKey); // re-checked at commit time, not trusted from preview
  const learned = learnedMap(await repo.listRules(userKey));
  const batchId = `batch_${randomUUID()}`;
  const label = args.accountLabel?.trim() || null;

  const fresh = preview.rows.filter(r => r.status !== "duplicate" && !known.has(r.candidate.fingerprint));
  const transactions = fresh.map(r => buildTransaction(r.candidate, r.possibleDuplicateOf, learned, batchId, label));
  if (transactions.length === 0) {
    previews.delete(args.previewId);
    throw new InariError("NO_DATA", "Nothing new to import: every row was already imported or invalid.");
  }
  const counts: ImportCounts = {
    total: preview.rows.length + preview.rejectedCount + preview.ignoredCount,
    accepted: fresh.filter(r => r.status === "accepted").length,
    duplicate: preview.rows.length - fresh.length,
    possibleDuplicate: fresh.filter(r => r.status === "possible_duplicate").length,
    rejected: preview.rejectedCount,
    ignored: preview.ignoredCount,
  };
  const batch: StoredBatch = {
    batchId,
    source: preview.source,
    filename: preview.filename,
    importedAt: new Date().toISOString(),
    counts,
    period: periodOf(transactions.map(t => t.postedOn)),
    status: "committed",
  };
  await repo.commitBatch(userKey, batch, transactions);
  previews.delete(args.previewId);
  return toBatchOutput(batch);
}

export async function undoImport(userKey: string, batchId: string): Promise<ImportBatch> {
  const batch = await getLedgerRepository().undoBatch(userKey, batchId);
  if (!batch) throw new InariError("NOT_FOUND", "Import not found.");
  return toBatchOutput(batch);
}

export async function getProfile(userKey: string): Promise<StoredProfile | null> {
  return getLedgerRepository().getProfile(userKey);
}

export async function getSnapshotFor(userKey: string): Promise<Snapshot> {
  const repo = getLedgerRepository();
  const [transactions, batches, profile] = await Promise.all([repo.listTransactions(userKey), repo.listBatches(userKey), repo.getProfile(userKey)]);
  if (!batches.some(b => b.status === "committed")) return emptySnapshot("demo", profile); // no imported dataset active: every figure unknown, never persona values
  return deriveFinancialSnapshot({ transactions, batches, profile });
}

export async function setBalances(userKey: string, input: BalancesInput): Promise<Snapshot> {
  const repo = getLedgerRepository();
  const current = await repo.getProfile(userKey);
  await repo.setProfile(userKey, {
    useDemo: current?.useDemo ?? false,
    emergencyFund: input.emergencyFund,
    investments: input.investments,
    creditCardDebt: input.creditCardDebt,
    ...(current?.subscriptionDecisions ? { subscriptionDecisions: current.subscriptionDecisions } : {}),
    ...(current?.goals ? { goals: current.goals } : {}),
    ...(current?.claims ? { claims: current.claims } : {}),
    ...(input.age !== undefined ? { age: input.age } : current?.age !== undefined ? { age: current.age } : {}),
    ...(input.riskPreference ? { riskPreference: input.riskPreference } : current?.riskPreference ? { riskPreference: current.riskPreference } : {}),
  });
  return getSnapshotFor(userKey);
}

export async function listSubscriptionsFor(userKey: string) {
  const repo = getLedgerRepository();
  const [transactions, profile] = await Promise.all([repo.listTransactions(userKey), repo.getProfile(userKey)]);
  const items = detectSubscriptions(transactions.filter(t => !isExcluded(t)), profile?.subscriptionDecisions).map(({ category: _c, monthlyEquivalentPaise: _m, ...s }) => s);
  const active = items.filter(isActiveSubscription);
  return {
    implementation: "implemented" as const,
    items,
    monthlyTotal: Math.round(active.reduce((sum, s) => sum + s.monthlyEquivalent * 100, 0)) / 100,
    annualTotal: Math.round(active.reduce((sum, s) => sum + s.annualCost * 100, 0)) / 100,
  };
}

export async function decideSubscription(userKey: string, subscriptionId: string, decision: "confirm" | "dismiss") {
  const repo = getLedgerRepository();
  const [transactions, current] = await Promise.all([repo.listTransactions(userKey), repo.getProfile(userKey)]);
  if (!detectSubscriptions(transactions.filter(t => !isExcluded(t))).some(s => s.id === subscriptionId)) throw new InariError("NOT_FOUND", "Subscription not found.");
  await repo.setProfile(userKey, {
    emergencyFund: null, investments: null, creditCardDebt: null, useDemo: false, ...current,
    subscriptionDecisions: { ...current?.subscriptionDecisions, [subscriptionId]: decision === "confirm" ? "confirmed" : "dismissed" },
  });
  return { implementation: "implemented" as const, success: true as const };
}

export type ReconcileDecision = "exclude_duplicate" | "exclude_card_double_count" | "keep_separate" | "undo";

/**
 * Explicit, user-confirmed reconciliation. Rows are never deleted: an exclusion only removes the row from totals,
 * and `undo` restores it. A flagged pair can never be excluded on both sides.
 */
export async function reconcileTransactions(userKey: string, input: { transactionIds: string[]; decision: ReconcileDecision }) {
  const repo = getLedgerRepository();
  const all = await repo.listTransactions(userKey);
  const byId = new Map(all.map(t => [t.id, t]));
  const ids = Array.from(new Set(input.transactionIds));
  const rows = ids.map(id => byId.get(id));
  if (rows.some(r => !r)) throw new InariError("NOT_FOUND", "One or more transactions were not found.");
  const picked = rows as LedgerTransaction[];
  const chosen = new Set(ids);

  for (const t of picked) {
    if (input.decision === "exclude_duplicate" || input.decision === "keep_separate") {
      if (!t.possibleDuplicateOf) throw new InariError("INVALID_INPUT", "Only transactions flagged as possible duplicates can be handled this way.");
    }
    if (input.decision === "exclude_duplicate") {
      const original = byId.get(t.possibleDuplicateOf!);
      if (chosen.has(t.possibleDuplicateOf!) || (original && isExcluded(original))) {
        throw new InariError("INVALID_INPUT", "Keep at least one transaction of each possible-duplicate pair; the original is already excluded or selected.");
      }
    }
    if (input.decision === "exclude_card_double_count" && !(t.direction === "debit" && !t.isTransfer && CARD_REPAYMENT.test(t.narration))) {
      throw new InariError("INVALID_INPUT", "Only credit-card repayment debits can be handled this way.");
    }
    if (input.decision === "undo" && !t.reconciliation) throw new InariError("INVALID_INPUT", "That transaction has no reconciliation decision to undo.");
  }
  const at = new Date().toISOString();
  const decision =
    input.decision === "exclude_duplicate" ? "excluded_duplicate" : input.decision === "exclude_card_double_count" ? "excluded_card_double_count" : "kept_separate";
  const updated = await repo.updateTransactions(
    userKey,
    picked.map(t => ({ id: t.id, patch: { reconciliation: input.decision === "undo" ? undefined : { decision, decidedAt: at } } }))
  );
  return { implementation: "implemented" as const, updated };
}

export async function setUseDemo(userKey: string, enabled: boolean) {
  const repo = getLedgerRepository();
  const current = await repo.getProfile(userKey);
  await repo.setProfile(userKey, { emergencyFund: null, investments: null, creditCardDebt: null, ...current, useDemo: enabled });
  return enabled ? ("demo" as const) : ("imported" as const);
}

/** True when this owner's numbers must come from imported data (never from the persona). */
export async function isImportedMode(userKey: string): Promise<boolean> {
  const repo = getLedgerRepository();
  const profile = await repo.getProfile(userKey);
  if (profile?.useDemo) return false;
  return hasCommitted(userKey);
}

/* ---------- categories: breakdown, corrections, learned rules ---------- */

export function breakdownForMonth(transactions: LedgerTransaction[], batches: StoredBatch[], month: string): CategoryBreakdownItem[] {
  const totals = computeMonthTotals(transactions, batches);
  const cur = totals.find(m => m.month === month);
  if (!cur) return [];
  const [y, m] = month.split("-").map(Number);
  const prevYm = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  const prev = totals.find(t => t.month === prevYm);
  const net = (entry: { debitPaise: number; creditPaise: number } | undefined) => (entry ? Math.max(0, entry.debitPaise - entry.creditPaise) : 0);

  const rows = Array.from(cur.byCategory.entries())
    .filter(([cat]) => isExpenseCategory(cat))
    .map(([category, v]) => ({ category, paise: net(v), count: v.count }))
    .filter(r => r.paise > 0);
  const total = rows.reduce((s, r) => s + r.paise, 0);
  return rows
    .sort((a, b) => b.paise - a.paise || a.category.localeCompare(b.category))
    .map(r => {
      const prevPaise = prev ? net(prev.byCategory.get(r.category)) : null;
      return {
        category: r.category,
        amount: r.paise / 100,
        sharePercent: total > 0 ? Math.round((r.paise / total) * 1000) / 10 : 0,
        transactionCount: r.count,
        previousMonthAmount: prevPaise === null ? null : prevPaise / 100,
        changePercent: prevPaise ? Math.round(((r.paise - prevPaise) / prevPaise) * 1000) / 10 : null,
      };
    });
}

export async function getBreakdown(userKey: string, month: string) {
  const repo = getLedgerRepository();
  const [transactions, batches] = await Promise.all([repo.listTransactions(userKey), repo.listBatches(userKey)]);
  return breakdownForMonth(transactions, batches, month);
}

export async function correctCategory(userKey: string, input: { transactionId: string; category: Category; applyToMerchant: boolean }) {
  const repo = getLedgerRepository();
  const tx = await repo.getTransaction(userKey, input.transactionId);
  if (!tx) throw new InariError("NOT_FOUND", "Transaction not found.");
  const at = new Date().toISOString();
  const patches: Array<{ id: string; patch: Partial<LedgerTransaction> }> = [];
  const audit: CorrectionAudit[] = [];

  if (tx.category !== input.category || tx.categorySource !== "user") {
    patches.push({
      id: tx.id,
      patch: {
        category: input.category,
        categorySource: "user",
        categoryConfidence: 1,
        correctedFrom: tx.correctedFrom ?? tx.category,
        isTransfer: input.category === "transfer",
      },
    });
    audit.push({ id: randomUUID(), transactionId: tx.id, from: tx.category, to: input.category, at, scope: "single" });
  }

  if (input.applyToMerchant) {
    const key = merchantKey(tx.merchant ?? tx.narration);
    if (!key) throw new InariError("CONFLICT", "This transaction has no recognisable merchant to learn from.");
    const siblings = (await repo.listTransactions(userKey)).filter(
      t => t.id !== tx.id && t.categorySource !== "user" && merchantKey(t.merchant ?? t.narration) === key
    );
    for (const s of siblings) {
      if (s.category === input.category && s.categorySource === "learned") continue;
      patches.push({
        id: s.id,
        patch: { category: input.category, categorySource: "learned", categoryConfidence: 0.95, correctedFrom: s.correctedFrom ?? s.category, isTransfer: input.category === "transfer" },
      });
      audit.push({ id: randomUUID(), transactionId: s.id, from: s.category, to: input.category, at, scope: "merchant" });
    }
    const existing = (await repo.listRules(userKey)).find(r => r.merchantKey === key);
    await repo.upsertRule(userKey, {
      ruleId: existing?.ruleId ?? `rule_${randomUUID()}`,
      merchantKey: key,
      category: input.category,
      createdAt: existing?.createdAt ?? at,
      appliedCount: siblings.length + 1,
    });
  }
  const updated = await repo.updateTransactions(userKey, patches, audit);
  const month = tx.postedOn.slice(0, 7);
  return { updated, breakdown: await getBreakdown(userKey, month) };
}

export async function deleteLearnedRule(userKey: string, ruleId: string) {
  const repo = getLedgerRepository();
  const rule = (await repo.listRules(userKey)).find(r => r.ruleId === ruleId);
  if (!rule) throw new InariError("NOT_FOUND", "Rule not found.");
  await repo.deleteRule(userKey, ruleId);
  // transactions that only got their category from this rule go back to the deterministic result
  const affected = (await repo.listTransactions(userKey)).filter(
    t => t.categorySource === "learned" && merchantKey(t.merchant ?? t.narration) === rule.merchantKey
  );
  const patches = affected.map(t => {
    const cls = classify({ narration: t.narration, merchant: t.merchant, direction: t.direction });
    return { id: t.id, patch: { category: cls.category, categorySource: cls.source, categoryConfidence: cls.confidence, correctedFrom: null, isTransfer: cls.category === "transfer" } };
  });
  await repo.updateTransactions(userKey, patches);
}
