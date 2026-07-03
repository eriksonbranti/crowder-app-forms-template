import type { FormQuestion, GroupScope } from "@/lib/db/schema"

import { MAX_PARTNER_ITEMS } from "./derive"

// Suma de UNIDADES de un carrito de picks (cada línea cuenta `quantity ?? 1`).
// Definición central del modelo: el min/max de una pregunta `product` cuenta
// unidades totales, no líneas. Compartida por la validación y el iframe.
export function sumUnits(picks: { quantity?: number }[]): number {
  return picks.reduce((n, p) => n + (p.quantity ?? 1), 0)
}

// Cuántos "tickets" cuentan para derivar el min/max de una pregunta `product`
// en modo `perTickets`. Convención acordada: la cantidad es el NÚMERO DE LÍNEAS
// de la transacción (context.items.length), no la suma de cantidades.
//
// El scope define a qué se ata el conteo:
//   - "transaction": la pregunta se responde una vez para toda la compra → cuenta
//     todas las líneas (itemsLength).
//   - "item": la pregunta se responde por cada línea → cada submission ve 1 ticket.
export function ticketCountForScope(
  scope: GroupScope,
  itemsLength: number,
): number {
  return scope === "transaction" ? itemsLength : 1
}

// Resuelve el min/max EFECTIVO de una pregunta `product` (única fuente de verdad
// para validación, iframe e Inspector).
//
//   - modo "fixed" (default): usa los min/max configurados tal cual.
//   - modo "perTickets": 1 producto por entrada (1:1 exacto) → min = max =
//     ticketCount, SIN clamp (ver MAX_PARTNER_ITEMS: ya no es tope del protocolo,
//     solo salvaguarda anti-abuso en la derivación). Si no se conoce el ticketCount
//     (p. ej. edición admin sin contexto de la compra), cae a un rango ESTRUCTURAL
//     laxo (0..salvaguarda): valida forma, no el 1:1 exacto — que ya se validó
//     estricto en el submit original.
export function resolveQuantityBounds(
  cfg: FormQuestion["product"],
  ticketCount?: number,
): { min: number; max: number } {
  // Sin config (o pregunta no-product): rango por defecto de un único ítem.
  if (!cfg) return { min: 0, max: 1 }
  if (cfg.quantitySource === "perTickets") {
    if (ticketCount == null) return { min: 0, max: MAX_PARTNER_ITEMS }
    const n = Math.max(ticketCount, 0)
    return { min: n, max: Math.max(n, 1) }
  }
  return { min: cfg.min ?? 0, max: cfg.max ?? 1 }
}
