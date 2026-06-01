import type { FormQuestion } from "@/lib/db/schema"

import type { IframeContext, ItemContext, PublishedForm, UserContext, WizardStep } from "./types"

export function buildSteps(
  forms: PublishedForm[],
  items: ItemContext[],
): WizardStep[] {
  const steps: WizardStep[] = []

  for (const form of forms) {
    for (const group of form.definition.groups) {
      if (group.scope === "transaction") {
        steps.push({
          kind: "group",
          stepId: `${form.id}::${group.id}`,
          formId: form.id,
          formVersion: form.version,
          group,
          item: null,
        })
      } else {
        items.forEach((item, idx) => {
          steps.push({
            kind: "group",
            stepId: `${form.id}::${group.id}::${item.uuid}`,
            formId: form.id,
            formVersion: form.version,
            group,
            item,
            itemIndex: idx + 1,
            itemTotal: items.length,
          })
        })
      }
    }
  }

  // Skip the summary step when there's only a single group — the user already
  // sees all their answers on that one page, so a review screen is just an
  // extra click with nothing new to show.
  if (steps.length > 1) {
    steps.push({ kind: "confirm", stepId: "confirm" })
  }

  return steps
}

export function prefillAnswers(
  step: Extract<WizardStep, { kind: "group" }>,
  user: UserContext | null | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const q of step.group.questions) {
    const value = resolvePrefill(q, step.item, user ?? null)
    if (value !== undefined) out[q.id] = value
  }
  return out
}

function resolvePrefill(
  question: FormQuestion,
  item: ItemContext | null,
  user: UserContext | null,
): unknown {
  if (!question.prefillFrom) return undefined
  const path = question.prefillFrom
  if (path.startsWith("item.holder.")) {
    if (!item?.holder) return undefined
    const key = path.slice("item.holder.".length) as keyof NonNullable<
      ItemContext["holder"]
    >
    return item.holder[key]
  }
  if (path.startsWith("user.")) {
    if (!user) return undefined
    const key = path.slice("user.".length) as keyof UserContext
    return user[key]
  }
  return undefined
}

export function validateContextShape(ctx: unknown): ctx is IframeContext {
  if (!ctx || typeof ctx !== "object") return false
  const c = ctx as Record<string, unknown>
  if (typeof c.currency !== "string" || !c.currency) return false
  const info = c.eventInfo as Record<string, unknown> | undefined
  if (!info || typeof info.id !== "number") return false
  if (!Array.isArray(c.items)) return false
  return true
}

export function onlyItemScoped(forms: PublishedForm[]): boolean {
  return (
    forms.length > 0 &&
    forms.every((f) => f.definition.groups.every((g) => g.scope === "item"))
  )
}

export function emptyReason(
  forms: PublishedForm[],
  items: ItemContext[],
): "no_items" | "no_steps" {
  return items.length === 0 && onlyItemScoped(forms) ? "no_items" : "no_steps"
}
