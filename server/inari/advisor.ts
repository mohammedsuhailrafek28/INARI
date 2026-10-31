/**
 * Deterministic advisor (`inari.ask`). No language model runs here: every answer is assembled from the user's
 * imported ledger by fixed rules, reuses the verified intent parser and the deterministic simulator, and is
 * checked by the guardrails before it leaves. Responses always say so (`mode: "fallback"`, `engine.llmUsed: false`).
 *
 * The advisor never changes data. Anything consequential is returned as a `proposedAction` the client must confirm
 * by calling the named procedure itself.
 */
import type { AdvisorContext, Category, InariAdvisorResponse, IntentAnalysis, LedgerTransaction, SimulationResult } from "../../shared/inari/contracts";
import { EDUCATIONAL_DISCLAIMER } from "../wealth/types";
import { CARD_REPAYMENT } from "./categorize";
import { guardText, isProhibitedAdviceRequest, type GuardrailStatus } from "./guardrails";
import { loadImportedModel, type ImportedModel } from "./importedModel";
import { getLedgerRepository } from "./ledger";
import { analyzeIntentText } from "./nlp/intent";
import { monthlyReportFor } from "./report";
import { detectSubscriptions, isActiveSubscription } from "./recurring";
import { runSimulation } from "./simulate";
import { listGoalsFor } from "./goals";
import { claimMatchesFor, listClaimsFor } from "./claims";
import { emiCheckFor } from "./emi";
import { manualEntryPreviewFor } from "./manual";
import { breakdownForMonth } from "./service";
import { isExcluded, isExpenseCategory } from "./snapshot";

type Note = NonNullable<InariAdvisorResponse["evidence"]>[number];
type Proposed = NonNullable<InariAdvisorResponse["proposedActions"]>[number];
type Facts = { amounts: number[]; percents: number[] };

type Draft = {
  answer: string;
  summary: string;
  insights: string[];
  nextActions: string[];
  followUps: string[];
  metrics: Array<{ label: string; value: string }>;
  confidence: "low" | "medium" | "high";
  evidence: Note[];
  assumptions: string[];
  limitations: string[];
  proposed: Proposed[];
  simulation: SimulationResult | null;
  context: AdvisorContext;
  refused?: string[];
};

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthName = (ym: string) => `${MONTH_NAMES[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}`;
const prevMonth = (ym: string) => (+ym.slice(5, 7) === 1 ? `${+ym.slice(0, 4) - 1}-12` : `${ym.slice(0, 4)}-${String(+ym.slice(5, 7) - 1).padStart(2, "0")}`);
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const pct = (n: number) => `${Math.round(n * 10) / 10}%`;
const LABELS: Partial<Record<Category, string>> = { dining: "dining & delivery", utilities: "utilities & bills", fees_tax: "fees & taxes", emi: "EMI / loan", other: "other spending" };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const label = (c: string) => LABELS[c as Category] ?? c.replace(/_/g, " ");
const netPaise = (v: { debitPaise: number; creditPaise: number } | undefined) => (v ? Math.max(0, v.debitPaise - v.creditPaise) : 0);

class FactBook {
  amounts: number[] = [];
  percents: number[] = [];
  /** register and format a rupee amount */
  r(n: number): string { this.amounts.push(Math.abs(n)); return inr(Math.abs(n)); }
  /** register and format a percentage */
  p(n: number): string { this.percents.push(Math.abs(n)); return pct(n); }
  get facts(): Facts { return { amounts: this.amounts, percents: this.percents }; }
}

const base = (ctx: AdvisorContext): Draft => ({
  answer: "", summary: "", insights: [], nextActions: [], followUps: [], metrics: [], confidence: "low",
  evidence: [], assumptions: [], limitations: [], proposed: [], simulation: null, context: ctx,
});

const CAPABILITIES = [
  "How much did I spend on dining last month?",
  "Which subscriptions am I paying for?",
  "Show my report for September",
  "Are there any duplicate or flagged transactions?",
  "What if I cut dining by 30%?",
];

// ---------- helpers over the ledger ----------
type World = {
  model: ImportedModel;
  all: LedgerTransaction[];
  live: LedgerTransaction[];
  batches: Parameters<typeof breakdownForMonth>[1];
  now: Date;
  nowYm: string;
  ownerKey: string;
};

function resolveMonth(w: World, intent: IntentAnalysis, previous?: AdvisorContext): { month: string | null; note: string | null } {
  const months = w.model.months;
  const p = intent.period;
  if (p?.kind === "month") return { month: p.value, note: null };
  if (p?.kind === "relative" && p.value === "last_month") return { month: prevMonth(w.nowYm), note: null };
  if (p?.kind === "relative" && p.value === "this_month") return { month: w.nowYm, note: null };
  const unsupported = p ? `Only calendar months are supported, so I used your most recent complete month instead of "${p.value.replace(/_/g, " ")}".` : null;
  if (!p && previous?.month) return { month: previous.month, note: null };
  const complete = months.filter(m => m.complete);
  const pick = complete[complete.length - 1] ?? months[months.length - 1];
  return { month: pick?.month ?? null, note: unsupported };
}

const topIds = (txs: LedgerTransaction[], n = 5) => [...txs].sort((a, b) => b.amountPaise - a.amountPaise || (a.id < b.id ? -1 : 1)).slice(0, n).map(t => t.id);

// ---------- handlers ----------
function noData(ctx: AdvisorContext, hasModel: boolean): Draft {
  const d = base(ctx);
  d.answer = hasModel
    ? "I cannot answer that yet because no complete month of your transactions has been imported."
    : "I do not have any of your transactions yet, so I cannot answer from your own numbers. Import a bank statement (CSV) or paste SMS alerts first.";
  d.summary = "No data to answer from";
  d.limitations = ["Nothing is estimated or assumed when there is no imported data."];
  d.nextActions = ["Import a bank statement or paste SMS alerts."];
  d.followUps = [];
  d.proposed = [{ type: "import_data", title: "Import your transactions", description: "Upload a CSV statement or paste SMS alerts.", procedure: "inari.importPreview", input: {}, requiresConfirmation: true, inputComplete: false, missingFields: ["kind", "content or text"] }];
  return d;
}

function refusal(ctx: AdvisorContext): Draft {
  const d = base(ctx);
  d.answer = "I can't recommend specific investments or promise returns. I can show you what your own transactions say about spending, saving and recurring payments, or test a what-if on your numbers.";
  d.summary = "Declined: investment advice or return promises";
  d.confidence = "high";
  d.limitations = ["INARI does not give investment recommendations or guaranteed-return claims."];
  d.followUps = CAPABILITIES.slice(0, 3);
  d.refused = ["Specific investment recommendations and guaranteed-return claims are not allowed."];
  return d;
}

