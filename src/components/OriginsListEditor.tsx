"use client"

import { RiAddLine, RiCloseLine } from "@remixicon/react"
import type { ReactNode } from "react"
import { useEffect, useRef, useState, useTransition } from "react"

import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import { normalizeOrigin } from "@/lib/origins"

// Editor de lista de orígenes reutilizable: lo usan tanto el form (con fallback
// global vía `inherited`) como Settings (config global, sin herencia). El
// `onSave` recibe la lista resultante y devuelve un resultado uniforme.
export function OriginsListEditor({
  title,
  description,
  initial,
  inherited,
  onSave,
}: {
  title: string
  description: ReactNode
  initial: string[]
  // Cuando se pasa, la lista vacía hereda estos orígenes (override semantics).
  inherited?: string[]
  onSave: (origins: string[]) => Promise<{ ok: boolean; error?: string }>
}) {
  const [origins, setOrigins] = useState<string[]>(initial)
  const [draft, setDraft] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    },
    [],
  )

  const dirty =
    origins.length !== initial.length ||
    origins.some((o, i) => o !== initial[i])

  const hasFallback = inherited !== undefined
  const inheriting = hasFallback && origins.length === 0

  function flashSaved() {
    setSaved(true)
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    savedTimerRef.current = setTimeout(() => setSaved(false), 2000)
  }

  function handleAdd() {
    const result = normalizeOrigin(draft)
    if (!result.ok) {
      setError(result.error)
      return
    }
    if (origins.includes(result.value)) {
      setError("este origen ya está en la lista")
      return
    }
    setOrigins([...origins, result.value])
    setDraft("")
    setError(null)
  }

  function handleRemove(origin: string) {
    setOrigins(origins.filter((o) => o !== origin))
  }

  function persist(next: string[]) {
    setError(null)
    startTransition(async () => {
      const res = await onSave(next)
      if (!res.ok) {
        setError(res.error ?? "Error al guardar")
        return
      }
      flashSaved()
    })
  }

  return (
    <div className="space-y-2">
      <div>
        <span className="text-xs font-medium text-secondary-foreground">
          {title}
        </span>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>

      {origins.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {origins.map((o) => (
            <li
              key={o}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-muted py-1 pl-2 pr-1 font-mono text-xs text-secondary-foreground"
            >
              {o}
              <button
                type="button"
                onClick={() => handleRemove(o)}
                className="rounded p-0.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                aria-label={`Quitar ${o}`}
              >
                <RiCloseLine className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {inheriting && (
        <div className="rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          {inherited.length > 0 ? (
            <>
              Heredando los orígenes globales:
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {inherited.map((o) => (
                  <li
                    key={o}
                    className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-secondary-foreground"
                  >
                    {o}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            "No hay orígenes globales configurados, así que ningún parent podrá comunicarse con el iframe. Agregá uno acá o configuralo en Settings."
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            if (error) setError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              handleAdd()
            }
          }}
          placeholder="https://checkout.partner.com"
          className="h-8 font-mono text-xs"
        />
        <Button
          type="button"
          variant="secondary"
          onClick={handleAdd}
          className="h-8 shrink-0 px-2 text-xs"
        >
          <RiAddLine className="mr-1 size-3.5" />
          Agregar
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex items-center justify-end gap-2 pt-1">
        {saved && (
          <span className="text-xs text-muted-foreground">Guardado</span>
        )}
        {hasFallback && initial.length > 0 && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setOrigins([])
              persist([])
            }}
            disabled={pending}
            className="h-8 px-3 text-xs"
          >
            Usar orígenes globales
          </Button>
        )}
        <Button
          type="button"
          onClick={() => persist(origins)}
          disabled={!dirty || pending}
          className="h-8 px-3 text-xs"
        >
          {pending ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </div>
  )
}
