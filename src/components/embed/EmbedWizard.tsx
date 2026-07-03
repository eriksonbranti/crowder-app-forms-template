"use client"

// Crowder Embedded App protocol — iframe ↔ parent postMessage handshake
// (interaction state, height, selected/cleared events).
// Spec: https://crowder-docs.vercel.app/embedded-app/
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { Button } from "@/components/Button"
import { FormRenderer } from "@/components/form-renderer/FormRenderer"
import {
  answersSchemaForGroup,
  groupHasRequiredQuestion,
} from "@/lib/form-schema/validate"
import type { PartnerItem, ProductPick } from "@/lib/db/schema"
import {
  derivePartnerItems,
  isProductPick,
  toPicks,
  type ProductAnswerSource,
  type ProductForDerive,
} from "@/lib/products/derive"
import { formatPrice } from "@/lib/products/format"
import { ticketCountForScope } from "@/lib/products/quantity"
import type { ProductLists, RenderProduct } from "@/lib/products/types"
import { cx } from "@/lib/utils"

import type {
  AnswersByStep,
  ErrorCode,
  IframeContext,
  PublishedForm,
  ServerError,
  WizardStep,
} from "./types"
import {
  buildSteps,
  emptyReason,
  prefillAnswers,
  validateContextShape,
} from "./wizard-logic"

type Props = {
  forms: PublishedForm[]
  supportedCurrencies: string[]
  // Listados resueltos de las preguntas `product`, clave `${formId}::${questionId}`.
  productLists?: ProductLists
  parentOrigins: string[]
  formIdForDiagnostics?: string
  // When set, the wizard skips the postMessage handshake and renders against
  // this synthetic context. Used by the dashboard's preview drawer — no parent
  // emits, no `/api/transactions/submit` call, and the last step exposes a
  // local "Enviar (vista previa)" button instead of waiting for the parent.
  previewContext?: IframeContext
}

// Tiempo máximo de espera del mensaje `context` desde la ticketera. Tras este
// timeout asumimos que el iframe no está embebido o el parent no responde.
const CONTEXT_TIMEOUT_MS = 8000

type Phase =
  | { kind: "waiting" }
  | { kind: "ready"; steps: WizardStep[]; ctx: IframeContext }
  | { kind: "empty"; ctx: IframeContext; reason: "no_steps" | "no_items" }
  | { kind: "done" }
  | { kind: "fatal"; code: ErrorCode; title: string; message: string }

