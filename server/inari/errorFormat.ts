import { ZodError } from "zod";
import type { InariErrorCode, InariErrorData } from "../../shared/inari/contracts";
import { InariError } from "./errors";

type Shape = { message: string; code: number; data: Record<string, unknown> };

const BY_TRPC_CODE: Record<string, InariErrorCode> = {
  BAD_REQUEST: "INVALID_INPUT",
  NOT_FOUND: "NOT_FOUND",
  FORBIDDEN: "FORBIDDEN_OWNER",
  CONFLICT: "CONFLICT",
};

/**
 * Turns every failure into a stable code plus a message that is safe to show.
 * Raw Zod issue dumps (which can echo submitted values) never reach the client; only field paths and issue kinds do.
 */
export function sanitizeError<S extends Shape>(shape: S, error: { code: string; message: string; cause?: unknown; stack?: string }): S {
  const cause = error.cause;
  let inari: InariErrorData;
  let message = shape.message;

  if (cause instanceof InariError) {
    inari = { code: cause.inariCode };
    message = cause.message;
  } else if (cause instanceof ZodError || looksLikeZodMessage(error.message)) {
    const issues = cause instanceof ZodError ? cause.issues : [];
    inari = {
      code: "INVALID_INPUT",
      fields: issues.slice(0, 10).map(i => ({ path: i.path.join("."), issue: i.code })),
    };
    message = "The request was not valid. Check the highlighted fields.";
  } else if (error.code === "INTERNAL_SERVER_ERROR") {
    inari = { code: "INTERNAL" };
    message = "Something went wrong on our side. Please try again.";
  } else {
    inari = { code: BY_TRPC_CODE[error.code] ?? "INTERNAL" };
  }

  const { stack: _stack, ...data } = shape.data as Record<string, unknown>; // never ship stack traces
  return { ...shape, message, data: { ...data, inari } } as S;
}

// tRPC wraps input-validation failures in a TRPCError whose message is a JSON dump of the issues
const looksLikeZodMessage = (m: string) => m.startsWith("[") && m.includes('"code"') && m.includes('"path"');
