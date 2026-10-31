/**
 * Goals backend: persistence, isolation, integer-paise arithmetic, deterministic change_goal_contribution
 * simulations that never write to goals, report/advisor integration, and an audit of advisor proposed actions.
 *
 * Fixture (same as the advisor tests): Jun-Sep 2026 salary 100000; average monthly expenses 56649 over Jul-Sep;
 * surplus 43351. "Today" is 2026-10-31.
 * Hand results for goal "Laptop" (target 90000, saved 30000 as entered, 5000 a month):
 *   remaining 60000 / 5000 = 12 months -> last day of Oct 2027 = 2027-10-31, progress 33.3%
 *   at 10000 a month: 6 months -> 2027-04-30, saved 6 months, free cash 43351 -> 38351
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";
import { FileLedgerRepository, setLedgerRepositoryForTests } from "./ledger";
import { _previewStoreForTests } from "./service";
import { completionDate, monthsToGoal } from "./goals";

const KEY = "anon:00000000-0000-4000-8000-0000000000a1";
const OTHER = "anon:00000000-0000-4000-8000-0000000000a2";
const caller = (key = KEY) =>
  appRouter.createCaller({
    user: { id: 5, openId: "x", email: null, name: "D", loginMethod: "l", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "http", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
    inariUserKey: key,
    inariIdentityKind: "anonymous_demo",
  } as TrpcContext);

const tmp = mkdtempSync(path.join(tmpdir(), "inari-goals-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-31T10:00:00Z"));
  setLedgerRepositoryForTests(new FileLedgerRepository());
  _previewStoreForTests.clear();
});
afterEach(() => vi.useRealTimers());

const p2 = (n: number) => String(n).padStart(2, "0");
const row = (d: string, desc: string, debit?: number, credit?: number) => `${d},${desc},${debit?.toFixed(2) ?? ""},${credit?.toFixed(2) ?? ""}`;
const load = async (rows: string[], key = KEY) => {
  const p = await caller(key).inari.importPreview({ kind: "csv", filename: "r.csv", content: ["Date,Description,Debit,Credit", ...rows].join("\n") });
  await caller(key).inari.importCommit({ previewId: p.previewId });
};
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
const FOUR = [6, 7, 8, 9].flatMap(monthRows);
const LAPTOP = { goalType: "gadget" as const, name: "Laptop", targetAmount: 90000, currentAmount: 30000, timelineMonths: 12, priority: "medium" as const, monthlyContribution: 5000 };
const addLaptop = async (key = KEY) => (await caller(key).inari.upsertGoal(LAPTOP)).id;
const metric = (r: { metrics: Array<{ label: string; baseline: number | null; scenario: number | null; delta: number | null }> }, label: string) => r.metrics.find(m => m.label === label)!;

describe("goals: CRUD, persistence, isolation", () => {
  it("creates, lists with derived fields, updates by id, and deletes", async () => {
    expect((await caller().inari.getGoals()).items).toEqual([]);
    const id = await addLaptop();
    const list = await caller().inari.getGoals();
    expect(list.implementation).toBe("implemented");
    expect(list.items).toHaveLength(1);
    expect(list.items[0]).toMatchObject({
      id, name: "Laptop", targetAmount: 90000, currentAmount: 30000, remainingAmount: 60000, progressPercent: 33.3,
      monthlyContribution: 5000, requiredMonthly: 5000, status: "on_track", projectedCompletion: "2027-10-31",
    });

    await caller().inari.upsertGoal({ ...LAPTOP, id, currentAmount: 45000, monthlyContribution: 3000 });
    const updated = (await caller().inari.getGoals()).items;
    expect(updated).toHaveLength(1);
    expect(updated[0]).toMatchObject({ id, currentAmount: 45000, remainingAmount: 45000, status: "behind", requiredMonthly: 3750, projectedCompletion: "2028-01-31" });

    await caller().inari.deleteGoal({ id });
    expect((await caller().inari.getGoals()).items).toEqual([]);
  });

  it("the balance is exactly what the user entered, never inferred from transactions", async () => {
    await load(FOUR);
    const id = await caller().inari.upsertGoal({ goalType: "emergency_fund", targetAmount: 200000, currentAmount: 0, priority: "high" }).then(r => r.id);
    const g = (await caller().inari.getGoals()).items.find(x => x.id === id)!;
    expect(g.currentAmount).toBe(0);
    expect(g.progressPercent).toBe(0);
    expect(g.status).toBe("no_contribution");
    expect(g.projectedCompletion).toBeNull();
    expect(g.name).toBe("Emergency fund");
  });

  it("is scoped to the owner: other users cannot read, update or delete it", async () => {
    const id = await addLaptop();
    expect((await caller(OTHER).inari.getGoals()).items).toEqual([]);
    await expect(caller(OTHER).inari.upsertGoal({ ...LAPTOP, id })).rejects.toThrow(/not found/i);
    await expect(caller(OTHER).inari.deleteGoal({ id })).rejects.toThrow(/not found/i);
    expect((await caller().inari.getGoals()).items[0]).toMatchObject({ id, currentAmount: 30000 });
    await expect(caller().inari.deleteGoal({ id: "goal_nope" })).rejects.toThrow(/not found/i);
  });

  it("persists across a new repository instance reading the same file, per user", async () => {
    const file = path.join(tmp, "goals", "ledger.json");
    setLedgerRepositoryForTests(new FileLedgerRepository({ filePath: file }));
    const id = await addLaptop();
    setLedgerRepositoryForTests(new FileLedgerRepository({ filePath: file }));
    expect((await caller().inari.getGoals()).items.map(g => g.id)).toEqual([id]);
    expect((await caller(OTHER).inari.getGoals()).items).toEqual([]);
  });

  it("survives setBalances and is removed by clearMyData", async () => {
    const id = await addLaptop();
    await caller().inari.setBalances({ emergencyFund: 10000, investments: null, creditCardDebt: null });
    expect((await caller().inari.getGoals()).items.map(g => g.id)).toEqual([id]);
    await caller().inari.clearMyData({ confirm: "DELETE" });
    expect((await caller().inari.getGoals()).items).toEqual([]);
  });

  it("validates input: positive target, sane amounts, cleaned names, a cap on how many goals", async () => {
    const bad = (over: object) => caller().inari.upsertGoal({ ...LAPTOP, ...over } as any);
    await expect(bad({ targetAmount: 0 })).rejects.toThrow();
    await expect(bad({ targetAmount: -5 })).rejects.toThrow();
    await expect(bad({ currentAmount: -1 })).rejects.toThrow();
    await expect(bad({ monthlyContribution: -1 })).rejects.toThrow();
    await expect(bad({ targetAmount: 5e9 })).rejects.toThrow(/not valid/);
    await expect(bad({ timelineMonths: 0 })).rejects.toThrow();
    const id = (await bad({ name: "  Trip\u0007 to\n  Goa  " })).id;
    expect((await caller().inari.getGoals()).items.find(g => g.id === id)!.name).toBe("Trip to Goa");
    for (let i = 1; i < 20; i++) await caller().inari.upsertGoal(LAPTOP);
    await expect(caller().inari.upsertGoal(LAPTOP)).rejects.toThrow(/up to 20/);
  });
});

describe("goals: arithmetic", () => {
  it("works in paise, so decimal amounts do not drift a month", () => {
    // remaining 9999.90 / 333.33 = exactly 30 months; naive floating point gives 30.000000000000004 -> 31
    expect(monthsToGoal(10000.1, 0.2, 333.33)).toBe(30);
    expect(monthsToGoal(100, 100, 0)).toBe(0);
    expect(monthsToGoal(100, 150, null)).toBe(0);
    expect(monthsToGoal(100, 0, null)).toBeNull();
    expect(monthsToGoal(100, 0, 0)).toBeNull();
    expect(monthsToGoal(100, 0.01, 0.01)).toBe(9999);
  });

  it("completion dates are month ends and handle year boundaries and leap years", () => {
    const now = new Date("2026-10-31T10:00:00Z");
    expect(completionDate(1, now)).toBe("2026-11-30");
    expect(completionDate(3, now)).toBe("2027-01-31");
    expect(completionDate(4, now)).toBe("2027-02-28");
    expect(completionDate(16, now)).toBe("2028-02-29");
    expect(completionDate(0, now)).toBe("2026-10-31");
    expect(completionDate(null, now)).toBeNull();
  });

  it("a goal already at its target is completed and projects today", async () => {
    await caller().inari.upsertGoal({ ...LAPTOP, currentAmount: 90000 });
    expect((await caller().inari.getGoals()).items[0]).toMatchObject({ status: "completed", progressPercent: 100, remainingAmount: 0, projectedCompletion: "2026-10-31" });
  });

  it("overview compares contributions with the verified surplus", async () => {
    await addLaptop();
    const before = await caller().inari.getGoals();
    expect(before.summary).toEqual({ totalMonthlyContributions: 5000, monthlySurplus: null, withinSurplus: null });
    expect(before.warnings!.join(" ")).toMatch(/cannot be checked/);
    await load(FOUR);
    const ok = await caller().inari.getGoals();
    expect(ok.summary).toEqual({ totalMonthlyContributions: 5000, monthlySurplus: 43351, withinSurplus: true });
    expect(ok.warnings).toEqual([]);
    await caller().inari.upsertGoal({ ...LAPTOP, goalType: "car", name: "Car", monthlyContribution: 40000 });
    const over = await caller().inari.getGoals();
    expect(over.summary).toEqual({ totalMonthlyContributions: 45000, monthlySurplus: 43351, withinSurplus: false });
    expect(over.warnings!.join(" ")).toMatch(/more than your monthly surplus/);
  });
});

describe("goals: change_goal_contribution simulation", () => {
  it("computes the new completion date and free cash exactly, and never changes the stored goal", async () => {
    await load(FOUR);
    const id = await addLaptop();
    const before = JSON.stringify((await caller().inari.getGoals()).items);
    const sim = await caller().inari.simulate({ scenarios: [{ type: "change_goal_contribution", goalId: id, newMonthly: 10000 }] });
    expect(sim.status).toBe("ok");
    expect(sim.goals).toEqual([{ goalId: id, goalName: "Laptop", baselineCompletion: "2027-10-31", scenarioCompletion: "2027-04-30", monthsSaved: 6 }]);
    expect(metric(sim, "Free cash after SIP, debt and goal contributions")).toMatchObject({ baseline: 43351, scenario: 38351, delta: -5000 });
    expect(metric(sim, "Monthly expenses")).toMatchObject({ baseline: 56649, scenario: 56649 });
    expect(metric(sim, "Savings rate").delta).toBe(0);
    expect(sim.ledgerUnchanged).toBe(true);
    expect(sim.assumptions.join(" ")).toMatch(/not inferred from transactions/);
    expect(JSON.stringify((await caller().inari.getGoals()).items)).toBe(before);
    // running it again gives the identical result
    expect(await caller().inari.simulate({ scenarios: [{ type: "change_goal_contribution", goalId: id, newMonthly: 10000 }] })).toEqual(sim);
  });

  it("lowering or stopping a contribution moves the date out or removes it, and frees cash", async () => {
    await load(FOUR);
    const id = await addLaptop();
    const half = await caller().inari.simulate({ scenarios: [{ type: "change_goal_contribution", goalId: id, newMonthly: 2500 }] });
    expect(half.goals[0]).toMatchObject({ scenarioCompletion: "2028-10-31", monthsSaved: -12 });
    expect(metric(half, "Free cash after SIP, debt and goal contributions")).toMatchObject({ scenario: 45851, delta: 2500 });
    const stop = await caller().inari.simulate({ scenarios: [{ type: "change_goal_contribution", goalId: id, newMonthly: 0 }] });
    expect(stop.goals[0]).toMatchObject({ scenarioCompletion: null, monthsSaved: null });
  });

  it("combines with other scenarios without double-applying and warns when over the surplus", async () => {
    await load(FOUR);
    const id = await addLaptop();
    const both = await caller().inari.simulate({ scenarios: [{ type: "reduce_category", category: "dining", percent: 30 }, { type: "change_goal_contribution", goalId: id, newMonthly: 10000 }] });
    // surplus 43351 + 2100 (dining cut) = 45451; minus +5000 goal change = 40451
    expect(metric(both, "Free cash after SIP, debt and goal contributions")).toMatchObject({ baseline: 43351, scenario: 40451 });
    const repeated = await caller().inari.simulate({ scenarios: [{ type: "change_goal_contribution", goalId: id, newMonthly: 10000 }, { type: "change_goal_contribution", goalId: id, newMonthly: 10000 }] });
    expect(metric(repeated, "Free cash after SIP, debt and goal contributions").scenario).toBe(38351);
    const huge = await caller().inari.simulate({ scenarios: [{ type: "change_goal_contribution", goalId: id, newMonthly: 60000 }] });
    expect(huge.warnings.join(" ")).toMatch(/goal contributions are larger than your monthly surplus/);
  });

  it("rejects unknown goals and goals owned by someone else; without data it says so", async () => {
    await load(FOUR);
    const id = await addLaptop();
    await expect(caller().inari.simulate({ scenarios: [{ type: "change_goal_contribution", goalId: "goal_nope", newMonthly: 1 }] })).rejects.toThrow(/goal was not found/i);
    await load(FOUR, OTHER);
    await expect(caller(OTHER).inari.simulate({ scenarios: [{ type: "change_goal_contribution", goalId: id, newMonthly: 1 }] })).rejects.toThrow(/goal was not found/i);
    const empty = await caller("anon:00000000-0000-4000-8000-0000000000a3").inari.simulate({ scenarios: [{ type: "change_goal_contribution", goalId: id, newMonthly: 1 }] });
    expect(empty.status).toBe("insufficient_data");
    expect(empty.goals).toEqual([]);
  });

  it("with goals but no goal scenario, baseline and scenario dates match", async () => {
    await load(FOUR);
    await addLaptop();
    const sim = await caller().inari.simulate({ scenarios: [{ type: "reduce_category", category: "dining", percent: 30 }] });
    expect(sim.goals[0]).toMatchObject({ baselineCompletion: "2027-10-31", scenarioCompletion: "2027-10-31", monthsSaved: 0 });
  });
});

describe("goals: monthly report and advisor", () => {
  it("the report lists user goals and only reports goals as unknown when there are none", async () => {
    await load(FOUR);
    const none = await caller().inari.monthlyReport({ month: "2026-09" });
    expect(none.unknowns).toContain("goals");
    expect(none.goals ?? []).toEqual([]);
    const id = await addLaptop();
    const r = await caller().inari.monthlyReport({ month: "2026-09" });
    expect(r.unknowns).not.toContain("goals");
    expect(r.goals).toEqual([{ id, name: "Laptop", progressPercent: 33.3, status: "on_track", monthlyContribution: 5000, projectedCompletion: "2027-10-31" }]);
    expect(r.totals).toEqual(none.totals);
  });

  it("the advisor reports goal progress from what the user entered, passes the guardrail, and never invents goals", async () => {
    await load(FOUR);
    const empty = await caller().inari.ask({ question: "how are my goals going", locale: "en" });
    expect(empty.answer).toMatch(/not added any savings goals/);
    await addLaptop();
    const a = await caller().inari.ask({ question: "how are my goals going", locale: "en" });
    expect(a.guardrail.status).toBe("passed");
    expect(a.answer).toContain("Laptop: ₹30,000 of ₹90,000 (33.3%)");
    expect(a.answer).toContain("2027-10-31");
    expect(a.relatedMetrics).toEqual([{ label: "Monthly goal contributions", value: "₹5,000" }]);
    expect(a.engine).toMatchObject({ kind: "deterministic", llmUsed: false });
    expect(a.limitations!.join(" ")).toMatch(/never worked out from your transactions/);
  });

  it("works without transactions, and only shows the caller's goals", async () => {
    await addLaptop();
    const a = await caller().inari.ask({ question: "what are my savings goals", locale: "en" });
    expect(a.answer).toContain("Laptop: ₹30,000 of ₹90,000");
    expect(a.limitations!.join(" ")).toMatch(/complete month/);
    const b = await caller(OTHER).inari.ask({ question: "how are my goals", locale: "en" });
    expect(b.answer).not.toContain("Laptop");
  });
});

describe("advisor proposed actions: only advertise what really works", () => {
  it("every complete proposal executes for its owner and fails for anyone else; incomplete ones say what is missing", async () => {
    await load([...FOUR, row("10/09/2026", "UPI/3/SWIGGY/sw@bank", 9000)]);
    const proposals = [
      ...(await caller().inari.ask({ question: "recategorize uber as travel", locale: "en" })).proposedActions!,
      ...(await caller().inari.ask({ question: "should I cancel netflix", locale: "en" })).proposedActions!,
      ...(await caller().inari.ask({ question: "how much emergency fund do I have", locale: "en" })).proposedActions!,
      ...(await caller().inari.ask({ question: "are there any duplicate transactions", locale: "en" })).proposedActions!,
      ...(await caller("anon:00000000-0000-4000-8000-0000000000a4").inari.ask({ question: "how much did I spend on dining", locale: "en" })).proposedActions!,
    ];
    expect(proposals.length).toBeGreaterThanOrEqual(4);
    const names = new Set(proposals.map(p => p.type));
    expect(names).toEqual(expect.objectContaining(new Set(["correct_category", "confirm_subscription", "set_balances", "import_data"])));
    for (const a of proposals) {
      expect(a.requiresConfirmation).toBe(true);
      expect(typeof (caller().inari as any)[a.procedure.replace("inari.", "")]).toBe("function");
      if (a.inputComplete === false) {
        expect(a.missingFields!.length).toBeGreaterThan(0);
        continue;
      }
      expect(a.inputComplete).toBe(true);
      // another user cannot act on ids that belong to this user
      await expect((caller(OTHER).inari as any)[a.procedure.replace("inari.", "")](a.input)).rejects.toThrow();
      // the owner can
      await expect((caller().inari as any)[a.procedure.replace("inari.", "")](a.input)).resolves.toBeTruthy();
    }
  });

  it("incomplete proposals are labelled, not disguised as ready inputs", async () => {
    await load(FOUR);
    const bal = (await caller().inari.ask({ question: "how much emergency fund do I have", locale: "en" })).proposedActions!;
    expect(bal).toEqual([expect.objectContaining({ type: "set_balances", inputComplete: false, missingFields: expect.arrayContaining(["emergency fund"]) })]);
    const none = (await caller("anon:00000000-0000-4000-8000-0000000000a5").inari.ask({ question: "how much did I spend", locale: "en" })).proposedActions!;
    expect(none).toEqual([expect.objectContaining({ type: "import_data", inputComplete: false })]);
  });
});
