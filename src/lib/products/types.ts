import type { ProductPick } from "@/lib/db/schema"

// Formas render-safe que viajan al cliente (sin `raw` ni payloads del proveedor).
// Las arma el servidor desde `products` y las consume el FormRenderer/iframe.
export type RenderVariant = {
  id: string
  externalId: string | null
  options: Record<string, string>
  title: string
  sku: string | null
  price: number | null
  images: string[] // galería de la variante (portada = images[0])
  imageUrl: string | null // portada de la variante; fallback a product.imageUrl
  // Disponibilidad optimista (matriz de stock sección 4.4, SIN restar holds).
  sellable: boolean
  // Unidades disponibles para el stepper del carrito, optimista (SIN restar
  // holds). `null` = ilimitado (sin track de stock o backorder); un número = tope
  // duro de cuántas unidades de esta variante se pueden agregar.
  available: number | null
}

export type RenderProduct = {
  id: string
  title: string
  currency: string | null
  images: string[] // galería del producto (portada = images[0])
  imageUrl: string | null // portada del producto
  refundable: boolean
  options: { name: string; values: string[] }[] | null
  variants: RenderVariant[]
}

// Listas resueltas por pregunta product, clave `${formId}::${questionId}`.
export type ProductLists = Record<string, RenderProduct[]>

export type ProductSnapshot = ProductPick["snapshot"]
