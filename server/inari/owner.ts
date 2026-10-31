import type { TrpcContext } from "../_core/context";

/** Ledger owner key for the request: per-browser anonymous id in demo mode, `user:<openId>` otherwise. */
export const ownerKeyOf = (ctx: Pick<TrpcContext, "inariUserKey" | "user">): string =>
  ctx.inariUserKey ?? `user:${ctx.user?.openId ?? "unknown"}`;