export function EmbedWizard(props: Props) {
  const previewMode = !!props.previewContext
  const [phase, setPhase] = useState<Phase>(() =>
    props.previewContext
      ? initialPreviewPhase(props.forms, props.previewContext)
      : { kind: "waiting" },
  )
  const [stepIndex, setStepIndex] = useState(0)
  const [answers, setAnswers] = useState<AnswersByStep>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [serverErrors, setServerErrors] = useState<ServerError[]>([])

  const parentOriginRef = useRef<string | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const lastHeightRef = useRef(0)
  const onParentSubmitRef = useRef<(() => void) | null>(null)
  // Firma de los últimos partnerItems emitidos en `selected` (para re-emitir
  // solo cuando la selección cambia). `null` = aún no se emitió `selected`, lo
  // que también hace de guardia idempotente para el handshake selected/cleared.
  const selectedSigRef = useRef<string | null>(null)

  const emit = useCallback(
    (message: Record<string, unknown>) => {
      if (previewMode) return
      if (typeof window === "undefined") return
      const target = parentOriginRef.current
      if (target) {
        window.parent.postMessage(message, target)
        return
      }
      // Parent origin not yet learned: broadcast to each allowlisted origin so
      // only the real parent receives it. Used for `ready` and pre-context errors.
      for (const origin of props.parentOrigins) {
        window.parent.postMessage(message, origin)
      }
    },
    [previewMode, props.parentOrigins],
  )

  const emitError = useCallback(
    (code: ErrorCode, message: string) => {
      emit({ type: "interaction", status: "error", error: { code, message } })
    },
    [emit],
  )

  // Emite `selected` con los partnerItems derivados. Re-emite cuando cambian
  // (p. ej. el fan agrega/saca un producto) para que el parent recalcule el
  // total; deduplica por firma para no spamear emisiones idénticas. Para forms
  // sin productos los items van [] y se emite una sola vez (igual que antes).
  const emitSelected = useCallback(
    (partnerItems: PartnerItem[]) => {
      const sig = JSON.stringify(partnerItems)
      if (selectedSigRef.current === sig) return
      selectedSigRef.current = sig
      emit({ type: "interaction", status: "selected", partnerItems })
    },
    [emit],
  )

  const emitClearedAfterSelected = useCallback(() => {
    if (selectedSigRef.current === null) return
    selectedSigRef.current = null
    emit({ type: "interaction", status: "cleared" })
  }, [emit])

  const failFatal = useCallback(
    (code: ErrorCode, emitMsg: string, userMsg: string) => {
      emitError(code, emitMsg)
      setPhase({
        kind: "fatal",
        code,
        title: "No podemos continuar",
        message: userMsg,
      })
    },
    [emitError],
  )

  // Bloqueo del lado del iframe: no notifica al parent (no hay nada que
  // notificar), sólo muestra el mensaje al usuario.
  const blockClient = useCallback(
    (code: ErrorCode, title: string, userMsg: string) => {
      setPhase({ kind: "fatal", code, title, message: userMsg })
    },
    [],
  )

  const acceptContext = useCallback(
    (ctx: IframeContext, fromOrigin: string) => {
      parentOriginRef.current = fromOrigin

      if (
        props.supportedCurrencies.length > 0 &&
        !props.supportedCurrencies.includes(ctx.currency)
      ) {
        failFatal(
          "unsupported_currency",
          `currency '${ctx.currency}' is not supported`,
          `Moneda no soportada: ${ctx.currency}`,
        )
        return
      }

      const steps = buildSteps(props.forms, ctx.items)
      if (steps.length === 0) {
        setPhase({
          kind: "empty",
          ctx,
          reason: emptyReason(props.forms, ctx.items),
        })
        return
      }

      setStepIndex(0)
      setAnswers({})
      setServerErrors([])
      setSubmitError(null)
      selectedSigRef.current = null
      setPhase({ kind: "ready", steps, ctx })
    },
    [failFatal, props.forms, props.supportedCurrencies],
  )

  useEffect(() => {
    // Preview mode bypasses the entire handshake: the synthetic context was
    // already accepted in the initial state, and there is no parent to talk
    // to. Skip listeners and the timeout fail-safe.
    if (previewMode) return

    // Caso 1: la página se abrió fuera de un iframe. No hay parent que pueda
    // mandar `context`, así que cortamos temprano con un mensaje claro.
    if (window.parent === window) {
      blockClient(
        "invalid_context",
        "Abrí este formulario desde el checkout",
        "Este formulario se completa dentro del checkout de la ticketera.",
      )
      return
    }

    // Caso 2: el form no tiene allowed origins configurados. Sin lista no hay
    // a quién emitir `ready`, así que el parent jamás se entera del iframe.
    if (props.parentOrigins.length === 0) {
      blockClient(
        "invalid_context",
        "Formulario no configurado",
        "Este formulario aún no está habilitado para este checkout.",
      )
      return
    }

    function handler(event: MessageEvent) {
      const data =
        event.data && typeof event.data === "object"
          ? (event.data as { type?: unknown; status?: unknown })
          : null
      // Caso 3: si el origin no matchea, ignoramos silenciosamente y seguimos
      // esperando al parent legítimo.
      if (!props.parentOrigins.includes(event.origin)) return
      if (!data) return
      if (data.status !== "context") return

      parentOriginRef.current = event.origin
      if (!validateContextShape(data)) {
        failFatal(
          "invalid_context",
          "context payload is invalid",
          "El contexto recibido no es válido",
        )
        return
      }
      acceptContext(data, event.origin)
    }
    window.addEventListener("message", handler)
    emit({ type: "interaction", status: "ready" })

    // Caso 4: timeout. Si el parent no contesta en CONTEXT_TIMEOUT_MS, asumimos
    // que el iframe está embebido en algo que no implementa el protocolo o que
    // el origin del parent quedó fuera del allowlist.
    const timeoutId = window.setTimeout(() => {
      setPhase((prev) => {
        if (prev.kind !== "waiting") return prev
        return {
          kind: "fatal",
          code: "invalid_context",
          title: "No recibimos los datos",
          message:
            "No pudimos cargar tu compra. Volvé al checkout e intentá de nuevo.",
        }
      })
    }, CONTEXT_TIMEOUT_MS)

    return () => {
      window.removeEventListener("message", handler)
      window.clearTimeout(timeoutId)
    }
  }, [
    acceptContext,
    blockClient,
    emit,
    failFatal,
    previewMode,
    props.formIdForDiagnostics,
    props.parentOrigins,
  ])

  const emitHeight = useCallback(() => {
    if (previewMode) return
    if (!rootRef.current || !parentOriginRef.current) return
    // offsetHeight (border-box) so the parent's iframe includes our padding —
    // contentRect.height excludes it and the content gets clipped.
    const next = Math.ceil(rootRef.current.offsetHeight)
    if (Math.abs(next - lastHeightRef.current) < 4) return
    lastHeightRef.current = next
    const message = { type: "display", sizes: { iframeHeight: next } }
    window.parent.postMessage(message, parentOriginRef.current)
  }, [previewMode])

  useEffect(() => {
    if (typeof ResizeObserver === "undefined" || !rootRef.current) return
    const ro = new ResizeObserver(emitHeight)
    ro.observe(rootRef.current)
    return () => ro.disconnect()
  }, [emitHeight])

  // Re-measure after any state change that may have repainted the wizard.
  // The ResizeObserver alone misses two cases: (1) the very first paint, where
  // parentOrigin isn't known yet so the initial emit is dropped, and (2) phase
  // transitions whose content happens to match min-height — no resize fires
  // even though the parent has a stale (default) iframe height.
  useEffect(() => {
    const raf = requestAnimationFrame(emitHeight)
    return () => cancelAnimationFrame(raf)
  }, [emitHeight, phase, stepIndex, submitting, submitError, serverErrors])

  const steps = phase.kind === "ready" ? phase.steps : ([] as WizardStep[])
  const currentStep = steps[stepIndex]
  const completionRequired =
    phase.kind === "ready" ? phase.ctx.completion?.required === true : false

  function setStepAnswers(stepId: string, next: Record<string, unknown>) {
    setAnswers((prev) => ({ ...prev, [stepId]: next }))
  }

  function goNext(stepId: string, submitted: Record<string, unknown>) {
    setStepAnswers(stepId, submitted)
    setStepIndex((i) => Math.min(steps.length - 1, i + 1))
  }

  function goTo(index: number) {
    if (submitting) return
    if (index < 0 || index > stepIndex) return
    setSubmitError(null)
    setStepIndex(index)
  }

  function buildSubmissions(activeSteps: WizardStep[]) {
    return activeSteps
      .filter(
        (s): s is Extract<WizardStep, { kind: "group" }> => s.kind === "group",
      )
      .filter((s) => {
        const groupRequired = groupHasRequiredQuestion(s.group)
        return groupRequired || Object.keys(answers[s.stepId] ?? {}).length > 0
      })
      .map((s) => ({
        formId: s.formId,
        groupId: s.group.id,
        scope: s.group.scope,
        itemUuid: s.item?.uuid ?? null,
        answers: answers[s.stepId] ?? {},
      }))
  }

  // Deriva los partnerItems del preview con la MISMA función pura del servidor
  // (definition sección 9.8). El servidor es autoritativo en precio al submitear; acá
  // es solo para que el parent muestre el total. Usa los listados resueltos
  // (props.productLists) como lookup.
  // Lookup por id de producto, estable mientras no cambien los listados.
  const productLookup = useMemo(() => {
    const lookup = new Map<string, ProductForDerive>()
    for (const list of Object.values(props.productLists ?? {})) {
      for (const p of list) lookup.set(p.id, p)
    }
    return lookup
  }, [props.productLists])

  function buildPartnerItems(
    activeSteps: WizardStep[],
    currency: string,
  ): PartnerItem[] {
    if (!props.productLists) return []
    const sources: ProductAnswerSource[] = []
    for (const s of activeSteps) {
      if (s.kind !== "group") continue
      const stepAnswers = answers[s.stepId] ?? {}
      for (const q of s.group.questions) {
        if (q.type !== "product") continue
        const picks = toPicks(stepAnswers[q.id])
        if (picks.length === 0) continue
        sources.push({
          formId: s.formId,
          groupId: s.group.id,
          itemUuid: s.item?.uuid ?? null,
          questionId: q.id,
          picks,
        })
      }
    }
    if (sources.length === 0) return []
    // En el preview ignoramos los errores (el guard autoritativo corre en submit).
    return derivePartnerItems(sources, productLookup, currency).items
  }

  const findIncompleteStepIndex = useCallback(
    (activeSteps: WizardStep[], itemsLength: number): number => {
      for (let i = 0; i < activeSteps.length; i++) {
        const s = activeSteps[i]
        if (s.kind !== "group") continue
        const groupHasRequired = groupHasRequiredQuestion(s.group)
        const visited = answers[s.stepId] !== undefined
        if (!visited) {
          // Unvisited steps only block when they carry required content; an
          // optional step the user skipped past is fine.
          if (groupHasRequired) return i
          continue
        }
        // Visited step may have been edited backwards into an invalid state.
        const result = answersSchemaForGroup(s.group, {
          ticketCount: ticketCountForScope(s.group.scope, itemsLength),
        }).safeParse(answers[s.stepId])
        if (!result.success) return i
      }
      return -1
    },
    [answers],
  )

  async function handleParentSubmit(
    p: Extract<Phase, { kind: "ready" }>,
  ) {
    if (submitting) return
    setSubmitError(null)
    setServerErrors([])

    const failingIdx = findIncompleteStepIndex(p.steps, p.ctx.items.length)
    if (failingIdx >= 0) {
      // Required answers missing — stay silent toward the parent (no
      // `submitted`, no `error`), but surface a message in the iframe so
      // the user knows why we're not advancing. Parent will re-send
      // `submit` on the next click after they complete the step.
      setStepIndex(failingIdx)
      setSubmitError(
        "Faltan respuestas obligatorias antes de continuar al pago.",
      )
      return
    }

    setSubmitting(true)
    // Defensive: covers a race where `submit` arrives before the readiness
    // effect has had a chance to fire. Idempotent via la firma.
    emitSelected(buildPartnerItems(p.steps, p.ctx.currency))

    // Preview mode: never POST to the real submissions endpoint. Pretend the
    // round-trip succeeded so the user can see the "done" state.
    if (previewMode) {
      setSubmitting(false)
      setPhase({ kind: "done" })
      return
    }

    try {
      const res = await fetch("/api/transactions/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: {
            eventId: p.ctx.eventInfo.id,
            eventName: p.ctx.eventInfo.name,
            currency: p.ctx.currency,
            locale: p.ctx.locale,
            user: p.ctx.user ?? null,
            items: p.ctx.items,
          },
          submissions: buildSubmissions(p.steps),
        }),
      })

      const body = await res.json()
      if (!res.ok) {
        if (res.status === 422 && body?.error?.details?.errors) {
          setServerErrors(body.error.details.errors)
          const first = body.error.details.errors[0]
          const idx = p.steps.findIndex(
            (s) =>
              s.kind === "group" &&
              s.formId === first.formId &&
              s.group.id === first.groupId &&
              (s.item?.uuid ?? null) === (first.itemUuid ?? null),
          )
          if (idx >= 0) setStepIndex(idx)
          setSubmitError(body.error.message ?? "Hay respuestas inválidas")
          return
        }
        if (res.status >= 500) {
          emitError("internal_error", "submit failed")
        }
        setSubmitError(body?.error?.message ?? "Error inesperado")
        return
      }

      const message = {
        type: "interaction" as const,
        status: "submitted" as const,
        interaction: body.interaction,
        currency: p.ctx.currency,
        // Items autoritativos que devolvió el servidor (definition sección 9.7).
        partnerItems: body.partnerItems ?? [],
      }
      emit(message)
      setPhase({ kind: "done" })
    } catch (err) {
      console.error("[embed.submit] network error", err)
      emitError("internal_error", "network error")
      setSubmitError("Error de red. Probá de nuevo.")
    } finally {
      setSubmitting(false)
    }
  }

  // Keep a ref to the latest submit handler so the window listener can stay
  // mounted across renders (otherwise it would tear down on every keystroke,
  // since the closure reads fresh `answers` / `submitting`).
  onParentSubmitRef.current =
    phase.kind === "ready" ? () => void handleParentSubmit(phase) : null

  useEffect(() => {
    if (previewMode) return
    if (phase.kind !== "ready") return
    function handler(event: MessageEvent) {
      if (!props.parentOrigins.includes(event.origin)) return
      const data = event.data as { status?: unknown } | null
      if (!data || typeof data !== "object") return
      if (data.status !== "submit") return
      onParentSubmitRef.current?.()
    }
    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [phase.kind, previewMode, props.parentOrigins])

  // Drives the selected/cleared handshake. El parent (Crowder) usa `selected`
  // para mostrar el total Y para habilitar "Continuar al pago" (señal acoplada,
  // no hay un mensaje aparte de "actualizá el carrito sin dejar pagar").
  //
  // Política "reflejar de inmediato": si ya hay productos derivados, emitimos
  // `selected` con ellos AUNQUE el resto del form siga incompleto, para que el
  // carrito de Crowder los tome al instante. La integridad no se relaja: el pago
  // efectivo lo sigue gateando `handleParentSubmit`, que no emite `submitted` si
  // faltan respuestas obligatorias. Sin productos seleccionados se conserva el
  // gate por completitud (form-only): selected([]) al completar, cleared si falta.
  useEffect(() => {
    if (phase.kind !== "ready") return
    if (submitting) return
    const items = buildPartnerItems(phase.steps, phase.ctx.currency)
    const complete =
      findIncompleteStepIndex(phase.steps, phase.ctx.items.length) === -1
    if (items.length > 0 || complete) emitSelected(items)
    else emitClearedAfterSelected()
    // buildPartnerItems lee `answers`, así que `answers` debe estar en deps para
    // re-derivar cuando cambia la selección de productos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    phase,
    answers,
    submitting,
    findIncompleteStepIndex,
    emitSelected,
    emitClearedAfterSelected,
  ])

  function handleSkip() {
    emit({ type: "interaction", status: "cleared" })
  }

  return (
    <div
      ref={rootRef}
      data-embed-root
      className="relative flex min-h-[480px] w-full flex-col gap-8 px-4 py-6 text-sm sm:min-h-[560px] sm:px-6 sm:py-8"
    >
      {phase.kind === "waiting" && (
        <div
          className="flex flex-1 items-center justify-center py-12"
          role="status"
          aria-label="Cargando"
        >
          <Spinner />
        </div>
      )}

      {phase.kind === "fatal" && (
        <PhaseStatus
          title={phase.title}
          detail={phase.message}
          tone="error"
        />
      )}

      {phase.kind === "empty" && (
        <EmptyState
          reason={phase.reason}
          canSkip={!completionRequired}
          onSkip={handleSkip}
        />
      )}

      {phase.kind === "done" && (
        <div
          className="flex flex-1 items-center justify-center py-12"
          role="status"
          aria-label="Listo"
        >
          <Spinner />
        </div>
      )}

      {phase.kind === "ready" && currentStep && (
        <WizardBody
          steps={steps}
          stepIndex={stepIndex}
          step={currentStep}
          answers={answers}
          submitError={submitError}
          serverErrors={serverErrors}
          submitting={submitting}
          ctx={phase.ctx}
          forms={props.forms}
          productLists={props.productLists}
          onJumpTo={goTo}
          onNext={goNext}
          onChange={setStepAnswers}
          previewMode={previewMode}
          onPreviewSubmit={
            previewMode
              ? () => void handleParentSubmit(phase as Extract<Phase, { kind: "ready" }>)
              : undefined
          }
        />
      )}
    </div>
  )
}

