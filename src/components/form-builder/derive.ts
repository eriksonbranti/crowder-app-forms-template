import type { FormGroup, FormQuestion } from "@/lib/db/schema"

export function toSnake(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/^[0-9]/, "_$&") || "item"
  )
}

export function uniqueId(base: string, taken: Set<string>): string {
  let id = base
  let i = 2
  while (taken.has(id)) {
    id = `${base}_${i++}`
  }
  return id
}

export function deriveId(text: string, fallback: string, taken: Set<string>): string {
  const base = toSnake(text || fallback) || fallback
  return uniqueId(base, taken)
}

export function newQuestion(taken: Set<string>, label = "Nueva pregunta"): FormQuestion {
  return {
    id: deriveId(label, "pregunta", taken),
    type: "short_text",
    label,
    help: null,
    required: false,
    placeholder: null,
  }
}

export function newGroup(taken: Set<string>, title = "Nuevo grupo"): FormGroup {
  return {
    id: deriveId(title, "grupo", taken),
    title,
    description: null,
    scope: "transaction",
    labelTemplate: title,
    questions: [newQuestion(new Set())],
  }
}
