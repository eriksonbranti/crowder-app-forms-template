import { unstable_cache } from "next/cache"
import { RiDownloadLine } from "@remixicon/react"

import { Badge } from "@/components/Badge"
import { Button } from "@/components/Button"
import { KpiTile } from "@/components/dashboard/KpiTile"
import { formatInt, formatMoney, formatPercent, safePct } from "@/lib/formatters"
import {
  countActiveReservations,
  dailyCountsByStatus,
  listExpiringSoon,
  listRecentLifecycleEvents,
  overview as transactionsOverview,
} from "@/modules/transactions"
import { countConfirmed, topFormsConfirmed } from "@/modules/submissions"
import { time, timer } from "@/lib/timing"

import {
  ChartLegend,
  StackedAreaChart,
  type StackedAreaDatum,
} from "./_components/overview/StackedAreaChart"
import {
  Delta,
  FunnelView,
  HBar,
  SectionCard,
  type FunnelStage,
} from "./_components/overview/parts"
import { ActivityFeed } from "./_components/overview/ActivityFeed"
import { ExpiringSoonList } from "./_components/overview/ExpiringSoon"
import { RangeSelector, type RangeKey } from "./_components/overview/RangeSelector"

export const revalidate = 30

const DAY_MS = 86_400_000
const EXPIRING_WINDOW_MS = 30 * 60_000

const RANGE_DAYS: Record<RangeKey, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  all: 365,
}

const RANGE_LABEL: Record<RangeKey, string> = {
  "7d": "últimos 7 días",
  "30d": "últimos 30 días",
  "90d": "últimos 90 días",
  all: "últimos 12 meses",
}

const RANGE_SHORT: Record<RangeKey, string> = {
  "7d": "7 días",
  "30d": "30 días",
  "90d": "90 días",
  all: "12 meses",
}

function parseRange(value: string | string[] | undefined): RangeKey {
  const v = Array.isArray(value) ? value[0] : value
  if (v === "7d" || v === "30d" || v === "90d" || v === "all") return v
  return "30d"
}

const getOverview = unstable_cache(
  async (rangeDays: number) => {
    const now = new Date()
    const since = new Date(now.getTime() - rangeDays * DAY_MS)
    const prevSince = new Date(since.getTime() - rangeDays * DAY_MS)

    const [
      { counts, current: currentStats, previous: previousStats },
      activeReservations,
      confirmedSubs,
      topForms,
      daily,
      recent,
      expiring,
    ] = await Promise.all([
      time("overview", () => transactionsOverview(prevSince, since, now)),
      time("countActiveReservations", () => countActiveReservations(now)),
      time("countConfirmed", () => countConfirmed()),
      time("topFormsConfirmed", () => topFormsConfirmed(5)),
      time("dailyCountsByStatus", () => dailyCountsByStatus(since, now)),
      time("listRecentLifecycleEvents", () => listRecentLifecycleEvents(8)),
      time("listExpiringSoon", () =>
        listExpiringSoon(now, EXPIRING_WINDOW_MS, 6),
      ),
    ])

    return {
      now: now.toISOString(),
      counts,
      activeReservations,
      confirmedSubs,
      topForms,
      daily,
      recent,
      expiring,
      currentStats,
      previousStats,
    }
  },
  ["overview-metrics-v2"],
  { revalidate: 30, tags: ["overview"] },
)

