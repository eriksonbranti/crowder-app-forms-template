"use client"

import {
  RiAddLine,
  RiArrowDownLine,
  RiArrowLeftLine,
  RiArrowRightSLine,
  RiArrowUpLine,
  RiCloseLine,
  RiDeleteBin6Line,
} from "@remixicon/react"
import type { ReactNode } from "react"

import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import { Textarea } from "@/components/Textarea"
import type {
  FormGroup,
  FormQuestion,
  GroupScope,
  QuestionType,
} from "@/lib/db/schema"

import { deriveId } from "./derive"
import { FieldLabel, IconButton, NativeSelect, SwitchRow } from "./primitives"
import {
  CHOICE_TYPES,
  NUMBER_LIKE_TYPES,
  QUESTION_TYPES,
  QUESTION_TYPE_BY_VALUE,
  TEXT_LIKE_TYPES,
} from "./question-types"

type VisibleWhen = NonNullable<FormGroup["visibleWhen"]>
type PrefillFrom = NonNullable<FormQuestion["prefillFrom"]>

const PREFILL_OPTIONS: {
  value: PrefillFrom
  label: string
  scope: GroupScope | "any"
}[] = [
  { value: "user.email", label: "Email del usuario", scope: "any" },
  { value: "user.firstName", label: "Nombre del usuario", scope: "any" },
  { value: "user.lastName", label: "Apellido del usuario", scope: "any" },
  { value: "user.country", label: "País del usuario", scope: "any" },
  {
    value: "item.holder.firstName",
    label: "Nombre del holder (item)",
    scope: "item",
  },
  {
    value: "item.holder.lastName",
    label: "Apellido del holder (item)",
    scope: "item",
  },
  {
    value: "item.holder.documentType",
    label: "Tipo documento (item)",
    scope: "item",
  },
  {
    value: "item.holder.documentNumber",
    label: "Número documento (item)",
    scope: "item",
  },
]

/* ──────────────── Shell ──────────────── */

export function InspectorShell({
  eyebrow,
  title,
  subtitle,
  actions,
  children,
}: {
  eyebrow: ReactNode
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex items-start justify-between gap-4 border-b border-border bg-background px-6 py-4">
        <div className="min-w-0 flex-1">
          <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {eyebrow}
          </div>
          <h2 className="mt-0.5 truncate text-base font-semibold text-foreground">
            {title || "(sin título)"}
          </h2>
          {subtitle && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-1.5">{actions}</div>
        )}
      </header>
      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        {children}
      </div>
    </div>
  )
}

/* ──────────────── FormInspector ──────────────── */

export type FormMeta = {
  title: string
  enabled: boolean
}

export function FormInspector({
  meta,
  fieldErrors,
  onPatch,
}: {
  meta: FormMeta
  fieldErrors?: Partial<Record<keyof FormMeta, string>>
  onPatch: (patch: Partial<FormMeta>) => void
}) {
  return (
    <InspectorShell
      eyebrow="Form"
      title="Configuración general"
      subtitle="Datos a nivel de formulario. Aplican a todos los grupos."
    >
      <FieldLabel label="Título" error={fieldErrors?.title}>
        <Input
          value={meta.title}
          onChange={(e) => onPatch({ title: e.target.value })}
        />
      </FieldLabel>

      <SwitchRow
        label="Habilitado"
        hint="Si está apagado, el form no aparece en el iframe."
        checked={meta.enabled}
        onChange={(v) => onPatch({ enabled: v })}
      />
    </InspectorShell>
  )
}

/* ──────────────── GroupInspector ──────────────── */

