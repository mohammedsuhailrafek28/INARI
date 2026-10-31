/**
 * Refund Watch and reimbursement tracking.
 *
 * A claim is a statement by the user that money is owed to them for an existing debit. Rules:
 *  - A claim never creates, changes or removes a ledger transaction, and expected money is never counted as cash.
 *  - A claim becomes "received" only through an explicit confirmation that links it to a real credit in the ledger.
 *  - One credit can be allocated across claims, but never beyond its own amount (integer paise throughout).
 *  - Every confirmation can be undone; a claim can be cancelled, which releases its allocations.
 *  - Refunds and reimbursements are separate kinds and are summarised separately.
 */
import { randomUUID } from "node:crypto";
import type { Claim, ClaimsOutput, CreateClaimInput } from "../../shared/inari/contracts";
import { InariError } from "./errors";
import { settledByClaimsPaise } from "./snapshot";
import { getLedgerRepository } from "./ledger";
import type { StoredClaim, StoredProfile } from "./ledger/types";
import type { LedgerTransaction } from "../../shared/inari/contracts";

export const MAX_CLAIMS = 100;
const toPaise = (rupees: number) => Math.round(rupees * 100);
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const isActive = (c: StoredClaim) => !c.cancelled;
const receivedOf = (c: StoredClaim) => c.settlements.reduce((s, x) => s + x.amountPaise, 0);

async function load(userKey: string) {
  const repo = getLedgerRepository();
  const profile = await repo.getProfile(userKey);
  return { repo, profile, claims: profile?.claims ?? [] };
}
async function save(userKey: string, profile: StoredProfile | null, claims: StoredClaim[]) {
  await getLedgerRepository().setProfile(userKey, { emergencyFund: null, investments: null, creditCardDebt: null, useDemo: false, ...profile, claims });
}

/** Amount of this credit already promised to active claims (optionally ignoring one claim). */
function allocated(claims: StoredClaim[], creditId: string, exceptClaimId?: string) {
  return claims
    .filter(c => isActive(c) && c.id !== exceptClaimId)
    .reduce((sum, c) => sum + c.settlements.filter(s => s.creditTransactionId === creditId).reduce((a, s) => a + s.amountPaise, 0), 0);
}

function describe(c: StoredClaim, original: LedgerTransaction | null, today: string): Claim {
  const received = receivedOf(c);
  const outstanding = c.cancelled ? 0 : Math.max(0, c.expectedAmountPaise - received);
  let status: Claim["status"];
  if (c.cancelled) status = "cancelled";
  else if (received >= c.expectedAmountPaise) status = "received";
  else if (c.expectedDate && today > c.expectedDate) status = "overdue";
  else if (received > 0) status = "partially_received";
  else status = "pending";
  return {
    id: c.id, kind: c.kind, transactionId: c.transactionId,
    original: original ? { postedOn: original.postedOn, amountPaise: original.amountPaise, narration: original.narration, merchant: original.merchant } : null,
    counterparty: c.counterparty, expectedAmountPaise: c.expectedAmountPaise, receivedAmountPaise: received, outstandingAmountPaise: outstanding,
    personalSharePaise: c.kind === "reimbursement" && original ? original.amountPaise - c.expectedAmountPaise : null,
    expectedDate: c.expectedDate, status, settlements: c.settlements, note: c.note, createdAt: c.createdAt,
  };
}

