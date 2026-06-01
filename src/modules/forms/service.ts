import { DomainError } from "@/lib/errors"
import { emptyDefinition, parseFormDefinition } from "@/lib/form-schema"

import * as repo from "./repository"
import type {
  CreateFormInput,
  Form,
  FormListItem,
  UpdateFormInput,
} from "./types"

export const FORM_ID_PATTERN = /^[a-z][a-z0-9-]{1,63}$/

export async function listForms(
  filters?: repo.FormListFilters,
): Promise<FormListItem[]> {
  return repo.listForListView(filters)
}

export async function countForms(
  filters?: Omit<repo.FormListFilters, "limit" | "offset">,
): Promise<number> {
  return repo.countForListView(filters)
}

export async function getForm(id: string): Promise<Form> {
  const form = await repo.findById(id)
  if (!form) throw new DomainError("not_found", `form '${id}' not found`)
  return form
}

export async function findForm(id: string): Promise<Form | null> {
  return repo.findById(id)
}

export async function getFormsByIds(ids: string[]): Promise<Form[]> {
  return repo.findManyByIds(ids)
}

export async function createForm(input: CreateFormInput): Promise<Form> {
  const title = input.title.trim()
  let id: string
  if (input.id) {
    if (!FORM_ID_PATTERN.test(input.id)) {
      throw new DomainError(
        "invalid_payload",
        "id must be slug-like: lowercase, digits, hyphens, 2–64 chars",
      )
    }
    const existing = await repo.findById(input.id)
    if (existing) {
      throw new DomainError(
        "invalid_payload",
        `form '${input.id}' already exists`,
      )
    }
    id = input.id
  } else {
    id = await generateUniqueSlug(title)
  }
  const definition = parseFormDefinition(input.definition ?? emptyDefinition())
  return repo.insert({
    id,
    title,
    definition,
  })
}

function slugify(value: string): string {
  const base = value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 56)
  const withLetter = /^[a-z]/.test(base) ? base : `form-${base}`.slice(0, 56)
  const trimmed = withLetter.replace(/-+$/g, "")
  return trimmed.length >= 2 ? trimmed : "form"
}

async function generateUniqueSlug(title: string): Promise<string> {
  const base = slugify(title)
  if (!(await repo.findById(base))) return base
  for (let i = 0; i < 5; i++) {
    const suffix = Math.random().toString(36).slice(2, 8)
    const candidate = `${base}-${suffix}`.slice(0, 64)
    if (!(await repo.findById(candidate))) return candidate
  }
  throw new DomainError(
    "invalid_payload",
    "no fue posible generar un slug único, probá con otro título",
  )
}

export async function updateForm(
  id: string,
  patch: UpdateFormInput,
): Promise<Form> {
  const next = await repo.update(id, patch)
  if (!next) throw new DomainError("not_found", `form '${id}' not found`)
  return next
}

export async function deleteForm(id: string): Promise<void> {
  await repo.deleteById(id)
}

export async function publishForm(id: string): Promise<{
  form: Form
  version: number
}> {
  const form = await getForm(id)
  const version = await repo.nextVersion(id)
  await repo.insertVersion({
    formId: id,
    version,
    definition: form.definition,
  })
  const updated = await repo.update(id, { publishedAt: new Date() })
  if (!updated) throw new DomainError("not_found", `form '${id}' not found`)
  return { form: updated, version }
}

export async function findPublished(id: string) {
  return repo.findPublished(id)
}

export async function findLatest(id: string) {
  return repo.findLatest(id)
}

export async function getAllowedOriginsByForm(ids: string[]) {
  return repo.selectAllowedOriginsByForm(ids)
}

export async function listVersions(formId: string) {
  return repo.listVersions(formId)
}

export async function getVersion(formId: string, version: number) {
  const row = await repo.findVersion(formId, version)
  if (!row) {
    throw new DomainError(
      "not_found",
      `version v${version} not found for form '${formId}'`,
    )
  }
  return row
}
