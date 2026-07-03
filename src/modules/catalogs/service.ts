import { randomUUID } from "crypto"

import { DomainError, requireNonEmpty } from "@/lib/errors"
import type {
  CatalogSource,
  FormQuestion,
  ProductOption,
  ProductStatus,
  ProductVariant,
} from "@/lib/db/schema"
import { resolveProductMode } from "@/lib/products/derive"
import type { RenderProduct } from "@/lib/products/types"
import { slugify as slugifyBase, uniqueSlug } from "@/lib/slug"

import * as repo from "./repository"
import type { Catalog, Collection, Product } from "./repository"

export type { Catalog, Collection, Product }

// ─── slugs ──────────────────────────────────────────────────────────────────

export function slugify(value: string): string {
  return slugifyBase(value, { letterPrefix: "c-", fallback: "catalog" })
}

// Unicidad contra TODO el universo de slugs (incluye soft-deleted): el id es PK,
// recrear un slug eliminado colisionaría la fila y revivría su historial.
const uniqueCatalogSlug = (title: string) =>
  uniqueSlug(slugify(title), repo.catalogExistsIncludingDeleted)
const uniqueCollectionSlug = (title: string) =>
  uniqueSlug(slugify(title), repo.collectionExistsIncludingDeleted)

const catalogNotFound = (id: string) =>
  new DomainError("not_found", `catálogo '${id}' no encontrado`)
const productNotFound = (id: string) =>
  new DomainError("not_found", `producto '${id}' no encontrado`)

// ─── catalogs ─────────────────────────────────────────────────────────────

// La moneda solo la define el catálogo manual; en uno integrado la fija el sync
// del proveedor y nunca se edita a mano, aunque la UI mande el campo. Fuente
// única del invariante, compartida por create y update.
const currencyForManual = (
  source: CatalogSource,
  currency: string | null | undefined,
): string | null => (source === "manual" ? (currency ?? null) : null)

export async function listCatalogs(): Promise<Catalog[]> {
  return repo.listCatalogs()
}

export async function getCatalog(id: string): Promise<Catalog> {
  const row = await repo.getCatalog(id)
  if (!row) throw catalogNotFound(id)
  return row
}

export async function createCatalog(input: {
  title: string
  source: CatalogSource
  credentialId?: string | null
  currency?: string | null
  id?: string
}): Promise<Catalog> {
  const title = requireNonEmpty(input.title, "El título es requerido")
  // Un catálogo integrado necesita credencial; uno manual no debe tenerla.
  if (input.source === "manual") {
    if (input.credentialId)
      throw new DomainError(
        "invalid_payload",
        "un catálogo manual no lleva credencial",
      )
  } else if (!input.credentialId) {
    throw new DomainError(
      "invalid_payload",
      "un catálogo integrado requiere una credencial",
    )
  }
  // uniqueCatalogSlug ya garantiza unicidad; solo el id provisto por el usuario
  // necesita el chequeo de existencia.
  const id = input.id ? slugify(input.id) : await uniqueCatalogSlug(title)
  if (input.id && (await repo.catalogExistsIncludingDeleted(id)))
    throw new DomainError("invalid_payload", `el catálogo '${id}' ya existe`)
  return repo.insertCatalog({
    id,
    title,
    source: input.source,
    credentialId: input.credentialId ?? null,
    currency: currencyForManual(input.source, input.currency),
  })
}

export async function updateCatalog(
  id: string,
  patch: { title?: string; currency?: string | null },
): Promise<Catalog> {
  const current = await repo.getCatalog(id)
  if (!current) throw catalogNotFound(id)
  const safe = { ...patch }
  if (safe.currency !== undefined)
    safe.currency = currencyForManual(current.source, safe.currency)
  const next = await repo.updateCatalog(id, safe)
  if (!next) throw catalogNotFound(id)
  return next
}

