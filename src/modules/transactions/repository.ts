import { and, count, desc, eq, gt, gte, ilike, inArray, lt, lte, or, sql } from "drizzle-orm"

import { db } from "@/lib/db"
import { transactions, type TransactionStatus } from "@/lib/db/schema"

import type { Transaction } from "./types"

export async function findById(id: string): Promise<Transaction | null> {
  const [row] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, id))
    .limit(1)
  return row ?? null
}

// Atomic, optimistic transition: only flips status when current === `from`.
// Returns the updated row, or null if the precondition didn't hold.
export async function transition(
  id: string,
  from: TransactionStatus,
  to: TransactionStatus,
  extra: Partial<Transaction> = {},
): Promise<Transaction | null> {
  const [row] = await db
    .update(transactions)
    .set({ ...extra, status: to, updatedAt: new Date() })
    .where(and(eq(transactions.id, id), eq(transactions.status, from)))
    .returning()
  return row ?? null
}

export type ListFilters = {
  status?: TransactionStatus[]
  search?: string
  limit?: number
  offset?: number
}

function listWhere(filters: ListFilters) {
  const conds = []
  if (filters.status?.length) {
    conds.push(inArray(transactions.status, filters.status))
  }
  if (filters.search) {
    const like = `%${filters.search}%`
    conds.push(
      or(ilike(transactions.id, like), ilike(transactions.eventName, like))!,
    )
  }
  return conds.length ? and(...conds) : undefined
}

export async function list(filters: ListFilters = {}): Promise<Transaction[]> {
  const where = listWhere(filters)
  let q = db.select().from(transactions).$dynamic()
  if (where) q = q.where(where)
  return q
    .orderBy(desc(transactions.createdAt))
    .limit(filters.limit ?? 100)
    .offset(filters.offset ?? 0)
}

export async function countList(
  filters: Omit<ListFilters, "limit" | "offset"> = {},
): Promise<number> {
  const where = listWhere(filters)
  let q = db.select({ n: count() }).from(transactions).$dynamic()
  if (where) q = q.where(where)
  const [row] = await q
  return Number(row?.n ?? 0)
}

export type StatusCounts = Record<TransactionStatus, number>

export async function countsByStatus(): Promise<StatusCounts> {
  const rows = await db
    .select({ status: transactions.status, n: count() })
    .from(transactions)
    .groupBy(transactions.status)
  const out: StatusCounts = {
    valid: 0,
    reserved: 0,
    expired: 0,
    confirmed: 0,
    refunded: 0,
  }
  for (const r of rows) out[r.status] = Number(r.n)
  return out
}

export async function countActiveReservations(now: Date): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(transactions)
    .where(
      and(eq(transactions.status, "reserved"), gt(transactions.expiresAt, now)),
    )
  return Number(row?.n ?? 0)
}

export type DailyStatusBucket = {
  date: string // YYYY-MM-DD (UTC)
  confirmed: number
  reserved: number
  expired: number
  refunded: number
  valid: number
}

export async function dailyCountsByStatus(
  since: Date,
  until: Date = new Date(),
): Promise<DailyStatusBucket[]> {
  const day = sql<string>`to_char(date_trunc('day', ${transactions.createdAt}) at time zone 'UTC', 'YYYY-MM-DD')`
  const rows = await db
    .select({
      day,
      status: transactions.status,
      n: count(),
    })
    .from(transactions)
    .where(and(gte(transactions.createdAt, since), lte(transactions.createdAt, until)))
    .groupBy(day, transactions.status)

  const byDay = new Map<string, DailyStatusBucket>()
  const startMs = Date.UTC(
    since.getUTCFullYear(),
    since.getUTCMonth(),
    since.getUTCDate(),
  )
  const endMs = Date.UTC(
    until.getUTCFullYear(),
    until.getUTCMonth(),
    until.getUTCDate(),
  )
  for (let t = startMs; t <= endMs; t += 86_400_000) {
    const d = new Date(t).toISOString().slice(0, 10)
    byDay.set(d, {
      date: d,
      confirmed: 0,
      reserved: 0,
      expired: 0,
      refunded: 0,
      valid: 0,
    })
  }
  for (const r of rows) {
    const bucket = byDay.get(r.day)
    if (!bucket) continue
    bucket[r.status] = Number(r.n)
  }
  return Array.from(byDay.values())
}

export type LifecycleEvent = {
  type:
    | "confirmed"
    | "reserved"
    | "refunded"
    | "expired"
    | "valid"
  transactionId: string
  eventName: string
  amount: number | null
  currency: string
  at: Date
}

export async function listRecentLifecycleEvents(
  limit = 8,
): Promise<LifecycleEvent[]> {
  // Order by updatedAt — the service touches it on every status transition.
  const rows = await db
    .select()
    .from(transactions)
    .orderBy(desc(transactions.updatedAt))
    .limit(limit)

  return rows.map((t) => {
    let at: Date = t.updatedAt
    const type: LifecycleEvent["type"] = t.status
    if (t.status === "confirmed" && t.confirmedAt) at = t.confirmedAt
    else if (t.status === "refunded" && t.refundedAt) at = t.refundedAt
    else if (t.status === "expired" && t.expiresAt) at = t.expiresAt
    const amount =
      t.status === "refunded"
        ? t.refundAmount
        : t.status === "confirmed"
          ? t.purchaseAmount
          : null
    return {
      type,
      transactionId: t.id,
      eventName: t.eventName,
      amount: amount ?? null,
      currency: t.currency,
      at,
    }
  })
}

