/**
 * Intent analysis (dictated text) and what-if simulation.
 * Baseline fixture: 3 months, income 100000; expenses 60000 =
 *   rent 25000 + groceries 12000 + dining 6000 + utilities 4000 + subscription 650 + transport 3350 + shopping 9000.
 * Expected numbers below are worked out by hand from that table, not by calling the code under test.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";
import { FileLedgerRepository, setLedgerRepositoryForTests } from "./ledger";
import { analyzeIntentText, normalizeText } from "./nlp/intent";
import { _previewStoreForTests } from "./service";

const KEY = "anon:00000000-0000-4000-8000-0000000000d1";
const caller = (key = KEY) =>
  appRouter.createCaller({
    user: { id: 5, openId: "x", email: null, name: "D", loginMethod: "l", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "http", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
    inariUserKey: key,
    inariIdentityKind: "anonymous_demo",
  } as TrpcContext);

const ROWS: Array<[number, string, number, number]> = [
  [1, "NEFT-ACME CORP SALARY", 0, 100000],
  [2, "UPI/111/Rent to Landlord/rent@bank", 25000, 0],
  [5, "UPI/222/BIGBASKET/bb@bank", 12000, 0],
  [10, "UPI/333/SWIGGY/sw@bank", 6000, 0],
  [12, "BESCOM Electricity Bill", 4000, 0],
  [15, "NETFLIX.COM subscription", 650, 0],
  [20, "UBER TRIP", 3350, 0],
  [28, "AMAZON PAY RETAIL", 9000, 0],
];
const p2 = (n: number) => String(n).padStart(2, "0");
const CSV = ["Date,Description,Debit,Credit", ...[7, 8, 9].flatMap(m => ROWS.map(([d, n, dr, cr]) => `${p2(d)}/${p2(m)}/2026,${n},${dr ? dr.toFixed(2) : ""},${cr ? cr.toFixed(2) : ""}`))].join("\n");

async function seed(key = KEY) {
  const p = await caller(key).inari.importPreview({ kind: "csv", filename: "q3.csv", content: CSV });
  await caller(key).inari.importCommit({ previewId: p.previewId });
}
const m = (r: Awaited<ReturnType<ReturnType<typeof caller>["inari"]["simulate"]>>, label: string) => r.metrics.find(x => x.label === label)!;

beforeEach(() => {
  setLedgerRepositoryForTests(new FileLedgerRepository());
  _previewStoreForTests.clear();
});

describe("analyzeIntent: dictation handling", () => {
  it("removes fillers and applies a spoken self-correction (fixture sentence)", () => {
    const r = analyzeIntentText("I spend 4000 on food delivery, actually make that 5000, what if I cut it in half");
    expect(r).toMatchObject({
      intent: "what_if", category: "dining", amount: 5000, amountsMentioned: [4000, 5000], percent: 50,
      scenario: { type: "reduce_category", category: "dining", percent: 50 },
      needsClarification: false, requiresConfirmation: false,
    });
    expect(r.corrections).toEqual([{ from: 4000, to: 5000, cue: "make that" }]);
    expect(r.normalizedText).toBe("i spend 4000 on food delivery actually make that 5000 what if i cut it in half");
  });

  it("drops um/uh and understands number words and units", () => {
    expect(normalizeText("Um, so uh what if I cut dining")).toBe("so what if i cut dining");
    expect(analyzeIntentText("um what if I uh cut dining by thirty percent").scenario).toEqual({ type: "reduce_category", category: "dining", percent: 30 });
    expect(analyzeIntentText("what if I reduce groceries by 2k").scenario).toEqual({ type: "reduce_category", category: "groceries", amountPerMonth: 2000 });
    expect(analyzeIntentText("what if I cut shopping by ₹1,500").scenario).toEqual({ type: "reduce_category", category: "shopping", amountPerMonth: 1500 });
    expect(analyzeIntentText("what if I buy a bike for 1.5 lakh").scenario).toEqual({ type: "one_off_expense", amount: 150000, inMonths: 0 });
    expect(analyzeIntentText("what if I get a raise of ten thousand a month").scenario).toEqual({ type: "change_income", deltaPerMonth: 10000 });
  });

  it("handles percent corrections and 'not X but Y'", () => {
    const a = analyzeIntentText("what if I cut dining by 30 percent, actually 40");
    expect(a.percent).toBe(40);
    expect(a.corrections).toEqual([{ from: 30, to: 40, cue: "actually" }]);
    expect(a.scenario).toEqual({ type: "reduce_category", category: "dining", percent: 40 });
    const b = analyzeIntentText("what if I reduce groceries by not 1000 but 2000");
    expect(b.corrections[0]).toMatchObject({ from: 1000, to: 2000 });
    expect(b.scenario).toEqual({ type: "reduce_category", category: "groceries", amountPerMonth: 2000 });
  });

  it("builds the other scenario types", () => {
    expect(analyzeIntentText("what if I start a SIP of 5,000").scenario).toEqual({ type: "start_sip", amountPerMonth: 5000 });
    expect(analyzeIntentText("what if I pay 10000 per month toward my credit card").scenario).toEqual({ type: "pay_down_debt", amountPerMonth: 10000 });
    expect(analyzeIntentText("what if I buy a laptop for 80000 in 3 months").scenario).toEqual({ type: "one_off_expense", amount: 80000, inMonths: 3 });
    expect(analyzeIntentText("what if my salary drops by 15000").scenario).toEqual({ type: "change_income", deltaPerMonth: -15000 });
    const subs = analyzeIntentText("what if I cancel all my subscriptions");
    expect(subs.scenario).toEqual({ type: "reduce_category", category: "subscription", percent: 100 });
    expect(subs.ambiguities.join(" ")).toMatch(/named subscriptions/);
  });

  it("asks instead of guessing when information is missing or ambiguous", () => {
    for (const text of [
      "what if I cut dining",
      "what if I cut dining and groceries by 20%",
      "what if I cut dining to 3000",
      "what if my salary drops by 20%",
      "what if I buy something",
    ]) {
      const r = analyzeIntentText(text);
      expect(r.intent, text).toBe("what_if");
      expect(r.scenario, text).toBeNull();
      expect(r.needsClarification, text).toBe(true);
      expect(r.clarificationQuestion, text).toEqual(expect.any(String));
    }
  });

  it("flags saved changes for confirmation but never simulations", () => {
    const fix = analyzeIntentText("that Uber ride was actually travel, move it to travel");
    expect(fix).toMatchObject({ intent: "category_correction", category: "travel", requiresConfirmation: true });
    expect(analyzeIntentText("what if I cut dining by 20%").requiresConfirmation).toBe(false);
  });

  it("classifies questions, periods and unsafe requests", () => {
    expect(analyzeIntentText("how was last month")).toMatchObject({ intent: "monthly_review", period: { kind: "relative", value: "last_month" } });
    expect(analyzeIntentText("how much did I spend on groceries in September 2026")).toMatchObject({ intent: "spending_question", category: "groceries", period: { kind: "month", value: "2026-09" } });
    expect(analyzeIntentText("which stock should I buy to double my money").intent).toBe("unsafe_request");
    expect(analyzeIntentText("transfer money to my landlord").intent).toBe("unsafe_request");
    expect(analyzeIntentText("blah blah").intent).toBe("unknown");
  });

  it("supports follow-ups using the previous turn", () => {
    const r = analyzeIntentText("make it 40 percent", { intent: "what_if", amount: null, category: "dining" });
    expect(r).toMatchObject({ intent: "clarification_followup", category: "dining", scenario: { type: "reduce_category", category: "dining", percent: 40 } });
  });

  it("is deterministic and always returns a valid IntentAnalysis over the API", async () => {
    const text = "um I spend 4000 on swiggy actually 5000 what if I cut it by half";
    const a = await caller().inari.analyzeIntent({ text });
    const b = await caller().inari.analyzeIntent({ text });
    expect(a).toEqual(b);
    expect(a.implementation).toBe("implemented");
    expect(a.merchant).toBe("Swiggy");
  });
});

describe("simulate: arithmetic against hand-computed values", () => {
  it("cut dining 30%: expenses 58200, surplus 41800, rate 41.8, 12-month cash 501600", async () => {
    await seed();
    const r = await caller().inari.simulate({ scenarios: [{ type: "reduce_category", category: "dining", percent: 30 }] });
    expect(r.status).toBe("ok");
    expect(m(r, "Monthly expenses")).toMatchObject({ baseline: 60000, scenario: 58200, delta: -1800 });
    expect(m(r, "Monthly surplus")).toMatchObject({ baseline: 40000, scenario: 41800, delta: 1800 });
    expect(m(r, "Savings rate")).toMatchObject({ baseline: 40, scenario: 41.8, delta: 1.8 });
    expect(m(r, "Next 12 months: cash left over")).toMatchObject({ baseline: 480000, scenario: 501600 });
    expect(r.ledgerUnchanged).toBe(true);
    expect(r.assumptions.join(" ")).toMatch(/2026-07, 2026-08, 2026-09/);
  });

  it("combines scenarios: dining -30% and subscriptions -100% => expenses 57550, surplus 42450, rate 42.45", async () => {
    await seed();
    const r = await caller().inari.simulate({
      scenarios: [{ type: "reduce_category", category: "dining", percent: 30 }, { type: "reduce_category", category: "subscription", percent: 100 }],
    });
    expect(m(r, "Monthly expenses").scenario).toBe(57550);
    expect(m(r, "Monthly surplus").scenario).toBe(42450);
    expect(m(r, "Savings rate").scenario).toBe(42.45);
  });

  it("is order independent for commuting scenarios", async () => {
    await seed();
    const a = { type: "reduce_category", category: "dining", percent: 30 } as const;
    const b = { type: "change_income", deltaPerMonth: 10000 } as const;
    const r1 = await caller().inari.simulate({ scenarios: [a, b] });
    const r2 = await caller().inari.simulate({ scenarios: [b, a] });
    expect(r1.metrics).toEqual(r2.metrics);
  });

  it("caps a reduction at the category's actual spend and says so", async () => {
    await seed();
    const r = await caller().inari.simulate({ scenarios: [{ type: "reduce_category", category: "dining", amountPerMonth: 10000 }] });
    expect(m(r, "Monthly expenses").scenario).toBe(54000);
    expect(r.warnings.join(" ")).toMatch(/capped/);
    const twice = await caller().inari.simulate({
      scenarios: [{ type: "reduce_category", category: "dining", percent: 70 }, { type: "reduce_category", category: "dining", percent: 50 }],
    });
    expect(m(twice, "Monthly expenses").scenario).toBe(54000); // 4200 + 1800 remaining, never below zero spend
  });

  it("warns when a category has no spending", async () => {
    await seed();
    const r = await caller().inari.simulate({ scenarios: [{ type: "reduce_category", category: "travel", percent: 50 }] });
    expect(m(r, "Monthly expenses").delta).toBe(0);
    expect(r.warnings.join(" ")).toMatch(/No spending found in "travel"/);
  });

  it("income change: +10000 => surplus 50000, rate 45.45; clamps at zero", async () => {
    await seed();
    const up = await caller().inari.simulate({ scenarios: [{ type: "change_income", deltaPerMonth: 10000 }] });
    expect(m(up, "Monthly surplus").scenario).toBe(50000);
    expect(m(up, "Savings rate").scenario).toBe(45.45);
    const crash = await caller().inari.simulate({ scenarios: [{ type: "change_income", deltaPerMonth: -500000 }] });
    expect(m(crash, "Monthly income").scenario).toBe(0);
    expect(m(crash, "Savings rate").scenario).toBeNull();
    expect(crash.warnings.join(" ")).toMatch(/expenses exceed your income/);
  });

  it("one-off expense only affects the 12-month cash figure (and not if it lands after month 12)", async () => {
    await seed();
    const soon = await caller().inari.simulate({ scenarios: [{ type: "one_off_expense", amount: 30000, inMonths: 2 }] });
    expect(m(soon, "Monthly surplus").delta).toBe(0);
    expect(m(soon, "Next 12 months: cash left over").scenario).toBe(450000);
    const late = await caller().inari.simulate({ scenarios: [{ type: "one_off_expense", amount: 30000, inMonths: 18 }] });
    expect(m(late, "Next 12 months: cash left over").scenario).toBe(480000);
  });

  it("SIP lowers free cash but not the savings rate; oversized SIP warns", async () => {
    await seed();
    const r = await caller().inari.simulate({ scenarios: [{ type: "start_sip", amountPerMonth: 15000 }] });
    expect(m(r, "Free cash after SIP and debt payments")).toMatchObject({ baseline: 40000, scenario: 25000 });
    expect(m(r, "Savings rate").delta).toBe(0);
    const big = await caller().inari.simulate({ scenarios: [{ type: "start_sip", amountPerMonth: 50000 }] });
    expect(big.warnings.join(" ")).toMatch(/larger than your monthly surplus/);
  });

  it("debt payoff months need a known balance; unknown balance is flagged, never assumed", async () => {
    await seed();
    const unknown = await caller().inari.simulate({ scenarios: [{ type: "pay_down_debt", amountPerMonth: 10000 }] });
    expect(unknown.metrics.some(x => x.label.startsWith("Months to clear"))).toBe(false);
    expect(unknown.warnings.join(" ")).toMatch(/not provided/);
    await caller().inari.setBalances({ emergencyFund: 180000, investments: null, creditCardDebt: 60000 });
    const known = await caller().inari.simulate({ scenarios: [{ type: "pay_down_debt", amountPerMonth: 10000 }] });
    expect(m(known, "Months to clear card balance (no interest assumed)").scenario).toBe(6);
    expect(m(known, "Emergency fund covers (months of expenses)")).toMatchObject({ baseline: 3, scenario: 3 });
    const cut = await caller().inari.simulate({ scenarios: [{ type: "reduce_category", category: "dining", percent: 30 }] });
    expect(m(cut, "Emergency fund covers (months of expenses)").scenario).toBe(3.09); // 180000 / 58200
  });

  it("never changes the ledger or the snapshot", async () => {
    await seed();
    const before = JSON.stringify([await caller().inari.getSnapshot(), (await caller().inari.listTransactions({ limit: 200 })).items]);
    await caller().inari.simulate({ scenarios: [{ type: "reduce_category", category: "dining", percent: 100 }, { type: "change_income", deltaPerMonth: -1 }] });
    expect(JSON.stringify([await caller().inari.getSnapshot(), (await caller().inari.listTransactions({ limit: 200 })).items])).toBe(before);
  });

  it("returns insufficient_data (no invented numbers) with no import or only a partial month", async () => {
    const none = await caller().inari.simulate({ scenarios: [{ type: "reduce_category", category: "dining", percent: 30 }] });
    expect(none).toMatchObject({ status: "insufficient_data", metrics: [] });
    const p = await caller().inari.importPreview({ kind: "csv", filename: "h.csv", content: "Date,Description,Debit,Credit\n01/09/2026,NEFT SALARY,,100000.00\n05/09/2026,UPI/1/SWIGGY/x@y,300.00," });
    await caller().inari.importCommit({ previewId: p.previewId });
    const partial = await caller().inari.simulate({ scenarios: [{ type: "reduce_category", category: "dining", percent: 30 }] });
    expect(partial.status).toBe("insufficient_data");
    expect(partial.warnings.join(" ")).toMatch(/full calendar month/);
  });

  it("refuses scenarios that point at nothing real, with a stable error code", async () => {
    await seed();
    await expect(caller().inari.simulate({ scenarios: [{ type: "cancel_subscriptions", subscriptionIds: ["x"] }] })).rejects.toMatchObject({ message: expect.stringMatching(/not found/) });
    await expect(caller().inari.simulate({ scenarios: [{ type: "change_goal_contribution", goalId: "g", newMonthly: 1 }] })).rejects.toThrow(/goal was not found/i);
    await expect(caller().inari.simulate({ scenarios: [] as any })).rejects.toThrow();
    await expect(caller().inari.simulate({ scenarios: [{ type: "start_sip", amountPerMonth: 1e12 }] })).rejects.toThrow(/too large/);
  });

  it("one user's simulation uses only that user's data", async () => {
    await seed();
    const other = await caller("anon:00000000-0000-4000-8000-0000000000d2").inari.simulate({ scenarios: [{ type: "reduce_category", category: "dining", percent: 30 }] });
    expect(other.status).toBe("insufficient_data");
  });
});

describe("voice-style text -> scenario -> simulation, end to end", () => {
  it("'um what if I uh cut food delivery by thirty percent' => 58200 expenses", async () => {
    await seed();
    const intent = await caller().inari.analyzeIntent({ text: "um what if I uh cut food delivery by thirty percent" });
    expect(intent.scenario).not.toBeNull();
    const sim = await caller().inari.simulate({ scenarios: [intent.scenario!] });
    expect(m(sim, "Monthly expenses").scenario).toBe(58200);
  });
});

describe("multi-scenario safety, explicit data limits and evidence", () => {
  it("applies an identical repeated scenario once, and never touches the ledger or snapshot", async () => {
    await seed();
    const before = await caller().inari.getSnapshot();
    const txBefore = await caller().inari.listTransactions({ limit: 200 });
    const one = { type: "reduce_category" as const, category: "dining" as const, percent: 30 };
    const r = await caller().inari.simulate({ scenarios: [one, one, { type: "change_income", deltaPerMonth: 10000 }] });
    expect(r.scenarios).toHaveLength(2);
    expect(m(r, "Monthly expenses").scenario).toBe(58200); // 30% of 6000 once, not twice
    expect(m(r, "Monthly income").scenario).toBe(110000);
    expect(r.warnings.join(" ")).toMatch(/applied only once/);
    expect(await caller().inari.getSnapshot()).toEqual(before);
    expect((await caller().inari.listTransactions({ limit: 200 })).items).toEqual(txBefore.items);
  });

  it("states unknown balances, absent subscriptions and baseline evidence explicitly", async () => {
    await seed();
    const r = await caller().inari.simulate({ scenarios: [{ type: "reduce_category", category: "travel", percent: 50 }, { type: "start_sip", amountPerMonth: 5000 }] });
    const w = r.warnings.join(" ");
    expect(w).toMatch(/emergency-fund balance is not provided/);
    expect(w).toMatch(/investment balance is not provided/);
    expect(r.metrics.map(x => x.label)).not.toContain("Emergency fund covers (months of expenses)");
    expect(r.evidence?.[0]).toMatchObject({ code: "baseline_inputs" });
    expect(r.evidence?.[0].message).toMatch(/2026-07, 2026-08, 2026-09/);
    expect(r.assumptions.join(" ")).toMatch(/No investment returns/);
  });

  it("with no data the result is insufficient and carries a warning, not numbers", async () => {
    const r = await caller("anon:00000000-0000-4000-8000-0000000000e1").inari.simulate({ scenarios: [{ type: "change_income", deltaPerMonth: 1 }] });
    expect(r).toMatchObject({ status: "insufficient_data", metrics: [], ledgerUnchanged: true });
  });

  it("flags card repayments and suspected duplicates in evidence and warnings instead of presenting totals as certain", async () => {
    const key = "anon:00000000-0000-4000-8000-0000000000f7";
    const extra = ["Date,Description,Debit,Credit", ...[7, 8, 9].flatMap(mo => [
      `01/${p2(mo)}/2026,NEFT-ACME CORP SALARY,,100000.00`,
      `05/${p2(mo)}/2026,CREDIT CARD PAYMENT HDFC,15000.00,`,
      `10/${p2(mo)}/2026,UPI/9/SWIGGY/sw@bank,500.00,`,
      `10/${p2(mo)}/2026,SWIGGY ORDER 8812,500.00,`,
    ])].join("\n");
    const p = await caller(key).inari.importPreview({ kind: "csv", filename: "x.csv", content: extra });
    await caller(key).inari.importCommit({ previewId: p.previewId });
    const snap = await caller(key).inari.getSnapshot();
    const codes = snap.dataQuality.map(n => n.code);
    expect(codes).toContain("card_repayment_counted");
    expect(snap.dataQuality.find(n => n.code === "card_repayment_counted")?.transactionIds?.length).toBe(3);
    const r = await caller(key).inari.simulate({ scenarios: [{ type: "reduce_category", category: "dining", percent: 50 }] });
    expect(r.evidence?.map(n => n.code)).toContain("card_repayment_counted");
    expect(r.warnings.join(" ")).toMatch(/unresolved data-quality flag/);
  });
});

describe("suspected duplicates are flagged but still counted", () => {
  it("a re-worded second import of the same payments is flagged with ids and visible in simulation evidence", async () => {
    await seed();
    const reworded = CSV.replace(/UPI\/333\/SWIGGY\/sw@bank/g, "SWIGGY ORDER 7741");
    const p = await caller().inari.importPreview({ kind: "csv", filename: "again.csv", content: reworded });
    expect(p.counts.possibleDuplicate).toBe(3);
    await caller().inari.importCommit({ previewId: p.previewId });
    const snap = await caller().inari.getSnapshot();
    const note = snap.dataQuality.find(n => n.code === "possible_duplicates")!;
    expect(note.severity).toBe("warning");
    expect(note.transactionIds).toHaveLength(3);
    expect(note.message).toMatch(/ARE included in the totals/);
    expect(snap.monthlyExpenses).toBe(66000); // double-counted dining is visible, not hidden
    const r = await caller().inari.simulate({ scenarios: [{ type: "change_income", deltaPerMonth: 1 }] });
    expect(r.evidence?.map(n => n.code)).toContain("possible_duplicates");
  });
});
