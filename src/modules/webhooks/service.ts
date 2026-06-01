import { DomainError } from "@/lib/errors"
import {
  generateRefundId,
  markConfirmed,
  markExpired,
  markRefunded,
  markReserved,
  requireById,
  type RefundReason,
  type TransactionStatus,
} from "@/modules/transactions"

import * as repo from "./repository"

export type WebhookStatus =
  | "purchaseReserved"
  | "purchasePaid"
  | "purchaseExpired"
  | "purchaseRefunded"

const FROM_BY_STATUS: Record<WebhookStatus, TransactionStatus> = {
  purchaseReserved: "valid",
  purchasePaid: "reserved",
  purchaseExpired: "reserved",
  purchaseRefunded: "confirmed",
}

type CachedResponse = {
  status: number
  body: unknown
  cached: true
}

type HandledResponse = {
  status: number
  body: Record<string, unknown>
  cached: false
}

export type HandleResult = CachedResponse | HandledResponse

const DEFAULT_RESERVATION_TTL_MS = 15 * 60 * 1000

export async function handle(input: {
  transactionId: string
  status: WebhookStatus
  payload: Record<string, unknown>
}): Promise<HandleResult> {
  // Idempotency: replay cached response on duplicate (transaction_id, status).
  const cached = await repo.findByKey(input.transactionId, input.status)
  if (cached) {
    return { status: cached.responseStatus, body: cached.responseBody, cached: true }
  }

  const txn = await requireById(input.transactionId)
  const expectedFrom = FROM_BY_STATUS[input.status]
  if (txn.status !== expectedFrom) {
    throw new DomainError(
      "invalid_transition",
      `cannot apply ${input.status}: transaction is '${txn.status}', expected '${expectedFrom}'`,
    )
  }

  let body: Record<string, unknown>
  switch (input.status) {
    case "purchaseReserved": {
      const expiresAtRaw = (input.payload.expiresAt as string | undefined) ?? null
      const expiresAt = expiresAtRaw
        ? new Date(expiresAtRaw)
        : new Date(Date.now() + DEFAULT_RESERVATION_TTL_MS)
      const next = await markReserved(input.transactionId, { expiresAt })
      body = { status: "reserved", expiresAt: next.expiresAt!.toISOString() }
      break
    }
    case "purchasePaid": {
      const purchase = input.payload.purchase as
        | { id: number; amount: number }
        | undefined
      if (!purchase) {
        throw new DomainError("invalid_payload", "missing purchase in purchasePaid")
      }
      await markConfirmed(input.transactionId, {
        purchaseId: purchase.id,
        purchaseAmount: purchase.amount,
      })
      body = { status: "confirmed" }
      break
    }
    case "purchaseExpired": {
      await markExpired(input.transactionId)
      body = { status: "expired" }
      break
    }
    case "purchaseRefunded": {
      // Refunds are atomic in this project (no items → no partial refunds), so
      // the amount mirrors the captured purchase. `refundId` and `refundedAt`
      // are partner-generated.
      if (txn.purchaseAmount == null) {
        throw new DomainError(
          "invalid_transition",
          `cannot refund '${input.transactionId}': missing purchase amount`,
        )
      }
      await markRefunded(input.transactionId, {
        amount: txn.purchaseAmount,
        reason: (input.payload.reason as RefundReason | undefined) ?? "other",
        refundedAt: new Date(),
        refundId: generateRefundId(),
      })
      body = { status: "refunded" }
      break
    }
  }

  return { status: 200, body, cached: false }
}

export async function logResult(input: {
  transactionId: string
  status: string
  payload: unknown
  responseStatus: number
  responseBody: unknown
}): Promise<void> {
  await repo.log(input)
}

export { listByTransaction } from "./repository"