function WizardBody({
  steps,
  stepIndex,
  step,
  answers,
  submitError,
  serverErrors,
  submitting,
  ctx,
  forms,
  productLists,
  onJumpTo,
  onNext,
  onChange,
  previewMode,
  onPreviewSubmit,
}: {
  steps: WizardStep[]
  stepIndex: number
  step: WizardStep
  answers: AnswersByStep
  submitError: string | null
  serverErrors: ServerError[]
  submitting: boolean
  ctx: IframeContext
  forms: PublishedForm[]
  productLists?: ProductLists
  onJumpTo: (index: number) => void
  onNext: (stepId: string, answers: Record<string, unknown>) => void
  onChange: (stepId: string, answers: Record<string, unknown>) => void
  previewMode: boolean
  onPreviewSubmit?: () => void
}) {
  const isLastStep = stepIndex === steps.length - 1
  const showNextButton = step.kind === "group" && !isLastStep
  const showPreviewSubmit = previewMode && isLastStep

  return (
    <>
      {steps.length > 1 && (
        <Stepper
          stepIndex={stepIndex}
          total={steps.length}
          disabled={submitting}
          onJumpTo={onJumpTo}
        />
      )}

      {step.kind === "group" ? (
        <StepHeader step={step} singleStep={steps.length === 1} />
      ) : (
        <header className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Casi listo
          </h2>
          <p className="text-sm text-muted-foreground">
            Revisá tus respuestas antes de continuar al pago.
          </p>
        </header>
      )}

      {submitError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {submitError}
        </div>
      )}

      {step.kind === "group" && (
        <GroupStep
          step={step}
          stepId={step.stepId}
          currency={ctx.currency}
          ticketCount={ticketCountForScope(step.group.scope, ctx.items.length)}
          productLists={productLists}
          initial={answers[step.stepId] ?? prefillAnswers(step, ctx.user)}
          onChange={(next) => onChange(step.stepId, next)}
          onSubmit={(submitted) => onNext(step.stepId, submitted)}
          relevantServerErrors={serverErrors.filter(
            (e) =>
              e.formId === step.formId &&
              e.groupId === step.group.id &&
              (e.itemUuid ?? null) === (step.item?.uuid ?? null),
          )}
        />
      )}

      {step.kind === "confirm" && (
        <ConfirmStep steps={steps} answers={answers} forms={forms} />
      )}

      {(stepIndex > 0 || showNextButton || showPreviewSubmit) && (
        <div
          className={cx(
            "flex items-center pt-2",
            stepIndex > 0 ? "justify-between" : "justify-end",
          )}
        >
          {stepIndex > 0 && (
            <Button
              type="button"
              variant="ghost"
              disabled={submitting}
              onClick={() => onJumpTo(stepIndex - 1)}
              className="embed-cta"
            >
              Atrás
            </Button>
          )}
          {showNextButton && (
            <Button
              type="submit"
              form={formIdFor(step.stepId)}
              variant="secondary"
              disabled={submitting}
              className="embed-cta"
            >
              Siguiente
            </Button>
          )}
          {showPreviewSubmit && (
            <Button
              type="button"
              variant="secondary"
              disabled={submitting}
              onClick={onPreviewSubmit}
              className="embed-cta"
            >
              Enviar (vista previa)
            </Button>
          )}
        </div>
      )}

      {submitting && <SubmittingOverlay />}
    </>
  )
}

