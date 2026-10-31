/**
 * Manual (user-confirmed) entries and data-coverage gaps.
 *
 * "Untracked money" is money the user tells us about; INARI never infers or invents it. A manual entry is previewed,
 * needs an explicit commit with an idempotency key, is stored in the same ledger with source "manual", and can be
 * undone with the existing importUndo (it is its own batch). Coverage gaps only say what was NOT observed.
 */
import { createHash, randomUUID } from "node:crypto";
import type { Category, LedgerTransaction, ManualEntryInput } from "../../shared/inari/contracts";
import { classify } from "./categorize";
import { InariError } from "./errors";
import { parseDate } from "./ingestion/csvImport";
import { getLedgerRepository } from "./ledger";
import type { StoredBatch } from "./ledger/types";
import { parseAmountToPaise } from "./money";

const PREVIEW_TTL_MS = 30 * 60 * 1000;
const MAX_PREVIEWS_PER_USER = 10;
type PaymentType = "cash" | "upi" | "card" | "other";
type Entry = { amountPaise: number | null; direction: "debit" | "credit" | null; category: Category | null; postedOn: string; paymentType: PaymentType; narration: string; description: string };
const previews = new Map<string, { userKey: string; expiresAt: number; entry: Entry }>();
export const _manualPreviewsForTests = { clear: () => previews.clear() };

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
const DEBIT_WORDS = /\b(spent|paid|pay|bought|buy|purchase[d]?|gave|given|withdrew|cost)\b/i;
const CREDIT_WORDS = /\b(received|got|earned|credited|came in|income|salary|refund(?:ed)?|sold)\b/i;

