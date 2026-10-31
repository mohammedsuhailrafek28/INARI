/**
 * Monthly financial review built only from ledger transactions the user imported.
 *
 * No balances, goals or history are invented: anything not provided is listed in `unknowns`. Every action cites
 * real transaction ids. All text is template-based (mode "fallback") and passes the numeric/claim guardrails.
 */
import type { Category, LedgerTransaction, MonthlyReport } from "../../shared/inari/contracts";
import { EDUCATIONAL_DISCLAIMER } from "../wealth/types";
import { describeGoal } from "./goals";
import { guardText, type GuardrailStatus } from "./guardrails";
import { getLedgerRepository } from "./ledger";
import type { StoredBatch, StoredProfile } from "./ledger/types";
import { detectSubscriptions, isActiveSubscription, type DetectedSubscription } from "./recurring";
import { isImportedMode, breakdownForMonth } from "./service";
import { computeMonthTotals, deriveFinancialSnapshot, isExcluded, isExpenseCategory, type MonthTotals } from "./snapshot";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const LABELS: Partial<Record<Category, string>> = { dining: "Dining & delivery", utilities: "Utilities & bills", fees_tax: "Fees & taxes", emi: "EMI / loan", other: "Other spending", subscription: "Subscriptions" };
const label = (c: string) => LABELS[c as Category] ?? c.charAt(0).toUpperCase() + c.slice(1).replace(/_/g, " ");

export const DRIFT = { minHistoryMonths: 2, maxHistoryMonths: 3, minIncreasePercent: 25, minIncreaseRupees: 500 } as const;

const round2 = (n: number) => Math.round(n * 100) / 100;
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const pct = (n: number) => `${(Math.round(n * 10) / 10).toString()}%`;
const prevMonth = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
};
const daysInMonth = (ym: string) => new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).getUTCDate();
const monthName = (ym: string) => `${MONTH_NAMES[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}`;
const netPaise = (v: { debitPaise: number; creditPaise: number } | undefined) => (v ? Math.max(0, v.debitPaise - v.creditPaise) : 0);

type Action = MonthlyReport["actions"][number];
type Facts = { amounts: number[]; percents: number[] };

export type ReportInput = {
  transactions: LedgerTransaction[];
  batches: StoredBatch[];
  profile: StoredProfile | null;
  month: string;
  now: Date;
};

function emptyReport(month: string, now: Date, dataSource: "imported" | "demo", note: { code: string; message: string }): MonthlyReport {
  return {
    implementation: "implemented",
    month,
    generatedAt: now,
    dataSource,
    status: "insufficient_data",
    totals: { income: 0, expenses: 0, savings: 0, savingsRate: 0, investments: 0 },
    previousMonth: null,
    categories: [],
    topMerchants: [],
    unusualTransactionIds: [],
    subscriptions: { monthlyTotal: 0, changes: [] },
    actions: [],
    narrative: { headline: `${monthName(month)}: not enough data`, body: "There is no imported data for this month, so no figures are shown.", mode: "fallback" },
    dataQuality: [{ code: note.code, severity: "warning", message: note.message }],
    disclaimer: EDUCATIONAL_DISCLAIMER,
    drift: { status: "insufficient_history", baselineMonths: [], items: [] },
    obligations: [],
    unknowns: ["goals", "emergencyFund", "investments", "creditCardDebt"],
    guardrails: { status: "passed", reasons: [] },
  };
}

