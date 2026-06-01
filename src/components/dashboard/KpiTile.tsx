import { Card } from "@/components/Card"
import { cx } from "@/lib/utils"

const TONE_CLASSES = {
  default: "text-foreground",
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  error: "text-destructive",
} as const

export type KpiTone = keyof typeof TONE_CLASSES

export function KpiTile({
  label,
  value,
  hint,
  delta,
  tone = "default",
}: {
  label: string
  value: string
  hint?: React.ReactNode
  delta?: React.ReactNode
  tone?: KpiTone
}) {
  return (
    <Card className="bg-background">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 flex items-baseline gap-2">
        <p
          className={cx(
            "text-2xl font-bold tracking-tight tabular-nums",
            TONE_CLASSES[tone],
          )}
        >
          {value}
        </p>
        {delta}
      </div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  )
}
