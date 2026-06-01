import { cx } from "@/lib/utils"
import { formatMoney } from "@/lib/formatters"
import type { ExpiringReservation } from "@/modules/transactions"

export function ExpiringSoonList({
  items,
  now,
}: {
  items: ExpiringReservation[]
  now: Date
}) {
  if (items.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Sin reservas próximas a vencer.
      </p>
    )
  }
  return (
    <div className="divide-y divide-border rounded-md border border-border">
      {items.map((r) => {
        const minutesLeft = Math.max(
          0,
          Math.round((r.expiresAt.getTime() - now.getTime()) / 60_000),
        )
        return (
          <div key={r.id} className="flex items-center gap-3 px-3 py-2">
            <span
              className={cx(
                "inline-flex h-7 w-12 items-center justify-center rounded-md text-xs font-medium tabular-nums",
                minutesLeft < 10
                  ? "bg-destructive/15 text-destructive"
                  : "bg-amber-500/15 text-amber-700 dark:text-amber-400",
              )}
            >
              {minutesLeft}m
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-foreground">
                {r.eventName}
              </div>
              <div className="truncate font-mono text-xs text-muted-foreground">
                {r.id}
              </div>
            </div>
            <div className="shrink-0 font-mono text-sm tabular-nums text-foreground">
              {formatMoney(r.amount, r.currency)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
