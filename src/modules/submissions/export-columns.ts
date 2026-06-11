import type {
  FormDefinition,
  FormGroup,
  FormQuestion,
  TransactionStatus,
} from "@/lib/db/schema"
import type {
  ExportCell,
  ExportColumn,
  ExportTable,
} from "@/lib/export-table"

import { PRESET_FIELDS, type ExportPreset } from "./export-presets"
import type { PersonRow } from "./merge-by-person"
import type { Submission } from "./types"

// The common shape both export levels can provide. Optional fields are
// populated by whichever level has them (e.g. only export-all carries the
// transaction's event id/name); each id column falls back to empty otherwise.
export type ExportSourceRow = {
  submission: Submission
  transactionStatus: TransactionStatus
  transactionCreatedAt: Date
  transactionPurchaseId?: number | null
  transactionEventId?: number
  transactionEventName?: string | null
  transactionCurrency?: string | null
  transactionLocale?: string | null
  userEmail?: string | null
  userFirstName?: string | null
  userLastName?: string | null
  userCountry?: string | null
}

// Keyed by header; `idColumnsFor` attaches the header from the record key so it
// is never repeated in each entry.
type IdColumnDef = {
  type?: "text" | "number"
  value: (r: ExportSourceRow) => ExportCell
}
type IdColumn = IdColumnDef & { header: string }

function holderDocument(s: Submission): string {
  const h = s.itemSnapshot?.holder
  return h ? `${h.documentType} ${h.documentNumber}` : ""
}

function answerCell(value: unknown): ExportCell {
  if (value == null) return ""
  if (Array.isArray(value)) return value.join("; ")
  return String(value)
}

// Canonical identity columns, shared verbatim by both levels so naming and
// formatting (holder document, ISO dates, …) never drift between exports.
const ID_COLUMNS: Record<string, IdColumnDef> = {
  "transaction.id": { value: (r) => r.submission.transactionId },
  "transaction.purchase_id": {
    type: "number",
    value: (r) => r.transactionPurchaseId ?? "",
  },
  "transaction.status": { value: (r) => r.transactionStatus },
  "transaction.event_id": {
    type: "number",
    value: (r) => r.transactionEventId ?? "",
  },
  "transaction.event_name": { value: (r) => r.transactionEventName ?? "" },
  "transaction.currency": { value: (r) => r.transactionCurrency ?? "" },
  "transaction.locale": { value: (r) => r.transactionLocale ?? "" },
  "transaction.created_at": {
    value: (r) => r.transactionCreatedAt.toISOString(),
  },
  "submission.id": { value: (r) => r.submission.id },
  "submission.form_id": { value: (r) => r.submission.formId },
  "submission.form_version": {
    type: "number",
    value: (r) => r.submission.formVersion,
  },
  "submission.group_id": { value: (r) => r.submission.groupId },
  "submission.scope": { value: (r) => r.submission.scope },
  "submission.created_at": {
    value: (r) => r.submission.createdAt.toISOString(),
  },
  "submission.edited_at": {
    value: (r) => (r.submission.editedAt ? r.submission.editedAt.toISOString() : ""),
  },
  "user.email": { value: (r) => r.userEmail ?? "" },
  "user.first_name": { value: (r) => r.userFirstName ?? "" },
  "user.last_name": { value: (r) => r.userLastName ?? "" },
  "user.country": { value: (r) => r.userCountry ?? "" },
  "item.uuid": {
    value: (r) => r.submission.itemSnapshot?.uuid ?? r.submission.itemUuid ?? "",
  },
  "item.holder_first_name": {
    value: (r) => r.submission.itemSnapshot?.holder?.firstName ?? "",
  },
  "item.holder_last_name": {
    value: (r) => r.submission.itemSnapshot?.holder?.lastName ?? "",
  },
  "item.holder_document": { value: (r) => holderDocument(r.submission) },
  "item.sector_name": {
    value: (r) => r.submission.itemSnapshot?.sectorName ?? "",
  },
  "item.rate_name": {
    value: (r) => r.submission.itemSnapshot?.rateName ?? "",
  },
}

// Identity columns per level. Group exports are scope-specific and lean; the
// "export all" level carries the full transaction/submission/item context.
type IdColumnName = keyof typeof ID_COLUMNS

const GROUP_ITEM_ID_COLS: IdColumnName[] = [
  "transaction.id",
  "transaction.purchase_id",
  "item.uuid",
  "item.holder_first_name",
  "item.holder_last_name",
  "item.holder_document",
  "item.sector_name",
  "item.rate_name",
  "user.email",
  "user.first_name",
  "user.last_name",
  "user.country",
]
const GROUP_TX_ID_COLS: IdColumnName[] = [
  "transaction.id",
  "transaction.purchase_id",
  "item.uuid",
  "user.email",
  "user.first_name",
  "user.last_name",
  "user.country",
]
const ALL_ID_COLS: IdColumnName[] = [
  "transaction.id",
  "transaction.purchase_id",
  "transaction.status",
  "transaction.event_id",
  "transaction.event_name",
  "transaction.currency",
  "transaction.locale",
  "transaction.created_at",
  "submission.id",
  "submission.form_id",
  "submission.form_version",
  "submission.group_id",
  "submission.scope",
  "submission.created_at",
  "submission.edited_at",
  "user.email",
  "user.first_name",
  "user.last_name",
  "user.country",
  "item.uuid",
  "item.holder_first_name",
  "item.holder_last_name",
  "item.holder_document",
  "item.sector_name",
  "item.rate_name",
]

