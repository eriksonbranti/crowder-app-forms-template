import { z } from "zod"

import type { FormDefinition } from "@/lib/db/schema"
import { MAX_PARTNER_ITEMS } from "@/lib/products/derive"

const visibleWhenSchema = z.object({
  question: z.string().min(1),
  equals: z.union([z.string(), z.number(), z.boolean()]),
})

const prefillFromValues = [
  "item.holder.firstName",
  "item.holder.lastName",
  "item.holder.documentType",
  "item.holder.documentNumber",
  "user.email",
  "user.firstName",
  "user.lastName",
  "user.country",
] as const

const itemPrefillValues = new Set<(typeof prefillFromValues)[number]>([
  "item.holder.firstName",
  "item.holder.lastName",
  "item.holder.documentType",
  "item.holder.documentNumber",
])

const SNAKE_CASE_ID = /^[a-z][a-z0-9_]*$/

const questionTypeValues = [
  "short_text",
  "long_text",
  "number",
  "email",
  "phone",
  "single_choice",
  "multiple_choice",
  "dropdown",
  "date",
  "datetime",
  "time",
  "country",
  "document_id",
  "scale",
  "consent",
  "info",
  "product",
] as const

const CHOICE_TYPES = new Set<(typeof questionTypeValues)[number]>([
  "single_choice",
  "multiple_choice",
  "dropdown",
])

const optionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
})

const validationSchema = z
  .object({
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().optional(),
    message: z.string().optional(),
  })
  .optional()

const questionSchema = z
  .object({
    id: z.string().min(1).regex(SNAKE_CASE_ID, "id must be snake_case"),
    type: z.enum(questionTypeValues),
    label: z.string().min(1),
    help: z.string().nullable().default(null),
    required: z.boolean().default(false),
    placeholder: z.string().nullable().default(null),
    validation: validationSchema,
    options: z.array(optionSchema).optional(),
    scale: z
      .object({
        min: z.number().int(),
        max: z.number().int(),
        minLabel: z.string().optional(),
        maxLabel: z.string().optional(),
      })
      .optional(),
    consent: z.object({ mustAccept: z.boolean() }).optional(),
    product: z
      .object({
        source: z.enum(["collection", "catalog", "curated"]).optional(),
        catalogId: z.string().min(1),
        collectionId: z.string().min(1).optional(),
        filter: z
          .object({
            tag: z.string().optional(),
            collection: z.string().optional(),
            status: z.literal("active").optional(),
          })
          .optional(),
        productIds: z.array(z.string().min(1)).optional(),
        // "perTickets": min/max se derivan de la cantidad de entradas (1 por
        // entrada); "fixed" (default): usa los min/max de abajo.
        quantitySource: z.enum(["fixed", "perTickets"]).optional(),
        min: z.number().int().min(0).optional(),
        // Salvaguarda anti-abuso (ya no el "1–10" del protocolo, que Crowder acepta
        // superar): cota alta al máximo configurable.
        max: z.number().int().min(1).max(MAX_PARTNER_ITEMS).optional(),
        showPrice: z.boolean().optional(),
        layout: z.enum(["list", "cards"]).optional(),
      })
      .optional(),
    prefillFrom: z.enum(prefillFromValues).optional(),
    visibleWhen: visibleWhenSchema.optional(),
  })
  .superRefine((q, ctx) => {
    if (CHOICE_TYPES.has(q.type) && (!q.options || q.options.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: `'${q.type}' requires non-empty options`,
      })
    }
    if (q.type === "scale" && !q.scale) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scale"],
        message: "'scale' requires scale config",
      })
    }
    if (q.type === "consent" && !q.consent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["consent"],
        message: "'consent' requires consent config",
      })
    }
    if (q.type === "product") {
      if (!q.product) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["product"],
          message: "'product' requires product config with catalogId",
        })
      } else {
        const p = q.product
        if (p.min != null && p.max != null && p.min > p.max) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["product", "min"],
            message: "min cannot be greater than max",
          })
        }
        // Consistencia del modo de listado (la colección es el modo principal):
        if (p.source === "collection" && !p.collectionId && !p.filter?.collection) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["product", "collectionId"],
            message: "source 'collection' requires collectionId",
          })
        }
        if (p.source === "curated" && (!p.productIds || p.productIds.length === 0)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["product", "productIds"],
            message: "source 'curated' requires at least one productId",
          })
        }
      }
    }
  })

const groupSchema = z
  .object({
    id: z.string().min(1).regex(SNAKE_CASE_ID, "id must be snake_case"),
    title: z.string().min(1),
    description: z.string().nullable().default(null),
    scope: z.enum(["transaction", "item"]),
    labelTemplate: z.string().min(1),
    visibleWhen: visibleWhenSchema.optional(),
    questions: z.array(questionSchema).min(1),
  })
  .superRefine((group, ctx) => {
    const ids = new Set<string>()
    group.questions.forEach((q, idx) => {
      if (ids.has(q.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["questions", idx, "id"],
          message: `duplicate question id '${q.id}'`,
        })
      }
      ids.add(q.id)
      if (
        q.prefillFrom &&
        group.scope === "transaction" &&
        itemPrefillValues.has(q.prefillFrom)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["questions", idx, "prefillFrom"],
          message: "item.holder.* prefill only valid in scope=item groups",
        })
      }
    })
  })

export const formDefinitionSchema = z
  .object({
    schemaVersion: z.literal(1),
    groups: z.array(groupSchema).min(1),
  })
  .superRefine((def, ctx) => {
    const groupIds = new Set<string>()
    def.groups.forEach((g, idx) => {
      if (groupIds.has(g.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["groups", idx, "id"],
          message: `duplicate group id '${g.id}'`,
        })
      }
      groupIds.add(g.id)
    })
  })

export function parseFormDefinition(raw: unknown): FormDefinition {
  return formDefinitionSchema.parse(raw) as FormDefinition
}

export function emptyDefinition(): FormDefinition {
  return {
    schemaVersion: 1,
    groups: [
      {
        id: "general",
        title: "General",
        description: null,
        scope: "transaction",
        labelTemplate: "General",
        questions: [
          {
            id: "info",
            type: "info",
            label: "Información",
            help: null,
            required: false,
            placeholder: null,
          },
        ],
      },
    ],
  }
}
