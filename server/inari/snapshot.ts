/**
 * Financial snapshot derived from the ledger. All sums are integer paise.
 *
 * Month policy (never treat a partial period as a full month):
 *  - Coverage = union of committed batches' periods (adjacent/overlapping periods merge).
 *  - A calendar month is COMPLETE when one merged coverage interval reaches within EDGE_TOLERANCE_DAYS of both
 *    the first and last day of that month AND the month has at least one transaction.
 *  - Income/expenses are averaged over the most recent <= 3 complete months. With no complete month they are null.
 * Classification:
 *  - Income = credits categorised salary/other_income (transfers excluded).
 *  - Expenses = debits in expense-kind categories, minus credits in expense-kind categories (refunds).
 *    Investments, savings and transfers are neutral: not expenses, so they count toward surplus.
 *  - Balances (emergency fund, investments, card debt) are never inferred; they come from the user or stay null.
 */
import type { Category, LedgerTransaction, Snapshot } from "../../shared/inari/contracts";
import type { StoredClaim, StoredBatch, StoredProfile } from "./ledger/types";
import { assumptionNotes, reconciliationNotes } from "./reconcile";

export const EDGE_TOLERANCE_DAYS = 5;
export const MAX_AVERAGING_MONTHS = 3;

export const NEUTRAL_CATEGORIES: ReadonlySet<Category> = new Set<Category>(["investment", "savings", "transfer"]);
export const INCOME_CATEGORIES: ReadonlySet<Category> = new Set<Category>(["salary", "other_income"]);

const dayNum = (iso: string) => Math.floor(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86_400_000);
const monthStart = (ym: string) => dayNum(`${ym}-01`);
const monthEnd = (ym: string) => {
  const y = +ym.slice(0, 4);
  const m = +ym.slice(5, 7);
  return dayNum(`${ym}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`);
};
const toYm = (iso: string) => iso.slice(0, 7);

/** True when the user explicitly excluded this row from totals (the row itself stays in the ledger as evidence). */
export const isExcluded = (t: LedgerTransaction) => t.reconciliation?.decision === "excluded_duplicate" || t.reconciliation?.decision === "excluded_card_double_count";

export type MonthTotals = {
  month: string;
  complete: boolean;
  incomePaise: number;
  expensePaise: number;
  transactionCount: number;
  byCategory: Map<Category, { debitPaise: number; creditPaise: number; count: number }>;
};

export function mergeCoverage(batches: Array<Pick<StoredBatch, "period" | "status">>): Array<{ from: number; to: number }> {
  const spans = batches
    .filter(b => b.status === "committed" && b.period)
    .map(b => ({ from: dayNum(b.period!.from), to: dayNum(b.period!.to) }))
    .sort((a, b) => a.from - b.from);
  const merged: Array<{ from: number; to: number }> = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s.from <= last.to + 1) last.to = Math.max(last.to, s.to);
    else merged.push({ ...s });
  }
  return merged;
}

export function isExpenseCategory(category: Category) {
  return !NEUTRAL_CATEGORIES.has(category) && !INCOME_CATEGORIES.has(category);
}


/**
 * Accounting for confirmed refund / reimbursement settlements (a user-confirmed link between a credit and a claim).
 *  - The ledger row is never changed; this only decides how the credit counts in monthly totals.
 *  - The settled part of a credit is treated as a REDUCTION of the linked payment's expense (same as a refund netted
 *    in the month it arrives), not as income. The part of the credit that is not allocated keeps its own category.
 *  - Gross cash movement is untouched (listTransactions still shows every row at full value).
 *  - Expected, unconfirmed and cancelled claims have no effect.
 * Returns the rows to total. `counted` is false for extra pieces so row counts stay those of the ledger.
 */
export type AccountingRow = { t: LedgerTransaction; counted: boolean };
export function accountingRows(transactions: LedgerTransaction[], claims?: StoredClaim[] | null): AccountingRow[] {
  const active = (claims ?? []).filter(c => !c.cancelled && c.settlements.length > 0);
  if (active.length === 0) return transactions.map(t => ({ t, counted: true }));
  const byId = new Map(transactions.map(t => [t.id, t] as const));
  const pieces = new Map<string, Array<{ amountPaise: number; debit: LedgerTransaction }>>();
  for (const c of active) {
    const debit = byId.get(c.transactionId);
    if (!debit) continue; // linked payment excluded or gone: nothing to offset
    for (const s of c.settlements) {
      if (!byId.has(s.creditTransactionId)) continue;
      pieces.set(s.creditTransactionId, [...(pieces.get(s.creditTransactionId) ?? []), { amountPaise: s.amountPaise, debit }]);
    }
  }
  const out: AccountingRow[] = [];
  for (const t of transactions) {
    const ps = pieces.get(t.id);
    if (!ps || t.direction !== "credit") { out.push({ t, counted: true }); continue; }
    let rest = t.amountPaise;
    let first = true;
    ps.forEach((p, i) => {
      const a = Math.min(p.amountPaise, rest);
      if (a <= 0) return;
      rest -= a;
      out.push({
        t: { ...t, id: `${t.id}~settled${i}`, amountPaise: a, amount: a / 100, category: p.debit.category, isTransfer: p.debit.isTransfer },
        counted: first,
      });
      first = false;
    });
    if (rest > 0) out.push({ t: { ...t, amountPaise: rest, amount: rest / 100 }, counted: first });
  }
  return out;
}

