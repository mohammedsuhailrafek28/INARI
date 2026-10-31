/**
 * Imported data must drive the EXISTING dashboard / spending / advisor / prediction routes,
 * and the seeded persona must never leak into imported mode.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";
import { FileLedgerRepository, setLedgerRepositoryForTests } from "./ledger";
import { _previewStoreForTests } from "./service";

const A = "anon:00000000-0000-4000-8000-0000000000a1";
const B = "anon:00000000-0000-4000-8000-0000000000b1";

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
const pad = (n: number) => String(n).padStart(2, "0");
const csv = (months: number[]) =>
  ["Date,Description,Debit,Credit", ...months.flatMap(m => ROWS.map(([d, n, dr, cr]) => `${pad(d)}/${pad(m)}/2026,${n},${dr ? dr.toFixed(2) : ""},${cr ? cr.toFixed(2) : ""}`))].join("\n");

async function importThreeMonths(key: string) {
  const c = as(key);
  const p = await c.inari.importPreview({ kind: "csv", filename: "q3.csv", content: csv([7, 8, 9]) });
  await c.inari.importCommit({ previewId: p.previewId });
}

beforeEach(() => {
  setLedgerRepositoryForTests(new FileLedgerRepository());
  _previewStoreForTests.clear();
});

describe("without imported data the demo persona still works (legacy behaviour preserved)", () => {
  it("dashboard.getSummary returns the persona", async () => {
    const d: any = await as(A).dashboard.getSummary();
    expect(d.profile.name).toEqual(expect.any(String));
    expect(d.monthlyIncome).toBeGreaterThan(0);
    expect(d.dataSource).toBeUndefined();
  });
});

describe("imported data drives the legacy routes", () => {
  it("dashboard.getSummary shows imported income/expenses/savings and null for unknown balances", async () => {
    await importThreeMonths(A);
    const d: any = await as(A).dashboard.getSummary();
    expect(d).toMatchObject({
      dataSource: "imported",
      monthlyIncome: 100000,
      monthlyExpenses: 60000,
      savingsRate: 40,
      investmentBalance: null,
      emergencyFundBalance: null,
      creditCardDebt: null,
    });
    expect([...d.unknownFields].sort()).toEqual(["creditCardDebt", "emergencyFund", "investments"]);
    expect(d.financialHealth).toMatchObject({ partial: true });
    expect([...d.financialHealth.unknownComponents].sort()).toEqual(["debt", "emergencyFund", "investment"]);
    // savings component only: 40% rate -> 10/25 -> rescaled to 40/100
    expect(d.financialHealth.overallScore).toBe(40);
  });

  it("no persona value or name appears anywhere in imported-mode responses", async () => {
    const profiles = (await as(A).profiles.list()) as any[];
    expect(profiles.length).toBeGreaterThan(0);
    await importThreeMonths(A);
    const c = as(A);
    const responses = {
      summary: await c.dashboard.getSummary(),
      breakdown: await c.spending.getBreakdown(),
      unusual: await c.spending.getUnusual(),
      opportunities: await c.spending.getOpportunities(),
      goals: await c.goals.list(),
      recs: await c.recommendations.list(),
      alerts: await c.alerts.list(),
      recent: await c.transactions.recent(),
      txSummary: await c.transactions.summary(),
      context: await c.wealth.getContext(),
      insights: await c.wealth.getInsights(),
      predictions: await c.wealth.getPredictions(),
      answer: await c.wealth.askAdvisor({ question: "How is my emergency fund and what should I do about debt?" }),
    };
    const text = JSON.stringify(responses);
    for (const p of profiles) {
      expect(text).not.toContain(p.name);
      if (p.occupation) expect(text).not.toContain(p.occupation);
      for (const key of ["investmentBalance", "emergencyFundBalance", "creditCardDebt"]) {
        const v = Math.round(Number(p[key]));
        if (v > 1000) expect(text).not.toMatch(new RegExp(`(?<![\\d.])${v}(?![\\d])`));
      }
    }
  });

  it("spending.getBreakdown reflects imported averages, summing to monthly expenses", async () => {
    await importThreeMonths(A);
    const b = await as(A).spending.getBreakdown();
    expect(b).toMatchObject({ rent: 25000, groceries: 12000, dining: 6000, utilities: 4000, subscription: 650, transport: 3350, shopping: 9000 });
    expect(Object.values(b).reduce((s, v) => s + v, 0)).toBe(60000);
    expect(await as(A).spending.getOpportunities()).toEqual(
      expect.arrayContaining([expect.objectContaining({ category: "dining", amount: 600 })])
    );
  });

  it("recommendations never reason about unknown balances", async () => {
    await importThreeMonths(A);
    const text = JSON.stringify(await as(A).recommendations.list()).toLowerCase();
    expect(text).not.toContain("emergency fund");
    expect(text).not.toContain("credit card debt");
    expect(text).not.toContain("credit-card");
  });

  it("once balances are supplied, balance-based advice and the full health score appear", async () => {
    await importThreeMonths(A);
    await as(A).inari.setBalances({ emergencyFund: 30000, investments: 50000, creditCardDebt: 0 });
    const d: any = await as(A).dashboard.getSummary();
    expect(d).toMatchObject({ emergencyFundBalance: 30000, investmentBalance: 50000, creditCardDebt: 0, unknownFields: [] });
    expect(d.financialHealth.partial).toBeUndefined();
    const ctx: any = await as(A).wealth.getContext();
    expect(ctx.dataSource).toBe("imported");
    expect(JSON.stringify(ctx.recommendations)).toMatch(/emergency/i); // 30k < 3 x 60k
  });

  it("the advisor says a balance is unknown instead of inventing one", async () => {
    await importThreeMonths(A);
    const answer: any = await as(A).wealth.askAdvisor({ question: "How many months does my emergency fund cover?" });
    expect(JSON.stringify(answer)).toMatch(/not provided|not told|have not/i);
    expect(answer.answer).not.toMatch(/\b0\.0 months/);
  });

  it("transactions.recent and transactions.summary come from the ledger", async () => {
    await importThreeMonths(A);
    const recent = await as(A).transactions.recent();
    expect(recent).toHaveLength(24);
    expect(recent[0]).toMatchObject({ description: expect.any(String), amount: expect.any(Number) });
    expect(await as(A).transactions.summary()).toMatchObject({ income: 100000, expenses: 60000 });
  });

  it("imported mode without a complete month gives an honest empty state, not the persona", async () => {
    const c = as(A);
    const p = await c.inari.importPreview({ kind: "csv", filename: "h.csv", content: "Date,Description,Debit,Credit\n01/09/2026,NEFT SALARY,,100000.00\n05/09/2026,UPI/1/SWIGGY/x@y,300.00," });
    await c.inari.importCommit({ previewId: p.previewId });
    const d: any = await c.dashboard.getSummary();
    expect(d).toMatchObject({ dataSource: "imported", monthlyIncome: null, monthlyExpenses: null, financialHealth: null });
    expect(await c.wealth.getContext()).toBeNull();
    const answer: any = await c.wealth.askAdvisor({ question: "How am I doing financially?" });
    expect(answer.answer).toMatch(/no financial data|full month/i);
  });

  it("imported data of one browser never reaches another browser's dashboard", async () => {
    await importThreeMonths(A);
    const d: any = await as(B).dashboard.getSummary();
    expect(d.dataSource).toBeUndefined();
    expect(d.monthlyIncome).not.toBe(100000);
  });

  it("useDemoData switches back to the persona and again to imported data", async () => {
    await importThreeMonths(A);
    await as(A).inari.useDemoData({ enabled: true });
    expect(((await as(A).dashboard.getSummary()) as any).dataSource).toBeUndefined();
    expect((await as(A).inari.meta()).dataSource).toBe("demo");
    await as(A).inari.useDemoData({ enabled: false });
    expect(((await as(A).dashboard.getSummary()) as any).dataSource).toBe("imported");
  });

  it("correcting a category recalculates the dashboard numbers", async () => {
    await importThreeMonths(A);
    const tx = (await as(A).inari.listTransactions({ month: "2026-09", limit: 50 })).items.find(t => t.narration.includes("BIGBASKET"))!;
    await as(A).inari.correctCategory({ transactionId: tx.id, category: "investment", applyToMerchant: false });
    const d: any = await as(A).dashboard.getSummary();
    expect(d.monthlyExpenses).toBe(56000); // (60000 + 60000 + 48000) / 3
    expect(d.savingsRate).toBe(44);
  });
});
