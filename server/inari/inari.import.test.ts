import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";
import { FileLedgerRepository, setLedgerRepositoryForTests } from "./ledger";
import { parseAmountToPaise } from "./money";
import { parseCsv } from "./ingestion/csv";
import { parseDate } from "./ingestion/csvImport";
import { _previewStoreForTests } from "./service";

const tmp = mkdtempSync(path.join(tmpdir(), "inari-import-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const A = "anon:00000000-0000-4000-8000-00000000000a";
const B = "anon:00000000-0000-4000-8000-00000000000b";

function ctxFor(ownerKey: string): TrpcContext {
  return {
    user: { id: 5, openId: "local-demo-user", email: null, name: "Demo", loginMethod: "local-demo", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "http", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
    inariUserKey: ownerKey,
    inariIdentityKind: "anonymous_demo",
  };
}
const as = (key: string) => appRouter.createCaller(ctxFor(key));

/** Template month: rows are [day, narration, debitRupees, creditRupees]. Totals are written out by hand, not computed by the code under test. */
const MONTH_ROWS: Array<[number, string, number, number]> = [
  [1, "NEFT-ACME CORP SALARY", 0, 100000],
  [2, "UPI/111/Rent to Landlord/rent@bank", 25000, 0],
  [5, "UPI/222/BIGBASKET/bb@bank", 12000, 0],
  [10, "UPI/333/SWIGGY/sw@bank", 6000, 0],
  [12, "BESCOM Electricity Bill", 4000, 0],
  [15, "NETFLIX.COM subscription", 650, 0],
  [20, "UBER TRIP", 3350, 0],
  [28, "AMAZON PAY RETAIL", 9000, 0],
];
const EXPECTED = { income: 100000, expenses: 25000 + 12000 + 6000 + 4000 + 650 + 3350 + 9000, surplus: 40000, rate: 40 };

const dd = (n: number) => String(n).padStart(2, "0");
const money = (n: number) => (n ? n.toFixed(2) : "");

function csvForMonths(months: Array<[number, number]>, header = "Date,Description,Debit,Credit"): string {
  const lines = [header];
  for (const [y, m] of months) for (const [d, narr, debit, credit] of MONTH_ROWS) lines.push(`${dd(d)}/${dd(m)}/${y},${narr},${money(debit)},${money(credit)}`);
  return lines.join("\n");
}

async function importCsv(key: string, content: string, filename = "s.csv") {
  const c = as(key);
  const preview = await c.inari.importPreview({ kind: "csv", filename, content });
  const batch = await c.inari.importCommit({ previewId: preview.previewId });
  return { preview, batch };
}

beforeEach(() => {
  setLedgerRepositoryForTests(new FileLedgerRepository());
  _previewStoreForTests.clear();
});

describe("money parsing (integer paise)", () => {
  it.each([
    ["1,23,456.78", 12345678], ["1,234,567.89", 123456789], ["₹ 500", 50000], ["Rs. 500.5", 50050], ["INR 500", 50000],
    ["500.00 Dr", 50000], ["0.07", 7], ["(500.00)", 50000],
  ])("parses %s", (input, paise) => {
    const r = parseAmountToPaise(input);
    expect(r && r.ok && r.paise).toBe(paise);
  });
  it("tracks sign/direction markers", () => {
    expect(parseAmountToPaise("-250")).toMatchObject({ ok: true, negative: true, paise: 25000 });
    expect(parseAmountToPaise("250 CR")).toMatchObject({ ok: true, suffix: "cr" });
    expect(parseAmountToPaise("(10)")).toMatchObject({ negative: true });
  });
  it.each(["abc", "1,2,3", "12.345", "1.2.3", "99999999999999999"])("rejects %s", input => {
    const r = parseAmountToPaise(input);
    expect(r && r.ok).toBe(false);
  });
  it("does not accumulate float error when summed as paise", () => {
    const sum = [0.1, 0.2, 0.3].map(v => parseAmountToPaise(String(v))).reduce((s, r) => s + (r && r.ok ? r.paise : 0), 0);
    expect(sum).toBe(60);
  });
});

describe("csv + dates", () => {
  it("handles quotes, embedded commas/newlines, BOM, CRLF, semicolons", () => {
    const text = '﻿a,b\r\n"x, y","line1\nline2"\r\n';
    const { records } = parseCsv(text, { maxRows: 100 });
    expect(records[1].cells).toEqual(["x, y", "line1\nline2"]);
    expect(parseCsv("a;b\n1;2", { maxRows: 10 }).delimiter).toBe(";");
  });
  it("parses Indian day-first dates and rejects impossible ones", () => {
    expect(parseDate("05/03/2026")).toBe("2026-03-05");
    expect(parseDate("5-Mar-2026")).toBe("2026-03-05");
    expect(parseDate("2026-03-05")).toBe("2026-03-05");
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("13/13/2026")).toBeNull();
    expect(parseDate("hello")).toBeNull();
  });
});

describe("CRITICAL INVARIANT: 3 months of ₹1,00,000 income and ₹60,000 expenses", () => {
  it("fixture arithmetic is what the invariant says (guards the test itself)", () => {
    expect(EXPECTED).toEqual({ income: 100000, expenses: 60000, surplus: 40000, rate: 40 });
  });

  it("yields income 100000, expenses 60000, surplus 40000, savings rate 40%, with unknown balances left null", async () => {
    await importCsv(A, csvForMonths([[2026, 7], [2026, 8], [2026, 9]]));
    const s = await as(A).inari.getSnapshot();
    expect(s.implementation).toBe("implemented");
    expect(s.dataSource).toBe("imported");
    expect(s.monthlyIncome).toBe(100000);
    expect(s.monthlyExpenses).toBe(60000);
    expect(s.monthlySurplus).toBe(40000);
    expect(s.savingsRate).toBe(40);
    expect(s.coverage).toMatchObject({ completeMonths: 3, transactionCount: 24, firstDate: "2026-07-01", lastDate: "2026-09-28" });
    expect(s.balances).toEqual({ emergencyFund: null, investments: null, creditCardDebt: null });
    expect(s.provenance).toMatchObject({ income: "observed", emergencyFund: "missing", investments: "missing", creditCardDebt: "missing" });
    expect(s.missing).toEqual(expect.arrayContaining(["emergencyFund", "investments", "creditCardDebt"]));
  });

  it("supports the same data in signed-amount, Dr/Cr-suffix with Indian grouping, and bank-statement layouts", async () => {
    const signed = ["Txn Date,Narration,Amount"];
    const suffix = ["Date,Particulars,Amount"];
    const bank = ["HDFC BANK STATEMENT", "Account No: XXXX1234", "", "Date,Narration,Chq./Ref.No.,Withdrawal Amt.,Deposit Amt.,Closing Balance"];
    for (const m of [7, 8, 9]) {
      for (const [d, n, debit, credit] of MONTH_ROWS) {
        const date = `${dd(d)}/${dd(m)}/2026`;
        signed.push(`${date},${n},${debit ? "-" + debit : credit}`);
        const grouped = (debit || credit).toLocaleString("en-IN", { minimumFractionDigits: 2 });
        suffix.push(`${date},"${n}","${grouped} ${debit ? "Dr" : "Cr"}"`);
        bank.push(`${date},${n},REF${d},${money(debit)},${money(credit)},"1,00,000.00"`);
      }
    }
    bank.push(",,,,,", "Closing balance carried forward");
    const expected = { monthlyIncome: 100000, monthlyExpenses: 60000, monthlySurplus: 40000, savingsRate: 40 };
    for (const [i, rows] of [signed, suffix, bank].entries()) {
      const key = `anon:00000000-0000-4000-8000-0000000001${i}0`;
      const { preview } = await importCsv(key, rows.join("\n"));
      expect(preview.counts.rejected).toBe(0);
      expect(await as(key).inari.getSnapshot()).toMatchObject(expected);
    }
  });
});

describe("dedupe, overlap, malformed rows", () => {
  it("re-importing the same CSV adds nothing and changes no totals", async () => {
    const csv = csvForMonths([[2026, 7], [2026, 8], [2026, 9]]);
    await importCsv(A, csv);
    const again = await as(A).inari.importPreview({ kind: "csv", filename: "s.csv", content: csv });
    expect(again.counts).toMatchObject({ accepted: 0, duplicate: 24 });
    await expect(as(A).inari.importCommit({ previewId: again.previewId })).rejects.toThrow(/Nothing new/);
    expect((await as(A).inari.listTransactions({ limit: 200 })).items).toHaveLength(24);
    expect((await as(A).inari.getSnapshot()).monthlyExpenses).toBe(60000);
  });

  it("overlapping periods import only the new rows", async () => {
    await importCsv(A, csvForMonths([[2026, 7], [2026, 8]]));
    const second = await as(A).inari.importPreview({ kind: "csv", filename: "b.csv", content: csvForMonths([[2026, 8], [2026, 9]]) });
    expect(second.counts).toMatchObject({ accepted: 8, duplicate: 8 });
    await as(A).inari.importCommit({ previewId: second.previewId });
    const snap = await as(A).inari.getSnapshot();
    expect(snap.coverage.transactionCount).toBe(24);
    expect(snap.monthlyIncome).toBe(100000);
    expect(snap.monthlyExpenses).toBe(60000);
  });

  it("two genuinely identical rows in one file are both kept, and both dedupe on re-import", async () => {
    const csv = "Date,Description,Debit,Credit\n01/09/2026,UPI/1/CHAI POINT/a@b,40.00,\n01/09/2026,UPI/1/CHAI POINT/a@b,40.00,\n";
    const { batch } = await importCsv(A, csv);
    expect(batch.counts.accepted).toBe(2);
    expect((await as(A).inari.importPreview({ kind: "csv", filename: "x.csv", content: csv })).counts.duplicate).toBe(2);
  });

  it("malformed rows are rejected with reasons and never silently counted", async () => {
    const csv = [
      "Date,Description,Debit,Credit",
      "01/09/2026,Valid debit,100.00,",
      "32/09/2026,Bad date,100.00,",
      "02/09/2026,Garbage amount,12abc,",
      "03/09/2026,Both sides,10.00,10.00",
      "04/09/2026,No amount,,",
      "05/09/2026,,50.00,",
      ",,,",
      "Total,,,",
      "06/09/2026,Valid credit,,2000.50",
    ].join("\n");
    const p = await as(A).inari.importPreview({ kind: "csv", filename: "m.csv", content: csv });
    expect(p.counts.accepted).toBe(2);
    expect(p.counts.rejected).toBe(5);
    expect(p.counts.ignored).toBe(2);
    const reasons = p.rows.filter(r => r.status === "rejected").map(r => r.reason);
    expect(reasons).toEqual(expect.arrayContaining([expect.stringMatching(/date/), expect.stringMatching(/amount/), expect.stringMatching(/both/), expect.stringMatching(/description/)]));
    const batch = await as(A).inari.importCommit({ previewId: p.previewId });
    expect(batch.counts.accepted).toBe(2);
    expect((await as(A).inari.listTransactions()).items).toHaveLength(2);
  });

  it("a positive-only amount column with no markers is rejected instead of guessed", async () => {
    const p = await as(A).inari.importPreview({ kind: "csv", filename: "a.csv", content: "Date,Description,Amount\n01/09/2026,Something,500\n" });
    expect(p.counts.accepted).toBe(0);
    expect(p.counts.rejected).toBe(1);
    expect(p.warnings.join(" ")).toMatch(/direction/);
  });

  it("rejects non-CSV input with a stable error code and no echo of file content", async () => {
    await expect(as(A).inari.importPreview({ kind: "csv", filename: "x.csv", content: "SECRET-CONTENT-123,not,a,statement\nfoo,bar" })).rejects.toMatchObject({ message: expect.not.stringContaining("SECRET-CONTENT") });
    await expect(as(A).inari.importPreview({ kind: "csv", filename: "x.csv", content: "   " })).rejects.toThrow(/empty/);
  });

  it("refuses unavailable sources honestly (SMS/PDF not implemented)", async () => {
    await expect(as(A).inari.importPreview({ kind: "sms", text: "hello" })).rejects.toThrow(/not available/);
  });

  it("undo removes a batch's rows and its coverage from the snapshot", async () => {
    const { batch } = await importCsv(A, csvForMonths([[2026, 7], [2026, 8], [2026, 9]]));
    await as(A).inari.importUndo({ batchId: batch.batchId });
    const snap = await as(A).inari.getSnapshot();
    expect(snap.coverage.transactionCount).toBe(0);
    expect(snap.monthlyIncome).toBeNull();
    const hist = await as(A).inari.importHistory();
    expect(hist.items[0].status).toBe("undone");
    // and the same file can be imported again after an undo
    expect((await as(A).inari.importPreview({ kind: "csv", filename: "s.csv", content: csvForMonths([[2026, 7]]) })).counts.accepted).toBe(8);
  });
});

describe("partial periods are never treated as full months", () => {
  it("a half-month statement produces no monthly figures", async () => {
    const half = ["Date,Description,Debit,Credit", "01/09/2026,NEFT SALARY,,100000.00", "10/09/2026,UPI/1/SWIGGY/x@y,500.00,", "15/09/2026,UPI/1/BIGBASKET/x@y,2500.00,"].join("\n");
    await importCsv(A, half);
    const s = await as(A).inari.getSnapshot();
    expect(s.monthlyIncome).toBeNull();
    expect(s.monthlyExpenses).toBeNull();
    expect(s.monthlySurplus).toBeNull();
    expect(s.savingsRate).toBeNull();
    expect(s.coverage.completeMonths).toBe(0);
    expect(s.dataQuality.map(d => d.code)).toContain("no_complete_month");
  });

  it("a trailing partial month is excluded from the averages", async () => {
    const partial = ["01/10/2026,NEFT-ACME CORP SALARY,,100000.00", "03/10/2026,UPI/1/SWIGGY/x@y,9999.00,"].join("\n");
    await importCsv(A, csvForMonths([[2026, 7], [2026, 8], [2026, 9]]) + "\n" + partial);
    const s = await as(A).inari.getSnapshot();
    expect(s.coverage.completeMonths).toBe(3);
    expect(s.monthlyExpenses).toBe(60000);
    expect(s.dataQuality.map(d => d.code)).toContain("partial_months");
  });

  it("uses only the most recent three complete months", async () => {
    const heavy = csvForMonths([[2026, 5]]).replace(/BIGBASKET/, "BIGBASKET").replace("12000.00", "52000.00"); // May expenses 100,000
    await importCsv(A, heavy + "\n" + csvForMonths([[2026, 6], [2026, 7], [2026, 8]]).split("\n").slice(1).join("\n"));
    const s = await as(A).inari.getSnapshot();
    expect(s.coverage.completeMonths).toBe(4);
    expect(s.monthlyExpenses).toBe(60000); // June-August only
  });

  it("one complete month is reported as an estimate, not observed", async () => {
    await importCsv(A, csvForMonths([[2026, 9]]));
    const s = await as(A).inari.getSnapshot();
    expect(s.monthlyExpenses).toBe(60000);
    expect(s.provenance.income).toBe("estimated");
  });
});

describe("categories, breakdown, corrections, learned rules", () => {
  it("categorises the template month deterministically", async () => {
    await importCsv(A, csvForMonths([[2026, 9]]));
    const { items } = await as(A).inari.listTransactions({ limit: 50 });
    const by = (needle: string) => items.find(t => t.narration.includes(needle))!;
    expect(by("SALARY").category).toBe("salary");
    expect(by("Rent").category).toBe("rent");
    expect(by("BIGBASKET").category).toBe("groceries");
    expect(by("SWIGGY").category).toBe("dining");
    expect(by("BESCOM").category).toBe("utilities");
    expect(by("NETFLIX").category).toBe("subscription");
    expect(by("UBER").category).toBe("transport");
    expect(by("AMAZON").category).toBe("shopping");
    expect(items.every(t => t.categorySource === "rule")).toBe(true);
  });

  it("repeated category totals are computed per month with month-over-month change", async () => {
    await importCsv(A, csvForMonths([[2026, 7], [2026, 8], [2026, 9]]));
    const sep = await as(A).inari.getBreakdown({ month: "2026-09" });
    const groceries = sep.items.find(i => i.category === "groceries")!;
    expect(groceries).toMatchObject({ amount: 12000, transactionCount: 1, previousMonthAmount: 12000, changePercent: 0 });
    expect(sep.items.reduce((s, i) => s + i.amount, 0)).toBe(60000);
    expect(sep.items.reduce((s, i) => s + i.sharePercent, 0)).toBeCloseTo(100, 0);
    const jul = await as(A).inari.getBreakdown({ month: "2026-07" });
    expect(jul.items.find(i => i.category === "groceries")!.previousMonthAmount).toBeNull();
  });

  it("a single correction wins, recalculates the breakdown, and is audited", async () => {
    await importCsv(A, csvForMonths([[2026, 9]]));
    const tx = (await as(A).inari.listTransactions()).items.find(t => t.narration.includes("UBER"))!;
    const r = await as(A).inari.correctCategory({ transactionId: tx.id, category: "travel", applyToMerchant: false });
    expect(r.updated).toBe(1);
    expect(r.breakdown.find(i => i.category === "transport")).toBeUndefined();
    expect(r.breakdown.find(i => i.category === "travel")!.amount).toBe(3350);
    const after = (await as(A).inari.listTransactions()).items.find(t => t.id === tx.id)!;
    expect(after).toMatchObject({ category: "travel", categorySource: "user", correctedFrom: "transport", categoryConfidence: 1 });
    expect((await as(A).inari.getSnapshot()).monthlyExpenses).toBe(60000); // reclassifying expense->expense does not change totals
  });

  it("recategorising an expense as investment changes surplus and savings rate", async () => {
    await importCsv(A, csvForMonths([[2026, 9]]));
    const tx = (await as(A).inari.listTransactions()).items.find(t => t.narration.includes("BIGBASKET"))!;
    await as(A).inari.correctCategory({ transactionId: tx.id, category: "investment", applyToMerchant: false });
    const s = await as(A).inari.getSnapshot();
    expect(s.monthlyExpenses).toBe(48000);
    expect(s.monthlySurplus).toBe(52000);
    expect(s.savingsRate).toBe(52);
  });

  it("applyToMerchant creates a learned rule, updates siblings, applies to future imports, and user correction still outranks it", async () => {
    await importCsv(A, csvForMonths([[2026, 8], [2026, 9]]));
    const swiggy = (await as(A).inari.listTransactions({ limit: 50 })).items.filter(t => t.narration.includes("SWIGGY"));
    expect(swiggy).toHaveLength(2);
    const res = await as(A).inari.correctCategory({ transactionId: swiggy[0].id, category: "groceries", applyToMerchant: true });
    expect(res.updated).toBe(2);
    const rules = await as(A).inari.listLearnedRules();
    expect(rules.items).toHaveLength(1);
    expect(rules.items[0]).toMatchObject({ category: "groceries" });
    const [a, b] = await Promise.all(swiggy.map(async t => (await as(A).inari.listTransactions({ limit: 50 })).items.find(x => x.id === t.id)!));
    expect([a.categorySource, b.categorySource].sort()).toEqual(["learned", "user"]);

    // future import: October's SWIGGY row is categorised by the learned rule, not the deterministic rule
    await importCsv(A, "Date,Description,Debit,Credit\n03/10/2026,UPI/9/SWIGGY/s@b,300.00,");
    const oct = (await as(A).inari.listTransactions({ month: "2026-10" })).items[0];
    expect(oct).toMatchObject({ category: "groceries", categorySource: "learned" });

    // user correction on a learned row outranks the rule
    await as(A).inari.correctCategory({ transactionId: oct.id, category: "entertainment", applyToMerchant: false });
    expect((await as(A).inari.listTransactions({ month: "2026-10" })).items[0]).toMatchObject({ category: "entertainment", categorySource: "user" });

    // deleting the rule reverts learned rows only; explicit user corrections stay
    await as(A).inari.deleteLearnedRule({ ruleId: rules.items[0].ruleId });
    const final = (await as(A).inari.listTransactions({ limit: 50 })).items.filter(t => t.narration.includes("SWIGGY"));
    expect(final.filter(t => t.categorySource === "user").map(t => t.category).sort()).toEqual(["entertainment", "groceries"]);
    expect(final.filter(t => t.categorySource === "rule").every(t => t.category === "dining")).toBe(true);
  });
});

describe("isolation, restart, no persona leakage", () => {
  it("two browser identities never see each other's data, previews, or corrections", async () => {
    const { batch } = await importCsv(A, csvForMonths([[2026, 7], [2026, 8], [2026, 9]]));
    expect((await as(B).inari.listTransactions()).items).toHaveLength(0);
    expect((await as(B).inari.getSnapshot()).monthlyIncome).toBeNull();
    expect((await as(B).inari.importHistory()).items).toHaveLength(0);
    const txA = (await as(A).inari.listTransactions()).items[0];
    await expect(as(B).inari.correctCategory({ transactionId: txA.id, category: "other", applyToMerchant: false })).rejects.toThrow(/not found/i);
    await expect(as(B).inari.importUndo({ batchId: batch.batchId })).rejects.toThrow(/not found/i);
    const previewA = await as(A).inari.importPreview({ kind: "csv", filename: "x.csv", content: csvForMonths([[2026, 10]]) });
    await expect(as(B).inari.importCommit({ previewId: previewA.previewId })).rejects.toThrow(/expired|does not exist/);
    await as(B).inari.clearMyData({ confirm: "DELETE" });
    expect((await as(A).inari.listTransactions({ limit: 200 })).items).toHaveLength(24);
  });

  it("data and balances survive a store restart (json repository)", async () => {
    const file = path.join(tmp, "restart.json");
    setLedgerRepositoryForTests(new FileLedgerRepository({ filePath: file }));
    await importCsv(A, csvForMonths([[2026, 7], [2026, 8], [2026, 9]]));
    await as(A).inari.setBalances({ emergencyFund: 150000, investments: null, creditCardDebt: 0 });
    const before = await as(A).inari.getSnapshot();
    setLedgerRepositoryForTests(new FileLedgerRepository({ filePath: file })); // "restart"
    const after = await as(A).inari.getSnapshot();
    expect(after).toEqual(before);
    expect(after.balances).toEqual({ emergencyFund: 150000, investments: null, creditCardDebt: 0 });
    expect(after.provenance).toMatchObject({ emergencyFund: "user_input", investments: "missing", creditCardDebt: "user_input" });
    expect((await as(A).inari.importPreview({ kind: "csv", filename: "s.csv", content: csvForMonths([[2026, 7]]) })).counts.duplicate).toBe(8);
  });

  it("imported snapshot never contains persona values; unknown stays null", async () => {
    const empty = await as(A).inari.getSnapshot();
    expect(empty).toMatchObject({ monthlyIncome: null, monthlyExpenses: null, savingsRate: null, balances: { emergencyFund: null, investments: null, creditCardDebt: null } });
    await importCsv(A, csvForMonths([[2026, 7], [2026, 8], [2026, 9]]));
    const s = await as(A).inari.getSnapshot();
    const personaNumbers = [85000, 52000, 450000, 200000];
    expect(JSON.stringify(s)).not.toMatch(new RegExp(`\\b(${personaNumbers.join("|")})\\b`));
    expect(s.balances.emergencyFund).toBeNull();
  });

  it("clearMyData wipes transactions, batches, rules and balances", async () => {
    await importCsv(A, csvForMonths([[2026, 9]]));
    await as(A).inari.setBalances({ emergencyFund: 1, investments: 2, creditCardDebt: 3 });
    const out = await as(A).inari.clearMyData({ confirm: "DELETE" });
    expect(out.deletedTransactions).toBe(8);
    const s = await as(A).inari.getSnapshot();
    expect(s.balances).toEqual({ emergencyFund: null, investments: null, creditCardDebt: null });
  });
});
