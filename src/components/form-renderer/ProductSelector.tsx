"use client"

import { useState } from "react"
import { cx } from "@/lib/utils"
import type { FormQuestion, ProductPick } from "@/lib/db/schema"
import { formatPrice, priceRange } from "@/lib/products/format"
import { toPicks } from "@/lib/products/derive"
import { resolveQuantityBounds, sumUnits } from "@/lib/products/quantity"
import { buildSnapshot, hasRealVariants } from "@/lib/products/snapshot"
import type { RenderProduct, RenderVariant } from "@/lib/products/types"

// Por encima de esta cantidad de variantes, la lista se colapsa (solo se ven
// las agregadas + un botón para elegir el resto). Evita cards/filas kilométricas
// en productos con muchas combinaciones (ej. Talla × Color).
const COLLAPSE_THRESHOLD = 5

// Render de la pregunta `product` (definition sección 8.3).
//
// Vista ÚNICA: carrito agrupado por producto, cada variante con su fila
// (Agregar / stepper `− cantidad +` / Quitar). `max` cuenta UNIDADES totales
// (suma de cantidades), así el comprador puede mezclar tallas o llevar varias
// de una misma talla hasta sumar max.
//
// `single` (max === 1) NO cambia la UI, solo:
//  - la forma del value: ProductPick (o undefined) en vez de ProductPick[] (ver emit()).
//  - el comportamiento al agregar: reemplaza el pick actual (auto-swap), en vez
//    de acumular líneas.
//
// El total y el botón "Continuar" los pone Crowder (no acá); acá solo mostramos
// un total informativo cuando showPrice está activo.
// Imágenes activas de un producto: si la variante elegida tiene galería propia,
// manda esa; si no, cae a la del producto (y a la portada legacy como último recurso).
function galleryFor(p: RenderProduct, v?: RenderVariant): string[] {
  const vi = v?.images ?? []
  if (vi.length) return vi
  if (p.images.length) return p.images
  return p.imageUrl ? [p.imageUrl] : []
}

