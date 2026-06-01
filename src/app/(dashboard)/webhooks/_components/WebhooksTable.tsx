"use client"

import { RiSendPlaneLine } from "@remixicon/react"
import Link from "next/link"
import { useState } from "react"

import { Badge } from "@/components/Badge"
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/Drawer"
import { JsonBlock } from "@/components/dashboard/JsonBlock"
import {
  formatWebhookEvent,
  httpStatusVariant,
  truncateId,
} from "@/lib/formatters"
import { DateTime } from "@/components/DateTime"
import { listAll } from "@/modules/webhooks"

type WebhookRow = Awaited<ReturnType<typeof listAll>>[number]

export function WebhooksTable({ events }: { events: WebhookRow[] }) {
  const [selected, setSelected] = useState<WebhookRow | null>(null)

  return (
    <>
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Evento</th>
            <th className="px-4 py-3 font-medium">Transacción</th>
            <th className="px-4 py-3 font-medium">Response</th>
            <th className="px-4 py-3 font-medium">Recibido</th>
            <th className="px-4 py-3 font-medium text-right">Detalles</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3 text-foreground">
                <span className="inline-flex items-center gap-2 text-sm font-medium">
                  <RiSendPlaneLine
                    className="size-4 text-faint"
                    aria-hidden="true"
                  />
                  {formatWebhookEvent(e.status)}
                </span>
                <div className="ml-6 font-mono text-xs text-muted-foreground">
                  {e.status}
                </div>
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/transactions/${e.transactionId}?tab=webhooks`}
                  className="font-mono text-xs text-secondary-foreground transition hover:text-primary"
                >
                  {truncateId(e.transactionId, 18)}
                </Link>
              </td>
              <td className="px-4 py-3">
                <Badge variant={httpStatusVariant(e.responseStatus)}>
                  HTTP {e.responseStatus}
                </Badge>
              </td>
              <td className="px-4 py-3 font-mono text-xs tabular-nums text-muted-foreground">
                <DateTime value={e.processedAt} />
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => setSelected(e)}
                  className="text-xs text-muted-foreground transition hover:text-foreground"
                >
                  Ver detalles
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Drawer
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Detalles del webhook</DrawerTitle>
            {selected && (
              <p className="text-xs text-muted-foreground">
                {formatWebhookEvent(selected.status)} ·{" "}
                <span className="font-mono">{selected.status}</span>
              </p>
            )}
          </DrawerHeader>
          {selected && (
            <DrawerBody className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <Meta label="Transacción">
                  <Link
                    href={`/transactions/${selected.transactionId}?tab=webhooks`}
                    className="font-mono text-secondary-foreground transition hover:text-primary"
                  >
                    {selected.transactionId}
                  </Link>
                </Meta>
                <Meta label="Response">
                  <Badge variant={httpStatusVariant(selected.responseStatus)}>
                    HTTP {selected.responseStatus}
                  </Badge>
                </Meta>
                <Meta label="Recibido">
                  <span className="font-mono tabular-nums text-secondary-foreground">
                    <DateTime value={selected.processedAt} />
                  </span>
                </Meta>
              </div>

              <section>
                <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Payload
                </h3>
                <JsonBlock value={selected.payload} />
              </section>

              <section>
                <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Response body
                </h3>
                <JsonBlock value={selected.responseBody} />
              </section>
            </DrawerBody>
          )}
        </DrawerContent>
      </Drawer>
    </>
  )
}

function Meta({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div>{children}</div>
    </div>
  )
}
