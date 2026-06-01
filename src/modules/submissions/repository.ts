import { and, count, desc, eq, ilike, inArray, max, or, sql } from "drizzle-orm"

import { db } from "@/lib/db"
import {
  forms,
  submissionEdits,
  submissions,
  transactions,
  type TransactionStatus,
} from "@/lib/db/schema"

import type { Submission } from "./types"

export type GroupedRow = {
  eventId: number
  eventName: string
  formId: string
  groupId: string
  confirmed: number
  total: number
  edits: number
  lastActivity: Date | null
}

const CONFIRMED_FILTER = sql<number>`count(*) filter (where ${transactions.status} = 'confirmed')`
const TOTAL_FILTER = sql<number>`count(*)`

export async function groupedByEventFormGroup(
  filters: { search?: string } = {},
): Promise<GroupedRow[]> {
  const editsSub = db
    .select({
      formId: submissions.formId,
      groupId: submissions.groupId,
      eventId: transactions.eventId,
      editCount: count().as("edit_count"),
    })
    .from(submissionEdits)
    .innerJoin(submissions, eq(submissions.id, submissionEdits.submissionId))
    .innerJoin(transactions, eq(transactions.id, submissions.transactionId))
    .groupBy(submissions.formId, submissions.groupId, transactions.eventId)
    .as("edits_agg")

  const searchCond = filters.search
    ? or(
        ilike(transactions.eventName, `%${filters.search}%`),
        ilike(submissions.formId, `%${filters.search}%`),
      )
    : undefined

  const rows = await db
    .select({
      eventId: transactions.eventId,
      eventName: transactions.eventName,
      formId: submissions.formId,
      groupId: submissions.groupId,
      confirmed: CONFIRMED_FILTER,
      total: TOTAL_FILTER,
      lastActivity: max(submissions.createdAt),
      edits: sql<number>`coalesce(${editsSub.editCount}, 0)`,
    })
    .from(submissions)
    .innerJoin(transactions, eq(transactions.id, submissions.transactionId))
    .leftJoin(
      editsSub,
      and(
        eq(editsSub.formId, submissions.formId),
        eq(editsSub.groupId, submissions.groupId),
        eq(editsSub.eventId, transactions.eventId),
      ),
    )
    .where(searchCond)
    .groupBy(
      transactions.eventId,
      transactions.eventName,
      submissions.formId,
      submissions.groupId,
      editsSub.editCount,
    )
    .orderBy(transactions.eventName, submissions.formId, submissions.groupId)

  return rows.map((r) => ({
    eventId: r.eventId,
    eventName: r.eventName,
    formId: r.formId,
    groupId: r.groupId,
    confirmed: Number(r.confirmed),
    total: Number(r.total),
    edits: Number(r.edits),
    lastActivity: r.lastActivity,
  }))
}

export type DrilldownRow = {
  submission: Submission
  transactionStatus: TransactionStatus
  transactionCreatedAt: Date
  transactionPurchaseId: number | null
  eventId: number
  eventName: string
  userEmail: string | null
  userFirstName: string | null
  userLastName: string | null
  userCountry: string | null
}

export const DRILLDOWN_DEFAULT_LIMIT = 500

export type DrilldownCountFilters = {
  eventId: number
  formId: string
  groupId: string
  statuses?: TransactionStatus[]
  /** Free-text person search: buyer email/name, holder name/document. */
  search?: string
}

export type DrilldownFilters = DrilldownCountFilters & {
  /** `null` = no limit (CSV export); `undefined` = default cap (dashboard). */
  limit?: number | null
  offset?: number
}

// Person search across the denormalized identity columns. The name predicates
// are written to match the `lower(coalesce(first,'') || ' ' || coalesce(last,''))`
// trigram indexes so the planner can use them; email/document lower-match too.
function personSearchCond(search?: string) {
  const term = search?.trim().toLowerCase()
  if (!term) return undefined
  const like = `%${term}%`
  const buyerName = sql`lower(coalesce(${transactions.buyerFirstName}, '') || ' ' || coalesce(${transactions.buyerLastName}, ''))`
  const holderName = sql`lower(coalesce(${submissions.holderFirstName}, '') || ' ' || coalesce(${submissions.holderLastName}, ''))`
  return or(
    sql`lower(${transactions.buyerEmail}) like ${like}`,
    sql`${buyerName} like ${like}`,
    sql`lower(${submissions.holderDocument}) like ${like}`,
    sql`${holderName} like ${like}`,
  )
}

