import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { ENV } from "./env";
import { sdk } from "./sdk";
import { resolveAnonymousIdentity } from "../inari/identity";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  /** INARI ownership key: `user:<openId>` (authenticated) or `anon:<uuid>` (per-browser demo). */
  inariUserKey?: string;
  inariIdentityKind?: "anonymous_demo" | "authenticated";
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  let inariUserKey: string | undefined;
  let inariIdentityKind: TrpcContext["inariIdentityKind"];

  if (!user && ENV.isDemoMode) {
    // Per-browser anonymous demo identity (signed httpOnly cookie). Not production auth.
    const anon = resolveAnonymousIdentity(opts.req, opts.res);
    inariUserKey = anon.userKey;
    inariIdentityKind = "anonymous_demo";
    user = {
      id: anon.numericId,
      openId: "local-demo-user",
      name: "Demo User",
      email: "demo@inari.local",
      loginMethod: "local-demo",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
  } else if (user) {
    inariUserKey = `user:${user.openId}`;
    inariIdentityKind = "authenticated";
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    inariUserKey,
    inariIdentityKind,
  };
}