export async function deleteCatalog(id: string): Promise<void> {
  // NOTA (definition sección 8.5): un catálogo referenciado por un form publicado no
  // debería poder borrarse. Ese guard (escanear forms.definition por
  // product.catalogId) se cablea en la capa de acciones del dashboard, donde el
  // módulo forms es alcanzable. Acá solo se borra (products/collections cascadean).
  await repo.deleteCatalog(id)
}

// ─── collections ──────────────────────────────────────────────────────────

export async function listCollections(catalogId: string): Promise<Collection[]> {
  return repo.listCollections(catalogId)
}

export async function listCollectionsForCatalogs(
  catalogIds: string[],
): Promise<Collection[]> {
  return repo.listCollectionsForCatalogs(catalogIds)
}

export async function createCollection(input: {
  catalogId: string
  title: string
  position?: number
  id?: string
}): Promise<Collection> {
  await getCatalog(input.catalogId) // valida existencia
  const title = requireNonEmpty(input.title, "El título es requerido")
  // uniqueCollectionSlug ya garantiza unicidad; solo el id provisto por el
  // usuario necesita el chequeo de existencia.
  const id = input.id ? slugify(input.id) : await uniqueCollectionSlug(title)
  if (input.id && (await repo.collectionExistsIncludingDeleted(id)))
    throw new DomainError("invalid_payload", `la colección '${id}' ya existe`)
  return repo.insertCollection({
    id,
    catalogId: input.catalogId,
    title,
    externalId: null, // manual
    position: input.position ?? 0,
  })
}

export async function updateCollection(
  id: string,
  patch: { title?: string; position?: number },
): Promise<Collection> {
  const next = await repo.updateCollection(id, patch)
  if (!next) throw new DomainError("not_found", `colección '${id}' no encontrada`)
  return next
}

export async function deleteCollection(id: string): Promise<void> {
  await repo.deleteCollection(id)
}

// ─── products ─────────────────────────────────────────────────────────────

const PRODUCT_STATUSES: ProductStatus[] = ["active", "draft", "archived"]

// Normaliza la galería: limpia vacíos/duplicados y, si no vino `images` pero sí un
// `imageUrl` legacy, lo adopta como única foto. La portada (imageUrl) es siempre
// images[0], así render/snapshot siguen funcionando sin conocer la galería.
function normalizeImages(
  images: string[] | undefined,
  legacyImageUrl: string | null | undefined,
): { images: string[]; imageUrl: string | null } {
  const source = images ?? (legacyImageUrl ? [legacyImageUrl] : [])
  const seen = new Set<string>()
  const out: string[] = []
  for (const url of source) {
    const u = url?.trim()
    if (u && !seen.has(u)) {
      seen.add(u)
      out.push(u)
    }
  }
  return { images: out, imageUrl: out[0] ?? null }
}

// Normaliza variantes para el CRUD manual: un producto sin opciones es una sola
// variante default; siempre se garantiza ≥ 1 variante con id estable (D1 / sección 4.3).
function normalizeManualVariants(
  options: ProductOption[] | null,
  variants: Partial<ProductVariant>[] | undefined,
): { options: ProductOption[] | null; variants: ProductVariant[] } {
  const input = variants ?? []
  if (input.length === 0) {
    // Producto simple: una variante default sin opciones.
    return {
      options: null,
      variants: [makeVariant({ title: "Default Title", options: {} })],
    }
  }
  const normalized = input.map((v) => makeVariant(v))
  // options explícitas o derivadas de las variantes: por cada nombre de opción
  // visto en las variantes, juntamos sus valores distintos en orden de aparición.
  const derived = options && options.length > 0 ? options : deriveOptions(normalized)
  return {
    options: derived.length > 0 ? derived : null,
    variants: normalized,
  }
}

function deriveOptions(variants: ProductVariant[]): ProductOption[] {
  const byName = new Map<string, string[]>()
  for (const v of variants) {
    for (const [name, value] of Object.entries(v.options)) {
      const values = byName.get(name) ?? []
      if (!values.includes(value)) values.push(value)
      byName.set(name, values)
    }
  }
  return [...byName.entries()].map(([name, values]) => ({ name, values }))
}

