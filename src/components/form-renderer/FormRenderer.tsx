"use client"

import { useMemo, useState } from "react"
import type { ZodError } from "zod"

import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import { Label } from "@/components/Label"
import { Checkbox } from "@/components/Checkbox"
import { Textarea } from "@/components/Textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Select"
import {
  RadioCardGroup,
  RadioCardIndicator,
  RadioCardItem,
} from "@/components/RadioCardGroup"
import { answersSchemaForGroup } from "@/lib/form-schema"
import { cx } from "@/lib/utils"
import type { FormGroup, FormQuestion } from "@/lib/db/schema"
import type { RenderProduct } from "@/lib/products/types"

import { MarkdownLite } from "./MarkdownLite"
import { ProductSelector } from "./ProductSelector"

type Answers = Record<string, unknown>
type FieldErrors = Record<string, string>

const INPUT_TYPE_BY_QUESTION: Partial<
  Record<FormQuestion["type"], React.HTMLInputTypeAttribute>
> = {
  short_text: "text",
  email: "email",
  phone: "tel",
  date: "date",
  datetime: "datetime-local",
  time: "time",
  country: "text",
  document_id: "text",
}

type Variant = "default" | "embed"

export function FormRenderer({
  group,
  initialAnswers,
  onChange,
  onSubmit,
  submitLabel = "Continuar",
  formId,
  omitHeader = false,
  omitSubmit = false,
  variant = "default",
  productLists,
  currency,
  ticketCount,
}: {
  group: FormGroup
  initialAnswers?: Answers
  onChange?: (answers: Answers) => void
  onSubmit: (answers: Answers) => void | Promise<void>
  submitLabel?: string
  formId?: string
  omitHeader?: boolean
  omitSubmit?: boolean
  variant?: Variant
  // Listados resueltos por questionId para preguntas `product` (definition sección 8).
  productLists?: Record<string, RenderProduct[]>
  currency?: string | null
  // Cantidad de tickets ya resuelta por scope (para preguntas `product` en modo
  // `perTickets`). undefined = sin contexto (validación estructural laxa).
  ticketCount?: number
}) {
  const [answers, setAnswers] = useState<Answers>(initialAnswers ?? {})
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)

  const schema = useMemo(
    () => answersSchemaForGroup(group, { ticketCount }),
    [group, ticketCount],
  )

  const visibleQuestions = useMemo(
    () => group.questions.filter((q) => isVisible(q, answers)),
    [group, answers],
  )

  function setField(id: string, value: unknown) {
    // `setField` solo corre desde event handlers, así que `answers` del closure
    // ya es el valor commiteado. Computamos `next` acá (no dentro del updater de
    // setAnswers) para no disparar el `onChange` del padre durante el render de
    // este componente — eso causaba "Cannot update a component while rendering".
    const next = { ...answers, [id]: value }
    setAnswers(next)
    onChange?.(next)
    if (errors[id]) {
      setErrors((prev) => {
        const nextErrors = { ...prev }
        delete nextErrors[id]
        return nextErrors
      })
    }
  }

  // Embed variant has no per-step Submit button, so without on-blur validation
  // a malformed phone/email value sits silently invalid: the parent's CTA stays
  // disabled (because the wizard never emits `selected`) but the user never
  // sees why. We surface schema errors as soon as the user leaves the field,
  // but only when it has content — empty fields stay quiet to avoid yelling
  // "required" the moment focus shifts away.
  function validateField(id: string) {
    if (variant !== "embed") return
    const v = answers[id]
    const empty =
      v == null ||
      (typeof v === "string" && v.length === 0) ||
      (Array.isArray(v) && v.length === 0)
    if (empty) {
      if (errors[id]) {
        setErrors((prev) => {
          const next = { ...prev }
          delete next[id]
          return next
        })
      }
      return
    }
    const result = schema.safeParse(answers)
    if (result.success) {
      if (errors[id]) {
        setErrors((prev) => {
          const next = { ...prev }
          delete next[id]
          return next
        })
      }
      return
    }
    const issue = result.error.issues.find((i) => i.path[0] === id)
    if (issue) {
      setErrors((prev) => ({ ...prev, [id]: issue.message }))
    } else if (errors[id]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const payload: Answers = {}
      for (const q of visibleQuestions) {
        if (q.type === "info") continue
        if (q.id in answers) payload[q.id] = answers[q.id]
      }
      const result = schema.safeParse(payload)
      if (!result.success) {
        setErrors(flattenZodErrors(result.error))
        return
      }
      setErrors({})
      await onSubmit(result.data as Answers)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-6">
      {!omitHeader && (
        <header className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {group.title}
          </h2>
          {group.description && (
            <MarkdownLite as="p" className="text-sm text-muted-foreground">
              {group.description}
            </MarkdownLite>
          )}
        </header>
      )}

      <div
        className={cx(
          variant === "embed"
            ? "grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2"
            : "space-y-5",
        )}
      >
        {visibleQuestions.map((q) => (
          <QuestionField
            key={q.id}
            question={q}
            value={answers[q.id]}
            error={errors[q.id]}
            onChange={(v) => setField(q.id, v)}
            onBlur={() => validateField(q.id)}
            variant={variant}
            products={productLists?.[q.id]}
            currency={currency}
            ticketCount={ticketCount}
          />
        ))}
      </div>

      {!omitSubmit && (
        <div className="flex justify-end">
          <Button type="submit" isLoading={submitting} className="embed-cta">
            {submitLabel}
          </Button>
        </div>
      )}
    </form>
  )
}

