/**
 * Advisor (`inari.ask`) and cross-module reconciliation consistency.
 * Fixture: Jun-Sep 2026, per month salary 100000, rent 25000, groceries 12000, dining (Swiggy), utilities 4000,
 * Netflix, Uber 3000, Amazon shopping 5000. dining: Jun/Jul/Aug 6000, Sep 9000. Netflix steady 649.
 * Hand results (Jul-Sep, the 3 most recent complete months):
 *   expenses every month = 25000+12000+dining+4000+649+3000+5000 => Jul/Aug 55649, Sep 58649
 *   average = (55649+55649+58649)/3 = 56649 ; savings 43351 ; rate 43.35
 *   dining average = (6000+6000+9000)/3 = 7000 ; cutting 30% = 2100 => expenses 54549, rate 45.45
 *   Sep: dining 9000 vs Aug 6000 => 3000 more.  Cancel Netflix => 649 less.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";
import { FileLedgerRepository, getLedgerRepository, setLedgerRepositoryForTests } from "./ledger";
import { _previewStoreForTests } from "./service";

const KEY = "anon:00000000-0000-4000-8000-0000000000f1";
const OTHER = "anon:00000000-0000-4000-8000-0000000000f2";
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
  row(`15/${p2(m)}/2026`, "NETFLIX.COM", 649),
  row(`20/${p2(m)}/2026`, "UBER TRIP", 3000),
  row(`28/${p2(m)}/2026`, "AMAZON PAY RETAIL", 5000),
];
const FOUR = [6, 7, 8, 9].flatMap(monthRows);
const ask = (q: string, previous?: any, key = KEY) => caller(key).inari.ask({ question: q, locale: "en", ...(previous ? { previous } : {}) });

describe("advisor: grounded, deterministic, honest about how it answers", () => {
  it("spending by category and period, with evidence and comparison", async () => {
    await load(FOUR);
    const r = await ask("How much did I spend on dining last month?");
    expect(r).toMatchObject({ implementation: "implemented", mode: "fallback", dataSource: "imported", confidenceLevel: "high" });
    expect(r.answer).toBe("In September 2026 you spent ₹9,000 on dining & delivery. That is ₹3,000 more than August 2026 (₹6,000).");
    const ledger = await getLedgerRepository().listTransactions(KEY);
    const ev = r.evidence!.flatMap(e => e.transactionIds ?? []);
    expect(ev.length).toBeGreaterThan(0);
    for (const id of ev) expect(ledger.find(t => t.id === id)).toMatchObject({ category: "dining", postedOn: "2026-09-10", amountPaise: 900000 });
    expect(r.engine).toEqual({ kind: "deterministic", llmUsed: false, model: null });
    expect(r.guardrail).toEqual({ status: "passed", reasons: [] });
    expect(r.assumptions!.length).toBeGreaterThan(0);
  });

  it("merchant questions, and a conversational follow-up that reuses the previous category", async () => {
    await load(FOUR);
    const a = await ask("how much did I spend on swiggy in August");
    expect(a.answer).toMatch(/In August 2026 you paid Swiggy ₹6,000 across 1 payment/);
    const first = await ask("How much did I spend on dining last month?");
    const follow = await ask("and in August?", first.context);
    expect(follow.answer).toBe("In August 2026 you spent ₹6,000 on dining & delivery. That is the same as July 2026.");
    expect(follow.context).toMatchObject({ category: "dining", month: "2026-08" });
  });

  it("savings and income questions come from the verified snapshot", async () => {
    await load(FOUR);
    const r = await ask("what is my savings rate");
    expect(r.answer).toContain("about ₹1,00,000");
    expect(r.answer).toContain("about ₹56,649");
    expect(r.answer).toContain("43.4%"); // 43.35 shown to one decimal
    expect(r.limitations).toEqual(expect.arrayContaining([expect.stringMatching(/emergencyFund was not provided/)]));
    expect(r.relatedMetrics.map(m => m.label)).toEqual(["Monthly income", "Monthly expenses", "Savings rate"]);
  });

  it("recurring payments: list, specific merchant, and cancel as a what-if that changes nothing", async () => {
    await load(FOUR);
    const list = await ask("which subscriptions do I have");
    expect(list.answer).toMatch(/1 recurring payment costing about ₹649 a month: Netflix.*\(₹649\)/);
    const one = await ask("am I paying for netflix");
    expect(one.answer).toMatch(/^Yes\. .*monthly payment of ₹649 \(about ₹7,788 a year\)/);
    const none = await ask("am I paying for spotify");
    expect(none.answer).toMatch(/do not see a recurring payment to Spotify/);
    const before = (await caller().inari.listTransactions({ limit: 200 })).items;
    const cancel = await ask("cancel netflix");
    expect(cancel.answer).toMatch(/I cannot cancel Netflix.*fall by about ₹649 a month \(from ₹56,649 to ₹56,000\)/);
    expect(cancel.simulation).toMatchObject({ status: "ok", ledgerUnchanged: true });
    expect(cancel.proposedActions).toEqual([expect.objectContaining({ type: "confirm_subscription", procedure: "inari.confirmSubscription", requiresConfirmation: true })]);
    expect((await caller().inari.listTransactions({ limit: 200 })).items).toEqual(before);
    expect((await caller().inari.listSubscriptions()).items[0].status).toBe("possible"); // advisor did not dismiss it
  });

  it("what-if questions reuse the verified parser and simulator: exact numbers, assumptions, no mutation", async () => {
    await load(FOUR);
    const snapBefore = await caller().inari.getSnapshot();
    const r = await ask("um what if I uh cut dining by thirty percent");
    expect(r.intent).toMatchObject({ intent: "what_if", percent: 30, category: "dining" });
    const direct = await caller().inari.simulate({ scenarios: [r.intent!.scenario!] });
    expect(r.simulation).toEqual(direct);
    expect(r.answer).toBe("Testing that on your 3-month average: monthly spending goes from ₹56,649 to ₹54,549 (₹2,100 lower), and your savings rate goes from 43.4% to 45.5%. Over 12 months that leaves ₹5,45,412 versus ₹5,20,212 now.");
    expect(r.assumptions!.join(" ")).toMatch(/No investment returns/);
    expect(r.limitations).toEqual(expect.arrayContaining([expect.stringMatching(/emergency-fund balance is not provided/)]));
    expect(await caller().inari.getSnapshot()).toEqual(snapBefore);
  });

  it("what-if follow-up: 'what about 40 percent instead' reuses the previous category", async () => {
    await load(FOUR);
    const first = await ask("what if I cut dining by 30%");
    const second = await ask("what about 40 percent instead", first.context);
    expect(second.intent).toMatchObject({ intent: "what_if", percent: 40, category: "dining" });
    expect(second.answer).toContain("from ₹56,649 to ₹53,849 (₹2,800 lower)"); // 40% of the 7000 dining average
    expect(second.simulation!.scenarios).toEqual([{ type: "reduce_category", category: "dining", percent: 40 }]);
  });

  it("asks a question instead of guessing when a what-if is incomplete", async () => {
    await load(FOUR);
    const r = await ask("what if I cut my spending");
    expect(r.simulation).toBeNull();
    expect(r.confidenceLevel).toBe("low");
    expect(r.limitations).toEqual(expect.arrayContaining([expect.stringMatching(/will not guess/)]));
  });

  it("monthly review answers use the real report", async () => {
    await load(FOUR);
    const r = await ask("show my report for September");
    expect(r.answer).toMatch(/^September 2026: you spent ₹58,649 and saved ₹41,351 \(41\.4%\)\./);
    expect(r.guardrail.status).toBe("passed");
  });

  it("explains a category using drift, and admits when history is too short", async () => {
    await load(FOUR);
    const r = await ask("why is dining so high");
    expect(r.answer).toMatch(/Dining & delivery was ₹9,000 in September 2026, 50% above your usual ₹6,000 \(average of 3 earlier months\)/);
    await caller().inari.clearMyData({ confirm: "DELETE" });
    await load([6, 7].flatMap(monthRows));
    const short = await ask("why is dining so high");
    expect(short.answer).toMatch(/need at least two earlier complete months/);
    expect(short.confidenceLevel).toBe("low");
  });

  it("balances and goals are never invented", async () => {
    await load(FOUR);
    expect((await ask("how much emergency fund do I have")).answer).toMatch(/emergency fund: not provided/);
    await caller().inari.setBalances({ emergencyFund: 50000, investments: null, creditCardDebt: null });
    expect((await ask("how much emergency fund do I have")).answer).toMatch(/emergency fund: ₹50,000 \(as you told me\)/);
    const g = await ask("how are my goals");
    expect(g.answer).toMatch(/not added any savings goals/);
    expect(g.relatedMetrics).toEqual([]);
  });

  it("recategorize requests are proposals that need confirmation; nothing changes", async () => {
    await load(FOUR);
    const r = await ask("recategorize uber as travel");
    expect(r.proposedActions).toEqual([expect.objectContaining({ type: "correct_category", procedure: "inari.correctCategory", requiresConfirmation: true, input: expect.objectContaining({ category: "travel", applyToMerchant: true }) })]);
    expect((await caller().inari.listTransactions({ limit: 200 })).items.filter(t => t.category === "travel")).toHaveLength(0);
  });

  it("refuses investment advice and return promises, with a stable guardrail status", async () => {
    await load(FOUR);
    for (const q of ["which stock should I buy", "should I invest in mutual funds", "can you guarantee returns on gold"]) {
      const r = await ask(q);
      expect(r.guardrail.status, q).toBe("refused");
      expect(r.answer, q).toMatch(/can't recommend specific investments/);
      expect(r.relatedMetrics, q).toEqual([]);
    }
  });

  it("outside topics get a low-confidence capability list", async () => {
    await load(FOUR);
    const r = await ask("tell me a joke");
    expect(r.confidenceLevel).toBe("low");
    expect(r.followUpQuestions.length).toBeGreaterThan(2);
  });

  it("no imported data: says so, proposes import, and invents nothing", async () => {
    const r = await ask("how much did I spend on dining last month?", undefined, OTHER);
    expect(r).toMatchObject({ dataSource: "demo", dataAsOf: null, confidenceLevel: "low", relatedMetrics: [], simulation: null });
    expect(r.answer).toMatch(/do not have any of your transactions/);
    expect(r.proposedActions![0]).toMatchObject({ type: "import_data", requiresConfirmation: true });
  });

  it("is deterministic, per-user, never claims to be an LLM, and never mutates the ledger", async () => {
    await load(FOUR);
    const before = (await caller().inari.listTransactions({ limit: 200 })).items;
    const qs = ["How much did I spend on dining last month?", "what is my savings rate", "which subscriptions do I have", "what if I cut dining by 30%", "are there any flagged transactions", "show my report for September"];
    for (const q of qs) {
      const a = await ask(q);
      const b = await ask(q);
      expect(b, q).toEqual(a);
      expect(a.mode, q).toBe("fallback");
      expect(a.engine, q).toEqual({ kind: "deterministic", llmUsed: false, model: null });
      expect(a.guardrail.status, q).toBe("passed");
      expect(a.disclaimer.length).toBeGreaterThan(10);
    }
    expect((await caller().inari.listTransactions({ limit: 200 })).items).toEqual(before);
    expect((await caller().inari.meta()).features.llm).toBe(false);
    expect((await ask("what is my savings rate", undefined, OTHER)).dataSource).toBe("demo");
  });
});

describe("cross-module consistency of reconciled transactions", () => {
  const CSV_JULY = [
    row("01/07/2026", "NEFT-ACME CORP SALARY", undefined, 100000),
    row("10/07/2026", "UPI/3/SWIGGY/sw@bank", 500),
    row("15/07/2026", "CREDIT CARD PAYMENT HDFC", 15000),
    row("28/07/2026", "AMAZON PAY RETAIL", 1000),
    row("05/05/2026", "NETFLIX.COM", 649), row("05/06/2026", "NETFLIX.COM", 649), row("05/07/2026", "NETFLIX.COM", 649),
  ];
  const SMS_SWIGGY = "Rs.500.00 debited from A/c XX1234 on 10-07-26 to swiggy@ybl (UPI Ref No 900000000001)";
  const SMS_NETFLIX = "Rs.649.00 debited from A/c XX1234 on 05-07-26 to netflix@icici (UPI Ref No 900000000002)";
  const sms = async (text: string) => {
    const p = await caller().inari.importPreview({ kind: "sms", text });
    return caller().inari.importCommit({ previewId: p.previewId });
  };

  /** Every module's view of July expenses / dining, read through the public API. */
  const views = async () => {
    const snap = await caller().inari.getSnapshot();
    const breakdown = (await caller().inari.getBreakdown({ month: "2026-07" })).items.find(i => i.category === "dining")?.amount ?? 0;
    const sim = await caller().inari.simulate({ scenarios: [{ type: "change_income", deltaPerMonth: 0 }] });
    const report = await caller().inari.monthlyReport({ month: "2026-07" });
    const adv = await ask("how much did I spend on dining in July");
    const subs = (await caller().inari.listSubscriptions()).items[0];
    return {
      snapshotExpenses: snap.monthlyExpenses,
      breakdownDining: breakdown,
      simExpenses: sim.metrics.find(m => m.label === "Monthly expenses")!.baseline,
      reportExpenses: report.totals.expenses,
      reportDining: report.categories.find(c => c.category === "dining")?.amount ?? 0,
      advisorDining: Number((adv.answer.match(/₹([\d,]+)/)?.[1] ?? "0").replace(/,/g, "")),
      subFlags: subs?.flags ?? [],
      subOccurrences: subs?.occurrences ?? 0,
    };
  };

  it("exclude / undo flows through snapshot, breakdown, simulation, report, advisor and subscriptions identically", async () => {
    await load(CSV_JULY);
    const smsBatch = await sms(`${SMS_SWIGGY}\n\n${SMS_NETFLIX}`);
    expect(smsBatch.counts.possibleDuplicate).toBe(2);

    // 1. flagged but unresolved: everything counts both rows, and the subscription shows a double charge
    const flagged = await views();
    expect(flagged).toMatchObject({ snapshotExpenses: 6532, breakdownDining: 1000, simExpenses: 6532, reportExpenses: 18298, reportDining: 1000, advisorDining: 1000, subOccurrences: 3 });
    expect(flagged.subFlags).toContain("possible_duplicate");
    expect((await ask("are there any duplicate transactions")).answer).toMatch(/2 possible duplicate\(s\)/);

    // 2. exclude both SMS rows: every module drops them together
    const dups = (await caller().inari.listTransactions({ limit: 50 })).items.filter(t => t.possibleDuplicateOf);
    expect(dups).toHaveLength(2);
    await caller().inari.reconcile({ transactionIds: dups.map(t => t.id), decision: "exclude_duplicate" });
    const excluded = await views();
    expect(excluded).toMatchObject({ snapshotExpenses: 6149, breakdownDining: 500, simExpenses: 6149, reportExpenses: 17149, reportDining: 500, advisorDining: 500, subOccurrences: 3 });
    expect(excluded.subFlags).not.toContain("possible_duplicate");
    expect((await ask("how much did I spend on swiggy in July")).answer).toContain("₹500");
    expect((await ask("how much did I spend on swiggy in July")).answer).not.toContain("₹1,000");
    expect((await ask("are there any duplicate transactions")).answer).not.toMatch(/possible duplicate/);

    // 3. card repayment excluded as well
    const repayment = (await caller().inari.listTransactions({ limit: 50 })).items.find(t => t.narration.includes("CREDIT CARD PAYMENT"))!;
    await caller().inari.reconcile({ transactionIds: [repayment.id], decision: "exclude_card_double_count" });
    expect(await views()).toMatchObject({ snapshotExpenses: 1149, reportExpenses: 2149, simExpenses: 1149, breakdownDining: 500 });

    // 4. undo everything: back to the flagged state, nothing lost
    await caller().inari.reconcile({ transactionIds: [...dups.map(t => t.id), repayment.id], decision: "undo" });
    expect(await views()).toMatchObject({ snapshotExpenses: 6532, reportExpenses: 18298, simExpenses: 6532, breakdownDining: 1000, advisorDining: 1000 });
    expect((await caller().inari.listTransactions({ limit: 50 })).items.every(t => t.reconciliation === undefined)).toBe(true);
  });

  it("re-importing an excluded SMS is a plain duplicate (decision kept); undoing the batch and re-importing re-flags it", async () => {
    await load(CSV_JULY);
    const batch = await sms(SMS_SWIGGY);
    const dup = (await caller().inari.listTransactions({ limit: 50 })).items.find(t => t.possibleDuplicateOf)!;
    await caller().inari.reconcile({ transactionIds: [dup.id], decision: "exclude_duplicate" });
    expect((await views()).reportExpenses).toBe(17149);

    const again = await caller().inari.importPreview({ kind: "sms", text: SMS_SWIGGY });
    expect(again.counts).toMatchObject({ accepted: 0, duplicate: 1, possibleDuplicate: 0 });
    expect((await views()).reportExpenses).toBe(17149);

    await caller().inari.importUndo({ batchId: batch.batchId });
    expect((await caller().inari.listTransactions({ limit: 50 })).items.some(t => t.source === "sms")).toBe(false);
    expect((await views()).reportExpenses).toBe(17149);

    await sms(SMS_SWIGGY);
    const refl = await views();
    expect(refl.reportExpenses).toBe(17649); // the decision belonged to the deleted row; the new row is flagged afresh
    expect((await caller().inari.getSnapshot()).dataQuality.map(n => n.code)).toContain("possible_duplicates");
  });

  it("the advisor's proposed reconcile actions carry real ids and take effect only when the client confirms them", async () => {
    await load(CSV_JULY);
    await sms(SMS_SWIGGY);
    const r = await ask("are there any flagged transactions");
    const exclude = r.proposedActions!.find(a => (a.input as any).decision === "exclude_duplicate")!;
    expect(exclude).toMatchObject({ type: "reconcile", procedure: "inari.reconcile", requiresConfirmation: true });
    expect((await views()).reportExpenses).toBe(17649); // asking changed nothing
    await caller().inari.reconcile(exclude.input as any); // the user confirms
    expect((await views()).reportExpenses).toBe(17149);
    expect((await ask("are there any flagged transactions")).evidence!.map(e => e.code)).toContain("reconciliation_applied");
  });
});
