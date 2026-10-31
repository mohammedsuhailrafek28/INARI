/**
 * Refund / reimbursement lifecycle hardening. Synthetic data; every expected figure is worked out by hand below.
 *
 * Fixture (today = 2026-10-31, October is still in progress and the data ends on 2026-10-20):
 *   Jul, Aug, Sep, Oct: salary 100000 on the 1st, rent 25000 on the 2nd.
 *   Sep 10: HEADPHONES 6000 (shopping).      Sep 12: DINNER 3000 (dining).
 *   Sep 20: UPI FRIEND SHARE credit 1000 (other income, same month as the dinner).
 *   Oct  8: UPI REFUND PART credit 2000 (other income, a different month from the headphones).
 *   Oct 15: UPI REFUND REST credit 4000 (other income).
 *
 * Baseline monthly figures (rupees):
 *   Sep: income 101000, expenses 25000+6000+3000 = 34000
 *   Oct: income 106000 (100000+2000+4000), expenses 25000     (October is partial)
 *   Jul/Aug: income 100000, expenses 25000
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";
import { FileLedgerRepository, setLedgerRepositoryForTests } from "./ledger";
import { _previewStoreForTests } from "./service";

const KEY = "anon:00000000-0000-4000-8000-0000000000b1";
const OTHER = "anon:00000000-0000-4000-8000-0000000000b2";
const as = (key = KEY) =>
  appRouter.createCaller({
    user: { id: 9, openId: "x", email: null, name: "D", loginMethod: "l", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
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

const rows = ["Date,Description,Debit,Credit"];
for (const m of ["07", "08", "09", "10"]) rows.push(`01/${m}/2026,NEFT ACME SALARY,,100000.00`, `02/${m}/2026,UPI/9/Rent to Landlord/rent@bank,25000.00,`);
rows.push(
  "10/09/2026,AMAZON PAY HEADPHONES ORDER,6000.00,",
  "12/09/2026,DINNER AT RESTAURANT,3000.00,",
  "20/09/2026,UPI/FRIEND SHARE/rahul@bank/dinner,,1000.00",
  "08/10/2026,UPI/REFUND PART/amz@bank/refund one,,2000.00",
  "15/10/2026,UPI/REFUND REST/amz@bank/refund two,,4000.00"
);

async function seed(key = KEY) {
  const c = as(key);
  const p = await c.inari.importPreview({ kind: "csv", filename: "h.csv", content: rows.join("\n") });
  await c.inari.importCommit({ previewId: p.previewId });
  const tx = (await c.inari.listTransactions({ limit: 200 })).items;
  const f = (re: RegExp) => tx.find(t => re.test(t.narration))!;
  return { c, headphones: f(/HEADPHONES/), dinner: f(/DINNER AT/), friend: f(/FRIEND SHARE/), part: f(/refund one/), rest: f(/refund two/), tx };
}
const month = async (c: ReturnType<typeof as>, m: string) => (await c.inari.monthlyReport({ month: m })).totals;
const snap = async (c: ReturnType<typeof as>) => {
  const s = await c.inari.getSnapshot();
  return { income: s.monthlyIncome, expenses: s.monthlyExpenses, surplus: s.monthlySurplus, rate: s.savingsRate, count: s.coverage.transactionCount };
};

describe("baseline fixture matches the hand-worked figures", () => {
  it("monthly totals and the 3-complete-month snapshot", async () => {
    const { c } = await seed();
    expect(await month(c, "2026-09")).toMatchObject({ income: 101000, expenses: 34000 });
    expect(await month(c, "2026-10")).toMatchObject({ income: 106000, expenses: 25000 });
    const s = await snap(c);
    // October is partial, so the snapshot averages Jul, Aug, Sep: income (100000+100000+101000)/3, expenses (25000+25000+34000)/3
    expect(s.income).toBe(100333.33);
    expect(s.expenses).toBe(28000);
  });
});

describe("refund: expected is not received", () => {
  it("a pending claim changes no total anywhere; the engine reports it as expected, not cash", async () => {
    const { c, headphones } = await seed();
    const before = { s: await snap(c), sep: await month(c, "2026-09"), oct: await month(c, "2026-10") };
    const { id } = await c.inari.createClaim({ kind: "refund", transactionId: headphones.id, expectedAmount: 6000, expectedDate: "2026-11-15" });
    expect({ s: await snap(c), sep: await month(c, "2026-09"), oct: await month(c, "2026-10") }).toEqual(before);
    const list = await c.inari.listClaims();
    expect(list.items[0]).toMatchObject({ id, status: "pending", receivedAmountPaise: 0, outstandingAmountPaise: 600000 });
    expect(list.summary.pendingRefundPaise).toBe(600000);
    const a = await c.inari.ask({ question: "Where is my refund?", locale: "en" });
    expect(a.answer).toMatch(/6,000/);
    expect(a.answer).toMatch(/not .*(received|counted)|expected|waiting|pending/i);
  });
});

describe("refund: partial then full settlement across months", () => {
  it("nets each confirmed credit in the month it arrives, never as income; statuses move pending -> partially_received -> received", async () => {
    const { c, headphones, part, rest } = await seed();
    const base = { oct: await month(c, "2026-10"), sep: await month(c, "2026-09"), s: await snap(c) };
    const { id } = await c.inari.createClaim({ kind: "refund", transactionId: headphones.id, expectedAmount: 6000 });

    // partial: 2000 of 6000 (credit arrived in October, the payment was in September)
    let list = await c.inari.confirmClaimMatch({ claimId: id, creditTransactionId: part.id });
    expect(list.items[0]).toMatchObject({ status: "partially_received", receivedAmountPaise: 200000, outstandingAmountPaise: 400000 });
    expect(list.summary.pendingRefundPaise).toBe(400000);
    let oct = await month(c, "2026-10");
    expect(oct.income).toBe(base.oct.income - 2000); // 104000: the credit is no longer income
    expect(oct.expenses).toBe(base.oct.expenses - 2000); // 23000: it reduces spending in the month it arrived
    expect(await month(c, "2026-09")).toEqual(base.sep); // the September payment month is untouched
    // surplus is conserved: income and expenses both fall by the same amount
    expect(oct.income - oct.expenses).toBe(base.oct.income - base.oct.expenses);

    // full: the remaining 4000
    list = await c.inari.confirmClaimMatch({ claimId: id, creditTransactionId: rest.id });
    expect(list.items[0]).toMatchObject({ status: "received", receivedAmountPaise: 600000, outstandingAmountPaise: 0 });
    oct = await month(c, "2026-10");
    expect(oct.income).toBe(100000);
    expect(oct.expenses).toBe(19000);

    // October is partial, so the 3-month snapshot (Jul-Sep) is unaffected by October settlements
    expect(await snap(c)).toEqual(base.s);

    // gross cash movement keeps both credits at full value
    const tx = (await c.inari.listTransactions({ limit: 200 })).items;
    expect(tx.find(t => t.id === part.id)!.amountPaise).toBe(200000);
    expect(tx.find(t => t.id === rest.id)!.amountPaise).toBe(400000);
  });

  it("undo releases exactly that credit; cancel releases the rest; totals return to baseline", async () => {
    const { c, headphones, part, rest } = await seed();
    const base = { oct: await month(c, "2026-10"), s: await snap(c) };
    const { id } = await c.inari.createClaim({ kind: "refund", transactionId: headphones.id, expectedAmount: 6000 });
    await c.inari.confirmClaimMatch({ claimId: id, creditTransactionId: part.id });
    await c.inari.confirmClaimMatch({ claimId: id, creditTransactionId: rest.id });
    let list = await c.inari.undoClaimMatch({ claimId: id, creditTransactionId: rest.id });
    expect(list.items[0]).toMatchObject({ status: "partially_received", receivedAmountPaise: 200000 });
    expect((await month(c, "2026-10")).expenses).toBe(base.oct.expenses - 2000);
    await c.inari.cancelClaim({ claimId: id });
    list = await c.inari.listClaims();
    expect(list.items.find(i => i.id === id)!.status).toBe("cancelled");
    expect(await month(c, "2026-10")).toEqual(base.oct);
    expect(await snap(c)).toEqual(base.s);
    // a cancelled claim frees the credits: they can be allocated to a new claim
    const again = await c.inari.createClaim({ kind: "refund", transactionId: headphones.id, expectedAmount: 6000 });
    const l2 = await c.inari.confirmClaimMatch({ claimId: again.id, creditTransactionId: part.id });
    expect(l2.items.find(i => i.id === again.id)!.receivedAmountPaise).toBe(200000);
  });
});

describe("idempotency and allocation limits", () => {
  it("confirming the same credit twice does not double-count, and a credit cannot be allocated beyond its amount", async () => {
    const { c, headphones, dinner, part } = await seed();
    const refund = await c.inari.createClaim({ kind: "refund", transactionId: headphones.id, expectedAmount: 6000 });
    await c.inari.confirmClaimMatch({ claimId: refund.id, creditTransactionId: part.id });
    const after1 = { oct: await month(c, "2026-10"), list: await c.inari.listClaims() };
    // Repeating the confirmation must not take another 2000 from the same 2000 credit.
    let repeated: unknown;
    try { repeated = await c.inari.confirmClaimMatch({ claimId: refund.id, creditTransactionId: part.id }); } catch (e) { repeated = e; }
    expect(await month(c, "2026-10")).toEqual(after1.oct);
    const claim = (await c.inari.listClaims()).items.find(i => i.id === refund.id)!;
    expect(claim.receivedAmountPaise).toBe(200000);
    expect(claim.settlements.reduce((s, x) => s + x.amountPaise, 0)).toBeLessThanOrEqual(200000);
    expect(repeated).toBeDefined();
    // A different claim cannot use the spent credit either.
    const reimb = await c.inari.createClaim({ kind: "reimbursement", transactionId: dinner.id, expectedAmount: 2000 });
    await expect(c.inari.confirmClaimMatch({ claimId: reimb.id, creditTransactionId: part.id })).rejects.toBeTruthy();
    expect((await month(c, "2026-10")).expenses).toBe(23000);
  });
});

describe("reimbursement: same-month settlement", () => {
  it("1000 of a 3000 dinner paid back in the same month nets inside September, not income", async () => {
    const { c, dinner, friend } = await seed();
    const base = { sep: await month(c, "2026-09"), s: await snap(c) };
    const { id } = await c.inari.createClaim({ kind: "reimbursement", transactionId: dinner.id, expectedAmount: 2000, counterparty: "Rahul" });
    expect(await month(c, "2026-09")).toEqual(base.sep); // expected money is not cash
    const list = await c.inari.confirmClaimMatch({ claimId: id, creditTransactionId: friend.id });
    expect(list.items[0]).toMatchObject({ status: "partially_received", receivedAmountPaise: 100000, outstandingAmountPaise: 100000 });
    const sep = await month(c, "2026-09");
    expect(sep.income).toBe(100000); // 101000 - 1000
    expect(sep.expenses).toBe(33000); // 34000 - 1000
    expect(list.summary).toMatchObject({ grossReimbursableSpendPaise: 300000, personalShareOfReimbursablePaise: 100000, confirmedReimbursementSettlementsPaise: 100000 });
    // snapshot, advisor and simulation use the same netted figures: Jul-Sep income (100000+100000+100000)/3, expenses (25000+25000+33000)/3
    const s = await snap(c);
    expect(s.income).toBe(100000);
    expect(s.expenses).toBe(27666.67);
    const adv = await c.inari.ask({ question: "what is my savings rate", locale: "en" });
    expect(adv.answer).toContain("₹1,00,000");
    expect(adv.answer).toContain("₹27,667");
    const sim = await c.inari.simulate({ scenarios: [{ type: "change_income", deltaPerMonth: -10000 }] });
    const surplus = sim.metrics.find(m => /surplus/i.test(m.label))!;
    expect(surplus.baseline).toBe(s.surplus);
    // undo restores everything
    await c.inari.undoClaimMatch({ claimId: id, creditTransactionId: friend.id });
    expect(await month(c, "2026-09")).toEqual(base.sep);
    expect(await snap(c)).toEqual(base.s);
  });
});

describe("partial-month reporting", () => {
  it("October's report is flagged partial and still shows the netted figures; the advisor says October is left out of averages", async () => {
    const { c, headphones, part } = await seed();
    const { id } = await c.inari.createClaim({ kind: "refund", transactionId: headphones.id, expectedAmount: 6000 });
    await c.inari.confirmClaimMatch({ claimId: id, creditTransactionId: part.id });
    const r = await c.inari.monthlyReport({ month: "2026-10" });
    expect(r.totals).toMatchObject({ income: 104000, expenses: 23000 });
    expect(r.period?.partial).toBe(true);
    const adv = await c.inari.ask({ question: "what is my savings rate", locale: "en" });
    expect(adv.assumptions.join(" ")).toMatch(/October 2026.*(in progress|partly covered)/);
  });
});

describe("isolation", () => {
  it("another user cannot see, confirm or cancel these claims", async () => {
    const { c, headphones, part } = await seed();
    const { id } = await c.inari.createClaim({ kind: "refund", transactionId: headphones.id, expectedAmount: 6000 });
    expect((await as(OTHER).inari.listClaims()).items).toHaveLength(0);
    await expect(as(OTHER).inari.confirmClaimMatch({ claimId: id, creditTransactionId: part.id })).rejects.toBeTruthy();
    await expect(as(OTHER).inari.cancelClaim({ claimId: id })).rejects.toBeTruthy();
    expect((await c.inari.listClaims()).items[0].status).toBe("pending");
  });
});