function GroupStep({
  step,
  stepId,
  currency,
  ticketCount,
  productLists,
  initial,
  onChange,
  onSubmit,
  relevantServerErrors,
}: {
  step: Extract<WizardStep, { kind: "group" }>
  stepId: string
  currency: string
  ticketCount: number
  productLists?: ProductLists
  initial: Record<string, unknown>
  onChange: (a: Record<string, unknown>) => void
  onSubmit: (a: Record<string, unknown>) => void
  relevantServerErrors: ServerError[]
}) {
  // Subconjunto del listado para este form, re-clavado por questionId
  // (la prop global viene como `${formId}::${questionId}`).
  const productsByQuestion: Record<string, RenderProduct[]> = {}
  if (productLists) {
    const prefix = `${step.formId}::`
    for (const [key, list] of Object.entries(productLists)) {
      if (key.startsWith(prefix)) productsByQuestion[key.slice(prefix.length)] = list
    }
  }
  return (
    <div className="space-y-4">
      {relevantServerErrors.length > 0 && (
        <ul className="space-y-1 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          {relevantServerErrors.map((e, i) => (
            <li key={i}>
              {e.questionId ? `${e.questionId}: ` : ""}
              {e.message}
            </li>
          ))}
        </ul>
      )}
      <FormRenderer
        key={stepId}
        group={step.group}
        initialAnswers={initial}
        onChange={onChange}
        onSubmit={async (a) => onSubmit(a)}
        formId={formIdFor(stepId)}
        productLists={productsByQuestion}
        currency={currency}
        ticketCount={ticketCount}
        omitHeader
        omitSubmit
        variant="embed"
      />
    </div>
  )
}

