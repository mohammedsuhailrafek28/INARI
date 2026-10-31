import { TRPCError } from "@trpc/server";
import type { InariErrorCode } from "../../shared/inari/contracts";

const HTTP_CODE: Record<InariErrorCode, TRPCError["code"]> = {
  UNSUPPORTED_FORMAT: "BAD_REQUEST",
  FILE_TOO_LARGE: "PAYLOAD_TOO_LARGE",
  TOO_MANY_ROWS: "PAYLOAD_TOO_LARGE",
  PARSE_FAILED: "BAD_REQUEST",
  PASSWORD_REQUIRED: "BAD_REQUEST",
  SCANNED_PDF_UNSUPPORTED: "UNPROCESSABLE_CONTENT",
  PREVIEW_EXPIRED: "NOT_FOUND",
  NO_DATA: "PRECONDITION_FAILED",
  INSUFFICIENT_DATA: "PRECONDITION_FAILED",
  INVALID_SCENARIO: "BAD_REQUEST",
  GUARDRAIL_REFUSED: "BAD_REQUEST",
  LLM_UNAVAILABLE: "INTERNAL_SERVER_ERROR",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  FORBIDDEN_OWNER: "FORBIDDEN",
  NOT_IMPLEMENTED: "NOT_IMPLEMENTED",
};

/** Domain error with a stable code and a message that is safe to show to the user (never contains file contents). */
export class InariError extends Error {
  constructor(
    public readonly inariCode: InariErrorCode,
    message: string,
    public readonly details?: Record<string, string | number | boolean>
  ) {
    super(message);
    this.name = "InariError";
  }
}

export function toTrpcError(error: InariError) {
  return new TRPCError({ code: HTTP_CODE[error.inariCode], message: error.message, cause: error });
}

/** Run a service call and convert InariError into a TRPCError the error formatter understands. */
export async function guarded<T>(fn: () => Promise<T> | T): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof InariError) throw toTrpcError(error);
    throw error;
  }
}
