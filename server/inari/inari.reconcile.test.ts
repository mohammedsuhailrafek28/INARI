/**
 * Reconciliation exceptions + Evidence Lens inputs. Principle under test: uncertain matches are SURFACED with the
 * exact transaction ids and are never silently resolved (totals do not change until the user acts).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";
import { merchantKey } from "./categorize";
import { extractMerchant } from "./ingestion/csvImport";
import { FileLedgerRepository, setLedgerRepositoryForTests } from "./ledger";
import { _previewStoreForTests } from "./service";

const KEY = "anon:00000000-0000-4000-8000-0000000000c1";
const c = () =>
  appRouter.createCaller({
    user: { id: 5, openId: "x", email: null, name: "D", loginMethod: "l", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "http", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
    inariUserKey: KEY,
    inariIdentityKind: "anonymous_demo",
  } as TrpcContext);

/** One full month (September) of baseline: salary 100,000 and rent 40,000 => income 100000, expenses 40000 before extras. */
const base = [
  "Date,Description,Debit,Credit",
  "01/09/2026,NEFT-ACME CORP SALARY,,100000.00",
  "02/09/2026,UPI/111/Rent to Landlord/rent@bank,40000.00,",
  "28/09/2026,UPI/222/BIGBASKET/bb@bank,1.00,",
];
async function load(extra: string[]) {
  const p = await c().inari.importPreview({ kind: "csv", filename: "t.csv", content: [...base, ...extra].join("\n") });
  await c().inari.importCommit({ previewId: p.previewId });
  return c().inari.getSnapshot();
}
const note = (s: Awaited<ReturnType<typeof load>>, code: string) => s.dataQuality.find(n => n.code === code);

beforeEach(() => {
  setLedgerRepositoryForTests(new FileLedgerRepository());
  _previewStoreForTests.clear();
});

describe("credit-card repayments", () => {
  it("are flagged with exact ids, counted as expenses by default, and become excluded only when the user marks them Transfer", async () => {
    const s = await load(["18/09/2026,CREDIT CARD PAYMENT HDFC BANK CARD XX4821,6500.00,"]);
    expect(s.monthlyExpenses).toBe(40000 + 1 + 6500);
    const n = note(s, "card_repayment_counted")!;
    expect(n.severity).toBe("warning");
    expect(n.transactionIds).toHaveLength(1);
    expect(n.message).toMatch(/6,500/);

    await c().inari.correctCategory({ transactionId: n.transactionIds![0], category: "transfer", applyToMerchant: false });
    const after = await c().inari.getSnapshot();
    expect(after.monthlyExpenses).toBe(40001);
    expect(note(after, "card_repayment_counted")).toBeUndefined();
    expect(note(after, "transfers_excluded")!.transactionIds).toEqual(n.transactionIds);
  });

  it("is not mistaken for a utility bill", async () => {
    await load(["18/09/2026,CC BILL PAY HDFC CARD,1000.00,"]);
    const tx = (await c().inari.listTransactions({ q: "HDFC" })).items[0];
    expect(tx.category).not.toBe("utilities");
  });
});

describe("refunds", () => {
  it("a refund from a known merchant nets against that category", async () => {
    const s = await load(["10/09/2026,POS AMAZON RETAIL 1,2000.00,", "12/09/2026,AMAZON REFUND ORDER CANCELLED,,500.00"]);
    expect(s.monthlyExpenses).toBe(40000 + 1 + 1500);
    expect(s.monthlyIncome).toBe(100000);
    expect(note(s, "refunds_netted")).toBeTruthy();
  });

  it("a generic refund booked as income is flagged, not silently re-routed; fixing it reduces income", async () => {
    const s = await load(["10/09/2026,UPI/9/STORE X/x@y,2000.00,", "12/09/2026,REFUND 4455 RETURNED GOODS,,2000.00"]);
    expect(s.monthlyIncome).toBe(102000); // still counted as income until the user acts
    const n = note(s, "refund_counted_as_income")!;
    expect(n.severity).toBe("warning");
    await c().inari.correctCategory({ transactionId: n.transactionIds![0], category: "shopping", applyToMerchant: false });
    const fixed = await c().inari.getSnapshot();
    expect(fixed.monthlyIncome).toBe(100000);
    expect(fixed.monthlyExpenses).toBe(40000 + 1 + 2000 - 2000);
    expect(note(fixed, "refund_counted_as_income")).toBeUndefined();
  });
});