function headerMain(step: Extract<WizardStep, { kind: "group" }>): string {
  if (step.group.scope !== "item") return step.group.title
  const item = step.item
  if (item?.holder) return `${item.holder.firstName} ${item.holder.lastName}`
  if (!item) return ""
  return [item.sectorName, item.rateName].filter(Boolean).join(" · ")
}

function StepHeader({
  step,
  singleStep,
}: {
  step: Extract<WizardStep, { kind: "group" }>
  singleStep: boolean
}) {
  const isItem = step.group.scope === "item"
  const item = step.item
  const main = headerMain(step)

  const itemParts: string[] = []
  if (isItem && item) {
    itemParts.push(`${item.sectorName} · ${item.rateName}`)
    if (item.row) itemParts.push(`Fila ${item.row}`)
    if (item.seat) itemParts.push(`Asiento ${item.seat}`)
    itemParts.push(item.uuid.slice(0, 8))
  }
  const description = !isItem ? step.group.description : undefined
  // En single-group el título del grupo es redundante con el título del form,
  // así que lo ocultamos y dejamos solo la descripción.
  const hideTitle = singleStep && !isItem

  if (hideTitle && !description) return null

  return (
    <header className="space-y-1">
      {isItem && (
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {step.group.title}
        </div>
      )}
      {!hideTitle && (
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {main}
        </h2>
      )}
      {itemParts.length > 0 && (
        <p className="font-mono text-xs text-muted-foreground">{itemParts.join(" · ")}</p>
      )}
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      {step.itemTotal && step.itemIndex && (
        <p className="text-xs text-muted-foreground">
          {step.itemIndex} de {step.itemTotal}
        </p>
      )}
    </header>
  )
}

