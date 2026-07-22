import { NextResponse } from "next/server"

import { getCurrentUser } from "@/adapters/supabase/server"
import { createLogger } from "@/lib/log"
import { toPicks } from "@/lib/products/derive"
import { mergePicksIntoListing } from "@/lib/products/merge"
import type { RenderProduct } from "@/lib/products/types"
import { resolveListing, toRenderProduct } from "@/modules/catalogs"
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
  // Resuelve los listados de las preguntas `product` como en el iframe público,
  // pero fusionando los picks ya guardados: así una submission con productos
  // archivados/borrados sigue siendo visible y editable (opción snapshot+catálogo).
  const productLists: Record<string, RenderProduct[]> = {}
  const productQuestions = group.questions.filter(
    (q) => q.type === "product" && q.product,
  )
  await Promise.all(
    productQuestions.map(async (q) => {
      const rendered = (await resolveListing(q.product!)).map(toRenderProduct)
      const picks = toPicks(submission.answers[q.id])
      productLists[q.id] = mergePicksIntoListing(rendered, picks)
    }),
  )

  log.out(200, { submissionId: id, groupId: group.id })
  return NextResponse.json({ group, productLists })
}