function parseText(text: string, now: Date) {
  const t = text.replace(/\s+/g, " ").trim();
  let amountPaise: number | null = null;
  const m = /(?:₹|\brs\.?|\binr)\s*([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s*(?:rupees|rs\b|inr\b|₹)|\b(\d[\d,]*(?:\.\d{1,2})?)\b/i.exec(t);
  if (m) {
    const parsed = parseAmountToPaise(m[1] ?? m[2] ?? m[3]);
    if (parsed && parsed.ok && parsed.paise > 0) amountPaise = parsed.paise;
  }
  const direction: "debit" | "credit" | null = DEBIT_WORDS.test(t) ? "debit" : CREDIT_WORDS.test(t) ? "credit" : null;
  const lower = t.toLowerCase();
  const paymentType: PaymentType = /\bcash\b/.test(lower) ? "cash" : /\bupi\b/.test(lower) ? "upi" : /\bcard\b/.test(lower) ? "card" : "other";
  let postedOn: string | null = null;
  if (/day before yesterday/.test(lower)) postedOn = isoDate(addDays(now, -2));
  else if (/\byesterday\b/.test(lower)) postedOn = isoDate(addDays(now, -1));
  else if (/\btoday\b/.test(lower)) postedOn = isoDate(now);
  else {
    const ago = /\b(\d{1,2}) days? ago\b/.exec(lower);
    const dated = /\b(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})\b/.exec(t);
    if (ago) postedOn = isoDate(addDays(now, -Number(ago[1])));
    else if (dated) postedOn = parseDate(dated[1]);
  }
  const what = /\b(?:on|for)\s+([a-z][a-z &'-]{2,40}?)(?=\s+(?:yesterday|today|\d|using|with|from|in cash|by)\b|[.,]|$)/i.exec(t);
  return { amountPaise, direction, paymentType, postedOn, description: (what?.[1] ?? "").trim() };
}

/** Plain-word hints for everyday cash spending, used only when the merchant rules find nothing. */
const WORD_CATEGORY: Array<[RegExp, Category]> = [
  [/\b(groceries|grocery|vegetables|veggies|milk|kirana|provisions)\b/i, "groceries"],
  [/\b(food|lunch|dinner|breakfast|tea|coffee|snacks?|restaurant|cafe|meal|biryani)\b/i, "dining"],
  [/\b(petrol|diesel|fuel)\b/i, "fuel"],
  [/\b(auto|rickshaw|taxi|cab|bus|metro|train|parking|toll)\b/i, "transport"],
  [/\b(medicine|medicines|doctor|pharmacy|clinic|hospital)\b/i, "health"],
  [/\b(rent)\b/i, "rent"],
  [/\b(electricity|water bill|gas|recharge|internet)\b/i, "utilities"],
  [/\b(movie|movies|game|games|concert)\b/i, "entertainment"],
  [/\b(clothes|shoes|shopping|gift)\b/i, "shopping"],
  [/\b(salary|wages)\b/i, "salary"],
];

export async function manualEntryPreviewFor(userKey: string, input: ManualEntryInput, now = new Date()) {
  const parsed = parseText(input.text ?? "", now);
  const assumptions: string[] = [];
  const amountPaise = input.amount !== undefined ? Math.round(input.amount * 100) : parsed.amountPaise;
  const direction = input.direction ?? parsed.direction;
  const paymentType = input.paymentType ?? parsed.paymentType;
  const postedOn = input.date ?? parsed.postedOn ?? isoDate(now);
  if (!input.date && !parsed.postedOn) assumptions.push("No date was given, so today's date is used.");
  if (postedOn > isoDate(now)) throw new InariError("INVALID_INPUT", "A manual entry cannot be dated in the future.");
  const description = (input.description?.trim() || parsed.description || "").slice(0, 120);
  if (paymentType === "other") assumptions.push("The payment type was not stated, so it is recorded as other.");
  const dir = direction ?? "debit";
  const cls = classify({ narration: description || (input.text ?? ""), merchant: null, direction: dir, learned: new Map() });
  const wordCategory = WORD_CATEGORY.find(([re]) => re.test(description || input.text || ""))?.[1];
  const category: Category | null = direction === null ? null : (input.category ?? (cls.category !== "other" ? cls.category : (wordCategory ?? "other")));
  if (!input.category && category === "other") assumptions.push("No category matched, so it is recorded as other; you can correct it afterwards.");
  const needsUserInput: Array<"amount" | "direction"> = [];
  if (amountPaise === null) needsUserInput.push("amount");
  if (direction === null) needsUserInput.push("direction");
  const label = paymentType === "cash" ? "Cash" : paymentType === "upi" ? "UPI" : paymentType === "card" ? "Card" : "Manual";
  const narration = `${label} ${dir === "debit" ? "expense" : "income"} (manual entry)${description ? `: ${description}` : ""}`;
  const entry: Entry = { amountPaise, direction, category, postedOn, paymentType, narration, description };

  let possibleDuplicateOf: string | null = null;
  if (amountPaise !== null && direction !== null) {
    possibleDuplicateOf = (await getLedgerRepository().listTransactions(userKey)).find(t => t.postedOn === postedOn && t.amountPaise === amountPaise && t.direction === direction)?.id ?? null;
    if (possibleDuplicateOf) assumptions.push("A transaction with the same date, amount and direction already exists. Commit only if this is a different payment.");
  }
  let previewId: string | null = null;
  if (needsUserInput.length === 0) {
    const t = Date.now();
    for (const [id, p] of Array.from(previews.entries())) if (p.expiresAt <= t) previews.delete(id);
    const mine = Array.from(previews.entries()).filter(([, p]) => p.userKey === userKey);
    while (mine.length >= MAX_PREVIEWS_PER_USER) previews.delete(mine.shift()![0]);
    previewId = `mprev_${randomUUID()}`;
    previews.set(previewId, { userKey, expiresAt: t + PREVIEW_TTL_MS, entry });
  }
  return {
    implementation: "implemented" as const, previewId,
    entry: { amountPaise, direction, category, postedOn, paymentType, narration },
    assumptions, needsUserInput, possibleDuplicateOf, requiresConfirmation: true as const,
  };
}

export async function manualEntryCommitFor(userKey: string, input: { previewId: string; idempotencyKey: string }, now = new Date()) {
  const repo = getLedgerRepository();
  const fingerprint = createHash("sha256").update(`${userKey}|manual|${input.idempotencyKey}`).digest("hex");
  const existing = (await repo.listTransactions(userKey)).find(t => t.fingerprint === fingerprint);
  if (existing) {
    return { implementation: "implemented" as const, batchId: existing.batchId, transactionId: existing.id, duplicateSubmission: true, source: "manual" as const };
  }
  const p = previews.get(input.previewId);
  if (!p || p.userKey !== userKey || p.expiresAt <= Date.now()) {
    throw new InariError("PREVIEW_EXPIRED", "This preview has expired or does not exist. Preview the entry again.");
  }
  const e = p.entry;
  if (e.amountPaise === null || e.direction === null || e.category === null) throw new InariError("INVALID_INPUT", "The entry is incomplete.");
  const batchId = `batch_${randomUUID()}`;
  const tx: LedgerTransaction = {
    id: `txn_${fingerprint.slice(0, 24)}`, fingerprint, batchId, source: "manual", postedOn: e.postedOn,
    amountPaise: e.amountPaise, amount: e.amountPaise / 100, direction: e.direction, merchant: null, narration: e.narration,
    instrument: e.paymentType === "cash" ? "cash" : e.paymentType === "upi" ? "upi" : e.paymentType === "card" ? "card" : "other",
    accountLabel: null, category: e.category, categorySource: "user", categoryConfidence: 1, correctedFrom: null,
    isTransfer: e.category === "transfer", isRecurring: false, possibleDuplicateOf: null, balanceAfterPaise: null,
  };
  const batch: StoredBatch = {
    batchId, source: "manual", filename: null, importedAt: now.toISOString(),
    counts: { total: 1, accepted: 1, duplicate: 0, possibleDuplicate: 0, rejected: 0, ignored: 0 },
    period: { from: e.postedOn, to: e.postedOn }, status: "committed",
  };
  await repo.commitBatch(userKey, batch, [tx]);
  previews.delete(input.previewId);
  return { implementation: "implemented" as const, batchId, transactionId: tx.id, duplicateSubmission: false, source: "manual" as const };
}

export async function dataCoverageFor(userKey: string, now = new Date()) {
  const tx = await getLedgerRepository().listTransactions(userKey);
  const bySource: Record<string, number> = {};
  const byMonth = new Map<string, { count: number; manual: number }>();
  for (const t of tx) {
    bySource[t.source] = (bySource[t.source] ?? 0) + 1;
    const m = byMonth.get(t.postedOn.slice(0, 7)) ?? { count: 0, manual: 0 };
    m.count++;
    if (t.source === "manual") m.manual++;
    byMonth.set(t.postedOn.slice(0, 7), m);
  }
  const dates = tx.map(t => t.postedOn).sort();
  const from = dates[0] ?? null;
  const to = dates[dates.length - 1] ?? null;
  const gaps: Array<{ kind: "month_without_transactions" | "quiet_period" | "no_manual_entries"; from: string | null; to: string | null; detail: string }> = [];
  const months: Array<{ month: string; count: number; manualCount: number }> = [];
  if (from && to) {
    let y = Number(from.slice(0, 4)), mo = Number(from.slice(5, 7));
    const endKey = to.slice(0, 7);
    for (;;) {
      const key = `${y}-${String(mo).padStart(2, "0")}`;
      const m = byMonth.get(key);
      months.push({ month: key, count: m?.count ?? 0, manualCount: m?.manual ?? 0 });
      if (!m) gaps.push({ kind: "month_without_transactions", from: `${key}-01`, to: `${key}-28`, detail: `No transactions were imported for ${key}. If you had activity that month, it has not been observed.` });
      if (key >= endKey) break;
      mo++;
      if (mo > 12) { mo = 1; y++; }
    }
    for (let i = 1; i < dates.length; i++) {
      const days = (Date.parse(dates[i]) - Date.parse(dates[i - 1])) / 86_400_000;
      if (days >= 10) gaps.push({ kind: "quiet_period", from: dates[i - 1], to: dates[i], detail: `No transactions for ${days} days between these dates. That may be real, or part of a statement may be missing.` });
    }
    if (!bySource.manual) gaps.push({ kind: "no_manual_entries", from: null, to: null, detail: "No cash or other off-statement spending has been added. Statements do not show cash you spent, so those amounts are not observed." });
  }
  return {
    implementation: "implemented" as const,
    observed: { transactionCount: tx.length, from, to, bySource },
    months,
    gaps: gaps.slice(0, 50),
    note: `Gaps list what has not been observed as of ${isoDate(now)}. INARI does not estimate or invent missing transactions.`,
  };
}
