import { eq } from "drizzle-orm"

import { DomainError } from "@/lib/errors"
import { db } from "@/lib/db"
import {
  submissionEdits,
  submissions as submissionsTable,
  transactions,
} from "@/lib/db/schema"
import {
  answersSchemaForGroup,
  groupHasRequiredQuestion,
  renderLabel,
} from "@/lib/form-schema"
import type { FormDefinition, FormGroup, ItemSnapshot } from "@/lib/db/schema"
import { findPublished, getVersion } from "@/modules/forms"
import { generateId } from "@/modules/transactions"

import * as repo from "./repository"
import type {
  Submission,
  SubmissionInput,
  SubmitContext,
  ValidationError,
} from "./types"

type PublishedEntry = {
  definition: FormDefinition
  version: number
}

export async function submitBatch(input: {
  context: SubmitContext
  submissions: SubmissionInput[]
}): Promise<{ transactionId: string; submissions: Submission[] }> {
  const { context } = input
  const itemsByUuid = new Map(context.items.map((it) => [it.uuid, it]))

  const formIds = [...new Set(input.submissions.map((s) => s.formId))]
  const cache = new Map<string, PublishedEntry>()
  const published = await Promise.all(formIds.map((id) => findPublished(id)))
  formIds.forEach((id, i) => {
    const p = published[i]
    if (!p) {
      throw new DomainError(
        "invalid_payload",
        `form '${id}' is not published or not enabled`,
      )
    }
    cache.set(id, {
      definition: p.version.definition,
      version: p.version.version,
    })
  })

  const errors: ValidationError[] = []
  const validated: {
    input: SubmissionInput
    group: FormGroup
    version: number
    answers: Record<string, unknown>
    item: ItemSnapshot | null
  }[] = []

  for (const s of input.submissions) {
    const entry = cache.get(s.formId)!
    const group = entry.definition.groups.find((g) => g.id === s.groupId)
    if (!group) {
      errors.push({
        formId: s.formId,
        groupId: s.groupId,
        code: "unknown_group",
        message: `group '${s.groupId}' not in form '${s.formId}'`,
      })
      continue
    }
    if (group.scope !== s.scope) {
      errors.push({
        formId: s.formId,
        groupId: s.groupId,
        code: "scope_mismatch",
        message: `group '${s.groupId}' scope is ${group.scope}, got ${s.scope}`,
      })
      continue
    }

    let item: ItemSnapshot | null = null
    if (group.scope === "item") {
      if (!s.itemUuid) {
        errors.push({
          formId: s.formId,
          groupId: s.groupId,
          code: "missing_item_uuid",
          message: `scope=item submissions require itemUuid`,
        })
        continue
      }
      item = itemsByUuid.get(s.itemUuid) ?? null
      if (!item) {
        errors.push({
          formId: s.formId,
          groupId: s.groupId,
          itemUuid: s.itemUuid,
          code: "unknown_item_uuid",
          message: `itemUuid '${s.itemUuid}' not in context.items`,
        })
        continue
      }
    }

    const parsed = answersSchemaForGroup(group).safeParse(s.answers)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push({
          formId: s.formId,
          groupId: s.groupId,
          itemUuid: s.itemUuid ?? undefined,
          questionId:
            typeof issue.path[0] === "string" ? issue.path[0] : undefined,
          code: issue.code,
          message: issue.message,
        })
      }
      continue
    }

    validated.push({
      input: s,
      group,
      version: entry.version,
      answers: parsed.data as Record<string, unknown>,
      item,
    })
  }

  // Completion gate: a group with at least one required question must have
  // a submission per item (scope=item) or exactly one (scope=transaction).
  const seen = new Map<string, Set<string>>()
  for (const v of validated) {
    const key = `${v.input.formId}|${v.input.groupId}`
    if (!seen.has(key)) seen.set(key, new Set())
    seen.get(key)!.add(v.input.itemUuid ?? "")
  }

  for (const [formId, entry] of cache.entries()) {
    for (const group of entry.definition.groups) {
      if (!groupHasRequiredQuestion(group)) continue
      const key = `${formId}|${group.id}`
      const got = seen.get(key) ?? new Set<string>()
      if (group.scope === "transaction") {
        if (got.size === 0) {
          errors.push({
            formId,
            groupId: group.id,
            code: "missing_transaction_submission",
            message: `required transaction group '${group.id}' missing`,
          })
        } else if (got.size > 1) {
          errors.push({
            formId,
            groupId: group.id,
            code: "duplicate_transaction_submission",
            message: `transaction group '${group.id}' must have exactly one submission`,
          })
        }
      } else {
        for (const it of context.items) {
          if (!got.has(it.uuid)) {
            errors.push({
              formId,
              groupId: group.id,
              itemUuid: it.uuid,
              code: "missing_item_submission",
              message: `required item group '${group.id}' missing for item ${it.uuid}`,
            })
          }
        }
      }
    }
  }

  if (errors.length > 0) {
    throw new DomainError(
      "invalid_payload",
      "Hay respuestas inválidas en el formulario",
      { errors },
    )
  }

  const transactionId = generateId()
  const rows = validated.map((v) => ({
    formId: v.input.formId,
    groupId: v.input.groupId,
    formVersion: v.version,
    transactionId,
    scope: v.group.scope,
    itemUuid: v.item?.uuid ?? null,
    itemSnapshot: v.item,
    holderFirstName: v.item?.holder?.firstName ?? null,
    holderLastName: v.item?.holder?.lastName ?? null,
    holderDocument: v.item?.holder?.documentNumber ?? null,
    answers: v.answers,
    computedLabel: renderLabel(v.group, {
      answers: v.answers,
      item: v.item,
      user: context.user ?? null,
    }),
  }))

  // Atomic: orphan transaction row would leak into /state and cron expiry.
  const inserted = await db.transaction(async (tx) => {
    await tx.insert(transactions).values({
      id: transactionId,
      status: "valid",
      currency: context.currency,
      eventId: context.eventId,
      eventName: context.eventName,
      locale: context.locale ?? null,
      userSnapshot: context.user ?? null,
      buyerEmail: context.user?.email ?? null,
      buyerFirstName: context.user?.firstName ?? null,
      buyerLastName: context.user?.lastName ?? null,
    })
    if (rows.length === 0) return []
    return tx.insert(submissionsTable).values(rows).returning()
  })

  return { transactionId, submissions: inserted }
}

