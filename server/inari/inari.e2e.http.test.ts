/**
 * Real HTTP end-to-end: Express + tRPC middleware + signed anonymous-identity cookie,
 * driven with fetch and two independent cookie jars ("browsers").
 */
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

let server: Server;
let base = "";

beforeAll(async () => {
  process.env.WEALTHVERSE_DEMO_MODE = "true";
  process.env.INARI_IDENTITY_SECRET = "e2e-test-secret-not-real";
  process.env.NODE_ENV = "test";
  const [{ default: express }, { createExpressMiddleware }, { appRouter }, { createContext }, ledger] = await Promise.all([
    import("express"),
    import("@trpc/server/adapters/express"),
    import("../routers"),
    import("../_core/context"),
    import("./ledger"),
  ]);
  ledger.setLedgerRepositoryForTests(new ledger.FileLedgerRepository());
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  await new Promise<void>(resolve => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/trpc`;
});
afterAll(() => new Promise<void>(resolve => server.close(() => resolve())));

class Browser {
  cookie = "";
  async call(proc: string, input?: unknown, kind: "query" | "mutation" = input === undefined ? "query" : "mutation") {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (this.cookie) headers.cookie = this.cookie;
    const res =
      kind === "query"
        ? await fetch(`${base}/${proc}${input === undefined ? "" : `?input=${encodeURIComponent(JSON.stringify({ json: input }))}`}`, { headers })
        : await fetch(`${base}/${proc}`, { method: "POST", headers, body: JSON.stringify({ json: input ?? null }) });
    const set = res.headers.getSetCookie?.() ?? [];
    for (const c of set) if (c.startsWith("inari_demo_id=")) this.cookie = c.split(";")[0];
    const body: any = await res.json();
    return { status: res.status, body, data: body?.result?.data?.json, error: body?.error?.json };
  }
}

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

describe("HTTP e2e: upload -> preview -> commit -> snapshot -> dashboard, with two browsers", () => {
  const alice = new Browser();
  const bob = new Browser();

  it("issues a signed HttpOnly cookie on the first request and sets none for forged cookies", async () => {
    const res = await fetch(`${base}/inari.meta`);
    const cookie = (res.headers.getSetCookie?.() ?? []).find(c => c.startsWith("inari_demo_id="))!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    const forged = await fetch(`${base}/inari.meta`, { headers: { cookie: "inari_demo_id=v1.00000000-0000-4000-8000-000000000000.AAAA" } });
    expect(forged.status).toBe(200);
    expect((forged.headers.getSetCookie?.() ?? []).some(c => c.startsWith("inari_demo_id="))).toBe(true); // reissued, forged id not honoured
  });

  it("alice imports a statement and sees the exact invariant numbers", async () => {
    const meta = await alice.call("inari.meta");
    expect(meta.data.dataSource).toBe("demo");
    const preview = await alice.call("inari.importPreview", { kind: "csv", filename: "q3.csv", content: CSV });
    expect(preview.status).toBe(200);
    expect(preview.data.counts).toMatchObject({ accepted: 24, duplicate: 0, rejected: 0 });
    const commit = await alice.call("inari.importCommit", { previewId: preview.data.previewId });
    expect(commit.data.status).toBe("committed");
    const snap = await alice.call("inari.getSnapshot");
    expect(snap.data).toMatchObject({ implementation: "implemented", dataSource: "imported", monthlyIncome: 100000, monthlyExpenses: 60000, monthlySurplus: 40000, savingsRate: 40 });
    expect(snap.data.balances).toEqual({ emergencyFund: null, investments: null, creditCardDebt: null });
    const dash = await alice.call("dashboard.getSummary");
    expect(dash.data).toMatchObject({ dataSource: "imported", monthlyIncome: 100000, savingsRate: 40 });
  });

  it("re-uploading the same file over HTTP is fully deduplicated", async () => {
    const again = await alice.call("inari.importPreview", { kind: "csv", filename: "q3.csv", content: CSV });
    expect(again.data.counts).toMatchObject({ accepted: 0, duplicate: 24 });
  });

  it("bob (different browser) sees none of alice's data and cannot use her preview or batch ids", async () => {
    const preview = await alice.call("inari.importPreview", { kind: "csv", filename: "n.csv", content: CSV.replace(/2026/g, "2025") });
    const bobSnap = await bob.call("inari.getSnapshot");
    expect(bobSnap.data.monthlyIncome).toBeNull();
    expect((await bob.call("inari.listTransactions", {}, "query")).data.items).toHaveLength(0);
    const steal = await bob.call("inari.importCommit", { previewId: preview.data.previewId });
    expect(steal.status).toBeGreaterThanOrEqual(400);
    expect(steal.error.data.inari.code).toBe("PREVIEW_EXPIRED");
    const hist = await alice.call("inari.importHistory");
    const bobUndo = await bob.call("inari.importUndo", { batchId: hist.data.items[0].batchId });
    expect(bobUndo.error.data.inari.code).toBe("NOT_FOUND");
    expect((await alice.call("inari.getSnapshot")).data.monthlyIncome).toBe(100000);
    const bobDash = await bob.call("dashboard.getSummary");
    expect(bobDash.data.monthlyIncome).not.toBe(100000);
  });

  it("errors over HTTP are sanitized: stable code, no stack, no echoed input", async () => {
    const bad = await alice.call("inari.correctCategory", { transactionId: "SECRET-ID-7731", category: "not-a-category", applyToMerchant: false });
    expect(bad.status).toBe(400);
    expect(bad.error.data.inari.code).toBe("INVALID_INPUT");
    expect(JSON.stringify(bad.body)).not.toContain("SECRET-ID-7731");
    expect(bad.error.data.stack).toBeUndefined();
    const notCsv = await alice.call("inari.importPreview", { kind: "csv", filename: "x.csv", content: "just,some\nrandom,words" });
    expect(notCsv.error.data.inari.code).toBe("PARSE_FAILED");
  });

  it("dictated text -> intent -> simulation over HTTP, without touching the ledger", async () => {
    const preview = await alice.call("inari.importPreview", { kind: "csv", filename: "q3.csv", content: CSV });
    await alice.call("inari.importCommit", { previewId: preview.data.previewId });
    const before = (await alice.call("inari.getSnapshot")).data;
    const intent = await alice.call("inari.analyzeIntent", { text: "um I spend 6000 on swiggy, actually make that 7000, what if I cut it in half" });
    expect(intent.data).toMatchObject({ intent: "what_if", category: "dining", percent: 50, amount: 7000, scenario: { type: "reduce_category", category: "dining", percent: 50 } });
    const sim = await alice.call("inari.simulate", { scenarios: [intent.data.scenario] });
    const expenses = sim.data.metrics.find((m: any) => m.label === "Monthly expenses");
    expect(expenses).toMatchObject({ baseline: 60000, scenario: 57000 }); // dining 6000 halved
    expect(sim.data.ledgerUnchanged).toBe(true);
    expect((await alice.call("inari.getSnapshot")).data).toEqual(before);
    expect((await bob.call("inari.simulate", { scenarios: [intent.data.scenario] })).data.status).toBe("insufficient_data");
    const bad = await alice.call("inari.simulate", { scenarios: [{ type: "cancel_subscriptions", subscriptionIds: ["x"] }] });
    expect(bad.error.data.inari.code).toBe("INVALID_SCENARIO");
  });

  it("pasted SMS alerts import over HTTP into the same ledger; OTP text is dropped and another browser sees nothing", async () => {
    const carol = new Browser();
    const text = [
      "Rs.100000.00 credited to A/c XX1234 on 01-07-26 by NEFT Ref N100000000001 (ACME CORP SALARY)",
      "Rs.6000.00 debited from A/c XX1234 on 10-07-26 to swiggy@ybl (UPI Ref No 222000000001)",
      "551234 is your OTP for login. Do not share.",
    ].join("\n\n");
    const preview = await carol.call("inari.importPreview", { kind: "sms", text });
    expect(preview.data.counts).toMatchObject({ accepted: 2, ignored: 1 });
    expect(JSON.stringify(preview.body)).not.toContain("551234");
    const commit = await carol.call("inari.importCommit", { previewId: preview.data.previewId });
    expect(commit.data).toMatchObject({ status: "committed", source: "sms" });
    const items = (await carol.call("inari.listTransactions", {}, "query")).data.items;
    expect(items).toHaveLength(2);
    expect(JSON.stringify(items)).not.toContain("551234");
    expect((await bob.call("inari.listTransactions", {}, "query")).data.items).toHaveLength(0);
    const again = await carol.call("inari.importPreview", { kind: "sms", text });
    expect(again.data.counts).toMatchObject({ accepted: 0, duplicate: 2 });
  });

  it("monthly report and explicit reconciliation over HTTP, isolated per browser", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-31T10:00:00Z"));
    try {
      const dana = new Browser();
      const csv = ["Date,Description,Debit,Credit", "01/07/2026,NEFT ACME SALARY,,100000.00", "10/07/2026,UPI/3/SWIGGY/sw@bank,500.00,", "28/07/2026,AMAZON PAY RETAIL,1000.00,"].join("\n");
      const p = await dana.call("inari.importPreview", { kind: "csv", filename: "j.csv", content: csv });
      await dana.call("inari.importCommit", { previewId: p.data.previewId });
      const sms = await dana.call("inari.importPreview", { kind: "sms", text: "Rs.500.00 debited from A/c XX1234 on 10-07-26 to swiggy@ybl (UPI Ref No 900000000001)" });
      expect(sms.data.counts.possibleDuplicate).toBe(1);
      await dana.call("inari.importCommit", { previewId: sms.data.previewId });

      const months = await dana.call("inari.listReportMonths", undefined, "query");
      expect(months.data.months).toEqual(["2026-07"]);
      const before = await dana.call("inari.monthlyReport", { month: "2026-07" }, "query");
      expect(before.data).toMatchObject({ status: "ok", totals: { income: 100000, expenses: 2000 } });
      expect(before.data.dataQuality.map((n: any) => n.code)).toContain("possible_duplicates");
      const dup = (await dana.call("inari.listTransactions", {}, "query")).data.items.find((t: any) => t.possibleDuplicateOf);

      expect((await bob.call("inari.reconcile", { transactionIds: [dup.id], decision: "exclude_duplicate" })).error.data.inari.code).toBe("NOT_FOUND");
      const done = await dana.call("inari.reconcile", { transactionIds: [dup.id], decision: "exclude_duplicate" });
      expect(done.data).toMatchObject({ implementation: "implemented", updated: 1 });
      const after = await dana.call("inari.getMonthlyReport", { month: "2026-07" }, "query");
      expect(after.data.totals.expenses).toBe(1500);
      expect((await dana.call("inari.listTransactions", {}, "query")).data.items).toHaveLength(4);
      expect((await bob.call("inari.monthlyReport", { month: "2026-07" }, "query")).data.status).toBe("insufficient_data");
    } finally {
      vi.useRealTimers();
    }
  });

  it("correction over HTTP recalculates the breakdown; clearMyData then wipes alice only", async () => {
    const tx = (await alice.call("inari.listTransactions", { month: "2026-09", limit: 50 }, "query")).data.items.find((t: any) => t.narration.includes("UBER"));
    const fix = await alice.call("inari.correctCategory", { transactionId: tx.id, category: "travel", applyToMerchant: true });
    expect(fix.data.updated).toBe(3); // three months of UBER via the learned rule
    expect((await alice.call("inari.getBreakdown", { month: "2026-09" }, "query")).data.items.find((i: any) => i.category === "travel").amount).toBe(3350);
    expect((await alice.call("inari.clearMyData", { confirm: "DELETE" })).data.deletedTransactions).toBe(24);
    expect((await alice.call("inari.getSnapshot")).data.monthlyIncome).toBeNull();
  });
});
