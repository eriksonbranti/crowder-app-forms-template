import { getCurrentUser } from "@/adapters/supabase/server"
import {
  exportTableResponse,
  parseExportFormat,
} from "@/lib/export-table"
import { createLogger } from "@/lib/log"
import { findLatest } from "@/modules/forms"
import {
  buildFormExportTable,
  drilldownByForm,
  mergeByPerson,
} from "@/modules/submissions"
import type { FormQuestion, TransactionStatus } from "@/lib/db/schema"

export async function GET(req: Request) {
  const log = createLogger("api.admin.export-form")

  const url = new URL(req.url)
  const formId = url.searchParams.get("formId") ?? ""
  const eventIdParam = url.searchParams.get("eventId")
  const parsedEventId = eventIdParam ? Number(eventIdParam) : undefined
  const eventId = Number.isFinite(parsedEventId) ? parsedEventId : undefined
  const search = url.searchParams.get("q")?.trim() || undefined
  const includeAll = url.searchParams.get("includeAll") === "1"
  const format = parseExportFormat(url.searchParams.get("format"))

  log.in({ query: { formId, eventId, search, includeAll, format } })

  const user = await getCurrentUser()
  if (!user) {
    log.out(401, { code: "auth_invalid" })
    return new Response("auth_invalid", { status: 401 })
  }

  if (!formId) {
    log.out(400, { code: "form_id_required" })
    return new Response("form_id_required", { status: 400 })
  }

  const published = await findLatest(formId)
  if (!published) {
    log.out(404, { code: "form_not_published", formId })
    return new Response("form_not_published", { status: 404 })
  }

  const statuses: TransactionStatus[] = includeAll
    ? ["valid", "reserved", "confirmed", "expired", "refunded"]
    : ["confirmed"]

  const rawRows = await drilldownByForm({ eventId, formId, statuses, search })
  const persons = mergeByPerson(rawRows)

  // Union of questions across all groups, deduped by id, matching the page.
  const seen = new Set<string>()
  const questions: FormQuestion[] = []
  for (const g of published.version.definition.groups) {
    for (const q of g.questions) {
      if (q.type === "info") continue
      if (seen.has(q.id)) continue
      seen.add(q.id)
      questions.push(q)
    }
  }

  const table = buildFormExportTable({ persons, questions })
  const stamp = new Date().toISOString().slice(0, 10)
  const eventTag = eventId !== undefined ? `-event-${eventId}` : ""
  const basename = `${formId}${eventTag}-${stamp}`

  log.out(200, {
    basename,
    format,
    rows: table.rows.length,
    columns: table.columns.length,
  })
  return exportTableResponse(table, format, basename)
}
