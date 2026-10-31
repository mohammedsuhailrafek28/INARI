/**
 * Duplicate-import integrity (audit remediation). Synthetic data only.
 * Rule set under test:
 *  - same transaction again (even from another format/layout) -> skipped as duplicate, nothing written;
 *  - same date/amount/direction but different description -> possible duplicate, NOT written unless the user includes it;
 *  - genuinely separate identical payments remain importable;
 *  - preview counts (`written`) equal what committing writes.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";
import { FileLedgerRepository, getLedgerRepository, setLedgerRepositoryForTests } from "./ledger";
import { _previewStoreForTests } from "./service";

const KEY = "anon:00000000-0000-4000-8000-0000000000f1";
const OTHER = "anon:00000000-0000-4000-8000-0000000000f2";
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

const csv = (...rows: string[]) => ["Date,Description,Debit,Credit", ...rows].join("\n");
const prev = (content: string, key = KEY) => caller(key).inari.importPreview({ kind: "csv", filename: "x.csv", content });
const count = async (key = KEY) => (await getLedgerRepository().listTransactions(key)).length;
const SALARY = "01/09/2026,NEFT ACME SALARY,,50000.00";

describe("exact and equivalent repeats", () => {
  it("re-importing the same CSV writes nothing and keeps totals", async () => {
    const c = csv(SALARY, "05/09/2026,UPI/SWIGGY/sw@bank,450.00,");
    await caller().inari.importCommit({ previewId: (await prev(c)).previewId });
    const before = await caller().inari.getSnapshot();
    const again = await prev(c);
    expect(again.counts).toMatchObject({ accepted: 0, duplicate: 2, possibleDuplicate: 0, written: 0 });
    await expect(caller().inari.importCommit({ previewId: again.previewId })).rejects.toThrow(/Nothing new/);
    expect(await count()).toBe(2);
    expect(JSON.stringify(await caller().inari.getSnapshot())).toBe(JSON.stringify(before));
  });

  it("the same payment with different spacing/punctuation is recognised as the same transaction", async () => {
    await caller().inari.importCommit({ previewId: (await prev(csv(SALARY, "05/09/2026,UPI/SWIG GY/sw@bank,450.00,"))).previewId });
    const again = await prev(csv("05/09/2026,UPI / SWIGGY / sw@bank,450.00,"));
    expect(again.counts).toMatchObject({ accepted: 0, duplicate: 1, possibleDuplicate: 0 });
    expect(await count()).toBe(2);
  });

  it("a CSV of the same payments after a PDF import (cross-format) is a duplicate", async () => {
    const dir = path.resolve(__dirname, "../../data/parser-tests/pdf");
    const expected = JSON.parse(readFileSync(path.join(dir, "expected.json"), "utf8")) as { transactions: { postedOn: string; amountPaise: number; direction: string; narration: string }[] };
    const pdf = await caller().inari.importPreview({ kind: "pdf", filename: "a.pdf", contentBase64: readFileSync(path.join(dir, "layout_a_debit_credit_columns.pdf")).toString("base64") });
    await caller().inari.importCommit({ previewId: pdf.previewId });
    const n = await count();
    const rows = expected.transactions.map(t => {
      const [y, m, d] = t.postedOn.split("-");
      const amt = (t.amountPaise / 100).toFixed(2);
      return `${d}/${m}/${y},${t.narration.replace(/,/g, " ")},${t.direction === "debit" ? amt : ""},${t.direction === "credit" ? amt : ""}`;
    });
    const p = await prev(csv(...rows));
    expect(p.counts).toMatchObject({ accepted: 0, duplicate: n, possibleDuplicate: 0, written: 0 });
    expect(await count()).toBe(n);
  });
});

describe("possible duplicates need explicit review", () => {
  const first = csv(SALARY, "10/09/2026,UPI/CHAI POINT/chai@bank,250.00,");
  const reworded = csv("10/09/2026,SMS bank account debit: CHAI POINT,250.00,");

  it("is held back by default; preview and commit agree on what is written", async () => {
    await caller().inari.importCommit({ previewId: (await prev(first)).previewId });
    const p = await prev(reworded);
    expect(p.counts).toMatchObject({ accepted: 0, duplicate: 0, possibleDuplicate: 1, written: 0 });
    expect(p.warnings.join(" ")).toMatch(/NOT be imported unless you review/);
    expect(p.rows[0]).toMatchObject({ status: "possible_duplicate" });
    expect(p.rows[0].reason).toMatch(/CHAI POINT/);
    await expect(caller().inari.importCommit({ previewId: p.previewId })).rejects.toThrow(/need your review/);
    expect(await count()).toBe(2);
  });

  it("can be included by row number, or all at once, and is then flagged and reconcilable and undoable", async () => {
    await caller().inari.importCommit({ previewId: (await prev(first)).previewId });
    const mixed = csv("10/09/2026,SMS bank account debit: CHAI POINT,250.00,", "11/09/2026,UPI/BOOKS/b@bank,300.00,");
    const p = await prev(mixed);
    expect(p.counts).toMatchObject({ accepted: 1, possibleDuplicate: 1, written: 1 });
    const flaggedRow = p.rows.find(r => r.status === "possible_duplicate")!.rowNumber;

    const onlyNew = await caller().inari.importCommit({ previewId: p.previewId });
    expect(onlyNew.counts).toMatchObject({ accepted: 1, possibleDuplicate: 1, written: 1 });
    expect(await count()).toBe(3);

    const p2 = await prev(mixed);
    expect(p2.counts).toMatchObject({ accepted: 0, duplicate: 1, possibleDuplicate: 1 });
    const included = await caller().inari.importCommit({ previewId: p2.previewId, importPossibleDuplicateRows: [flaggedRow] });
    expect(included.counts).toMatchObject({ written: 1 });
    expect(await count()).toBe(4);

    const all = await getLedgerRepository().listTransactions(KEY);
    const flagged = all.find(t => t.possibleDuplicateOf)!;
    expect(flagged.possibleDuplicateOf).toBeTruthy();
    expect((await caller().inari.getSnapshot()).dataQuality.map(n => n.code)).toContain("possible_duplicates");

    await caller().inari.reconcile({ transactionIds: [flagged.id], decision: "exclude_duplicate" });
    expect((await getLedgerRepository().listTransactions(KEY)).find(t => t.id === flagged.id)?.reconciliation?.decision).toBe("excluded_duplicate");
    expect(await count()).toBe(4); // excluded from totals, never deleted

    await caller().inari.importUndo({ batchId: included.batchId });
    expect(await count()).toBe(3);
  });

  it("importAllPossibleDuplicates writes every flagged row", async () => {
    await caller().inari.importCommit({ previewId: (await prev(first)).previewId });
    const p = await prev(reworded);
    const b = await caller().inari.importCommit({ previewId: p.previewId, importAllPossibleDuplicates: true });
    expect(b.counts.written).toBe(1);
    expect(await count()).toBe(3);
  });

  it("rows added between preview and commit are re-checked against the current ledger", async () => {
    const p = await prev(first);
    await caller().inari.importCommit({ previewId: (await prev(first)).previewId }); // another tab commits the same file first
    await expect(caller().inari.importCommit({ previewId: p.previewId })).rejects.toThrow(/Nothing new/);
    expect(await count()).toBe(2);
  });
});

describe("genuinely separate transactions stay importable", () => {
  it("two identical payments on the same day in one file are both written", async () => {
    const c = csv("12/09/2026,UPI/AUTO/a@bank,60.00,", "12/09/2026,UPI/AUTO/a@bank,60.00,");
    const p = await prev(c);
    expect(p.counts).toMatchObject({ accepted: 2, written: 2 });
    await caller().inari.importCommit({ previewId: p.previewId });
    expect(await count()).toBe(2);
    expect((await prev(c)).counts).toMatchObject({ accepted: 0, duplicate: 2 });
  });

  it("a later file with a second identical payment adds exactly one", async () => {
    await caller().inari.importCommit({ previewId: (await prev(csv("12/09/2026,UPI/AUTO/a@bank,60.00,"))).previewId });
    const p = await prev(csv("12/09/2026,UPI/AUTO/a@bank,60.00,", "12/09/2026,UPI/AUTO/a@bank,60.00,"));
    expect(p.counts).toMatchObject({ duplicate: 1, accepted: 1, written: 1 });
    await caller().inari.importCommit({ previewId: p.previewId });
    expect(await count()).toBe(2);
  });

  it("same amount on the same day to a different merchant needs review but can be included", async () => {
    await caller().inari.importCommit({ previewId: (await prev(csv("12/09/2026,UPI/CAFE ONE/c@bank,120.00,"))).previewId });
    const p = await prev(csv("12/09/2026,UPI/CAFE TWO/d@bank,120.00,"));
    expect(p.counts).toMatchObject({ possibleDuplicate: 1, written: 0 });
    await caller().inari.importCommit({ previewId: p.previewId, importAllPossibleDuplicates: true });
    expect(await count()).toBe(2);
  });

  it("user isolation: another user's identical file is not a duplicate of mine", async () => {
    await caller().inari.importCommit({ previewId: (await prev(csv(SALARY))).previewId });
    const theirs = await prev(csv(SALARY), OTHER);
    expect(theirs.counts).toMatchObject({ accepted: 1, duplicate: 0, written: 1 });
  });
});