export function settledByClaimsPaise(claims?: StoredClaim[] | null): { refund: number; reimbursement: number } {
  const sum = { refund: 0, reimbursement: 0 };
  for (const c of claims ?? []) if (!c.cancelled) sum[c.kind] += c.settlements.reduce((a, s) => a + s.amountPaise, 0);
  return sum;
}

export function computeMonthTotals(transactions: LedgerTransaction[], batches: StoredBatch[], claims?: StoredClaim[] | null): MonthTotals[] {
  const coverage = mergeCoverage(batches);
  const months = new Map<string, MonthTotals>();
  for (const { t, counted } of accountingRows(transactions, claims)) {
    if (isExcluded(t)) continue;
    const ym = toYm(t.postedOn);
    let m = months.get(ym);
    if (!m) {
      m = { month: ym, complete: false, incomePaise: 0, expensePaise: 0, transactionCount: 0, byCategory: new Map() };
      months.set(ym, m);
    }
    if (counted) m.transactionCount++;
    const cat = m.byCategory.get(t.category) ?? { debitPaise: 0, creditPaise: 0, count: 0 };
    if (counted) cat.count++;
    if (t.direction === "debit") cat.debitPaise += t.amountPaise;
    else cat.creditPaise += t.amountPaise;
    m.byCategory.set(t.category, cat);

    if (t.isTransfer || t.category === "transfer") continue;
    if (INCOME_CATEGORIES.has(t.category)) {
      if (t.direction === "credit") m.incomePaise += t.amountPaise;
      else m.expensePaise += t.amountPaise; // debit tagged as income category: treat as an expense, conservative
    } else if (isExpenseCategory(t.category)) {
      m.expensePaise += t.direction === "debit" ? t.amountPaise : -t.amountPaise;
    }
  }
  for (const m of Array.from(months.values())) {
    const start = monthStart(m.month);
    const end = monthEnd(m.month);
    m.complete = coverage.some(c => c.from <= start + EDGE_TOLERANCE_DAYS && c.to >= end - EDGE_TOLERANCE_DAYS) && m.transactionCount > 0;
    if (m.expensePaise < 0) m.expensePaise = 0;
  }
  return Array.from(months.values()).sort((a, b) => a.month.localeCompare(b.month));
}

const rupees = (paise: number) => Math.round(paise) / 100;
const avgPaise = (sum: number, n: number) => Math.round(sum / n);

