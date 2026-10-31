/** Regression tests for the three audited routing defects (N01 / N23 / SIP future value). Synthetic data only. */
import { beforeEach, describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";
import { FileLedgerRepository, setLedgerRepositoryForTests } from "./ledger";
import { _previewStoreForTests } from "./service";

const KEY = "anon:00000000-0000-4000-8000-0000000000d7";
const c = () =>
  appRouter.createCaller({
    user: { id: 5, openId: "x", email: null, name: "D", loginMethod: "l", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "http", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
    inariUserKey: KEY,
    inariIdentityKind: "anonymous_demo",
  } as TrpcContext);

const rows = ["Date,Description,Debit,Credit"];
for (const m of ["08", "09", "10"]) rows.push(`01/${m}/2026,NEFT ACME SALARY,,100000.00`, `10/${m}/2026,UPI/3/SWIGGY/sw@bank,6000.00,`, `20/${m}/2026,UPI/BIGBASKET GROCERIES/bb@bank,4000.00,`);

/** "Over 12 months that leaves ₹X versus ₹Y now" -> Y - X */
const leftoverGap = (a: string) => {
  const m = /leaves ₹([\d,]+) versus ₹([\d,]+) now/.exec(a)!;
  return Number(m[2].replace(/,/g, "")) - Number(m[1].replace(/,/g, ""));
};

beforeEach(async () => {
  setLedgerRepositoryForTests(new FileLedgerRepository());
  _previewStoreForTests.clear();
  const p = await c().inari.importPreview({ kind: "csv", filename: "s.csv", content: rows.join("\n") });
  await c().inari.importCommit({ previewId: p.previewId });
});

describe("first-person spend statements become a cash-entry preview, not a September total", () => {
  for (const q of ["I spent 2500 on groceries yesterday", "I spent two thousand five hundred on groceries yesterday", "I spent ₹2,500 on groceries yesterday"]) {
    it(q, async () => {
      const r = await c().inari.ask({ question: q, locale: "en" });
      expect(r.answer).toMatch(/2,500/);
      expect(r.answer).toMatch(/Nothing is added until you confirm/);
      const p = r.proposedActions?.[0] ?? (r as any).proposed?.[0];
      expect(p?.type).toBe("manual_entry");
      expect(await c().inari.listTransactions({ limit: 200 }).then(x => x.items.length)).toBe(9); // preview does not write
    });
  }

  it("a question about groceries is still answered from the ledger", async () => {
    const r = await c().inari.ask({ question: "How much did I spend on groceries in October?", locale: "en" });
    expect(r.answer).toMatch(/4,000/);
  });
});

describe("income-drop what-if is not an investment-advice refusal", () => {
  it("'I will earn 20k less next month, what then?' simulates a -20,000 income change", async () => {
    const r = await c().inari.ask({ question: "I will earn 20k less next month, what then?", locale: "en" });
    expect(r.guardrail.status).not.toBe("refused");
    expect(r.answer).not.toMatch(/can.t (?:help|give|recommend)|not allowed|cannot provide investment/i);
    expect(leftoverGap(r.answer)).toBe(240_000); // 20,000 a month x 12
  });

  it("genuine return projections are still refused", async () => {
    const r = await c().inari.ask({ question: "This fund will earn 15% for sure, guaranteed returns?", locale: "en" });
    expect(r.guardrail.status).toBe("refused");
  });
});

describe("SIP future-value questions", () => {
  for (const q of ["If I invest 5000 a month in a SIP for 10 years, what will it be worth?", "What will my SIP of 5000 a month grow to in 10 years?"]) {
    it(`explains the missing return assumption: ${q}`, async () => {
      const r = await c().inari.ask({ question: q, locale: "en" });
      expect(r.answer).toMatch(/expected rate of return/);
      expect(r.answer).not.toMatch(/no change|unchanged|₹0\b/i);
    });
  }

  it("a SIP cash-flow what-if still runs", async () => {
    const r = await c().inari.ask({ question: "What if I start a SIP of 5000 a month?", locale: "en" });
    expect(leftoverGap(r.answer)).toBe(60_000); // 5,000 a month x 12
  });
});