function drilldownWhere(filters: DrilldownCountFilters) {
  const statuses = filters.statuses ?? (["confirmed"] as TransactionStatus[])
  return and(
    eq(transactions.eventId, filters.eventId),
    eq(submissions.formId, filters.formId),
    eq(submissions.groupId, filters.groupId),
    inArray(transactions.status, statuses),
    personSearchCond(filters.search),
  )
}

export type FormDrilldownCountFilters = Omit<
  DrilldownCountFilters,
  "groupId" | "eventId"
> & {
  eventId?: number
}
export type FormDrilldownFilters = Omit<
  DrilldownFilters,
  "groupId" | "eventId"
> & {
  eventId?: number
}

function drilldownByFormWhere(filters: FormDrilldownCountFilters) {
  const statuses = filters.statuses ?? (["confirmed"] as TransactionStatus[])
  return and(
    filters.eventId !== undefined
      ? eq(transactions.eventId, filters.eventId)
      : undefined,
    eq(submissions.formId, filters.formId),
    inArray(transactions.status, statuses),
    personSearchCond(filters.search),
  )
}

export async function countDrilldown(
  filters: DrilldownCountFilters,
): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(submissions)
    .innerJoin(transactions, eq(transactions.id, submissions.transactionId))
    .where(drilldownWhere(filters))
  return row?.value ?? 0
}

export async function eventsForForm(
  formId: string,
): Promise<{ eventId: number; eventName: string; total: number }[]> {
  const rows = await db
    .select({
      eventId: transactions.eventId,
      eventName: transactions.eventName,
      total: count(),
    })
    .from(submissions)
    .innerJoin(transactions, eq(transactions.id, submissions.transactionId))
    .where(
      and(
        eq(submissions.formId, formId),
        inArray(transactions.status, ["confirmed"] as TransactionStatus[]),
      ),
    )
    .groupBy(transactions.eventId, transactions.eventName)
    .orderBy(desc(count()))
  return rows.map((r) => ({
    eventId: r.eventId,
    eventName: r.eventName,
    total: Number(r.total),
  }))
}

export async function drilldownByForm(
  filters: FormDrilldownFilters,
): Promise<DrilldownRow[]> {
  // Pulls every submission for the form/event. The page merges by person.
  // No SQL-level pagination: the per-person grouping happens in app code
  // so the limit/offset apply to *persons*, not raw rows.
  const rows = await db
    .select({
      submission: submissions,
      transactionStatus: transactions.status,
      transactionCreatedAt: transactions.createdAt,
      transactionPurchaseId: transactions.purchaseId,
      eventId: transactions.eventId,
      eventName: transactions.eventName,
      userSnapshot: transactions.userSnapshot,
    })
    .from(submissions)
    .innerJoin(transactions, eq(transactions.id, submissions.transactionId))
    .where(drilldownByFormWhere(filters))
    .orderBy(desc(submissions.createdAt))

  return rows.map((r) => ({
    submission: r.submission,
    transactionStatus: r.transactionStatus,
    transactionCreatedAt: r.transactionCreatedAt,
    transactionPurchaseId: r.transactionPurchaseId,
    eventId: r.eventId,
    eventName: r.eventName,
    userEmail: r.userSnapshot?.email ?? null,
    userFirstName: r.userSnapshot?.firstName ?? null,
    userLastName: r.userSnapshot?.lastName ?? null,
    userCountry: r.userSnapshot?.country ?? null,
  }))
}

export type ExportAllRow = {
  submission: Submission
  transactionStatus: TransactionStatus
  transactionCreatedAt: Date
  transactionPurchaseId: number | null
  transactionEventId: number
  transactionEventName: string
  transactionCurrency: string | null
  transactionLocale: string | null
  userEmail: string | null
  userFirstName: string | null
  userLastName: string | null
  userCountry: string | null
}

