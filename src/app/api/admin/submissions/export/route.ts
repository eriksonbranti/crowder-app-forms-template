import { getCurrentUser } from "@/adapters/supabase/server"
import {
  exportTableResponse,
  parseExportFormat,
} from "@/lib/export-table"
import { createLogger } from "@/lib/log"
import { findPublished } from "@/modules/forms"
import { buildGroupExportTable, drilldown } from "@/modules/submissions"
import type { ExportPreset } from "@/modules/submissions"
import type { TransactionStatus } from "@/lib/db/schema"

export async function GET(req: Request) {
  const log = createLogger("api.admin.export")

  const url = new URL(req.url)
  const eventId = Number(url.searchParams.get("eventId"))
  const formId = url.searchParams.get("formId") ?? ""
  const groupId = url.searchParams.get("groupId") ?? ""
  const preset = (url.searchParams.get("preset") ?? "full") as ExportPreset
  const includeAll = url.searchParams.get("includeAll") === "1"
  const format = parseExportFormat(url.searchParams.get("format"))

  log.in({ query: { eventId, formId, groupId, preset, includeAll, format } })

  const user = await getCurrentUser()
  if (!user) {
    log.out(401, { code: "auth_invalid" })
    return new Response("auth_invalid", { status: 401 })
  }

  const published = await findPublished(formId)
  if (!published) {
    log.out(404, { code: "form_not_published", formId })
    return new Response("form_not_published", { status: 404 })
  }
  const group = published.version.definition.groups.find((g) => g.id === groupId)
  if (!group) {
    log.out(404, { code: "group_not_found", groupId })
    return new Response("group_not_found", { status: 404 })
  }

  const statuses: TransactionStatus[] = includeAll
    ? ["valid", "reserved", "confirmed", "expired", "refunded"]
    : ["confirmed"]

  const rows = await drilldown({ eventId, formId, groupId, statuses, limit: null })

  const table = buildGroupExportTable({ rows, group, preset })
  const basename = `${formId}-${groupId}-${preset}`

  log.out(200, {
    basename,
    format,
    rows: table.rows.length,
    columns: table.columns.length,
  })
  return exportTableResponse(table, format, basename)
}
