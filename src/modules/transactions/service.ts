import { randomBytes } from "crypto"

import { DomainError } from "@/lib/errors"

import * as repo from "./repository"
import type {
  ConfirmedPayload,
  RefundedPayload,
  ReservedPayload,
  Transaction,
  TransactionStatus,
} from "./types"

export function generateId(): string {
  return "txn_" + randomBytes(12).toString("base64url")
}

export function generateRefundId(): string {
  return "rfd_" + randomBytes(12).toString("base64url")
}

export async function findById(id: string): Promise<Transaction | null> {
  return repo.findById(id)
}

export async function requireById(id: string): Promise<Transaction> {
  const t = await repo.findById(id)
  if (!t) throw new DomainError("not_found", `transaction '${id}' not found`)
  return t
}

async function applyTransition(
  id: string,
  from: TransactionStatus,
  to: TransactionStatus,
  extra: Partial<Transaction>,
): Promise<Transaction> {
  const next = await repo.transition(id, from, to, extra)
  if (!next) {
    throw new DomainError(
      "invalid_transition",
      `transaction '${id}' cannot transition ${from} → ${to}`,
    )
  }
  return next
}

export function markReserved(id: string, payload: ReservedPayload) {
  return applyTransition(id, "valid", "reserved", { expiresAt: payload.expiresAt })
}

export function markExpired(id: string) {
  return applyTransition(id, "reserved", "expired", {})
}

export function markConfirmed(id: string, payload: ConfirmedPayload) {
  return applyTransition(id, "reserved", "confirmed", {
    purchaseId: payload.purchaseId,
    purchaseAmount: payload.purchaseAmount,
    confirmedAt: new Date(),
  })
}

export function markRefunded(id: string, payload: RefundedPayload) {
  return applyTransition(id, "confirmed", "refunded", {
    refundedAt: payload.refundedAt,
    refundAmount: payload.amount,
    refundReason: payload.reason,
    refundId: payload.refundId,
  })
}

export async function expireStale(): Promise<number> {
  return repo.expireReserved(new Date())
}

export const list = repo.list
export const countList = repo.countList
export const countsByStatus = repo.countsByStatus
export const countActiveReservations = repo.countActiveReservations
export const dailyCountsByStatus = repo.dailyCountsByStatus
export const listRecentLifecycleEvents = repo.listRecentLifecycleEvents
export const listExpiringSoon = repo.listExpiringSoon
export const overview = repo.overview
export type {
  ListFilters,
  StatusCounts,
  DailyStatusBucket,
  LifecycleEvent,
  ExpiringReservation,
  Overview,
} from "./repository"
