/**
 * Monthly report, spending drift, guardrails and explicit reconciliation.
 * Expected numbers are worked out by hand from the fixture table below, not by calling the code under test.
 *
 * Fixture (per month, Jun-Sep 2026): salary 100000 (day 1), rent 25000 (2), groceries 12000 (5), dining (10),
 * utilities 4000 (12), Netflix (15), Uber 3000 (20), Amazon shopping 5000 (28).
 *   dining: Jun 6000, Jul 6000, Aug 6000, Sep 9000     Netflix: Jun-Aug 649, Sep 799
 * Hand results:
 *   Aug expenses = 25000+12000+6000+4000+649+3000+5000 = 55649 ; savings 44351 ; rate 44.35
 *   Sep expenses = 25000+12000+9000+4000+799+3000+5000 = 58799 ; savings 41201 ; rate 41.2
 *   dining drift Sep: 9000 vs avg(6000,6000,6000)=6000 => +3000, +50%
 *   Netflix price rise 649 -> 799 => 150 x 12 = 1800 a year
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";
import { FileLedgerRepository, getLedgerRepository, setLedgerRepositoryForTests } from "./ledger";
import { checkText, guardText } from "./guardrails";
import { buildMonthlyReport } from "./report";
import { _previewStoreForTests } from "./service";

const KEY = "anon:00000000-0000-4000-8000-0000000000e1";
const OTHER = "anon:00000000-0000-4000-8000-0000000000e2";
const caller = (key = KEY) =>
  appRouter.createCaller({
    user: { id: 5, openId: "x", email: null, name: "D", loginMethod: "l", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "http", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
    inariUserKey: key,
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
const load = async (rows: string[], key = KEY) => {
  const p = await caller(key).inari.importPreview({ kind: "csv", filename: "r.csv", content: ["Date,Description,Debit,Credit", ...rows].join("\n") });
  await caller(key).inari.importCommit({ previewId: p.previewId });
};
const dining: Record<number, number> = { 6: 6000, 7: 6000, 8: 6000, 9: 9000 };
const monthRows = (m: number) => [
  row(`01/${p2(m)}/2026`, "NEFT-ACME CORP SALARY", undefined, 100000),
  row(`02/${p2(m)}/2026`, "UPI/1/Rent to Landlord/rent@bank", 25000),
  row(`05/${p2(m)}/2026`, "UPI/2/BIGBASKET/bb@bank", 12000),
  row(`10/${p2(m)}/2026`, "UPI/3/SWIGGY/sw@bank", dining[m]),
  row(`12/${p2(m)}/2026`, "BESCOM Electricity Bill", 4000),
  row(`15/${p2(m)}/2026`, "NETFLIX.COM", m === 9 ? 799 : 649),
  row(`20/${p2(m)}/2026`, "UBER TRIP", 3000),
  row(`28/${p2(m)}/2026`, "AMAZON PAY RETAIL", 5000),
];
const FOUR_MONTHS = [6, 7, 8, 9].flatMap(monthRows);
const money = (n: number) => Math.round(n * 100) / 100;

describe("monthly report from real transactions", () => {
  it("September: exact totals, previous month, category change, merchants, obligations", async () => {
    await load(FOUR_MONTHS);
    const r = await caller().inari.monthlyReport({ month: "2026-09" });
    expect(r).toMatchObject({ implementation: "implemented", status: "ok", dataSource: "imported", month: "2026-09" });
    expect(r.totals).toEqual({ income: 100000, expenses: 58799, savings: 41201, savingsRate: 41.2, investments: 0 });
    expect(r.previousMonth).toEqual({ income: 100000, expenses: 55649, savingsRate: 44.35 });
    const diningRow = r.categories.find(c => c.category === "dining")!;
    expect(diningRow).toMatchObject({ amount: 9000, previousMonthAmount: 6000, changePercent: 50 });
    expect(r.topMerchants[0]).toMatchObject({ amount: 25000, count: 1 });
    expect(r.period).toMatchObject({ from: "2026-09-01", to: "2026-09-30", daysInMonth: 30, daysElapsed: 30, partial: false, reason: null });
    expect(r.subscriptions.monthlyTotal).toBe(799);
    expect(r.subscriptions.changes.join(" ")).toMatch(/rose from ₹649 to ₹799/);
    expect(r.obligations).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "rent", monthlyAmount: 25000 }), expect.objectContaining({ kind: "subscription", monthlyAmount: 799 })]));
    expect(r.narrative).toMatchObject({ mode: "fallback", headline: "September 2026: you spent ₹58,799 and saved ₹41,201 (41.2%)." });
  });

  it("detects dining drift (+3000, +50%) and nothing else; actions cite real transaction ids and impacts", async () => {
    await load(FOUR_MONTHS);
    const r = await caller().inari.monthlyReport({ month: "2026-09" });
    expect(r.drift).toMatchObject({ status: "ok", baselineMonths: ["2026-06", "2026-07", "2026-08"] });
    expect(r.drift!.items).toHaveLength(1);
    expect(r.drift!.items[0]).toMatchObject({ category: "dining", amount: 9000, baselineAverage: 6000, changePercent: 50, direction: "up", provisional: false });
    const ledger = await getLedgerRepository().listTransactions(KEY);
    const byId = new Map(ledger.map(t => [t.id, t]));
    expect(r.actions[0]).toMatchObject({ expectedImpactInr: 3000 });
    expect(r.actions[0].reason).toBe("Dining & delivery was ₹9,000, 50% above your usual ₹6,000 (average of 3 earlier months).");
    for (const id of r.actions[0].evidenceTransactionIds) expect(byId.get(id)).toMatchObject({ category: "dining", postedOn: "2026-09-10", amountPaise: 900000 });
    expect(r.actions[1]).toMatchObject({ expectedImpactInr: 1800 });
    expect(r.actions[1].title).toMatch(/more expensive/);
    for (const a of r.actions) {
      expect(a.evidenceTransactionIds.length).toBeGreaterThan(0);
      for (const id of a.evidenceTransactionIds) expect(byId.has(id)).toBe(true);
    }
    expect(r.guardrails).toEqual({ status: "passed", reasons: [] });
    expect(r.unusualTransactionIds).toEqual([]);
  });

  it("does not call small percentage moves or tiny rupee moves drift", async () => {
    const rowsFor = (m: number, groceries: number, tea: number) => [
      row(`01/${p2(m)}/2026`, "NEFT-ACME CORP SALARY", undefined, 100000),
      row(`05/${p2(m)}/2026`, "UPI/2/BIGBASKET/bb@bank", groceries),
      row(`10/${p2(m)}/2026`, "TEA STALL", tea),
      row(`28/${p2(m)}/2026`, "AMAZON PAY RETAIL", 1000),
    ];
    // groceries 12000 -> 13500 is +12.5% (+1500): below the 25% line. Tea 100 -> 400 is +300% but only +300 rupees: below the 500 floor.
    await load([...rowsFor(6, 12000, 100), ...rowsFor(7, 12000, 100), ...rowsFor(8, 12000, 100), ...rowsFor(9, 13500, 400)]);
    const r = await caller().inari.monthlyReport({ month: "2026-09" });
    expect(r.drift).toMatchObject({ status: "ok", items: [] });
    // 12000 -> 16000 is +33.3% (+4000): drift
    await caller().inari.clearMyData({ confirm: "DELETE" });
    await load([...rowsFor(6, 12000, 100), ...rowsFor(7, 12000, 100), ...rowsFor(8, 12000, 100), ...rowsFor(9, 16000, 100)]);
    const r2 = await caller().inari.monthlyReport({ month: "2026-09" });
    expect(r2.drift!.items).toHaveLength(1);
    expect(r2.drift!.items[0]).toMatchObject({ category: "groceries", changePercent: 33.33, amount: 16000, baselineAverage: 12000 });
  });

  it("warns instead of guessing drift when history is too short", async () => {
    await load([6, 7].flatMap(monthRows));
    const r = await caller().inari.monthlyReport({ month: "2026-07" });
    expect(r.drift).toMatchObject({ status: "insufficient_history", items: [] });
    expect(r.dataQuality.map(n => n.code)).toContain("insufficient_history_for_drift");
    const first = await caller().inari.monthlyReport({ month: "2026-06" });
    expect(first.previousMonth).toBeNull();
    expect(first.dataQuality.map(n => n.code)).toContain("no_previous_month");
    expect(first.categories.every(c => c.previousMonthAmount === null && c.changePercent === null)).toBe(true);
  });

  it("no data month, future month and demo mode never fabricate figures", async () => {
    await load(FOUR_MONTHS);
    for (const [month, code] of [["2026-02", "no_data_for_month"], ["2027-01", "future_month"]] as const) {
      const r = await caller().inari.monthlyReport({ month });
      expect(r).toMatchObject({ status: "insufficient_data", totals: { income: 0, expenses: 0 }, categories: [], actions: [] });
      expect(r.dataQuality[0].code).toBe(code);
    }
    const stranger = await caller(OTHER).inari.monthlyReport({ month: "2026-09" });
    expect(stranger).toMatchObject({ status: "insufficient_data", dataSource: "demo" });
    expect(stranger.dataQuality[0].code).toBe("no_imported_data");
  });

  it("current month is partial, labelled so, and falls are not reported until it completes", async () => {
    await load(FOUR_MONTHS);
    await load([row("01/10/2026", "NEFT-ACME CORP SALARY", undefined, 100000), row("02/10/2026", "UPI/1/Rent to Landlord/rent@bank", 25000), row("10/10/2026", "UPI/3/SWIGGY/sw@bank", 1000)]);
    const ledger = await getLedgerRepository();
    const r = buildMonthlyReport({
      transactions: await ledger.listTransactions(KEY), batches: await ledger.listBatches(KEY), profile: await ledger.getProfile(KEY),
      month: "2026-10", now: new Date("2026-10-14T08:00:00Z"),
    });
    expect(r.status).toBe("ok");
    expect(r.period).toMatchObject({ partial: true, daysInMonth: 31, daysElapsed: 14 });
    expect(r.period!.reason).toMatch(/still in progress \(day 14 of 31\)/);
    expect(r.dataQuality.map(n => n.code)).toContain("partial_month");
    expect(r.narrative.headline).toMatch(/October 2026 so far/);
    expect(r.totals).toMatchObject({ income: 100000, expenses: 26000 });
    expect(r.drift!.items.filter(d => d.direction === "down")).toEqual([]); // dining 1000 vs usual 7000 is not called a fall mid-month
    // the same month judged after it ended is still flagged partial because the import stops on the 10th
    const later = buildMonthlyReport({ transactions: await ledger.listTransactions(KEY), batches: await ledger.listBatches(KEY), profile: null, month: "2026-10", now: new Date("2026-12-01T00:00:00Z") });
    expect(later.period!.partial).toBe(true);
    expect(later.period!.reason).toMatch(/do not cover all of October 2026/);
  });

  it("unusual transactions are statistical outliers backed by history", async () => {
    await load([...[6, 7, 8].flatMap(monthRows), ...monthRows(9), row("22/09/2026", "UPI/8/CROMA ELECTRONICS/cr@bank", 60000)]);
    const r = await caller().inari.monthlyReport({ month: "2026-09" });
    const ledger = await getLedgerRepository().listTransactions(KEY);
    const big = ledger.find(t => t.amountPaise === 6_000_000)!;
    expect(r.unusualTransactionIds).toEqual([big.id]);
    expect(r.actions.some(a => a.title === "Review a large payment" && a.evidenceTransactionIds[0] === big.id)).toBe(true);
    const earlier = await caller().inari.monthlyReport({ month: "2026-08" });
    expect(earlier.unusualTransactionIds).toEqual([]);
  });

  it("lists unknown balances and goals instead of inventing them; setBalances removes only what was provided", async () => {
    await load(FOUR_MONTHS);
    expect((await caller().inari.monthlyReport({ month: "2026-09" })).unknowns).toEqual(["goals", "emergencyFund", "investments", "creditCardDebt"]);
    await caller().inari.setBalances({ emergencyFund: 50000, investments: null, creditCardDebt: null });
    expect((await caller().inari.monthlyReport({ month: "2026-09" })).unknowns).toEqual(["goals", "investments", "creditCardDebt"]);
  });

  it("listReportMonths returns real months, newest first, per user", async () => {
    await load(FOUR_MONTHS);
    expect(await caller().inari.listReportMonths()).toMatchObject({ implementation: "implemented", months: ["2026-09", "2026-08", "2026-07", "2026-06"] });
    expect((await caller(OTHER).inari.listReportMonths()).months).toEqual([]);
  });

  it("alias getMonthlyReport equals monthlyReport, and generating it never changes the ledger", async () => {
    await load(FOUR_MONTHS);
    const before = (await caller().inari.listTransactions({ limit: 200 })).items;
    const a = await caller().inari.monthlyReport({ month: "2026-09" });
    const b = await caller().inari.getMonthlyReport({ month: "2026-09" });
    expect(b).toEqual(a);
    expect((await caller().inari.listTransactions({ limit: 200 })).items).toEqual(before);
  });
});

describe("guardrails", () => {
  const facts = { amounts: [9000, 6000], percents: [50] };
  it("blocks guaranteed-return, risk-free and return-projection claims", () => {
    for (const t of [
      "This fund gives guaranteed returns.", "A risk-free way to grow your savings.", "Sure shot profit if you act now.",
      "Your money will earn ₹9,000 next year.", "Expect 12% returns per annum.", "You can't lose with this.",
    ]) expect(checkText(t, facts).ok, t).toBe(false);
  });
  it("blocks specific investment recommendations", () => {
    for (const t of ["You should buy Nifty index funds.", "Invest in mutual funds this month.", "Put your money into gold bonds.", "Start investing in crypto."])
      expect(checkText(t, facts).ok, t).toBe(false);
  });
  it("blocks any rupee amount or percentage that is not a computed figure", () => {
    expect(checkText("Dining was ₹9,000, 50% above your usual ₹6,000.", facts).ok).toBe(true);
    expect(checkText("Dining was ₹9,500.", facts).ok).toBe(false);
    expect(checkText("Dining rose 51%.", facts).ok).toBe(false);
    expect(checkText("You spent Rs. 4,200 on food.", facts).ok).toBe(false);
  });
  it("guardText swaps in a number-free fallback and says why", () => {
    const g = guardText("Guaranteed returns of ₹1,00,000 await.", "Review the linked transactions.", facts);
    expect(g).toMatchObject({ text: "Review the linked transactions.", status: "refused" });
    expect(g.reasons.length).toBeGreaterThan(0);
    expect(guardText("Dining was ₹9,500.", "x", facts).status).toBe("modified");
    expect(guardText("Dining was ₹9,000.", "x", facts)).toMatchObject({ status: "passed", text: "Dining was ₹9,000." });
  });
  it("every generated report text, for every month, passes its own guardrail", async () => {
    await load(FOUR_MONTHS);
    for (const month of ["2026-06", "2026-07", "2026-08", "2026-09"]) {
      const r = await caller().inari.monthlyReport({ month });
      expect(r.guardrails!.status, month).toBe("passed");
      const text = [r.narrative.headline, r.narrative.body, ...r.actions.map(a => a.title + " " + a.reason)].join(" ");
      expect(text).not.toMatch(/guarantee|risk-free|buy |sell |invest in/i);
    }
  });
});

describe("reconciliation: unresolved warnings and explicit user-confirmed actions", () => {
  const CSV_JULY = [
    row("01/07/2026", "NEFT-ACME CORP SALARY", undefined, 100000),
    row("10/07/2026", "UPI/3/SWIGGY/sw@bank", 500),
    row("15/07/2026", "CREDIT CARD PAYMENT HDFC", 15000),
    row("28/07/2026", "AMAZON PAY RETAIL", 1000),
  ];
  const SMS_DUP = "Rs.500.00 debited from A/c XX1234 on 10-07-26 to swiggy@ybl (UPI Ref No 900000000001)";
  const importSms = async (text: string) => {
    const p = await caller().inari.importPreview({ kind: "sms", text });
    await caller().inari.importCommit({ previewId: p.previewId, importAllPossibleDuplicates: true });
  };

  it("a CSV/SMS possible duplicate and a card repayment are flagged in the report as unresolved, with ids and a pointer to reconcile", async () => {
    await load(CSV_JULY);
    await importSms(SMS_DUP);
    const r = await caller().inari.monthlyReport({ month: "2026-07" });
    expect(r.totals.expenses).toBe(500 + 15000 + 1000 + 500); // both swiggy rows and the repayment are counted until the user decides
    const dup = r.dataQuality.find(n => n.code === "possible_duplicates")!;
    expect(dup.severity).toBe("warning");
    expect(dup.transactionIds).toHaveLength(1);
    expect(dup.message).toMatch(/inari\.reconcile/);
    expect(r.dataQuality.find(n => n.code === "card_repayment_counted")).toBeTruthy();
    const dq = r.actions.find(a => a.title === "Confirm flagged transactions")!;
    expect(dq.evidenceTransactionIds.length).toBeGreaterThanOrEqual(2);
    expect(dq.expectedImpactInr).toBeNull();
  });

  it("exclude_duplicate removes only the flagged row from totals; the row stays in the ledger, and undo restores it", async () => {
    await load(CSV_JULY);
    await importSms(SMS_DUP);
    const all = (await caller().inari.listTransactions({ limit: 50 })).items;
    const dup = all.find(t => t.possibleDuplicateOf)!;
    const original = all.find(t => t.id === dup.possibleDuplicateOf)!;
    expect(original.source).toBe("csv");
    expect(await caller().inari.reconcile({ transactionIds: [dup.id], decision: "exclude_duplicate" })).toMatchObject({ implementation: "implemented", updated: 1 });
    const r = await caller().inari.monthlyReport({ month: "2026-07" });
    expect(r.totals.expenses).toBe(500 + 15000 + 1000);
    expect(r.dataQuality.map(n => n.code)).toEqual(expect.arrayContaining(["reconciliation_applied"]));
    expect(r.dataQuality.map(n => n.code)).not.toContain("possible_duplicates");
    const after = (await caller().inari.listTransactions({ limit: 50 })).items;
    expect(after).toHaveLength(all.length); // nothing deleted
    expect(after.find(t => t.id === dup.id)!.reconciliation?.decision).toBe("excluded_duplicate");
    expect(after.find(t => t.id === original.id)!.reconciliation).toBeUndefined();
    expect((await caller().inari.getSnapshot()).dataQuality.map(n => n.code)).toContain("reconciliation_applied");
    await caller().inari.reconcile({ transactionIds: [dup.id], decision: "undo" });
    expect((await caller().inari.monthlyReport({ month: "2026-07" })).totals.expenses).toBe(500 + 15000 + 1000 + 500);
  });

  it("keep_separate resolves the warning but keeps both rows in the totals", async () => {
    await load(CSV_JULY);
    await importSms(SMS_DUP);
    const dup = (await caller().inari.listTransactions({ limit: 50 })).items.find(t => t.possibleDuplicateOf)!;
    await caller().inari.reconcile({ transactionIds: [dup.id], decision: "keep_separate" });
    const r = await caller().inari.monthlyReport({ month: "2026-07" });
    expect(r.totals.expenses).toBe(500 + 15000 + 1000 + 500);
    expect(r.dataQuality.map(n => n.code)).not.toContain("possible_duplicates");
  });

  it("exclude_card_double_count removes a card repayment from totals only on explicit request", async () => {
    await load(CSV_JULY);
    const repayment = (await caller().inari.listTransactions({ limit: 50 })).items.find(t => t.narration.includes("CREDIT CARD PAYMENT"))!;
    expect((await caller().inari.monthlyReport({ month: "2026-07" })).totals.expenses).toBe(500 + 15000 + 1000);
    await caller().inari.reconcile({ transactionIds: [repayment.id], decision: "exclude_card_double_count" });
    const r = await caller().inari.monthlyReport({ month: "2026-07" });
    expect(r.totals.expenses).toBe(500 + 1000);
    expect(r.dataQuality.map(n => n.code)).not.toContain("card_repayment_counted");
    expect((await caller().inari.listTransactions({ limit: 50 })).items).toHaveLength(4); // the repayment row is still in the ledger as evidence
    expect(await caller().inari.getSnapshot()).toMatchObject({ coverage: { transactionCount: 3 } });
  });

  it("refuses ineligible, missing and other users' transactions, and never excludes both sides", async () => {
    await load(CSV_JULY);
    await importSms(SMS_DUP);
    const all = (await caller().inari.listTransactions({ limit: 50 })).items;
    const dup = all.find(t => t.possibleDuplicateOf)!;
    const salary = all.find(t => t.category === "salary")!;
    await expect(caller().inari.reconcile({ transactionIds: [salary.id], decision: "exclude_duplicate" })).rejects.toThrow(/possible duplicates/);
    await expect(caller().inari.reconcile({ transactionIds: [salary.id], decision: "exclude_card_double_count" })).rejects.toThrow(/credit-card repayment/);
    await expect(caller().inari.reconcile({ transactionIds: [salary.id], decision: "undo" })).rejects.toThrow(/no reconciliation decision/);
    await expect(caller().inari.reconcile({ transactionIds: ["txn_nope"], decision: "keep_separate" })).rejects.toThrow(/not found/);
    await expect(caller(OTHER).inari.reconcile({ transactionIds: [dup.id], decision: "exclude_duplicate" })).rejects.toThrow(/not found/);
    // the original of a pair cannot be excluded together with its duplicate
    const chained = { ...dup };
    await caller().inari.reconcile({ transactionIds: [dup.id], decision: "exclude_duplicate" });
    await importSms(SMS_DUP.replace("900000000001", "900000000002"));
    const third = (await caller().inari.listTransactions({ limit: 50 })).items.find(t => t.possibleDuplicateOf && t.id !== chained.id && !t.reconciliation)!;
    if (third.possibleDuplicateOf === dup.id) {
      await expect(caller().inari.reconcile({ transactionIds: [third.id], decision: "exclude_duplicate" })).rejects.toThrow(/Keep at least one/);
    }
  });

  it("reconciliation does not disturb subscriptions or deterministic simulation", async () => {
    await load([...[4, 5, 6, 7, 8, 9].map(m => row(`05/${p2(m)}/2026`, "NETFLIX.COM", 649)), ...[4, 5, 6, 7, 8, 9].map(m => row(`01/${p2(m)}/2026`, "NEFT ACME SALARY", undefined, 80000)), row("28/09/2026", "AMAZON PAY RETAIL", 1000), row("28/04/2026", "AMAZON PAY RETAIL", 1000)]);
    const before = await caller().inari.simulate({ scenarios: [{ type: "change_income", deltaPerMonth: 1000 }] });
    const subs = await caller().inari.listSubscriptions();
    const again = await caller().inari.simulate({ scenarios: [{ type: "change_income", deltaPerMonth: 1000 }] });
    expect(again.metrics).toEqual(before.metrics);
    expect(subs.items).toHaveLength(1);
    expect(money(subs.monthlyTotal)).toBe(649);
  });
});
