/**
 * Deterministic what-if simulator. Pure arithmetic on the ledger-derived model, in integer paise.
 * It never reads or writes the ledger beyond the already-derived averages (`ledgerUnchanged` is always true),
 * and uses no randomness, returns, interest, inflation or salary growth.
 */
import type { Scenario, SimulationResult } from "../../shared/inari/contracts";
import { EDUCATIONAL_DISCLAIMER } from "../wealth/types";
import { InariError } from "./errors";
import type { ImportedModel } from "./importedModel";

type Metric = SimulationResult["metrics"][number];
const MAX_RUPEES = 1_000_000_000;

const toPaise = (rupees: number) => Math.round(rupees * 100);
const rupees = (paise: number) => Math.round(paise) / 100;
const round2 = (n: number) => Math.round(n * 100) / 100;
const metric = (label: string, baseline: number | null, scenario: number | null, unit: Metric["unit"]): Metric => ({
  label,
  baseline,
  scenario,
  delta: baseline === null || scenario === null ? null : round2(scenario - baseline),
  unit,
});
const rate = (income: number, expenses: number) => (income > 0 ? round2(((income - expenses) / income) * 100) : null);

const BASE_ASSUMPTIONS = [
  "Steady state: every month repeats your recent average. No investment returns, interest, inflation or salary growth are assumed.",
  "Nothing is saved or changed in your data by running a simulation.",
];

/** Quality notes that change how far the baseline can be trusted; carried into every result as evidence. */
const EVIDENCE_CODES = new Set([
  "card_repayment_counted", "possible_duplicates", "possible_transfer_pair", "refund_counted_as_income",
  "partial_months", "gap_months", "unclassified", "assumption_averaging",
]);

