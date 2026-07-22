// Crowder Embedded App protocol — submit step.
// Spec: https://crowder-docs.vercel.app/embedded-app/
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { DomainError, errorEnvelope, statusForCode } from "@/lib/errors"
import { jsonDomainError, jsonError, requireAllowedOrigin } from "@/lib/http"
import { createLogger } from "@/lib/log"
import { unionEffectiveOrigins } from "@/lib/origins"
import { rateLimit } from "@/lib/rate-limit"
import { getAllowedOriginsByForm } from "@/modules/forms"
import { getConfig } from "@/modules/partner-config"
import { submitBatch } from "@/modules/submissions"

export const dynamic = "force-dynamic"

// Límites de tamaño (CWE-770): este endpoint es público por diseño — lo invoca
// un comprador anónimo desde el iframe same-origin, sin credencial de usuario.
// El check de Origin (requireAllowedOrigin) es protección anti-CSRF de
// navegador, NO autenticación: un cliente no-navegador puede falsear el header.
// Por eso acotamos el tamaño del batch para limitar el abuso de escrituras.
const MAX_ITEMS = 200
const MAX_SUBMISSIONS = 1_000
const MAX_ANSWER_KEYS = 200

const itemSchema = z
  .object({
    uuid: z.string().min(1),
    // `show` no aplica a productos como abonos de temporada (no atados a un
    // partido concreto), así que es opcional igual que `sectionName`.
    show: z.string().nullable().default(null),
    sectorName: z.string(),
    rateName: z.string(),
    sectionName: z.string().nullable().default(null),
    row: z.string().nullable().default(null),
    seat: z.string().nullable().default(null),
    quantity: z.number().int().min(1),
    price: z.number(),
    holder: z
      .object({
        firstName: z.string(),
        lastName: z.string(),
        documentType: z.string(),
        documentNumber: z.string(),
      })
      .nullable()
      .default(null),
  })
  // Conservamos cualquier campo adicional que envíe el iframe para no perder
  // información no contemplada aún en el schema.
  .passthrough()

const contextSchema = z.object({
  eventId: z.number().int(),
  eventName: z.string(),
  currency: z.string().min(1),
  locale: z.string().optional(),
  user: z
    .object({
      email: z.string().nullable().default(null),
      firstName: z.string().nullable().default(null),
      lastName: z.string().nullable().default(null),
      country: z.string().nullable().default(null),
    })
    .passthrough()
    .nullable()
    .optional(),
  items: z.array(itemSchema).max(MAX_ITEMS),
}).passthrough()

const submissionSchema = z.object({
  formId: z.string().min(1),
  groupId: z.string().min(1),
  scope: z.enum(["transaction", "item"]),
  itemUuid: z.string().nullable().optional(),
  answers: z
    .record(z.unknown())
    .refine((a) => Object.keys(a).length <= MAX_ANSWER_KEYS, {
      message: `too many answer keys (max ${MAX_ANSWER_KEYS})`,
    }),
})

const bodySchema = z.object({
  context: contextSchema,
  submissions: z.array(submissionSchema).max(MAX_SUBMISSIONS),
})

export async function POST(req: NextRequest) {
  const log = createLogger("api.submit")
  const origin = req.headers.get("origin")
  log.in({ origin })

  const rl = rateLimit(req, { bucket: "submit", limit: 30, windowMs: 60_000 })
  if (rl) {
    log.out(429, { reason: "rate_limit" })
    return rl
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    log.out(400, { code: "invalid_payload", reason: "invalid_json" })
    return jsonError("invalid_payload", "invalid JSON")
  }

  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    log.out(400, { code: "invalid_payload", payload: raw, issues: parsed.error.issues })
    return jsonError("invalid_payload", "body shape invalid", {
      issues: parsed.error.issues,
    })
  }

  // Origin check: unión de los allowedOrigins efectivos de los forms de este
  // batch. Cada form que tenga su lista vacía hereda los orígenes globales del
  // partner_config (override semantics, igual que el theme). Same-origin
  // (iframe → its own backend) passes implicitly. Lo resolvemos en paralelo
  // con getConfig() porque ninguno depende del otro.
  const formIds = Array.from(
    new Set(parsed.data.submissions.map((s) => s.formId)),
  )
  const [perFormOrigins, cfg] = await Promise.all([
    getAllowedOriginsByForm(formIds),
    getConfig(),
  ])
  const allowedOrigins = unionEffectiveOrigins(
    perFormOrigins,
    cfg?.allowedOrigins ?? [],
  )
  const originCheck = requireAllowedOrigin(
    origin,
    allowedOrigins,
    req.nextUrl.origin,
  )
  if (!originCheck.ok) {
    log.out(401, { code: "auth_invalid" })
    return originCheck.response
  }

  // Currency / protocol validation against partner_config.
  if (
    cfg &&
    cfg.supportedCurrencies.length > 0 &&
    !cfg.supportedCurrencies.includes(parsed.data.context.currency)
  ) {
    log.out(400, {
      code: "unsupported_currency",
      currency: parsed.data.context.currency,
    })
    return jsonError(
      "unsupported_currency",
      `currency '${parsed.data.context.currency}' not supported`,
    )
  }

  try {
    const { transactionId, partnerItems } = await submitBatch({
      context: parsed.data.context,
      submissions: parsed.data.submissions.map((s) => ({
        formId: s.formId,
        groupId: s.groupId,
        scope: s.scope,
        itemUuid: s.itemUuid ?? null,
        answers: s.answers,
      })),
    })
    const body = {
      interaction: transactionId,
      currency: parsed.data.context.currency,
      partnerItems,
    }
    log.out(200, { body, payload: raw })
    return NextResponse.json(body)
  } catch (err) {
    if (err instanceof DomainError) {
      // Submission validation aggregates field errors under details.errors and
      // returns 422 per spec; everything else uses the default code → http map.
      if (err.details?.errors) {
        const envelope = errorEnvelope(err)
        log.out(422, { body: envelope })
        return NextResponse.json(envelope, { status: 422 })
      }
      log.out(statusForCode(err.code), { code: err.code, message: err.message })
      return jsonDomainError(err)
    }
    log.out(500, { error: err instanceof Error ? err.message : String(err) })
    throw err
  }
}
