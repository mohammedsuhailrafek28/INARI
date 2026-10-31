/**
 * Deterministic recurring-payment (subscription) detection from the ledger.
 *
 * Nothing here is stored: subscriptions are re-derived from transactions on every call, so they always agree
 * with the ledger. Only the user's confirm/dismiss decisions are persisted (in the profile).
 *
 * What counts: repeated expense debits to the same merchant with a regular gap (weekly / monthly / quarterly /
 * yearly) and a steady amount. Rent, EMI, transfers, investments, savings and cash are NOT subscriptions.
 * Variable bills (utilities with changing amounts) are excluded unless categorised as subscriptions.
 */
import { createHash } from "node:crypto";
import type { Category, LedgerTransaction, Subscription } from "../../shared/inari/contracts";
import { merchantKey } from "./categorize";

export type SubscriptionDecision = "confirmed" | "dismissed";
export type DetectedSubscription = Subscription & { category: Category; monthlyEquivalentPaise: number };

const EXCLUDED: ReadonlySet<Category> = new Set<Category>(["rent", "emi", "transfer", "investment", "savings", "cash", "salary", "other_income"]);
const CADENCES = [
  { name: "weekly" as const, days: 7, tol: 1, perYear: 52, months: 0 },
  { name: "monthly" as const, days: 30, tol: 4, perYear: 12, months: 1 },
  { name: "quarterly" as const, days: 91, tol: 6, perYear: 4, months: 3 },
  { name: "yearly" as const, days: 365, tol: 10, perYear: 1, months: 12 },
];
const AMOUNT_STABLE = 0.1; // within 10% of the median
const AMOUNT_BILL_LIMIT = 0.25; // beyond this, only an explicit "subscription" category qualifies

const dayNum = (iso: string) => Math.floor(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86_400_000);
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};

function addMonths(iso: string, months: number): string {
  const y = +iso.slice(0, 4);
  const m = +iso.slice(5, 7) - 1 + months;
  const d = +iso.slice(8, 10);
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d, last))).toISOString().slice(0, 10);
}
const addDays = (iso: string, days: number) => new Date((dayNum(iso) + days) * 86_400_000).toISOString().slice(0, 10);

export function subscriptionId(key: string) {
  return `sub_${createHash("sha256").update(key).digest("hex").slice(0, 16)}`;
}

