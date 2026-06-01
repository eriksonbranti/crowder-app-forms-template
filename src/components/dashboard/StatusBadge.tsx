import { Badge } from "@/components/Badge"
import type { TransactionStatus } from "@/lib/db/schema"
import { formatTransactionStatus } from "@/lib/formatters"
import { cx } from "@/lib/utils"

type BadgeVariant = React.ComponentProps<typeof Badge>["variant"]

// dot ≠ variant: "valid" y "expired" comparten `variant: neutral` pero usan
// dots distintos para distinguirlos visualmente en tablas y strip cards.
export const TRANSACTION_STATUS_PRESENTATION: Record<
  TransactionStatus,
  { variant: BadgeVariant; dot: string }
> = {
  valid: { variant: "neutral", dot: "bg-blue-500" },
  reserved: { variant: "warning", dot: "bg-yellow-500" },
  confirmed: { variant: "success", dot: "bg-emerald-500" },
  expired: { variant: "neutral", dot: "bg-gray-400" },
  refunded: { variant: "error", dot: "bg-red-500" },
}

export function StatusBadge({ status }: { status: TransactionStatus }) {
  const { variant, dot } = TRANSACTION_STATUS_PRESENTATION[status]
  return (
    <Badge variant={variant}>
      <span
        className={cx("size-1.5 shrink-0 rounded-full", dot)}
        aria-hidden="true"
      />
      {formatTransactionStatus(status)}
    </Badge>
  )
}