function idColumnsFor(names: IdColumnName[]): IdColumn[] {
  return names.map((n) => ({ header: n, ...ID_COLUMNS[n] }))
}

// Group drilldown: identity columns chosen by scope, then one column per
// (preset-filtered) question, keyed by question id.
export function buildGroupExportTable(params: {
  rows: ExportSourceRow[]
  group: FormGroup
  preset: ExportPreset
}): ExportTable {
  const { rows, group, preset } = params
  const idCols = idColumnsFor(
    group.scope === "item" ? GROUP_ITEM_ID_COLS : GROUP_TX_ID_COLS,
  )

  let questions = group.questions.filter((q) => q.type !== "info")
  if (preset !== "full") {
    const allowed = new Set(PRESET_FIELDS[preset])
    questions = questions.filter((q) => allowed.has(q.id))
  }

  const columns: ExportColumn[] = [
    ...idCols.map((c) => ({ header: c.header, type: c.type })),
    ...questions.map((q) => ({ header: q.id })),
  ]
  const tableRows = rows.map((r) => [
    ...idCols.map((c) => c.value(r)),
    ...questions.map((q) => answerCell(r.submission.answers[q.id])),
  ])
  return { columns, rows: tableRows }
}

// Export all: full identity columns, then the union of every
// (formId, groupId, questionId) answer column across the referenced versions,
// each namespaced so columns from different forms never collide.
export function buildAllExportTable(params: {
  rows: ExportSourceRow[]
  versions: { formId: string; version: number; definition: FormDefinition }[]
}): ExportTable {
  const { rows, versions } = params
  const idCols = idColumnsFor(ALL_ID_COLS)

  const answerHeaders: string[] = []
  const seen = new Set<string>()
  // Index answer columns by (formId, groupId) so each row fills only its own
  // group's columns instead of scanning the full union (avoids O(rows × cols)).
  const answerColsByGroup = new Map<
    string,
    { index: number; questionId: string }[]
  >()
  const versionsByFormId = new Map<string, typeof versions>()
  for (const v of versions) {
    const list = versionsByFormId.get(v.formId)
    if (list) list.push(v)
    else versionsByFormId.set(v.formId, [v])
  }
  // Deterministic order: by formId, then version, then group/question order.
  const sortedFormIds = [...versionsByFormId.keys()].sort()
  for (const formId of sortedFormIds) {
    const formVersions = versionsByFormId
      .get(formId)!
      .sort((a, b) => a.version - b.version)
    for (const v of formVersions) {
      for (const group of v.definition.groups) {
        const groupKey = `${formId}|${group.id}`
        for (const q of group.questions) {
          if (q.type === "info") continue
          const key = `${groupKey}|${q.id}`
          if (seen.has(key)) continue
          seen.add(key)
          const index = answerHeaders.length
          answerHeaders.push(`${formId}.${group.id}.${q.id}`)
          const list = answerColsByGroup.get(groupKey)
          if (list) list.push({ index, questionId: q.id })
          else answerColsByGroup.set(groupKey, [{ index, questionId: q.id }])
        }
      }
    }
  }

  const columns: ExportColumn[] = [
    ...idCols.map((c) => ({ header: c.header, type: c.type })),
    ...answerHeaders.map((header) => ({ header })),
  ]

  const tableRows = rows.map((r) => {
    const s = r.submission
    const answerValues: ExportCell[] = new Array(answerHeaders.length).fill("")
    const matches = answerColsByGroup.get(`${s.formId}|${s.groupId}`)
    if (matches) {
      for (const { index, questionId } of matches) {
        answerValues[index] = answerCell(s.answers[questionId])
      }
    }
    return [...idCols.map((c) => c.value(r)), ...answerValues]
  })
  return { columns, rows: tableRows }
}

// Per-form export: one row per person (matches the visible table on
// /forms/[id]/submissions). Identity columns reflect what the UI shows;
// answer columns use the question label (one per question across all groups).
export function buildFormExportTable(params: {
  persons: PersonRow[]
  questions: FormQuestion[]
}): ExportTable {
  const { persons, questions } = params

  const columns: ExportColumn[] = [
    { header: "transaction.id" },
    { header: "transaction.purchase_id", type: "number" },
    { header: "transaction.status" },
    { header: "event.id", type: "number" },
    { header: "event.name" },
    { header: "buyer.name" },
    { header: "buyer.email" },
    { header: "holder.name" },
    { header: "holder.document" },
    { header: "item.sector_rate" },
    { header: "last_activity" },
    { header: "edited" },
    ...questions.map((q) => ({ header: q.label })),
  ]

  const rows = persons.map((p) => [
    p.transactionId,
    p.purchaseId ?? "",
    p.transactionStatus,
    p.eventId,
    p.eventName,
    p.buyerName ?? "",
    p.buyerEmail ?? "",
    p.holderName ?? "",
    p.holderDocument ?? "",
    p.sectorRate ?? "",
    p.lastActivity.toISOString(),
    p.edited ? "yes" : "",
    ...questions.map((q) => answerCell(p.answers[q.id])),
  ])

  return { columns, rows }
}
