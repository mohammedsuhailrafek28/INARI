/**
 * Advisor routing for refunds, reimbursements, EMI checks and manual entries.
 * Fake date: 2026-10-31. All data is synthetic.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";
import { FileLedgerRepository, setLedgerRepositoryForTests } from "./ledger";
import { _previewStoreForTests } from "./service";
import { _manualPreviewsForTests } from "./manual";

const A = "anon:00000000-0000-4000-8000-0000000000e1";
const as = (key: string) =>
  appRouter.createCaller({
    user: { id: 9, openId: "x", email: null, name: "D", loginMethod: "l", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "http", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
    inariUserKey: key,
    inariIdentityKind: "anonymous_demo",
  } as TrpcContext);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-31T10:00:00Z"));
  setLedgerRepositoryForTests(new FileLedgerRepository());
  _previewStoreForTests.clear();
  _manualPreviewsForTests.clear();
});
afterEach(() => vi.useRealTimers());

const months = [7, 8, 9].flatMap(m => [`01/0${m}/2026,NEFT ACME SALARY,,100000.00`, `10/0${m}/2026,UPI/3/SWIGGY/sw@bank,6000.00,`]);
const OCT = ["02/10/2026,AMAZON PAY HEADPHONES ORDER,4500.00,", "05/10/2026,DINNER AT RESTAURANT,3000.00,", "08/10/2026,AMAZON REFUND ORDER 4455,,4500.00"];
const csv = ["Date,Description,Debit,Credit", ...months, ...OCT].join("\n");
async function seed() {
  const p = await as(A).inari.importPreview({ kind: "csv", filename: "s.csv", content: csv });
  await as(A).inari.importCommit({ previewId: p.previewId });
}
const ask = (question: string, previous?: unknown) => as(A).inari.ask({ question, locale: "en", ...(previous ? { previous } : {}) } as never);

describe("advisor: novelty intents", () => {
  it("answers 'Where is my refund?' deterministically with no claims yet", async () => {
    await seed();
    const r = await ask("Where is my refund?");
    expect(r.engine.llmUsed).toBe(false);
    expect(r.answer).toMatch(/not tracking any refunds/i);
  });

  it("proposes a refund claim for an exact-amount payment, requiring confirmation", async () => {
    await seed();
    const r = await ask("My ₹4,500 refund should arrive in 5 days");
    const a = r.proposedActions.find(x => x.type === "create_claim")!;
    expect(a.requiresConfirmation).toBe(true);
    expect(a.procedure).toBe("inari.createClaim");
    expect(a.inputComplete).toBe(true);
    expect(JSON.stringify(a.input)).toContain("transactionId");
    expect(r.answer).toMatch(/not counted as money received/i);
  });

  it("lists an open refund claim and offers a match for confirmation, not auto-applied", async () => {
    await seed();
    const tx = (await as(A).inari.listTransactions({ limit: 200 })).items;
    const hp = tx.find(t => /HEADPHONES/.test(t.narration))!;
    const { id } = await as(A).inari.createClaim({ kind: "refund", transactionId: hp.id, expectedAmount: 4500, counterparty: "Amazon" });
    const r = await ask("Where is my refund?");
    const m = r.proposedActions.find(x => x.type === "confirm_claim_match")!;
    expect(m.requiresConfirmation).toBe(true);
    expect((m.input as { claimId: string }).claimId).toBe(id);
    expect((await as(A).inari.listClaims({ kind: "refund" })).items[0].status).not.toBe("received");
  });

  it("handles 'My friends owe me ₹2,000' by asking which payment when ambiguous", async () => {
    await seed();
    const r = await ask("My friends owe me ₹2,000.");
    const a = r.proposedActions.find(x => x.type === "create_claim")!;
    expect(a.requiresConfirmation).toBe(true);
    expect(a.inputComplete).toBe(false);
    expect(a.missingFields).toContain("transactionId");
  });

  it("asks for missing EMI terms and never assumes a rate or fee", async () => {
    const r = await ask("Is this EMI actually cheaper?");
    expect(r.answer).toMatch(/cash price/i);
    expect(r.answer).toMatch(/not assume|will not assume/i);
    expect(r.proposedActions[0].inputComplete).toBe(false);
    expect(r.engine.llmUsed).toBe(false);
  });

  it("computes an EMI comparison from the terms and carries multi-turn context", async () => {
    await seed();
    const r1 = await ask("Is this EMI actually cheaper? The phone is ₹40,000 upfront");
    const r2 = await ask("₹6,700 a month for 6 months with processing fee ₹500", r1.context);
    expect(r2.answer).toMatch(/more than paying upfront/i);
    expect(r2.engine.llmUsed).toBe(false);
    const txs = (await as(A).inari.listTransactions({ limit: 200 })).items.length;
    expect(txs).toBe(months.length + OCT.length);
  });

  it("previews a spoken cash spend without writing, proposing a confirmed commit", async () => {
    await seed();
    const before = (await as(A).inari.listTransactions({ limit: 200 })).items.length;
    const r = await ask("I spent ₹350 cash yesterday.");
    expect(r.answer).toMatch(/Nothing is added until you confirm/i);
    expect(r.answer).toContain("2026-10-30");
    const a = r.proposedActions.find(x => x.type === "manual_entry")!;
    expect(a.requiresConfirmation).toBe(true);
    expect(a.missingFields).toContain("idempotencyKey");
    expect((await as(A).inari.listTransactions({ limit: 200 })).items.length).toBe(before);
  });

  it("asks for the amount when it is missing", async () => {
    const r = await ask("I spent some cash yesterday on lunch");
    expect(r.proposedActions.find(x => x.type === "manual_entry")).toBeUndefined();
  });
});

describe("advisor: self-correction", () => {
  it("uses the corrected amount when the user changes their mind mid-sentence", async () => {
    const r = await ask("I spent ₹350 cash yesterday, no sorry ₹530");
    const e = (r.proposedActions.find(x => x.type === "manual_entry")!);
    expect(e).toBeDefined();
    expect(r.answer).toContain("530");
    expect(r.answer).not.toContain("350");
  });
});

describe("durability in json store mode", () => {
  it("claims, settlements and manual entries survive a restart (new repository, same file)", async () => {
    const fs = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "inari-dur-"));
    const file = path.join(dir, "ledger.json");
    try {
      setLedgerRepositoryForTests(new FileLedgerRepository({ filePath: file }));
      await seed();
      const tx = (await as(A).inari.listTransactions({ limit: 200 })).items;
      const hp = tx.find(t => /HEADPHONES/.test(t.narration))!;
      const credit = tx.find(t => /AMAZON REFUND/.test(t.narration))!;
      const { id } = await as(A).inari.createClaim({ kind: "refund", transactionId: hp.id, expectedAmount: 4500 });
      await as(A).inari.confirmClaimMatch({ claimId: id, creditTransactionId: credit.id } as never);
      const p = await as(A).inari.manualEntryPreview({ text: "I spent 350 cash yesterday on lunch" } as never);
      await as(A).inari.manualEntryCommit({ previewId: p.previewId, idempotencyKey: "durable-key-1" } as never);
      const before = (await as(A).inari.listTransactions({ limit: 200 })).items.length;

      setLedgerRepositoryForTests(new FileLedgerRepository({ filePath: file }));
      const claims = (await as(A).inari.listClaims({ kind: "refund" })).items;
      expect(claims).toHaveLength(1);
      expect(claims[0].status).toBe("received");
      expect((await as(A).inari.listTransactions({ limit: 200 })).items.length).toBe(before);
      expect((await as(A).inari.dataCoverage()).gaps.some(g => g.kind === "no_manual_entries")).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