export function detectSubscriptions(
  transactions: LedgerTransaction[],
  decisions: Readonly<Record<string, SubscriptionDecision>> = {}
): DetectedSubscription[] {
  const spend = transactions.filter(t => t.direction === "debit" && !t.isTransfer && !EXCLUDED.has(t.category));
  if (spend.length === 0) return [];
  const asOf = transactions.reduce((max, t) => (t.postedOn > max ? t.postedOn : max), "0000-00-00");

  const groups = new Map<string, LedgerTransaction[]>();
  for (const t of spend) {
    const key = merchantKey(t.merchant ?? t.narration);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }

  const out: DetectedSubscription[] = [];
  for (const [key, all] of Array.from(groups.entries())) {
    const txs = [...all].sort((a, b) => (a.postedOn < b.postedOn ? -1 : a.postedOn > b.postedOn ? 1 : a.id < b.id ? -1 : 1));
    if (txs.length < 2) continue;

    // collapse same-day repeats into one cycle but remember them: two charges in one cycle is a possible double charge
    const gaps = txs.slice(1).map((t, i) => dayNum(t.postedOn) - dayNum(txs[i].postedOn));
    const cycleGaps = gaps.filter(g => g >= 5);
    if (cycleGaps.length === 0) continue;
    const typicalGap = median(cycleGaps);
    const cadence = CADENCES.find(c => Math.abs(typicalGap - c.days) <= c.tol);
    if (!cadence) continue;
    const regular = cycleGaps.filter(g => Math.abs(g - cadence.days) <= cadence.tol + 2).length / cycleGaps.length;
    const minCharges = cadence.name === "yearly" ? 2 : 3;
    if (txs.length < minCharges || regular < 0.6) continue;

    const cycleTxs = txs.filter((t, i) => i === 0 || dayNum(t.postedOn) - dayNum(txs[i - 1].postedOn) >= 5);
    const amounts = cycleTxs.map(t => t.amountPaise);
    const med = median(amounts);
    const spread = Math.max(...amounts.map(a => Math.abs(a - med) / med));
    const category = cycleTxs[cycleTxs.length - 1].category;
    const steady = spread <= AMOUNT_STABLE;
    const lastTwo = amounts.slice(-2);
    const stepChange = lastTwo.length === 2 && lastTwo[0] > 0 && Math.abs(lastTwo[1] - lastTwo[0]) / lastTwo[0] <= AMOUNT_BILL_LIMIT;
    // a clean price step (steady before, one change at the end) is a price increase, not noise
    const earlier = amounts.slice(0, -1);
    const earlierMed = earlier.length ? median(earlier) : med;
    const priceStep = earlier.length >= 2 && Math.max(...earlier.map(a => Math.abs(a - earlierMed) / earlierMed)) <= AMOUNT_STABLE && lastTwo[1] > earlierMed * 1.03 && stepChange;
    if (!steady && !priceStep && !(category === "subscription" && spread <= AMOUNT_BILL_LIMIT)) continue;

    const latest = cycleTxs[cycleTxs.length - 1];
    const lastPaise = latest.amountPaise;
    const monthlyEquivalentPaise = Math.round((lastPaise * cadence.perYear) / 12);
    const nextExpectedOn = cadence.months > 0 ? addMonths(latest.postedOn, cadence.months) : addDays(latest.postedOn, cadence.days);
    const flags: Subscription["flags"] = [];
    if (priceStep) flags.push("price_increase");
    if (gaps.some(g => g < 5 && g >= 0) ) flags.push("possible_duplicate");
    if (dayNum(asOf) - dayNum(latest.postedOn) > cadence.days * 1.5 + cadence.tol) flags.push("inactive");
    if (dayNum(latest.postedOn) - dayNum(cycleTxs[0].postedOn) <= cadence.days * 2 + cadence.tol && cycleTxs.length <= 3) flags.push("new");

    const regularity = regular >= 0.95 ? 0.2 : 0.1;
    const confidence = Math.min(0.95, 0.4 + Math.min(cycleTxs.length - 2, 4) * 0.1 + regularity + (steady ? 0.2 : 0.1));
    const id = subscriptionId(key);
    const decision = decisions[id];
    const names = new Map<string, number>();
    for (const t of cycleTxs) if (t.merchant) names.set(t.merchant, (names.get(t.merchant) ?? 0) + 1);
    const merchant = Array.from(names.entries()).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0] ?? key;

    out.push({
      id,
      merchant,
      cadence: cadence.name,
      status: decision === "confirmed" ? "confirmed" : decision === "dismissed" ? "dismissed" : "possible",
      typicalAmount: lastPaise / 100,
      monthlyEquivalent: monthlyEquivalentPaise / 100,
      annualCost: Math.round(lastPaise * cadence.perYear) / 100,
      lastChargedOn: latest.postedOn,
      nextExpectedOn,
      occurrences: cycleTxs.length,
      confidence: Math.round(confidence * 100) / 100,
      evidenceTransactionIds: txs.slice(-12).map(t => t.id),
      flags,
      priceChange: priceStep ? { from: earlierMed / 100, to: lastPaise / 100 } : null,
      category,
      monthlyEquivalentPaise,
    });
  }
  return out.sort((a, b) => b.monthlyEquivalentPaise - a.monthlyEquivalentPaise || (a.merchant < b.merchant ? -1 : 1));
}

/** Active = counts toward totals: not dismissed and not inactive. */
export const isActiveSubscription = (s: Subscription) => s.status !== "dismissed" && !s.flags.includes("inactive");