function clarify(ctx: AdvisorContext, question: string): Draft {
  const d = base(ctx);
  d.answer = question;
  d.summary = "I need one detail to continue";
  d.limitations = ["I will not guess a missing number or category."];
  d.followUps = [];
  return d;
}

function overview(w: World, fb: FactBook, ctx: AdvisorContext): Draft {
  const d = base(ctx);
  const s = w.model.snapshot;
  if (s.monthlyIncome === null || s.monthlyExpenses === null) return noData(ctx, true);
  d.answer = `Based on ${s.provenance.income === "observed" ? "your recent complete months" : "your one complete month"}, you earn about ${fb.r(s.monthlyIncome)} and spend about ${fb.r(s.monthlyExpenses)} a month.` +
    (s.savingsRate !== null ? ` That leaves ${fb.r(s.monthlySurplus ?? 0)} (${fb.p(s.savingsRate)} of income).` : " No income was found, so I cannot give a savings rate.");
  d.summary = s.savingsRate !== null ? `Savings rate ${fb.p(s.savingsRate)}` : "Savings rate unknown";
  d.metrics = [
    { label: "Monthly income", value: fb.r(s.monthlyIncome) },
    { label: "Monthly expenses", value: fb.r(s.monthlyExpenses) },
    ...(s.savingsRate !== null ? [{ label: "Savings rate", value: fb.p(s.savingsRate) }] : []),
  ];
  d.confidence = s.provenance.income === "observed" ? "high" : "medium";
  d.evidence = [{ code: "snapshot", severity: "info", message: `Averaged over ${s.coverage.completeMonths} complete month(s) from ${s.coverage.transactionCount} transactions (${s.coverage.firstDate} to ${s.coverage.lastDate}).` }];
  d.assumptions = ["Income = salary and other income credits. Investments, savings and transfers are not counted as expenses."];
  d.limitations = w.model.unknownFields.map(f => `${f} was not provided, so it is not included.`);
  d.nextActions = ["Open the monthly report for a month-by-month view."];
  d.followUps = ["Show my report for the latest month", "What if I cut dining by 30%?"];
  return d;
}

function spending(w: World, intent: IntentAnalysis, previous: AdvisorContext | undefined, fb: FactBook, ctx0: AdvisorContext, question: string): Draft {
  const { month, note } = resolveMonth(w, intent, previous);
  const category: Category | null = intent.category ?? (previous?.intent === "spending_question" ? previous.category : null);
  const merchant = intent.merchant ?? (previous?.intent === "spending_question" && !intent.category ? (previous.merchant ?? null) : null);
  const ctx: AdvisorContext = { intent: "spending_question", amount: null, category, month, merchant };
  if (!month) return noData(ctx, true);
  const entry = w.model.months.find(m => m.month === month);
  const d = base(ctx);
  if (!entry) {
    d.answer = `I have no transactions for ${monthName(month)}.`;
    d.summary = "No data for that month";
    d.limitations = ["Only months that appear in your imported transactions can be answered."];
    d.followUps = w.model.months.length ? [`How much did I spend in ${monthName(w.model.months[w.model.months.length - 1].month)}?`] : [];
    return d;
  }
  const partial = !entry.complete || month === w.nowYm;
  const monthTx = w.live.filter(t => t.postedOn.startsWith(month));
  const prev = w.model.months.find(m => m.month === prevMonth(month));
  const prevOk = !!prev && prev.complete;
  if (note) d.limitations.push(note);
  if (partial) d.limitations.push(`${monthName(month)} is not fully covered by your imports (or is still in progress), so this figure may be incomplete.`);

  const wantsTop = /\b(biggest|largest|top|most)\b/i.test(question) && !category && !merchant;
  if (merchant) {
    const rows = monthTx.filter(t => t.direction === "debit" && (t.merchant ?? "").toLowerCase().includes(merchant.toLowerCase()));
    const total = rows.reduce((s, t) => s + t.amountPaise, 0) / 100;
    d.answer = rows.length
      ? `In ${monthName(month)} you paid ${merchant} ${fb.r(total)} across ${rows.length} payment${rows.length === 1 ? "" : "s"}.`
      : `I found no payments to ${merchant} in ${monthName(month)}.`;
    d.summary = rows.length ? `${merchant}: ${fb.r(total)}` : `No ${merchant} payments`;
    d.evidence = rows.length ? [{ code: "merchant_payments", severity: "info", message: `${rows.length} payment(s) to ${merchant} in ${monthName(month)}.`, transactionIds: topIds(rows) }] : [];
    d.metrics = [{ label: `${merchant} (${monthName(month)})`, value: fb.r(total) }];
    d.confidence = rows.length === 0 && partial ? "low" : partial ? "medium" : "high";
    return finishSpending(d, fb, partial, month);
  }
  if (category) {
    const v = entry.byCategory.get(category);
    const total = netPaise(v) / 100;
    const rows = monthTx.filter(t => t.category === category && t.direction === "debit");
    d.answer = total > 0 ? `In ${monthName(month)} you spent ${fb.r(total)} on ${label(category)}.` : `I found no ${label(category)} spending in ${monthName(month)}.`;
    if (total > 0 && prevOk) {
      const before = netPaise(prev!.byCategory.get(category)) / 100;
      if (before > 0) {
        const diff = total - before;
        d.answer += diff === 0 ? ` That is the same as ${monthName(prev!.month)}.` : ` That is ${fb.r(diff)} ${diff > 0 ? "more" : "less"} than ${monthName(prev!.month)} (${fb.r(before)}).`;
      }
    }
    d.summary = total > 0 ? `${label(category)}: ${fb.r(total)}` : `No ${label(category)} spending`;
    d.evidence = rows.length ? [{ code: "category_transactions", severity: "info", message: `${rows.length} ${label(category)} payment(s) in ${monthName(month)}; largest listed.`, transactionIds: topIds(rows) }] : [];
    d.metrics = [{ label: `${label(category)} (${monthName(month)})`, value: fb.r(total) }];
    d.confidence = partial ? "medium" : "high";
    d.assumptions = ["Refunds in the same category are netted off the spending."];
    return finishSpending(d, fb, partial, month);
  }
  // whole-month view
  const items = breakdownForMonth(w.live, w.batches, month);
  const total = entry.expensePaise / 100;
  const top = items.slice(0, 3);
  if (wantsTop && top[0]) {
    d.answer = `Your biggest spending category in ${monthName(month)} was ${label(top[0].category)} at ${fb.r(top[0].amount)} (${fb.p(top[0].sharePercent)} of ${fb.r(total)}).`;
    const largest = [...monthTx.filter(t => t.direction === "debit" && isExpenseCategory(t.category))].sort((a, b) => b.amountPaise - a.amountPaise)[0];
    if (largest) d.answer += ` The largest single payment was ${fb.r(largest.amountPaise / 100)}${largest.merchant ? ` to ${largest.merchant}` : ""} on ${largest.postedOn}.`;
    d.evidence = [{ code: "top_category", severity: "info", message: `Largest ${label(top[0].category)} payments in ${monthName(month)}.`, transactionIds: topIds(monthTx.filter(t => t.category === top[0].category && t.direction === "debit")) }];
  } else {
    d.answer = `In ${monthName(month)} you spent ${fb.r(total)}.` + (top.length ? ` The biggest categories were ${top.map(t => `${label(t.category)} (${fb.r(t.amount)})`).join(", ")}.` : "");
    d.evidence = top[0] ? [{ code: "top_categories", severity: "info", message: `Spending in ${monthName(month)} comes from ${items.length} categories.`, transactionIds: topIds(monthTx.filter(t => t.direction === "debit" && isExpenseCategory(t.category))) }] : [];
  }
  d.summary = `${monthName(month)}: ${fb.r(total)} spent`;
  d.metrics = [{ label: `Spending (${monthName(month)})`, value: fb.r(total) }];
  d.confidence = partial ? "medium" : "high";
  return finishSpending(d, fb, partial, month);
}

