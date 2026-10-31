import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import { createContext, type TrpcContext } from "../_core/context";
import {
  ANON_COOKIE_NAME, issueAnonymousId, resolveAnonymousIdentity, verifyAnonymousCookie,
} from "./identity";
import { FileLedgerRepository, setLedgerRepositoryForTests, type StoredBatch } from "./ledger";
import {
  CATEGORIES, ImportBatch, ImportPreview, IntentAnalysis, InariAdvisorResponse, LedgerTransaction, MonthlyReport,
  PROCEDURE_ALIASES, PROCEDURE_NAMES, PROCEDURE_STATUS, SimulationResult, Snapshot, SubscriptionsOutput, GoalsOutput,
  type LedgerTransaction as Txn,
} from "../../shared/inari/contracts";
import * as fx from "../../shared/inari/fixtures";
import { inariRouter } from "./router";

const SECRET = "test-secret-not-a-real-one";
const tmp = mkdtempSync(path.join(tmpdir(), "inari-test-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const makeTxn = (over: Partial<Txn> = {}): Txn => ({
  ...fx.sampleTransaction,
  id: "t1", fingerprint: "fp1", batchId: "b1", ...over,
});
const makeBatch = (over: Partial<StoredBatch> = {}): StoredBatch => ({
  batchId: "b1", source: "csv", filename: "x.csv", importedAt: "2026-10-31T00:00:00.000Z",
  counts: { total: 1, accepted: 1, duplicate: 0, possibleDuplicate: 0, rejected: 0, ignored: 0 },
  period: { from: "2026-09-01", to: "2026-09-30" }, status: "committed", ...over,
});

