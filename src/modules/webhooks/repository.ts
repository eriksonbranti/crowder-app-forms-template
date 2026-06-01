import { and, desc, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { webhookEvents } from "@/lib/db/schema"

export async function findByKey(
  transactionId: string,
  status: string,
): Promise<{
  responseStatus: number
  responseBody: unknown
} | null> {
  const [row] = await db
    .select({
      responseStatus: webhookEvents.responseStatus,
      responseBody: webhookEvents.responseBody,
    })
    .from(webhookEvents)
    .where(
      and(
        eq(webhookEvents.transactionId, transactionId),
        eq(webhookEvents.status, status),
      ),
    )
    .limit(1)
  return row ?? null
}

export async function log(input: {
  transactionId: string
  status: string
  payload: unknown
  responseStatus: number
  responseBody: unknown
}): Promise<void> {
  await db
    .insert(webhookEvents)
    .values(input)
    .onConflictDoNothing({
      target: [webhookEvents.transactionId, webhookEvents.status],
    })
}

export async function listByTransaction(transactionId: string) {
  return db
    .select()
    .from(webhookEvents)
    .where(eq(webhookEvents.transactionId, transactionId))
    .orderBy(desc(webhookEvents.processedAt))
}

export async function listAll(
  filters: { transactionId?: string; status?: string; limit?: number } = {},
) {
  const conds = []
  if (filters.transactionId)
    conds.push(eq(webhookEvents.transactionId, filters.transactionId))
  if (filters.status) conds.push(eq(webhookEvents.status, filters.status))
  let q = db.select().from(webhookEvents).$dynamic()
  if (conds.length) q = q.where(and(...conds))
  return q
    .orderBy(desc(webhookEvents.processedAt))
    .limit(filters.limit ?? 200)
}