function finishSpending(d: Draft, _fb: FactBook, _partial: boolean, month: string): Draft {
  d.assumptions.push("Amounts come from your imported transactions only; excluded or reconciled rows are left out.");
  d.nextActions = [`Open the report for ${monthName(month)} for the full picture.`];
  d.followUps = ["And last month?", "Which subscriptions am I paying for?"];
  return d;
}

function explainCategory(w: World, intent: IntentAnalysis, fb: FactBook, ctx0: AdvisorContext, previous: AdvisorContext | undefined, now: Date): Promise<Draft> | Draft {
  const category = intent.category;
  const { month } = resolveMonth(w, intent, previous);
  const ctx: AdvisorContext = { intent: "category_explanation", amount: null, category, month, merchant: null };
  if (!category || !month) return clarify(ctx, "Which spending category would you like me to explain?");
  return monthlyReportFor(w.ownerKey, month, now).then(r => {
    const d = base(ctx);
    const item = r.drift?.items.find(i => i.category === category);
    const cat = r.categories.find(c => c.category === category);
    if (r.status !== "ok" || !cat) {
      d.answer = `I found no ${label(category)} spending in ${monthName(month)} to explain.`;
      d.summary = "Nothing to explain";
      return d;
    }
    if (r.drift?.status === "insufficient_history") {
      d.answer = `${cap(label(category))} was ${fb.r(cat.amount)} in ${monthName(month)}. I cannot say whether that is high for you because I need at least two earlier complete months to compare with.`;
      d.limitations = ["Not enough history to judge whether this is unusual."];
      d.confidence = "low";
    } else if (item) {
      d.answer = `${cap(label(category))} was ${fb.r(item.amount)} in ${monthName(month)}, ${item.changePercent === null ? "with none in earlier months" : `${fb.p(item.changePercent)} ${item.direction === "up" ? "above" : "below"} your usual ${fb.r(item.baselineAverage)}`} (average of ${r.drift!.baselineMonths.length} earlier months).`;
      d.evidence = [{ code: "drift", severity: "info", message: `Largest ${label(category)} payments in ${monthName(month)}.`, transactionIds: item.evidenceTransactionIds }];
      d.confidence = item.provisional ? "medium" : "high";
    } else {
      d.answer = `${cap(label(category))} was ${fb.r(cat.amount)} in ${monthName(month)}, which is within your normal range compared with earlier months.`;
      d.confidence = "medium";
    }
    d.summary = `${label(category)} in ${monthName(month)}`;
    d.metrics = [{ label: `${label(category)} (${monthName(month)})`, value: fb.r(cat.amount) }];
    d.assumptions = ["Compared with the average of up to three earlier complete months."];
    d.nextActions = [`Open the report for ${monthName(month)}.`];
    return d;
  });
}

function subscriptions(w: World, intent: IntentAnalysis, question: string, fb: FactBook, ctx: AdvisorContext): Draft {
  const subs = detectSubscriptions(w.live, w.model.profile?.subscriptionDecisions);
  const active = subs.filter(isActiveSubscription);
  const d = base({ ...ctx, intent: "subscription_query", merchant: intent.merchant });
  const cancel = /\b(cancel|stop|unsubscribe|remove)\b/i.test(question);
  const match = intent.merchant ? subs.find(s => s.merchant.toLowerCase().includes(intent.merchant!.toLowerCase())) : undefined;
  if (intent.merchant && !match) {
    d.answer = `I do not see a recurring payment to ${intent.merchant} in your transactions.`;
    d.summary = "No matching subscription";
    d.limitations = ["Recurring payments need at least three regular charges (two for yearly) to be detected."];
    d.confidence = "medium";
    return d;
  }
  if (match && cancel) {
    const sim = runSimulation([{ type: "cancel_subscriptions", subscriptionIds: [match.id] }], w.model);
    const e = sim.metrics.find(m => m.label === "Monthly expenses");
    d.simulation = sim;
    d.answer = `I cannot cancel ${match.merchant} for you; INARI never contacts merchants. If you stopped it, your spending would fall by about ${fb.r(match.monthlyEquivalent)} a month${e && e.scenario !== null ? ` (from ${fb.r(e.baseline!)} to ${fb.r(e.scenario)})` : ""}.`;
    d.summary = `Cancelling ${match.merchant} would save ${fb.r(match.monthlyEquivalent)} a month`;
    d.evidence = [{ code: "subscription", severity: "info", message: `${match.merchant}: ${match.occurrences} regular charges, last on ${match.lastChargedOn}.`, transactionIds: match.evidenceTransactionIds }];
    d.assumptions = sim.assumptions;
    d.limitations = ["This is a what-if only. Your data is unchanged and the subscription is not cancelled."];
    d.confidence = match.confidence >= 0.8 ? "high" : "medium";
    d.proposed = [{ type: "confirm_subscription", title: `Mark ${match.merchant} as dismissed`, description: "Hides this item and leaves it out of totals. It does not cancel the subscription with the merchant.", procedure: "inari.confirmSubscription", input: { subscriptionId: match.id, decision: "dismiss" }, requiresConfirmation: true }];
    d.metrics = [{ label: "Monthly saving if stopped", value: fb.r(match.monthlyEquivalent) }];
    return d;
  }
  if (match) {
    d.answer = `Yes. ${match.merchant} looks like a ${match.cadence} payment of ${fb.r(match.typicalAmount)} (about ${fb.r(match.annualCost)} a year), last charged on ${match.lastChargedOn}.` + (match.flags.includes("price_increase") && match.priceChange ? ` It rose from ${fb.r(match.priceChange.from)} to ${fb.r(match.priceChange.to)}.` : "");
    d.summary = `${match.merchant}: ${fb.r(match.typicalAmount)} ${match.cadence}`;
    d.evidence = [{ code: "subscription", severity: "info", message: `${match.occurrences} regular charges detected.`, transactionIds: match.evidenceTransactionIds }];
    d.confidence = match.confidence >= 0.8 ? "high" : "medium";
    d.metrics = [{ label: match.merchant, value: fb.r(match.typicalAmount) }];
    d.limitations = match.status === "possible" ? ["This is detected from your payments, not confirmed by you."] : [];
    return d;
  }
  if (active.length === 0) {
    d.answer = "I do not detect any recurring subscription payments in your transactions.";
    d.summary = "No subscriptions detected";
    d.limitations = ["Detection needs at least three regular, steady charges (two for yearly) in a subscription-like category."];
    d.confidence = "medium";
    return d;
  }
  const monthly = active.reduce((s, x) => s + x.monthlyEquivalentPaise, 0) / 100;
  d.answer = `I detect ${active.length} recurring payment${active.length === 1 ? "" : "s"} costing about ${fb.r(monthly)} a month: ${active.slice(0, 5).map(s => `${s.merchant} (${fb.r(s.monthlyEquivalent)})`).join(", ")}.`;
  d.summary = `${active.length} subscription(s), ${fb.r(monthly)} a month`;
  d.evidence = active.slice(0, 5).map(s => ({ code: "subscription", severity: "info" as const, message: `${s.merchant}: ${s.occurrences} regular charges.`, transactionIds: s.evidenceTransactionIds.slice(-3) }));
  d.metrics = [{ label: "Subscriptions per month", value: fb.r(monthly) }];
  d.confidence = "medium";
  d.limitations = ["These are detected from your payments; confirm or dismiss them in the subscriptions list."];
  d.followUps = ["What if I cancel Netflix?"];
  return d;
}

