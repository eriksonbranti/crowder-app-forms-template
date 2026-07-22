import { getCurrentUser } from "@/adapters/supabase/server"
import type { TransactionStatus } from "@/lib/db/schema"
import { exportTableResponse, parseExportFormat } from "@/lib/export-table"
import { createLogger } from "@/lib/log"
import { buildSalesTable, catalogsRepo, getCatalog } from "@/modules/catalogs"
import { getFormsByIds } from "@/modules/forms"
import { exportAll } from "@/modules/submissions"

// Reporte de vendidos del catálogo: una fila por línea de producto elegida en
// submissions cuya transacción está confirmada (o reembolsada, con columna de
// estado). Incluye datos del comprador, titular y formulario de origen.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const log = createLogger("api.admin.export-sales")
  const { id } = await params
  const url = new URL(req.url)
  const format = parseExportFormat(url.searchParams.get("format"))
  // Por defecto incluye reembolsadas (columna Estado las distingue); ?refunded=0 las omite.
  const includeRefunded = url.searchParams.get("refunded") !== "0"
  log.in({ catalogId: id, format, includeRefunded })

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

  const statuses: TransactionStatus[] = includeRefunded
    ? ["confirmed", "refunded"]
    : ["confirmed"]

  // Dos queries independientes: la de IDs no depende de las submissions.
  const [productIds, rows] = await Promise.all([
    catalogsRepo.productIdsForCatalog(id),
    exportAll(statuses),
  ])
  const catalogProductIds = new Set(productIds)

  // Títulos de formulario para la columna "Formulario" (una consulta batch).
  const formIds = [...new Set(rows.map((r) => r.submission.formId))]
  const forms = formIds.length ? await getFormsByIds(formIds) : []
  const formTitleById = new Map(forms.map((f) => [f.id, f.title]))

  const table = buildSalesTable(rows, catalogProductIds, formTitleById)

  const stamp = new Date().toISOString().slice(0, 10)
  const basename = `vendidos-${id}-${stamp}`
  log.out(200, { basename, format, rows: table.rows.length })
  return exportTableResponse(table, format, basename)
}