describe("transfers", () => {
  it("self-transfers are excluded from income and expenses and listed as evidence", async () => {
    const s = await load(["15/09/2026,SELF TRANSFER TO OWN ACCOUNT,10000.00,"]);
    expect(s.monthlyExpenses).toBe(40001);
    expect(note(s, "transfers_excluded")!.transactionIds).toHaveLength(1);
  });

  it("an equal debit/credit pair with ordinary narrations is an EXCEPTION: reported, not netted", async () => {
    const withPair = await load(["14/09/2026,UPI/5/RAHUL SHARMA/r@y,10000.00,", "15/09/2026,UPI/6/FROM RAHUL S/r@y,,10000.00"]);
    const n = note(withPair, "possible_transfer_pair")!;
    expect(n.transactionIds).toHaveLength(2);
    expect(withPair.monthlyIncome).toBe(110000); // unchanged until the user decides
    expect(withPair.monthlyExpenses).toBe(40000 + 1 + 10000);

    for (const id of n.transactionIds!) await c().inari.correctCategory({ transactionId: id, category: "transfer", applyToMerchant: false });
    const resolved = await c().inari.getSnapshot();
    expect(resolved.monthlyIncome).toBe(100000);
    expect(resolved.monthlyExpenses).toBe(40001);
    expect(note(resolved, "possible_transfer_pair")).toBeUndefined();
  });

  it("does not pair a salary credit or rent with an equal-amount debit", async () => {
    const s = await load(["03/09/2026,UPI/7/LANDLORD TWO/l@y,100000.00,"]);
    expect(note(s, "possible_transfer_pair")).toBeUndefined();
  });

  it("pairs outside the 3-day window or with different amounts are not reported", async () => {
    const s = await load(["02/09/2026,UPI/5/RAHUL SHARMA/r@y,10000.00,", "20/09/2026,UPI/6/FROM RAHUL S/r@y,,10000.00", "21/09/2026,UPI/8/X/x@y,,9999.00"]);
    expect(note(s, "possible_transfer_pair")).toBeUndefined();
  });
});

describe("merchant normalization", () => {
  it.each([
    ["UPI/412345678901/SWIGGY/swiggy@icici/Payment", "swiggy"],
    ["UPI-SWIGGY-swiggy@hdfcbank-HDFC0000001-123456-UPI", "swiggy"],
    ["POS 4147XXXXXXXX1234 SWIGGY BANGALORE", "swiggy bangalore"],
    ["Swiggy*Order 55821", "swiggy order"],
    ["SWIGGY", "swiggy"],
  ])("%s", (narration, expectedPrefix) => {
    const merchant = extractMerchant(narration);
    expect(merchantKey(merchant ?? narration).startsWith(expectedPrefix.split(" ")[0])).toBe(true);
  });

  it("all variants resolve to the same merchant key so one correction teaches them all", () => {
    const keys = ["UPI/412345678901/SWIGGY/swiggy@icici/Payment", "UPI-SWIGGY-swiggy@hdfcbank-HDFC0000001-123456-UPI", "SWIGGY"].map(n => merchantKey(extractMerchant(n) ?? n));
    expect(new Set(keys).size).toBe(1);
  });
});

describe("Financial Evidence Lens: the existing snapshot fields are sufficient with two additive changes", () => {
  it("exposes coverage, provenance, missing inputs, assumptions and the months used", async () => {
    const s = await load([]);
    expect(s.coverage).toMatchObject({ completeMonths: 1, firstDate: "2026-09-01", lastDate: "2026-09-28", transactionCount: 3 });
    expect(s.provenance).toMatchObject({ income: "estimated", emergencyFund: "missing" });
    expect(s.missing).toEqual(expect.arrayContaining(["emergencyFund", "investments", "creditCardDebt"]));
    expect(note(s, "assumption_averaging")!.message).toMatch(/2026-09/);
    expect(note(s, "assumption_definitions")!.message).toMatch(/Investments, savings and transfers are not expenses/);
    expect(note(s, "few_months")).toBeTruthy();
  });

  it("states which months were excluded as incomplete", async () => {
    const p = await c().inari.importPreview({ kind: "csv", filename: "t.csv", content: [...base, "01/10/2026,UPI/1/SWIGGY/x@y,100.00,"].join("\n") });
    await c().inari.importCommit({ previewId: p.previewId });
    expect(note(await c().inari.getSnapshot(), "assumption_averaging")!.message).toMatch(/Excluded as incomplete: 2026-10/);
  });

  it("evidence ids point at real ledger rows owned by the caller", async () => {
    const s = await load(["18/09/2026,CREDIT CARD PAYMENT HDFC BANK CARD XX4821,6500.00,"]);
    const ids = note(s, "card_repayment_counted")!.transactionIds!;
    const all = (await c().inari.listTransactions({ limit: 50 })).items.map(t => t.id);
    ids.forEach(id => expect(all).toContain(id));
  });

  it("on the 494-row fixture, the six monthly card repayments and two transfers are reported", async () => {
    const csv = readFileSync(path.resolve(__dirname, "../../data/demo/fixture_debit_credit.csv"), "utf8");
    const p = await c().inari.importPreview({ kind: "csv", filename: "f.csv", content: csv });
    await c().inari.importCommit({ previewId: p.previewId });
    const s = await c().inari.getSnapshot();
    expect(note(s, "card_repayment_counted")!.transactionIds).toHaveLength(6);
    expect(note(s, "transfers_excluded")!.transactionIds).toHaveLength(2);
    expect(note(s, "refunds_netted")!.transactionIds).toHaveLength(1);
    expect(note(s, "possible_transfer_pair")).toBeUndefined();
  });

  it("reporting exceptions never changes totals: figures equal the independently computed expected.json", async () => {
    const dir = path.resolve(__dirname, "../../data/demo");
    const expected = JSON.parse(readFileSync(path.join(dir, "expected.json"), "utf8"));
    const p = await c().inari.importPreview({ kind: "csv", filename: "f.csv", content: readFileSync(path.join(dir, "fixture_bank_statement.csv"), "utf8") });
    await c().inari.importCommit({ previewId: p.previewId });
    const s = await c().inari.getSnapshot();
    expect(s.monthlyExpenses).toBe(expected.snapshot.monthlyExpenses);
  });
});