function makeVariant(v: Partial<ProductVariant>): ProductVariant {
  const { images, imageUrl } = normalizeImages(v.images, v.imageUrl)
  return {
    id: v.id?.trim() || randomUUID(),
    externalId: v.externalId ?? null,
    options: v.options ?? {},
    title: v.title?.trim() || "Default Title",
    sku: v.sku ?? null,
    price: v.price ?? null,
    images,
    imageUrl,
    status: PRODUCT_STATUSES.includes(v.status as ProductStatus)
      ? (v.status as ProductStatus)
      : "active",
    stockTracked: v.stockTracked ?? false,
    stock: v.stock ?? null,
    oversellPolicy: v.oversellPolicy === "continue" ? "continue" : "deny",
  }
}

export async function listProducts(
  catalogId: string,
  filter?: repo.ProductListFilter,
): Promise<Product[]> {
  return repo.listProducts(catalogId, filter)
}

export async function getProduct(id: string): Promise<Product> {
  const row = await repo.getProduct(id)
  if (!row) throw productNotFound(id)
  return row
}

export async function createProduct(input: {
  catalogId: string
  title: string
  currency?: string | null
  images?: string[]
  imageUrl?: string | null
  status?: ProductStatus
  position?: number
  refundable?: boolean
  options?: ProductOption[] | null
  variants?: Partial<ProductVariant>[]
  collectionIds?: string[]
}): Promise<Product> {
  const catalog = await getCatalog(input.catalogId)
  if (catalog.source !== "manual")
    throw new DomainError(
      "invalid_payload",
      "no se pueden crear productos a mano en un catálogo integrado (los trae el sync)",
    )
  const title = requireNonEmpty(input.title, "El título es requerido")
  const { options, variants } = normalizeManualVariants(
    input.options ?? null,
    input.variants,
  )
  const { images, imageUrl } = normalizeImages(input.images, input.imageUrl)
  return repo.insertProduct({
    catalogId: input.catalogId,
    externalId: null,
    title,
    currency: input.currency ?? catalog.currency ?? null,
    images,
    imageUrl,
    status: input.status ?? "active",
    position: input.position ?? 0,
    refundable: input.refundable ?? true,
    options,
    variants,
    collectionIds: input.collectionIds ?? [],
  })
}

export async function updateProduct(
  id: string,
  patch: {
    title?: string
    currency?: string | null
    images?: string[]
    imageUrl?: string | null
    status?: ProductStatus
    position?: number
    refundable?: boolean
    options?: ProductOption[] | null
    variants?: Partial<ProductVariant>[]
    collectionIds?: string[]
  },
): Promise<Product> {
  const set: Parameters<typeof repo.updateProduct>[1] = {}
  if (patch.title !== undefined) set.title = patch.title.trim()
  if (patch.currency !== undefined) set.currency = patch.currency
  // images e imageUrl viajan juntos: la portada siempre es images[0].
  if (patch.images !== undefined || patch.imageUrl !== undefined) {
    const { images, imageUrl } = normalizeImages(patch.images, patch.imageUrl)
    set.images = images
    set.imageUrl = imageUrl
  }
  if (patch.status !== undefined) set.status = patch.status
  if (patch.position !== undefined) set.position = patch.position
  if (patch.refundable !== undefined) set.refundable = patch.refundable
  if (patch.collectionIds !== undefined) set.collectionIds = patch.collectionIds
  if (patch.variants !== undefined) {
    const { options, variants } = normalizeManualVariants(
      patch.options ?? null,
      patch.variants,
    )
    set.options = options
    set.variants = variants
  } else if (patch.options !== undefined) {
    set.options = patch.options
  }
  const next = await repo.updateProduct(id, set)
  if (!next) throw productNotFound(id)
  return next
}

export async function deleteProduct(id: string): Promise<void> {
  await repo.deleteProduct(id)
}

