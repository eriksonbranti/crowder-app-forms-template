import { RiArrowDownLine, RiArrowUpLine } from "@remixicon/react"

import { Card } from "@/components/Card"
import { cx } from "@/lib/utils"
import { formatInt } from "@/lib/formatters"

export type BarTone = "primary" | "success" | "warning" | "neutral"

const BAR_FILL: Record<BarTone, string> = {
  primary: "bg-primary/80",
  success: "bg-emerald-500 dark:bg-emerald-400",
  warning: "bg-amber-500 dark:bg-amber-400",
  neutral: "bg-faint",
}

export function Delta({
  value,
  suffix = "pp",
  invert = false,
}: {
  value: number | null
  suffix?: string
  invert?: boolean
}) {
  if (value == null || value === 0) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  const positive = invert ? value < 0 : value > 0
  const Arrow = value > 0 ? RiArrowUpLine : RiArrowDownLine
  const color = positive
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-destructive"
  return (
    <span
      className={cx(
        "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
        color,
      )}
    >
      <Arrow className="size-3.5" aria-hidden="true" />
      {Math.abs(value).toFixed(1)}
      {suffix}
    </span>
  )
}

export function SectionCard({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title?: string
  subtitle?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={cx("bg-background", className)}>
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && (
              <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            )}
            {subtitle && (
              <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {action}
        </header>
      )}
      {children}
    </Card>
  )
}

export function HBar({
  label,
  labelMono,
  count,
  total,
  pctHint,
  fill = "primary",
}: {
  label: string
  labelMono?: boolean
  count: number
  total: number
  pctHint?: number
  fill?: BarTone
}) {
  const pct = pctHint != null ? pctHint : total > 0 ? (count / total) * 100 : 0
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span
          className={cx(
            "min-w-0 flex-1 truncate",
            labelMono
              ? "font-mono text-xs text-secondary-foreground"
              : "text-foreground",
          )}
        >
          {label}
        </span>
        <span className="shrink-0 tabular-nums text-muted-foreground">
          <span className="font-medium text-foreground">{formatInt(count)}</span>
          <span className="ml-2 text-xs">{pct.toFixed(1)}%</span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-subtle">
        <div
          className={cx("h-full rounded-full transition-all", BAR_FILL[fill])}
          style={{ width: `${Math.max(2, pct)}%` }}
        />
      </div>
    </div>
  )
}

export type FunnelStage = {
  key: string
  label: string
  count: number
  color: BarTone
}

export function FunnelView({ data }: { data: FunnelStage[] }) {
  if (data.length === 0 || data[0].count === 0) {
    return (
      <p className="text-xs text-muted-foreground">Sin transacciones todavía.</p>
    )
  }
  const maxCount = data[0].count
  return (
    <div className="space-y-3">
      {data.map((stage, i) => {
        const widthPct = (stage.count / maxCount) * 100
        const prev = i > 0 ? data[i - 1] : null
        const drop = prev ? prev.count - stage.count : null
        const dropPct =
          prev && prev.count > 0 ? (stage.count / prev.count) * 100 : null
        return (
          <div key={stage.key}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-foreground">{stage.label}</span>
              <span className="font-mono tabular-nums text-foreground">
                {formatInt(stage.count)}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-subtle">
              <div
                className={cx("h-full rounded-full", BAR_FILL[stage.color])}
                style={{ width: `${widthPct}%` }}
              />
            </div>
            {prev && drop != null && dropPct != null && (
              <div className="mt-1 flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
                <span className="tabular-nums">
                  −{formatInt(drop)} ({(100 - dropPct).toFixed(1)}% pérdida)
                </span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
