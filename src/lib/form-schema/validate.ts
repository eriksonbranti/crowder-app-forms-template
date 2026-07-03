import { z, type ZodTypeAny } from "zod"

import type { FormGroup, FormQuestion } from "@/lib/db/schema"
import { resolveQuantityBounds, sumUnits } from "@/lib/products/quantity"

export function groupHasRequiredQuestion(group: FormGroup): boolean {
  return group.questions.some((q) => q.type !== "info" && q.required)
}

/**
 * Build a zod schema for the `answers` payload of a single group.
 * Rejects unknown keys so callers can't smuggle in arbitrary fields.
 */
// Compiling a group's zod schema allocates RegExps and nested zod nodes per
// question. Callers (the wizard) re-validate on every keystroke, so we cache
// by group identity — refs stay stable while the wizard's `phase` is live.
//
// El `ticketCount` (modo `perTickets` de las preguntas `product`) cambia el
// min/max efectivo, así que cacheamos por grupo Y por ticketCount. El contexto
// de la compra no cambia durante la sesión, así que la clave se mantiene estable.
const schemaCache = new WeakMap<FormGroup, Map<number, z.ZodTypeAny>>()

export function answersSchemaForGroup(
  group: FormGroup,
  opts?: { ticketCount?: number },
): z.ZodTypeAny {
  // -1 = "sin ticketCount" (validación laxa de perTickets); no colisiona con
  // conteos reales (≥ 0).
  const key = opts?.ticketCount ?? -1
  let byCount = schemaCache.get(group)
  if (!byCount) {
    byCount = new Map()
    schemaCache.set(group, byCount)
  }
  const cached = byCount.get(key)
  if (cached) return cached
  const shape: Record<string, ZodTypeAny> = {}
  for (const q of group.questions) {
    if (q.type === "info") continue
    shape[q.id] = schemaForQuestion(q, opts?.ticketCount)
  }
  const schema = z.object(shape).strict()
  byCount.set(key, schema)
  return schema
}

function schemaForQuestion(q: FormQuestion, ticketCount?: number): ZodTypeAny {
  const base = baseSchemaForType(q, ticketCount)
  return q.required ? base : base.optional().nullable()
}

function requiredMessage(q: FormQuestion): string {
  switch (q.type) {
    case "email":
      return "Ingresá tu email"
    case "phone":
      return "Ingresá tu teléfono"
    case "country":
      return "Indicá tu país"
    case "document_id":
      return "Ingresá tu documento"
    case "long_text":
    case "short_text":
      return "Completá esta respuesta"
    case "number":
    case "scale":
      return "Ingresá un valor"
    case "date":
      return "Elegí una fecha"
    case "datetime":
      return "Elegí fecha y hora"
    case "time":
      return "Elegí una hora"
    case "single_choice":
    case "dropdown":
      return "Elegí una opción"
    case "multiple_choice":
      return "Seleccioná al menos una opción"
    case "consent":
      return "Debés aceptar para continuar"
    case "product":
      return "Seleccioná un producto"
    default:
      return "Este campo es obligatorio"
  }
}

