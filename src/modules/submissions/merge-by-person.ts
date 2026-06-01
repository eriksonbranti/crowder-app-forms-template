import type { FormQuestion, TransactionStatus } from "@/lib/db/schema"

import type { DrilldownRow } from "./repository"

// Canonical strings the publisher uses for `FormQuestion.prefillFrom`.
export type PrefillPath = NonNullable<FormQuestion["prefillFrom"]>

export type PersonRow = {
  key: string
  transactionId: string
  transactionStatus: TransactionStatus
  eventId: number
  eventName: string
  lastActivity: Date
  edited: boolean
  hasItem: boolean
  holderName: string | null
  holderDocument: string | null
  sectorRate: string | null
  buyerName: string | null
  buyerEmail: string | null
  answers: Record<string, unknown>
  // The Crowder-context values keyed by `prefillFrom`, captured from the
  // item/user snapshots at submit time. Empty/missing when the snapshot didn't
  // carry that path. Consumers compare answers against these to tell apart
  // "auto" values from values the user edited.
  context: Partial<Record<PrefillPath, string>>
  // submissionId per question id, so consumers know which submission to edit
  // when the user clicks a cell or the row's edit button.
  submissionByQuestion: Map<string, string>
}

// Merge raw submissions into one row per person (transactionId + itemUuid).
// Transaction-scope submissions (itemUuid=null) propagate onto every item row
// of the same transaction so the buyer's tx-level answers show up alongside
// the holder's item-level answers. Standalone tx-scope rows still appear when
// no item submissions exist for that transaction.
function userContextFrom(r: DrilldownRow): Partial<Record<PrefillPath, string>> {
  const ctx: Partial<Record<PrefillPath, string>> = {}
  if (r.userEmail) ctx["user.email"] = r.userEmail
  if (r.userFirstName) ctx["user.firstName"] = r.userFirstName
  if (r.userLastName) ctx["user.lastName"] = r.userLastName
  if (r.userCountry) ctx["user.country"] = r.userCountry
  return ctx
}

export function mergeByPerson(rows: DrilldownRow[]): PersonRow[] {
  const txItemRows = new Map<string, PersonRow>()
  const txAnswers = new Map<
    string,
    {
      answers: Record<string, unknown>
      submissionByQuestion: Map<string, string>
      lastActivity: Date
      edited: boolean
      status: TransactionStatus
      eventId: number
      eventName: string
      buyerName: string | null
      buyerEmail: string | null
      transactionId: string
      context: Partial<Record<PrefillPath, string>>
    }
  >()

  for (const r of rows) {
    const s = r.submission
    const buyerName =
      r.userFirstName || r.userLastName
        ? `${r.userFirstName ?? ""} ${r.userLastName ?? ""}`.trim()
        : null

    if (s.itemUuid) {
      const key = `${s.transactionId}|${s.itemUuid}`
      const snap = s.itemSnapshot
      const holderName = snap?.holder
        ? `${snap.holder.firstName} ${snap.holder.lastName}`.trim()
        : null
      const holderDoc = snap?.holder
        ? `${snap.holder.documentType} ${snap.holder.documentNumber}`
        : null
      const sectorRate = snap ? `${snap.sectorName} · ${snap.rateName}` : null

      let person = txItemRows.get(key)
      if (!person) {
        const context: Partial<Record<PrefillPath, string>> = userContextFrom(r)
        if (snap?.holder) {
          context["item.holder.firstName"] = snap.holder.firstName
          context["item.holder.lastName"] = snap.holder.lastName
          context["item.holder.documentType"] = snap.holder.documentType
          context["item.holder.documentNumber"] = snap.holder.documentNumber
        }
        person = {
          key,
          transactionId: s.transactionId,
          transactionStatus: r.transactionStatus,
          eventId: r.eventId,
          eventName: r.eventName,
          lastActivity: s.createdAt,
          edited: !!s.editedAt,
          hasItem: true,
          holderName,
          holderDocument: holderDoc,
          sectorRate,
          buyerName,
          buyerEmail: r.userEmail,
          answers: {},
          context,
          submissionByQuestion: new Map(),
        }
        txItemRows.set(key, person)
      }
      Object.assign(person.answers, s.answers)
      for (const qid of Object.keys(s.answers)) {
        person.submissionByQuestion.set(qid, s.id)
      }
      if (s.editedAt) person.edited = true
      if (s.createdAt > person.lastActivity) person.lastActivity = s.createdAt
    } else {
      const existing = txAnswers.get(s.transactionId)
      if (!existing) {
        txAnswers.set(s.transactionId, {
          answers: { ...s.answers },
          submissionByQuestion: new Map(
            Object.keys(s.answers).map((qid) => [qid, s.id]),
          ),
          lastActivity: s.createdAt,
          edited: !!s.editedAt,
          status: r.transactionStatus,
          eventId: r.eventId,
          eventName: r.eventName,
          buyerName,
          buyerEmail: r.userEmail,
          transactionId: s.transactionId,
          context: userContextFrom(r),
        })
      } else {
        Object.assign(existing.answers, s.answers)
        for (const qid of Object.keys(s.answers)) {
          existing.submissionByQuestion.set(qid, s.id)
        }
        if (s.editedAt) existing.edited = true
        if (s.createdAt > existing.lastActivity) existing.lastActivity = s.createdAt
      }
    }
  }

  // Propagate tx-scope answers onto every item row of the same transaction.
  for (const person of txItemRows.values()) {
    const tx = txAnswers.get(person.transactionId)
    if (!tx) continue
    for (const [qid, value] of Object.entries(tx.answers)) {
      if (!(qid in person.answers)) {
        person.answers[qid] = value
        const sid = tx.submissionByQuestion.get(qid)
        if (sid) person.submissionByQuestion.set(qid, sid)
      }
    }
    if (tx.edited) person.edited = true
    if (tx.lastActivity > person.lastActivity) person.lastActivity = tx.lastActivity
  }

  // Standalone tx-only rows: transactions that have no item submissions.
  const standaloneTx: PersonRow[] = []
  const txWithItems = new Set(
    [...txItemRows.values()].map((p) => p.transactionId),
  )
  for (const tx of txAnswers.values()) {
    if (txWithItems.has(tx.transactionId)) continue
    standaloneTx.push({
      key: `${tx.transactionId}|`,
      transactionId: tx.transactionId,
      transactionStatus: tx.status,
      eventId: tx.eventId,
      eventName: tx.eventName,
      lastActivity: tx.lastActivity,
      edited: tx.edited,
      hasItem: false,
      holderName: null,
      holderDocument: null,
      sectorRate: null,
      buyerName: tx.buyerName,
      buyerEmail: tx.buyerEmail,
      answers: tx.answers,
      context: tx.context,
      submissionByQuestion: tx.submissionByQuestion,
    })
  }

  const all = [...txItemRows.values(), ...standaloneTx]
  all.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime())
  return all
}
