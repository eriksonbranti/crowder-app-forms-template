// Crowder Embedded App protocol — state read (server-to-server, Bearer auth).
// Spec: https://crowder-docs.vercel.app/embedded-app/
import { NextResponse, type NextRequest } from "next/server"

import { verifyBearer } from "@/adapters/crowder/auth"
import { jsonError } from "@/lib/http"
import { createLogger } from "@/lib/log"
import { acceptedApiKeys } from "@/modules/partner-config"
import { findById } from "@/modules/transactions"

export const dynamic = "force-dynamic"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const log = createLogger("api.state")
  const { id } = await params
  log.in({ transactionId: id })

  const keys = await acceptedApiKeys()
  if (!verifyBearer(req.headers.get("authorization"), keys)) {
    log.out(401, { transactionId: id, code: "auth_invalid" })
    return jsonError("auth_invalid", "invalid bearer")
  }

  const txn = await findById(id)
  if (!txn) {
    log.out(404, { transactionId: id, code: "not_found" })
    return jsonError("not_found", "transaction not found")
  }

  const common = {
    interaction: txn.id,
    currency: txn.currency,
    partnerItems: [],
  }
  const purchase = { id: txn.purchaseId, amount: txn.purchaseAmount }

  const respond = (status: number, body: Record<string, unknown>) => {
    log.out(status, { transactionId: id, body })
    return NextResponse.json(body, { status })
  }

  switch (txn.status) {
    case "valid":
      return respond(200, { status: "valid", ...common })

    case "reserved":
      return respond(200, {
        status: "reserved",
        ...common,
        expiresAt: txn.expiresAt?.toISOString() ?? null,
      })

    case "expired":
      // Documented exception to the envelope: status="expired" carries an
      // `error` so Crowder can propagate the reason; HTTP 410 signals terminal.
      return respond(410, {
        status: "expired",
        interaction: txn.id,
        error: { code: "expired", message: "transaction expired" },
      })

    case "confirmed":
      return respond(200, { status: "confirmed", ...common, purchase })

    case "refunded":
      return respond(200, {
        status: "refunded",
        ...common,
        purchase,
        refund: {
          amount: txn.refundAmount,
          reason: txn.refundReason,
          refundedAt: txn.refundedAt?.toISOString() ?? null,
          refundId: txn.refundId,
        },
      })
  }
}
