import Link from "next/link"
import { RiArrowDownLine, RiArrowUpLine } from "@remixicon/react"

import { Badge } from "@/components/Badge"
import { TRANSACTION_STATUS_PRESENTATION } from "@/components/dashboard/StatusBadge"
import { cx } from "@/lib/utils"
import { formatInt, formatTransactionStatus } from "@/lib/formatters"
import type { TransactionStatus } from "@/lib/db/schema"

import { Sparkline } from "./Sparkline"

const DESIRABLE: Partial<Record<TransactionStatus, boolean>> = {
  confirmed: true,
  valid: true,
}

function deltaTone(delta: number, desirable: boolean): string {
  if (delta === 0) return "text-muted-foreground"
  const positive = delta > 0
  if (desirable) {
    return positive
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-destructive"
  }
  return positive ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
}

export function StatusStripCard({
  status,
  count,
  delta,
  spark,
  active,
  href,
}: {
  status: TransactionStatus
  count: number
  delta: number
  spark: number[]
  active: boolean
  href: string
}) {
  const Arrow = delta > 0 ? RiArrowUpLine : RiArrowDownLine
  const deltaColor = deltaTone(delta, DESIRABLE[status] ?? false)
  return (
    <Link
      href={href}
      className={cx(
        "block rounded-lg border bg-card p-4 text-left shadow-sm transition",
        active
          ? "border-primary ring-1 ring-primary/30"
          : "border-border hover:border-faint",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {formatTransactionStatus(status)}
        </span>
        <Badge
          variant={TRANSACTION_STATUS_PRESENTATION[status].variant}
          className="px-1.5 py-0.5 text-[10px]"
        >
          {status}
        </Badge>
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <span className="text-2xl font-bold tracking-tight tabular-nums text-foreground">
          {formatInt(count)}
        </span>
        <Sparkline data={spark} status={status} />
      </div>
      <div
        className={cx(
          "mt-1 inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
          deltaColor,
        )}
      >
        {delta !== 0 && <Arrow className="size-3.5" aria-hidden="true" />}
        {delta > 0 ? "+" : ""}
        {delta} esta semana
      </div>
    </Link>
  )
}
