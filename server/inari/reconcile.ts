/**
 * Reconciliation exceptions and assumptions ("Financial Evidence Lens" inputs), expressed as snapshot dataQuality notes.
 *
 * Rule: this module only OBSERVES. It never changes a transaction, a category or a total. Anything uncertain
 * (possible transfer pairs, card repayments, refund-like credits booked as income) is surfaced with the exact
 * transaction ids and left for the user to resolve via correctCategory.
 */
import type { LedgerTransaction, Snapshot } from "../../shared/inari/contracts";
import { CARD_REPAYMENT } from "./categorize";
const INCOME_CATEGORIES: ReadonlySet<string> = new Set(["salary", "other_income"]); // mirrors snapshot.ts (avoids an import cycle)

type Note = Snapshot["dataQuality"][number];

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const REFUND_WORDS = /\b(refund|reversal|reversed|cancelled|canceled|chargeback|returned)\b/i;
const dayNum = (iso: string) => Math.floor(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86_400_000);
const ids = (txs: LedgerTransaction[]) => txs.slice(0, 50).map(t => t.id);

export const TRANSFER_PAIR_WINDOW_DAYS = 3;

export function reconciliationNotes(transactions: LedgerTransaction[]): Note[] {
  const notes: Note[] = [];

  // 1. Credit-card repayments: counted as expenses (card spend is invisible to us), flagged, never auto-netted.
  const repayments = transactions.filter(t => t.direction === "debit" && !t.isTransfer && CARD_REPAYMENT.test(t.narration));
  if (repayments.length > 0) {
    const total = repayments.reduce((s, t) => s + t.amountPaise, 0);
    notes.push({
      code: "card_repayment_counted",
      severity: "warning",
      message: `${repayments.length} credit-card repayment(s) totalling ${rupees(total)} are counted as expenses because the card's own spending is not imported. If you import the card statement, count one side only. Recategorise as Transfer to exclude them.`,
      transactionIds: ids(repayments),
    });
  }

  // 2. Own-account transfers: excluded from income/expenses. Shown so the exclusion is visible.
  const transfers = transactions.filter(t => t.isTransfer || t.category === "transfer");
  if (transfers.length > 0) {
    const total = transfers.reduce((s, t) => s + t.amountPaise, 0);
    notes.push({
      code: "transfers_excluded",
      severity: "info",
      message: `${transfers.length} transfer(s) totalling ${rupees(total)} are excluded from income and expenses.`,
      transactionIds: ids(transfers),
    });
  }

  // 3. Refund-like credits that ended up as income: they inflate income and leave the original expense in place.
  const refundAsIncome = transactions.filter(t => t.direction === "credit" && INCOME_CATEGORIES.has(t.category) && t.category !== "salary" && REFUND_WORDS.test(t.narration));
  if (refundAsIncome.length > 0) {
    notes.push({
      code: "refund_counted_as_income",
      severity: "warning",
      message: `${refundAsIncome.length} credit(s) look like refunds but are counted as income (${rupees(refundAsIncome.reduce((s, t) => s + t.amountPaise, 0))}). Recategorise each to the original spending category so it reduces that expense instead.`,
      transactionIds: ids(refundAsIncome),
    });
  }
  const refundsNetted = transactions.filter(t => t.direction === "credit" && !INCOME_CATEGORIES.has(t.category) && !t.isTransfer && t.category !== "investment" && t.category !== "savings" && REFUND_WORDS.test(t.narration));
  if (refundsNetted.length > 0) {
    notes.push({
      code: "refunds_netted",
      severity: "info",
      message: `${refundsNetted.length} refund(s) totalling ${rupees(refundsNetted.reduce((s, t) => s + t.amountPaise, 0))} reduce spending in their category.`,
      transactionIds: ids(refundsNetted),
    });
  }

  // 4. Possible transfer pairs: equal debit/credit within a few days that nobody has marked as a transfer.
  const credits = transactions.filter(t => t.direction === "credit" && !t.isTransfer && t.category !== "salary");
  const debits = transactions.filter(t => t.direction === "debit" && !t.isTransfer);
  const used = new Set<string>();
  const pairs: LedgerTransaction[] = [];
  for (const c of credits) {
    const d = debits.find(
      x => !used.has(x.id) && x.amountPaise === c.amountPaise && Math.abs(dayNum(x.postedOn) - dayNum(c.postedOn)) <= TRANSFER_PAIR_WINDOW_DAYS && x.category !== "rent" && x.category !== "emi"
    );
    if (d) {
      used.add(d.id);
      pairs.push(d, c);
    }
  }
  if (pairs.length > 0) {
    notes.push({
      code: "possible_transfer_pair",
      severity: "warning",
      message: `${pairs.length / 2} debit/credit pair(s) have the same amount within ${TRANSFER_PAIR_WINDOW_DAYS} days and may be a transfer. They are counted as-is; mark both as Transfer if they are.`,
      transactionIds: ids(pairs),
    });
  }
  return notes;
}

/** Plain-language statement of how the headline numbers were produced. */
export function assumptionNotes(monthsUsed: string[], monthsExcluded: string[]): Note[] {
  if (monthsUsed.length === 0) return [];
  return [
    {
      code: "assumption_averaging",
      severity: "info",
      message: `Averages use ${monthsUsed.length} complete month(s): ${monthsUsed.join(", ")}.${monthsExcluded.length ? ` Excluded as incomplete: ${monthsExcluded.join(", ")}.` : ""}`,
    },
    {
      code: "assumption_definitions",
      severity: "info",
      message: "Income = salary and other income credits. Expenses = spending in expense categories minus refunds. Investments, savings and transfers are not expenses, so they count toward surplus.",
    },
  ];
}
