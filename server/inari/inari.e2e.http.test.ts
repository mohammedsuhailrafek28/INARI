/**
 * Real HTTP end-to-end: Express + tRPC middleware + signed anonymous-identity cookie,
 * driven with fetch and two independent cookie jars ("browsers").
 */
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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

  it("correction over HTTP recalculates the breakdown; clearMyData then wipes alice only", async () => {
    const tx = (await alice.call("inari.listTransactions", { month: "2026-09", limit: 50 }, "query")).data.items.find((t: any) => t.narration.includes("UBER"));
    const fix = await alice.call("inari.correctCategory", { transactionId: tx.id, category: "travel", applyToMerchant: true });
    expect(fix.data.updated).toBe(3); // three months of UBER via the learned rule
    expect((await alice.call("inari.getBreakdown", { month: "2026-09" }, "query")).data.items.find((i: any) => i.category === "travel").amount).toBe(3350);
    expect((await alice.call("inari.clearMyData", { confirm: "DELETE" })).data.deletedTransactions).toBe(24);
    expect((await alice.call("inari.getSnapshot")).data.monthlyIncome).toBeNull();
  });
});