export async function exportAll(
  statuses: TransactionStatus[],
): Promise<ExportAllRow[]> {
  const rows = await db
    .select({
      submission: submissions,
      transactionStatus: transactions.status,
      transactionCreatedAt: transactions.createdAt,
      transactionPurchaseId: transactions.purchaseId,
      transactionEventId: transactions.eventId,
      transactionEventName: transactions.eventName,
      transactionCurrency: transactions.currency,
      transactionLocale: transactions.locale,
      userSnapshot: transactions.userSnapshot,
    })
    .from(submissions)
    .innerJoin(transactions, eq(transactions.id, submissions.transactionId))
    .where(inArray(transactions.status, statuses))
    .orderBy(desc(transactions.createdAt), submissions.formId, submissions.groupId)

  return rows.map((r) => ({
    submission: r.submission,
    transactionStatus: r.transactionStatus,
    transactionCreatedAt: r.transactionCreatedAt,
    transactionPurchaseId: r.transactionPurchaseId,
    transactionEventId: r.transactionEventId,
    transactionEventName: r.transactionEventName,
    transactionCurrency: r.transactionCurrency,
    transactionLocale: r.transactionLocale,
    userEmail: r.userSnapshot?.email ?? null,
    userFirstName: r.userSnapshot?.firstName ?? null,
    userLastName: r.userSnapshot?.lastName ?? null,
    userCountry: r.userSnapshot?.country ?? null,
  }))
}

export async function drilldown(filters: DrilldownFilters): Promise<DrilldownRow[]> {
  const base = db
    .select({
      submission: submissions,
      transactionStatus: transactions.status,
      transactionCreatedAt: transactions.createdAt,
      transactionPurchaseId: transactions.purchaseId,
      eventId: transactions.eventId,
      eventName: transactions.eventName,
      userSnapshot: transactions.userSnapshot,
    })
    .from(submissions)
    .innerJoin(transactions, eq(transactions.id, submissions.transactionId))
    .where(drilldownWhere(filters))
    .orderBy(desc(submissions.createdAt))
  const rows =
    filters.limit === null
      ? await base
      : await base
          .limit(filters.limit ?? DRILLDOWN_DEFAULT_LIMIT)
          .offset(filters.offset ?? 0)

  return rows.map((r) => ({
    submission: r.submission,
    transactionStatus: r.transactionStatus,
    transactionCreatedAt: r.transactionCreatedAt,
    transactionPurchaseId: r.transactionPurchaseId,
    eventId: r.eventId,
    eventName: r.eventName,
    userEmail: r.userSnapshot?.email ?? null,
    userFirstName: r.userSnapshot?.firstName ?? null,
    userLastName: r.userSnapshot?.lastName ?? null,
    userCountry: r.userSnapshot?.country ?? null,
  }))
}

export async function listByTransaction(transactionId: string): Promise<Submission[]> {
  return db
    .select()
    .from(submissions)
    .where(eq(submissions.transactionId, transactionId))
    .orderBy(submissions.createdAt)
}

export async function findById(id: string): Promise<Submission | null> {
  const [row] = await db
    .select()
    .from(submissions)
    .where(eq(submissions.id, id))
    .limit(1)
  return row ?? null
}

export async function updateAnswers(
  id: string,
  answers: Record<string, unknown>,
  computedLabel: string,
): Promise<Submission | null> {
  const [row] = await db
    .update(submissions)
    .set({ answers, computedLabel, editedAt: new Date() })
    .where(eq(submissions.id, id))
    .returning()
  return row ?? null
}

export async function insertEdit(input: {
  submissionId: string
  editedBy: string
  reason: string | null
  answersBefore: Record<string, unknown>
  answersAfter: Record<string, unknown>
}): Promise<void> {
  await db.insert(submissionEdits).values(input)
}

export async function listEdits(submissionId: string) {
  return db
    .select()
    .from(submissionEdits)
    .where(eq(submissionEdits.submissionId, submissionId))
    .orderBy(desc(submissionEdits.editedAt))
}

export type GroupEditRow = {
  id: string
  submissionId: string
  editedBy: string
  editedAt: Date
  reason: string | null
  answersBefore: Record<string, unknown>
  answersAfter: Record<string, unknown>
  submissionLabel: string
}