const FLOATING_LABEL_TYPES: ReadonlySet<FormQuestion["type"]> = new Set([
  "short_text",
  "long_text",
  "number",
  "email",
  "phone",
  "date",
  "datetime",
  "time",
  "country",
  "document_id",
  "dropdown",
])

// In the embed 2-column grid, these types take the full row because their
// content doesn't fit comfortably in a half-width column.
const EMBED_FULL_WIDTH_TYPES: ReadonlySet<FormQuestion["type"]> = new Set([
  "long_text",
  "single_choice",
  "multiple_choice",
  "scale",
  "consent",
  "info",
  "product",
])

function isFilledValue(v: unknown): boolean {
  if (v == null) return false
  if (typeof v === "string") return v.length > 0
  if (Array.isArray(v)) return v.length > 0
  return true
}

function RequiredMark({ required }: { required?: boolean }) {
  if (!required) return null
  return (
    <span className="ml-1 text-destructive" aria-hidden>
      *
    </span>
  )
}

function QuestionField({
  question,
  value,
  error,
  onChange,
  onBlur,
  variant,
  products,
  currency,
  ticketCount,
}: {
  question: FormQuestion
  value: unknown
  error?: string
  onChange: (v: unknown) => void
  onBlur?: () => void
  variant: Variant
  products?: RenderProduct[]
  currency?: string | null
  ticketCount?: number
}) {
  const id = `q-${question.id}`
  const embedFull =
    variant === "embed" && EMBED_FULL_WIDTH_TYPES.has(question.type)

  if (question.type === "info") {
    return (
      <div
        className={cx(
          "rounded-md border border-border bg-background p-3 text-sm text-secondary-foreground",
          embedFull && "sm:col-span-2",
        )}
      >
        <MarkdownLite>{question.label}</MarkdownLite>
        {question.help && (
          <MarkdownLite
            as="p"
            className="mt-1 text-xs text-muted-foreground"
          >
            {question.help}
          </MarkdownLite>
        )}
      </div>
    )
  }

  // Consent: the checkbox already renders its label text alongside it, so
  // we skip the title Label wrapper to avoid duplicating the question label.
  if (question.type === "consent") {
    return (
      <div className={cx("space-y-2", embedFull && "sm:col-span-2")}>
        <Field
          id={id}
          question={question}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          invalid={!!error}
          variant={variant}
        />
        {question.help && (
          <MarkdownLite
            as="p"
            className="text-xs text-muted-foreground"
          >
            {question.help}
          </MarkdownLite>
        )}
        {error && (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }

  // Embed variant: floating-label pattern for text-like fields and the
  // dropdown. Choice-style questions render below without the wrapper.
  if (variant === "embed" && FLOATING_LABEL_TYPES.has(question.type)) {
    const filled = isFilledValue(value)
    return (
      <div
        data-embed-field
        data-filled={filled ? "true" : undefined}
        className={cx(embedFull && "sm:col-span-2")}
      >
        <Field
          id={id}
          question={question}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          invalid={!!error}
          variant={variant}
        />
        <Label
          htmlFor={id}
          data-embed-label
          className="text-foreground"
        >
          <MarkdownLite>{question.label}</MarkdownLite>
          <RequiredMark required={question.required} />
        </Label>
        {question.help && (
          <MarkdownLite
            as="p"
            data-embed-help
            className="text-xs text-muted-foreground"
          >
            {question.help}
          </MarkdownLite>
        )}
        {error && (
          <p
            data-embed-error
            className="text-xs text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className={cx("space-y-2", embedFull && "sm:col-span-2")}>
      <Label htmlFor={id} className="block text-sm text-foreground">
        <MarkdownLite>{question.label}</MarkdownLite>
        <RequiredMark required={question.required} />
      </Label>
      {question.help && (
        <MarkdownLite
          as="p"
          className="text-xs text-muted-foreground"
        >
          {question.help}
        </MarkdownLite>
      )}
      <Field
        id={id}
        question={question}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        invalid={!!error}
        variant={variant}
        products={products}
        currency={currency}
        ticketCount={ticketCount}
      />
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

function Field({
  id,
  question,
  value,
  onChange,
  onBlur,
  invalid,
  variant,
  products,
  currency,
  ticketCount,
}: {
  id: string
  question: FormQuestion
  value: unknown
  onChange: (v: unknown) => void
  onBlur?: () => void
  invalid: boolean
  variant: Variant
  products?: RenderProduct[]
  currency?: string | null
  ticketCount?: number
}) {
  const ariaInvalid = invalid || undefined
  // Embed floating-label needs a non-empty placeholder so the input never
  // visually collapses while the label is in its resting position.
  const placeholder =
    question.placeholder ?? (variant === "embed" ? " " : undefined)

  if (question.type === "long_text") {
    return (
      <Textarea
        id={id}
        rows={4}
        placeholder={placeholder}
        value={(value as string) ?? ""}
        aria-invalid={ariaInvalid}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
    )
  }

  if (question.type === "number") {
    return (
      <Input
        id={id}
        type="number"
        placeholder={placeholder}
        value={value == null ? "" : String(value)}
        aria-invalid={ariaInvalid}
        onChange={(e) => {
          const v = e.target.value
          onChange(v === "" ? undefined : Number(v))
        }}
        onBlur={onBlur}
      />
    )
  }

  const inputType = INPUT_TYPE_BY_QUESTION[question.type]
  if (inputType) {
    return (
      <Input
        id={id}
        type={inputType}
        placeholder={placeholder}
        value={(value as string) ?? ""}
        aria-invalid={ariaInvalid}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
    )
  }

  switch (question.type) {
    case "single_choice": {
      if (variant === "embed") {
        return (
          <div role="radiogroup" className="flex flex-col gap-2">
            {(question.options ?? []).map((opt) => {
              const checked = value === opt.value
              return (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-3 text-sm text-foreground"
                >
                  <input
                    type="radio"
                    name={id}
                    value={opt.value}
                    checked={checked}
                    onChange={() => onChange(opt.value)}
                    className="h-4 w-4 accent-[hsl(var(--primary))]"
                  />
                  <span>{opt.label}</span>
                </label>
              )
            })}
          </div>
        )
      }
      return (
        <RadioCardGroup
          value={(value as string) ?? ""}
          onValueChange={(v) => onChange(v)}
          className="grid gap-2 sm:grid-cols-2"
        >
          {(question.options ?? []).map((opt) => (
            <RadioCardItem
              key={opt.value}
              value={opt.value}
              className="flex items-center gap-2 px-3 py-2"
            >
              <RadioCardIndicator />
              <span className="text-sm">{opt.label}</span>
            </RadioCardItem>
          ))}
        </RadioCardGroup>
      )
    }
    case "dropdown": {
      return (
        <Select
          value={(value as string) ?? ""}
          onValueChange={(v) => onChange(v)}
        >
          <SelectTrigger id={id} aria-invalid={ariaInvalid}>
            <SelectValue
              placeholder={
                question.placeholder ??
                (variant === "embed" ? " " : "Seleccionar")
              }
            />
          </SelectTrigger>
          <SelectContent>
            {(question.options ?? []).map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    }
    case "multiple_choice": {
      const arr = Array.isArray(value) ? (value as string[]) : []
      if (variant === "embed") {
        return (
          <div className="flex flex-col gap-2">
            {(question.options ?? []).map((opt) => {
              const checked = arr.includes(opt.value)
              return (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-3 text-sm text-foreground"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(c) => {
                      if (c) onChange([...arr, opt.value])
                      else onChange(arr.filter((v) => v !== opt.value))
                    }}
                  />
                  <span>{opt.label}</span>
                </label>
              )
            })}
          </div>
        )
      }
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          {(question.options ?? []).map((opt) => {
            const checked = arr.includes(opt.value)
            return (
              <label
                key={opt.value}
                className={cx(
                  "flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm text-foreground shadow-sm transition",
                  checked
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-subtle",
                )}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(c) => {
                    if (c) onChange([...arr, opt.value])
                    else onChange(arr.filter((v) => v !== opt.value))
                  }}
                />
                {opt.label}
              </label>
            )
          })}
        </div>
      )
    }
    case "scale": {
      const min = question.scale?.min ?? 1
      const max = question.scale?.max ?? 5
      const range = Array.from({ length: max - min + 1 }, (_, i) => min + i)
      return (
        <div className="flex flex-wrap items-center gap-2">
          {question.scale?.minLabel && (
            <span className="text-xs text-muted-foreground">
              {question.scale.minLabel}
            </span>
          )}
          {range.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={cx(
                "h-9 w-9 rounded-md border text-sm",
                value === n
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-secondary-foreground hover:bg-subtle",
              )}
            >
              {n}
            </button>
          ))}
          {question.scale?.maxLabel && (
            <span className="text-xs text-muted-foreground">
              {question.scale.maxLabel}
            </span>
          )}
        </div>
      )
    }
    case "consent": {
      const accepted = value === true
      if (variant === "embed") {
        return (
          <label className="flex cursor-pointer items-start gap-3 text-sm text-foreground">
            <Checkbox
              id={id}
              checked={accepted}
              onCheckedChange={(c) => onChange(c === true)}
              className="mt-0.5"
            />
            <span className="leading-relaxed">
              <MarkdownLite as="span">{question.label}</MarkdownLite>
              <RequiredMark required={question.required} />
            </span>
          </label>
        )
      }
      return (
        <label
          className={cx(
            "flex cursor-pointer items-start gap-3 rounded-md border bg-background p-3 text-sm text-foreground shadow-sm transition",
            accepted
              ? "border-primary bg-primary/5"
              : "border-border hover:bg-subtle",
          )}
        >
          <Checkbox
            id={id}
            checked={accepted}
            onCheckedChange={(c) => onChange(c === true)}
            className="mt-0.5"
          />
          <span className="leading-relaxed">
            <MarkdownLite as="span">{question.label}</MarkdownLite>
            <RequiredMark required={question.required} />
          </span>
        </label>
      )
    }
    case "info":
      return null
    case "product":
      return (
        <ProductSelector
          config={question.product}
          products={products ?? []}
          value={value}
          onChange={onChange}
          currency={currency}
          ticketCount={ticketCount}
        />
      )
  }
  return null
}

function isVisible(q: FormQuestion, answers: Answers): boolean {
  if (!q.visibleWhen) return true
  return answers[q.visibleWhen.question] === q.visibleWhen.equals
}

function flattenZodErrors(err: ZodError): FieldErrors {
  const out: FieldErrors = {}
  for (const issue of err.issues) {
    const key = issue.path[0]
    if (typeof key === "string" && !out[key]) {
      out[key] = issue.message
    }
  }
  return out
}