function whatIf(w: World, intent: IntentAnalysis, fb: FactBook, ctx: AdvisorContext): Draft {
  const d = base({ ...ctx, intent: "what_if", amount: intent.amount, category: intent.category });
  if (intent.needsClarification || !intent.scenario) return clarify(d.context, intent.clarificationQuestion ?? "What change would you like me to test, and by how much?");
  let sim: SimulationResult;
  try {
    sim = runSimulation([intent.scenario], w.model);
  } catch (e) {
    d.answer = (e as Error).message;
    d.summary = "That what-if is not available";
    d.limitations = [(e as Error).message];
    return d;
  }
  d.simulation = sim;
  if (sim.status !== "ok") {
    d.answer = sim.warnings[0] ?? "I cannot run that what-if without data.";
    d.summary = "Not enough data";
    return d;
  }
  const get = (l: string) => sim.metrics.find(m => m.label === l);
  const ex = get("Monthly expenses")!;
  const sr = get("Savings rate")!;
  const su = get("Monthly surplus")!;
  const cash = get("Next 12 months: cash left over");
  const dir = (n: number) => (n < 0 ? "lower" : "higher");
  d.answer = `Testing that on your ${w.model.breakdownMonths.length}-month average: monthly spending goes from ${fb.r(ex.baseline!)} to ${fb.r(ex.scenario!)}` +
    (ex.delta ? ` (${fb.r(ex.delta)} ${dir(ex.delta)})` : " (no change)") +
    `, and your savings rate goes from ${fb.p(sr.baseline!)} to ${fb.p(sr.scenario!)}.` +
    (cash ? ` Over 12 months that leaves ${fb.r(cash.scenario!)} versus ${fb.r(cash.baseline!)} now.` : "");
  d.summary = `Savings rate ${fb.p(sr.baseline!)} to ${fb.p(sr.scenario!)}`;
  for (const m of sim.metrics) {
    for (const v of [m.baseline, m.scenario, m.delta]) if (v !== null) (m.unit === "percent" ? fb.percents : fb.amounts).push(Math.abs(v));
  }
  d.metrics = sim.metrics.slice(0, 5).map(m => ({ label: m.label, value: m.unit === "percent" ? fb.p(m.scenario ?? 0) : m.unit === "months" ? `${m.scenario ?? "n/a"}` : fb.r(m.scenario ?? 0) }));
  void su;
  d.assumptions = sim.assumptions;
  d.limitations = sim.warnings;
  d.evidence = sim.evidence ?? [];
  d.confidence = (sim.evidence ?? []).some(n => n.severity === "warning") || w.model.breakdownMonths.length < 2 ? "medium" : "high";
  d.nextActions = ["Nothing has been changed. Tell me if you want to test a different amount."];
  d.followUps = ["What about 40% instead?", "What if I also add a ₹5,000 SIP?"];
  return d;
}

function reconciliation(w: World, fb: FactBook, ctx0: AdvisorContext): Draft {
  const ctx: AdvisorContext = { ...ctx0, intent: "unknown" };
  const d = base(ctx);
  const notes = w.model.snapshot.dataQuality.filter(n => ["possible_duplicates", "card_repayment_counted", "possible_transfer_pair", "refund_counted_as_income", "reconciliation_applied"].includes(n.code));
  const open = notes.filter(n => n.code !== "reconciliation_applied");
  const applied = notes.find(n => n.code === "reconciliation_applied");
  if (open.length === 0) {
    d.answer = applied ? `Nothing is waiting for review. ${applied.transactionIds?.length ?? 0} transaction(s) are excluded by your earlier decisions and can be restored.` : "Nothing is flagged for review right now.";
    d.summary = "No open flags";
    d.confidence = "high";
    d.evidence = applied ? [applied] : [];
    return d;
  }
  const parts = open.map(n => `${n.transactionIds?.length ?? 0} ${n.code === "possible_duplicates" ? "possible duplicate(s)" : n.code === "card_repayment_counted" ? "credit-card repayment(s) counted as spending" : n.code === "possible_transfer_pair" ? "possible transfer transaction(s)" : "refund(s) counted as income"}`);
  d.answer = `${open.length} thing${open.length === 1 ? " needs" : "s need"} your review: ${parts.join("; ")}. Until you decide, they are counted in your totals; nothing has been deleted or changed.`;
  d.summary = `${open.length} open flag(s)`;
  d.evidence = [...open.map(n => ({ ...n })), ...(applied ? [applied] : [])];
  d.confidence = "high";
  d.limitations = ["I cannot tell on my own whether a flagged pair is a real duplicate; that is your decision."];
  for (const n of open) {
    const ids = (n.transactionIds ?? []).slice(0, 50);
    if (n.code === "possible_duplicates") {
      d.proposed.push({ type: "reconcile", title: "Exclude the flagged duplicates from totals", description: "Keeps the rows in your ledger but removes them from totals. You can undo it.", procedure: "inari.reconcile", input: { transactionIds: ids, decision: "exclude_duplicate" }, requiresConfirmation: true });
      d.proposed.push({ type: "reconcile", title: "Keep them: they are separate payments", description: "Clears the warning and keeps both rows counted.", procedure: "inari.reconcile", input: { transactionIds: ids, decision: "keep_separate" }, requiresConfirmation: true });
    }
    if (n.code === "card_repayment_counted") {
      d.proposed.push({ type: "reconcile", title: "Exclude card repayments from spending", description: "Use this only if you also import the card's own spending, otherwise spending would be understated.", procedure: "inari.reconcile", input: { transactionIds: ids, decision: "exclude_card_double_count" }, requiresConfirmation: true });
    }
  }
  d.nextActions = ["Review the listed transactions, then confirm one of the proposed actions."];
  return d;
}