// Miniatura + tira de thumbnails para cambiar la imagen mostrada. Sin imágenes
// no renderiza nada (el layout se reacomoda solo). `size`:
//   - "sm" (listado): miniatura 64px a la izquierda de la fila.
//   - "lg" (cards): imagen cuadrada full-width arriba de la card.
function ProductGallery({
  images,
  alt,
  size = "sm",
}: {
  images: string[]
  alt: string
  size?: "sm" | "lg"
}) {
  const [idx, setIdx] = useState(0)
  if (images.length === 0) return null
  const active = Math.min(idx, images.length - 1)
  const lg = size === "lg"
  return (
    <div className={cx("space-y-1", lg ? "w-full" : "shrink-0")}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={images[active]}
        alt={alt}
        className={cx(
          "rounded-md object-cover",
          lg ? "aspect-square w-full" : "size-16",
        )}
      />
      {images.length > 1 && (
        <div className="flex gap-1">
          {images.slice(0, 4).map((url, i) => (
            <button
              key={`${url}-${i}`}
              type="button"
              onClick={() => setIdx(i)}
              aria-label={`Imagen ${i + 1} de ${alt}`}
              className={cx(
                "overflow-hidden rounded-sm border transition",
                lg ? "size-8" : "size-4",
                i === active ? "border-primary" : "border-border",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function ProductSelector({
  config,
  products,
  value,
  onChange,
  currency,
  ticketCount,
}: {
  config: FormQuestion["product"]
  products: RenderProduct[]
  value: unknown
  onChange: (v: unknown) => void
  currency?: string | null
  // Cantidad de tickets (ya resuelta por scope) para el modo `perTickets`.
  ticketCount?: number
}) {
  // min/max EFECTIVOS: en modo `fixed` son los configurados; en `perTickets` se
  // derivan de la cantidad de tickets (1 producto por entrada).
  const { min, max } = resolveQuantityBounds(config, ticketCount)
  const single = max === 1
  const showPrice = config?.showPrice ?? false
  // Visualización del listado de productos: "list" (filas) o "cards" (grilla).
  const layout = config?.layout ?? "list"

  // Productos con muchas variantes colapsan la lista: por defecto solo se ven
  // las variantes ya agregadas + un botón para desplegar el resto.
  const [expandedByProduct, setExpandedByProduct] = useState<
    Record<string, boolean>
  >({})

  const picks = toPicks(value)

  // Índices O(1) construidos una vez por render: cantidad por (producto+variante)
  // y unidades totales por producto. Evita re-escanear `picks` en cada variante
  // dibujada (qtyOf/unitsOfProduct se llaman por variante × producto).
  const qtyByKey = new Map<string, number>()
  const unitsByProduct = new Map<string, number>()
  for (const p of picks) {
    const q = p.quantity ?? 1
    qtyByKey.set(`${p.productId}:${p.variantId}`, q)
    unitsByProduct.set(p.productId, (unitsByProduct.get(p.productId) ?? 0) + q)
  }

  if (products.length === 0) {
    return (
      <p className="rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
        No hay productos disponibles para esta pregunta.
      </p>
    )
  }

  const makePick = (
    p: RenderProduct,
    variant: RenderVariant,
    quantity: number,
  ): ProductPick => ({
    productId: p.id,
    variantId: variant.id,
    quantity,
    snapshot: buildSnapshot(p, variant),
  })

  const emit = (next: ProductPick[]) => {
    onChange(single ? (next[0] ?? undefined) : next)
  }

  // ──────────────────── Vista de carrito (siempre) ────────────────────────
  // Siempre se dibuja el carrito agrupado por producto. `single` (max === 1)
  // NO cambia la UI: solo rige la forma del value (objeto único vs array, ver
  // emit()) y hace que agregar otro producto reemplace el actual (auto-swap).
  const totalUnits = sumUnits(picks)
  const atMax = totalUnits >= max
  const remaining = max - totalUnits

  const qtyOf = (productId: string, variantId: string): number =>
    qtyByKey.get(`${productId}:${variantId}`) ?? 0

  // Fija la cantidad de una línea (producto+variante). 0 → la quita del carrito.
  // El tope de la línea es el stock de la variante (`available`, null = ilimitado);
  // el tope global es el `max` de la pregunta.
  const setQty = (p: RenderProduct, v: RenderVariant, qty: number) => {
    const currentQty = qtyOf(p.id, v.id)
    // Clamp al stock disponible de la variante (optimista, sin holds).
    const target = v.available == null ? qty : Math.min(qty, v.available)
    if (target < 1) {
      if (currentQty > 0)
        emit(picks.filter((x) => !(x.productId === p.id && x.variantId === v.id)))
      return
    }
    // Selección única: agregar otro producto/variante reemplaza el actual, sin
    // exigir "Quitar" primero (equivale al auto-swap de los radios).
    if (single) {
      emit([makePick(p, v, 1)])
      return
    }
    const delta = target - currentQty
    if (delta > 0 && totalUnits + delta > max) return
    if (currentQty > 0) {
      emit(
        picks.map((x) =>
          x.productId === p.id && x.variantId === v.id
            ? makePick(p, v, target)
            : x,
        ),
      )
    } else {
      emit([...picks, makePick(p, v, target)])
    }
  }

  // Total informativo del carrito (el autoritativo lo calcula el servidor).
  const cartTotal = picks.reduce(
    (sum, p) => sum + (p.snapshot.price ?? 0) * (p.quantity ?? 1),
    0,
  )
  const cartCurrency = picks[0]?.snapshot.currency ?? currency

  const unitsOfProduct = (p: RenderProduct) => unitsByProduct.get(p.id) ?? 0

  // Precio a mostrar UNA vez por producto: precio único, o "desde X" si las
  // variantes vendibles difieren. null si no hay precios o showPrice está off.
  const priceLabelFor = (p: RenderProduct): string | null => {
    if (!showPrice) return null
    const range = priceRange(p.variants, { onlySellable: true })
    if (!range) return null
    const cur = p.currency ?? currency
    return range.lo === range.hi
      ? formatPrice(range.lo, cur)
      : `desde ${formatPrice(range.lo, cur)}`
  }

  // Control de una variante: Agotado / Agregar / stepper `− qty +`. Compartido
  // por ambos layouts.
  const renderControls = (p: RenderProduct, v: RenderVariant, qty: number) => {
    const canAdd = v.sellable && (qty > 0 || !atMax)
    // Sin más para agregar: por tope global o por stock de la variante.
    const atVariantMax = v.available != null && qty >= v.available
    const label = hasRealVariants(p) ? v.title : p.title
    if (!v.sellable)
      return (
        <span className="shrink-0 text-xs text-muted-foreground">Agotado</span>
      )
    if (qty === 0)
      return (
        <button
          type="button"
          disabled={!canAdd}
          onClick={() => setQty(p, v, 1)}
          className="shrink-0 rounded-md border border-border px-3 py-1 text-xs text-secondary-foreground transition hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
        >
          Agregar
        </button>
      )
    return (
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          className="size-6 rounded border border-border text-sm"
          onClick={() => setQty(p, v, qty - 1)}
          aria-label={`Quitar una unidad de ${label}`}
        >
          −
        </button>
        <span className="w-5 text-center text-sm">{qty}</span>
        <button
          type="button"
          className="size-6 rounded border border-border text-sm disabled:cursor-not-allowed disabled:opacity-40"
          disabled={atMax || atVariantMax}
          onClick={() => setQty(p, v, qty + 1)}
          aria-label={`Agregar una unidad de ${label}`}
        >
          +
        </button>
      </div>
    )
  }

  // Fila de una variante: [nombre · precio] … [control]. El nombre solo se
  // muestra si el producto tiene variantes reales (si no, el título ya está
  // arriba y repetirlo sería redundante). En cards el precio va una vez arriba,
  // así que la fila lo omite (`withPrice=false`). Compartida por ambos layouts.
  const renderVariantLine = (
    p: RenderProduct,
    v: RenderVariant,
    withPrice = true,
  ) => {
    const qty = qtyOf(p.id, v.id)
    const multi = hasRealVariants(p)
    return (
      <div key={v.id} className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-2">
          {multi && (
            <span
              className={cx(
                "truncate text-sm",
                qty > 0 ? "text-foreground" : "text-secondary-foreground",
                !v.sellable && "text-muted-foreground line-through",
              )}
            >
              {v.title}
            </span>
          )}
          {withPrice && showPrice && v.price != null && (
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatPrice(v.price, p.currency ?? currency)}
            </span>
          )}
        </div>
        {renderControls(p, v, qty)}
      </div>
    )
  }

  // Sección de variantes de un producto (compartida por ambos layouts). Con
  // muchas variantes colapsa: muestra solo las agregadas + un botón para elegir
  // el resto; expandida, muestra todas con un botón para volver a ocultar.
  const renderVariantSection = (p: RenderProduct, withPrice: boolean) => {
    const many = p.variants.length > COLLAPSE_THRESHOLD
    const open = !many || expandedByProduct[p.id]
    const toggle = () =>
      setExpandedByProduct((s) => ({ ...s, [p.id]: !s[p.id] }))
    // Solo la rama colapsada consume `added`; evitamos el barrido cuando la
    // sección está abierta (el caso común: ≤ COLLAPSE_THRESHOLD variantes).
    const added = open ? [] : p.variants.filter((v) => qtyOf(p.id, v.id) > 0)
    return (
      <div className="mt-2 space-y-1.5">
        {open ? (
          <>
            {p.variants.map((v) => renderVariantLine(p, v, withPrice))}
            {many && (
              <button
                type="button"
                onClick={toggle}
                className="w-full text-left text-xs text-muted-foreground transition hover:text-foreground"
              >
                Ocultar variantes
              </button>
            )}
          </>
        ) : (
          <>
            {added.map((v) => renderVariantLine(p, v, withPrice))}
            <button
              type="button"
              onClick={toggle}
              className="w-full rounded-md border border-dashed border-border px-3 py-1.5 text-xs text-secondary-foreground transition hover:bg-subtle"
            >
              {added.length > 0
                ? "Agregar otra variante"
                : `Elegir variante (${p.variants.length})`}
            </button>
          </>
        )}
      </div>
    )
  }

  // Listado: fila horizontal (miniatura a la izquierda, variantes a la derecha).
  const renderProductRow = (p: RenderProduct) => {
    const soldOut = !p.variants.some((v) => v.sellable)
    return (
      <div
        key={p.id}
        className={cx(
          "rounded-lg border bg-background p-3 transition",
          unitsOfProduct(p) > 0 ? "border-primary bg-primary/5" : "border-border",
          soldOut && "opacity-60",
        )}
      >
        <div className="flex items-start gap-3">
          <ProductGallery images={galleryFor(p)} alt={p.title} />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground">{p.title}</p>
            {soldOut && <p className="text-xs text-muted-foreground">Agotado</p>}
            {!soldOut && renderVariantSection(p, true)}
          </div>
        </div>
      </div>
    )
  }

  // Cards: grilla con imagen cuadrada arriba, precio UNA vez, y cada variante
  // con su propio stepper. Así se ven y controlan varias variantes del mismo
  // producto a la vez (ej. 1 de L/Negro + 1 de M/Rojo).
  const renderProductCard = (p: RenderProduct) => {
    const soldOut = !p.variants.some((v) => v.sellable)
    const images = galleryFor(p)
    const priceLabel = priceLabelFor(p)
    return (
      <div
        key={p.id}
        className={cx(
          "flex flex-col rounded-lg border bg-background p-2 transition",
          unitsOfProduct(p) > 0 ? "border-primary bg-primary/5" : "border-border",
          soldOut && "opacity-60",
        )}
      >
        {/* Se reserva el área cuadrada siempre, con o sin imagen, para que las
            cards de la grilla queden alineadas. */}
        {images.length > 0 ? (
          <ProductGallery images={images} alt={p.title} size="lg" />
        ) : (
          <div className="aspect-square w-full rounded-md bg-subtle" />
        )}

        <p className="mt-2 line-clamp-2 text-sm font-medium text-foreground">
          {p.title}
        </p>
        {soldOut ? (
          <p className="text-xs text-muted-foreground">Agotado</p>
        ) : (
          priceLabel && (
            <p className="mt-0.5 text-sm text-foreground">{priceLabel}</p>
          )
        )}

        {/* Variantes con su stepper (precio omitido: ya está arriba). Colapsan
            si son muchas. */}
        {!soldOut && renderVariantSection(p, false)}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {layout === "cards" ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {products.map((p) => renderProductCard(p))}
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((p) => renderProductRow(p))}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {totalUnits}/{max} {totalUnits === 1 ? "unidad" : "unidades"}
          {totalUnits < min
            ? ` · elegí al menos ${min}`
            : !atMax && remaining > 0
              ? ` · podés agregar ${remaining} más`
              : ""}
        </span>
        {showPrice && cartTotal > 0 && (
          <span className="font-medium text-foreground">
            {formatPrice(cartTotal, cartCurrency)}
          </span>
        )}
      </div>
    </div>
  )
}
