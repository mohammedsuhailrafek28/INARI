import { beforeEach, describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";
import { FileLedgerRepository, setLedgerRepositoryForTests } from "./ledger";

const ctx = (): TrpcContext => ({
  user: { id: 5, openId: "x", email: null, name: "D", loginMethod: "l", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: { protocol: "http", headers: {} } as TrpcContext["req"],
  res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
  inariUserKey: "anon:00000000-0000-4000-8000-0000000000e1",
  inariIdentityKind: "anonymous_demo",
});
beforeEach(() => setLedgerRepositoryForTests(new FileLedgerRepository()));

async function failure(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e: any) {
    return e;
  }
  throw new Error("expected failure");
}
const dataOf = (e: any) => (e.cause && e.shape ? e.shape.data : e);

describe("error responses are sanitized", () => {
  it("validation failures expose a stable code and field paths, never submitted values", async () => {
    const secret = "TOP-SECRET-VALUE-9917";
    const e = await failure(() => appRouter.createCaller(ctx()).inari.correctCategory({ transactionId: secret, category: secret as any, applyToMerchant: false }));
    const shape = appRouter._def._config.errorFormatter({ error: e, type: "mutation", path: "inari.correctCategory", input: {}, ctx: ctx(), shape: { message: e.message, code: -32600, data: { code: "BAD_REQUEST", httpStatus: 400, stack: "STACK" } } } as any) as any;
    expect(shape.data.inari.code).toBe("INVALID_INPUT");
    expect(shape.data.inari.fields).toEqual([{ path: "category", issue: "invalid_value" }]);
    expect(JSON.stringify(shape)).not.toContain(secret);
    expect(shape.data.stack).toBeUndefined();
    expect(shape.message).not.toMatch(/"code"|"path"/);
  });

  it("domain errors keep their own stable code and a safe message", async () => {
    const e = await failure(() => appRouter.createCaller(ctx()).inari.importCommit({ previewId: "prev_missing" }));
    const shape = appRouter._def._config.errorFormatter({ error: e, type: "mutation", path: "x", input: {}, ctx: ctx(), shape: { message: e.message, code: -32004, data: { code: "NOT_FOUND", httpStatus: 404 } } } as any) as any;
    expect(shape.data.inari.code).toBe("PREVIEW_EXPIRED");
    expect(shape.message).toMatch(/expired/);
  });

  it("unexpected errors become INTERNAL with a generic message", async () => {
    const shape = appRouter._def._config.errorFormatter({
      error: Object.assign(new Error("db password=hunter2 at /srv/x.ts"), { code: "INTERNAL_SERVER_ERROR" }),
      type: "query", path: "x", input: {}, ctx: ctx(),
      shape: { message: "db password=hunter2 at /srv/x.ts", code: -32603, data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500, stack: "s" } },
    } as any) as any;
    expect(shape.data.inari.code).toBe("INTERNAL");
    expect(JSON.stringify(shape)).not.toContain("hunter2");
  });
});
