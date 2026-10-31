/**
 * Recurring-payment detection. Fixtures are authored here (not taken from the generator), with hand-worked expectations.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";
import { FileLedgerRepository, setLedgerRepositoryForTests } from "./ledger";
import { _previewStoreForTests } from "./service";

const KEY = "anon:00000000-0000-4000-8000-0000000000c1";
const caller = (key = KEY) =>
  appRouter.createCaller({
    user: { id: 5, openId: "x", email: null, name: "D", loginMethod: "l", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "http", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
    inariUserKey: key,
    inariIdentityKind: "anonymous_demo",
  } as TrpcContext);
beforeEach(() => {
  setLedgerRepositoryForTests(new FileLedgerRepository());
  _previewStoreForTests.clear();
});

const p2 = (n: number) => String(n).padStart(2, "0");
const row = (d: string, desc: string, debit?: number, credit?: number) => `${d},${desc},${debit?.toFixed(2) ?? ""},${credit?.toFixed(2) ?? ""}`;
const csv = (rows: string[]) => ["Date,Description,Debit,Credit", ...rows].join("\n");
const load = async (rows: string[], key = KEY) => {
  const p = await caller(key).inari.importPreview({ kind: "csv", filename: "r.csv", content: csv(rows) });
  await caller(key).inari.importCommit({ previewId: p.previewId });
};
const months = [4, 5, 6, 7, 8, 9];

describe("recurring detection", () => {
  it("finds a steady monthly subscription with next due date, totals and evidence", async () => {
    await load([
      ...months.map(m => row(`05/${p2(m)}/2026`, "NETFLIX.COM", 649)),
      ...months.map(m => row(`01/${p2(m)}/2026`, "NEFT ACME SALARY", undefined, 80000)),
    ]);
    const r = await caller().inari.listSubscriptions();
    expect(r.implementation).toBe("implemented");
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({ cadence: "monthly", status: "possible", typicalAmount: 649, monthlyEquivalent: 649, annualCost: 7788, occurrences: 6, lastChargedOn: "2026-09-05", nextExpectedOn: "2026-10-05", priceChange: null });
    expect(r.items[0].merchant.toLowerCase()).toContain("netflix");
    expect(r.items[0].confidence).toBeGreaterThanOrEqual(0.9);
    expect(r.items[0].evidenceTransactionIds).toHaveLength(6);
    expect(r.monthlyTotal).toBe(649);
    expect(r.annualTotal).toBe(7788);
  });

  it("does not call rent, salary, one-offs, or irregular spending subscriptions", async () => {
    await load([
      ...months.map(m => row(`02/${p2(m)}/2026`, "UPI/1/Rent to Landlord/rent@bank", 25000)),
      ...months.map(m => row(`01/${p2(m)}/2026`, "NEFT ACME SALARY", undefined, 80000)),
      row("03/07/2026", "UPI/9/SWIGGY/sw@bank", 400), row("19/07/2026", "UPI/9/SWIGGY/sw@bank", 650), row("11/08/2026", "UPI/9/SWIGGY/sw@bank", 120), row("02/09/2026", "UPI/9/SWIGGY/sw@bank", 900),
      row("14/08/2026", "AMAZON PAY RETAIL", 3000),
    ]);
    expect((await caller().inari.listSubscriptions()).items).toEqual([]);
  });

  it("steady monthly grocery, transport, shopping and utility payments are not subscriptions", async () => {
    await load(months.flatMap(m => [
      row(`05/${p2(m)}/2026`, "UPI/2/BIGBASKET/bb@bank", 12000), row(`12/${p2(m)}/2026`, "BESCOM Electricity Bill", 4000),
      row(`20/${p2(m)}/2026`, "UBER TRIP", 3000), row(`28/${p2(m)}/2026`, "AMAZON PAY RETAIL", 5000),
    ]));
    expect((await caller().inari.listSubscriptions()).items).toEqual([]);
  });

  it("variable monthly bills (electricity) are not subscriptions", async () => {
    await load(months.map((m, i) => row(`12/${p2(m)}/2026`, "BESCOM Electricity Bill", 1500 + i * 700)));
    expect((await caller().inari.listSubscriptions()).items).toEqual([]);
  });

  it("detects weekly and yearly cadences and computes monthly equivalents", async () => {
    await load([
      row("05/01/2026", "GYM FIT CLUB", 3600), row("05/01/2027", "GYM FIT CLUB", 3600),
      ...[1, 8, 15, 22, 29].map(d => row(`${p2(d)}/09/2026`, "PRESS DIGEST SUBSCRIPTION", 100)),
    ]);
    const items = (await caller().inari.listSubscriptions()).items;
    const weekly = items.find(i => i.cadence === "weekly")!;
    expect(weekly).toMatchObject({ typicalAmount: 100, monthlyEquivalent: 433.33, annualCost: 5200, nextExpectedOn: "2026-10-06" });
    const yearly = items.find(i => i.cadence === "yearly")!;
    expect(yearly).toMatchObject({ typicalAmount: 3600, monthlyEquivalent: 300, annualCost: 3600 });
  });

  it("flags a price increase and reports the old and new amount", async () => {
    await load([...[4, 5, 6, 7, 8].map(m => row(`10/${p2(m)}/2026`, "SPOTIFY INDIA", 119)), row("10/09/2026", "SPOTIFY INDIA", 139)]);
    const s = (await caller().inari.listSubscriptions()).items[0];
    expect(s.flags).toContain("price_increase");
    expect(s.priceChange).toEqual({ from: 119, to: 139 });
    expect(s.typicalAmount).toBe(139);
  });

  it("flags a stopped subscription as inactive and leaves it out of totals", async () => {
    await load([...[1, 2, 3, 4].map(m => row(`05/${p2(m)}/2026`, "HOTSTAR", 299)), row("20/09/2026", "UPI/9/SWIGGY/sw@bank", 200)]);
    const r = await caller().inari.listSubscriptions();
    expect(r.items[0].flags).toContain("inactive");
    expect(r.monthlyTotal).toBe(0);
  });

  it("flags a double charge inside one cycle without counting it as an extra occurrence", async () => {
    await load([...[6, 7, 8].map(m => row(`05/${p2(m)}/2026`, "NETFLIX.COM", 649)), row("05/09/2026", "NETFLIX.COM", 649), row("06/09/2026", "NETFLIX.COM", 649)]);
    const s = (await caller().inari.listSubscriptions()).items[0];
    expect(s.flags).toContain("possible_duplicate");
    expect(s.occurrences).toBe(4);
  });

  it("works on SMS-imported rows too", async () => {
    const sms = [7, 8, 9].map(m => `Rs.649.00 debited from A/c XX1234 on 05-0${m}-26 to netflix@icici (UPI Ref No 70000000000${m})`).join("\n\n");
    const p = await caller().inari.importPreview({ kind: "sms", text: sms });
    await caller().inari.importCommit({ previewId: p.previewId });
    expect((await caller().inari.listSubscriptions()).items[0]).toMatchObject({ cadence: "monthly", typicalAmount: 649 });
  });

  it("confirm and dismiss persist, change status and totals, survive setBalances, and are per user", async () => {
    await load(months.map(m => row(`05/${p2(m)}/2026`, "NETFLIX.COM", 649)));
    const id = (await caller().inari.listSubscriptions()).items[0].id;
    expect(await caller().inari.confirmSubscription({ subscriptionId: id, decision: "confirm" })).toMatchObject({ implementation: "implemented", success: true });
    expect((await caller().inari.listSubscriptions()).items[0].status).toBe("confirmed");
    await caller().inari.setBalances({ emergencyFund: 1000, investments: null, creditCardDebt: null });
    expect((await caller().inari.listSubscriptions()).items[0].status).toBe("confirmed");
    await caller().inari.confirmSubscription({ subscriptionId: id, decision: "dismiss" });
    const after = await caller().inari.listSubscriptions();
    expect(after.items[0].status).toBe("dismissed");
    expect(after.monthlyTotal).toBe(0);
    const other = "anon:00000000-0000-4000-8000-0000000000c2";
    expect((await caller(other).inari.listSubscriptions()).items).toEqual([]);
    await expect(caller(other).inari.confirmSubscription({ subscriptionId: id, decision: "confirm" })).rejects.toThrow(/not found/);
  });

  it("is deterministic and never changes the ledger", async () => {
    await load(months.map(m => row(`05/${p2(m)}/2026`, "NETFLIX.COM", 649)));
    const before = (await caller().inari.listTransactions({ limit: 50 })).items;
    const a = await caller().inari.listSubscriptions();
    const b = await caller().inari.listSubscriptions();
    expect(b).toEqual(a);
    expect((await caller().inari.listTransactions({ limit: 50 })).items).toEqual(before);
  });
});

describe("cancel_subscriptions scenario uses detected subscriptions", () => {
  const base = [
    ...months.map(m => row(`01/${p2(m)}/2026`, "NEFT ACME SALARY", undefined, 80000)),
    ...months.map(m => row(`02/${p2(m)}/2026`, "UPI/1/Rent to Landlord/rent@bank", 20000)),
    ...months.map(m => row(`05/${p2(m)}/2026`, "NETFLIX.COM", 649)),
    ...months.map(m => row(`09/${p2(m)}/2026`, "SPOTIFY INDIA", 119)),
    row("28/09/2026", "AMAZON PAY RETAIL", 1000), row("28/04/2026", "AMAZON PAY RETAIL", 1000),
  ];
  it("cancelling Netflix lowers expenses by exactly its monthly cost, once, with the ledger untouched", async () => {
    await load(base);
    const subs = (await caller().inari.listSubscriptions()).items;
    const netflix = subs.find(s => s.merchant.toLowerCase().includes("netflix"))!;
    const before = (await caller().inari.listTransactions({ limit: 100 })).items;
    const sim = await caller().inari.simulate({ scenarios: [{ type: "cancel_subscriptions", subscriptionIds: [netflix.id, netflix.id] }] });
    const e = sim.metrics.find(m => m.label === "Monthly expenses")!;
    expect(e.delta).toBe(-649);
    expect(sim.ledgerUnchanged).toBe(true);
    expect((await caller().inari.listTransactions({ limit: 100 })).items).toEqual(before);
  });

  it("rejects unknown ids, and warns when the subscription is dismissed", async () => {
    await load(base);
    await expect(caller().inari.simulate({ scenarios: [{ type: "cancel_subscriptions", subscriptionIds: ["sub_nope"] }] })).rejects.toThrow(/not found/);
    const spotify = (await caller().inari.listSubscriptions()).items.find(s => s.merchant.toLowerCase().includes("spotify"))!;
    await caller().inari.confirmSubscription({ subscriptionId: spotify.id, decision: "dismiss" });
    const sim = await caller().inari.simulate({ scenarios: [{ type: "cancel_subscriptions", subscriptionIds: [spotify.id] }] });
    expect(sim.metrics.find(m => m.label === "Monthly expenses")!.delta).toBe(0);
    expect(sim.warnings.join(" ")).toMatch(/dismissed/);
  });
});
