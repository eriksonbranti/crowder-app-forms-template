import { NextResponse, type NextRequest } from "next/server"

import { env } from "@/lib/env"
import { jsonError } from "@/lib/http"
import { createLogger } from "@/lib/log"
import { expireStale } from "@/modules/transactions"

export const dynamic = "force-dynamic"

async function handle(req: NextRequest) {
  const log = createLogger("api.cron.expire")
  log.in({ method: req.method })

  const secret = env.CRON_SECRET
  if (!secret) {
    log.out(401, { code: "auth_invalid", reason: "no_secret_configured" })
    return jsonError(
      "auth_invalid",
      "CRON_SECRET is not configured; expiration endpoint is disabled",
    )
  }
  const auth = req.headers.get("authorization") ?? ""
  if (auth !== `Bearer ${secret}`) {
    log.out(401, { code: "auth_invalid", reason: "bad_secret" })
    return jsonError("auth_invalid", "invalid cron secret")
  }
  const expired = await expireStale()
  const body = { expired }
  log.out(200, { body })
  return NextResponse.json(body)
}

// Vercel Cron hits the path with GET and injects the configured Bearer.
// Keep POST exported for manual invocation / testing.
export const GET = handle
export const POST = handle
