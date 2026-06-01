// Crowder Embedded App protocol — lifecycle webhook (server-to-server, Bearer auth).
// Spec: https://crowder-docs.vercel.app/embedded-app/
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { verifyBearer } from "@/adapters/crowder/auth"
import { refundReasonEnum } from "@/lib/db/schema"
import { DomainError, errorEnvelope, statusForCode } from "@/lib/errors"
import { jsonError } from "@/lib/http"
import { createLogger } from "@/lib/log"
import { acceptedApiKeys } from "@/modules/partner-config"
import { handle, logResult } from "@/modules/webhooks"

export const dynamic = "force-dynamic"

const bodySchema = z.object({
  status: z.enum([
    "purchaseReserved",
    "purchasePaid",
    "purchaseExpired",
    "purchaseRefunded",
  ]),
  currency: z.string().optional(),
  partnerItems: z.array(z.unknown()).optional(),
  expiresAt: z.string().datetime({ offset: true }).optional(),
  purchase: z
    .object({ id: z.number().int(), amount: z.number() })
    .optional(),
  // purchaseRefunded payload per spec: `{ reason, items }`. We don't model
  // items, so `items` is accepted but ignored; refund metadata (id, timestamp)
  // is generated server-side.
  reason: z.enum(refundReasonEnum.enumValues).optional(),
  items: z.array(z.unknown()).optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const log = createLogger("api.events")
  const { id: transactionId } = await params
  log.in({ transactionId })

  const keys = await acceptedApiKeys()
  if (!verifyBearer(req.headers.get("authorization"), keys)) {
    log.out(401, { transactionId, code: "auth_invalid" })
    return jsonError("auth_invalid", "invalid bearer")
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    log.out(400, { transactionId, code: "invalid_payload", reason: "invalid_json" })
    return jsonError("invalid_payload", "invalid JSON")
  }

  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    const isUnsupportedStatus = parsed.error.issues.some(
      (i) => i.path[0] === "status",
    )
    const code = isUnsupportedStatus ? "unsupported_event" : "invalid_payload"
    log.out(400, { transactionId, code, payload: raw, issues: parsed.error.issues })
    return isUnsupportedStatus
      ? jsonError("unsupported_event", "unsupported status")
      : jsonError("invalid_payload", "body shape invalid")
  }

  try {
    const result = await handle({
      transactionId,
      status: parsed.data.status,
      payload: parsed.data,
    })

    if (!result.cached) {
      await logResult({
        transactionId,
        status: parsed.data.status,
        payload: parsed.data,
        responseStatus: result.status,
        responseBody: result.body,
      })
    }

    log.out(result.status, {
      transactionId,
      cached: result.cached,
      payload: parsed.data,
      body: result.body,
    })
    return NextResponse.json(result.body, { status: result.status })
  } catch (err) {
    if (err instanceof DomainError) {
      const envelope = errorEnvelope(err)
      const httpStatus = statusForCode(err.code)
      await logResult({
        transactionId,
        status: parsed.data.status,
        payload: parsed.data,
        responseStatus: httpStatus,
        responseBody: envelope,
      })
      log.out(httpStatus, { transactionId, code: err.code, body: envelope })
      return NextResponse.json(envelope, { status: httpStatus })
    }
    log.out(500, {
      transactionId,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}
