/**
 * Anonymous per-browser DEMO identity.
 *
 * This isolates synthetic demo data between browsers. It is NOT production
 * authentication: anyone who clears cookies loses access, and there is no
 * account recovery or credential check.
 *
 * Cookie value: `v1.<uuid>.<base64url HMAC-SHA256("v1.<uuid>")>`.
 */
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { parse as parseCookieHeader } from "cookie";
import type { CookieOptions, Request, Response } from "express";
import { ENV } from "../_core/env";

export const ANON_COOKIE_NAME = "inari_demo_id";
export const ANON_COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function getIdentitySecret(): string {
  const secret = process.env.INARI_IDENTITY_SECRET || ENV.cookieSecret;
  if (!secret) {
    throw new Error("INARI_IDENTITY_SECRET (or JWT_SECRET) is required to sign demo identities");
  }
  return secret;
}

const sign = (payload: string, secret: string) =>
  createHmac("sha256", secret).update(payload).digest("base64url");

export function issueAnonymousId(secret = getIdentitySecret()): { id: string; cookieValue: string } {
  const id = randomUUID();
  const payload = `v1.${id}`;
  return { id, cookieValue: `${payload}.${sign(payload, secret)}` };
}

/** Returns the anonymous id if the cookie value carries a valid signature, else null. */
export function verifyAnonymousCookie(value: string | undefined | null, secret = getIdentitySecret()): string | null {
  if (!value || value.length > 200) return null;
  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== "v1" || !UUID_RE.test(parts[1])) return null;
  const expected = Buffer.from(sign(`v1.${parts[1]}`, secret));
  const actual = Buffer.from(parts[2]);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return parts[1];
}

function isSecure(req: Pick<Request, "protocol" | "headers">) {
  if (req.protocol === "https") return true;
  const forwarded = req.headers["x-forwarded-proto"];
  const list = Array.isArray(forwarded) ? forwarded : (forwarded ?? "").split(",");
  return list.some(p => p.trim().toLowerCase() === "https");
}

export function anonymousCookieOptions(req: Pick<Request, "protocol" | "headers">): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax", // frontend is served by the same origin as the API
    secure: isSecure(req),
    path: "/",
    maxAge: ANON_COOKIE_MAX_AGE_MS,
  };
}

/** Process-local numeric ids for legacy code paths that key state by number. */
const numericIds = new Map<string, number>();
let nextNumericId = 1_000_000;
export function numericIdForAnonymous(anonId: string): number {
  let id = numericIds.get(anonId);
  if (id === undefined) {
    id = nextNumericId++;
    numericIds.set(anonId, id);
  }
  return id;
}

export type ResolvedAnonymousIdentity = { anonId: string; userKey: string; numericId: number; issued: boolean };

/** Reads the signed cookie or issues a new one on the response. */
export function resolveAnonymousIdentity(req: Request, res: Response): ResolvedAnonymousIdentity {
  const cookies = parseCookieHeader(req.headers.cookie ?? "");
  let anonId = verifyAnonymousCookie(cookies[ANON_COOKIE_NAME]);
  let issued = false;
  if (!anonId) {
    const fresh = issueAnonymousId();
    anonId = fresh.id;
    issued = true;
    res.cookie(ANON_COOKIE_NAME, fresh.cookieValue, anonymousCookieOptions(req));
  }
  return { anonId, userKey: `anon:${anonId}`, numericId: numericIdForAnonymous(anonId), issued };
}