export async function editSubmission(input: {
  submissionId: string
  editedBy: string
  answers: Record<string, unknown>
  reason?: string | null
}): Promise<Submission> {
  const current = await repo.findById(input.submissionId)
  if (!current) {
    throw new DomainError("not_found", `submission '${input.submissionId}' not found`)
  }

  const version = await getVersion(current.formId, current.formVersion)
  if (!version) {
    throw new DomainError(
      "internal_error",
      `form version ${current.formId}@${current.formVersion} not found`,
    )
  }
  const group = version.definition.groups.find((g) => g.id === current.groupId)
  if (!group) {
    throw new DomainError(
      "internal_error",
      `group '${current.groupId}' missing in form_version`,
    )
  }

  const parsed = answersSchemaForGroup(group).safeParse(input.answers)
  if (!parsed.success) {
    const errors: ValidationError[] = parsed.error.issues.map((issue) => ({
      formId: current.formId,
      groupId: current.groupId,
      itemUuid: current.itemUuid ?? undefined,
      questionId:
        typeof issue.path[0] === "string" ? issue.path[0] : undefined,
      code: issue.code,
      message: issue.message,
    }))
    throw new DomainError(
      "invalid_payload",
      "Hay respuestas inválidas",
      { errors },
    )
  }

  const answers = parsed.data as Record<string, unknown>
  const computedLabel = renderLabel(group, {
    answers,
    item: current.itemSnapshot ?? null,
    user: null,
  })

  return db.transaction(async (tx) => {
    await tx.insert(submissionEdits).values({
      submissionId: current.id,
      editedBy: input.editedBy,
      reason: input.reason ?? null,
      answersBefore: current.answers,
      answersAfter: answers,
    })
    const [updated] = await tx
      .update(submissionsTable)
      .set({ answers, computedLabel, editedAt: new Date() })
      .where(eq(submissionsTable.id, current.id))
      .returning()
    if (!updated) {
      throw new DomainError("internal_error", "submission update failed")
    }
    return updated
  })
}

export const groupedByEventFormGroup = repo.groupedByEventFormGroup
export const drilldown = repo.drilldown
export const countDrilldown = repo.countDrilldown
export const exportAll = repo.exportAll
export const listByTransaction = repo.listByTransaction
export const findById = repo.findById
export const listEdits = repo.listEdits
export const countConfirmed = repo.countConfirmed
export const topFormsConfirmed = repo.topFormsConfirmed
export const listEditsByGroup = repo.listEditsByGroup
export const countEditsByGroup = repo.countEditsByGroup
export const drilldownByForm = repo.drilldownByForm
export const listEditsByForm = repo.listEditsByForm
export const eventsForForm = repo.eventsForForm