export async function createClaimFor(userKey: string, input: CreateClaimInput, now = new Date()): Promise<string> {
  const { repo, profile, claims } = await load(userKey);
  const tx = await repo.getTransaction(userKey, input.transactionId);
  if (!tx) throw new InariError("NOT_FOUND", "That transaction was not found.");
  if (tx.direction !== "debit") throw new InariError("INVALID_INPUT", "A claim must be linked to a payment you made (a debit).");
  if (claims.filter(isActive).length >= MAX_CLAIMS) throw new InariError("CONFLICT", `You can keep up to ${MAX_CLAIMS} open claims.`);
  const expected = toPaise(input.expectedAmount);
  const already = claims.filter(c => isActive(c) && c.kind === input.kind && c.transactionId === tx.id).reduce((s, c) => s + c.expectedAmountPaise, 0);
  if (expected + already > tx.amountPaise) {
    throw new InariError("INVALID_INPUT", `${input.kind === "refund" ? "Refunds" : "Reimbursements"} for this payment cannot add up to more than the payment itself.`);
  }
  if (input.expectedDate !== undefined && input.expectedDate < tx.postedOn) {
    throw new InariError("INVALID_INPUT", "The expected date cannot be before the original payment.");
  }
  const claim: StoredClaim = {
    id: `claim_${randomUUID()}`, kind: input.kind, transactionId: tx.id, counterparty: input.counterparty?.trim() || null,
    expectedAmountPaise: expected, expectedDate: input.expectedDate ?? null, note: input.note?.trim() || null,
    createdAt: now.toISOString(), settlements: [],
  };
  await save(userKey, profile, [...claims, claim]);
  return claim.id;
}

export async function listClaimsFor(userKey: string, kind?: Claim["kind"], now = new Date()): Promise<ClaimsOutput> {
  const { repo, claims } = await load(userKey);
  const today = isoDate(now);
  const txs = new Map((await repo.listTransactions(userKey)).map(t => [t.id, t] as const));
  const items = claims.filter(c => !kind || c.kind === kind).map(c => describe(c, txs.get(c.transactionId) ?? null, today));
  const open = items.filter(c => c.status !== "cancelled");
  const refunds = open.filter(c => c.kind === "refund");
  const reimb = open.filter(c => c.kind === "reimbursement");
  return {
    implementation: "implemented",
    items,
    summary: {
      pendingRefundPaise: refunds.reduce((s, c) => s + c.outstandingAmountPaise, 0),
      overdueRefundCount: refunds.filter(c => c.status === "overdue").length,
      outstandingReimbursementPaise: reimb.reduce((s, c) => s + c.outstandingAmountPaise, 0),
      grossReimbursableSpendPaise: reimb.reduce((s, c) => s + (c.original?.amountPaise ?? 0), 0),
      personalShareOfReimbursablePaise: reimb.reduce((s, c) => s + (c.personalSharePaise ?? 0), 0),
      confirmedRefundSettlementsPaise: settledByClaimsPaise(claims).refund,
      confirmedReimbursementSettlementsPaise: settledByClaimsPaise(claims).reimbursement,
    },
    notes: [
      "Expected refunds and reimbursements are not cash: they are counted as received only after you confirm a matching credit.",
      "Once you confirm a settlement, monthly totals net it against the payment it repays (it is not counted as income). Your transaction list still shows every payment and credit at full value, which is your gross cash flow.",
    ],
  };
}

const tokens = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(w => w.length >= 3);

export async function claimMatchesFor(userKey: string, claimId: string, now = new Date()) {
  const { repo, claims } = await load(userKey);
  const claim = claims.find(c => c.id === claimId);
  if (!claim) throw new InariError("NOT_FOUND", "Claim not found.");
  const original = await repo.getTransaction(userKey, claim.transactionId);
  const outstanding = Math.max(0, claim.expectedAmountPaise - receivedOf(claim));
  const hint = tokens(claim.kind === "refund" ? (original?.merchant ?? original?.narration ?? "") : (claim.counterparty ?? ""));
  const suggestions = [];
  if (outstanding > 0 && !claim.cancelled) {
    for (const t of await repo.listTransactions(userKey)) {
      if (t.direction !== "credit" || (original && t.postedOn < original.postedOn)) continue;
      if (claim.settlements.some(s => s.creditTransactionId === t.id)) continue;
      const available = t.amountPaise - allocated(claims, t.id);
      if (available <= 0) continue;
      const reasons: string[] = [];
      let score = 0;
      if (available === outstanding) { score += 0.5; reasons.push("amount equals what is still expected"); }
      else if (available < outstanding) { score += 0.15; reasons.push("smaller than what is expected (partial settlement)"); }
      else { score += 0.1; reasons.push("larger than what is expected"); }
      const words = new Set(tokens(t.narration));
      if (hint.some(w => words.has(w))) { score += 0.35; reasons.push(claim.kind === "refund" ? "narration mentions the merchant" : "narration mentions the person"); }
      if (/refund|reversal|rev\b|return|cashback/i.test(t.narration) && claim.kind === "refund") { score += 0.15; reasons.push("narration looks like a refund"); }
      const days = (Date.parse(t.postedOn) - Date.parse(original?.postedOn ?? t.postedOn)) / 86_400_000;
      if (days >= 0 && days <= 30) { score += 0.1; reasons.push("arrived within 30 days of the payment"); }
      if (score < 0.3 && available !== outstanding) continue;
      suggestions.push({
        creditTransactionId: t.id, postedOn: t.postedOn, amountPaise: t.amountPaise, availablePaise: available, narration: t.narration,
        score: Math.round(score * 100) / 100, reasons, requiresConfirmation: true as const, ambiguous: false,
      });
    }
  }
  suggestions.sort((a, b) => b.score - a.score || a.postedOn.localeCompare(b.postedOn) || a.creditTransactionId.localeCompare(b.creditTransactionId));
  const top = suggestions.slice(0, 5);
  for (const s of top) s.ambiguous = top.length > 1 && top[0].score - s.score < 0.1 || s.score < 0.6;
  return {
    implementation: "implemented" as const,
    claimId,
    suggestions: top,
    notes: ["These are suggestions only. Nothing is settled until you confirm a specific credit.", `Checked on ${isoDate(now)}.`],
  };
}