function balances(w: World, fb: FactBook, ctx: AdvisorContext): Draft {
  const d = base(ctx);
  const b = w.model.snapshot.balances;
  const parts: string[] = [];
  const known: Array<[string, number | null]> = [["emergency fund", b.emergencyFund], ["investments", b.investments], ["credit-card balance owed", b.creditCardDebt]];
  for (const [name, v] of known) parts.push(v === null ? `${name}: not provided` : `${name}: ${fb.r(v)} (as you told me)`);
  d.answer = `Balances cannot be worked out from transactions, so I only use what you entered. ${parts.join("; ")}.`;
  d.summary = "Balances come only from what you entered";
  d.confidence = "high";
  d.limitations = known.filter(([, v]) => v === null).map(([n]) => `Your ${n} is not provided, so I will not guess it.`);
  if (known.some(([, v]) => v === null)) {
    d.proposed = [{ type: "set_balances", title: "Add your balances", description: "Enter the balances you know. Leave the rest empty.", procedure: "inari.setBalances", input: { emergencyFund: b.emergencyFund, investments: b.investments, creditCardDebt: b.creditCardDebt }, requiresConfirmation: true, inputComplete: false, missingFields: known.filter(([, v]) => v === null).map(([n]) => n) }];
  }
  return d;
}

function correction(w: World, intent: IntentAnalysis, ctx: AdvisorContext): Draft {
  const d = base({ ...ctx, intent: "category_correction", category: intent.category, merchant: intent.merchant });
  if (!intent.category || !intent.merchant) return clarify(d.context, "Which merchant should move, and to which category?");
  const rows = w.live.filter(t => (t.merchant ?? "").toLowerCase().includes(intent.merchant!.toLowerCase()));
  if (rows.length === 0) {
    d.answer = `I could not find any transactions for ${intent.merchant}, so there is nothing to recategorize.`;
    d.summary = "No matching transactions";
    return d;
  }
  const latest = [...rows].sort((a, b) => (a.postedOn < b.postedOn ? 1 : -1))[0];
  d.answer = `I found ${rows.length} transaction${rows.length === 1 ? "" : "s"} for ${intent.merchant}, currently under ${label(latest.category)}. I have not changed anything. Confirm below to move them to ${label(intent.category)}.`;
  d.summary = `Recategorize ${intent.merchant} to ${label(intent.category)}?`;
  d.evidence = [{ code: "matching_transactions", severity: "info", message: `${rows.length} transaction(s) for ${intent.merchant}.`, transactionIds: topIds(rows) }];
  d.proposed = [{ type: "correct_category", title: `Move ${intent.merchant} to ${label(intent.category)}`, description: "Applies to this merchant's transactions and remembers the choice. Needs your confirmation.", procedure: "inari.correctCategory", input: { transactionId: latest.id, category: intent.category, applyToMerchant: true }, requiresConfirmation: true }];
  d.confidence = rows.length > 0 ? "medium" : "low";
  return d;
}

async function monthlyReview(w: World, intent: IntentAnalysis, fb: FactBook, ctx: AdvisorContext, previous: AdvisorContext | undefined): Promise<Draft> {
  const { month } = resolveMonth(w, intent, previous);
  const d = base({ ...ctx, intent: "monthly_review", month });
  if (!month) return noData(d.context, true);
  const r = await monthlyReportFor(w.ownerKey, month, w.now);
  if (r.status !== "ok") {
    d.answer = r.dataQuality[0]?.message ?? "No report is available for that month.";
    d.summary = "No report for that month";
    return d;
  }
  d.answer = `${r.narrative.headline} ` + (r.actions[0] ? `The main thing to look at: ${r.actions[0].title.toLowerCase()}. ${r.actions[0].reason}` : "Nothing stands out.");
  // the report's own text is already guarded against its own facts; register those figures for this guard pass
  const reg = [r.totals.income, r.totals.expenses, r.totals.savings, Math.abs(r.totals.savings)];
  fb.amounts.push(...reg, ...r.categories.flatMap(c => [c.amount, c.previousMonthAmount ?? 0]), ...r.actions.flatMap(a => a.expectedImpactInr ?? []), ...(r.drift?.items.flatMap(i => [i.amount, i.baselineAverage]) ?? []), r.subscriptions.monthlyTotal);
  fb.amounts.push(...Array.from(r.narrative.body.matchAll(/₹([\d,]+)/g)).map(m => Number(m[1].replace(/,/g, ""))), ...Array.from(r.actions.map(a => a.reason).join(" ").matchAll(/₹([\d,]+)/g)).map(m => Number(m[1].replace(/,/g, ""))));
  fb.percents.push(r.totals.savingsRate, ...(r.previousMonth ? [r.previousMonth.savingsRate] : []), ...r.categories.flatMap(c => [c.sharePercent, Math.abs(c.changePercent ?? 0)]), ...(r.drift?.items.map(i => Math.abs(i.changePercent ?? 0)) ?? []));
  d.summary = r.narrative.headline;
  d.metrics = [{ label: "Income", value: inr(r.totals.income) }, { label: "Expenses", value: inr(r.totals.expenses) }, { label: "Savings rate", value: pct(r.totals.savingsRate) }];
  d.evidence = [...r.actions.map(a => ({ code: "report_action", severity: "info" as const, message: a.title, transactionIds: a.evidenceTransactionIds })), ...r.dataQuality.filter(n => n.severity === "warning")];
  d.limitations = [...(r.period?.reason ? [r.period.reason] : []), ...r.unknowns!.map(u => `${u} was not provided, so it is not in this review.`)];
  d.assumptions = ["Figures come from your imported transactions for that calendar month."];
  d.confidence = r.period?.partial ? "medium" : "high";
  d.nextActions = r.actions.slice(0, 2).map(a => a.title);
  d.followUps = ["Are there any flagged transactions?"];
  return d;
}

