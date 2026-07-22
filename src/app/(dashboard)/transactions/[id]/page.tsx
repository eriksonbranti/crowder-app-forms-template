import type { ReactNode } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"

import { Card } from "@/components/Card"
import { EmptyCard } from "@/components/dashboard/EmptyCard"
import { JsonBlock } from "@/components/dashboard/JsonBlock"
import { StatusBadge } from "@/components/dashboard/StatusBadge"
import { TabNav } from "@/components/dashboard/TabNav"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRoot,
  TableRow,
} from "@/components/Table"
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
            <TableRoot>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Form</TableHeaderCell>
                    <TableHeaderCell>Grupo</TableHeaderCell>
                    <TableHeaderCell>Scope</TableHeaderCell>
                    <TableHeaderCell>Item</TableHeaderCell>
                    <TableHeaderCell>Label</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {subs.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-secondary-foreground">
                        {formTitleById.get(s.formId) ?? s.formId}
                        <p className="font-mono text-xs text-muted-foreground">
                          {s.formId} · v{s.formVersion}
                        </p>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-secondary-foreground">
                        {s.groupId}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatGroupScope(s.scope)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{itemLabel(s)}</TableCell>
                      <TableCell className="text-foreground">{s.computedLabel}</TableCell>
                    </TableRow>
                  ))}
                  {subs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        Sin submissions.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableRoot>
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
            <TableRoot>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>UUID</TableHeaderCell>
                    <TableHeaderCell>Holder</TableHeaderCell>
                    <TableHeaderCell>Sector / rate</TableHeaderCell>
                    <TableHeaderCell>Show</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[...itemsByUuid.values()].map((it) => (
                    <TableRow key={it.uuid}>
                      <TableCell className="font-mono text-xs text-secondary-foreground">
                        {it.uuid}
                      </TableCell>
                      <TableCell className="text-foreground">
                        {it.holder
                          ? `${it.holder.firstName} ${it.holder.lastName}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-secondary-foreground">
                        {it.sectorName} · {it.rateName}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {it.show ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {itemsByUuid.size === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        Sin items.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableRoot>
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