export async function confirmClaimMatchFor(userKey: string, input: { claimId: string; creditTransactionId: string; amount?: number }, now = new Date()) {
  const { repo, profile, claims } = await load(userKey);
  const claim = claims.find(c => c.id === input.claimId);
  if (!claim || claim.cancelled) throw new InariError("NOT_FOUND", "Claim not found.");
  const credit = await repo.getTransaction(userKey, input.creditTransactionId);
  if (!credit || credit.direction !== "credit") throw new InariError("NOT_FOUND", "That credit was not found.");
  if (claim.settlements.some(s => s.creditTransactionId === credit.id)) throw new InariError("CONFLICT", "This credit is already linked to this claim.");
  const original = await repo.getTransaction(userKey, claim.transactionId);
  if (original && credit.postedOn < original.postedOn) throw new InariError("INVALID_INPUT", "A credit cannot settle a payment made after it arrived.");
  const outstanding = claim.expectedAmountPaise - receivedOf(claim);
  const available = credit.amountPaise - allocated(claims, credit.id);
  if (outstanding <= 0) throw new InariError("CONFLICT", "This claim is already fully received.");
  if (available <= 0) throw new InariError("CONFLICT", "This credit is already fully allocated to other claims.");
  const amount = input.amount === undefined ? Math.min(outstanding, available) : toPaise(input.amount);
  if (amount > available) throw new InariError("CONFLICT", "That is more than what is left of this credit.");
  if (amount > outstanding) throw new InariError("INVALID_INPUT", "That is more than this claim is still expecting.");
  const next = claims.map(c => (c.id === claim.id ? { ...c, settlements: [...c.settlements, { creditTransactionId: credit.id, amountPaise: amount, confirmedAt: now.toISOString() }] } : c));
  await save(userKey, profile, next);
}

export async function undoClaimMatchFor(userKey: string, input: { claimId: string; creditTransactionId: string }) {
  const { profile, claims } = await load(userKey);
  const claim = claims.find(c => c.id === input.claimId);
  if (!claim || !claim.settlements.some(s => s.creditTransactionId === input.creditTransactionId)) throw new InariError("NOT_FOUND", "That link was not found.");
  await save(userKey, profile, claims.map(c => (c.id === claim.id ? { ...c, settlements: c.settlements.filter(s => s.creditTransactionId !== input.creditTransactionId) } : c)));
}

export async function cancelClaimFor(userKey: string, claimId: string) {
  const { profile, claims } = await load(userKey);
  if (!claims.some(c => c.id === claimId)) throw new InariError("NOT_FOUND", "Claim not found.");
  await save(userKey, profile, claims.map(c => (c.id === claimId ? { ...c, cancelled: true } : c)));
}