async function goalsDraft(ownerKey: string, fb: FactBook, ctx: AdvisorContext, now: Date, surplus: number | null): Promise<Draft> {
  const d = base({ ...ctx, intent: "goal_progress" });
  const items = await listGoalsFor(ownerKey, now);
  d.confidence = "high";
  d.limitations = ["Goal balances and contributions are what you entered. They are never worked out from your transactions."];
  d.assumptions = ["Completion dates divide what is left by your monthly contribution, with no returns or interest."];
  if (items.length === 0) {
    d.answer = "You have not added any savings goals yet, so there is no progress to report. Add a goal with its target, what you have saved so far and what you set aside each month.";
    d.summary = "No goals yet";
    d.nextActions = ["Add a savings goal."];
    return d;
  }
  const lines = items.map(g => {
    const head = `${g.name}: ${fb.r(g.currentAmount)} of ${fb.r(g.targetAmount)} (${fb.p(g.progressPercent)})`;
    if (g.status === "completed") return `${head}, target reached.`;
    if (g.monthlyContribution && g.projectedCompletion) {
      const need = g.requiredMonthly ? `; the deadline needs about ${fb.r(g.requiredMonthly)} a month` : "";
      return `${head}; at ${fb.r(g.monthlyContribution)} a month it completes around ${g.projectedCompletion}${need}.`;
    }
    return `${head}; no monthly contribution is set, so I cannot project a date.`;
  });
  d.answer = lines.join(" ");
  d.summary = `${items.length} goal${items.length === 1 ? "" : "s"} tracked`;
  d.insights = items.filter(g => g.status === "behind").map(g => `${g.name} is behind: the monthly contribution is below what the deadline needs.`);
  const total = items.filter(g => g.status !== "completed").reduce((sum, g) => sum + (g.monthlyContribution ?? 0), 0);
  d.metrics = [{ label: "Monthly goal contributions", value: fb.r(total) }];
  if (surplus !== null && total > Math.max(0, surplus)) d.insights.push(`Your goal contributions of ${fb.r(total)} a month are more than your monthly surplus of ${fb.r(Math.max(0, surplus))}.`);
  if (surplus === null) d.limitations.push("I cannot check affordability until a complete month of transactions is imported.");
  d.nextActions = ["To test a different monthly amount, run a goal contribution what-if with the simulator."];
  return d;
}

// ---------- refund watch, reimbursements, EMI and manual entries ----------
const WORD_NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, eighteen: 18, "twenty four": 24, twenty: 20, thirty: 30 };
const numberOf = (w: string) => (/^\d+$/.test(w) ? Number(w) : (WORD_NUMBERS[w.toLowerCase()] ?? null));
const NUM_WORD = "(\\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve|eighteen|twenty four|twenty|thirty)";

function rupeeAmounts(text: string): number[] {
  const out: number[] = [];
  const re = /(?:₹|\brs\.?\s*|\binr\s*)\s*([\d,]+(?:\.\d{1,2})?)\s*(k\b)?|\b(\d[\d,]*(?:\.\d{1,2})?)\s*(k\b|rupees\b)/gi;
  for (const m of Array.from(text.matchAll(re))) {
    const n = Number((m[1] ?? m[3]).replace(/,/g, ""));
    if (Number.isFinite(n) && n > 0) out.push(m[2] || /^k/i.test(m[4] ?? "") ? n * 1000 : n);
  }
  return out;
}
const monthsIn = (text: string) => {
  const m = new RegExp(`\\b${NUM_WORD}[- ]?(?:months?|mo)\\b`, "i").exec(text);
  return m ? numberOf(m[1].toLowerCase()) : null;
};
const daysIn = (text: string) => {
  const m = new RegExp(`\\b${NUM_WORD}\\s+days?\\b`, "i").exec(text);
  return m ? numberOf(m[1].toLowerCase()) : null;
};
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

type NoveltyKind = "refund_status" | "reimbursement_status" | "emi_check" | "manual_entry";
function noveltyKind(question: string, previous?: AdvisorContext): NoveltyKind | null {
  const q = question.toLowerCase();
  const amounts = rupeeAmounts(question);
  if (/\b(emi|no[- ]?cost|instal+ments?|installments?)\b/.test(q) || (previous?.intent === "emi_check" && amounts.length > 0 && !question.trim().endsWith("?"))) return "emi_check";
  if (/\brefunds?\b/.test(q) || /\bi returned\b/.test(q)) return "refund_status";
  if (/\b(owe|owes|owed|reimburse\w*|paid for (my )?(friends?|colleagues?|family))\b/.test(q) || /\b(belongs? to|share of) (my )?friends?\b/.test(q)) return "reimbursement_status";
  if (/^\s*(i|we)\b/i.test(question) && /\b(spent|paid|bought|gave|received|got|earned)\b/.test(q) && amounts.length > 0 && !question.includes("?")) return "manual_entry";
  return null;
}