export function runSimulation(requested: Scenario[], model: ImportedModel | undefined): SimulationResult {
  for (const s of requested) validateScenario(s);
  // An identical scenario repeated in one request is applied once, never twice.
  const seen = new Set<string>();
  const scenarios = requested.filter(s => {
    const key = JSON.stringify(s);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const dedupeWarning = scenarios.length < requested.length ? [`${requested.length - scenarios.length} identical repeated change(s) were applied only once.`] : [];
  const evidence = (model?.snapshot.dataQuality ?? []).filter(n => EVIDENCE_CODES.has(n.code));

  const m = model?.metrics ?? null;
  if (!model || !m) {
    return {
      implementation: "implemented",
      scenarios,
      status: "insufficient_data",
      metrics: [],
      goals: [],
      assumptions: BASE_ASSUMPTIONS,
      warnings: [
        model
          ? "No complete month of data yet. Import a statement that covers a full calendar month to run simulations."
          : "No imported data yet. Import a bank statement (CSV) to run simulations on your own numbers.",
        ...dedupeWarning,
      ],
      evidence,
      ledgerUnchanged: true,
      disclaimer: EDUCATIONAL_DISCLAIMER,
    };
  }

  const income0 = toPaise(m.monthlyIncome);
  const expenses0 = toPaise(m.monthlyExpenses);
  const category = new Map<string, number>(Object.entries(model.spendingBreakdown).map(([k, v]) => [k, toPaise(v)]));
  const cut = new Map<string, number>();
  const warnings: string[] = [...dedupeWarning];
  const assumptions = [...BASE_ASSUMPTIONS, `Baseline is the average of ${model.breakdownMonths.length} month(s): ${model.breakdownMonths.join(", ")}.`];

  let income = income0;
  let expenses = expenses0;
  let sip = 0;
  let debtPayment = 0;
  const oneOffs: Array<{ paise: number; inMonths: number }> = [];

  for (const s of scenarios) {
    switch (s.type) {
      case "reduce_category": {
        const base = category.get(s.category) ?? 0;
        if (base === 0) {
          warnings.push(`No spending found in "${s.category}", so this change has no effect.`);
          break;
        }
        const already = cut.get(s.category) ?? 0;
        if (already > 0) warnings.push(`"${s.category}" is reduced more than once; the reductions add up (each is a share of the original spend, not compounded).`);
        const want = s.percent !== undefined ? Math.round((base * s.percent) / 100) : toPaise(s.amountPerMonth ?? 0);
        const applied = Math.min(want, base - already);
        if (want > base - already) warnings.push(`Reducing "${s.category}" was capped at its current monthly spend of ₹${rupees(base - already).toLocaleString("en-IN")}.`);
        cut.set(s.category, already + applied);
        expenses -= applied;
        break;
      }
      case "change_income": {
        const next = income + toPaise(s.deltaPerMonth);
        if (next < 0) warnings.push("Income cannot go below zero; it was set to ₹0.");
        income = Math.max(0, next);
        break;
      }
      case "one_off_expense":
        oneOffs.push({ paise: toPaise(s.amount), inMonths: s.inMonths });
        break;
      case "start_sip":
        sip += toPaise(s.amountPerMonth);
        break;
      case "pay_down_debt":
        debtPayment += toPaise(s.amountPerMonth);
        if (!m.known?.creditCardDebt) warnings.push("Your credit-card balance is not provided, so the payoff time cannot be estimated. Add it to see months to clear.");
        break;
      default:
        break;
    }
  }

  const surplus0 = income0 - expenses0;
  const surplus = income - expenses;
  const outflows = sip + debtPayment;
  const free0 = surplus0;
  const free = surplus - outflows;
  const oneOffWithin12 = oneOffs.filter(o => o.inMonths < 12).reduce((sum, o) => sum + o.paise, 0);

  const metrics: Metric[] = [
    metric("Monthly income", rupees(income0), rupees(income), "inr"),
    metric("Monthly expenses", rupees(expenses0), rupees(expenses), "inr"),
    metric("Monthly surplus", rupees(surplus0), rupees(surplus), "inr"),
    metric("Savings rate", rate(income0, expenses0), rate(income, expenses), "percent"),
  ];
  if (outflows > 0) metrics.push(metric("Free cash after SIP and debt payments", rupees(free0), rupees(free), "inr"));
  metrics.push(metric("Next 12 months: cash left over", rupees(free0 * 12), rupees(free * 12 - oneOffWithin12), "inr"));

  if (m.known?.emergencyFund) {
    const ef = toPaise(m.emergencyFundBalance);
    metrics.push(
      metric("Emergency fund covers (months of expenses)", expenses0 > 0 ? round2(ef / expenses0) : null, expenses > 0 ? round2(ef / expenses) : null, "months")
    );
  }
  if (debtPayment > 0 && m.known?.creditCardDebt) {
    const debt = toPaise(m.creditCardDebt);
    metrics.push(metric("Months to clear card balance (no interest assumed)", null, debt === 0 ? 0 : Math.ceil(debt / debtPayment), "months"));
    assumptions.push("Card payoff ignores interest, so the real payoff takes longer.");
  }

  // Explicit data-limit warnings: coverage, unknown balances, and baseline quality flags.
  const nMonths = model.breakdownMonths.length;
  if (model.snapshot.coverage.completeMonths === 0) warnings.push("No complete calendar month is covered, so these figures use the latest partial month and are rough.");
  else if (nMonths < 3) warnings.push(`The baseline rests on only ${nMonths} complete month(s) of data; more history would make it steadier.`);
  if (!m.known?.emergencyFund) warnings.push("Your emergency-fund balance is not provided, so emergency-fund cover is not shown.");
  if (!m.known?.investments && sip > 0) warnings.push("Your investment balance is not provided, so only the monthly SIP flow is modelled, not a portfolio value.");
  if (scenarios.some(s => s.type === "reduce_category" && s.category === "subscription") && (category.get("subscription") ?? 0) === 0)
    warnings.push("No subscription payments were detected in your data, so cancelling subscriptions would save nothing here.");
  const flagged = evidence.filter(n => n.severity === "warning");
  if (flagged.length > 0) warnings.push(`The baseline includes ${flagged.length} unresolved data-quality flag(s) (${flagged.map(n => n.code).join(", ")}); the results inherit them. See evidence.`);

  if (surplus < 0) warnings.push("In this scenario your expenses exceed your income.");
  else if (free < 0) warnings.push("The planned SIP and debt payments are larger than your monthly surplus.");
  if (oneOffs.length > 0) assumptions.push("One-off expenses only affect the 12-month cash figure; they do not change monthly averages.");
  if (sip > 0) assumptions.push("A SIP is treated as saving (not an expense), so it lowers free cash but not the savings rate.");

  return {
    implementation: "implemented",
    scenarios,
    status: "ok",
    metrics,
    goals: [], // goals backend is not implemented yet
    assumptions,
    warnings,
    evidence: [
      {
        code: "baseline_inputs",
        severity: "info",
        message: `Baseline: income ₹${m.monthlyIncome.toLocaleString("en-IN")}, expenses ₹${m.monthlyExpenses.toLocaleString("en-IN")} per month, averaged over ${model.breakdownMonths.join(", ")} (${model.snapshot.coverage.transactionCount} transactions).`,
      },
      ...evidence,
    ],
    ledgerUnchanged: true,
    disclaimer: EDUCATIONAL_DISCLAIMER,
  };
}

function validateScenario(s: Scenario) {
  switch (s.type) {
    case "cancel_subscriptions":
      throw new InariError("INVALID_SCENARIO", "Cancelling named subscriptions is not available yet. Use a category reduction (for example subscriptions by 100%).");
    case "change_goal_contribution":
      throw new InariError("INVALID_SCENARIO", "Goal scenarios are not available yet because goals are not implemented.");
    case "reduce_category":
      if (s.percent === undefined && s.amountPerMonth === undefined) throw new InariError("INVALID_SCENARIO", "Give a percent or an amount to reduce by.");
      if ((s.amountPerMonth ?? 0) > MAX_RUPEES) throw new InariError("INVALID_SCENARIO", "That amount is too large.");
      return;
    case "change_income":
      if (!Number.isFinite(s.deltaPerMonth) || Math.abs(s.deltaPerMonth) > MAX_RUPEES) throw new InariError("INVALID_SCENARIO", "That income change is not valid.");
      return;
    case "one_off_expense":
      if (s.amount > MAX_RUPEES) throw new InariError("INVALID_SCENARIO", "That amount is too large.");
      return;
    case "start_sip":
    case "pay_down_debt":
      if (s.amountPerMonth > MAX_RUPEES) throw new InariError("INVALID_SCENARIO", "That amount is too large.");
      return;
  }
}
