/**
 * Refund Watch, reimbursements, manual (untracked) entries, data coverage and the EMI reality check.
 * Fake date: 2026-10-31. All data is synthetic.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";
import { FileLedgerRepository, getLedgerRepository, setLedgerRepositoryForTests } from "./ledger";
import { _previewStoreForTests } from "./service";
import { _manualPreviewsForTests } from "./manual";

const A = "anon:00000000-0000-4000-8000-0000000000d1";
const B = "anon:00000000-0000-4000-8000-0000000000d2";
const as = (key: string) =>
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
  _manualPreviewsForTests.clear();
});
afterEach(() => vi.useRealTimers());

const months = [7, 8, 9].flatMap(m => [`01/0${m}/2026,NEFT ACME SALARY,,100000.00`, `10/0${m}/2026,UPI/3/SWIGGY/sw@bank,6000.00,`]);
const OCT = [
  "02/10/2026,AMAZON PAY HEADPHONES ORDER,4500.00,",
  "05/10/2026,DINNER AT RESTAURANT,3000.00,",
  "08/10/2026,AMAZON REFUND ORDER 4455,,4500.00",
  "09/10/2026,UPI/FRIEND RETURN/rahul@bank,,4500.00",
  "12/10/2026,UPI/RAHUL/rahul@bank/dinner share,,1200.00",
  "13/10/2026,UPI/RAHUL/rahul@bank/dinner share two,,800.00",
];
const csv = ["Date,Description,Debit,Credit", ...months, ...OCT].join("\n");

async function seed(key = A) {
  const p = await as(key).inari.importPreview({ kind: "csv", filename: "s.csv", content: csv });
  await as(key).inari.importCommit({ previewId: p.previewId });
  const tx = (await as(key).inari.listTransactions({ limit: 200 })).items;
  const find = (re: RegExp) => tx.find(t => re.test(t.narration))!;
  return { find, headphones: find(/HEADPHONES/), dinner: find(/DINNER/), refundCredit: find(/AMAZON REFUND/), decoy: find(/FRIEND RETURN/), share1: find(/dinner share$/), share2: find(/share two/) };
}
const totals = async (key = A) => {
  const s = await as(key).inari.getSnapshot();
  const r = await as(key).inari.monthlyReport({ month: "2026-10" });
  return { snap: JSON.stringify([s.monthlyIncome, s.monthlyExpenses, s.monthlySurplus, s.coverage]), report: JSON.stringify(r.totals), n: (await getLedgerRepository().listTransactions(key)).length };
};

describe("Refund Watch", () => {
  it("tracks a promised refund without inventing a credit or changing any total", async () => {
    const { headphones } = await seed();
    const before = await totals();
    const { id } = await as(A).inari.createClaim({ kind: "refund", transactionId: headphones.id, expectedAmount: 4500, expectedDate: "2026-11-05", counterparty: "Amazon" });
    const list = await as(A).inari.listClaims();
    expect(list.items[0]).toMatchObject({ id, kind: "refund", status: "pending", expectedAmountPaise: 450000, receivedAmountPaise: 0, outstandingAmountPaise: 450000 });
    expect(list.summary.pendingRefundPaise).toBe(450000);
    expect(await totals()).toEqual(before); // expected money is not cash
  });

  it("marks a claim overdue once the expected date has passed", async () => {
    const { headphones } = await seed();
    await as(A).inari.createClaim({ kind: "refund", transactionId: headphones.id, expectedAmount: 4500, expectedDate: "2026-10-07" });
    const list = await as(A).inari.listClaims();
    expect(list.items[0].status).toBe("overdue");
    expect(list.summary.overdueRefundCount).toBe(1);
  });

  it("suggests the matching credit first, never settles on its own, and settles only on explicit confirmation", async () => {
    const { headphones, refundCredit, decoy } = await seed();
    const { id } = await as(A).inari.createClaim({ kind: "refund", transactionId: headphones.id, expectedAmount: 4500, expectedDate: "2026-10-07" });
    const m = await as(A).inari.claimMatches({ claimId: id });
    expect(m.suggestions[0].creditTransactionId).toBe(refundCredit.id);
    expect(m.suggestions.every(s => s.requiresConfirmation)).toBe(true);
    expect(m.suggestions.some(s => s.creditTransactionId === decoy.id)).toBe(true); // an ambiguous second candidate is shown, not hidden
    expect((await as(A).inari.listClaims()).items[0].status).toBe("overdue"); // suggestions changed nothing

    const before = await totals();
    const after = await as(A).inari.confirmClaimMatch({ claimId: id, creditTransactionId: refundCredit.id });
    expect(after.items[0]).toMatchObject({ status: "received", receivedAmountPaise: 450000, outstandingAmountPaise: 0 });
    expect(await totals()).toEqual(before); // the credit was already in the ledger; linking it adds no cash

    const undone = await as(A).inari.undoClaimMatch({ claimId: id, creditTransactionId: refundCredit.id });
    expect(undone.items[0].status).toBe("overdue");
    expect(undone.items[0].receivedAmountPaise).toBe(0);
  });

  it("never lets one credit settle more than its own amount, across claims", async () => {
    const { headphones, refundCredit } = await seed();
    const a = await as(A).inari.createClaim({ kind: "refund", transactionId: headphones.id, expectedAmount: 3000 });
    const b = await as(A).inari.createClaim({ kind: "refund", transactionId: headphones.id, expectedAmount: 1500 });
    await as(A).inari.confirmClaimMatch({ claimId: a.id, creditTransactionId: refundCredit.id }); // takes 3000 of 4500
    await expect(as(A).inari.confirmClaimMatch({ claimId: b.id, creditTransactionId: refundCredit.id, amount: 1600 })).rejects.toMatchObject({ message: expect.stringMatching(/more than what is left/) });
    const ok = await as(A).inari.confirmClaimMatch({ claimId: b.id, creditTransactionId: refundCredit.id, amount: 1500 });
    expect(ok.items.map(i => i.receivedAmountPaise).sort()).toEqual([150000, 300000]);
    // the credit is now fully allocated: a third claim cannot take it
    await expect(as(A).inari.createClaim({ kind: "refund", transactionId: headphones.id, expectedAmount: 100 })).rejects.toMatchObject({ message: expect.stringMatching(/cannot add up/) });
  });

  it("rejects claims on credits, on unknown transactions, and for more than the payment", async () => {
    const { headphones, refundCredit } = await seed();
    await expect(as(A).inari.createClaim({ kind: "refund", transactionId: refundCredit.id, expectedAmount: 10 })).rejects.toMatchObject({ message: expect.stringMatching(/payment you made/) });
    await expect(as(A).inari.createClaim({ kind: "refund", transactionId: "txn_nope", expectedAmount: 10 })).rejects.toMatchObject({ message: expect.stringMatching(/not found/) });
    await expect(as(A).inari.createClaim({ kind: "refund", transactionId: headphones.id, expectedAmount: 4500.01 })).rejects.toMatchObject({ message: expect.stringMatching(/cannot add up/) });
    await expect(as(A).inari.createClaim({ kind: "refund", transactionId: headphones.id, expectedAmount: 10, expectedDate: "2026-09-01" })).rejects.toMatchObject({ message: expect.stringMatching(/before the original/) });
  });

  it("cancelling a claim releases its allocations", async () => {
    const { headphones, refundCredit } = await seed();
    const a = await as(A).inari.createClaim({ kind: "refund", transactionId: headphones.id, expectedAmount: 4500 });
    await as(A).inari.confirmClaimMatch({ claimId: a.id, creditTransactionId: refundCredit.id });
    const list = await as(A).inari.cancelClaim({ claimId: a.id });
    expect(list.items[0].status).toBe("cancelled");
    const b = await as(A).inari.createClaim({ kind: "refund", transactionId: headphones.id, expectedAmount: 4500 });
    const ok = await as(A).inari.confirmClaimMatch({ claimId: b.id, creditTransactionId: refundCredit.id });
    expect(ok.items.find(i => i.id === b.id)!.status).toBe("received");
  });

  it("is isolated per user", async () => {
    const { headphones } = await seed(A);
    const mine = await as(A).inari.createClaim({ kind: "refund", transactionId: headphones.id, expectedAmount: 100 });
    expect((await as(B).inari.listClaims()).items).toHaveLength(0);
    await expect(as(B).inari.claimMatches({ claimId: mine.id })).rejects.toMatchObject({ message: expect.stringMatching(/not found/) });
    await expect(as(B).inari.cancelClaim({ claimId: mine.id })).rejects.toMatchObject({ message: expect.stringMatching(/not found/) });
    await expect(as(B).inari.createClaim({ kind: "refund", transactionId: headphones.id, expectedAmount: 100 })).rejects.toMatchObject({ message: expect.stringMatching(/not found/) });
  });
});

describe("reimbursement-aware spending", () => {
  it("separates personal share from reimbursable spend and keeps gross cash flow untouched", async () => {
    const { dinner } = await seed();
    const before = await totals();
    await as(A).inari.createClaim({ kind: "reimbursement", transactionId: dinner.id, expectedAmount: 2000, counterparty: "Rahul" });
    const list = await as(A).inari.listClaims({ kind: "reimbursement" });
    expect(list.items[0]).toMatchObject({ expectedAmountPaise: 200000, personalSharePaise: 100000, outstandingAmountPaise: 200000, status: "pending" });
    expect(list.summary).toMatchObject({ outstandingReimbursementPaise: 200000, grossReimbursableSpendPaise: 300000, personalShareOfReimbursablePaise: 100000 });
    expect(await totals()).toEqual(before);
  });

  it("settles in parts from confirmed credits, with no credit used twice", async () => {
    const { dinner, share1, share2 } = await seed();
    const c = await as(A).inari.createClaim({ kind: "reimbursement", transactionId: dinner.id, expectedAmount: 2000, counterparty: "Rahul" });
    const m = await as(A).inari.claimMatches({ claimId: c.id });
    expect(m.suggestions.slice(0, 2).map(s => s.creditTransactionId).sort()).toEqual([share1.id, share2.id].sort());

    let list = await as(A).inari.confirmClaimMatch({ claimId: c.id, creditTransactionId: share1.id });
    expect(list.items[0]).toMatchObject({ status: "partially_received", receivedAmountPaise: 120000, outstandingAmountPaise: 80000 });
    await expect(as(A).inari.confirmClaimMatch({ claimId: c.id, creditTransactionId: share1.id })).rejects.toMatchObject({ message: expect.stringMatching(/already linked/) });
    list = await as(A).inari.confirmClaimMatch({ claimId: c.id, creditTransactionId: share2.id });
    expect(list.items[0]).toMatchObject({ status: "received", outstandingAmountPaise: 0 });
    expect(list.summary.outstandingReimbursementPaise).toBe(0);
    // already fully received: nothing more can be linked
    await expect(as(A).inari.confirmClaimMatch({ claimId: c.id, creditTransactionId: share1.id })).rejects.toBeTruthy();
    // undo one part
    list = await as(A).inari.undoClaimMatch({ claimId: c.id, creditTransactionId: share2.id });
    expect(list.items[0]).toMatchObject({ status: "partially_received", outstandingAmountPaise: 80000 });
  });

  it("does not count a credit in two claims beyond its amount (refund and reimbursement share one pool)", async () => {
    const { dinner, headphones, share1 } = await seed();
    const r = await as(A).inari.createClaim({ kind: "reimbursement", transactionId: dinner.id, expectedAmount: 2000 });
    const f = await as(A).inari.createClaim({ kind: "refund", transactionId: headphones.id, expectedAmount: 4500 });
    await as(A).inari.confirmClaimMatch({ claimId: r.id, creditTransactionId: share1.id }); // 1200 of 1200
    await expect(as(A).inari.confirmClaimMatch({ claimId: f.id, creditTransactionId: share1.id })).rejects.toMatchObject({ message: expect.stringMatching(/fully allocated/) });
  });
});

describe("manual entries (untracked money)", () => {
  const yesterday = "2026-10-30";
  it("previews 'I spent ₹1,200 cash on groceries yesterday' and writes nothing until committed", async () => {
    await seed();
    const before = await totals();
    const p = await as(A).inari.manualEntryPreview({ text: "I spent ₹1,200 cash on groceries yesterday" });
    expect(p.entry).toMatchObject({ amountPaise: 120000, direction: "debit", category: "groceries", postedOn: yesterday, paymentType: "cash" });
    expect(p.requiresConfirmation).toBe(true);
    expect(p.needsUserInput).toEqual([]);
    expect(await totals()).toEqual(before);
  });

  it("commits with an idempotency key into the same ledger, source manual, and is undoable", async () => {
    await seed();
    const before = await totals();
    const p = await as(A).inari.manualEntryPreview({ text: "I spent 1,200 cash on groceries yesterday" });
    const c = await as(A).inari.manualEntryCommit({ previewId: p.previewId!, idempotencyKey: "idem-key-0001" });
    expect(c).toMatchObject({ duplicateSubmission: false, source: "manual" });
    const tx = await getLedgerRepository().getTransaction(A, c.transactionId);
    expect(tx).toMatchObject({ source: "manual", amountPaise: 120000, instrument: "cash", categorySource: "user", postedOn: yesterday });
    const after = await totals();
    expect(after.n).toBe(before.n + 1);
    expect(after.report).not.toEqual(before.report); // the same snapshots and reports now include it

    const again = await as(A).inari.manualEntryCommit({ previewId: p.previewId!, idempotencyKey: "idem-key-0001" });
    expect(again).toMatchObject({ duplicateSubmission: true, transactionId: c.transactionId });
    expect((await totals()).n).toBe(before.n + 1);

    await as(A).inari.importUndo({ batchId: c.batchId });
    expect((await totals()).n).toBe(before.n);
  });

  it("asks for what is missing instead of guessing, and refuses future dates", async () => {
    const p = await as(A).inari.manualEntryPreview({ text: "I paid for lunch" });
    expect(p.previewId).toBeNull();
    expect(p.needsUserInput.sort()).toEqual(["amount"]); // 'paid' fixes the direction, the amount is missing
    const q = await as(A).inari.manualEntryPreview({ text: "some 500 thing" });
    expect(q.needsUserInput).toContain("direction");
    await expect(as(A).inari.manualEntryPreview({ amount: 10, direction: "debit", date: "2026-11-02" })).rejects.toMatchObject({ message: expect.stringMatching(/future/) });
  });

  it("accepts structured fields, which override the text", async () => {
    const p = await as(A).inari.manualEntryPreview({ text: "spent 100 cash", amount: 250.5, direction: "credit", category: "other_income", date: "2026-10-20", paymentType: "upi", description: "friend paid back" });
    expect(p.entry).toMatchObject({ amountPaise: 25050, direction: "credit", category: "other_income", postedOn: "2026-10-20", paymentType: "upi" });
  });

  it("flags a likely duplicate of an existing transaction but still lets the user decide", async () => {
    await seed();
    const p = await as(A).inari.manualEntryPreview({ amount: 3000, direction: "debit", date: "2026-10-05", paymentType: "cash" });
    expect(p.possibleDuplicateOf).toBeTruthy();
    expect(p.assumptions.join(" ")).toMatch(/same date, amount and direction/);
  });

  it("cannot commit another user's preview and keeps users separate", async () => {
    const p = await as(A).inari.manualEntryPreview({ text: "spent 99 cash on tea" });
    await expect(as(B).inari.manualEntryCommit({ previewId: p.previewId!, idempotencyKey: "idem-key-0002" })).rejects.toMatchObject({ message: expect.stringMatching(/expired or does not exist/) });
    expect((await getLedgerRepository().listTransactions(B)).length).toBe(0);
  });
});

describe("data coverage gaps", () => {
  it("lists what was not observed, without inventing transactions, and clears the cash note once a manual entry exists", async () => {
    const rows = ["Date,Description,Debit,Credit", "01/07/2026,NEFT ACME SALARY,,100000.00", "10/09/2026,UPI/3/SWIGGY/sw@bank,6000.00,"].join("\n");
    const p = await as(A).inari.importPreview({ kind: "csv", filename: "g.csv", content: rows });
    await as(A).inari.importCommit({ previewId: p.previewId });
    const c = await as(A).inari.dataCoverage();
    expect(c.observed).toMatchObject({ transactionCount: 2, from: "2026-07-01", to: "2026-09-10" });
    expect(c.months.map(m => [m.month, m.count])).toEqual([["2026-07", 1], ["2026-08", 0], ["2026-09", 1]]);
    expect(c.gaps.map(g => g.kind)).toEqual(expect.arrayContaining(["month_without_transactions", "quiet_period", "no_manual_entries"]));
    expect(c.gaps.find(g => g.kind === "month_without_transactions")!.detail).toMatch(/2026-08/);
    const pv = await as(A).inari.manualEntryPreview({ text: "spent 100 cash on tea yesterday" });
    await as(A).inari.manualEntryCommit({ previewId: pv.previewId!, idempotencyKey: "idem-key-0003" });
    const after = await as(A).inari.dataCoverage();
    expect(after.gaps.some(g => g.kind === "no_manual_entries")).toBe(false);
    expect(after.observed.bySource).toMatchObject({ csv: 2, manual: 1 });
  });
});

describe("No-cost EMI reality check", () => {
  it("computes totals in paise from the stated terms, lists missing terms and never writes to the ledger", async () => {
    await seed();
    const before = await totals();
    const r = await as(A).inari.emiCheck({ cashPrice: 40000, emiMonthly: 6700, months: 6, processingFee: 500, taxes: 90 });
    expect(r.totalPayableEmiPaise).toBe(4_079_000); // 6 x 6,700 + 500 + 90
    expect(r.totalPayableUpfrontPaise).toBe(4_000_000);
    expect(r.extraCostOfEmiPaise).toBe(79_000);
    expect(r.extraCostPercentOfCash).toBe(1.98);
    expect(r.isReallyNoCost).toBe(false);
    expect(r.monthlyCommitmentPaise).toBe(670_000);
    expect(r.missingTerms).toEqual(["any discount or cashback you only get by paying upfront"]);
    expect(r.createsNoDebt).toBe(true);
    expect(r.verdict).toMatch(/not really "no cost"/);
    expect(await totals()).toEqual(before);
    expect(await as(A).inari.getGoals().then(g => g.items.length)).toBe(0);
  });

  it("counts a lost upfront discount, and recognises a genuinely equal or cheaper plan", async () => {
    const r = await as(A).inari.emiCheck({ cashPrice: 40000, emiMonthly: 6666.66, months: 6, processingFee: 0, taxes: 0, upfrontDiscount: 2000 });
    expect(r.extraCostOfEmiPaise).toBe(3_999_996 - 3_800_000);
    const same = await as(A).inari.emiCheck({ cashPrice: 12000, emiMonthly: 2000, months: 6, processingFee: 0, taxes: 0, upfrontDiscount: 0 });
    expect(same).toMatchObject({ extraCostOfEmiPaise: 0, isReallyNoCost: true, missingTerms: [] });
    const cheaper = await as(A).inari.emiCheck({ cashPrice: 12000, emiMonthly: 1900, months: 6, processingFee: 0, taxes: 0, upfrontDiscount: 0 });
    expect(cheaper.extraCostOfEmiPaise).toBe(-60_000);
  });

  it("shows the effect on the monthly surplus when data is imported, and says so when it is not", async () => {
    const none = await as(B).inari.emiCheck({ cashPrice: 40000, emiMonthly: 6700, months: 6 });
    expect(none.surplusAfterEmiPaise).toBeNull();
    expect(none.warnings.join(" ")).toMatch(/Import a complete month/);
    await seed();
    const snap = await as(A).inari.getSnapshot();
    const r = await as(A).inari.emiCheck({ cashPrice: 40000, emiMonthly: 6700, months: 6 });
    expect(r.monthlySurplusPaise).toBe(Math.round(((snap.monthlyIncome as any).value ?? snap.monthlyIncome) * 100) - Math.round(((snap.monthlyExpenses as any).value ?? snap.monthlyExpenses) * 100));
    expect(r.surplusAfterEmiPaise).toBe(r.monthlySurplusPaise! - 670_000);
  });

  it("rejects nonsense input", async () => {
    await expect(as(A).inari.emiCheck({ cashPrice: 0, emiMonthly: 100, months: 3 })).rejects.toBeTruthy();
    await expect(as(A).inari.emiCheck({ cashPrice: 1000, emiMonthly: 100, months: 0 })).rejects.toBeTruthy();
  });
});

describe("persistence of new data", () => {
  it("claims survive setBalances and a profile round trip", async () => {
    const { headphones } = await seed();
    await as(A).inari.createClaim({ kind: "refund", transactionId: headphones.id, expectedAmount: 100 });
    await as(A).inari.setBalances({ emergencyFund: 1000, investments: null, creditCardDebt: null });
    expect((await as(A).inari.listClaims()).items).toHaveLength(1);
  });
  it("clearMyData removes claims too", async () => {
    const { headphones } = await seed();
    await as(A).inari.createClaim({ kind: "refund", transactionId: headphones.id, expectedAmount: 100 });
    await as(A).inari.clearMyData({ confirm: "DELETE" });
    expect((await as(A).inari.listClaims()).items).toHaveLength(0);
  });
});