async function noveltyDraft(kind: NoveltyKind, ownerKey: string, question: string, fb: FactBook, ctx0: AdvisorContext, previous: AdvisorContext | undefined, now: Date): Promise<Draft> {
  const ctx: AdvisorContext = { ...ctx0, intent: kind };
  const d = base(ctx);
  d.confidence = "high";
  const amounts = rupeeAmounts(question);

  if (kind === "emi_check") {
    const carried = previous?.intent === "emi_check" && previous.amount ? previous.amount : null;
    const months = monthsIn(question);
    const price = carried ?? amounts[0] ?? null;
    const monthly = carried ? (amounts[0] ?? null) : (amounts.find((a, i) => i > 0 && price !== null && a < price) ?? null);
    ctx.amount = price;
    const need = [price === null ? "the cash price" : null, months === null ? "the number of months" : null, monthly === null ? "the monthly instalment" : null].filter(Boolean) as string[];
    if (need.length) {
      d.answer = `To compare the EMI with paying upfront I need ${need.join(", ")}. Also tell me about any processing fee, taxes, or a discount you only get when paying upfront; I will not assume them.`;
      d.summary = "Need the EMI terms";
      d.confidence = "medium";
      d.limitations = ["No interest rate, fee or tax is assumed: the comparison uses only the terms you give."];
      d.followUps = ["The phone costs ₹40,000 upfront, or ₹6,700 a month for 6 months with a processing fee of ₹500."];
      const input: Record<string, unknown> = { ...(price ? { cashPrice: price } : {}), ...(months ? { months } : {}), ...(monthly ? { emiMonthly: monthly } : {}) };
      const missingFields = ["cashPrice", "emiMonthly", "months"].filter(f => !(f in input));
      d.proposed = [{ type: "emi_check", title: "Run the EMI comparison", description: "Compares total payable and monthly impact. Creates no debt or transaction.", procedure: "inari.emiCheck", input, requiresConfirmation: true, inputComplete: false, missingFields }];
      return d;
    }
    const fee = /processing fees?\s*(?:of|is|:)?\s*(?:₹|rs\.?\s*)?([\d,]+)/i.exec(question);
    const tax = /(?:taxes|gst)\s*(?:of|is|:)?\s*(?:₹|rs\.?\s*)?([\d,]+)/i.exec(question);
    const r = await emiCheckFor(ownerKey, {
      cashPrice: price!, emiMonthly: monthly!, months: months!,
      ...(fee ? { processingFee: Number(fee[1].replace(/,/g, "")) } : {}), ...(tax ? { taxes: Number(tax[1].replace(/,/g, "")) } : {}),
    });
    const extra = r.extraCostOfEmiPaise;
    const verdict = extra > 0 ? `On these terms the EMI costs ${fb.r(extra / 100)} more than paying upfront, so it is not really "no cost".` : extra === 0 ? "On these terms the EMI costs the same as paying upfront." : `On these terms the EMI costs ${fb.r(-extra / 100)} less than paying upfront.`;
    d.answer = `${verdict} Paying upfront is ${fb.r(r.totalPayableUpfrontPaise / 100)}; the EMI plan totals ${fb.r(r.totalPayableEmiPaise / 100)} over ${months} months (${fb.r(r.monthlyCommitmentPaise / 100)} a month).${r.surplusAfterEmiPaise !== null ? ` Your monthly surplus would go from ${fb.r((r.monthlySurplusPaise ?? 0) / 100)} to ${fb.r(r.surplusAfterEmiPaise / 100)} while it runs.` : ""}`;
    d.summary = r.isReallyNoCost ? "EMI costs no more on these terms" : "EMI costs more than paying upfront";
    d.metrics = r.breakdown.map(b => ({ label: b.label, value: fb.r(b.paise / 100) }));
    d.assumptions = r.assumptions;
    d.limitations = r.missingTerms.length ? [`Not provided and counted as zero: ${r.missingTerms.join("; ")}.`] : [];
    d.insights = r.warnings;
    d.evidence = [{ code: "emi_comparison", severity: "info", message: "Computed from the terms in your question; nothing was created or saved." }];
    return d;
  }

  if (kind === "manual_entry") {
    const p = await manualEntryPreviewFor(ownerKey, { text: question }, now);
    if (p.needsUserInput.length) {
      d.answer = `I can add that as a manual entry, but I still need ${p.needsUserInput.map(f => (f === "amount" ? "the amount" : "whether it was money spent or received")).join(" and ")}.`;
      d.summary = "Need more detail for the manual entry";
      d.confidence = "medium";
      return d;
    }
    const e = p.entry;
    d.answer = `I can record a ${e.direction === "debit" ? "spend" : "receipt"} of ${fb.r((e.amountPaise ?? 0) / 100)} (${e.paymentType}) under ${(e.category ?? "other").replace(/_/g, " ")} dated ${e.postedOn}. Nothing is added until you confirm.`;
    d.summary = "Manual entry ready to confirm";
    d.assumptions = p.assumptions;
    d.limitations = ["Manual entries are marked as user-entered; I cannot verify them against a statement."];
    d.evidence = [{ code: "manual_entry_preview", severity: "info", message: "Preview only; the ledger has not changed." }];
    d.proposed = [{ type: "manual_entry", title: "Add this entry", description: "Adds one user-confirmed transaction to your ledger. You can undo it.", procedure: "inari.manualEntryCommit", input: { previewId: p.previewId }, requiresConfirmation: true, inputComplete: false, missingFields: ["idempotencyKey"] }];
    return d;
  }

  const wanted = kind === "refund_status" ? "refund" : "reimbursement";
  const list = await listClaimsFor(ownerKey, wanted, now);
  const open = list.items.filter(c => c.status !== "cancelled" && c.status !== "received");
  const creating = amounts.length > 0 && open.length === 0 && (kind === "refund_status" ? /\b(returned|should arrive|will arrive|promised|expect)/i.test(question) : /\b(owe|owes|belongs?|paid for)/i.test(question));
  if (creating) {
    const amount = amounts[0];
    const debits = (await getLedgerRepository().listTransactions(ownerKey)).filter(t => t.direction === "debit" && (wanted === "refund" ? t.amountPaise === Math.round(amount * 100) : t.amountPaise > Math.round(amount * 100)));
    const days = daysIn(question);
    const input: Record<string, unknown> = { kind: wanted, expectedAmount: amount, ...(wanted === "refund" && days ? { expectedDate: isoDay(new Date(now.getTime() + days * 86_400_000)) } : {}) };
    const exact = debits.length === 1;
    if (exact) input.transactionId = debits[0].id;
    d.answer = exact
      ? `I found one payment that fits (${debits[0].narration}, ${fb.r(debits[0].amountPaise / 100)} on ${debits[0].postedOn}). I can track ${fb.r(amount)} as an expected ${wanted}. It is not counted as money received until a matching credit arrives and you confirm it.`
      : `I can track ${fb.r(amount)} as an expected ${wanted}, but I need to know which payment it relates to${debits.length > 1 ? ` (${debits.length} payments could fit)` : ""}. It is not counted as money received.`;
    d.summary = `Track an expected ${wanted}`;
    d.confidence = exact ? "high" : "medium";
    d.limitations = [`An expected ${wanted} is never counted as cash.`];
    d.proposed = [{ type: "create_claim", title: `Track this ${wanted}`, description: "Creates a claim linked to an existing payment. It changes no totals.", procedure: "inari.createClaim", input, requiresConfirmation: true, inputComplete: exact, ...(exact ? {} : { missingFields: ["transactionId"] }) }];
    return d;
  }
  if (open.length === 0) {
    d.answer = list.items.length > 0
      ? `All tracked ${wanted}s are received or cancelled, so nothing is outstanding.`
      : `I am not tracking any ${wanted}s yet. Tell me the amount and which payment it relates to and I can start tracking it. It will not count as money received until you confirm a matching credit.`;
    d.summary = `No open ${wanted}s`;
    return d;
  }
  const lines: string[] = [];
  for (const c of open) {
    const who = c.counterparty ?? c.original?.merchant ?? c.original?.narration ?? "a payment";
    lines.push(`${who}: ${fb.r(c.outstandingAmountPaise / 100)} still ${wanted === "refund" ? "expected" : "owed"} (${c.status.replace("_", " ")}${c.expectedDate ? `, due ${c.expectedDate}` : ""}).`);
    const top = (await claimMatchesFor(ownerKey, c.id, now)).suggestions[0];
    if (top) {
      lines.push(`A possible match is a credit of ${fb.r(top.amountPaise / 100)} on ${top.postedOn}${top.ambiguous ? " (not certain)" : ""}; I need your confirmation before treating it as the ${wanted}.`);
      d.proposed.push({ type: "confirm_claim_match", title: `Confirm that credit as the ${wanted}`, description: "Links the credit to the claim. You can undo it.", procedure: "inari.confirmClaimMatch", input: { claimId: c.id, creditTransactionId: top.creditTransactionId }, requiresConfirmation: true, inputComplete: true });
    }
  }
  d.answer = lines.join(" ");
  d.summary = wanted === "refund" ? `${open.length} refund${open.length === 1 ? "" : "s"} not yet received` : `${fb.r(list.summary.outstandingReimbursementPaise / 100)} outstanding from others`;
  d.metrics = wanted === "refund"
    ? [{ label: "Refunds expected (not cash)", value: fb.r(list.summary.pendingRefundPaise / 100) }]
    : [{ label: "Outstanding reimbursements (not cash)", value: fb.r(list.summary.outstandingReimbursementPaise / 100) }, { label: "Your personal share of those payments", value: fb.r(list.summary.personalShareOfReimbursablePaise / 100) }];
  d.limitations = [`Expected ${wanted}s are not counted as received money.`];
  d.evidence = [{ code: "claims", severity: "info", message: `${open.length} open ${wanted} claim(s).` }];
  return d;
}

