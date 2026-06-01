import type { FormDefinition } from "@/lib/db/schema"

export type PublishDisabledReason =
  | "Guardá los cambios antes de publicar."
  | "Ya está publicada la última versión."

export function derivePublishDisabledReason(input: {
  dirty: boolean
  definition: FormDefinition
  lastVersion: { definition: FormDefinition } | null | undefined
}): PublishDisabledReason | null {
  if (input.dirty) return "Guardá los cambios antes de publicar."
  if (
    input.lastVersion &&
    JSON.stringify(input.definition) ===
      JSON.stringify(input.lastVersion.definition)
  ) {
    return "Ya está publicada la última versión."
  }
  return null
}
