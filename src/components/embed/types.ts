import type {
  FormDefinition,
  FormGroup,
  ItemSnapshot,
} from "@/lib/db/schema"

export type PublishedForm = {
  id: string
  title: string
  version: number
  definition: FormDefinition
}

export type ItemContext = ItemSnapshot

export type UserContext = {
  email?: string
  firstName?: string
  lastName?: string
  country?: string
}

export type ServerError = {
  formId: string
  groupId: string
  itemUuid?: string
  questionId?: string
  message: string
}

export type IframeContext = {
  locale?: string
  currency: string
  eventInfo: { id: number; name: string; startAt?: string }
  items: ItemContext[]
  user?: UserContext | null
  completion?: { required?: boolean }
}

export type WizardStep =
  | {
      kind: "group"
      stepId: string
      formId: string
      formVersion: number
      group: FormGroup
      item: ItemContext | null
      itemIndex?: number
      itemTotal?: number
    }
  | { kind: "confirm"; stepId: "confirm" }

export type AnswersByStep = Record<string, Record<string, unknown>>

export type ErrorCode =
  | "invalid_context"
  | "unsupported_currency"
  | "internal_error"