function topFormFill(pct: number): "success" | "primary" | "warning" {
  if (pct >= 65) return "success"
  if (pct >= 50) return "primary"
  return "warning"
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string | string[] }>
}) {
  const params = await searchParams
  const range = parseRange(params.range)
  const days = RANGE_DAYS[range]

  const total = timer("page Overview total")
  const data = await getOverview(days)
  total()

  const {
    counts,
    activeReservations,
    confirmedSubs,
    topForms,
    daily,
    currentStats,
    previousStats,
  } = data
  const now = new Date(data.now)
  // unstable_cache flattens Date → string; rehydrate before passing to consumers.
  const recent = data.recent.map((e) => ({ ...e, at: new Date(e.at) }))
  const expiring = data.expiring.map((r) => ({
    ...r,
    expiresAt: new Date(r.expiresAt),
  }))

  const submittedTotal =
    counts.valid +
    counts.reserved +
    counts.expired +
    counts.confirmed +
    counts.refunded

  const conversionDeltaPp =
    safePct(currentStats.confirmed, currentStats.total) -
    safePct(previousStats.confirmed, previousStats.total)
  const expirationDeltaPp =
    safePct(currentStats.expired, currentStats.reserved) -
    safePct(previousStats.expired, previousStats.reserved)

  const expiringSoonCount = expiring.length

  const funnel: FunnelStage[] = [
    {
      key: "started",
      label: "Iniciadas",
      count: submittedTotal,
      color: "primary",
    },
    {
      key: "reserved",
      label: "Reservadas",
      count:
        counts.reserved +
        counts.expired +
        counts.confirmed +
        counts.refunded,
      color: "warning",
    },
    {
      key: "confirmed",
      label: "Confirmadas",
      count: counts.confirmed + counts.refunded,
      color: "success",
    },
    {
      key: "retained",
      label: "Retenidas",
      count: counts.confirmed,
      color: "success",
    },
  ]

  const timeSeries: StackedAreaDatum[] = daily.map((d) => ({
    date: d.date,
    confirmed: d.confirmed,
    reserved: d.reserved,
    expired: d.expired,
  }))

  const topMax = Math.max(1, ...topForms.map((f) => f.total))

  return (
    <main className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Overview
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Métricas del partner · {RANGE_LABEL[range]}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RangeSelector value={range} />
          <Button
            variant="secondary"
            disabled
            title="Próximamente"
            className="gap-1.5"
          >
            <RiDownloadLine className="size-4" aria-hidden="true" />
            Exportar
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="Conversión"
          value={formatPercent(counts.confirmed, submittedTotal)}
          delta={<Delta value={Number(conversionDeltaPp.toFixed(2))} />}
          hint="Confirmadas / total"
        />
        <KpiTile
          label="Submissions confirmadas"
          value={formatInt(confirmedSubs)}
          delta={
            <span className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              +{formatInt(currentStats.confirmed)} en 30d
            </span>
          }
          hint={`${formatMoney(currentStats.amountConfirmed, null)} en compras (30d)`}
        />
        <KpiTile
          label="Reservas activas"
          value={formatInt(activeReservations)}
          delta={
            expiringSoonCount > 0 ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                {expiringSoonCount} vencen &lt; 30 min
              </span>
            ) : undefined
          }
          hint="A la espera de pago"
        />
        <KpiTile
          label="Tasa de expiración"
          value={formatPercent(counts.expired, counts.reserved + counts.expired)}
          delta={<Delta value={Number(expirationDeltaPp.toFixed(2))} invert />}
          hint="Reservas vencidas sin pago"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard
          title={`Transacciones · ${RANGE_SHORT[range]}`}
          subtitle="Volumen diario por estado final"
          className="lg:col-span-2"
        >
          <div className="-mt-1">
            <StackedAreaChart data={timeSeries} />
          </div>
          <div className="mt-3">
            <ChartLegend />
          </div>
        </SectionCard>

        <SectionCard
          title="Embudo de conversión"
          subtitle="Pérdida en cada paso del ciclo de vida"
        >
          <FunnelView data={funnel} />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard
          title="Top forms por confirmadas"
          subtitle="Conversión = confirmadas / total recibido"
        >
          {topForms.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              Sin datos todavía.
            </p>
          ) : (
            <ul className="space-y-3">
              {topForms.map((f) => {
                const conv = safePct(f.confirmed, f.total)
                return (
                  <li key={f.formId}>
                    <HBar
                      label={f.title}
                      count={f.confirmed}
                      total={topMax}
                      pctHint={conv}
                      fill={topFormFill(conv)}
                    />
                    <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                      {f.formId}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Actividad reciente"
          subtitle="Últimos eventos lifecycle"
        >
          <ActivityFeed items={recent} />
        </SectionCard>
      </div>

      <SectionCard
        title="Reservas a punto de vencer"
        subtitle="Si el comprador no paga antes del expiresAt, el cron las marca como expired."
        action={
          expiring.length > 0 ? (
            <Badge variant="warning">{expiring.length} en &lt; 30 min</Badge>
          ) : undefined
        }
      >
        <ExpiringSoonList items={expiring} now={now} />
      </SectionCard>
    </main>
  )
}
