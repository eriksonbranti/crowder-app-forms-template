import type { InferSelectModel } from "drizzle-orm"

import type { RefundReason, transactions, TransactionStatus } from "@/lib/db/schema"

export type Transaction = InferSelectModel<typeof transactions>
export type { RefundReason, TransactionStatus }

export type ReservedPayload = {
  expiresAt: Date
}

export type ConfirmedPayload = {
  purchaseId: number
  purchaseAmount: number
}

export type RefundedPayload = {
  amount: number
  reason: RefundReason
  refundedAt: Date
  refundId: string
}
