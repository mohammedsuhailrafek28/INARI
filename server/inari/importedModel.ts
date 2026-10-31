/**
 * Adapts the ledger-derived snapshot to the shapes the existing WealthVerse engines consume.
 * Only used when the owner has imported data (and has not asked for demo data). Persona values never appear here:
 * balances the user has not supplied are flagged unknown via `metrics.known`.
 */
import type { FinancialMetrics, Recommendation } from "../financialEngine";
import { calculateHealthScore } from "../financialEngine";
import type { WealthContextDraft, WealthOpportunity, WealthTransaction } from "../wealth/types";
import type { LedgerTransaction, Snapshot } from "../../shared/inari/contracts";
import { getLedgerRepository } from "./ledger";
import type { StoredBatch, StoredProfile } from "./ledger/types";
import { computeMonthTotals, deriveFinancialSnapshot, isExcluded, isExpenseCategory, MAX_AVERAGING_MONTHS, type MonthTotals } from "./snapshot";
import { isImportedMode } from "./service";

export type ImportedModel = {
  transactions: LedgerTransaction[];
  months: MonthTotals[];
  snapshot: Snapshot;
  profile: StoredProfile | null;
  /** null while no complete month exists */
  metrics: FinancialMetrics | null;
  /** average per category over the averaged months (rupees); falls back to the latest month with data when none is complete */
  spendingBreakdown: Record<string, number>;
  breakdownMonths: string[];
  recentTransactions: WealthTransaction[];
  unusualExpenses: WealthTransaction[];
  opportunities: WealthOpportunity[];
  unknownFields: string[];
};

const toWealthTx = (t: LedgerTransaction): WealthTransaction => ({
  date: new Date(`${t.postedOn}T00:00:00.000Z`),
  category: t.category,
  amount: t.amountPaise / 100,
  type: t.category === "investment" || t.category === "savings" ? "investment" : t.direction === "credit" ? "income" : "expense",
  description: t.narration,
});

export async function loadImportedModel(ownerKey: string): Promise<ImportedModel | undefined> {
  if (!(await isImportedMode(ownerKey))) return undefined;
  const repo = getLedgerRepository();
  const [transactions, batches, profile] = await Promise.all([repo.listTransactions(ownerKey), repo.listBatches(ownerKey), repo.getProfile(ownerKey)]);
  return buildImportedModel(transactions, batches, profile);
}

export function buildImportedModel(allTransactions: LedgerTransaction[], batches: StoredBatch[], profile: StoredProfile | null): ImportedModel {
  const snapshot = deriveFinancialSnapshot({ transactions: allTransactions, batches, profile });
  const transactions = allTransactions.filter(t => !isExcluded(t));
  const months = computeMonthTotals(transactions, batches);
  const used = months.filter(m => m.complete).slice(-MAX_AVERAGING_MONTHS);
  const basis = used.length > 0 ? used : months.slice(-1);

  const sums = new Map<string, number>();
  for (const m of basis) {
    for (const [category, v] of Array.from(m.byCategory.entries())) {
      if (!isExpenseCategory(category)) continue;
      sums.set(category, (sums.get(category) ?? 0) + (v.debitPaise - v.creditPaise));
    }
  }
  const spendingBreakdown: Record<string, number> = {};
  for (const [category, paise] of Array.from(sums.entries())) {
    if (paise > 0) spendingBreakdown[category] = Math.round(paise / Math.max(basis.length, 1)) / 100;
  }

  const basisMonths = new Set(basis.map(m => m.month));
  const expenseTx = transactions.filter(t => t.direction === "debit" && isExpenseCategory(t.category) && basisMonths.has(t.postedOn.slice(0, 7)));
  const amounts = expenseTx.map(t => t.amountPaise / 100);
  let unusual: LedgerTransaction[] = [];
  if (amounts.length >= 3) {
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const sd = Math.sqrt(amounts.reduce((s, n) => s + (n - avg) ** 2, 0) / amounts.length);
    unusual = expenseTx.filter(t => t.amountPaise / 100 > avg + 2 * sd).sort((a, b) => b.amountPaise - a.amountPaise).slice(0, 5);
  }

  const opportunities: WealthOpportunity[] = [];
  const addOpp = (category: string, pct: number, label: string) => {
    const base = spendingBreakdown[category];
    if (!base) return;
    const amount = Math.round(base * pct * 100) / 100;
    opportunities.push({ category, amount, suggestion: `${label} and save ₹${Math.round(amount)}` });
  };
  addOpp("subscription", 0.2, "Cancel unused subscriptions");
  addOpp("entertainment", 0.15, "Reduce entertainment spending");
  addOpp("dining", 0.1, "Optimize food-delivery and dining spending");
  opportunities.sort((a, b) => b.amount - a.amount);

  const known = {
    emergencyFund: snapshot.balances.emergencyFund !== null,
    investments: snapshot.balances.investments !== null,
    creditCardDebt: snapshot.balances.creditCardDebt !== null,
  };
  const metrics: FinancialMetrics | null =
    snapshot.monthlyIncome === null || snapshot.monthlyExpenses === null || snapshot.savingsRate === null
      ? null
      : {
          monthlyIncome: snapshot.monthlyIncome,
          monthlyExpenses: snapshot.monthlyExpenses,
          savingsRate: snapshot.savingsRate,
          emergencyFundBalance: snapshot.balances.emergencyFund ?? 0,
          investmentBalance: snapshot.balances.investments ?? 0,
          creditCardDebt: snapshot.balances.creditCardDebt ?? 0,
          riskProfile: profile?.riskPreference ?? "moderate",
          known,
        };

  return {
    transactions,
    months,
    snapshot,
    profile,
    metrics,
    spendingBreakdown,
    breakdownMonths: basis.map(m => m.month),
    recentTransactions: transactions.slice(0, 8).map(toWealthTx),
    unusualExpenses: unusual.map(toWealthTx),
    opportunities,
    unknownFields: [
      ...(known.emergencyFund ? [] : ["emergencyFund"]),
      ...(known.investments ? [] : ["investments"]),
      ...(known.creditCardDebt ? [] : ["creditCardDebt"]),
    ],
  };
}

