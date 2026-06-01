"use client"

import {
  RiCircleFill,
  RiDownloadLine,
  RiEyeLine,
  RiUploadLine,
} from "@remixicon/react"
import { useEffect, useMemo, useRef, useState, useTransition } from "react"

import { Badge } from "@/components/Badge"
import { Banner } from "@/components/Banner"
import { Button } from "@/components/Button"
import { Toast } from "@/components/Toast"
import type { StatusVariant } from "@/components/_status-variants"
import {
  FormInspector,
  GroupInspector,
  QuestionInspector,
  type FormMeta,
} from "@/components/form-builder/Inspector"
import { Outline } from "@/components/form-builder/Outline"
import { PreviewDrawer } from "@/components/form-builder/PreviewDrawer"
import {
  deriveId,
  newGroup,
  newQuestion,
} from "@/components/form-builder/derive"
import type { BuilderSelection } from "@/components/form-builder/types"
import type {
  FormDefinition,
  FormGroup,
  FormQuestion,
} from "@/lib/db/schema"
import { formDefinitionSchema } from "@/lib/form-schema"
import { derivePublishDisabledReason } from "@/lib/form-publish-status"
import { DateTime } from "@/components/DateTime"

import {
  publishFormAction,
  updateFormAction,
  type ActionResult,
} from "../../actions"
import type { Form, FormVersion } from "@/modules/forms"

import { HistoryPanel } from "./HistoryPanel"