function ctxFor(ownerKey: string): TrpcContext {
  return {
    user: {
      id: 5, openId: "local-demo-user", email: null, name: "Demo", loginMethod: "local-demo", role: "user",
      createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    },
    req: { protocol: "http", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
    inariUserKey: ownerKey,
    inariIdentityKind: "anonymous_demo",
  };
}

describe("shared contracts and fixtures", () => {
  it("every fixture satisfies its Zod schema", () => {
    expect(() => LedgerTransaction.parse(fx.sampleTransaction)).not.toThrow();
    fx.sampleTransactions.forEach(t => expect(() => LedgerTransaction.parse(t)).not.toThrow());
    expect(() => Snapshot.parse(fx.sampleSnapshot)).not.toThrow();
    expect(() => ImportBatch.parse(fx.sampleBatch)).not.toThrow();
    expect(() => ImportPreview.parse(fx.samplePreview)).not.toThrow();
    expect(() => SimulationResult.parse(fx.sampleSimulation)).not.toThrow();
    expect(() => MonthlyReport.parse(fx.sampleReport)).not.toThrow();
    expect(() => IntentAnalysis.parse(fx.sampleIntent)).not.toThrow();
    expect(() => InariAdvisorResponse.parse(fx.sampleAdvisor)).not.toThrow();
    expect(() => SubscriptionsOutput.parse({ implementation: "stub", items: fx.sampleSubscriptions, monthlyTotal: 649, annualTotal: 7788 })).not.toThrow();
    expect(() => GoalsOutput.parse({ implementation: "stub", items: fx.sampleGoals, dataSource: "imported" })).not.toThrow();
  });

  it("fixture transaction categories belong to the taxonomy", () => {
    fx.sampleTransactions.forEach(t => expect(CATEGORIES).toContain(t.category));
  });

  it("status registry matches the router exactly (no missing or extra procedures)", () => {
    const routerKeys = Object.keys((inariRouter as any)._def.procedures).sort();
    expect(routerKeys).toEqual([...PROCEDURE_NAMES].sort());
    expect(Object.keys(PROCEDURE_STATUS).sort()).toEqual([...PROCEDURE_NAMES].sort());
  });

  it("aliases are implemented by the same status as their canonical procedure", () => {
    for (const [alias, canonical] of Object.entries(PROCEDURE_ALIASES)) {
      expect(PROCEDURE_STATUS[alias as keyof typeof PROCEDURE_STATUS]).toBe(
        PROCEDURE_STATUS[canonical as keyof typeof PROCEDURE_STATUS]
      );
    }
  });

  it("fixtures are visibly synthetic", () => {
    expect(fx.sampleAdvisor.answer).toMatch(/FIXTURE/);
    expect(fx.sampleAdvisor.mode).toBe("stub");
  });
});

const TINY_CSV = ["Date,Description,Debit,Credit", "01/09/2026,UPI/123/SWIGGY/x@y,250.00,", "02/09/2026,NEFT ACME SALARY,,50000.00"].join("\n");

describe("inari router: stub honesty", () => {
  beforeEach(() => setLedgerRepositoryForTests(new FileLedgerRepository()));

  const caller = () => appRouter.createCaller(ctxFor("anon:00000000-0000-4000-8000-000000000001"));
  const calls: Record<string, (c: ReturnType<typeof caller>) => Promise<any>> = {
    meta: c => c.inari.meta(),
    getSnapshot: c => c.inari.getSnapshot(),
    setBalances: c => c.inari.setBalances({ emergencyFund: null, investments: null, creditCardDebt: null }),
    useDemoData: c => c.inari.useDemoData({ enabled: true }),
    clearMyData: c => c.inari.clearMyData({ confirm: "DELETE" }),
    importPreview: c => c.inari.importPreview({ kind: "csv", filename: "a.csv", content: TINY_CSV }),
    importCommit: async c => c.inari.importCommit({ previewId: (await c.inari.importPreview({ kind: "csv", filename: "a.csv", content: TINY_CSV })).previewId }),
    importUndo: async c => {
      const p = await c.inari.importPreview({ kind: "csv", filename: "a.csv", content: TINY_CSV });
      return c.inari.importUndo({ batchId: (await c.inari.importCommit({ previewId: p.previewId })).batchId });
    },
    importHistory: c => c.inari.importHistory(),
    listTransactions: c => c.inari.listTransactions(),
    getTransactions: c => c.inari.getTransactions(),
    getCategories: c => c.inari.getCategories(),
    correctCategory: async c => {
      const p = await c.inari.importPreview({ kind: "csv", filename: "a.csv", content: TINY_CSV });
      await c.inari.importCommit({ previewId: p.previewId });
      const tx = (await c.inari.listTransactions()).items[0];
      return c.inari.correctCategory({ transactionId: tx.id, category: "dining", applyToMerchant: false });
    },
    listLearnedRules: c => c.inari.listLearnedRules(),
    getLearnedRules: c => c.inari.getLearnedRules(),
    deleteLearnedRule: async c => {
      const p = await c.inari.importPreview({ kind: "csv", filename: "a.csv", content: TINY_CSV });
      await c.inari.importCommit({ previewId: p.previewId });
      const tx = (await c.inari.listTransactions()).items[0];
      await c.inari.correctCategory({ transactionId: tx.id, category: "dining", applyToMerchant: true });
      return c.inari.deleteLearnedRule({ ruleId: (await c.inari.listLearnedRules()).items[0].ruleId });
    },
    getBreakdown: c => c.inari.getBreakdown({ month: "2026-09" }),
    listSubscriptions: c => c.inari.listSubscriptions(),
    getSubscriptions: c => c.inari.getSubscriptions(),
    confirmSubscription: c => c.inari.confirmSubscription({ subscriptionId: "s", decision: "confirm" }),
    simulate: c => c.inari.simulate({ scenarios: [{ type: "reduce_category", category: "dining", percent: 30 }] }),
    ask: c => c.inari.ask({ question: "hi", locale: "en" }),
    askAdvisor: c => c.inari.askAdvisor({ question: "hi", locale: "en" }),
    analyzeIntent: c => c.inari.analyzeIntent({ text: "hello" }),
    monthlyReport: c => c.inari.monthlyReport({ month: "2026-09" }),
    getMonthlyReport: c => c.inari.getMonthlyReport({ month: "2026-09" }),
    listReportMonths: c => c.inari.listReportMonths(),
    getGoals: c => c.inari.getGoals(),
    upsertGoal: c => c.inari.upsertGoal({ goalType: "gadget", targetAmount: 1000, currentAmount: 0, priority: "medium" }),
    deleteGoal: c => c.inari.deleteGoal({ id: "g" }),
  };

  it("has a call for every procedure", () => {
    expect(Object.keys(calls).sort()).toEqual([...PROCEDURE_NAMES].sort());
  });

  for (const name of PROCEDURE_NAMES) {
    it(`${name}: response.implementation equals registry status (${PROCEDURE_STATUS[name]})`, async () => {
      const result = await calls[name](caller());
      expect(result.implementation).toBe(PROCEDURE_STATUS[name]);
    });
  }

  it("meta never claims production-grade identity and reports non-durable storage", async () => {
    const meta = await caller().inari.meta();
    expect(meta.identity.productionGrade).toBe(false);
    expect(meta.storage.durable).toBe(false);
    expect(meta.features.csv).toBe(true);
  });

  it("rejects invalid input (unknown category, bad month, oversize question)", async () => {
    const c = caller();
    await expect(c.inari.getBreakdown({ month: "2026-13" })).rejects.toThrow();
    await expect(c.inari.correctCategory({ transactionId: "t", category: "nope" as any, applyToMerchant: false })).rejects.toThrow();
    await expect(c.inari.ask({ question: "x".repeat(1001), locale: "en" })).rejects.toThrow();
    await expect(c.inari.clearMyData({ confirm: "yes" as any })).rejects.toThrow();
  });

  it("existing WealthVerse routes still respond", async () => {
    const c = caller();
    expect((await c.wealth.getContext())?.activeProfile.name).toEqual(expect.any(String));
    expect((await c.profiles.list()).length).toBeGreaterThan(0);
  });
});

describe("anonymous demo identity", () => {
  it("accepts its own signed cookie and returns the id", () => {
    const { id, cookieValue } = issueAnonymousId(SECRET);
    expect(verifyAnonymousCookie(cookieValue, SECRET)).toBe(id);
  });

  it("rejects tampered id, tampered signature, wrong secret, malformed and oversized values", () => {
    const { cookieValue } = issueAnonymousId(SECRET);
    const [v, id, sig] = cookieValue.split(".");
    const other = issueAnonymousId(SECRET).id;
    expect(verifyAnonymousCookie(`${v}.${other}.${sig}`, SECRET)).toBeNull();
    expect(verifyAnonymousCookie(`${v}.${id}.${sig.slice(0, -2)}AA`, SECRET)).toBeNull();
    expect(verifyAnonymousCookie(cookieValue, "different-secret")).toBeNull();
    expect(verifyAnonymousCookie("garbage", SECRET)).toBeNull();
    expect(verifyAnonymousCookie(`v1.not-a-uuid.${sig}`, SECRET)).toBeNull();
    expect(verifyAnonymousCookie("x".repeat(500), SECRET)).toBeNull();
    expect(verifyAnonymousCookie(undefined, SECRET)).toBeNull();
  });

  const fakeRes = () => {
    const calls: any[] = [];
    return { calls, res: { cookie: (...a: any[]) => calls.push(a) } as any };
  };

  it("issues an httpOnly lax cookie to a new browser and reuses it on return", () => {
    process.env.INARI_IDENTITY_SECRET = SECRET;
    const first = fakeRes();
    const a = resolveAnonymousIdentity({ headers: {}, protocol: "http" } as any, first.res);
    expect(a.issued).toBe(true);
    const [name, value, options] = first.calls[0];
    expect(name).toBe(ANON_COOKIE_NAME);
    expect(options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", secure: false });

    const second = fakeRes();
    const again = resolveAnonymousIdentity(
      { headers: { cookie: `${ANON_COOKIE_NAME}=${value}` }, protocol: "http" } as any,
      second.res
    );
    expect(again.issued).toBe(false);
    expect(again.userKey).toBe(a.userKey);
    expect(second.calls).toHaveLength(0);
  });

  it("marks the cookie Secure behind an https proxy", () => {
    process.env.INARI_IDENTITY_SECRET = SECRET;
    const r = fakeRes();
    resolveAnonymousIdentity({ headers: { "x-forwarded-proto": "https" }, protocol: "http" } as any, r.res);
    expect(r.calls[0][2].secure).toBe(true);
  });

  it("two browsers get different identities; a forged cookie gets a fresh one, not someone else's", () => {
    process.env.INARI_IDENTITY_SECRET = SECRET;
    const r1 = fakeRes();
    const r2 = fakeRes();
    const a = resolveAnonymousIdentity({ headers: {}, protocol: "http" } as any, r1.res);
    const b = resolveAnonymousIdentity({ headers: {}, protocol: "http" } as any, r2.res);
    expect(a.userKey).not.toBe(b.userKey);
    expect(a.numericId).not.toBe(b.numericId);

    const forged = `v1.${a.anonId}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
    const r3 = fakeRes();
    const c = resolveAnonymousIdentity({ headers: { cookie: `${ANON_COOKIE_NAME}=${forged}` }, protocol: "http" } as any, r3.res);
    expect(c.issued).toBe(true);
    expect(c.userKey).not.toBe(a.userKey);
  });

  it("createContext in demo mode no longer hands every visitor user id 0", async () => {
    process.env.INARI_IDENTITY_SECRET = SECRET;
    const mk = () => {
      const cookies: any[] = [];
      const opts = { req: { headers: {}, protocol: "http" }, res: { cookie: (...a: any[]) => cookies.push(a) } } as any;
      return { opts, cookies };
    };
    const x = mk();
    const y = mk();
    const cx = await createContext(x.opts);
    const cy = await createContext(y.opts);
    expect(cx.user?.id).not.toBe(0);
    expect(cx.user?.id).not.toBe(cy.user?.id);
    expect(cx.inariUserKey).toMatch(/^anon:/);
    expect(cx.inariUserKey).not.toBe(cy.inariUserKey);
    expect(x.cookies).toHaveLength(1);
  });
});

describe("ledger repository", () => {
  const A = "anon:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const B = "anon:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  it("stores and returns a batch in deterministic order", async () => {
    const repo = new FileLedgerRepository();
    await repo.commitBatch(A, makeBatch(), [
      makeTxn({ id: "b", fingerprint: "f2", postedOn: "2026-09-01" }),
      makeTxn({ id: "a", fingerprint: "f1", postedOn: "2026-09-05" }),
      makeTxn({ id: "c", fingerprint: "f3", postedOn: "2026-09-05" }),
    ]);
    expect((await repo.listTransactions(A)).map(t => t.id)).toEqual(["a", "c", "b"]);
    expect((await repo.listTransactions(A, { month: "2026-09" })).length).toBe(3);
    expect((await repo.listTransactions(A, { month: "2026-08" })).length).toBe(0);
  });

  it("isolates users: B sees nothing of A and cannot read, undo, update or delete A's data", async () => {
    const repo = new FileLedgerRepository();
    await repo.commitBatch(A, makeBatch(), [makeTxn()]);
    expect(await repo.listTransactions(B)).toEqual([]);
    expect(await repo.getTransaction(B, "t1")).toBeNull();
    expect(await repo.listBatches(B)).toEqual([]);
    expect(await repo.undoBatch(B, "b1")).toBeNull();
    expect(await repo.updateTransactions(B, [{ id: "t1", patch: { category: "rent" } }])).toBe(0);
    expect(await repo.existingFingerprints(B)).toEqual(new Set());
    expect(await repo.deleteAll(B)).toEqual({ transactions: 0, batches: 0, rules: 0 });
    expect((await repo.getTransaction(A, "t1"))?.category).toBe("dining");
  });

  it("the same fingerprint may exist for two different users", async () => {
    const repo = new FileLedgerRepository();
    await repo.commitBatch(A, makeBatch(), [makeTxn()]);
    await repo.commitBatch(B, makeBatch(), [makeTxn()]);
    expect((await repo.listTransactions(A)).length).toBe(1);
    expect((await repo.listTransactions(B)).length).toBe(1);
  });

  it("refuses a duplicate fingerprint or a re-used batch id (no silent duplicates)", async () => {
    const repo = new FileLedgerRepository();
    await repo.commitBatch(A, makeBatch(), [makeTxn()]);
    await expect(repo.commitBatch(A, makeBatch({ batchId: "b2" }), [makeTxn({ id: "t2" })])).rejects.toThrow(/Duplicate/);
    await expect(repo.commitBatch(A, makeBatch(), [makeTxn({ id: "t3", fingerprint: "other" })])).rejects.toThrow(/already/);
    expect((await repo.listTransactions(A)).length).toBe(1);
  });

  it("undo removes only that batch's transactions and keeps history", async () => {
    const repo = new FileLedgerRepository();
    await repo.commitBatch(A, makeBatch(), [makeTxn()]);
    await repo.commitBatch(A, makeBatch({ batchId: "b2" }), [makeTxn({ id: "t2", fingerprint: "f2", batchId: "b2" })]);
    const undone = await repo.undoBatch(A, "b1");
    expect(undone?.status).toBe("undone");
    expect((await repo.listTransactions(A)).map(t => t.id)).toEqual(["t2"]);
    expect((await repo.listBatches(A)).length).toBe(2);
  });

  it("identity fields cannot be changed by updates; corrections write an audit trail", async () => {
    const repo = new FileLedgerRepository();
    await repo.commitBatch(A, makeBatch(), [makeTxn()]);
    const n = await repo.updateTransactions(
      A,
      [{ id: "t1", patch: { category: "groceries", categorySource: "user", fingerprint: "HACK", batchId: "evil", id: "zzz" } as any }],
      [{ id: "au1", transactionId: "t1", from: "dining", to: "groceries", at: "2026-10-31T00:00:00.000Z", scope: "single" }]
    );
    expect(n).toBe(1);
    const t = (await repo.getTransaction(A, "t1"))!;
    expect(t).toMatchObject({ category: "groceries", categorySource: "user", fingerprint: "fp1", batchId: "b1", id: "t1" });
    expect((await repo.listCorrectionAudit(A)).length).toBe(1);
  });

  it("returns copies: mutating a result does not change stored data", async () => {
    const repo = new FileLedgerRepository();
    await repo.commitBatch(A, makeBatch(), [makeTxn()]);
    const [t] = await repo.listTransactions(A);
    t.category = "rent";
    expect((await repo.getTransaction(A, "t1"))?.category).toBe("dining");
  });

  it("deleteAll removes transactions, batches and rules and reports counts", async () => {
    const repo = new FileLedgerRepository();
    await repo.commitBatch(A, makeBatch(), [makeTxn()]);
    await repo.upsertRule(A, { ruleId: "r1", merchantKey: "zepto", category: "groceries", createdAt: "2026-10-31T00:00:00.000Z", appliedCount: 0 });
    expect(await repo.deleteAll(A)).toEqual({ transactions: 1, batches: 1, rules: 1 });
    expect(await repo.listTransactions(A)).toEqual([]);
    expect(await repo.listRules(A)).toEqual([]);
  });

  it("rejects malformed owner keys", async () => {
    const repo = new FileLedgerRepository();
    await expect(repo.listTransactions("")).rejects.toThrow();
    await expect(repo.listTransactions("everyone")).rejects.toThrow();
    await expect(repo.listTransactions("anon:")).rejects.toThrow();
  });

  describe("restart behaviour", () => {
    it("memory mode loses data on restart (documented)", async () => {
      const r1 = new FileLedgerRepository();
      await r1.commitBatch(A, makeBatch(), [makeTxn()]);
      expect(await new FileLedgerRepository().listTransactions(A)).toEqual([]);
      expect(r1.storageInfo()).toMatchObject({ kind: "memory", durable: false });
    });

    it("json mode keeps data across a new instance reading the same file", async () => {
      const file = path.join(tmp, "restart", "ledger.json");
      const r1 = new FileLedgerRepository({ filePath: file });
      await r1.commitBatch(A, makeBatch(), [makeTxn()]);
      await r1.upsertRule(A, { ruleId: "r1", merchantKey: "zepto", category: "groceries", createdAt: "2026-10-31T00:00:00.000Z", appliedCount: 2 });
      const r2 = new FileLedgerRepository({ filePath: file });
      expect((await r2.listTransactions(A)).map(t => t.id)).toEqual(["t1"]);
      expect((await r2.listRules(A))[0].appliedCount).toBe(2);
      expect(await r2.listTransactions(B)).toEqual([]);
      expect(r2.storageInfo().durable).toBe(false); // never claim durability on possibly-ephemeral disks
    });

    it("json mode: deleteAll is persisted", async () => {
      const file = path.join(tmp, "delete", "ledger.json");
      const r1 = new FileLedgerRepository({ filePath: file });
      await r1.commitBatch(A, makeBatch(), [makeTxn()]);
      await r1.deleteAll(A);
      expect(await new FileLedgerRepository({ filePath: file }).listTransactions(A)).toEqual([]);
    });

    it("json mode: a corrupt file yields an empty ledger instead of crashing, then recovers on write", async () => {
      const dir = path.join(tmp, "corrupt");
      const file = path.join(dir, "ledger.json");
      const { mkdirSync } = await import("node:fs");
      mkdirSync(dir, { recursive: true });
      writeFileSync(file, "{not json");
      const r = new FileLedgerRepository({ filePath: file });
      expect(await r.listTransactions(A)).toEqual([]);
      await r.commitBatch(A, makeBatch(), [makeTxn()]);
      expect((await new FileLedgerRepository({ filePath: file }).listTransactions(A)).length).toBe(1);
    });

    it("json mode: 25 concurrent commits are all persisted without corruption", async () => {
      const file = path.join(tmp, "concurrent", "ledger.json");
      const r = new FileLedgerRepository({ filePath: file });
      await Promise.all(
        Array.from({ length: 25 }, (_, i) =>
          r.commitBatch(A, makeBatch({ batchId: `b${i}` }), [makeTxn({ id: `t${i}`, fingerprint: `f${i}`, batchId: `b${i}` })])
        )
      );
      const reloaded = new FileLedgerRepository({ filePath: file });
      expect((await reloaded.listTransactions(A)).length).toBe(25);
      expect((await reloaded.listBatches(A)).length).toBe(25);
    });
  });
});

describe("inari router + ledger ownership", () => {
  const A = "anon:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const B = "anon:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  it("listTransactions/importHistory/meta show only the caller's data; clearMyData deletes only the caller's data", async () => {
    const repo = new FileLedgerRepository();
    setLedgerRepositoryForTests(repo);
    await repo.commitBatch(A, makeBatch(), [makeTxn()]);
    await repo.commitBatch(B, makeBatch(), [makeTxn({ merchant: "Other" })]);

    const a = appRouter.createCaller(ctxFor(A));
    const b = appRouter.createCaller(ctxFor(B));
    expect((await a.inari.listTransactions()).items.map(t => t.merchant)).toEqual(["Swiggy"]);
    expect((await b.inari.listTransactions()).items.map(t => t.merchant)).toEqual(["Other"]);
    expect((await a.inari.meta()).dataSource).toBe("imported");

    const cleared = await a.inari.clearMyData({ confirm: "DELETE" });
    expect(cleared).toMatchObject({ deletedTransactions: 1, deletedBatches: 1 });
    expect((await a.inari.listTransactions()).items).toEqual([]);
    expect((await a.inari.listTransactions()).dataSource).toBe("demo");
    expect((await b.inari.listTransactions()).items.length).toBe(1);
    expect((await a.inari.importHistory()).items).toEqual([]);
    setLedgerRepositoryForTests(null);
  });

  it("pagination is stable and complete", async () => {
    const repo = new FileLedgerRepository();
    setLedgerRepositoryForTests(repo);
    await repo.commitBatch(
      A, makeBatch(),
      Array.from({ length: 7 }, (_, i) => makeTxn({ id: `t${i}`, fingerprint: `f${i}`, postedOn: `2026-09-${String(i + 1).padStart(2, "0")}` }))
    );
    const a = appRouter.createCaller(ctxFor(A));
    const p1 = await a.inari.listTransactions({ limit: 3 });
    const p2 = await a.inari.listTransactions({ limit: 3, cursor: p1.nextCursor! });
    const p3 = await a.inari.listTransactions({ limit: 3, cursor: p2.nextCursor! });
    expect([...p1.items, ...p2.items, ...p3.items].map(t => t.id)).toEqual(["t6", "t5", "t4", "t3", "t2", "t1", "t0"]);
    expect(p3.nextCursor).toBeNull();
    setLedgerRepositoryForTests(null);
  });
});