function unknownTopic(ctx: AdvisorContext): Draft {
  const d = base(ctx);
  d.answer = "I can answer questions about your own imported transactions: spending by category or merchant, recurring payments, monthly reviews, flagged transactions, and what-if changes.";
  d.summary = "Outside what I can answer";
  d.limitations = ["I do not answer general or market questions."];
  d.followUps = CAPABILITIES;
  d.confidence = "low";
  return d;
}

// ---------- main ----------
export async function askAdvisorFor(
  ownerKey: string,
  input: { question: string; previous?: AdvisorContext },
  now: Date = new Date()
): Promise<InariAdvisorResponse> {
  const question = input.question;
  const previous = input.previous;
  let intent = analyzeIntentText(question, previous ? { intent: previous.intent, amount: previous.amount, category: previous.category } : undefined);
  // "what about 40% instead?" after a what-if: keep the same category, change the percentage
  if (previous?.intent === "what_if" && previous.category && intent.intent === "clarification_followup" && intent.percent !== null && intent.percent >= 1 && intent.percent <= 100) {
    intent = {
      ...intent,
      intent: "what_if",
      category: previous.category,
      scenario: { type: "reduce_category", category: previous.category, percent: intent.percent },
      needsClarification: false,
      clarificationQuestion: null,
    };
  }
  const ctx0: AdvisorContext = { intent: intent.intent, amount: intent.amount, category: intent.category, month: previous?.month ?? null, merchant: intent.merchant };
  const fb = new FactBook();

  const model = await loadImportedModel(ownerKey);
  let draft: Draft;
  if (intent.intent === "unsafe_request" || isProhibitedAdviceRequest(question)) {
    draft = refusal(ctx0);
  } else if (intent.intent === "goal_progress" || (intent.intent === "unknown" && /\b(my goals?|savings? goals?|savings? targets?)\b/i.test(question))) {
    const m = model?.metrics ?? null;
    draft = await goalsDraft(ownerKey, fb, ctx0, now, m ? m.monthlyIncome - m.monthlyExpenses : null);
  } else if (noveltyKind(question, previous)) {
    draft = await noveltyDraft(noveltyKind(question, previous)!, ownerKey, question, fb, ctx0, previous, now);
  } else if (!model) {
    draft = noData(ctx0, false);
  } else {
    const repo = getLedgerRepository();
    const [all, batches] = await Promise.all([repo.listTransactions(ownerKey), repo.listBatches(ownerKey)]);
    const w: World = { model, all, live: all.filter(t => !isExcluded(t)), batches, now, nowYm: now.toISOString().slice(0, 7), ownerKey };
    const q = question.toLowerCase();
    const isFollowUp = !!previous && (intent.intent === "unknown" || intent.intent === "clarification_followup");
    if (model.metrics === null) draft = noData(ctx0, true);
    else if (intent.needsClarification && intent.intent === "what_if") draft = clarify(ctx0, intent.clarificationQuestion ?? "What change should I test?");
    else if (/\b(duplicate|double[- ]?count|flagged|reconcil|card repayment|needs review)/.test(q)) draft = reconciliation(w, fb, ctx0);
    else if (/\b(emergency fund|my investments?|credit card (debt|balance)|balances?)\b/.test(q) && intent.intent !== "what_if") draft = balances(w, fb, ctx0);
    else if (intent.intent === "what_if") draft = whatIf(w, intent, fb, ctx0);
    else if (intent.intent === "subscription_query" || (/\b(cancel|am i paying|do i pay|subscription|recurring)\b/.test(q) && intent.merchant)) draft = subscriptions(w, intent, question, fb, ctx0);
    else if (intent.intent === "category_explanation") draft = await explainCategory(w, intent, fb, ctx0, previous, now);
    else if (intent.intent === "category_correction") draft = correction(w, intent, ctx0);
    else if (intent.intent === "monthly_review" || (/\b(report|review|recap)\b/.test(q) && intent.intent === "unknown")) draft = await monthlyReview(w, intent, fb, ctx0, previous);
    else if (intent.intent === "spending_question" || (isFollowUp && previous?.intent === "spending_question")) draft = spending(w, intent, previous, fb, ctx0, question);
    else if (/\b(savings rate|income|salary|surplus|how am i doing|overview|financial health|snapshot|how much do i (earn|save))\b/.test(q)) draft = overview(w, fb, ctx0);
    else draft = unknownTopic(ctx0);
  }

  // ---- guardrails on every piece of generated text ----
  const reasons: string[] = [...(draft.refused ?? [])];
  let status: GuardrailStatus = draft.refused ? "refused" : "passed";
  const guard = (text: string, fallback: string) => {
    const g = guardText(text, fallback, fb.facts);
    if (g.status !== "passed") {
      reasons.push(...g.reasons);
      status = status === "refused" || g.status === "refused" ? "refused" : "modified";
    }
    return g.text;
  };
  const answer = draft.refused ? draft.answer : guard(draft.answer, "I could not produce a verified answer to that. Please open the monthly report for the exact figures.");
  const summary = draft.refused ? draft.summary : guard(draft.summary, "See the figures below.");
  const clean = (xs: string[]) => xs.map(x => (draft.refused ? x : guard(x, ""))).filter(Boolean);

  return {
    implementation: "implemented",
    answer,
    summary,
    keyInsights: clean(draft.insights),
    suggestedNextActions: clean(draft.nextActions),
    followUpQuestions: draft.followUps,
    relatedMetrics: draft.metrics,
    confidenceLevel: status === "passed" ? draft.confidence : "low",
    mode: "fallback",
    disclaimer: EDUCATIONAL_DISCLAIMER,
    dataSource: model ? "imported" : "demo",
    dataAsOf: model?.snapshot.dataAsOf ?? null,
    guardrail: { status, reasons: Array.from(new Set(reasons)) },
    intent,
    simulation: draft.simulation,
    evidence: draft.evidence,
    assumptions: draft.assumptions,
    limitations: draft.limitations,
    proposedActions: draft.proposed.map(a => ({ inputComplete: true, ...a })),
    context: draft.context,
    engine: { kind: "deterministic", llmUsed: false, model: null },
  };
}
