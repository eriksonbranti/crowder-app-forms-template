import type { ReactNode } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"

import { Card } from "@/components/Card"
import { EmptyCard } from "@/components/dashboard/EmptyCard"
import { JsonBlock } from "@/components/dashboard/JsonBlock"
import { StatusBadge } from "@/components/dashboard/StatusBadge"
import { TabNav } from "@/components/dashboard/TabNav"
import {
  formatAnswer,
  formatGroupScope,
  formatTransactionStatus,
  formatWebhookEvent,
} from "@/lib/formatters"
import { DateTime } from "@/components/DateTime"
import { findById as findTransaction } from "@/modules/transactions"
import type { Transaction } from "@/modules/transactions"
import { listByTransaction as listSubmissions } from "@/modules/submissions"
import { listByTransaction as listWebhooks } from "@/modules/webhooks"
import { getFormsByIds } from "@/modules/forms"
import type { ItemSnapshot, TransactionStatus } from "@/lib/db/schema"

export const dynamic = "force-dynamic"

type TimelineEntry = { label: TransactionStatus; at: Date; note?: ReactNode }

function itemLabel(s: {
  itemSnapshot: ItemSnapshot | null
  itemUuid: string | null
}): string {
  if (s.itemSnapshot?.holder) {
    return `${s.itemSnapshot.holder.firstName} ${s.itemSnapshot.holder.lastName}`
  }
  if (s.itemUuid) return s.itemUuid.slice(0, 8)
  return "—"
}

function buildTimeline(t: Transaction): TimelineEntry[] {
  const out: TimelineEntry[] = [{ label: "valid", at: t.createdAt }]
  if (t.expiresAt && t.status === "expired") {
    out.push({ label: "expired", at: t.expiresAt })
  }
  if (t.status === "reserved" || t.confirmedAt) {
    out.push({
      label: "reserved",
      at: t.expiresAt ?? t.updatedAt,
      note: t.expiresAt ? (
        <>
          expira: <DateTime value={t.expiresAt} />
        </>
      ) : undefined,
    })
  }
  if (t.confirmedAt) {
    out.push({
      label: "confirmed",
      at: t.confirmedAt,
      note:
        t.purchaseId != null
          ? `purchase #${t.purchaseId} · ${t.purchaseAmount} ${t.currency}`
          : undefined,
    })
  }
  if (t.refundedAt) {
    out.push({
      label: "refunded",
      at: t.refundedAt,
      note:
        t.refundId != null
          ? `${t.refundReason} · ${t.refundId}`
          : t.refundReason ?? undefined,
    })
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime())
}

export default async function TransactionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id } = await params
  const { tab = "submissions" } = await searchParams

  const t = await findTransaction(id)
  if (!t) notFound()

  const [subs, webhooks] = await Promise.all([
    listSubmissions(t.id),
    listWebhooks(t.id),
  ])

  const formIds = [...new Set(subs.map((s) => s.formId))]
  const forms = formIds.length ? await getFormsByIds(formIds) : []
  const formTitleById = new Map(forms.map((f) => [f.id, f.title]))

  const itemsByUuid = new Map<string, ItemSnapshot>()
  for (const s of subs) {
    if (s.itemSnapshot) itemsByUuid.set(s.itemSnapshot.uuid, s.itemSnapshot)
  }

  const timeline = buildTimeline(t)
  const tabHref = (key: string) => `/transactions/${t.id}?tab=${key}`

  return (
    <main>
      <Link
        href="/transactions"
        className="text-xs text-muted-foreground transition hover:text-foreground"
      >
        ← Transacciones
      </Link>
      <div className="mt-1 flex items-center justify-between gap-4">
        <div>
          <h1 className="break-all font-mono text-xl font-semibold tracking-tight text-foreground">
            {t.id}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.eventName} · {t.currency}
          </p>
        </div>
        <StatusBadge status={t.status} />
      </div>

      <Card className="mt-6 bg-background">
        <h2 className="text-sm font-semibold text-foreground">Timeline</h2>
        <ol className="mt-4 space-y-2 text-sm">
          {timeline.map((e, i) => (
            <li key={i} className="flex items-baseline justify-between border-b border-border pb-2 last:border-0">
              <span className="text-foreground">
                {formatTransactionStatus(e.label)}
              </span>
              <span className="text-right text-xs text-muted-foreground">
                <span className="font-mono"><DateTime value={e.at} /></span>
                {e.note && <span className="ml-3 text-muted-foreground">{e.note}</span>}
              </span>
            </li>
          ))}
        </ol>
      </Card>

      <div className="mt-6">
        <TabNav
          active={tab}
          tabs={[
            { key: "submissions", label: "Submissions", href: tabHref("submissions") },
            { key: "respuestas", label: "Respuestas", href: tabHref("respuestas") },
            { key: "items", label: "Items", href: tabHref("items") },
            { key: "webhooks", label: "Webhooks", href: tabHref("webhooks") },
          ]}
        />
      </div>

      <div className="mt-4">
        {tab === "submissions" && (
          <Card className="bg-background p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Form</th>
                  <th className="px-4 py-3 font-medium">Grupo</th>
                  <th className="px-4 py-3 font-medium">Scope</th>
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">Label</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-3 text-secondary-foreground">
                      {formTitleById.get(s.formId) ?? s.formId}
                      <p className="font-mono text-xs text-muted-foreground">
                        {s.formId} · v{s.formVersion}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-secondary-foreground">
                      {s.groupId}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatGroupScope(s.scope)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{itemLabel(s)}</td>
                    <td className="px-4 py-3 text-foreground">{s.computedLabel}</td>
                  </tr>
                ))}
                {subs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Sin submissions.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        )}

        {tab === "respuestas" && (
          <div className="space-y-4">
            {subs.map((s) => (
              <Card key={s.id} className="bg-background">
                <div className="mb-3 flex items-baseline justify-between">
                  <p className="text-sm text-foreground">{s.computedLabel}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {s.formId} · {s.groupId} · v{s.formVersion}
                  </p>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {Object.entries(s.answers).map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="font-mono text-xs text-muted-foreground">{k}</dt>
                      <dd className="text-foreground">{formatAnswer(v)}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            ))}
            {subs.length === 0 && <EmptyCard message="Sin respuestas." />}
          </div>
        )}

        {tab === "items" && (
          <Card className="bg-background p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">UUID</th>
                  <th className="px-4 py-3 font-medium">Holder</th>
                  <th className="px-4 py-3 font-medium">Sector / rate</th>
                  <th className="px-4 py-3 font-medium">Show</th>
                </tr>
              </thead>
              <tbody>
                {[...itemsByUuid.values()].map((it) => (
                  <tr
                    key={it.uuid}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-secondary-foreground">
                      {it.uuid}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {it.holder
                        ? `${it.holder.firstName} ${it.holder.lastName}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-secondary-foreground">
                      {it.sectorName} · {it.rateName}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {it.show}
                    </td>
                  </tr>
                ))}
                {itemsByUuid.size === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Sin items.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        )}

        {tab === "webhooks" && (
          <div className="space-y-3">
            {webhooks.map((w) => (
              <Card key={w.id} className="bg-background">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm text-foreground">
                    {formatWebhookEvent(w.status)}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    <DateTime value={w.processedAt} /> · {w.responseStatus}
                  </p>
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    Payload / response
                  </summary>
                  <JsonBlock
                    value={{ payload: w.payload, response: w.responseBody }}
                  />
                </details>
              </Card>
            ))}
            {webhooks.length === 0 && (
              <EmptyCard message="Sin webhooks recibidos." />
            )}
          </div>
        )}
      </div>
    </main>
  )
}
