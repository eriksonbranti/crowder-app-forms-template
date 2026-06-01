"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTransition } from "react"

import { cx } from "@/lib/utils"

export type RangeKey = "7d" | "30d" | "90d" | "all"

const OPTIONS: { k: RangeKey; label: string }[] = [
  { k: "7d", label: "7d" },
  { k: "30d", label: "30d" },
  { k: "90d", label: "90d" },
  { k: "all", label: "Todo" },
]

export function RangeSelector({ value }: { value: RangeKey }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()

  function select(k: RangeKey) {
    if (k === value) return
    const next = new URLSearchParams(params)
    if (k === "30d") next.delete("range")
    else next.set("range", k)
    const qs = next.toString()
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    })
  }

  return (
    <div
      className={cx(
        "inline-flex overflow-hidden rounded-md border border-border bg-background text-xs",
        pending && "opacity-70",
      )}
      role="tablist"
      aria-label="Rango temporal"
    >
      {OPTIONS.map((opt) => {
        const active = value === opt.k
        return (
          <button
            key={opt.k}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => select(opt.k)}
            className={cx(
              "px-3 py-1.5 transition-colors",
              active
                ? "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-subtle",
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
