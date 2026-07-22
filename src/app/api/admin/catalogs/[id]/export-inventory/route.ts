import { getCurrentUser } from "@/adapters/supabase/server"
import { exportTableResponse, parseExportFormat } from "@/lib/export-table"
import { createLogger } from "@/lib/log"
import { buildInventoryTable, getCatalog, listProducts } from "@/modules/catalogs"
import { sumByProductVariant } from "@/modules/stock-reservations"

// Reporte de inventario del catálogo: una fila por variante con stock físico,
// reservado (holds), disponible (stock − reservado) y vendido acumulado.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const log = createLogger("api.admin.export-inventory")
  const { id } = await params
  const format = parseExportFormat(new URL(req.url).searchParams.get("format"))
  log.in({ catalogId: id, format })

  const user = await getCurrentUser()
  if (!user) {
    log.out(401, { code: "auth_invalid" })
    return new Response("auth_invalid", { status: 401 })
  }

  const catalog = await getCatalog(id)
  if (!catalog) {
    log.out(404, { code: "catalog_not_found", catalogId: id })
    return new Response("catalog_not_found", { status: 404 })
  }

  const products = await listProducts(id)
  const agg = await sumByProductVariant(products.map((p) => p.id))
  const table = buildInventoryTable(products, agg)

  const stamp = new Date().toISOString().slice(0, 10)
  const basename = `inventario-${id}-${stamp}`
  log.out(200, { basename, format, rows: table.rows.length })
  return exportTableResponse(table, format, basename)
}
