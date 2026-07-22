import type { ProductPick } from "@/lib/db/schema"
import type { RenderProduct, RenderVariant } from "./types"

// El snapshot guarda una sola `imageUrl`; los render objects esperan un array.
const snapshotImages = (s: ProductPick["snapshot"]): string[] =>
  s.imageUrl ? [s.imageUrl] : []

// Reconstruye una variante render-safe desde el snapshot congelado de un pick.
// Se usa cuando la variante ya no está en el catálogo vivo (archivada/borrada)
// pero sí quedó elegida en una submission histórica.
function variantFromSnapshot(pick: ProductPick): RenderVariant {
  const s = pick.snapshot
  const images = snapshotImages(s)
  return {
    id: pick.variantId,
    externalId: null,
    options: s.options ?? {},
    title: s.variantTitle ?? s.title,
    sku: s.sku,
    price: s.price,
    images,
    imageUrl: s.imageUrl,
    // Ya fue elegida en esta submission: la mostramos vendible/ilimitada para
    // poder conservarla al editar, aunque el catálogo ya no la ofrezca.
    sellable: true,
    available: null,
  }
}

function productFromSnapshot(pick: ProductPick): RenderProduct {
  const s = pick.snapshot
  const images = snapshotImages(s)
  return {
    id: pick.productId,
    title: s.title,
    currency: s.currency,
    images,
    imageUrl: s.imageUrl,
    // El snapshot no guarda `refundable`; asumimos el caso conservador.
    refundable: false,
    options: null,
    variants: [variantFromSnapshot(pick)],
  }
}

// Fusiona el listado vivo del catálogo con los picks ya guardados en la
// submission: los productos/variantes ausentes del catálogo (archivados o
// borrados) se reconstruyen desde su snapshot para que la respuesta histórica
// siga visible y editable. No muta `rendered`.
export function mergePicksIntoListing(
  rendered: RenderProduct[],
  picks: ProductPick[],
): RenderProduct[] {
  if (picks.length === 0) return rendered
  // Copia defensiva: clonamos productos y sus arrays de variantes antes de
  // inyectar, para no mutar la lista resuelta del catálogo.
  const out = rendered.map((p) => ({ ...p, variants: [...p.variants] }))
  const byProductId = new Map(out.map((p) => [p.id, p]))
  for (const pick of picks) {
    const existing = byProductId.get(pick.productId)
    if (!existing) {
      const synth = productFromSnapshot(pick)
      out.push(synth)
      byProductId.set(synth.id, synth)
      continue
    }
    if (!existing.variants.some((v) => v.id === pick.variantId)) {
      existing.variants.push(variantFromSnapshot(pick))
    }
  }
  return out
}
