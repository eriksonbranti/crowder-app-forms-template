import {
  RiArrowRightUpLine,
  RiCheckLine,
  RiErrorWarningLine,
  RiRefund2Line,
  RiTimeLine,
} from "@remixicon/react"

import { cx } from "@/lib/utils"
import { formatMoney } from "@/lib/formatters"
import { RelativeTime } from "@/components/DateTime"
import type { LifecycleEvent } from "@/modules/transactions"

const META: Record<
  LifecycleEvent["type"],
  {
    Icon: typeof RiCheckLine
    color: string
    bg: string
    label: string
  }
> = {
  confirmed: {
    Icon: RiCheckLine,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/15",
    label: "Pagada",
  },
  reserved: {
    Icon: RiTimeLine,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/15",
    label: "Reservada",
  },
  refunded: {
    Icon: RiRefund2Line,
    color: "text-muted-foreground",
    bg: "bg-subtle",
    label: "Reembolsada",
  },
  valid: {
    Icon: RiArrowRightUpLine,
    color: "text-primary",
    bg: "bg-primary/15",
    label: "Iniciada",
  },
  expired: {
    Icon: RiErrorWarningLine,
    color: "text-muted-foreground",
    bg: "bg-subtle",
    label: "Expirada",
  },
}

export function ActivityFeed({ items }: { items: LifecycleEvent[] }) {
  if (items.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">Sin actividad reciente.</p>
    )
  }
  return (
    <ul className="divide-y divide-border">
      {items.map((e, i) => {
        const meta = META[e.type] ?? META.valid
        const money = e.amount != null ? formatMoney(e.amount, e.currency) : null
        return (
          <li
            key={i}
            className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
          >
            <span
              className={cx(
                "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                meta.bg,
                meta.color,
              )}
            >
              <meta.Icon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-foreground">
                  <span className="font-medium">{meta.label}</span>
                  {money && (
                    <span className="ml-2 font-mono text-xs tabular-nums text-muted-foreground">
                      {money}
                    </span>
                  )}
                </span>
                <span className="shrink-0 whitespace-nowrap tabular-nums text-xs text-muted-foreground">
                  <RelativeTime value={e.at} />
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="truncate font-mono">{e.transactionId}</span>
                <span className="text-faint">·</span>
                <span className="truncate">{e.eventName}</span>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
