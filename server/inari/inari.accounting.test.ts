/**
 * Accounting for confirmed refund / reimbursement settlements. Synthetic data only.
 * Expected figures are worked out by hand from the CSV rows below, not read from the API.
 *
 * Treatment under test:
 *  - gross cash movement (listTransactions) never changes;
 *  - a confirmed settlement is netted against the linked payment's expense and is NOT income;
 *  - expected / unconfirmed / cancelled claims change nothing;
 *  - undo and cancel restore the original totals exactly;
 *  - snapshot, report, breakdown, simulation baseline and advisor agree.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";
import { FileLedgerRepository, setLedgerRepositoryForTests } from "./ledger";
import { _previewStoreForTests } from "./service";

const KEY = "anon:00000000-0000-4000-8000-0000000000e9";
const as = () =>
  appRouter.createCaller({
    user: { id: 9, openId: "x", email: null, name: "D", loginMethod: "l", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "http", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
    inariUserKey: KEY,
    inariIdentityKind: "anonymous_demo",
  } as TrpcContext);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-02T10:00:00Z"));
  setLedgerRepositoryForTests(new FileLedgerRepository());
  _previewStoreForTests.clear();
});
afterEach(() => vi.useRealTimers());

// Aug, Sep, Oct each: salary 100,000 on the 1st and Swiggy 6,000 on the 10th.
// Oct extras: headphones 4,500 (shopping), dinner 3,000 (dining), Amazon refund credit 4,500 (booked as shopping, so already netted),
// an unrelated "friend return" credit 4,500 (other income), two dinner-share credits 1,200 + 800 (other income), chai 100 on the 31st.
const rows = ["Date,Description,Debit,Credit"];
for (const m of ["08", "09", "10"]) rows.push(`01/${m}/2026,NEFT ACME SALARY,,100000.00`, `10/${m}/2026,UPI/3/SWIGGY/sw@bank,6000.00,`);
rows.push(
  "02/10/2026,AMAZON PAY HEADPHONES ORDER,4500.00,",
  "05/10/2026,DINNER AT RESTAURANT,3000.00,",
  "08/10/2026,AMAZON REFUND ORDER 4455,,4500.00",
  "09/10/2026,UPI/FRIEND RETURN/rahul@bank,,4500.00",
  "12/10/2026,UPI/RAHUL/rahul@bank/dinner share,,1200.00",
  "13/10/2026,UPI/RAHUL/rahul@bank/dinner share two,,800.00",
  "31/10/2026,UPI/CHAI POINT/c@bank,100.00,"
);
const CSV = rows.join("\n");

// Hand-computed October figures (rupees).
const OCT_BASE = { income: 106500, expenses: 9100, dining: 9100 }; // 100000+4500+1200+800 ; 6000+4500+3000+100-4500
const rupees = (n: number) => Math.round(n * 100) / 100;

async function seed() {
  const c = as();
  const p = await c.inari.importPreview({ kind: "csv", filename: "s.csv", content: CSV });
  await c.inari.importCommit({ previewId: p.previewId });
  const tx = (await c.inari.listTransactions({ limit: 200 })).items;
  const f = (re: RegExp) => tx.find(t => re.test(t.narration))!;
  return { c, dinner: f(/DINNER AT/), headphones: f(/HEADPHONES/), refund: f(/AMAZON REFUND/), share1: f(/dinner share$/), share2: f(/share two/), friend: f(/FRIEND RETURN/), all: tx };
}
const figures = async (c: ReturnType<typeof as>) => {
  const r = await c.inari.monthlyReport({ month: "2026-10" });
  const s = await c.inari.getSnapshot();
  const b = await c.inari.getBreakdown({ month: "2026-10" });
  return { income: r.totals.income, expenses: r.totals.expenses, dining: b.items.find(i => i.category === "dining")?.amount ?? 0, snapIncome: s.monthlyIncome, snapExpenses: s.monthlyExpenses, snapSurplus: s.monthlySurplus, count: s.coverage.transactionCount };
};

describe("baseline (no claims)", () => {
  it("matches the hand-computed October figures", async () => {
    const { c } = await seed();
    const f = await figures(c);
    expect(f).toMatchObject({ income: OCT_BASE.income, expenses: OCT_BASE.expenses, dining: OCT_BASE.dining });
    expect(f.snapIncome).toBe(rupees((100000 + 100000 + OCT_BASE.income) / 3));
    expect(f.snapExpenses).toBe(rupees((6000 + 6000 + OCT_BASE.expenses) / 3));
  });
});

describe("reimbursement settlement", () => {
  it("creating a claim changes nothing; confirming nets the credit against the dinner, not income", async () => {
    const { c, dinner, share1, share2 } = await seed();
    const base = await figures(c);
    const { id } = await c.inari.createClaim({ kind: "reimbursement", transactionId: dinner.id, expectedAmount: 2000, counterparty: "Rahul" });
    expect(await figures(c)).toEqual(base);

    await c.inari.confirmClaimMatch({ claimId: id, creditTransactionId: share1.id });
    let f = await figures(c);
    expect(f.income).toBe(OCT_BASE.income - 1200);
    expect(f.expenses).toBe(OCT_BASE.expenses - 1200);
    expect(f.dining).toBe(OCT_BASE.dining - 1200);

    await c.inari.confirmClaimMatch({ claimId: id, creditTransactionId: share2.id });
    f = await figures(c);
    expect(f).toMatchObject({ income: 104500, expenses: 7100, dining: 7100 });
    expect(f.snapIncome).toBe(rupees((100000 + 100000 + 104500) / 3));
    expect(f.snapExpenses).toBe(rupees((6000 + 6000 + 7100) / 3));
    expect(f.snapSurplus).toBe(rupees(f.snapIncome! - f.snapExpenses!));
    expect(f.count).toBe(base.count); // no phantom rows
  });

  it("surplus is unchanged by a settlement that was previously booked as income (income and expense both fall)", async () => {
    const { c, dinner, share1, share2 } = await seed();
    const before = await figures(c);
    const { id } = await c.inari.createClaim({ kind: "reimbursement", transactionId: dinner.id, expectedAmount: 2000 });
    await c.inari.confirmClaimMatch({ claimId: id, creditTransactionId: share1.id });
    await c.inari.confirmClaimMatch({ claimId: id, creditTransactionId: share2.id });
    const after = await figures(c);
    expect(Math.abs(after.snapSurplus! - before.snapSurplus!)).toBeLessThanOrEqual(0.011); // rounding of two separately rounded means
    expect(after.snapIncome!).toBeLessThan(before.snapIncome!);
  });

  it("gross cash movement is untouched, and the claims summary reports gross, personal share and confirmed settlements", async () => {
    const { c, dinner, share1, share2, all } = await seed();
    const { id } = await c.inari.createClaim({ kind: "reimbursement", transactionId: dinner.id, expectedAmount: 2000 });
    await c.inari.confirmClaimMatch({ claimId: id, creditTransactionId: share1.id });
    await c.inari.confirmClaimMatch({ claimId: id, creditTransactionId: share2.id });
    const after = (await c.inari.listTransactions({ limit: 200 })).items;
    expect(after.map(t => [t.id, t.amountPaise, t.category])).toEqual(all.map(t => [t.id, t.amountPaise, t.category]));
    const { summary } = await c.inari.listClaims();
    expect(summary).toMatchObject({ grossReimbursableSpendPaise: 300000, personalShareOfReimbursablePaise: 100000, outstandingReimbursementPaise: 0, confirmedReimbursementSettlementsPaise: 200000, confirmedRefundSettlementsPaise: 0 });
    const notes = (await c.inari.getSnapshot()).dataQuality.find(n => n.code === "claims_netted");
    expect(notes?.message).toMatch(/not counted as income/);
  });

  it("undo and cancel restore the original totals exactly", async () => {
    const { c, dinner, share1 } = await seed();
    const base = await figures(c);
    const { id } = await c.inari.createClaim({ kind: "reimbursement", transactionId: dinner.id, expectedAmount: 2000 });
    await c.inari.confirmClaimMatch({ claimId: id, creditTransactionId: share1.id });
    expect((await figures(c)).income).toBe(OCT_BASE.income - 1200);
    await c.inari.undoClaimMatch({ claimId: id, creditTransactionId: share1.id });
    expect(await figures(c)).toEqual(base);
    await c.inari.confirmClaimMatch({ claimId: id, creditTransactionId: share1.id });
    await c.inari.cancelClaim({ claimId: id });
    expect(await figures(c)).toEqual(base);
  });

  it("one credit split across two payments nets each part against its own payment and never beyond the credit", async () => {
    const { c, dinner, headphones, friend } = await seed();
    const d = await c.inari.createClaim({ kind: "reimbursement", transactionId: dinner.id, expectedAmount: 1000 });
    const h = await c.inari.createClaim({ kind: "reimbursement", transactionId: headphones.id, expectedAmount: 3000 });
    await c.inari.confirmClaimMatch({ claimId: d.id, creditTransactionId: friend.id, amount: 1000 });
    await c.inari.confirmClaimMatch({ claimId: h.id, creditTransactionId: friend.id, amount: 3000 });
    const f = await figures(c);
    expect(f.income).toBe(OCT_BASE.income - 4000); // the 4,500 credit: 4,000 settled, 500 still ordinary income
    expect(f.dining).toBe(OCT_BASE.dining - 1000);
    expect(f.expenses).toBe(OCT_BASE.expenses - 4000);
    await expect(c.inari.confirmClaimMatch({ claimId: d.id, creditTransactionId: friend.id, amount: 1000 })).rejects.toThrow();
  });
});

describe("refund settlement", () => {
  it("confirming a refund whose credit is already netted as shopping does not net it twice", async () => {
    const { c, headphones, refund } = await seed();
    const base = await figures(c);
    const { id } = await c.inari.createClaim({ kind: "refund", transactionId: headphones.id, expectedAmount: 4500 });
    await c.inari.confirmClaimMatch({ claimId: id, creditTransactionId: refund.id });
    expect(await figures(c)).toEqual(base);
  });

  it("a refund booked as income is moved out of income when confirmed", async () => {
    const { c, headphones, friend } = await seed();
    const base = await figures(c);
    const { id } = await c.inari.createClaim({ kind: "refund", transactionId: headphones.id, expectedAmount: 500 });
    await c.inari.confirmClaimMatch({ claimId: id, creditTransactionId: friend.id, amount: 500 });
    const f = await figures(c);
    expect(f.income).toBe(base.income - 500);
    expect(f.expenses).toBe(base.expenses - 500);
  });
});

describe("consistency across modules", () => {
  it("simulation baseline, advisor and report all use the netted figures; hypotheticals do not mutate", async () => {
    const { c, dinner, share1, share2 } = await seed();
    const { id } = await c.inari.createClaim({ kind: "reimbursement", transactionId: dinner.id, expectedAmount: 2000 });
    await c.inari.confirmClaimMatch({ claimId: id, creditTransactionId: share1.id });
    await c.inari.confirmClaimMatch({ claimId: id, creditTransactionId: share2.id });
    const snap = await c.inari.getSnapshot();
    const sim = await c.inari.simulate({ scenarios: [{ type: "change_income", deltaPerMonth: 1 }] });
    const surplus = sim.metrics.find(m => /surplus/i.test(m.label) && m.unit === "inr")!;
    expect(surplus.baseline).toBe(snap.monthlySurplus);
    const ask = await c.inari.ask({ question: "Give me my monthly review for October", locale: "en" });
    expect(ask.answer).toMatch(/7,100/);
    expect(await c.inari.getSnapshot()).toEqual(snap);
  });

  it("a user who has no claims sees exactly the old numbers (existing totals unchanged)", async () => {
    const { c } = await seed();
    const f = await figures(c);
    expect(f.income).toBe(106500);
    expect(f.expenses).toBe(9100);
  });
});