export function buildMonthlyReport(input: ReportInput): MonthlyReport {
  const { batches, profile, month, now } = input;
  const live = input.transactions.filter(t => !isExcluded(t));
  const nowYm = now.toISOString().slice(0, 7);
  if (month > nowYm) return emptyReport(month, now, "imported", { code: "future_month", message: "This month has not started yet." });

  const monthsAll = computeMonthTotals(input.transactions, batches, profile?.claims);
  const cur = monthsAll.find(m => m.month === month);
  if (!cur) return emptyReport(month, now, "imported", { code: "no_data_for_month", message: `No imported transactions fall in ${monthName(month)}.` });

  const dim = daysInMonth(month);
  const isCurrent = month === nowYm;
  const daysElapsed = isCurrent ? Math.min(now.getUTCDate(), dim) : dim;
  const monthTx = live.filter(t => t.postedOn.startsWith(month));
  const lastTxDate = monthTx.map(t => t.postedOn).sort().pop() ?? `${month}-01`;
  const partial = isCurrent || !cur.complete;
  const reason = isCurrent
    ? `${monthName(month)} is still in progress (day ${daysElapsed} of ${dim}); figures cover only what was imported up to ${lastTxDate}.`
    : !cur.complete
      ? `Your imports do not cover all of ${monthName(month)}; figures may be incomplete.`
      : null;

  const dataQuality: MonthlyReport["dataQuality"] = [];
  if (partial && reason) dataQuality.push({ code: "partial_month", severity: "warning", message: reason });

  // ---- totals ----
  const income = cur.incomePaise;
  const expenses = cur.expensePaise;
  const savings = income - expenses;
  const savingsRate = income > 0 ? round2((savings / income) * 100) : 0;
  if (income === 0) dataQuality.push({ code: "no_income_found", severity: "warning", message: "No income was found in this month, so the savings rate is shown as 0 and is not meaningful." });
  const investments = netPaise(cur.byCategory.get("investment"));

  const prevYm = prevMonth(month);
  const prev = monthsAll.find(m => m.month === prevYm);
  const prevOk = prev && prev.complete;
  const previousMonth = prevOk
    ? { income: prev.incomePaise / 100, expenses: prev.expensePaise / 100, savingsRate: prev.incomePaise > 0 ? round2(((prev.incomePaise - prev.expensePaise) / prev.incomePaise) * 100) : 0 }
    : null;
  if (!prevOk) dataQuality.push({ code: "no_previous_month", severity: "info", message: prev ? `${monthName(prevYm)} is only partly covered, so no month-on-month comparison is shown.` : "No earlier month is available, so no month-on-month comparison is shown." });

  // ---- categories ----
  const categories = breakdownForMonth(live, batches, month, profile?.claims).map(c => (prevOk ? c : { ...c, previousMonthAmount: null, changePercent: null }));
  const monthByCategory = (c: Category) => monthTx.filter(t => t.category === c && t.direction === "debit").sort((a, b) => b.amountPaise - a.amountPaise);

  // ---- top merchants ----
  const merchants = new Map<string, { paise: number; count: number }>();
  for (const t of monthTx) {
    if (t.direction !== "debit" || t.isTransfer || !isExpenseCategory(t.category)) continue;
    const key = t.merchant ?? "Unknown";
    const e = merchants.get(key) ?? { paise: 0, count: 0 };
    merchants.set(key, { paise: e.paise + t.amountPaise, count: e.count + 1 });
  }
  const topMerchants = Array.from(merchants.entries())
    .map(([merchant, v]) => ({ merchant, amount: v.paise / 100, count: v.count }))
    .sort((a, b) => b.amount - a.amount || (a.merchant < b.merchant ? -1 : 1))
    .slice(0, 5);

  // ---- unusual transactions: well above the usual payment size across the history up to this month ----
  const history = live.filter(t => t.postedOn.slice(0, 7) <= month && t.direction === "debit" && !t.isTransfer && isExpenseCategory(t.category) && t.category !== "rent" && t.category !== "emi");
  let unusual: LedgerTransaction[] = [];
  if (history.length >= 10) {
    const xs = history.map(t => t.amountPaise);
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length);
    unusual = monthTx.filter(t => history.includes(t) && t.amountPaise > mean + 2 * sd && t.amountPaise >= 50_000).sort((a, b) => b.amountPaise - a.amountPaise).slice(0, 3);
  }

  // ---- recurring obligations (as of the end of this month) ----
  const subsAll = detectSubscriptions(live.filter(t => t.postedOn.slice(0, 7) <= month), profile?.subscriptionDecisions);
  const subs = subsAll.filter(isActiveSubscription);
  const subChanges: string[] = [];
  const obligations: NonNullable<MonthlyReport["obligations"]> = subs.map(s => ({
    label: s.merchant, kind: "subscription" as const, monthlyAmount: s.monthlyEquivalent, evidenceTransactionIds: s.evidenceTransactionIds.slice(-3),
  }));
  for (const s of subsAll) {
    if (s.flags.includes("price_increase") && s.priceChange) subChanges.push(`${s.merchant} rose from ${inr(s.priceChange.from)} to ${inr(s.priceChange.to)} per charge.`);
    if (s.flags.includes("possible_duplicate")) subChanges.push(`${s.merchant} was charged twice within one billing cycle.`);
    if (s.flags.includes("inactive") && s.status !== "dismissed") subChanges.push(`${s.merchant} has stopped charging.`);
  }
  for (const kind of ["rent", "emi"] as const) {
    const tx = monthByCategory(kind);
    if (tx.length > 0) obligations.push({ label: label(kind), kind, monthlyAmount: tx.reduce((s, t) => s + t.amountPaise, 0) / 100, evidenceTransactionIds: tx.slice(0, 3).map(t => t.id) });
  }

  // ---- spending drift vs earlier complete months ----
  const baselineMonths = monthsAll.filter(m => m.month < month && m.complete).slice(-DRIFT.maxHistoryMonths);
  const drift: NonNullable<MonthlyReport["drift"]> = { status: baselineMonths.length >= DRIFT.minHistoryMonths ? "ok" : "insufficient_history", baselineMonths: baselineMonths.map(m => m.month), items: [] };
  if (drift.status === "insufficient_history") {
    dataQuality.push({
      code: "insufficient_history_for_drift",
      severity: "info",
      message: `Spending drift needs at least ${DRIFT.minHistoryMonths} earlier complete months; ${baselineMonths.length} ${baselineMonths.length === 1 ? "is" : "are"} available, so no drift is reported.`,
    });
  } else {
    for (const [category, v] of Array.from(cur.byCategory.entries())) {
      if (!isExpenseCategory(category)) continue;
      const now$ = netPaise(v);
      const base = baselineMonths.reduce((s, m) => s + netPaise(m.byCategory.get(category)), 0) / baselineMonths.length;
      if (now$ === 0 && base === 0) continue;
      const diff = now$ - base;
      const change = base > 0 ? round2((diff / base) * 100) : null;
      const up = diff > 0 && (base === 0 ? diff >= DRIFT.minIncreaseRupees * 100 : change! >= DRIFT.minIncreasePercent && diff >= DRIFT.minIncreaseRupees * 100);
      const down = diff < 0 && base > 0 && !partial && change! <= -DRIFT.minIncreasePercent && -diff >= DRIFT.minIncreaseRupees * 100;
      if (!up && !down) continue;
      drift.items.push({
        category, amount: now$ / 100, baselineAverage: round2(base / 100), changePercent: change, direction: up ? "up" : "down",
        provisional: partial, evidenceTransactionIds: monthByCategory(category).slice(0, 5).map(t => t.id),
      });
    }
    drift.items.sort((a, b) => b.amount - b.baselineAverage - (a.amount - a.baselineAverage) || (a.category < b.category ? -1 : 1));
    if (partial && drift.items.length > 0) dataQuality.push({ code: "drift_provisional", severity: "info", message: "This month is not complete, so drift shown so far may grow; falls are not reported until the month is complete." });
  }

  // ---- data quality that touches this month (unresolved flags are never hidden) ----
  const snapshot = deriveFinancialSnapshot({ transactions: input.transactions, batches, profile });
  const monthIds = new Set(monthTx.map(t => t.id));
  const REVIEW_CODES = new Set(["possible_duplicates", "card_repayment_counted", "possible_transfer_pair", "refund_counted_as_income", "reconciliation_applied"]);
  const unresolved: MonthlyReport["dataQuality"] = [];
  for (const n of snapshot.dataQuality) {
    if (!REVIEW_CODES.has(n.code)) continue;
    const ids = (n.transactionIds ?? []).filter(id => monthIds.has(id));
    if (ids.length === 0 && n.code !== "reconciliation_applied") continue;
    const note = { ...n, transactionIds: ids };
    if (n.code !== "reconciliation_applied") unresolved.push(note);
    dataQuality.push(n.code === "reconciliation_applied" ? n : { ...note, message: `${n.message} (${ids.length} in ${monthName(month)}; resolve with inari.reconcile.)` });
  }

  // ---- unknowns: never fabricated ----
  const goalList = (profile?.goals ?? []).map(g => describeGoal(g, now));
  const unknowns: string[] = goalList.length === 0 ? ["goals"] : [];
  if (snapshot.balances.emergencyFund === null) unknowns.push("emergencyFund");
  if (snapshot.balances.investments === null) unknowns.push("investments");
  if (snapshot.balances.creditCardDebt === null) unknowns.push("creditCardDebt");

  // ---- facts for the guardrail: every number we are willing to print ----
  const facts: Facts = { amounts: [], percents: [] };
  const fa = (...ns: Array<number | null | undefined>) => ns.forEach(n => n !== null && n !== undefined && facts.amounts.push(n));
  const fp = (...ns: Array<number | null | undefined>) => ns.forEach(n => n !== null && n !== undefined && facts.percents.push(n));
  fa(income / 100, expenses / 100, savings / 100, Math.abs(savings) / 100, investments / 100);
  fp(savingsRate);
  if (previousMonth) { fa(previousMonth.income, previousMonth.expenses); fp(previousMonth.savingsRate); }
  categories.forEach(c => { fa(c.amount, c.previousMonthAmount); fp(c.sharePercent, c.changePercent === null ? null : Math.abs(c.changePercent)); });
  drift.items.forEach(d => { fa(d.amount, d.baselineAverage, d.amount - d.baselineAverage); fp(d.changePercent === null ? null : Math.abs(d.changePercent)); });
  topMerchants.forEach(m => fa(m.amount));
  subs.forEach(s => fa(s.typicalAmount, s.monthlyEquivalent, s.annualCost, s.priceChange?.from, s.priceChange?.to));
  fa(subs.reduce((s, x) => s + x.monthlyEquivalentPaise, 0) / 100);
  obligations.forEach(o => fa(o.monthlyAmount));
  unusual.forEach(t => fa(t.amountPaise / 100));

  // ---- actions: explainable, each tied to real transactions ----
  const candidates: Array<Action & { rank: number }> = [];
  for (const d of drift.items.filter(i => i.direction === "up")) {
    const excess = d.amount - d.baselineAverage;
    fa(excess);
    candidates.push({
      title: `Look at ${label(d.category).toLowerCase()} spending`,
      reason: d.changePercent === null
        ? `${label(d.category)} was ${inr(d.amount)} this month with no spending in your earlier months.`
        : `${label(d.category)} was ${inr(d.amount)}, ${pct(d.changePercent)} above your usual ${inr(d.baselineAverage)} (average of ${drift.baselineMonths.length} earlier months).`,
      evidenceTransactionIds: d.evidenceTransactionIds,
      expectedImpactInr: Math.round(excess),
      rank: excess,
    });
  }
  for (const s of subsAll.filter((x): x is DetectedSubscription => x.flags.includes("price_increase") && !!x.priceChange && x.status !== "dismissed")) {
    const perYear = Math.round((s.priceChange!.to - s.priceChange!.from) * (s.annualCost / s.typicalAmount));
    fa(perYear);
    candidates.push({
      title: `${s.merchant} got more expensive`,
      reason: `${s.merchant} went from ${inr(s.priceChange!.from)} to ${inr(s.priceChange!.to)} per charge.`,
      evidenceTransactionIds: s.evidenceTransactionIds.slice(-3),
      expectedImpactInr: perYear,
      rank: perYear,
    });
  }
  for (const s of subsAll.filter(x => x.flags.includes("possible_duplicate") && x.status !== "dismissed")) {
    candidates.push({
      title: `Check a possible double charge from ${s.merchant}`,
      reason: `${s.merchant} was charged twice within one billing cycle (${inr(s.typicalAmount)} each).`,
      evidenceTransactionIds: s.evidenceTransactionIds.slice(-2),
      expectedImpactInr: Math.round(s.typicalAmount),
      rank: s.typicalAmount,
    });
  }
  if (unusual.length > 0) {
    const t = unusual[0];
    candidates.push({
      title: "Review a large payment",
      reason: `${inr(t.amountPaise / 100)} on ${t.postedOn}${t.merchant ? ` to ${t.merchant}` : ""} is much larger than your usual payments.`,
      evidenceTransactionIds: [t.id],
      expectedImpactInr: null,
      rank: 0,
    });
  }
  // best of each kind first (so a large payment is not crowded out by several drifts), then by size
  const kindOf = (a: Action) => (a.title.startsWith("Look at") ? "drift" : a.title.includes("more expensive") ? "price" : a.title.startsWith("Check a possible") ? "double" : "unusual");
  const sorted = [...candidates].sort((a, b) => b.rank - a.rank);
  const firstOfKind = ["drift", "price", "double", "unusual"].map(k => sorted.find(c => kindOf(c) === k)).filter((c): c is (typeof sorted)[number] => !!c);
  const picked = [...firstOfKind, ...sorted.filter(c => !firstOfKind.includes(c))].slice(0, 3).sort((a, b) => b.rank - a.rank);
  let actions: Action[] = picked.map(({ rank: _r, ...a }) => a);
  if (unresolved.length > 0) {
    const ids = Array.from(new Set(unresolved.flatMap(n => n.transactionIds ?? []))).slice(0, 10);
    const dq: Action = {
      title: "Confirm flagged transactions",
      reason: `${ids.length} transaction(s) in ${monthName(month)} may be double-counted or misread (possible duplicates, card repayments or transfers). Your totals include them until you decide.`,
      evidenceTransactionIds: ids,
      expectedImpactInr: null,
    };
    actions = [...actions.slice(0, 2), dq];
  }

  // ---- narrative (template text, then guarded) ----
  const topCat = categories[0];
  const headlineRaw = `${monthName(month)}${partial ? " so far" : ""}: you spent ${inr(expenses / 100)}${income > 0 ? ` and saved ${inr(Math.abs(savings) / 100)} (${pct(savingsRate)})` : ""}.`;
  const bodyParts = [
    `Income recorded was ${inr(income / 100)} and spending was ${inr(expenses / 100)}.`,
    topCat ? `${label(topCat.category)} was your biggest category at ${inr(topCat.amount)} (${pct(topCat.sharePercent)} of spending).` : "",
    previousMonth ? `Last month you spent ${inr(previousMonth.expenses)}.` : "",
    drift.items.find(d => d.direction === "up") ? `${label(drift.items.find(d => d.direction === "up")!.category)} is running above its usual level.` : "",
    subs.length > 0 ? `Your detected recurring subscriptions come to ${inr(subs.reduce((s, x) => s + x.monthlyEquivalentPaise, 0) / 100)} a month.` : "",
    partial ? "This month is incomplete, so these figures may change." : "",
  ].filter(Boolean);
  const gh = guardText(headlineRaw, `${monthName(month)} summary`, facts);
  const gb = guardText(bodyParts.join(" "), "See the figures below.", facts);
  const checkedActions: Action[] = [];
  const reasons: string[] = [...gh.reasons, ...gb.reasons];
  let status: GuardrailStatus = gh.status !== "passed" ? gh.status : gb.status;
  for (const a of actions) {
    const g = guardText(`${a.title}. ${a.reason}`, "", facts);
    if (g.status === "passed") checkedActions.push(a);
    else {
      reasons.push(...g.reasons);
      status = status === "refused" || g.status === "refused" ? "refused" : "modified";
      checkedActions.push({ ...a, reason: "Review the linked transactions.", title: a.title.replace(/[₹\d%]/g, "").trim() || "Review linked transactions" });
    }
  }

  return {
    implementation: "implemented",
    month,
    generatedAt: now,
    dataSource: "imported",
    status: "ok",
    totals: { income: income / 100, expenses: expenses / 100, savings: savings / 100, savingsRate, investments: investments / 100 },
    previousMonth,
    categories,
    topMerchants,
    unusualTransactionIds: unusual.map(t => t.id),
    subscriptions: { monthlyTotal: subs.reduce((s, x) => s + x.monthlyEquivalentPaise, 0) / 100, changes: subChanges },
    actions: checkedActions,
    narrative: { headline: gh.text, body: gb.text, mode: "fallback" },
    dataQuality,
    disclaimer: EDUCATIONAL_DISCLAIMER,
    period: { from: `${month}-01`, to: `${month}-${String(dim).padStart(2, "0")}`, daysInMonth: dim, daysElapsed, partial, reason },
    drift,
    obligations,
    unknowns,
    goals: goalList.map(g => ({ id: g.id, name: g.name, progressPercent: g.progressPercent, status: g.status ?? "no_contribution", monthlyContribution: g.monthlyContribution ?? null, projectedCompletion: g.projectedCompletion })),
    guardrails: { status, reasons: Array.from(new Set(reasons)) },
  };
}

export async function monthlyReportFor(userKey: string, month: string, now: Date = new Date()): Promise<MonthlyReport> {
  const repo = getLedgerRepository();
  if (!(await isImportedMode(userKey))) {
    return emptyReport(month, now, "demo", { code: "no_imported_data", message: "No imported data yet. Import a bank statement or SMS alerts to get a monthly review." });
  }
  const [transactions, batches, profile] = await Promise.all([repo.listTransactions(userKey), repo.listBatches(userKey), repo.getProfile(userKey)]);
  return buildMonthlyReport({ transactions, batches, profile, month, now });
}

/** Months that have transactions, newest first. */
export async function reportMonthsFor(userKey: string): Promise<string[]> {
  if (!(await isImportedMode(userKey))) return [];
  const repo = getLedgerRepository();
  const [transactions, batches, profile] = await Promise.all([repo.listTransactions(userKey), repo.listBatches(userKey), repo.getProfile(userKey)]);
  return computeMonthTotals(transactions, batches, profile?.claims).map((m: MonthTotals) => m.month).sort().reverse();
}

