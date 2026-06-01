"use client"

import { useEffect, useRef, useState, useTransition } from "react"

import { Button } from "@/components/Button"
import { Card } from "@/components/Card"
import { Input } from "@/components/Input"
import { updateFormThemeAction } from "@/app/(dashboard)/forms/actions"

export function BrandCard({
  formId,
  formPrimary,
  shopPrimary,
  defaultPrimary,
}: {
  formId: string
  formPrimary: string | null
  shopPrimary: string | null
  defaultPrimary: string
}) {
  const fallback = shopPrimary ?? defaultPrimary
  const [input, setInput] = useState(formPrimary ?? fallback)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current)
    },
    [],
  )

  const overrideActive = formPrimary !== null

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInput(e.target.value)
    if (error) setError(null)
  }

  function flashSaved() {
    setSaved(true)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSaved(false), 2000)
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const res = await updateFormThemeAction(formId, input)
      if (!res.ok) {
        setError(res.error)
        return
      }
      flashSaved()
    })
  }

  function handleReset() {
    setError(null)
    startTransition(async () => {
      const res = await updateFormThemeAction(formId, null)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setInput(fallback)
      flashSaved()
    })
  }

  return (
    <Card className="space-y-3 bg-background">
      <div>
        <h2 className="text-sm font-semibold text-foreground">
          Color de marca de este formulario
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Override del color del partner solo para este form. Si lo dejás vacío,
          se usa el color global del shop
          {shopPrimary ? (
            <>
              {" "}(
              <code className="font-mono">{shopPrimary}</code>).
            </>
          ) : (
            " configurado en Settings."
          )}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="color"
          aria-label="Color primario del form"
          value={input}
          onChange={handleInputChange}
          className="h-10 w-14 cursor-pointer rounded-md border border-border bg-background p-1"
        />
        <Input
          value={input}
          onChange={handleInputChange}
          placeholder={fallback}
          className="max-w-[160px] font-mono text-xs"
        />
        <Button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="h-8 px-3 text-xs"
        >
          {pending ? "Guardando…" : "Guardar"}
        </Button>
        {overrideActive && (
          <Button
            type="button"
            variant="secondary"
            onClick={handleReset}
            disabled={pending}
            className="h-8 px-3 text-xs"
          >
            Usar color del shop
          </Button>
        )}
        {saved && (
          <span className="text-xs text-muted-foreground">Guardado</span>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {!overrideActive && (
        <p className="text-xs text-muted-foreground">
          Usando el color global del shop.
        </p>
      )}
    </Card>
  )
}
