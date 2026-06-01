import { NextResponse } from "next/server"

import { getCurrentUser } from "@/adapters/supabase/server"
import { createLogger } from "@/lib/log"
import { findById } from "@/modules/submissions"
import { getVersion } from "@/modules/forms"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const log = createLogger("api.admin.submission.form")
  const { id } = await params
  log.in({ submissionId: id })

  const user = await getCurrentUser()
  if (!user) {
    log.out(401, { submissionId: id, error: "auth_invalid" })
    return NextResponse.json({ error: "auth_invalid" }, { status: 401 })
  }
  const submission = await findById(id)
  if (!submission) {
    log.out(404, { submissionId: id, error: "not_found" })
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }
  const version = await getVersion(submission.formId, submission.formVersion)
  if (!version) {
    log.out(500, { submissionId: id, error: "version_missing" })
    return NextResponse.json({ error: "version_missing" }, { status: 500 })
  }
  const group = version.definition.groups.find(
    (g) => g.id === submission.groupId,
  )
  if (!group) {
    log.out(500, { submissionId: id, error: "group_missing" })
    return NextResponse.json({ error: "group_missing" }, { status: 500 })
  }
  log.out(200, { submissionId: id, groupId: group.id })
  return NextResponse.json({ group })
}
