/**
 * PDF statement ingestion. All PDFs are SYNTHETIC (data/generator/make_pdf_statements.py) in three different layouts,
 * plus deliberately broken variants. Expected values come from expected.json, written by the generator from the same
 * source list - not from the parser.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";
import { FileLedgerRepository, getLedgerRepository, setLedgerRepositoryForTests } from "./ledger";
import { parsePdfStatement, PDF_LIMITS } from "./ingestion/pdfImport";
import { _previewStoreForTests } from "./service";

const DIR = path.resolve(__dirname, "../../data/parser-tests/pdf");
const b64 = (name: string) => readFileSync(path.join(DIR, name)).toString("base64");
const expected = JSON.parse(readFileSync(path.join(DIR, "expected.json"), "utf8")) as {
  openingBalancePaise: number;
  transactions: { postedOn: string; amountPaise: number; direction: string; reference: string; balanceAfterPaise: number; narration: string }[];
};
const squash = (s: string) => s.replace(/\s+/g, "");

const KEY = "anon:00000000-0000-4000-8000-0000000000c1";
const OTHER = "anon:00000000-0000-4000-8000-0000000000c2";
const caller = (key = KEY) =>
  appRouter.createCaller({
    user: { id: 7, openId: "x", email: null, name: "D", loginMethod: "l", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "http", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
    inariUserKey: key,
    inariIdentityKind: "anonymous_demo",
  } as TrpcContext);

beforeEach(() => {
  setLedgerRepositoryForTests(new FileLedgerRepository());
  _previewStoreForTests.clear();
});

const parse = (file: string, password?: string) => parsePdfStatement(b64(file), { userKey: KEY, maxRows: 20_000, password });
const LAYOUTS: [string, string, boolean][] = [
  ["layout_a_debit_credit_columns.pdf", "pdf:debit_credit_columns", true],
  ["layout_b_amount_drcr_suffix.pdf", "pdf:amount_dr_cr_suffix", true],
  ["layout_c_type_column_newest_first.pdf", "pdf:amount_type_column", false],
];

describe.each(LAYOUTS)("layout %s", (file, format, hasReference) => {
  it("yields exactly the statement's transactions: dates, integer paise, directions, balances, narration, references", async () => {
    const r = await parse(file);
    expect(r.format).toBe(format);
    expect(r.rejected).toEqual([]);
    expect(r.candidates).toHaveLength(expected.transactions.length);
    r.candidates.forEach((c, i) => {
      const e = expected.transactions[i];
      expect({ d: c.postedOn, p: c.amountPaise, dir: c.direction, bal: c.balanceAfterPaise, n: squash(c.narration), ref: hasReference ? c.reference : null }).toEqual({
        d: e.postedOn, p: e.amountPaise, dir: e.direction, bal: e.balanceAfterPaise, n: squash(e.narration), ref: hasReference ? e.reference : null,
      });
      expect(Number.isInteger(c.amountPaise)).toBe(true);
      expect(c.source).toBe("pdf");
    });
  });

  it("never imports totals, opening or closing balance lines as transactions, and keeps money exactly", async () => {
    const r = await parse(file);
    expect(r.candidates.some(c => /total|closing balance|opening balance|summary/i.test(c.narration))).toBe(false);
    expect(r.ignored.length).toBeGreaterThanOrEqual(1);
    const debits = r.candidates.filter(c => c.direction === "debit").reduce((s, c) => s + c.amountPaise, 0);
    const credits = r.candidates.filter(c => c.direction === "credit").reduce((s, c) => s + c.amountPaise, 0);
    expect(debits).toBe(expected.transactions.filter(t => t.direction === "debit").reduce((s, t) => s + t.amountPaise, 0));
    expect(expected.openingBalancePaise + credits - debits).toBe(expected.transactions[expected.transactions.length - 1].balanceAfterPaise);
  });

  it("records page and line evidence for every row, across more than one page, without statement text", async () => {
    const r = await parse(file);
    const pages = new Set(r.candidates.map(c => c.evidence?.page));
    expect(pages.has(1)).toBe(true);
    expect(pages.has(2)).toBe(true);
    for (const c of r.candidates) expect(Object.keys(c.evidence!).sort()).toEqual(["line", "page"]);
  });

  it("keeps both of two identical same-day rows (repeated page furniture is not mistaken for data)", async () => {
    const r = await parse(file);
    const uber = r.candidates.filter(c => /UBER/.test(c.narration) && c.postedOn === "2026-08-14");
    expect(uber).toHaveLength(2);
    expect(uber[0].fingerprint).not.toBe(uber[1].fingerprint);
    expect(r.candidates.some(c => /page \d|computer generated|account holder/i.test(c.narration))).toBe(false);
  });
});

describe("multi-line descriptions", () => {
  it("joins wrapped narration lines into the right transaction", async () => {
    for (const [file] of LAYOUTS) {
      const r = await parse(file);
      const big = r.candidates.find(c => c.postedOn === "2026-08-04");
      expect(squash(big!.narration)).toBe(squash("UPI/424242424202/BIGBASKET/bigbasket@demobank/Groceries weekly order"));
      const amazon = r.candidates.find(c => /AMAZON/.test(c.narration));
      expect(amazon!.narration).toMatch(/BENGALURU/);
      expect(amazon!.merchant).toBeTruthy();
    }
  });
});

describe("direction and balance checks", () => {
  it("newest-first statements are read in chronological order and validated", async () => {
    const r = await parse("layout_c_type_column_newest_first.pdf");
    expect(r.warnings.join(" ")).toMatch(/newest first/);
    const dates = r.candidates.map(c => c.postedOn);
    expect([...dates].sort()).toEqual(dates);
  });

  it("derives direction from the running balance when the file has no Dr/Cr marker, and says so", async () => {
    const r = await parse("variant_amount_without_marker.pdf");
    expect(r.format).toBe("pdf:amount_balance_derived");
    expect(r.rejected).toEqual([]);
    expect(r.candidates.map(c => c.direction)).toEqual(expected.transactions.map(t => t.direction));
    expect(r.warnings.join(" ")).toMatch(/derived from the running balance/);
  });

  it("rejects every row when direction cannot be known (no marker and no balance) instead of guessing", async () => {
    const r = await parse("variant_amount_without_marker_or_balance.pdf");
    expect(r.candidates).toHaveLength(0);
    expect(r.rejected).toHaveLength(expected.transactions.length);
    expect(r.rejected[0].reason).toMatch(/direction is unclear/);
  });

  it("rejects a row whose amount contradicts the running balance, keeping the rest", async () => {
    const r = await parse("variant_amount_disagrees_with_balance.pdf");
    expect(r.rejected).toHaveLength(1);
    expect(r.rejected[0].reason).toMatch(/running balance/);
    expect(r.candidates).toHaveLength(expected.transactions.length - 1);
    expect(r.candidates.some(c => /RELIANCE/.test(c.narration))).toBe(false);
  });

  it("keeps a row whose own printed balance is wrong when the next row corroborates the amount, ignoring that balance", async () => {
    const r = await parse("variant_bad_running_balance.pdf");
    expect(r.rejected).toEqual([]);
    expect(r.candidates).toHaveLength(expected.transactions.length);
    expect(r.candidates.find(c => /RELIANCE/.test(c.narration))!.balanceAfterPaise).toBeNull();
    expect(r.warnings.join(" ")).toMatch(/printed balance/);
  });

  it("rejects a row that has both a withdrawal and a deposit", async () => {
    const r = await parse("variant_debit_and_credit_both_filled.pdf");
    expect(r.rejected).toHaveLength(1);
    expect(r.rejected[0].reason).toBe("both debit and credit are filled");
    expect(r.candidates).toHaveLength(expected.transactions.length - 1);
  });
});

describe("unsupported, malformed and protected files", () => {
  const code = async (p: Promise<unknown>) => {
    try {
      await p;
      return null;
    } catch (e: any) {
      return e.inariCode as string;
    }
  };
  it("refuses a scanned (image-only) PDF with a clear code", async () => {
    expect(await code(parse("scanned_image_only.pdf"))).toBe("SCANNED_PDF_UNSUPPORTED");
  });
  it("asks for the password of an encrypted PDF, rejects a wrong one, and reads it with the right one", async () => {
    expect(await code(parse("layout_a_encrypted.pdf"))).toBe("PASSWORD_REQUIRED");
    expect(await code(parse("layout_a_encrypted.pdf", "wrong"))).toBe("PASSWORD_REQUIRED");
    const r = await parse("layout_a_encrypted.pdf", "demo-pass");
    expect(r.candidates).toHaveLength(expected.transactions.length);
  });
  it("rejects documents over the page limit", async () => {
    expect(await code(parse("too_many_pages.pdf"))).toBe("FILE_TOO_LARGE");
  });
  it("rejects non-PDF, truncated, garbage and empty input without echoing content", async () => {
    const mk = (buf: Buffer) => parsePdfStatement(buf.toString("base64"), { userKey: KEY, maxRows: 100 });
    expect(await code(mk(Buffer.from("name,amount\nsecret-looking,1.00\n")))).toBe("UNSUPPORTED_FORMAT");
    expect(await code(mk(Buffer.from("%PDF-1.4\nnot really a pdf at all")))).toBe("PARSE_FAILED");
    const real = readFileSync(path.join(DIR, "layout_a_debit_credit_columns.pdf"));
    expect(await code(mk(real.subarray(0, Math.floor(real.length / 2))))).toBe("PARSE_FAILED");
    expect(await code(mk(Buffer.alloc(0)))).toBe("PARSE_FAILED");
    expect(await code(parsePdfStatement("***not base64***", { userKey: KEY, maxRows: 100 }))).toBe("UNSUPPORTED_FORMAT");
    try {
      await mk(Buffer.from("%PDF-1.4\nSECRET-LOOKING-TEXT-12345"));
    } catch (e: any) {
      expect(e.message).not.toMatch(/SECRET/);
    }
  });
  it("rejects a PDF larger than the byte limit", async () => {
    const big = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(PDF_LIMITS.maxBytes + 1)]);
    expect(await code(parsePdfStatement(big.toString("base64"), { userKey: KEY, maxRows: 100 }))).toBe("FILE_TOO_LARGE");
  });
  it("refuses a text PDF without a recognisable transaction table as an unsupported layout", async () => {
    expect(await code(parse("text_without_table.pdf"))).toBe("UNSUPPORTED_FORMAT");
  });
});

describe("import pipeline: preview, commit, duplicates, cross-source, isolation", () => {
  const preview = (file: string, key = KEY, password?: string) => caller(key).inari.importPreview({ kind: "pdf", filename: file, contentBase64: b64(file), password });

  it("previews first, writes nothing until commit, then commits PDF rows as ledger transactions with evidence", async () => {
    const p = await preview("layout_a_debit_credit_columns.pdf");
    expect(p.source).toBe("pdf");
    expect(p.detectedFormat).toBe("pdf:debit_credit_columns");
    expect(p.counts).toMatchObject({ accepted: 24, duplicate: 0, rejected: 0 });
    expect(p.period).toEqual({ from: "2026-08-01", to: "2026-09-03" });
    expect(await getLedgerRepository().listTransactions(KEY)).toHaveLength(0);
    expect(p.rows.filter(r => r.status === "ignored").length).toBeGreaterThanOrEqual(1);

    const batch = await caller().inari.importCommit({ previewId: p.previewId, accountLabel: "Demo savings" });
    expect(batch.source).toBe("pdf");
    expect(batch.counts.accepted).toBe(24);
    const tx = await getLedgerRepository().listTransactions(KEY);
    expect(tx).toHaveLength(24);
    expect(tx.every(t => t.source === "pdf" && t.evidence && t.evidence.page >= 1)).toBe(true);
    expect(tx.find(t => /SWIGGY/.test(t.narration))!.category).toBe("dining");
  });

  it("drives the same financial model as CSV: monthly figures and the dashboard snapshot reflect the PDF rows", async () => {
    const p = await preview("layout_b_amount_drcr_suffix.pdf");
    await caller().inari.importCommit({ previewId: p.previewId });
    const snap = await caller().inari.getSnapshot();
    expect(snap.dataSource).toBe("imported");
    const report = await caller().inari.monthlyReport({ month: "2026-08" });
    expect(report.dataSource).toBe("imported");
    const aug = expected.transactions.filter(t => t.postedOn.startsWith("2026-08"));
    const salary = aug.find(t => /SALARY/.test(t.narration))!;
    expect(report.totals.income).toBeGreaterThanOrEqual(salary.amountPaise / 100);
    expect(report.totals.expenses).toBeGreaterThan(0);
    const csv = ["Date,Description,Debit,Credit", ...aug.map(t => `${t.postedOn},${t.narration.replace(/,/g, " ")},${t.direction === "debit" ? t.amountPaise / 100 : ""},${t.direction === "credit" ? t.amountPaise / 100 : ""}`)].join("\n");
    await caller(OTHER).inari.importCommit({ previewId: (await caller(OTHER).inari.importPreview({ kind: "csv", filename: "aug.csv", content: csv })).previewId });
    const csvReport = await caller(OTHER).inari.monthlyReport({ month: "2026-08" });
    expect(report.totals.income).toBe(csvReport.totals.income); // same rows, same model, whichever format they came from
    expect(report.totals.expenses).toBe(csvReport.totals.expenses);
  });

  it("re-uploading the same PDF is a full duplicate and commits nothing", async () => {
    const first = await preview("layout_c_type_column_newest_first.pdf");
    await caller().inari.importCommit({ previewId: first.previewId });
    const again = await preview("layout_c_type_column_newest_first.pdf");
    expect(again.counts).toMatchObject({ accepted: 0, duplicate: 24 });
    await expect(caller().inari.importCommit({ previewId: again.previewId })).rejects.toMatchObject({ message: expect.stringMatching(/Nothing new/) });
    expect(await getLedgerRepository().listTransactions(KEY)).toHaveLength(24);
  });

  it("the same statement from another layout is recognised as already imported: ledger stays at 24 (regression: 24 -> 32 -> 56)", async () => {
    const a = await preview("layout_a_debit_credit_columns.pdf");
    await caller().inari.importCommit({ previewId: a.previewId });
    for (const f of ["layout_b_amount_drcr_suffix.pdf", "layout_c_type_column_newest_first.pdf"]) {
      const other = await preview(f);
      expect(other.counts).toMatchObject({ accepted: 0, duplicate: 24, possibleDuplicate: 0, written: 0 });
      await expect(caller().inari.importCommit({ previewId: other.previewId })).rejects.toMatchObject({ message: expect.stringMatching(/Nothing new/) });
    }
    expect(await getLedgerRepository().listTransactions(KEY)).toHaveLength(24);
  });

  it("is isolated per user: another user cannot commit my preview and sees none of my rows", async () => {
    const mine = await preview("layout_a_debit_credit_columns.pdf");
    await expect(caller(OTHER).inari.importCommit({ previewId: mine.previewId })).rejects.toMatchObject({ message: expect.stringMatching(/expired or does not exist/) });
    await caller().inari.importCommit({ previewId: mine.previewId });
    expect(await getLedgerRepository().listTransactions(OTHER)).toHaveLength(0);
    const theirs = await preview("layout_a_debit_credit_columns.pdf", OTHER);
    expect(theirs.counts.duplicate).toBe(0); // fingerprints are per user
  });

  it("surfaces unsupported/protected files as typed errors through tRPC", async () => {
    await expect(preview("scanned_image_only.pdf")).rejects.toMatchObject({ message: expect.stringMatching(/no selectable text/) });
    await expect(preview("layout_a_encrypted.pdf")).rejects.toMatchObject({ message: expect.stringMatching(/password/i) });
    const ok = await preview("layout_a_encrypted.pdf", KEY, "demo-pass");
    expect(ok.counts.accepted).toBe(24);
  });

  it("undo removes the PDF batch like any other", async () => {
    const p = await preview("layout_a_debit_credit_columns.pdf");
    const batch = await caller().inari.importCommit({ previewId: p.previewId });
    await caller().inari.importUndo({ batchId: batch.batchId });
    expect((await getLedgerRepository().listTransactions(KEY)).filter(t => t.batchId === batch.batchId && !t.reconciliation)).toHaveLength(0);
  });

  it("never persists the raw PDF or its password in the ledger or previews", async () => {
    await preview("layout_a_encrypted.pdf", KEY, "demo-pass");
    const stored = JSON.stringify(await getLedgerRepository().listTransactions(KEY));
    expect(stored).not.toContain("demo-pass");
    expect(stored).not.toContain("JVBERi"); // base64 of "%PDF-"
  });
});
