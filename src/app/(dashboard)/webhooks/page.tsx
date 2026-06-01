import { RiCloseLine, RiFilterLine } from "@remixicon/react"
import Link from "next/link"

import { Button } from "@/components/Button"
import { Card } from "@/components/Card"
import { Input } from "@/components/Input"
import { EmptyCard } from "@/components/dashboard/EmptyCard"
import { KpiTile } from "@/components/dashboard/KpiTile"
import { formatInt, formatWebhookEvent } from "@/lib/formatters"
import { listAll } from "@/modules/webhooks"
import type { WebhookStatus } from "@/modules/webhooks"

import { WebhooksTable } from "./_components/WebhooksTable"

export const dynamic = "force-dynamic"

const WEBHOOK_STATUSES: WebhookStatus[] = [
  "purchaseReserved",
  "purchasePaid",
  "purchaseRefunded",
]

export default async function WebhooksPage({
  searchParams,
}: {
  searchParams: Promise<{ transaction?: string; status?: string }>
}) {
  const sp = await searchParams
  const transaction = sp.transaction?.trim() || undefined
  const status = WEBHOOK_STATUSES.includes(sp.status as WebhookStatus)
    ? (sp.status as WebhookStatus)
    : undefined

  const events = await listAll({ transactionId: transaction, status, limit: 200 })

  const counts = events.reduce(
    (acc, e) => {
      if (e.responseStatus >= 500) acc.err++
      else if (e.responseStatus >= 400) acc.warn++
      else acc.ok++
      return acc
    },
    { ok: 0, warn: 0, err: 0 },
  )
  const total = events.length

  const filtersActive = !!(transaction || status)

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Webhooks
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Eventos lifecycle recibidos desde Crowder. La idempotencia se
          garantiza por{" "}
          <code className="rounded-sm bg-subtle px-1.5 py-0.5 font-mono text-xs text-subtle-foreground">
            transaction + status
          </code>
          .
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile label="Total" value={formatInt(total)} />
        <KpiTile label="OK · 2xx" value={formatInt(counts.ok)} tone="success" />
        <KpiTile label="4xx" value={formatInt(counts.warn)} tone="warning" />
        <KpiTile label="5xx" value={formatInt(counts.err)} tone="error" />
      </div>

      <Card className="bg-background">
        <form className="flex flex-wrap items-center gap-2" method="get">
          <Input
            type="search"
            name="transaction"
            defaultValue={transaction ?? ""}
            placeholder="Buscar por transaction ID…"
            className="w-72"
          />
          <select
            name="status"
            defaultValue={status ?? ""}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Todos los eventos</option>
            {WEBHOOK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {formatWebhookEvent(s)}
              </option>
            ))}
          </select>
          <Button type="submit" variant="secondary">
            <RiFilterLine className="size-4" aria-hidden="true" /> Filtrar
          </Button>
          {filtersActive && (
            <Button asChild variant="ghost">
              <Link href="/webhooks">
                <RiCloseLine className="size-4" aria-hidden="true" /> Limpiar
              </Link>
            </Button>
          )}
          <span className="ml-auto text-xs tabular-nums text-muted-foreground">
            Mostrando{" "}
            <span className="font-medium text-foreground">
              {formatInt(total)}
            </span>
          </span>
        </form>
      </Card>

      {events.length === 0 ? (
        <EmptyCard
          message={
            filtersActive
              ? "Sin webhooks que coincidan con los filtros."
              : "Sin webhooks aún."
          }
        />
      ) : (
        <Card className="overflow-hidden bg-background p-0">
          <WebhooksTable events={events} />
        </Card>
      )}
    </main>
  )
}
