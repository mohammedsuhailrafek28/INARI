/**
 * Cross-module consistency: snapshot, breakdown, monthly report, advisor and the what-if engine must agree.
 * Fixture as in inari.advisor.test.ts (Jun-Sep 2026, today = 2026-10-31):
 *   salary 100000, rent 25000, groceries 12000, utilities 4000, Netflix 649, Uber 3000, Amazon 5000 every month;
 *   Swiggy dining Jun/Jul/Aug 6000, Sep 9000.  Jul-Sep average: income 100000, expenses 56649, surplus 43351.
 *   Dining average 7000.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";
import { FileLedgerRepository, setLedgerRepositoryForTests } from "./ledger";
import { _previewStoreForTests } from "./service";

const KEY = "anon:00000000-0000-4000-8000-0000000000d1";
const c = () =>
  appRouter.createCaller({
    user: { id: 5, openId: "x", email: null, name: "D", loginMethod: "l", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "http", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
    inariUserKey: KEY,
    inariIdentityKind: "anonymous_demo",
  } as TrpcContext);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-31T10:00:00Z"));
  setLedgerRepositoryForTests(new FileLedgerRepository());
  _previewStoreForTests.clear();
});
afterEach(() => vi.useRealTimers());

const p2 = (n: number) => String(n).padStart(2, "0");
const row = (d: string, desc: string, debit?: number, credit?: number) => `${d},${desc},${debit?.toFixed(2) ?? ""},${credit?.toFixed(2) ?? ""}`;
const dining: Record<number, number> = { 6: 6000, 7: 6000, 8: 6000, 9: 9000 };
const monthRows = (m: number) => [
  row(`01/${p2(m)}/2026`, "NEFT-ACME CORP SALARY", undefined, 100000),
  row(`02/${p2(m)}/2026`, "UPI/1/Rent to Landlord/rent@bank", 25000),
  row(`05/${p2(m)}/2026`, "UPI/2/BIGBASKET/bb@bank", 12000),
  row(`10/${p2(m)}/2026`, "UPI/3/SWIGGY/sw@bank", dining[m]),
  row(`12/${p2(m)}/2026`, "BESCOM Electricity Bill", 4000),
  row(`15/${p2(m)}/2026`, "NETFLIX.COM", 649),
  row(`20/${p2(m)}/2026`, "UBER TRIP", 3000),
  row(`28/${p2(m)}/2026`, "AMAZON PAY RETAIL", 5000),
];
const load = async (rows: string[]) => {
  const p = await c().inari.importPreview({ kind: "csv", filename: "r.csv", content: ["Date,Description,Debit,Credit", ...rows].join("\n") });
  return c().inari.importCommit({ previewId: p.previewId });
};
const FOUR = [6, 7, 8, 9].flatMap(monthRows);
const metric = (sim: Awaited<ReturnType<ReturnType<typeof c>["inari"]["simulate"]>>, label: RegExp) => sim.metrics.find(m => label.test(m.label))!;

describe("category correction propagates everywhere and reverses exactly", () => {
  it("Swiggy dining -> shopping moves spend between categories without changing totals; advisor, report and simulator agree", async () => {
    await load(FOUR);
    const before = { snap: await c().inari.getSnapshot(), sep: await c().inari.getBreakdown({ month: "2026-09" }) };
    const swiggy = (await c().inari.listTransactions({ limit: 200 })).items.find(t => /SWIGGY/.test(t.narration))!;
    await c().inari.correctCategory({ transactionId: swiggy.id, category: "shopping", applyToMerchant: true });

    const after = await c().inari.getBreakdown({ month: "2026-09" });
    expect(after.items.find(i => i.category === "dining")).toBeUndefined();
    expect(after.items.find(i => i.category === "shopping")!.amount).toBe(14000); // 5000 Amazon + 9000 Swiggy
    const snap = await c().inari.getSnapshot();
    expect(snap.monthlyExpenses).toBe(before.snap.monthlyExpenses); // same money, different label
    expect(snap.monthlyIncome).toBe(before.snap.monthlyIncome);

    const report = await c().inari.monthlyReport({ month: "2026-09" });
    expect(report.categories.find(x => x.category === "shopping")!.amount).toBe(14000);
    expect(report.categories.some(x => x.category === "dining")).toBe(false);

    const adv = await c().inari.ask({ question: "How much did I spend on shopping last month?", locale: "en" });
    expect(adv.answer).toContain("₹14,000");
    const dine = await c().inari.ask({ question: "How much did I spend on dining last month?", locale: "en" });
    expect(dine.answer).toMatch(/no dining|found no/i);

    // the simulator now sees no dining to cut
    const sim = await c().inari.simulate({ scenarios: [{ type: "reduce_category", category: "dining", percent: 30 }] });
    expect(metric(sim, /expenses/i).delta).toBe(0);

    // moving it back restores every figure
    await c().inari.correctCategory({ transactionId: swiggy.id, category: "dining", applyToMerchant: true });
    expect(await c().inari.getBreakdown({ month: "2026-09" })).toEqual(before.sep);
    expect(await c().inari.getSnapshot()).toEqual(before.snap);
  });
});

describe("what-if engine", () => {
  it("combined scenario matches the hand calculation and mutates nothing", async () => {
    await load(FOUR);
    const snapBefore = await c().inari.getSnapshot();
    const subs = await c().inari.listSubscriptions();
    const netflix = subs.items.find(s => /netflix/i.test(s.merchant))!;
    // income -10000; dining -30% of 7000 = 2100; cancel Netflix 649; SIP 5000
    const sim = await c().inari.simulate({
      scenarios: [
        { type: "change_income", deltaPerMonth: -10000 },
        { type: "reduce_category", category: "dining", percent: 30 },
        { type: "cancel_subscriptions", subscriptionIds: [netflix.id] },
        { type: "start_sip", amountPerMonth: 5000 },
      ],
    });
    expect(metric(sim, /^Monthly income/).scenario).toBe(90000);
    expect(metric(sim, /^Monthly expenses/).scenario).toBe(56649 - 2100 - 649); // 53900
    expect(metric(sim, /^Monthly surplus/).scenario).toBe(90000 - 53900); // 36100
    expect(metric(sim, /Free cash after/).scenario).toBe(36100 - 5000);
    expect(metric(sim, /12 months/).scenario).toBe((36100 - 5000) * 12);
    // baseline equals the live snapshot
    expect(metric(sim, /^Monthly surplus/).baseline).toBe(snapBefore.monthlySurplus);
    expect(await c().inari.getSnapshot()).toEqual(snapBefore);
    expect((await c().inari.listSubscriptions()).items.map(s => s.status)).toEqual(subs.items.map(s => s.status));
  });

  it("a goal contribution scenario shows only the change in free cash and leaves the goal untouched", async () => {
    await load(FOUR);
    await c().inari.upsertGoal({ goalType: "emergency_fund", name: "Safety net", targetAmount: 300000, currentAmount: 60000, timelineMonths: 12, monthlyContribution: 20000, priority: "high" } as never);
    const goal = (await c().inari.getGoals()).items[0];
    const sim = await c().inari.simulate({ scenarios: [{ type: "change_goal_contribution", goalId: goal.id, newMonthly: 30000 }] });
    expect(metric(sim, /^Monthly surplus/).delta).toBe(0); // contributions are not expenses
    expect(metric(sim, /Free cash after/).delta).toBe(-10000); // 30000 instead of 20000
    expect((await c().inari.getGoals()).items[0]).toEqual(goal);
  });

  it("cancelling a subscription is a hypothetical: expenses fall by its amount, the subscription stays active", async () => {
    await load(FOUR);
    const netflix = (await c().inari.listSubscriptions()).items.find(s => /netflix/i.test(s.merchant))!;
    const sim = await c().inari.simulate({ scenarios: [{ type: "cancel_subscriptions", subscriptionIds: [netflix.id] }] });
    expect(metric(sim, /^Monthly expenses/).delta).toBe(-649);
    expect((await c().inari.listSubscriptions()).items.find(s => s.id === netflix.id)!.status).toBe(netflix.status);
    const adv = await c().inari.ask({ question: "What if I cancel Netflix?", locale: "en" });
    expect(adv.answer).toContain("₹649");
  });
});

describe("card repayments are never subscriptions", () => {
  it("a steady monthly card payment is excluded from the subscription list, total and advisor", async () => {
    await load([...FOUR, ...[6, 7, 8, 9].map(m => row(`18/${p2(m)}/2026`, "CREDIT CARD PAYMENT HDFC BANK CARD XX4821", 4500))]);
    const subs = await c().inari.listSubscriptions();
    expect(subs.items.map(s => s.merchant.toLowerCase()).join(" ")).not.toMatch(/hdfc|card/);
    expect(subs.monthlyTotal).toBe(649);
    const adv = await c().inari.ask({ question: "Which subscriptions do I have?", locale: "en" });
    expect(adv.answer).not.toMatch(/hdfc|card/i);
    expect(adv.answer).toContain("₹649");
  });
});

describe("unknown balances stay unknown", () => {
  it("snapshot, advisor and what-if never invent an emergency fund, investments or card debt", async () => {
    await load(FOUR);
    const s = await c().inari.getSnapshot();
    expect(s.balances).toEqual({ emergencyFund: null, investments: null, creditCardDebt: null });
    const adv = await c().inari.ask({ question: "What is my emergency fund?", locale: "en" });
    expect(adv.answer).toMatch(/not (been )?provided|have not|don't know|no balance/i);
    expect(adv.answer).not.toMatch(/₹\s?\d/);
    const sim = await c().inari.simulate({ scenarios: [{ type: "change_income", deltaPerMonth: -1000 }] });
    expect(sim.metrics.some(m => /emergency/i.test(m.label))).toBe(false);
    // once the user confirms one balance, only that one becomes known
    await c().inari.setBalances({ emergencyFund: 120000, investments: null, creditCardDebt: null } as never);
    const s2 = await c().inari.getSnapshot();
    expect(s2.balances).toEqual({ emergencyFund: 120000, investments: null, creditCardDebt: null });
  });
});

describe("repeated imports and undo keep every module consistent", () => {
  it("re-import adds nothing; undo of the only batch returns every module to 'no data'", async () => {
    const first = await load(FOUR);
    const snap = await c().inari.getSnapshot();
    const again = await c().inari.importPreview({ kind: "csv", filename: "r.csv", content: ["Date,Description,Debit,Credit", ...FOUR].join("\n") });
    expect(again.counts).toMatchObject({ accepted: 0, duplicate: FOUR.length });
    expect(await c().inari.getSnapshot()).toEqual(snap);

    await c().inari.importUndo({ batchId: first.batchId });
    const empty = await c().inari.getSnapshot();
    expect(empty.monthlyIncome).toBeNull();
    expect((await c().inari.listSubscriptions()).items).toHaveLength(0);
    const adv = await c().inari.ask({ question: "What is my savings rate?", locale: "en" });
    expect(adv.answer).toMatch(/do not have any of your transactions/);
    const sim = await c().inari.simulate({ scenarios: [{ type: "change_income", deltaPerMonth: -1000 }] });
    expect(sim.status).toBe("insufficient_data");
  });
});
