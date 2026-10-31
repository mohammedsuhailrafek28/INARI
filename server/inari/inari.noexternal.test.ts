/**
 * Imported statements must never be sent to an external model. The legacy WealthVerse advisor routes may call an
 * LLM when a key is configured, but not once the caller has imported data.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invokeLLM = vi.hoisted(() => vi.fn(async () => ({ choices: [{ message: { content: "{}" } }] })));
vi.mock("../_core/llm", () => ({ invokeLLM }));

import { appRouter } from "../routers";
import { ENV } from "../_core/env";
import type { TrpcContext } from "../_core/context";
import { FileLedgerRepository, setLedgerRepositoryForTests } from "./ledger";
import { _previewStoreForTests } from "./service";

const caller = (key: string) =>
  appRouter.createCaller({
    user: { id: 9, openId: "x", email: null, name: "D", loginMethod: "l", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "http", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
    inariUserKey: key,
    inariIdentityKind: "anonymous_demo",
  } as TrpcContext);

const original = ENV.forgeApiKey;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-31T10:00:00Z"));
  setLedgerRepositoryForTests(new FileLedgerRepository());
  _previewStoreForTests.clear();
  invokeLLM.mockClear();
  (ENV as { forgeApiKey: string }).forgeApiKey = "test-key-not-real";
});
afterEach(() => {
  (ENV as { forgeApiKey: string }).forgeApiKey = original;
  vi.useRealTimers();
});

describe("no external LLM for imported data", () => {
  it("legacy advisor.ask does not call the model after an import, and INARI ask never does", async () => {
    const key = "anon:00000000-0000-4000-8000-0000000000b1";
    const rows = [7, 8, 9].flatMap(m => [`01/0${m}/2026,NEFT ACME SALARY,,100000.00`, `10/0${m}/2026,UPI/3/SWIGGY/sw@bank,6000.00,`]);
    const p = await caller(key).inari.importPreview({ kind: "csv", filename: "n.csv", content: ["Date,Description,Debit,Credit", ...rows].join("\n") });
    await caller(key).inari.importCommit({ previewId: p.previewId });

    const legacy = await caller(key).advisor.ask({ question: "How can I improve my savings rate?" });
    expect(legacy.mode).not.toBe("llm");
    expect(invokeLLM).not.toHaveBeenCalled();

    const inari = await caller(key).inari.ask({ question: "How much did I spend on dining last month?", locale: "en" });
    expect(inari.engine).toMatchObject({ llmUsed: false });
    expect(invokeLLM).not.toHaveBeenCalled();
  });
});
