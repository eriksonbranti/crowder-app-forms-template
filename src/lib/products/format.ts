// Formato de precio para el iframe (definition sección 8.3 / sección 10): prohibido
// mostrar el número crudo (p. ej. 15000.5). Usa el registro de monedas para el
// símbolo (S/, AR$, …) y los decimales/locale; Intl solo formatea el número.
import { getCurrency } from "./currencies"

const DEFAULT_LOCALE = "es-AR"

// Construir Intl.NumberFormat es lo caro; .format() es barato. formatPrice se
// llama por variante en cada render (ProductSelector, CatalogDetail), así que
// cacheamos los formatters por (locale, opciones).
const formatterCache = new Map<string, Intl.NumberFormat>()
function numberFormat(
  locale: string,
  opts: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(opts)}`
  let fmt = formatterCache.get(key)
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, opts)
    formatterCache.set(key, fmt)
  }
  return fmt
}

// Rango de precios (lo/hi) de una lista de variantes; null si ninguna tiene
// precio. Primitiva compartida por el listado del fan (ProductSelector) y el
// dashboard (CatalogDetail), que solo difieren en el texto final. `onlySellable`
// limita a variantes vendibles (lo que ve el fan); el dashboard las incluye todas.
export function priceRange(
  variants: { price: number | null; sellable?: boolean }[],
  opts?: { onlySellable?: boolean },
): { lo: number; hi: number } | null {
  let lo = Infinity
  let hi = -Infinity
  for (const v of variants) {
    if (opts?.onlySellable && !v.sellable) continue
    if (v.price == null) continue
    if (v.price < lo) lo = v.price
    if (v.price > hi) hi = v.price
  }
  return lo === Infinity ? null : { lo, hi }
}

export function formatPrice(
  amount: number,
  currency: string | null | undefined,
  locale?: string,
): string {
  if (!currency) return String(amount)
  const def = getCurrency(currency)
  if (def) {
    const n = numberFormat(locale ?? def.locale, {
      minimumFractionDigits: def.decimals,
      maximumFractionDigits: def.decimals,
    }).format(amount)
    return `${def.symbol} ${n}`
  }
  // Moneda fuera del registro: fallback a Intl currency-style; si tampoco la
  // conoce, número legible con el código crudo sin romper el render.
  try {
    return numberFormat(locale ?? DEFAULT_LOCALE, {
      style: "currency",
      currency,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}
