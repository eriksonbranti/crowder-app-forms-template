"use client"

import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/Button"
import { cx } from "@/lib/utils"

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={handleCopy}
      className="h-7 px-2 text-xs"
    >
      {copied ? "Copiado" : "Copiar"}
    </Button>
  )
}

// `disabled` renders the field as a dimmed, non-copyable reference: used for
// endpoints we document but don't expect the partner to call directly.
export function Field({
  label,
  value,
  disabled = false,
}: {
  label: string
  value: string
  disabled?: boolean
}) {
  return (
    <div className={cx("space-y-2", disabled && "opacity-60")}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-secondary-foreground">
          {label}
        </span>
        {disabled ? (
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Referencia
          </span>
        ) : (
          <CopyButton text={value} />
        )}
      </div>
      <div className="overflow-x-auto rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs text-secondary-foreground">
        {value}
      </div>
    </div>
  )
}