export async function listEditsByGroup(filters: {
  eventId: number
  formId: string
  groupId: string
  limit?: number
}): Promise<{ rows: GroupEditRow[]; total: number }> {
  const rows = await db
    .select({
      id: submissionEdits.id,
      submissionId: submissionEdits.submissionId,
      editedBy: submissionEdits.editedBy,
      editedAt: submissionEdits.editedAt,
      reason: submissionEdits.reason,
      answersBefore: submissionEdits.answersBefore,
      answersAfter: submissionEdits.answersAfter,
      submissionLabel: submissions.computedLabel,
      total: sql<number>`count(*) over()`,
    })
    .from(submissionEdits)
    .innerJoin(submissions, eq(submissions.id, submissionEdits.submissionId))
    .innerJoin(transactions, eq(transactions.id, submissions.transactionId))
    .where(
      and(
        eq(transactions.eventId, filters.eventId),
        eq(submissions.formId, filters.formId),
        eq(submissions.groupId, filters.groupId),
      ),
    )
    .orderBy(desc(submissionEdits.editedAt))
    .limit(filters.limit ?? 50)
  const total = rows.length > 0 ? Number(rows[0].total) : 0
  return {
    rows: rows.map((r) => ({
      id: r.id,
      submissionId: r.submissionId,
      editedBy: r.editedBy,
      editedAt: r.editedAt,
      reason: r.reason,
      answersBefore: r.answersBefore as Record<string, unknown>,
      answersAfter: r.answersAfter as Record<string, unknown>,
      submissionLabel: r.submissionLabel,
    })),
    total,
  }
}

export type FormEditRow = GroupEditRow & { groupId: string }

export async function listEditsByForm(filters: {
  eventId?: number
  formId: string
  limit?: number
}): Promise<{ rows: FormEditRow[]; total: number }> {
  const rows = await db
    .select({
      id: submissionEdits.id,
      submissionId: submissionEdits.submissionId,
      editedBy: submissionEdits.editedBy,
      editedAt: submissionEdits.editedAt,
      reason: submissionEdits.reason,
      answersBefore: submissionEdits.answersBefore,
      answersAfter: submissionEdits.answersAfter,
      submissionLabel: submissions.computedLabel,
      groupId: submissions.groupId,
      total: sql<number>`count(*) over()`,
    })
    .from(submissionEdits)
    .innerJoin(submissions, eq(submissions.id, submissionEdits.submissionId))
    .innerJoin(transactions, eq(transactions.id, submissions.transactionId))
    .where(
      and(
        filters.eventId !== undefined
          ? eq(transactions.eventId, filters.eventId)
          : undefined,
        eq(submissions.formId, filters.formId),
      ),
    )
    .orderBy(desc(submissionEdits.editedAt))
    .limit(filters.limit ?? 100)
  const total = rows.length > 0 ? Number(rows[0].total) : 0
  return {
    rows: rows.map((r) => ({
      id: r.id,
      submissionId: r.submissionId,
      editedBy: r.editedBy,
      editedAt: r.editedAt,
      reason: r.reason,
      answersBefore: r.answersBefore as Record<string, unknown>,
      answersAfter: r.answersAfter as Record<string, unknown>,
      submissionLabel: r.submissionLabel,
      groupId: r.groupId,
    })),
    total,
  }
}

// Count-only variant for the tabla tab where the row data is not needed —
// avoids hydrating the answers JSONB just to render a counter.
export async function countEditsByGroup(filters: {
  eventId: number
  formId: string
  groupId: string
}): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(submissionEdits)
    .innerJoin(submissions, eq(submissions.id, submissionEdits.submissionId))
    .innerJoin(transactions, eq(transactions.id, submissions.transactionId))
    .where(
      and(
        eq(transactions.eventId, filters.eventId),
        eq(submissions.formId, filters.formId),
        eq(submissions.groupId, filters.groupId),
      ),
    )
  return Number(row?.n ?? 0)
}

export async function countConfirmed(): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(submissions)
    .innerJoin(transactions, eq(transactions.id, submissions.transactionId))
    .where(eq(transactions.status, "confirmed"))
  return Number(row?.n ?? 0)
}

export type TopForm = {
  formId: string
  title: string
  confirmed: number
  total: number
}

export async function topFormsConfirmed(limit = 5): Promise<TopForm[]> {
  const rows = await db
    .select({
      formId: submissions.formId,
      title: forms.title,
      confirmed: CONFIRMED_FILTER,
      total: TOTAL_FILTER,
    })
    .from(submissions)
    .innerJoin(transactions, eq(transactions.id, submissions.transactionId))
    .innerJoin(forms, eq(forms.id, submissions.formId))
    .groupBy(submissions.formId, forms.title)
    .orderBy(desc(CONFIRMED_FILTER))
    .limit(limit)
  return rows.map((r) => ({
    formId: r.formId,
    title: r.title,
    confirmed: Number(r.confirmed),
    total: Number(r.total),
  }))
}
