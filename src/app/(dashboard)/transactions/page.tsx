import Link from "next/link"
import { RiCloseLine, RiFilterLine } from "@remixicon/react"

import { Button } from "@/components/Button"
import { Card } from "@/components/Card"
import { Input } from "@/components/Input"
import { EmptyCard } from "@/components/dashboard/EmptyCard"
import { StatusBadge } from "@/components/dashboard/StatusBadge"
import {
  formatMoney,
  formatTransactionStatus,
  truncateId,
} from "@/lib/formatters"
import { DateTime } from "@/components/DateTime"
import {
  countList as countTransactions,
  countsByStatus,
  dailyCountsByStatus,
  list as listTransactions,
} from "@/modules/transactions"
import type { TransactionStatus } from "@/lib/db/schema"
import {
  buildListQuery,
  parsePageParam,
  parseStatusParam,
} from "@/lib/list-query"
import { time, timer } from "@/lib/timing"

import { Pagination } from "@/components/dashboard/Pagination"
import { StatusStripCard } from "./_components/StatusStripCard"

export const dynamic = "force-dynamic"

const DAY_MS = 86_400_000
const WINDOW_DAYS = 14

const STRIP_STATUSES: TransactionStatus[] = [
  "valid",
  "reserved",
  "confirmed",
  "expired",
  "refunded",
]

const ALL_STATUSES: TransactionStatus[] = [
  "valid",
  "reserved",
  "expired",
  "confirmed",
  "refunded",
]

const PAGE_SIZE = 100

function diffStatusSeries(
  daily: Awaited<ReturnType<typeof dailyCountsByStatus>>,
  status: TransactionStatus,
): { spark: number[]; delta: number } {
  const last7 = daily.slice(-7).map((d) => d[status])
  const prev7 = daily.slice(0, 7).map((d) => d[status])
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
  return { spark: last7, delta: sum(last7) - sum(prev7) }
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>
}) {
  const sp = await searchParams
  const status = parseStatusParam(sp.status, ALL_STATUSES)
  const q = sp.q?.trim() || undefined
  const pageNum = parsePageParam(sp.page)
  const offset = (pageNum - 1) * PAGE_SIZE

  const total = timer("page Transactions total")

  const now = new Date()
  const since14d = new Date(now.getTime() - WINDOW_DAYS * DAY_MS)

  const listArgs = {
    status: status ? [status] : undefined,
    search: q,
  }
  const [rows, filteredTotal, countsTotal, daily14d] = await Promise.all([
    time("listTransactions", () =>
      listTransactions({ ...listArgs, limit: PAGE_SIZE, offset }),
    ),
    time("countTransactions", () => countTransactions(listArgs)),
    time("countsByStatus", () => countsByStatus()),
    time("dailyCountsByStatus 14d", () => dailyCountsByStatus(since14d, now)),
  ])

  total()

  const linkState = { q, status, page: pageNum }

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Transacciones
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada transacción mapea a un{" "}
          <code className="rounded-sm bg-subtle px-1 py-0.5 font-mono text-xs text-subtle-foreground">
            interaction
          </code>{" "}
          del protocolo Crowder · ventana de 14 días
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {STRIP_STATUSES.map((s) => {
          const series = diffStatusSeries(daily14d, s)
          return (
            <StatusStripCard
              key={s}
              status={s}
              count={countsTotal[s]}
              delta={series.delta}
              spark={series.spark}
              active={status === s}
              href={`/transactions${buildListQuery(linkState, { status: status === s ? null : s, page: null })}`}
            />
          )
        })}
      </div>

      <Card className="bg-background">
        <form className="flex flex-wrap items-center gap-2" method="get">
          <Input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar por ID o nombre de evento…"
            className="w-72"
          />
          <select
            name="status"
            defaultValue={status ?? ""}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Todos los estados</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {formatTransactionStatus(s)}
              </option>
            ))}
          </select>
          <Button type="submit" variant="secondary">
            <RiFilterLine className="size-4" aria-hidden="true" /> Filtrar
          </Button>
          {(q || status) && (
            <Button asChild variant="ghost">
              <Link href="/transactions">
                <RiCloseLine className="size-4" aria-hidden="true" /> Limpiar
              </Link>
            </Button>
          )}
        </form>
      </Card>

      {rows.length === 0 ? (
        <EmptyCard
          message={
            q || status
              ? "Sin transacciones que coincidan con los filtros."
              : "Sin transacciones."
          }
        />
      ) : (
        <>
          <Card className="overflow-hidden bg-background p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">Evento</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 text-right font-medium">Compra</th>
                  <th className="px-4 py-3 font-medium">Creada</th>
                  <th className="px-4 py-3 font-medium">Actualizada</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-border transition last:border-0 hover:bg-muted/40"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/transactions/${t.id}`}
                        prefetch={false}
                        className="font-mono text-xs text-foreground transition hover:text-primary"
                      >
                        {truncateId(t.id, 24)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-secondary-foreground">
                      <Link
                        href={`/transactions/${t.id}`}
                        prefetch={false}
                        className="block hover:text-primary"
                      >
                        {t.eventName}
                        <p className="text-xs text-muted-foreground">
                          ID del evento:{" "}
                          <span className="font-mono">{t.eventId}</span>
                        </p>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-secondary-foreground">
                      {formatMoney(t.purchaseAmount, t.currency)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      <DateTime value={t.createdAt} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      <DateTime value={t.updatedAt} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Pagination
            page={pageNum}
            pageSize={PAGE_SIZE}
            total={filteredTotal}
            buildHref={(p) =>
              `/transactions${buildListQuery(linkState, { page: p })}`
            }
          />
        </>
      )}
    </main>
  )
}