/** Draft WealthContext for the engines, or null when income/expenses are not yet derivable. */
export function toWealthDraft(model: ImportedModel): WealthContextDraft | null {
  const { metrics, snapshot, profile } = model;
  if (!metrics) return null;
  return {
    activeProfile: { id: 0, name: "You", age: profile?.age ?? 0, occupation: "", riskProfile: metrics.riskProfile },
    monthlyIncome: metrics.monthlyIncome,
    monthlyExpenses: metrics.monthlyExpenses,
    monthlySurplus: snapshot.monthlySurplus ?? metrics.monthlyIncome - metrics.monthlyExpenses,
    savingsRate: metrics.savingsRate,
    financialHealthScore: calculateHealthScore(metrics),
    spendingBreakdown: model.spendingBreakdown,
    goals: [],
    recentTransactions: model.recentTransactions,
    unusualExpenses: model.unusualExpenses,
    opportunities: model.opportunities,
    metrics,
    dataSource: "imported",
    dataAsOf: snapshot.dataAsOf,
    unknownFields: model.unknownFields,
  };
}

/* ---------- shapes for the legacy dashboard routes (same keys; unknown values are null, never persona numbers) ---------- */

export function importedDashboardSummary(model: ImportedModel, recommendations: Recommendation[]) {
  const { snapshot, profile, metrics } = model;
  return {
    dataSource: "imported" as const,
    dataAsOf: snapshot.dataAsOf,
    unknownFields: model.unknownFields,
    dataQuality: snapshot.dataQuality,
    profile: { name: "You", age: profile?.age ?? null, occupation: null, riskProfile: profile?.riskPreference ?? "moderate" },
    financialHealth: metrics ? calculateHealthScore(metrics) : null,
    monthlyIncome: snapshot.monthlyIncome,
    monthlyExpenses: snapshot.monthlyExpenses,
    savingsRate: snapshot.savingsRate,
    investmentBalance: snapshot.balances.investments,
    emergencyFundBalance: snapshot.balances.emergencyFund,
    creditCardDebt: snapshot.balances.creditCardDebt,
    topRecommendations: recommendations.slice(0, 3),
    savingsStreak: 0,
    badges: [] as Array<{ badgeType: string; title: string; description: string }>,
  };
}

const stableNumericId = (fingerprint: string) => parseInt(fingerprint.slice(0, 8), 16);

export function importedRecentTransactions(model: ImportedModel, limit = 50) {
  return model.transactions.slice(0, limit).map(t => ({
    id: stableNumericId(t.fingerprint),
    date: new Date(`${t.postedOn}T00:00:00.000Z`),
    category: t.category,
    amount: t.amountPaise / 100,
    type: toWealthTx(t).type,
    description: t.narration,
  }));
}

/** Totals for the latest month that has data (descriptive; not a claim that the month is complete). */
export function importedMonthSummary(model: ImportedModel) {
  const latest = model.months[model.months.length - 1];
  if (!latest) return { income: 0, expenses: 0, investments: 0 };
  const debit = (cat: "investment" | "savings") => latest.byCategory.get(cat)?.debitPaise ?? 0;
  return {
    income: latest.incomePaise / 100,
    expenses: latest.expensePaise / 100,
    investments: (debit("investment") + debit("savings")) / 100,
  };
}

const SEVERITY: Record<string, "info" | "warning" | "critical"> = { info: "info", medium: "warning", high: "critical" };
export function importedAlertRows(alerts: Array<{ severity: string; title: string; message: string; relatedMetric: string }>) {
  return alerts.map((a, i) => ({
    id: i + 1,
    alertType: a.relatedMetric,
    title: a.title,
    message: a.message,
    severity: SEVERITY[a.severity] ?? "info",
    isRead: false,
    createdAt: new Date(),
  }));
}
