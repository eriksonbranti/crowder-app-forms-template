"use client"

import { RiArrowRightSLine, RiHistoryLine } from "@remixicon/react"
import { useState } from "react"

import { cx } from "@/lib/utils"
import { DateTime } from "@/components/DateTime"
import type { FormVersion } from "@/modules/forms"

export function HistoryPanel({ versions }: { versions: FormVersion[] }) {
  const [open, setOpen] = useState(true)

  return (
    <div className="border-t border-border bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground transition hover:text-foreground"
        aria-expanded={open}
      >
        <RiArrowRightSLine
          className={cx("size-3.5 transition-transform", open && "rotate-90")}
          aria-hidden="true"
        />
        <RiHistoryLine className="size-3.5" aria-hidden="true" />
        <span>Historial</span>
        <span className="ml-auto font-mono normal-case tracking-normal text-faint">
          {versions.length}
        </span>
      </button>

      {open && (
        <div className="max-h-48 overflow-y-auto px-3 pb-3">
          {versions.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Aún no publicaste este form.
            </p>
          ) : (
            <ul className="space-y-1 text-xs">
              {versions.map((v) => (
                <li
                  key={v.version}
                  className="flex items-center justify-between text-secondary-foreground"
                >
                  <span className="font-mono">v{v.version}</span>
                  <span className="text-muted-foreground">
                    <DateTime value={v.publishedAt} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
