import { and, desc, eq, inArray, max, sql } from "drizzle-orm"

import { db } from "@/lib/db"
import {
  forms,
  formVersions,
  type FormDefinition,
  type FormTheme,
} from "@/lib/db/schema"

import type { Form, FormVersion } from "./types"

export async function listAll(): Promise<Form[]> {
  return db.select().from(forms).orderBy(desc(forms.updatedAt))
}

// Avoids hydrating the full `definition` JSONB for every row — the list view
// only needs group counts.
export type FormListRow = {
  id: string
  title: string
  enabled: boolean
  publishedAt: Date | null
  updatedAt: Date
  groupCount: number
  transactionGroupCount: number
  itemGroupCount: number
}

export type FormListFilters = {
  search?: string
  status?: "published" | "draft" | "archived"
  limit?: number
  offset?: number
}

export type FormListStatus = NonNullable<FormListFilters["status"]>

function buildFormListWhere(filters: FormListFilters) {
  const conds = []
  if (filters.search) {
    const like = `%${filters.search}%`
    conds.push(sql`(f.title ilike ${like} or f.id ilike ${like})`)
  }
  switch (filters.status) {
    case "published":
      conds.push(sql`f.enabled = true and f.published_at is not null`)
      break
    case "draft":
      conds.push(sql`f.enabled = true and f.published_at is null`)
      break
    case "archived":
      conds.push(sql`f.enabled = false`)
      break
  }
  const where = conds.length ? and(...conds) : undefined
  return where ? sql`where ${where}` : sql``
}

export async function listForListView(
  filters: FormListFilters = {},
): Promise<FormListRow[]> {
  const where = buildFormListWhere(filters)
  const limit = filters.limit ?? 50
  const offset = filters.offset ?? 0
  const rows = await db.execute(sql`
    select
      f.id,
      f.title,
      f.enabled,
      f.published_at,
      f.updated_at,
      coalesce(counts.group_count, 0)::int as group_count,
      coalesce(counts.transaction_group_count, 0)::int as transaction_group_count,
      coalesce(counts.item_group_count, 0)::int as item_group_count
    from ${forms} f
    left join lateral (
      select
        count(*) as group_count,
        count(*) filter (where g->>'scope' = 'transaction') as transaction_group_count,
        count(*) filter (where g->>'scope' = 'item') as item_group_count
      from jsonb_array_elements(f.definition -> 'groups') g
    ) counts on true
    ${where}
    order by f.updated_at desc
    limit ${limit} offset ${offset}
  `)
  return (rows as unknown as Array<{
    id: string
    title: string
    enabled: boolean
    published_at: Date | null
    updated_at: Date
    group_count: number
    transaction_group_count: number
    item_group_count: number
  }>).map((r) => ({
    id: r.id,
    title: r.title,
    enabled: r.enabled,
    publishedAt: r.published_at,
    updatedAt: r.updated_at,
    groupCount: Number(r.group_count),
    transactionGroupCount: Number(r.transaction_group_count),
    itemGroupCount: Number(r.item_group_count),
  }))
}

export async function countForListView(
  filters: Omit<FormListFilters, "limit" | "offset"> = {},
): Promise<number> {
  const where = buildFormListWhere(filters)
  const result = await db.execute(sql`
    select count(*)::int as n from ${forms} f ${where}
  `)
  const [row] = result as unknown as Array<{ n: number }>
  return Number(row?.n ?? 0)
}

export async function findById(id: string): Promise<Form | null> {
  const [row] = await db.select().from(forms).where(eq(forms.id, id)).limit(1)
  return row ?? null
}

export async function findManyByIds(ids: string[]): Promise<Form[]> {
  if (ids.length === 0) return []
  return db.select().from(forms).where(inArray(forms.id, ids))
}

// Devuelve los allowed_origins de los forms indicados (sin aplanar, para poder
// aplicar el fallback global por form) evitando traer la columna `definition`
// (jsonb potencialmente grande).
export async function selectAllowedOriginsByForm(
  ids: string[],
): Promise<string[][]> {
  if (ids.length === 0) return []
  const rows = await db
    .select({ allowedOrigins: forms.allowedOrigins })
    .from(forms)
    .where(inArray(forms.id, ids))
  return rows.map((r) => r.allowedOrigins)
}

export async function findPublished(id: string): Promise<{
  form: Form
  version: FormVersion
} | null> {
  const form = await findById(id)
  if (!form || !form.enabled || !form.publishedAt) return null
  const [version] = await db
    .select()
    .from(formVersions)
    .where(eq(formVersions.formId, id))
    .orderBy(desc(formVersions.version))
    .limit(1)
  if (!version) return null
  return { form, version }
}

export async function insert(input: {
  id: string
  title: string
  definition: FormDefinition
}): Promise<Form> {
  const [row] = await db
    .insert(forms)
    .values({
      id: input.id,
      title: input.title,
      definition: input.definition,
      enabled: true,
    })
    .returning()
  return row
}

export async function update(
  id: string,
  patch: Partial<{
    title: string
    enabled: boolean
    definition: FormDefinition
    publishedAt: Date
    allowedOrigins: string[]
    theme: FormTheme | null
  }>,
): Promise<Form | null> {
  const [row] = await db
    .update(forms)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(forms.id, id))
    .returning()
  return row ?? null
}

export async function deleteById(id: string): Promise<void> {
  await db.delete(forms).where(eq(forms.id, id))
}

export async function nextVersion(formId: string): Promise<number> {
  const [row] = await db
    .select({ v: max(formVersions.version) })
    .from(formVersions)
    .where(eq(formVersions.formId, formId))
  return (row?.v ?? 0) + 1
}

export async function insertVersion(input: {
  formId: string
  version: number
  definition: FormDefinition
}): Promise<FormVersion> {
  const [row] = await db
    .insert(formVersions)
    .values({
      formId: input.formId,
      version: input.version,
      definition: input.definition,
    })
    .returning()
  return row
}

// Like findPublished, but doesn't require enabled+publishedAt. Used by the
// submissions report so admins can inspect responses for drafts/archived forms
// (the form may have been unpublished after responses came in).
export async function findLatest(id: string): Promise<{
  form: Form
  version: FormVersion
} | null> {
  const form = await findById(id)
  if (!form) return null
  const [version] = await db
    .select()
    .from(formVersions)
    .where(eq(formVersions.formId, id))
    .orderBy(desc(formVersions.version))
    .limit(1)
  if (!version) return null
  return { form, version }
}

export async function listVersions(formId: string): Promise<FormVersion[]> {
  return db
    .select()
    .from(formVersions)
    .where(eq(formVersions.formId, formId))
    .orderBy(desc(formVersions.version))
}

export async function findVersion(
  formId: string,
  version: number,
): Promise<FormVersion | null> {
  const [row] = await db
    .select()
    .from(formVersions)
    .where(
      and(eq(formVersions.formId, formId), eq(formVersions.version, version)),
    )
    .limit(1)
  return row ?? null
}
