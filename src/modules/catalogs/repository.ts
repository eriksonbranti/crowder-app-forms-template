import { and, asc, eq, inArray, isNull, notInArray, sql, type InferSelectModel } from "drizzle-orm"

import { db } from "@/lib/db"
import {
  catalogs,
  collections,
  products,
  type CatalogSource,
  type ProductOption,
  type ProductStatus,
  type ProductVariant,
  type SyncState,
} from "@/lib/db/schema"

export type Catalog = InferSelectModel<typeof catalogs>
export type Collection = InferSelectModel<typeof collections>
export type Product = InferSelectModel<typeof products>

// ─── catalogs ─────────────────────────────────────────────────────────────

export async function listCatalogs(): Promise<Catalog[]> {
  return db
    .select()
    .from(catalogs)
    .where(isNull(catalogs.deletedAt))
    .orderBy(asc(catalogs.title))
}

export async function getCatalog(id: string): Promise<Catalog | null> {
  const [row] = await db
    .select()
    .from(catalogs)
    .where(and(eq(catalogs.id, id), isNull(catalogs.deletedAt)))
    .limit(1)
  return row ?? null
}

// Existencia por id SIN filtrar soft-deleted (el id es PK/slug): un catálogo
// eliminado sigue ocupando el slug, así que recrearlo colisionaría la fila. Se
// usa para garantizar unicidad al crear. Mismo criterio que collections/forms.
export async function catalogExistsIncludingDeleted(id: string): Promise<boolean> {
  const [row] = await db
    .select({ id: catalogs.id })
    .from(catalogs)
    .where(eq(catalogs.id, id))
    .limit(1)
  return !!row
}

export async function insertCatalog(input: {
  id: string
  title: string
  source: CatalogSource
  credentialId: string | null
  currency: string | null
}): Promise<Catalog> {
  const [row] = await db.insert(catalogs).values(input).returning()
  return row
}

export async function updateCatalog(
  id: string,
  set: Partial<{
    title: string
    currency: string | null
    syncState: SyncState | null
  }>,
): Promise<Catalog | null> {
  const [row] = await db
    .update(catalogs)
    .set({ ...set, updatedAt: new Date() })
    .where(eq(catalogs.id, id))
    .returning()
  return row ?? null
}

export async function deleteCatalog(id: string): Promise<void> {
  // Soft-delete: nunca se borra la fila. El caller (service) bloquea el borrado si
  // el catálogo está referenciado por un form publicado (definition sección 8.5).
  // Cascadeamos el deletedAt a colecciones y productos (la FK onDelete:cascade ya
  // no aplica al no haber DELETE real) para que ningún hijo quede colgando visible.
  // Un único statement con CTEs modificadores: marca productos y colecciones del
  // catálogo y, al final, el catálogo mismo — todo en un solo round-trip.
  const now = new Date()
  await db.execute(sql`
    with del_products as (
      update ${products} set deleted_at = ${now}, updated_at = ${now}
      where ${products.catalogId} = ${id} and ${products.deletedAt} is null
    ),
    del_collections as (
      update ${collections} set deleted_at = ${now}, updated_at = ${now}
      where ${collections.catalogId} = ${id} and ${collections.deletedAt} is null
    )
    update ${catalogs} set deleted_at = ${now}, updated_at = ${now}
    where ${catalogs.id} = ${id} and ${catalogs.deletedAt} is null
  `)
}

// ─── collections ──────────────────────────────────────────────────────────

export async function listCollections(catalogId: string): Promise<Collection[]> {
  return db
    .select()
    .from(collections)
    .where(and(eq(collections.catalogId, catalogId), isNull(collections.deletedAt)))
    .orderBy(asc(collections.position), asc(collections.title))
}

// Colecciones de varios catálogos en una sola query (evita el N+1 al armar el
// picker del builder). Mantiene el mismo orden por catálogo (position, título).
export async function listCollectionsForCatalogs(
  catalogIds: string[],
): Promise<Collection[]> {
  if (catalogIds.length === 0) return []
  return db
    .select()
    .from(collections)
    .where(
      and(
        inArray(collections.catalogId, catalogIds),
        isNull(collections.deletedAt),
      ),
    )
    .orderBy(asc(collections.position), asc(collections.title))
}