function ConfirmStep({
  steps,
  answers,
  forms,
}: {
  steps: WizardStep[]
  answers: AnswersByStep
  forms: PublishedForm[]
}) {
  const groupSteps = steps.filter(
    (s): s is Extract<WizardStep, { kind: "group" }> => s.kind === "group",
  )
  return (
    <div className="divide-y divide-border rounded-lg border border-border bg-card text-sm">
      {groupSteps.map((s) => {
        const stepAnswers = answers[s.stepId] ?? {}
        const form = forms.find((f) => f.id === s.formId)
        const answeredQuestions = s.group.questions.filter(
          (q) => q.type !== "info",
        )
        const itemSubtitle =
          s.item &&
          [s.item.sectorName, s.item.rateName].filter(Boolean).join(" · ")
        const heading = s.item?.holder
          ? `${s.item.holder.firstName} ${s.item.holder.lastName}`
          : s.group.title
        const eyebrow = s.item?.holder
          ? `${form?.title ?? s.formId} · ${s.group.title}`
          : (form?.title ?? s.formId)

        return (
          <section key={s.stepId} className="px-4 py-3">
            <header className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <h3 className="text-sm font-semibold tracking-tight text-foreground">
                {heading}
              </h3>
              <p className="text-xs text-muted-foreground">{eyebrow}</p>
              {itemSubtitle && (
                <p className="text-xs text-muted-foreground">
                  · {itemSubtitle}
                </p>
              )}
            </header>

            {answeredQuestions.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin respuestas.</p>
            ) : (
              <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-x-4 gap-y-1">
                {answeredQuestions.map((q) => (
                  <Fragment key={q.id}>
                    <dt className="truncate text-xs text-muted-foreground">
                      {q.label}
                    </dt>
                    <dd className="break-words text-xs text-foreground">
                      {formatValue(stepAnswers[q.id])}
                    </dd>
                  </Fragment>
                ))}
              </dl>
            )}
          </section>
        )
      })}
    </div>
  )
}

