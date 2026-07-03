import type {
  GroupScope,
  QuestionType,
  TransactionStatus,
} from "@/lib/db/schema"
import { isProductPick } from "@/lib/products/derive"
import { formatProductPicks } from "@/lib/products/format"
import type { WebhookStatus } from "@/modules/webhooks"

export const valueFormatter = (number: number) =>
  `${Intl.NumberFormat("us").format(number).toString()}`

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—"
  return new Date(d).toLocaleString("es-AR")
}

export function formatInt(n: number): string {
  return n.toLocaleString("es-AR")
}

export function formatMoney(
  amount: number | null | undefined,
  currency: string | null | undefined,
): string {
  if (amount == null) return "—"
  const rounded = Math.round(amount)
  return currency ? `${formatInt(rounded)} ${currency}` : formatInt(rounded)
}

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

export function formatRelativeTime(
  d: Date | string | null | undefined,
  now: Date = new Date(),
): string {
  if (!d) return "—"
  const ms = now.getTime() - new Date(d).getTime()
  if (ms < MINUTE_MS) return "ahora"
  if (ms < HOUR_MS) return `hace ${Math.round(ms / MINUTE_MS)} min`
  if (ms < DAY_MS) return `hace ${Math.round(ms / HOUR_MS)} h`
  return `hace ${Math.round(ms / DAY_MS)} d`
}

export function formatPercent(num: number, denom: number): string {
  if (denom === 0) return "—"
  return `${((num / denom) * 100).toFixed(1)}%`
}

export function safePct(num: number, denom: number): number {
  return denom > 0 ? (num / denom) * 100 : 0
}

export function maskKey(k: string): string {
  return `${k.slice(0, 6)}…${k.slice(-4)}`
}

export function truncateId(id: string, n = 16): string {
  return id.length > n ? `${id.slice(0, n)}…` : id
}

export function formatAnswer(value: unknown): string {
  if (value == null) return "—"
  // Respuesta `product`: un pick objeto (max === 1) o array de picks (max > 1).
  // Sin este caso, join/String producirían "[object Object]".
  if (
    isProductPick(value) ||
    (Array.isArray(value) && value.length > 0 && isProductPick(value[0]))
  ) {
    return formatProductPicks(value)
  }
  if (Array.isArray(value)) return value.join(", ")
  if (typeof value === "boolean") return value ? "✓" : "—"
  return String(value)
}

const TRANSACTION_STATUS_LABEL: Record<TransactionStatus, string> = {
  valid: "Pendiente",
  reserved: "Reservada",
  expired: "Expirada",
  confirmed: "Pagada",
  refunded: "Reembolsada",
}

export function formatTransactionStatus(status: TransactionStatus): string {
  return TRANSACTION_STATUS_LABEL[status]
}

const WEBHOOK_EVENT_LABEL: Record<WebhookStatus, string> = {
  purchaseReserved: "Compra reservada",
  purchasePaid: "Compra pagada",
  purchaseExpired: "Reserva expirada",
  purchaseRefunded: "Compra reembolsada",
}

export function formatWebhookEvent(event: WebhookStatus | string): string {
  return WEBHOOK_EVENT_LABEL[event as WebhookStatus] ?? event
}

const GROUP_SCOPE_LABEL: Record<GroupScope, string> = {
  transaction: "Una vez por compra",
  item: "Una por cada entrada",
}

export function formatGroupScope(scope: GroupScope): string {
  return GROUP_SCOPE_LABEL[scope]
}

const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  short_text: "Texto corto",
  long_text: "Texto largo",
  number: "Número",
  email: "Email",
  phone: "Teléfono",
  single_choice: "Opción única",
  multiple_choice: "Múltiple opción",
  dropdown: "Dropdown",
  date: "Fecha",
  datetime: "Fecha y hora",
  time: "Hora",
  country: "País",
  document_id: "Documento",
  scale: "Escala",
  consent: "Consentimiento",
  info: "Info (solo texto)",
  product: "Producto",
}

export function formatQuestionType(type: QuestionType): string {
  return QUESTION_TYPE_LABEL[type]
}

export function httpStatusVariant(
  status: number,
): "success" | "warning" | "error" {
  if (status < 300) return "success"
  if (status < 500) return "warning"
  return "error"
}