export function deriveFinancialSnapshot(args: {
  transactions: LedgerTransaction[];
  batches: StoredBatch[];
  profile: StoredProfile | null;
}): Snapshot {
  const { batches, profile } = args;
  const excludedRows = args.transactions.filter(isExcluded);
  const transactions = args.transactions.filter(t => !isExcluded(t));
  const dates = transactions.map(t => t.postedOn).sort();
  const firstDate = dates[0] ?? null;
  const lastDate = dates[dates.length - 1] ?? null;

  const months = computeMonthTotals(transactions, batches, profile?.claims);
  const complete = months.filter(m => m.complete);
  const used = complete.slice(-MAX_AVERAGING_MONTHS);

  const dataQuality: Snapshot["dataQuality"] = [];
  const missing: string[] = [];

  let monthlyIncome: number | null = null;
  let monthlyExpenses: number | null = null;
  let monthlySurplus: number | null = null;
  let savingsRate: number | null = null;
  let incomeProv: Snapshot["provenance"]["income"] = "missing";

  if (used.length > 0) {
    const income = avgPaise(used.reduce((s, m) => s + m.incomePaise, 0), used.length);
    const expense = avgPaise(used.reduce((s, m) => s + m.expensePaise, 0), used.length);
    monthlyIncome = rupees(income);
    monthlyExpenses = rupees(expense);
    monthlySurplus = rupees(income - expense);
    savingsRate = income > 0 ? Math.round(((income - expense) / income) * 10_000) / 100 : null;
    incomeProv = used.length >= 2 ? "observed" : "estimated";
    if (used.length < MAX_AVERAGING_MONTHS) {
      dataQuality.push({
        code: "few_months",
        severity: "info",
        message: `Based on ${used.length} complete month${used.length === 1 ? "" : "s"}; more history makes averages more reliable.`,
      });
    }
    if (income === 0) dataQuality.push({ code: "no_income_found", severity: "warning", message: "No income was found in the complete months, so the savings rate is unknown." });
  } else {
    missing.push("monthlyIncome", "monthlyExpenses", "monthlySurplus", "savingsRate");
    dataQuality.push({
      code: "no_complete_month",
      severity: "warning",
      message:
        transactions.length === 0
          ? "No transactions imported yet."
          : "No full calendar month is covered yet, so monthly figures are not computed from a partial period. Import a statement covering a whole month.",
    });
  }

  const partial = months.filter(m => !m.complete);
  if (partial.length > 0 && transactions.length > 0) {
    dataQuality.push({
      code: "partial_months",
      severity: "info",
      message: `Months not fully covered and excluded from averages: ${partial.map(m => m.month).join(", ")}.`,
    });
  }
  const interiorGaps = findEmptyInteriorMonths(months);
  if (interiorGaps.length > 0) {
    dataQuality.push({ code: "gap_months", severity: "warning", message: `No transactions in: ${interiorGaps.join(", ")}.` });
  }
  const settled = settledByClaimsPaise(profile?.claims);
  if (settled.refund + settled.reimbursement > 0) {
    const r = (p: number) => `₹${(p / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
    dataQuality.push({
      code: "claims_netted",
      severity: "info",
      message: `Confirmed settlements are netted against the payments they repay, not counted as income: refunds ${r(settled.refund)}, reimbursements ${r(settled.reimbursement)}. Your transaction list still shows every row at full value.`,
    });
  }
  const dups = transactions.filter(t => t.possibleDuplicateOf && !t.reconciliation);
  if (dups.length > 0) {
    dataQuality.push({
      code: "possible_duplicates",
      severity: "warning",
      message: `${dups.length} transaction(s) have the same date, amount and direction as another one and may be double-counted. They ARE included in the totals until you delete the extra import or confirm they are separate payments.`,
      transactionIds: dups.slice(0, 50).map(t => t.id),
    });
  }
  const unclassified = transactions.filter(t => t.categorySource === "unclassified");
  if (unclassified.length > 0) {
    dataQuality.push({
      code: "unclassified",
      severity: "info",
      message: `${unclassified.length} transaction(s) could not be categorised automatically.`,
      transactionIds: unclassified.slice(0, 50).map(t => t.id),
    });
  }
  if (excludedRows.length > 0) {
    dataQuality.push({
      code: "reconciliation_applied",
      severity: "info",
      message: `${excludedRows.length} transaction(s) were excluded from totals by your decision. They remain in your ledger as evidence and can be restored.`,
      transactionIds: excludedRows.slice(0, 50).map(t => t.id),
    });
  }
  dataQuality.push(...reconciliationNotes(transactions));
  dataQuality.push(...assumptionNotes(used.map(m => m.month), partial.map(m => m.month)));

  const bal = (v: number | null | undefined): [number | null, Snapshot["provenance"]["emergencyFund"]] =>
    v === null || v === undefined ? [null, "missing"] : [v, "user_input"];
  const [emergencyFund, efProv] = bal(profile?.emergencyFund);
  const [investments, invProv] = bal(profile?.investments);
  const [creditCardDebt, ccProv] = bal(profile?.creditCardDebt);
  if (emergencyFund === null) missing.push("emergencyFund");
  if (investments === null) missing.push("investments");
  if (creditCardDebt === null) missing.push("creditCardDebt");

  const spanDays = firstDate && lastDate ? dayNum(lastDate) - dayNum(firstDate) + 1 : 0;
  return {
    implementation: "implemented",
    dataSource: "imported",
    dataAsOf: lastDate,
    coverage: {
      monthsCovered: Math.round((spanDays / 30.4375) * 10) / 10,
      completeMonths: complete.length,
      firstDate,
      lastDate,
      transactionCount: transactions.length,
    },
    monthlyIncome,
    monthlyExpenses,
    monthlySurplus,
    savingsRate,
    balances: { emergencyFund, investments, creditCardDebt },
    provenance: {
      income: incomeProv,
      expenses: incomeProv,
      savingsRate: savingsRate === null ? "missing" : incomeProv,
      emergencyFund: efProv,
      investments: invProv,
      creditCardDebt: ccProv,
    },
    missing,
    dataQuality,
  };
}

function findEmptyInteriorMonths(months: MonthTotals[]): string[] {
  if (months.length < 2) return [];
  const have = new Set(months.map(m => m.month));
  const out: string[] = [];
  let [y, m] = months[0].month.split("-").map(Number);
  const last = months[months.length - 1].month;
  for (let guard = 0; guard < 600; guard++) {
    const ym = `${y}-${String(m).padStart(2, "0")}`;
    if (ym >= last) break;
    if (!have.has(ym)) out.push(ym);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

/** Empty snapshot for a user with no imported data. Every figure is unknown. */
export function emptySnapshot(dataSource: "imported" | "demo", profile: StoredProfile | null): Snapshot {
  return { ...deriveFinancialSnapshot({ transactions: [], batches: [], profile }), dataSource };
}