function baseSchemaForType(q: FormQuestion, ticketCount?: number): ZodTypeAny {
  const v = q.validation ?? {}
  const msg = v.message
  const requiredMsg = msg ?? requiredMessage(q)

  switch (q.type) {
    case "short_text":
    case "long_text":
    case "country":
    case "document_id": {
      let s = z.string({
        required_error: requiredMsg,
        invalid_type_error: requiredMsg,
      })
      if (v.min != null)
        s = s.min(
          v.min,
          msg ?? `Mínimo ${v.min} caracteres`,
        )
      if (v.max != null)
        s = s.max(
          v.max,
          msg ?? `Máximo ${v.max} caracteres`,
        )
      if (v.pattern)
        s = s.regex(new RegExp(v.pattern), msg ?? "Formato inválido")
      if (q.required) s = s.min(Math.max(v.min ?? 1, 1), requiredMsg)
      return s
    }
    case "email": {
      let s = z
        .string({
          required_error: requiredMsg,
          invalid_type_error: requiredMsg,
        })
        .email(msg ?? "Email inválido")
      if (v.max != null)
        s = s.max(v.max, msg ?? `Máximo ${v.max} caracteres`)
      if (q.required) s = s.min(1, requiredMsg)
      return s
    }
    case "phone": {
      let s = z
        .string({
          required_error: requiredMsg,
          invalid_type_error: requiredMsg,
        })
        .regex(/^[+\d][\d\s\-()]{4,}$/, msg ?? "Teléfono inválido")
      if (v.pattern)
        s = s.regex(new RegExp(v.pattern), msg ?? "Teléfono inválido")
      return s
    }
    case "number": {
      let s = z.number({
        required_error: requiredMsg,
        invalid_type_error: requiredMsg,
      })
      if (v.min != null) s = s.min(v.min, msg ?? `Mínimo ${v.min}`)
      if (v.max != null) s = s.max(v.max, msg ?? `Máximo ${v.max}`)
      return s
    }
    case "single_choice":
    case "dropdown": {
      const values = (q.options ?? []).map((o) => o.value) as [string, ...string[]]
      if (values.length === 0)
        return z.string({
          required_error: requiredMsg,
          invalid_type_error: requiredMsg,
        })
      return z.enum(values, {
        errorMap: () => ({ message: requiredMsg }),
      })
    }
    case "multiple_choice": {
      const values = (q.options ?? []).map((o) => o.value)
      const valueSet = new Set(values)
      const base = z
        .array(z.string(), {
          required_error: requiredMsg,
          invalid_type_error: requiredMsg,
        })
        .superRefine((arr, ctx) => {
          for (const v of arr) {
            if (!valueSet.has(v)) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Opción inválida: ${v}`,
              })
            }
          }
        })
      return q.required
        ? base.refine((arr) => arr.length > 0, { message: requiredMsg })
        : base
    }
    case "date":
      return z
        .string({
          required_error: requiredMsg,
          invalid_type_error: requiredMsg,
        })
        .regex(/^\d{4}-\d{2}-\d{2}$/, msg ?? "Fecha inválida")
    case "datetime":
      return z
        .string({
          required_error: requiredMsg,
          invalid_type_error: requiredMsg,
        })
        .regex(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/,
          msg ?? "Fecha y hora inválidas",
        )
    case "time":
      return z
        .string({
          required_error: requiredMsg,
          invalid_type_error: requiredMsg,
        })
        .regex(/^\d{2}:\d{2}(:\d{2})?$/, msg ?? "Hora inválida")
    case "scale": {
      const min = q.scale?.min ?? 1
      const max = q.scale?.max ?? 5
      return z
        .number({
          required_error: requiredMsg,
          invalid_type_error: requiredMsg,
        })
        .int(msg ?? "Debe ser un número entero")
        .min(min, msg ?? `Mínimo ${min}`)
        .max(max, msg ?? `Máximo ${max}`)
    }
    case "consent": {
      const mustAccept = q.consent?.mustAccept ?? true
      if (mustAccept) {
        return z.literal(true, {
          errorMap: () => ({ message: msg ?? "Debés aceptar para continuar" }),
        })
      }
      return z.boolean()
    }
    case "info":
      return z.undefined()
    case "product": {
      // Validación ESTRUCTURAL de la respuesta (forma de ProductPick + reglas
      // min/max). La validación profunda contra el catálogo resuelto (productId
      // en el listado, variante activa, disponibilidad de stock — definition
      // sección 8.2) corre server-side en el submit, donde hay acceso al catálogo.
      const { min: baseMin, max } = resolveQuantityBounds(
        q.product,
        ticketCount,
      )
      const min = Math.max(baseMin, q.required ? 1 : 0)
      const pick = z
        .object({
          productId: z.string().min(1, requiredMsg),
          variantId: z.string().min(1, "Elegí una variante"),
          quantity: z.number().int().min(1).optional(),
          snapshot: z.object({
            title: z.string(),
            variantTitle: z.string().nullable(),
            options: z.record(z.string()).nullable(),
            sku: z.string().nullable(),
            price: z.number().nullable(),
            currency: z.string().nullable(),
            imageUrl: z.string().nullable(),
          }),
        })
        .strict()
      // max === 1 → un solo pick (el wrapper lo hace opcional si !required).
      if (max === 1) return pick
      // max > 1 → carrito de líneas (producto+variante). min/max cuentan UNIDADES
      // totales (suma de cantidades), no el número de líneas: el comprador puede
      // llevar varias tallas o varias unidades de una misma talla hasta sumar max.
      // La salvaguarda anti-abuso global se reaplica en la derivación (sección 9.8).
      return z
        .array(pick, {
          required_error: requiredMsg,
          invalid_type_error: requiredMsg,
        })
        .superRefine((arr, ctx) => {
          // Cada línea debe ser una combinación producto+variante única; dos
          // líneas iguales colisionarían en el uuid determinístico (su unitIndex
          // reinicia por pick) — la cantidad va dentro de la línea, no duplicada.
          const seen = new Set<string>()
          for (const p of arr) {
            const key = `${p.productId}::${p.variantId}`
            if (seen.has(key)) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Línea de producto duplicada",
              })
            }
            seen.add(key)
          }
          const units = sumUnits(arr)
          if (units < min) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: requiredMsg })
          }
          if (units > max) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Máximo ${max}`,
            })
          }
        })
    }
  }
}