export async function getCollection(id: string): Promise<Collection | null> {
  const [row] = await db
    .select()
    .from(collections)
    .where(and(eq(collections.id, id), isNull(collections.deletedAt)))
    .limit(1)
  return row ?? null
}

// Existencia por id SIN filtrar soft-deleted (el id es PK/slug). Ver
// catalogExistsIncludingDeleted: garantiza unicidad de slug al crear.
export async function collectionExistsIncludingDeleted(
  id: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(eq(collections.id, id))
    .limit(1)
  return !!row
}

export async function findCollectionByExternal(
  catalogId: string,
  externalId: string,
): Promise<Collection | null> {
  const [row] = await db
    .select()
    .from(collections)
    .where(
      and(
        eq(collections.catalogId, catalogId),
        eq(collections.externalId, externalId),
      ),
    )
    .limit(1)
  return row ?? null
}

export async function insertCollection(input: {
  id: string
  catalogId: string
  title: string
  externalId: string | null
  position?: number
}): Promise<Collection> {
  const [row] = await db.insert(collections).values(input).returning()
  return row
}

export async function updateCollection(
  id: string,
  set: Partial<{ title: string; position: number }>,
): Promise<Collection | null> {
  const [row] = await db
    .update(collections)
    .set({ ...set, updatedAt: new Date() })
    .where(eq(collections.id, id))
    .returning()
  return row ?? null
}

export async function deleteCollection(id: string): Promise<void> {
  // Soft-delete: se marca eliminada; las lecturas filtran deletedAt.
  await db
    .update(collections)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(collections.id, id), isNull(collections.deletedAt)))
}

// Upsert por (catalogId, externalId) — clave del sync (definition sección 7.2).
// Actualiza el título; no pisa el slug `id` ni la posición manual.
export async function upsertCollectionByExternal(input: {
  id: string
  catalogId: string
  title: string
  externalId: string
  position: number
}): Promise<Collection> {
  const [row] = await db
    .insert(collections)
    .values(input)
    .onConflictDoUpdate({
      target: [collections.catalogId, collections.externalId],
      // El índice único es parcial (WHERE external_id IS NOT NULL); el conflict
      // target debe repetir su predicado o Postgres no lo matchea.
      targetWhere: sql`${collections.externalId} IS NOT NULL`,
      // deletedAt: null → el sync es autoritativo: si la colección reaparece en el
      // proveedor, revive una que hubiera sido soft-deleted.
      set: { title: input.title, deletedAt: null, updatedAt: new Date() },
    })
    .returning()
  return row
}

// ─── products ─────────────────────────────────────────────────────────────

export async function getProduct(id: string): Promise<Product | null> {
  const [row] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, id), isNull(products.deletedAt)))
    .limit(1)
  return row ?? null
}

export async function getProducts(ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return []
  return db
    .select()
    .from(products)
    .where(and(inArray(products.id, ids), isNull(products.deletedAt)))
}

export type ProductListFilter = {
  status?: ProductStatus
  collection?: string // slug de collections.id; resuelve collection_ids @> [..]
}

export async function listProducts(
  catalogId: string,
  filter: ProductListFilter = {},
): Promise<Product[]> {
  const conds = [eq(products.catalogId, catalogId), isNull(products.deletedAt)]
  if (filter.status) conds.push(eq(products.status, filter.status))
  if (filter.collection) {
    conds.push(
      sql`${products.collectionIds} @> ${JSON.stringify([filter.collection])}::jsonb`,
    )
  }
  return db
    .select()
    .from(products)
    .where(and(...conds))
    .orderBy(asc(products.position), asc(products.title))
}

// IDs de todos los productos del catálogo, INCLUYENDO soft-deleted/archivados:
// el reporte de vendidos cruza picks históricos (un producto pudo archivarse
// después de venderse) y necesita reconocerlos como pertenecientes al catálogo.
export async function productIdsForCatalog(
  catalogId: string,
): Promise<string[]> {
  const rows = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.catalogId, catalogId))
  return rows.map((r) => r.id)
}

export async function insertProduct(input: {
  catalogId: string
  externalId: string | null
  title: string
  currency: string | null
  images: string[]
  imageUrl: string | null
  status: ProductStatus
  position?: number
  refundable: boolean
  options: ProductOption[] | null
  variants: ProductVariant[]
  collectionIds: string[]
  raw?: unknown
}): Promise<Product> {
  const [row] = await db.insert(products).values(input).returning()
  return row
}