export function FormEditor({
  form,
  versions,
}: {
  form: Form
  versions: FormVersion[]
}) {
  const [meta, setMeta] = useState<FormMeta>({
    title: form.title,
    enabled: form.enabled,
  })
  const [definition, setDefinition] = useState<FormDefinition>(form.definition)
  const [selection, setSelection] = useState<BuilderSelection>({ kind: "form" })
  const [previewOpen, setPreviewOpen] = useState(false)
  const [saving, startSaveTransition] = useTransition()
  const [publishing, startPublishTransition] = useTransition()
  const [saveResult, setSaveResult] = useState<ActionResult | null>(null)
  const [publishMessage, setPublishMessage] = useState<string | null>(null)
  const [ioMessage, setIoMessage] = useState<
    { kind: "ok" | "error"; text: string } | null
  >(null)
  const [dirty, setDirty] = useState(false)
  const [toast, setToast] = useState<
    { variant: StatusVariant; title: string; body?: string } | null
  >(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  function patchMeta(patch: Partial<FormMeta>) {
    setMeta((m) => ({ ...m, ...patch }))
    setDirty(true)
    setSaveResult(null)
  }
  function patchDefinition(next: FormDefinition) {
    setDefinition(next)
    setDirty(true)
    setSaveResult(null)
  }

  function addGroup() {
    const taken = new Set(definition.groups.map((g) => g.id))
    const group = newGroup(taken)
    patchDefinition({ ...definition, groups: [...definition.groups, group] })
    setSelection({ kind: "group", gIdx: definition.groups.length })
  }
  function patchGroup(gIdx: number, patch: Partial<FormGroup>) {
    const groups = definition.groups.map((g, i) => {
      if (i !== gIdx) return g
      const next = { ...g, ...patch }
      if (patch.title !== undefined) {
        const otherIds = new Set(
          definition.groups.filter((_, j) => j !== gIdx).map((og) => og.id),
        )
        next.id = deriveId(next.title, "grupo", otherIds)
        if (g.labelTemplate === g.title) next.labelTemplate = next.title
      }
      return next
    })
    patchDefinition({ ...definition, groups })
  }
  function removeGroup(gIdx: number) {
    if (definition.groups.length <= 1) return
    patchDefinition({
      ...definition,
      groups: definition.groups.filter((_, i) => i !== gIdx),
    })
    setSelection({ kind: "form" })
  }
  function moveGroup(gIdx: number, dir: -1 | 1) {
    const target = gIdx + dir
    if (target < 0 || target >= definition.groups.length) return
    const groups = [...definition.groups]
    ;[groups[gIdx], groups[target]] = [groups[target], groups[gIdx]]
    patchDefinition({ ...definition, groups })
    setSelection({ kind: "group", gIdx: target })
  }

  function addQuestion(gIdx: number) {
    const group = definition.groups[gIdx]
    const taken = new Set(group.questions.map((q) => q.id))
    const question = newQuestion(taken)
    const nextIdx = group.questions.length
    patchGroup(gIdx, { questions: [...group.questions, question] })
    setSelection({ kind: "question", gIdx, qIdx: nextIdx })
  }
  function patchQuestion(
    gIdx: number,
    qIdx: number,
    patch: Partial<FormQuestion>,
  ) {
    const group = definition.groups[gIdx]
    const questions = group.questions.map((q, i) => {
      if (i !== qIdx) return q
      const next = { ...q, ...patch } as FormQuestion
      if (patch.label !== undefined && q.type !== "info") {
        const otherIds = new Set(
          group.questions.filter((_, j) => j !== qIdx).map((oq) => oq.id),
        )
        next.id = deriveId(next.label, "pregunta", otherIds)
      }
      return next
    })
    patchGroup(gIdx, { questions })
  }
  function removeQuestion(gIdx: number, qIdx: number) {
    const group = definition.groups[gIdx]
    if (group.questions.length <= 1) return
    patchGroup(gIdx, {
      questions: group.questions.filter((_, i) => i !== qIdx),
    })
    setSelection({ kind: "group", gIdx })
  }
  function moveQuestion(gIdx: number, qIdx: number, dir: -1 | 1) {
    const group = definition.groups[gIdx]
    const target = qIdx + dir
    if (target < 0 || target >= group.questions.length) return
    const questions = [...group.questions]
    ;[questions[qIdx], questions[target]] = [questions[target], questions[qIdx]]
    patchGroup(gIdx, { questions })
    setSelection({ kind: "question", gIdx, qIdx: target })
  }

  function handleSave() {
    setSaveResult(null)
    setPublishMessage(null)
    const fd = new FormData()
    fd.set("title", meta.title)
    if (meta.enabled) fd.set("enabled", "on")
    fd.set("definition", JSON.stringify(definition))
    startSaveTransition(async () => {
      const result = await updateFormAction(form.id, null, fd)
      setSaveResult(result)
      if (result.ok) {
        setDirty(false)
        setToast({ variant: "success", title: "Cambios guardados" })
      } else {
        setToast({
          variant: "error",
          title: "No se pudo guardar",
          body: result.fieldErrors?.definition ?? result.error,
        })
      }
    })
  }
  function handlePublish() {
    if (publishDisabledReason) {
      setToast({ variant: "warning", title: publishDisabledReason })
      return
    }
    setPublishMessage(null)
    startPublishTransition(async () => {
      const result = await publishFormAction(form.id)
      setPublishMessage(
        result.ok ? "Publicado." : `No se pudo publicar: ${result.error}`,
      )
      setToast(
        result.ok
          ? { variant: "success", title: "Formulario publicado" }
          : {
              variant: "error",
              title: "No se pudo publicar",
              body: result.error,
            },
      )
    })
  }
  function handleExport() {
    setIoMessage(null)
    const payload = JSON.stringify(definition, null, 2)
    const blob = new Blob([payload], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    const slug = form.id.replace(/[^a-z0-9_-]+/gi, "_")
    a.href = url
    a.download = `${slug}.form.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }
  function handleImportClick() {
    setIoMessage(null)
    importInputRef.current?.click()
  }
  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    try {
      const text = await file.text()
      const raw = JSON.parse(text)
      const parsed = formDefinitionSchema.parse(raw) as FormDefinition
      if (
        !confirm(
          `Reemplazar la definición actual con ${parsed.groups.length} grupo(s) del archivo "${file.name}"?`,
        )
      ) {
        return
      }
      patchDefinition(parsed)
      setSelection({ kind: "form" })
      setIoMessage({ kind: "ok", text: `Importado desde ${file.name}.` })
      setToast({
        variant: "success",
        title: "Definición importada",
        body: file.name,
      })
    } catch (err) {
      const message =
        err instanceof SyntaxError
          ? "JSON inválido."
          : err instanceof Error
            ? err.message
            : "No se pudo importar."
      setIoMessage({ kind: "error", text: message })
      setToast({ variant: "error", title: "No se pudo importar", body: message })
    }
  }

  let inspector
  if (selection.kind === "form") {
    inspector = (
      <FormInspector
        meta={meta}
        fieldErrors={
          saveResult && !saveResult.ok ? saveResult.fieldErrors : undefined
        }
        onPatch={patchMeta}
      />
    )
  } else if (selection.kind === "group") {
    const group = definition.groups[selection.gIdx]
    inspector = group ? (
      <GroupInspector
        group={group}
        gIdx={selection.gIdx}
        total={definition.groups.length}
        onPatch={(patch) => patchGroup(selection.gIdx, patch)}
        onRemove={() => removeGroup(selection.gIdx)}
        onMove={(dir) => moveGroup(selection.gIdx, dir)}
        onSelectQuestion={(qIdx) =>
          setSelection({ kind: "question", gIdx: selection.gIdx, qIdx })
        }
        onAddQuestion={() => addQuestion(selection.gIdx)}
      />
    ) : null
  } else {
    const group = definition.groups[selection.gIdx]
    const question = group?.questions[selection.qIdx]
    inspector = group && question ? (
      <QuestionInspector
        question={question}
        groupScope={group.scope}
        qIdx={selection.qIdx}
        totalInGroup={group.questions.length}
        groupTitle={group.title || "Grupo"}
        siblings={group.questions
          .map((sq) => ({ id: sq.id, label: sq.label || sq.id }))
          .filter((_, i) => i !== selection.qIdx)}
        onPatch={(patch) => patchQuestion(selection.gIdx, selection.qIdx, patch)}
        onRemove={() => removeQuestion(selection.gIdx, selection.qIdx)}
        onMove={(dir) => moveQuestion(selection.gIdx, selection.qIdx, dir)}
        onBackToGroup={() => setSelection({ kind: "group", gIdx: selection.gIdx })}
      />
    ) : null
  }

  const lastVersion = versions[0]
  const isDraft = meta.enabled && !form.publishedAt
  const publishDisabledReason = useMemo(
    () => derivePublishDisabledReason({ dirty, definition, lastVersion }),
    [dirty, definition, lastVersion],
  )

  return (
    <>
      {isDraft && (
        <Banner
          variant="warning"
          title="Este formulario está en borrador."
          className="mb-4 rounded-md border-x"
          action={{ label: "Publicar ahora", onClick: handlePublish }}
        >
          Todavía no aparece en el checkout. Publicalo para activarlo.
        </Banner>
      )}
      <div className="flex h-[calc(100vh-9rem)] min-h-[560px] flex-col overflow-hidden rounded-lg border border-border bg-background shadow-sm">
        <EditorHeader
          meta={meta}
          enabled={meta.enabled}
          publishedAt={form.publishedAt ? form.publishedAt.toISOString() : null}
          lastVersion={lastVersion?.version ?? null}
          dirty={dirty}
          saving={saving}
          publishing={publishing}
          publishDisabledReason={publishDisabledReason}
          saveResult={saveResult}
          publishMessage={publishMessage}
          ioMessage={ioMessage}
          onSave={handleSave}
          onPublish={handlePublish}
          onOpenPreview={() => setPreviewOpen(true)}
          onExport={handleExport}
          onImport={handleImportClick}
        />
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleImportFile}
        />
        <div className="flex flex-1 overflow-hidden">
          <Outline
            definition={definition}
            selection={selection}
            onSelect={setSelection}
            onAddGroup={addGroup}
            onAddQuestion={addQuestion}
          >
            <HistoryPanel versions={versions} />
          </Outline>
          {inspector}
        </div>
      </div>

      <PreviewDrawer
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        formId={form.id}
        definition={definition}
        title={meta.title}
        theme={form.theme ?? null}
      />

      {toast && (
        <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col gap-2">
          <div className="pointer-events-auto">
            <Toast
              variant={toast.variant}
              title={toast.title}
              onDismiss={() => setToast(null)}
            >
              {toast.body}
            </Toast>
          </div>
        </div>
      )}
    </>
  )
}

function EditorHeader({
  meta,
  enabled,
  publishedAt,
  lastVersion,
  dirty,
  saving,
  publishing,
  publishDisabledReason,
  saveResult,
  publishMessage,
  ioMessage,
  onSave,
  onPublish,
  onOpenPreview,
  onExport,
  onImport,
}: {
  meta: FormMeta
  enabled: boolean
  publishedAt: string | null
  lastVersion: number | null
  dirty: boolean
  saving: boolean
  publishing: boolean
  publishDisabledReason: string | null
  saveResult: ActionResult | null
  publishMessage: string | null
  ioMessage: { kind: "ok" | "error"; text: string } | null
  onSave: () => void
  onPublish: () => void
  onOpenPreview: () => void
  onExport: () => void
  onImport: () => void
}) {
  return (
    <header className="border-b border-border bg-background">
      <div className="flex flex-wrap items-center justify-end gap-2 px-5 pb-2 pt-3">
        <StatusNote
          dirty={dirty}
          saving={saving}
          saveResult={saveResult}
          publishMessage={publishMessage}
          ioMessage={ioMessage}
        />
        <Button type="button" variant="secondary" onClick={onOpenPreview}>
          <RiEyeLine className="size-4" aria-hidden="true" /> Vista previa
        </Button>
        <Button type="button" variant="secondary" onClick={onExport}>
          <RiDownloadLine className="size-4" aria-hidden="true" /> Exportar
        </Button>
        <Button type="button" variant="secondary" onClick={onImport}>
          <RiUploadLine className="size-4" aria-hidden="true" /> Importar
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onSave}
          isLoading={saving}
        >
          Guardar
        </Button>
        <Button
          type="button"
          onClick={onPublish}
          isLoading={publishing}
          disabled={publishDisabledReason !== null}
          title={publishDisabledReason ?? undefined}
        >
          Publicar
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <h2 className="truncate text-lg font-semibold tracking-tight text-foreground">
            {meta.title || "(sin título)"}
          </h2>
          <FormStatusBadge enabled={enabled} publishedAt={publishedAt} />
        </div>
        {publishedAt && lastVersion !== null && (
          <div className="text-xs text-muted-foreground">
            <span>
              Última versión:{" "}
              <span className="font-mono">v{lastVersion}</span>
              {" · "}
              <DateTime value={publishedAt} />
            </span>
          </div>
        )}
      </div>
    </header>
  )
}

function FormStatusBadge({
  enabled,
  publishedAt,
}: {
  enabled: boolean
  publishedAt: string | null
}) {
  if (!enabled) return <Badge variant="neutral">Archivado</Badge>
  if (publishedAt) return <Badge variant="success">Publicado</Badge>
  return <Badge variant="warning">Borrador</Badge>
}

function StatusNote({
  dirty,
  saving,
  saveResult,
  publishMessage,
  ioMessage,
}: {
  dirty: boolean
  saving: boolean
  saveResult: ActionResult | null
  publishMessage: string | null
  ioMessage: { kind: "ok" | "error"; text: string } | null
}) {
  if (saving) return null
  if (saveResult?.ok) {
    return (
      <span className="mr-2 text-xs text-muted-foreground">
        Cambios guardados.
      </span>
    )
  }
  if (saveResult && !saveResult.ok) {
    return (
      <span className="mr-2 text-xs text-destructive">
        {saveResult.fieldErrors?.definition ?? saveResult.error}
      </span>
    )
  }
  if (publishMessage) {
    return <span className="mr-2 text-xs text-muted-foreground">{publishMessage}</span>
  }
  if (ioMessage) {
    return (
      <span
        className={
          "mr-2 text-xs " +
          (ioMessage.kind === "ok"
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-destructive")
        }
      >
        {ioMessage.text}
      </span>
    )
  }
  if (dirty) {
    return (
      <span className="mr-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <RiCircleFill
          className="size-1.5 text-yellow-500 dark:text-yellow-400"
          aria-hidden="true"
        />
        Cambios sin guardar
      </span>
    )
  }
  return null
}