function Stepper({
  stepIndex,
  total,
  disabled,
  onJumpTo,
}: {
  stepIndex: number
  total: number
  disabled: boolean
  onJumpTo: (index: number) => void
}) {
  const segmentClass =
    "h-1.5 flex-1 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
  return (
    <div className="space-y-2">
      <span className="text-xs text-muted-foreground">
        Paso {stepIndex + 1} de {total}
      </span>
      <div
        role="tablist"
        aria-label="Pasos del formulario"
        className="flex items-center gap-1.5"
      >
        {Array.from({ length: total }, (_, i) => {
          const isPast = i < stepIndex
          const isCurrent = i === stepIndex
          if (isCurrent) {
            return (
              <span
                key={i}
                aria-current="step"
                className={cx(segmentClass, "bg-primary")}
              />
            )
          }
          if (isPast) {
            return (
              <button
                key={i}
                type="button"
                role="tab"
                aria-label={`Volver al paso ${i + 1}`}
                onClick={() => onJumpTo(i)}
                disabled={disabled}
                className={cx(
                  segmentClass,
                  "bg-primary/60",
                  !disabled && "cursor-pointer hover:bg-primary",
                )}
              />
            )
          }
          return <span key={i} className={cx(segmentClass, "bg-subtle")} />
        })}
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground motion-reduce:animate-none"
    />
  )
}