export function GroupInspector({
  group,
  gIdx,
  total,
  onPatch,
  onRemove,
  onMove,
  onSelectQuestion,
  onAddQuestion,
}: {
  group: FormGroup
  gIdx: number
  total: number
  onPatch: (patch: Partial<FormGroup>) => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
  onSelectQuestion: (qIdx: number) => void
  onAddQuestion: () => void
}) {
  const isItemScope = group.scope === "item"
  return (
    <InspectorShell
      eyebrow={`Grupo ${gIdx + 1} de ${total}`}
      title={group.title}
      subtitle={
        isItemScope
          ? "Se repite una vez por entrada del comprador."
          : "Se completa una sola vez por compra."
      }
      actions={
        <>
          <IconButton onClick={() => onMove(-1)} disabled={gIdx === 0} label="Subir grupo">
            <RiArrowUpLine className="size-4" aria-hidden="true" />
          </IconButton>
          <IconButton
            onClick={() => onMove(1)}
            disabled={gIdx === total - 1}
            label="Bajar grupo"
          >
            <RiArrowDownLine className="size-4" aria-hidden="true" />
          </IconButton>
          <IconButton onClick={onRemove} disabled={total <= 1} label="Eliminar grupo" danger>
            <RiDeleteBin6Line className="size-4" aria-hidden="true" />
          </IconButton>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldLabel label="Título">
          <Input
            value={group.title}
            onChange={(e) => onPatch({ title: e.target.value })}
          />
        </FieldLabel>
        <FieldLabel
          label="Repetición"
          hint="Una vez por compra, o una por cada entrada."
        >
          <NativeSelect
            value={group.scope}
            onChange={(v) => onPatch({ scope: v as GroupScope })}
            options={[
              { value: "transaction", label: "Una vez por compra" },
              { value: "item", label: "Una por cada entrada" },
            ]}
          />
        </FieldLabel>
      </div>

      <FieldLabel
        label="Descripción (opcional)"
        hint="Aparece debajo del título en el wizard."
      >
        <Textarea
          rows={2}
          value={group.description ?? ""}
          onChange={(e) =>
            onPatch({ description: e.target.value === "" ? null : e.target.value })
          }
        />
      </FieldLabel>

      {isItemScope && (
        <FieldLabel
          label="Encabezado mostrado al usuario"
          hint="Soporta variables como {item.holder.firstName}."
        >
          <Input
            value={group.labelTemplate}
            onChange={(e) => onPatch({ labelTemplate: e.target.value })}
          />
        </FieldLabel>
      )}

      <details className="group rounded-md border border-border bg-background">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-foreground">
          <span>Avanzado</span>
          <RiArrowRightSLine
            className="size-4 text-muted-foreground transition-transform group-open:rotate-90"
            aria-hidden="true"
          />
        </summary>
        <div className="space-y-4 border-t border-border px-4 pb-4 pt-3">
          <FieldLabel
            label="ID interno"
            hint="Generado automáticamente a partir del título."
          >
            <Input value={group.id} disabled />
          </FieldLabel>
          {!isItemScope && (
            <FieldLabel
              label="Encabezado mostrado al usuario"
              hint="Soporta variables del comprador."
            >
              <Input
                value={group.labelTemplate}
                onChange={(e) => onPatch({ labelTemplate: e.target.value })}
              />
            </FieldLabel>
          )}
          <VisibleWhenEditor
            value={group.visibleWhen ?? null}
            onChange={(vw) => onPatch({ visibleWhen: vw ?? undefined })}
            referenceableQuestions={group.questions.map((q) => ({
              id: q.id,
              label: q.label || q.id,
            }))}
          />
        </div>
      </details>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Preguntas · {group.questions.length}
          </div>
          <Button type="button" variant="secondary" onClick={onAddQuestion}>
            <RiAddLine className="size-4" aria-hidden="true" /> Pregunta
          </Button>
        </div>
        <div className="divide-y divide-border rounded-md border border-border bg-background">
          {group.questions.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Aún no agregaste preguntas.
            </p>
          ) : (
            group.questions.map((q, qIdx) => {
              const typeMeta =
                QUESTION_TYPE_BY_VALUE[q.type] ??
                QUESTION_TYPE_BY_VALUE.short_text
              const Icon = typeMeta.Icon
              return (
                <button
                  key={q.id + ":" + qIdx}
                  type="button"
                  onClick={() => onSelectQuestion(qIdx)}
                  className="group flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-subtle/60"
                >
                  <Icon className="size-4 shrink-0 text-faint" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-foreground">
                      {q.label || "(sin label)"}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {typeMeta.label}
                      {q.required ? " · obligatoria" : ""}
                    </div>
                  </div>
                  <RiArrowRightSLine
                    className="size-4 text-faint transition group-hover:text-foreground"
                    aria-hidden="true"
                  />
                </button>
              )
            })
          )}
        </div>
      </div>
    </InspectorShell>
  )
}

/* ──────────────── QuestionInspector ──────────────── */