// Fija de una sola vez la membresía de una colección: `productIds` es el set
// completo que debe quedar dentro. Solo toca los productos que cambian (agrega o
// quita el slug de collectionIds), evitando reescrituras innecesarias. Lo usa la
// pestaña Colecciones para guardar en lote al cerrar el drawer.
export async function setCollectionMembership(
  catalogId: string,
  collectionId: string,
  productIds: string[],
): Promise<void> {
  const all = await repo.listProducts(catalogId)
  const want = new Set(productIds)
  await Promise.all(
    all.flatMap((p) => {
      const has = p.collectionIds.includes(collectionId)
      const should = want.has(p.id)
      if (has === should) return []
      const next = should
        ? [...p.collectionIds, collectionId]
        : p.collectionIds.filter((id) => id !== collectionId)
      return [repo.updateProduct(p.id, { collectionIds: next })]
    }),
  )
}

// ─── disponibilidad (matriz de stock sección 4.4) ─────────────────────────────────

// Stock disponible de una variante SIN considerar holds (la resta de
// stock_reservations vive en la capa de checkout, sección 9.3.1). Esta función decide
// si la variante es vendible por su propia config de inventario.
function variantSellable(variant: ProductVariant): boolean {
  if (variant.status !== "active") return false
  if (!variant.stockTracked) return true // ilimitada
  if (variant.oversellPolicy === "continue") return true // backorder
  return (variant.stock ?? 0) > 0 // deny: vendible mientras stock > 0
}

// Unidades que el carrito puede agregar de una variante, SIN restar holds (igual
// de optimista que `variantSellable`). `null` = ilimitado (sin track o backorder).
function variantAvailable(variant: ProductVariant): number | null {
  if (!variant.stockTracked) return null // ilimitada
  if (variant.oversellPolicy === "continue") return null // backorder
  return Math.max(0, variant.stock ?? 0)
}

// Proyecta un Product (fila) a la forma render-safe que viaja al cliente: sin
// `raw` ni campos internos, con `sellable` calculado (disponibilidad optimista).
export function toRenderProduct(product: Product): RenderProduct {
  return {
    id: product.id,
    title: product.title,
    currency: product.currency,
    images: product.images ?? [],
    imageUrl: product.imageUrl,
    refundable: product.refundable,
    options: product.options,
    variants: product.variants.map((v) => ({
      id: v.id,
      externalId: v.externalId,
      options: v.options,
      title: v.title,
      sku: v.sku,
      price: v.price,
      images: v.images ?? [],
      imageUrl: v.imageUrl,
      sellable: variantSellable(v),
      available: variantAvailable(v),
    })),
  }
}

// ─── resolución del listado de la pregunta `product` (sección 8) ──────────────────

// Resuelve qué productos ve el fan a partir del bloque `product` de la pregunta:
// dinámico (filter) y/o curado (productIds, preservando ese orden). Siempre se
// omiten los productos no-active (definition sección 8.5).
//
// NOTA: `filter.tag` aún no se resuelve — el modelo de datos (data-model.md) no
// guarda tags de producto. Es una discrepancia del spec a confirmar; por ahora
// el filtro por tag se ignora (no rompe, pero no filtra). Ver resumen del hito.
export async function resolveListing(
  cfg: NonNullable<FormQuestion["product"]>,
): Promise<Product[]> {
  const { mode, collectionId } = resolveProductMode(cfg)

  if (mode === "curated" && cfg.productIds && cfg.productIds.length > 0) {
    const rows = await repo.getProducts(cfg.productIds)
    const byId = new Map(rows.map((p) => [p.id, p]))
    // Curado: respeta el orden de productIds; omite los inexistentes/archivados.
    return cfg.productIds
      .map((id) => byId.get(id))
      .filter(
        (p): p is Product =>
          !!p && p.catalogId === cfg.catalogId && p.status === "active",
      )
  }

  // collection / catalog: ambos listan por catálogo; collection agrega el filtro.
  return repo.listProducts(cfg.catalogId, {
    status: "active",
    collection: mode === "collection" ? collectionId : undefined,
  })
}