function SubmittingOverlay() {
  return (
    <div
      role="status"
      aria-label="Confirmando"
      className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm"
    >
      <Spinner />
    </div>
  )
}

function PhaseStatus({
  title,
  detail,
  tone,
}: {
  title: string
  detail: string
  tone?: "error"
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
      <h1
        className={cx(
          "text-lg font-semibold",
          tone === "error" ? "text-destructive" : "text-foreground",
        )}
      >
        {title}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
    </div>
  )
}

function EmptyState({
  reason,
  canSkip,
  onSkip,
}: {
  reason: "no_steps" | "no_items"
  canSkip: boolean
  onSkip: () => void
}) {
  const message =
    reason === "no_items"
      ? "No hay items que requieran datos adicionales."
      : "No hay formularios para completar."
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-center">
      <p className="text-sm text-secondary-foreground">{message}</p>
      {canSkip && (
        <Button variant="secondary" onClick={onSkip} className="embed-cta">
          Continuar
        </Button>
      )}
    </div>
  )
}

// Resumen legible de un ProductPick desde su snapshot congelado: "Camiseta (M /
// Rojo) ×2 — S/ 15.000". El precio sale del snapshot (no del catálogo vivo).
function formatProductPick(pick: ProductPick): string {
  const { snapshot } = pick
  const name = snapshot.variantTitle
    ? `${snapshot.title} (${snapshot.variantTitle})`
    : snapshot.title
  const qty = pick.quantity && pick.quantity > 1 ? ` ×${pick.quantity}` : ""
  const price =
    snapshot.price != null
      ? ` — ${formatPrice(snapshot.price, snapshot.currency)}`
      : ""
  return `${name}${qty}${price}`
}

function formatValue(v: unknown): string {
  if (v == null || v === "") return "—"
  if (isProductPick(v)) return formatProductPick(v)
  if (Array.isArray(v)) {
    return v
      .map((item) => (isProductPick(item) ? formatProductPick(item) : String(item)))
      .join(", ")
  }
  if (typeof v === "boolean") return v ? "Sí" : "No"
  return String(v)
}

function formIdFor(stepId: string): string {
  return `wizard-step-${stepId.replace(/[^a-z0-9_-]/gi, "_")}`
}

function initialPreviewPhase(
  forms: PublishedForm[],
  ctx: IframeContext,
): Phase {
  const steps = buildSteps(forms, ctx.items)
  if (steps.length === 0) {
    return { kind: "empty", ctx, reason: emptyReason(forms, ctx.items) }
  }
  return { kind: "ready", steps, ctx }
}