export type ExpiringReservation = {
  id: string
  eventName: string
  amount: number | null
  currency: string
  expiresAt: Date
}

export async function listExpiringSoon(
  now: Date,
  withinMs: number,
  limit = 10,
): Promise<ExpiringReservation[]> {
  const horizon = new Date(now.getTime() + withinMs)
  const rows = await db
    .select({
      id: transactions.id,
      eventName: transactions.eventName,
      amount: transactions.purchaseAmount,
      currency: transactions.currency,
      expiresAt: transactions.expiresAt,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.status, "reserved"),
        gt(transactions.expiresAt, now),
        lte(transactions.expiresAt, horizon),
      ),
    )
    .orderBy(transactions.expiresAt)
    .limit(limit)
  return rows
    .filter((r) => r.expiresAt != null)
    .map((r) => ({
      id: r.id,
      eventName: r.eventName,
      amount: r.amount,
      currency: r.currency,
      expiresAt: r.expiresAt!,
    }))
}

export type StatusCountsSince = {
  total: number
  confirmed: number
  expired: number
  reserved: number
  amountConfirmed: number
}

export type Overview = {
  counts: StatusCounts
  current: StatusCountsSince
  previous: StatusCountsSince
}

// Una sola pasada sobre `transactions` que devuelve:
//   - counts por estado (all-time)
//   - stats en [midpoint, until]  (current)
//   - stats en [since, midpoint)  (previous)
export async function overview(
  since: Date,
  midpoint: Date,
  until: Date,
): Promise<Overview> {
  // postgres-js no acepta `Date` como parámetro crudo dentro de un sql template
  // (Drizzle sólo mapea Date→ISO cuando conoce la columna, p.ej. en gte/lte).
  // Serializamos a ISO para evitar ERR_INVALID_ARG_TYPE.
  const sinceIso = since.toISOString()
  const midIso = midpoint.toISOString()
  const untilIso = until.toISOString()
  const cur = sql`${transactions.createdAt} >= ${midIso} and ${transactions.createdAt} <= ${untilIso}`
  const prev = sql`${transactions.createdAt} >= ${sinceIso} and ${transactions.createdAt} < ${midIso}`

  const [row] = await db
    .select({
      // all-time counts por estado
      cValid: sql<number>`count(*) filter (where ${transactions.status} = 'valid')`,
      cReserved: sql<number>`count(*) filter (where ${transactions.status} = 'reserved')`,
      cExpired: sql<number>`count(*) filter (where ${transactions.status} = 'expired')`,
      cConfirmed: sql<number>`count(*) filter (where ${transactions.status} = 'confirmed')`,
      cRefunded: sql<number>`count(*) filter (where ${transactions.status} = 'refunded')`,
      // current window
      curTotal: sql<number>`count(*) filter (where ${cur})`,
      curConfirmed: sql<number>`count(*) filter (where ${cur} and ${transactions.status} = 'confirmed')`,
      curExpired: sql<number>`count(*) filter (where ${cur} and ${transactions.status} = 'expired')`,
      curReserved: sql<number>`count(*) filter (where ${cur} and ${transactions.status} in ('reserved','confirmed','expired','refunded'))`,
      curAmountConfirmed: sql<number>`coalesce(sum(${transactions.purchaseAmount}) filter (where ${cur} and ${transactions.status} = 'confirmed'), 0)`,
      // previous window
      prevTotal: sql<number>`count(*) filter (where ${prev})`,
      prevConfirmed: sql<number>`count(*) filter (where ${prev} and ${transactions.status} = 'confirmed')`,
      prevExpired: sql<number>`count(*) filter (where ${prev} and ${transactions.status} = 'expired')`,
      prevReserved: sql<number>`count(*) filter (where ${prev} and ${transactions.status} in ('reserved','confirmed','expired','refunded'))`,
      prevAmountConfirmed: sql<number>`coalesce(sum(${transactions.purchaseAmount}) filter (where ${prev} and ${transactions.status} = 'confirmed'), 0)`,
    })
    .from(transactions)

  return {
    counts: {
      valid: Number(row?.cValid ?? 0),
      reserved: Number(row?.cReserved ?? 0),
      expired: Number(row?.cExpired ?? 0),
      confirmed: Number(row?.cConfirmed ?? 0),
      refunded: Number(row?.cRefunded ?? 0),
    },
    current: {
      total: Number(row?.curTotal ?? 0),
      confirmed: Number(row?.curConfirmed ?? 0),
      expired: Number(row?.curExpired ?? 0),
      reserved: Number(row?.curReserved ?? 0),
      amountConfirmed: Number(row?.curAmountConfirmed ?? 0),
    },
    previous: {
      total: Number(row?.prevTotal ?? 0),
      confirmed: Number(row?.prevConfirmed ?? 0),
      expired: Number(row?.prevExpired ?? 0),
      reserved: Number(row?.prevReserved ?? 0),
      amountConfirmed: Number(row?.prevAmountConfirmed ?? 0),
    },
  }
}

// Single atomic UPDATE — no row-by-row loop, no unbounded SELECT.
export async function expireReserved(now: Date): Promise<number> {
  const rows = await db
    .update(transactions)
    .set({ status: "expired", updatedAt: new Date() })
    .where(
      and(eq(transactions.status, "reserved"), lt(transactions.expiresAt, now)),
    )
    .returning({ id: transactions.id })
  return rows.length
}
