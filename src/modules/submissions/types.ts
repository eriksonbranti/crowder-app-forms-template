import type { InferSelectModel } from "drizzle-orm"

import type {
  submissions,
  GroupScope,
  ItemSnapshot,
  UserSnapshot,
} from "@/lib/db/schema"

export type Submission = InferSelectModel<typeof submissions>
export type { GroupScope, ItemSnapshot, UserSnapshot }

export type SubmitContext = {
  eventId: number
  eventName: string
  currency: string
  locale?: string
  user?: UserSnapshot | null
  items: ItemSnapshot[]
}

export type SubmissionInput = {
  formId: string
  groupId: string
  scope: GroupScope
  itemUuid?: string | null
  answers: Record<string, unknown>
}

export type ValidationError = {
  formId: string
  groupId: string
  itemUuid?: string
  questionId?: string
  code: string
  message: string
}