export async function updateProduct(
  id: string,
  set: Partial<{
    title: string
    currency: string | null
    images: string[]
    imageUrl: string | null
    status: ProductStatus
    position: number
    refundable: boolean
    options: ProductOption[] | null
    variants: ProductVariant[]
    collectionIds: string[]
  }>,
): Promise<Product | null> {
  const [row] = await db
    .update(products)
    .set({ ...set, updatedAt: new Date() })
    .where(eq(products.id, id))
    .returning()
  return row ?? null
}

export async function deleteProduct(id: string): Promise<void> {
  // Soft-delete: preserva snapshots de submissions e historial; las lecturas
  // filtran deletedAt. El sync (upsert por externalId) lo revive si reaparece.
  await db
    .update(products)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(products.id, id), isNull(products.deletedAt)))
}

// Aplica varios deltas de variantes del MISMO producto en una sola
// lectura/escritura del JSONB (read-modify-write), usado por el lifecycle de
// checkout: descuenta en purchasePaid, repone en refund (definition sección
// 9.3.1). delta negativo descuenta; positivo repone. No-op para variantes que no
// trackean stock o no existen, así no se relee/reescribe la fila por variante.
export async function adjustVariantStocks(
  productId: string,
  deltas: Map<string, number>,
): Promise<void> {
  const product = await getProduct(productId)
  if (!product) return
  let touched = false
  const variants = product.variants.map((v) => {
    const delta = deltas.get(v.id)
    if (delta === undefined || !v.stockTracked) return v
    touched = true
    return { ...v, stock: (v.stock ?? 0) + delta }
  })
  if (!touched) return
  await db
    .update(products)
    .set({ variants, updatedAt: new Date() })
    .where(eq(products.id, productId))
}

// Upsert del sync por (catalogId, externalId) — definition sección 7.1. Reescribe la
// identidad y las variantes/colecciones; preserva el slug y la posición manual
// no aplica (productos integrados se ordenan por el orden del proveedor).
export async function upsertProductByExternal(input: {
  catalogId: string
  externalId: string
  title: string
  currency: string | null
  images: string[]
  imageUrl: string | null
  status: ProductStatus
  position: number
  refundable: boolean
  options: ProductOption[] | null
  variants: ProductVariant[]
  collectionIds: string[]
  raw: unknown
}): Promise<Product> {
  // En conflicto solo se actualizan los campos mutables: catalogId/externalId
  // son la clave del upsert y no deben pisarse.
  const { title, currency, images, imageUrl, status, position, refundable, options, variants, collectionIds, raw } = input
  const [row] = await db
    .insert(products)
    .values(input)
    .onConflictDoUpdate({
      target: [products.catalogId, products.externalId],
      // El índice único es parcial (WHERE external_id IS NOT NULL); el conflict
      // target debe repetir su predicado o Postgres no lo matchea.
      targetWhere: sql`${products.externalId} IS NOT NULL`,
      // deletedAt: null → si el producto reaparece en el proveedor, el sync revive
      // uno que hubiera sido soft-deleted (el sync manda sobre el estado local).
      set: { title, currency, images, imageUrl, status, position, refundable, options, variants, collectionIds, raw, deletedAt: null, updatedAt: new Date() },
    })
    .returning()
  return row
}

// Paso de archivado del sync (definition sección 7.1, punto 3): marca como archived
// los productos integrados del catálogo cuyo externalId NO apareció en la
// corrida. No borra: preserva snapshots de submissions e historial.
export async function archiveProductsNotIn(
  catalogId: string,
  seenExternalIds: string[],
): Promise<number> {
  const conds = [
    eq(products.catalogId, catalogId),
    isNull(products.deletedAt),
    sql`${products.externalId} IS NOT NULL`,
    sql`${products.status} <> 'archived'`,
  ]
  if (seenExternalIds.length > 0) {
    conds.push(notInArray(products.externalId, seenExternalIds))
  }
  const rows = await db
    .update(products)
    .set({ status: "archived", updatedAt: new Date() })
    .where(and(...conds))
    .returning({ id: products.id })
  return rows.length
}
