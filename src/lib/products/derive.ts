import type { FormQuestion, PartnerItem, ProductPick } from "@/lib/db/schema"

import { sha256Hex } from "./sha256"
import { hasRealVariants } from "./snapshot"

// Cota dura de PartnerItem por interaction. El spec original de Crowder hablaba
// de 1–10, pero se confirmó que su backend acepta más; ahora este número es una
// salvaguarda anti-abuso (el endpoint de submit es un POST anónimo, ver CWE-770
// en la ruta), NO un límite del protocolo. Alineado con MAX_ITEMS del contexto.
export const MAX_PARTNER_ITEMS = 200

// Normaliza el valor crudo de una respuesta product (single u array) a ProductPick[].
// Único lugar que define la dualidad single/array de ProductAnswer; ignora null.
export function toPicks(value: unknown): ProductPick[] {
  if (value == null) return []
  return (Array.isArray(value) ? value : [value]) as ProductPick[]
}

// Guarda estructural única para "este valor es un ProductPick". Un pick real
// trae productId+variantId (lo que usa el stock) y un snapshot objeto (lo que
// usan formato/export); el resto de respuestas son strings/números. Definirla
// acá evita que cada consumidor invente su propia versión y diverjan.
export function isProductPick(v: unknown): v is ProductPick {
  if (typeof v !== "object" || v === null) return false
  const p = v as Record<string, unknown>
  return (
    typeof p.productId === "string" &&
    typeof p.variantId === "string" &&
    typeof p.snapshot === "object" &&
    p.snapshot !== null
  )
}

export type ProductMode = "collection" | "catalog" | "curated"

// Modo efectivo de un bloque `product`: explícito (`source`) o inferido para
// retrocompat (la colección es el modo principal). Lo comparten el builder
// (Inspector) y el resolver (resolveListing) para no divergir en la interpretación.
export function resolveProductMode(cfg: NonNullable<FormQuestion["product"]>): {
  mode: ProductMode
  collectionId: string | undefined
} {
  const collectionId = cfg.collectionId ?? cfg.filter?.collection
  const mode: ProductMode =
    cfg.source ??
    (cfg.productIds?.length ? "curated" : collectionId ? "collection" : "catalog")
  return { mode, collectionId }
}

// uuid determinístico de un PartnerItem (definition sección 9.8). Partes en orden
// fijo, separadas por NUL (no aparece en ids/slugs → sin colisión por
// concatenación). sha256 truncado a 16 hex (64 bits), prefijo pi_. Determinístico
// ⇒ cliente y servidor reconstruyen el mismo uuid (clave para mapear un refund de
// vuelta a la variante exacta).
function deterministicItemUuid(parts: {
  formId: string
  groupId: string
  itemUuid: string | null
  questionId: string
  productId: string
  variantId: string
  unitIndex: number
}): string {
  const ordered = [
    parts.formId,
    parts.groupId,
    parts.itemUuid ?? "",
    parts.questionId,
    parts.productId,
    parts.variantId,
    String(parts.unitIndex),
  ]
  return "pi_" + sha256Hex(ordered.join("\0")).slice(0, 16)
}

// Datos de producto necesarios para derivar (forma común a cliente y servidor).
// El servidor la arma re-leyendo el catálogo (autoritativo en precio); el cliente
// la arma desde su RenderProduct para el preview.
export type ProductForDerive = {
  id: string
  title: string
  refundable: boolean
  currency: string | null
  variants: {
    id: string
    title: string
    price: number | null
    options: Record<string, string>
    sellable: boolean
  }[]
}

// Una pregunta product con sus picks y su scope dentro de la interaction.
export type ProductAnswerSource = {
  formId: string
  groupId: string
  itemUuid: string | null
  questionId: string
  picks: ProductPick[]
}

export type DeriveError =
  | { code: "product_not_found"; productId: string }
  | { code: "variant_not_found"; productId: string; variantId: string }
  | { code: "variant_unavailable"; productId: string; variantId: string }
  | { code: "missing_price"; productId: string; variantId: string }
  | { code: "currency_mismatch"; productId: string; expected: string; got: string }
  | { code: "too_many_items"; max: number; got: number }

export type DeriveResult = {
  items: PartnerItem[]
  errors: DeriveError[]
}

function truncate(s: string, max = 200): string {
  if (s.length <= max) return s
  // Corte en límite de carácter (sin partir un code point) + elipsis.
  return Array.from(s).slice(0, max - 1).join("") + "…"
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

// Función PURA y compartida (definition sección 9.8): de las respuestas product a
// PartnerItem[]. El servidor es autoritativo en precio (re-lee el catálogo en el
// `lookup`); el cliente la corre para el preview en `selected`. Cada pick se
// expande a `quantity` items de `quantity: 1`, cada uno con su unitIndex en el uuid.
//
// Orden estable y reproducible: sources (grupos→preguntas→items) → picks →
// unidades, todo por índice de array (convención del repo) ⇒ cliente y servidor
// emiten la misma secuencia.
export function derivePartnerItems(
  sources: ProductAnswerSource[],
  lookup: Map<string, ProductForDerive>,
  contextCurrency: string,
): DeriveResult {
  const items: PartnerItem[] = []
  const errors: DeriveError[] = []

  for (const src of sources) {
    for (const pick of src.picks) {
      const product = lookup.get(pick.productId)
      if (!product) {
        errors.push({ code: "product_not_found", productId: pick.productId })
        continue
      }
      const variant = product.variants.find((v) => v.id === pick.variantId)
      if (!variant) {
        errors.push({
          code: "variant_not_found",
          productId: pick.productId,
          variantId: pick.variantId,
        })
        continue
      }
      if (!variant.sellable) {
        errors.push({
          code: "variant_unavailable",
          productId: pick.productId,
          variantId: pick.variantId,
        })
        continue
      }
      if (variant.price == null) {
        errors.push({
          code: "missing_price",
          productId: pick.productId,
          variantId: pick.variantId,
        })
        continue
      }
      // La moneda del producto debe coincidir con la del contexto (sección 9.8).
      if (product.currency && product.currency !== contextCurrency) {
        errors.push({
          code: "currency_mismatch",
          productId: pick.productId,
          expected: contextCurrency,
          got: product.currency,
        })
        continue
      }

      const description = hasRealVariants(product)
        ? truncate(`${product.title} — ${variant.title}`)
        : truncate(product.title)
      const price = round2(variant.price)
      const quantity = Math.max(1, pick.quantity ?? 1)

      // Cada unidad = un PartnerItem de quantity: 1 (sección 9.2).
      for (let unitIndex = 0; unitIndex < quantity; unitIndex++) {
        items.push({
          uuid: deterministicItemUuid({
            formId: src.formId,
            groupId: src.groupId,
            itemUuid: src.itemUuid,
            questionId: src.questionId,
            productId: pick.productId,
            variantId: pick.variantId,
            unitIndex,
          }),
          type: "STORE_PRODUCT",
          description,
          price,
          quantity: 1,
          refundable: product.refundable,
        })
      }
    }
  }

  // Salvaguarda anti-abuso (ya no el "1–10" del protocolo): cota alta contada en
  // unidades. Solo dispara en casos degenerados/maliciosos, no en compras reales.
  if (items.length > MAX_PARTNER_ITEMS) {
    errors.push({ code: "too_many_items", max: MAX_PARTNER_ITEMS, got: items.length })
  }

  return { items, errors }
}
