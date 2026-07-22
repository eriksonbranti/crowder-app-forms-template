import { isProductPick, toPicks } from "@/lib/products/derive"
import type { ExportCell, ExportTable } from "@/lib/export-table"
import type { VariantReservationTotals } from "@/modules/stock-reservations"
import type { ExportAllRow } from "@/modules/submissions"

import type { Product } from "./repository"

// Totales de reserva por (producto:variante). `held` = reservado sin pagar;
// `consumed` = vendido confirmado (ya descontado de variant.stock).
type StockAgg = Map<string, VariantReservationTotals>

// ─── Reporte A: inventario ────────────────────────────────────────────────
// Una fila por variante. `variant.stock` es el stock físico ya neto de ventas
// (confirmStock lo decrementa), así que disponible = stock − reservado(held).
export function buildInventoryTable(
  products: Product[],
  agg: StockAgg,
): ExportTable {
  const columns = [
    { header: "Producto" },
    { header: "Variante" },
    { header: "SKU" },
    { header: "Estado" },
    { header: "Controla stock" },
    { header: "Stock físico", type: "number" as const },
    { header: "Reservado", type: "number" as const },
    { header: "Disponible", type: "number" as const },
    { header: "Vendido (acum.)", type: "number" as const },
    { header: "Política oversell" },
    { header: "Precio", type: "number" as const },
    { header: "Moneda" },
  ]
  const rows: ExportCell[][] = []
  for (const p of products) {
    for (const v of p.variants) {
      const totals = agg.get(`${p.id}:${v.id}`) ?? { held: 0, consumed: 0 }
      const tracked = v.stockTracked
      const onHand = v.stock ?? 0
      rows.push([
        p.title,
        v.title,
        v.sku ?? "",
        v.status,
        tracked ? "Sí" : "No",
        tracked ? onHand : null,
        tracked ? totals.held : null,
        tracked ? Math.max(0, onHand - totals.held) : "Ilimitado",
        totals.consumed || null,
        v.oversellPolicy,
        v.price ?? null,
        p.currency ?? "",
      ])
    }
  }
  return { columns, rows }
}

// ─── Reporte B: vendidos ────────────────────────────────────────────────────
// Una fila por línea de producto elegida (pick) en submissions cuya transacción
// está en `statuses` (confirmed/refunded). Los picks viven en submissions.answers
// como snapshot congelado; filtramos los que pertenecen a este catálogo.
export function buildSalesTable(
  rows: ExportAllRow[],
  catalogProductIds: Set<string>,
  formTitleById: Map<string, string>,
): ExportTable {
  const columns = [
    { header: "Fecha" },
    { header: "Estado" },
    { header: "Producto" },
    { header: "Variante" },
    { header: "SKU" },
    { header: "Cantidad", type: "number" as const },
    { header: "Precio unit.", type: "number" as const },
    { header: "Moneda" },
    { header: "Comprador (email)" },
    { header: "Comprador (nombre)" },
    { header: "Titular (nombre)" },
    { header: "Titular (documento)" },
    { header: "Formulario" },
    { header: "Form ID" },
    { header: "Transacción" },
    { header: "Purchase ID", type: "number" as const },
    { header: "Evento" },
  ]
  const out: ExportCell[][] = []
  for (const r of rows) {
    const s = r.submission
    const date = r.transactionCreatedAt.toISOString().slice(0, 10)
    const buyerName = [r.userFirstName, r.userLastName]
      .filter(Boolean)
      .join(" ")
    const holderName = [s.holderFirstName, s.holderLastName]
      .filter(Boolean)
      .join(" ")
    for (const value of Object.values(s.answers)) {
      for (const pick of toPicks(value)) {
        if (!isProductPick(pick)) continue
        if (!catalogProductIds.has(pick.productId)) continue
        const snap = pick.snapshot
        out.push([
          date,
          r.transactionStatus,
          snap.title,
          snap.variantTitle ?? "",
          snap.sku ?? "",
          pick.quantity ?? 1,
          snap.price ?? null,
          snap.currency ?? r.transactionCurrency ?? "",
          r.userEmail ?? "",
          buyerName,
          holderName,
          s.holderDocument ?? "",
          formTitleById.get(s.formId) ?? "",
          s.formId,
          s.transactionId,
          r.transactionPurchaseId ?? null,
          r.transactionEventName,
        ])
      }
    }
  }
  return { columns, rows: out }
}
