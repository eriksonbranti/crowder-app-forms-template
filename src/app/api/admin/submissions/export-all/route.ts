import { inArray } from "drizzle-orm"

import { getCurrentUser } from "@/adapters/supabase/server"
import {
  exportTableResponse,
  parseExportFormat,
} from "@/lib/export-table"
import { db } from "@/lib/db"
import { createLogger } from "@/lib/log"
import { formVersions, type TransactionStatus } from "@/lib/db/schema"
import { buildAllExportTable, exportAll } from "@/modules/submissions"

export async function GET(req: Request) {
  const log = createLogger("api.admin.export-all")

  const url = new URL(req.url)
  const includeAll = url.searchParams.get("includeAll") === "1"
  const format = parseExportFormat(url.searchParams.get("format"))

  log.in({ query: { includeAll, format } })

  const user = await getCurrentUser()
  if (!user) {
    log.out(401, { code: "auth_invalid" })
    return new Response("auth_invalid", { status: 401 })
  }

  const statuses: TransactionStatus[] = includeAll
    ? ["valid", "reserved", "confirmed", "expired", "refunded"]
    : ["confirmed"]

  const rows = await exportAll(statuses)

  // Load every (formId, version) definition referenced by the rows so the
  // builder can emit the full union of answer columns.
  const formIds = [...new Set(rows.map((r) => r.submission.formId))]
  const versions = formIds.length
    ? await db
        .select()
        .from(formVersions)
        .where(inArray(formVersions.formId, formIds))
    : []

  const table = buildAllExportTable({ rows, versions })

  const stamp = new Date().toISOString().slice(0, 10)
  const basename = `submissions-${includeAll ? "all" : "confirmed"}-${stamp}`

  log.out(200, {
    basename,
    format,
    rows: table.rows.length,
    columns: table.columns.length,
    forms: formIds.length,
  })
  return exportTableResponse(table, format, basename)
}
