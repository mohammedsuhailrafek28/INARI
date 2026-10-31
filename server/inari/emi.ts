/**
 * No-cost EMI reality check. Pure arithmetic on the terms the user typed, in integer paise.
 * Nothing is invented: a fee, tax or discount that was not given is listed under `missingTerms` and counted as 0.
 * The result is hypothetical: no ledger transaction, debt or goal is created or changed.
 */
import type { EmiCheckOutput } from "../../shared/inari/contracts";
import { loadImportedModel } from "./importedModel";

type EmiInput = {
  cashPrice: number; emiMonthly: number; months: number; downPayment?: number; processingFee?: number;
  taxes?: number; upfrontDiscount?: number; discountBoth?: number;
};
const p = (rupees: number | undefined) => Math.round((rupees ?? 0) * 100);
const inr = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export async function emiCheckFor(userKey: string, input: EmiInput): Promise<EmiCheckOutput> {
  const price = p(input.cashPrice), monthly = p(input.emiMonthly), down = p(input.downPayment);
  const fee = p(input.processingFee), taxes = p(input.taxes), upfrontDiscount = p(input.upfrontDiscount), both = p(input.discountBoth);
  const installments = monthly * input.months;
  const emiTotal = down + installments + fee + taxes;
  const upfrontTotal = price - both - upfrontDiscount;
  const extra = emiTotal - upfrontTotal;

  const model = await loadImportedModel(userKey);
  const m = model?.metrics ?? null;
  const surplus = m ? p(m.monthlyIncome) - p(m.monthlyExpenses) : null;
  const surplusAfter = surplus === null ? null : surplus - monthly;

  const missingTerms: string[] = [];
  if (input.processingFee === undefined) missingTerms.push("processing fee");
  if (input.taxes === undefined) missingTerms.push("taxes (for example GST on interest or the fee)");
  if (input.upfrontDiscount === undefined) missingTerms.push("any discount or cashback you only get by paying upfront");
  const warnings: string[] = [];
  if (surplusAfter !== null && surplusAfter < 0) warnings.push(`The instalment of ${inr(monthly)} is more than your monthly surplus of ${inr(Math.max(0, surplus ?? 0))} from imported data.`);
  if (surplus === null) warnings.push("Import a complete month of transactions to see the effect on your monthly surplus.");
  if (missingTerms.length) warnings.push("Terms you did not enter were counted as zero, not assumed free. Confirm them with the seller before deciding.");

  const percent = price > 0 ? Math.round((extra / upfrontTotal) * 10_000) / 100 : 0;
  const verdict =
    extra > 0
      ? `On these terms the EMI costs ${inr(extra)} more than paying upfront (${percent}% of the upfront price), so it is not really "no cost".`
      : extra === 0
        ? "On these terms the EMI costs the same as paying upfront. Check that every fee, tax and lost discount is listed."
        : `On these terms the EMI costs ${inr(-extra)} less than paying upfront.`;

  const breakdown = [
    { label: "Down payment", paise: down },
    { label: `Instalments (${input.months} x ${inr(monthly)})`, paise: installments },
    { label: "Processing fee", paise: fee },
    { label: "Taxes", paise: taxes },
    { label: "Total payable on EMI", paise: emiTotal },
    { label: "Total payable upfront (after discounts)", paise: upfrontTotal },
  ];
  return {
    implementation: "implemented",
    totalPayableEmiPaise: emiTotal, totalPayableUpfrontPaise: upfrontTotal, extraCostOfEmiPaise: extra, extraCostPercentOfCash: percent,
    isReallyNoCost: extra <= 0, monthlyCommitmentPaise: monthly, cashLeftAfterUpfrontPurchasePaise: null,
    monthlySurplusPaise: surplus, surplusAfterEmiPaise: surplusAfter, breakdown, verdict, missingTerms,
    assumptions: [
      "Totals use only the amounts you entered; no interest rate is assumed or computed.",
      "A discount that applies to both options is assumed to be already reflected in your instalment amounts.",
      "This is a comparison only. It does not create a debt, a goal or any transaction.",
      "Cash left after an upfront purchase is not shown because your bank balance is not known.",
    ],
    warnings, createsNoDebt: true,
  };
}
