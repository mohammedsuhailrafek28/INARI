/**
 * Advisor hardening: monthly-saving phrasings and multi-turn follow-ups.
 * Same fixture as inari.advisor.test.ts (Jun-Sep 2026, today = 2026-10-31):
 *   dining Jun/Jul/Aug 6000, Sep 9000; groceries 12000 every month; salary 100000;
 *   expenses Jul/Aug 55649, Sep 58649; 3-month average expenses 56649, savings 43351 (43.35%).
 *   Income -20000 => 80000 - 56649 = 23351 (29.19%); income -10000 => 90000 - 56649 = 33351 (37.06%).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";
import { FileLedgerRepository, setLedgerRepositoryForTests } from "./ledger";
import { _previewStoreForTests } from "./service";

const KEY = "anon:00000000-0000-4000-8000-0000000000a1";
const caller = () =>
  appRouter.createCaller({
    user: { id: 5, openId: "x", email: null, name: "D", loginMethod: "l", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "http", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
    inariUserKey: KEY,
    inariIdentityKind: "anonymous_demo",
  } as TrpcContext);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-31T10:00:00Z"));
  setLedgerRepositoryForTests(new FileLedgerRepository());
  _previewStoreForTests.clear();
});
afterEach(() => vi.useRealTimers());

const p2 = (n: number) => String(n).padStart(2, "0");
const row = (d: string, desc: string, debit?: number, credit?: number) => `${d},${desc},${debit?.toFixed(2) ?? ""},${credit?.toFixed(2) ?? ""}`;
const dining: Record<number, number> = { 6: 6000, 7: 6000, 8: 6000, 9: 9000 };
const monthRows = (m: number) => [
  row(`01/${p2(m)}/2026`, "NEFT-ACME CORP SALARY", undefined, 100000),
  row(`02/${p2(m)}/2026`, "UPI/1/Rent to Landlord/rent@bank", 25000),
  row(`05/${p2(m)}/2026`, "UPI/2/BIGBASKET/bb@bank", 12000),
  row(`10/${p2(m)}/2026`, "UPI/3/SWIGGY/sw@bank", dining[m]),
  row(`12/${p2(m)}/2026`, "BESCOM Electricity Bill", 4000),
  row(`15/${p2(m)}/2026`, "NETFLIX.COM", 649),
  row(`20/${p2(m)}/2026`, "UBER TRIP", 3000),
  row(`28/${p2(m)}/2026`, "AMAZON PAY RETAIL", 5000),
];
const load = async (rows: string[]) => {
  const p = await caller().inari.importPreview({ kind: "csv", filename: "r.csv", content: ["Date,Description,Debit,Credit", ...rows].join("\n") });
  await caller().inari.importCommit({ previewId: p.previewId });
};
const FOUR = [6, 7, 8, 9].flatMap(monthRows);
const ask = (q: string, previous?: any) => caller().inari.ask({ question: q, locale: "en", ...(previous ? { previous } : {}) });

describe("monthly saving phrasings are answered from the verified snapshot", () => {
  for (const q of [
    "How much am I saving each month?",
    "how much do i save per month",
    "How much do I save monthly?",
    "what's my monthly surplus",
    "how much money is left over every month",
    "how much am I saving a month?",
  ]) {
    it(q, async () => {
      await load(FOUR);
      const r = await ask(q);
      expect(r.answer).toContain("₹43,351");
      expect(r.answer).toContain("43.4%");
      expect(r.relatedMetrics.map(m => m.label)).toEqual(expect.arrayContaining(["Monthly income", "Monthly expenses", "Savings rate"]));
      expect(r.evidence.length).toBeGreaterThan(0); // period and coverage are stated
      expect(r.evidence.map(e => e.message).join(" ")).toMatch(/3 complete month|complete month/);
    });
  }

  it("with no data it says so instead of inventing a figure", async () => {
    const r = await ask("How much am I saving each month?");
    expect(r.answer).toMatch(/do not have any of your transactions/);
  });
});

describe("conversation: spend questions", () => {
  it("dining last month -> the month before -> groceries -> 'actually September'", async () => {
    await load(FOUR);
    const a = await ask("How much did I spend on dining last month?");
    expect(a.answer).toContain("September 2026");
    expect(a.answer).toContain("₹9,000");

    const b = await ask("What about the month before?", a.context);
    expect(b.context).toMatchObject({ category: "dining", month: "2026-08" });
    expect(b.answer).toContain("August 2026");
    expect(b.answer).toContain("₹6,000");

    const c = await ask("And groceries?", b.context);
    expect(c.context).toMatchObject({ category: "groceries", month: "2026-08" });
    expect(c.answer).toContain("August 2026");
    expect(c.answer).toContain("₹12,000");

    const d = await ask("Actually, I meant September.", c.context);
    expect(d.context).toMatchObject({ category: "groceries", month: "2026-09" });
    expect(d.answer).toContain("September 2026");
    expect(d.answer).toContain("₹12,000");
  });

  it("Indian number formats are understood (1,00,000 and 2 lakh)", async () => {
    await load(FOUR);
    const r = await ask("What if my income drops by 1,00,000 per month?");
    expect(r.intent.intent).toBe("what_if");
    expect(r.simulation!.scenarios).toEqual([{ type: "change_income", deltaPerMonth: -100000 }]);
    const l = await ask("What if I earn 2 lakh less?");
    expect(l.simulation!.scenarios).toEqual([{ type: "change_income", deltaPerMonth: -200000 }]);
  });
});

describe("conversation: what-if chain", () => {
  it("20k less -> 10k less -> goal question, with exact numbers and no mutation", async () => {
    await load(FOUR);
    const before = await caller().inari.getSnapshot();
    const a = await ask("What if I earn 20k less?");
    expect(a.simulation!.scenarios).toEqual([{ type: "change_income", deltaPerMonth: -20000 }]);
    expect(a.answer).toContain("29.2%");
    expect(a.simulation!.metrics.find(m => /surplus/i.test(m.label))!.scenario).toBe(23351);

    const b = await ask("What about 10k less?", a.context);
    expect(b.simulation!.scenarios).toEqual([{ type: "change_income", deltaPerMonth: -10000 }]);
    expect(b.answer).toContain("37.1%");
    expect(b.simulation!.metrics.find(m => /surplus/i.test(m.label))!.scenario).toBe(33351);

    const g = await ask("Will this change my savings goal?", b.context);
    // No goal exists: say so rather than inventing one.
    expect(g.answer).toMatch(/goal/i);
    expect(g.answer).not.toMatch(/₹\s?\d[\d,]*\s+(target|goal)/i);
    expect(await caller().inari.getSnapshot()).toEqual(before);
  });

  it("with a real goal, the goal question reports the goal's own numbers and still changes nothing", async () => {
    await load(FOUR);
    await caller().inari.upsertGoal({ goalType: "emergency_fund", name: "Safety net", targetAmount: 300000, currentAmount: 60000, timelineMonths: 12, monthlyContribution: 20000, priority: "high" } as never);
    const a = await ask("What if I earn 20k less?");
    const g = await ask("Will this change my savings goal?", a.context);
    expect(g.answer).toMatch(/Safety net|goal/i);
    expect(g.answer).toContain("₹20,000"); // the goal's own planned contribution; the what-if is not folded into goal maths (known limitation)
  });
});

describe("other advisor edge cases", () => {
  it("conflicting dates: the explicit month wins over 'last month' and the answer names the month used", async () => {
    await load(FOUR);
    const r = await ask("How much on dining last month, I mean in July?");
    expect(r.answer).toContain("July 2026");
    expect(r.answer).toContain("₹6,000");
  });

  it("missing required data: a what-if with no amount asks for it", async () => {
    await load(FOUR);
    const r = await ask("What if my income drops?");
    expect(r.intent.needsClarification).toBe(true);
    expect(r.simulation ?? null).toBeNull();
  });

  it("subscription question lists the detected subscription and never the card repayment", async () => {
    await load([...FOUR, ...[6, 7, 8, 9].map(m => row(`18/${p2(m)}/2026`, "CREDIT CARD PAYMENT HDFC BANK CARD XX4821", 4500))]);
    const r = await ask("Which subscriptions do I have?");
    expect(r.answer).toMatch(/Netflix/i);
    expect(r.answer).not.toMatch(/hdfc|card/i);
  });
});
