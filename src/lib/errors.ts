export type DomainErrorCode =
  | "not_found"
  | "auth_invalid"
  | "invalid_payload"
  | "invalid_transition"
  | "unsupported_event"
  | "unsupported_currency"
  | "invalid_context"
  | "missing_item_submission"
  | "duplicate_transaction_submission"
  | "rate_limited"
  | "internal_error"

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = "DomainError"
  }
}

const httpByCode: Record<DomainErrorCode, number> = {
  not_found: 404,
  auth_invalid: 401,
  invalid_payload: 400,
  invalid_transition: 409,
  unsupported_event: 400,
  unsupported_currency: 400,
  invalid_context: 400,
  missing_item_submission: 422,
  duplicate_transaction_submission: 422,
  rate_limited: 429,
  internal_error: 500,
}

export function statusForCode(code: DomainErrorCode): number {
  return httpByCode[code]
}

export function errorEnvelope(err: DomainError) {
  return {
    status: "error" as const,
    error: {
      code: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    },
  }
}