export function QuestionInspector({
  question,
  groupScope,
  qIdx,
  totalInGroup,
  groupTitle,
  siblings,
  onPatch,
  onRemove,
  onMove,
  onBackToGroup,
}: {
  question: FormQuestion
  groupScope: GroupScope
  qIdx: number
  totalInGroup: number
  groupTitle: string
  siblings: { id: string; label: string }[]
  onPatch: (patch: Partial<FormQuestion>) => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
  onBackToGroup: () => void
}) {
  const isChoice = CHOICE_TYPES.includes(question.type)
  const isTextLike = TEXT_LIKE_TYPES.includes(question.type)
  const isNumberLike = NUMBER_LIKE_TYPES.includes(question.type)
  const isScale = question.type === "scale"
  const isConsent = question.type === "consent"
  const isInfo = question.type === "info"

  function handleTypeChange(nextType: QuestionType) {
    const patch: Partial<FormQuestion> = { type: nextType }
    if (CHOICE_TYPES.includes(nextType) && !question.options) {
      patch.options = [
        { value: "opcion_1", label: "Opción 1" },
        { value: "opcion_2", label: "Opción 2" },
      ]
    }
    if (!CHOICE_TYPES.includes(nextType)) patch.options = undefined
    if (nextType === "scale" && !question.scale) {
      patch.scale = { min: 1, max: 5 }
    }
    if (nextType !== "scale") patch.scale = undefined
    if (nextType === "consent" && !question.consent) {
      patch.consent = { mustAccept: true }
    }
    if (nextType !== "consent") patch.consent = undefined
    onPatch(patch)
  }

  return (
    <InspectorShell
      eyebrow={
        <button
          type="button"
          onClick={onBackToGroup}
          className="inline-flex items-center gap-1 transition hover:text-foreground"
        >
          <RiArrowLeftLine className="size-3.5" aria-hidden="true" />
          {groupTitle || "Grupo"}
        </button>
      }
      title={question.label}
      subtitle={`Pregunta ${qIdx + 1} de ${totalInGroup}`}
      actions={
        <>
          <IconButton onClick={() => onMove(-1)} disabled={qIdx === 0} label="Subir">
            <RiArrowUpLine className="size-4" aria-hidden="true" />
          </IconButton>
          <IconButton
            onClick={() => onMove(1)}
            disabled={qIdx === totalInGroup - 1}
            label="Bajar"
          >
            <RiArrowDownLine className="size-4" aria-hidden="true" />
          </IconButton>
          <IconButton
            onClick={onRemove}
            disabled={totalInGroup <= 1}
            label="Eliminar pregunta"
            danger
          >
            <RiDeleteBin6Line className="size-4" aria-hidden="true" />
          </IconButton>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldLabel
          label={
            isInfo
              ? "Texto (markdown ligero)"
              : isConsent
                ? "Pregunta (markdown ligero)"
                : "Pregunta"
          }
          hint={
            isConsent
              ? "Soporta **bold**, *italic* y enlaces [texto](https://…)."
              : undefined
          }
        >
          {isInfo || isConsent ? (
            <Textarea
              rows={3}
              value={question.label}
              onChange={(e) => onPatch({ label: e.target.value })}
            />
          ) : (
            <Input
              value={question.label}
              onChange={(e) => onPatch({ label: e.target.value })}
            />
          )}
        </FieldLabel>
        <FieldLabel label="Tipo de respuesta">
          <NativeSelect
            value={question.type}
            onChange={(v) => handleTypeChange(v as QuestionType)}
            options={QUESTION_TYPES.map((t) => ({ value: t.value, label: t.label }))}
          />
        </FieldLabel>
      </div>

      {!isInfo && (isTextLike || isNumberLike) && (
        <FieldLabel
          label="Placeholder (opcional)"
          hint="Texto guía dentro del input vacío."
        >
          <Input
            value={question.placeholder ?? ""}
            onChange={(e) =>
              onPatch({
                placeholder: e.target.value === "" ? null : e.target.value,
              })
            }
          />
        </FieldLabel>
      )}

      {!isInfo && (
        <SwitchRow
          label="Obligatoria"
          hint="El comprador no puede saltar esta pregunta."
          checked={question.required}
          onChange={(v) => onPatch({ required: v })}
        />
      )}

      {isChoice && (
        <FieldLabel label="Opciones">
          <OptionsEditor
            options={question.options ?? []}
            onChange={(options) => onPatch({ options })}
          />
        </FieldLabel>
      )}

      {isScale && (
        <ScaleEditor
          scale={question.scale ?? { min: 1, max: 5 }}
          onChange={(scale) => onPatch({ scale })}
        />
      )}

      {isConsent && (
        <SwitchRow
          label="Debe aceptar para continuar"
          checked={question.consent?.mustAccept ?? true}
          onChange={(v) => onPatch({ consent: { mustAccept: v } })}
        />
      )}

      {!isInfo && (
        <details className="group rounded-md border border-border bg-background">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-foreground">
            <span>Avanzado</span>
            <RiArrowRightSLine
              className="size-4 text-muted-foreground transition-transform group-open:rotate-90"
              aria-hidden="true"
            />
          </summary>
          <div className="space-y-4 border-t border-border px-4 pb-4 pt-3">
            <FieldLabel label="Texto de ayuda" hint="Aparece debajo del label, en gris.">
              <Input
                value={question.help ?? ""}
                onChange={(e) =>
                  onPatch({ help: e.target.value === "" ? null : e.target.value })
                }
              />
            </FieldLabel>
            <FieldLabel
              label="ID interno"
              hint="Generado automáticamente a partir de la pregunta."
            >
              <Input value={question.id} disabled />
            </FieldLabel>
            {(isTextLike || isNumberLike) && (
              <ValidationEditor
                validation={question.validation ?? null}
                isNumber={isNumberLike}
                onChange={(validation) =>
                  onPatch({ validation: validation ?? undefined })
                }
              />
            )}
            <FieldLabel
              label="Pre-rellenar desde"
              hint="Toma el valor de los datos del comprador o de la entrada."
            >
              <NativeSelect
                value={question.prefillFrom ?? ""}
                onChange={(v) =>
                  onPatch({
                    prefillFrom: v === "" ? undefined : (v as PrefillFrom),
                  })
                }
                options={[
                  { value: "", label: "— sin pre-rellenado —" },
                  ...PREFILL_OPTIONS.filter(
                    (p) => p.scope === "any" || p.scope === groupScope,
                  ).map((p) => ({ value: p.value, label: p.label })),
                ]}
              />
            </FieldLabel>
            <VisibleWhenEditor
              value={question.visibleWhen ?? null}
              onChange={(vw) => onPatch({ visibleWhen: vw ?? undefined })}
              referenceableQuestions={siblings}
            />
          </div>
        </details>
      )}
    </InspectorShell>
  )
}

/* ──────────────── Sub-editors ──────────────── */

function OptionsEditor({
  options,
  onChange,
}: {
  options: { value: string; label: string }[]
  onChange: (next: { value: string; label: string }[]) => void
}) {
  function updateLabel(idx: number, label: string) {
    onChange(
      options.map((o, i) => {
        if (i !== idx) return o
        const otherValues = new Set(
          options.filter((_, j) => j !== idx).map((oo) => oo.value),
        )
        return { value: deriveId(label, "opcion", otherValues), label }
      }),
    )
  }
  function remove(idx: number) {
    if (options.length <= 1) return
    onChange(options.filter((_, i) => i !== idx))
  }
  function add() {
    const label = `Opción ${options.length + 1}`
    const taken = new Set(options.map((o) => o.value))
    onChange([...options, { value: deriveId(label, "opcion", taken), label }])
  }
  return (
    <div className="space-y-2">
      {options.map((opt, idx) => (
        <div key={idx} className="flex items-start gap-2">
          <div className="flex-1">
            <Input
              placeholder="Texto de la opción"
              value={opt.label}
              onChange={(e) => updateLabel(idx, e.target.value)}
            />
          </div>
          <IconButton
            onClick={() => remove(idx)}
            disabled={options.length <= 1}
            label="Eliminar opción"
            danger
          >
            <RiCloseLine className="size-4" aria-hidden="true" />
          </IconButton>
        </div>
      ))}
      <Button type="button" variant="secondary" onClick={add}>
        <RiAddLine className="size-4" aria-hidden="true" /> Agregar opción
      </Button>
    </div>
  )
}

function ScaleEditor({
  scale,
  onChange,
}: {
  scale: NonNullable<FormQuestion["scale"]>
  onChange: (next: NonNullable<FormQuestion["scale"]>) => void
}) {
  return (
    <div className="grid gap-3 rounded-md border border-border bg-background p-3 sm:grid-cols-4">
      <FieldLabel label="Min">
        <Input
          type="number"
          value={scale.min}
          onChange={(e) => onChange({ ...scale, min: Number(e.target.value) })}
        />
      </FieldLabel>
      <FieldLabel label="Max">
        <Input
          type="number"
          value={scale.max}
          onChange={(e) => onChange({ ...scale, max: Number(e.target.value) })}
        />
      </FieldLabel>
      <FieldLabel label="Min label">
        <Input
          value={scale.minLabel ?? ""}
          onChange={(e) =>
            onChange({
              ...scale,
              minLabel: e.target.value === "" ? undefined : e.target.value,
            })
          }
        />
      </FieldLabel>
      <FieldLabel label="Max label">
        <Input
          value={scale.maxLabel ?? ""}
          onChange={(e) =>
            onChange({
              ...scale,
              maxLabel: e.target.value === "" ? undefined : e.target.value,
            })
          }
        />
      </FieldLabel>
    </div>
  )
}

function ValidationEditor({
  validation,
  isNumber,
  onChange,
}: {
  validation: FormQuestion["validation"] | null
  isNumber: boolean
  onChange: (next: FormQuestion["validation"] | null) => void
}) {
  const v = validation ?? {}
  function patch(p: NonNullable<FormQuestion["validation"]>) {
    const next = { ...v, ...p }
    const isEmpty =
      next.min === undefined &&
      next.max === undefined &&
      (next.pattern === undefined || next.pattern === "") &&
      (next.message === undefined || next.message === "")
    onChange(isEmpty ? null : next)
  }
  return (
    <div className="space-y-2 rounded-md border border-border bg-background p-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Validación {isNumber ? "(numérica)" : "(longitud / regex)"}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldLabel label={isNumber ? "Min (valor)" : "Min (largo)"}>
          <Input
            type="number"
            value={v.min ?? ""}
            onChange={(e) =>
              patch({
                min: e.target.value === "" ? undefined : Number(e.target.value),
              })
            }
          />
        </FieldLabel>
        <FieldLabel label={isNumber ? "Max (valor)" : "Max (largo)"}>
          <Input
            type="number"
            value={v.max ?? ""}
            onChange={(e) =>
              patch({
                max: e.target.value === "" ? undefined : Number(e.target.value),
              })
            }
          />
        </FieldLabel>
        {!isNumber && (
          <FieldLabel label="Pattern (regex)">
            <Input
              value={v.pattern ?? ""}
              onChange={(e) =>
                patch({
                  pattern: e.target.value === "" ? undefined : e.target.value,
                })
              }
            />
          </FieldLabel>
        )}
        <FieldLabel label="Mensaje si falla">
          <Input
            value={v.message ?? ""}
            onChange={(e) =>
              patch({
                message: e.target.value === "" ? undefined : e.target.value,
              })
            }
          />
        </FieldLabel>
      </div>
    </div>
  )
}

function VisibleWhenEditor({
  value,
  onChange,
  referenceableQuestions,
}: {
  value: VisibleWhen | null
  onChange: (next: VisibleWhen | null) => void
  referenceableQuestions: { id: string; label: string }[]
}) {
  const enabled = value !== null
  function toggle(on: boolean) {
    if (on) {
      onChange({ question: referenceableQuestions[0]?.id ?? "", equals: "" })
    } else {
      onChange(null)
    }
  }
  return (
    <div className="space-y-2 rounded-md border border-border bg-background p-3">
      <SwitchRow
        label="Mostrar solo si…"
        hint="Visible cuando otra pregunta tiene un valor específico."
        checked={enabled}
        onChange={toggle}
      />
      {enabled && value && (
        <div className="grid gap-3 sm:grid-cols-2">
          <FieldLabel label="Pregunta">
            <NativeSelect
              value={value.question}
              onChange={(q) => onChange({ ...value, question: q })}
              options={
                referenceableQuestions.length
                  ? referenceableQuestions.map((q) => ({
                      value: q.id,
                      label: q.label,
                    }))
                  : [{ value: "", label: "(sin preguntas disponibles)" }]
              }
            />
          </FieldLabel>
          <FieldLabel label="Igual a">
            <Input
              value={String(value.equals)}
              onChange={(e) => onChange({ ...value, equals: e.target.value })}
            />
          </FieldLabel>
        </div>
      )}
    </div>
  )
}
