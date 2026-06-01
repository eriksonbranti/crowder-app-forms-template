"use client"

import { Card } from "@/components/Card"
import { OriginsListEditor } from "@/components/OriginsListEditor"
import { updateAllowedOriginsAction } from "@/app/(dashboard)/forms/actions"

import { Field } from "./integration-shared"

export function EmbedCard({
  formId,
  embedUrl,
  baseUrl,
  allowedOrigins,
  globalOrigins,
  published,
  enabled,
}: {
  formId: string
  embedUrl: string
  baseUrl: string
  allowedOrigins: string[]
  globalOrigins: string[]
  published: boolean
  enabled: boolean
}) {
  const transactionsUrl = `${baseUrl}/api/transactions`
  const stateUrl = `${transactionsUrl}/{transaction_id}`
  const eventsUrl = `${transactionsUrl}/{transaction_id}/events`

  return (
    <Card className="space-y-6 bg-background">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Embed</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          URL del iframe y orígenes autorizados para embeberlo en tu checkout.
        </p>
      </div>

      {(!published || !enabled) && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          {!enabled
            ? "Este form está archivado — no aparecerá en el embed."
            : "Este form aún no está publicado — no aparecerá en el embed hasta que publiques."}
        </p>
      )}

      <Field label="URL del embed" value={embedUrl} />

      <div className="border-t border-border pt-4">
        <OriginsListEditor
          title="Origins parent permitidos"
          description="URLs (esquema + host) de los checkout que pueden embeber este form. Si lo dejás vacío, hereda los orígenes globales configurados en Settings."
          initial={allowedOrigins}
          inherited={globalOrigins}
          onSave={(origins) => updateAllowedOriginsAction(formId, origins)}
        />
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <div>
          <h3 className="text-xs font-semibold text-foreground">
            API del partner (Crowder → partner)
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Base de los endpoints que exponés para que Crowder reconcilie estado
            y notifique eventos del checkout.
            Auth: <code className="font-mono">Authorization: Bearer &lt;crowder_api_key&gt;</code>.
            Reemplazá <code className="font-mono">{"{transaction_id}"}</code> por
            el <code className="font-mono">interaction</code> de cada transaction.
          </p>
        </div>

        <Field label="Base · /api/transactions" value={transactionsUrl} />
        <Field
          label="GET · status de la transaction"
          value={stateUrl}
          disabled
        />
        <Field label="POST · webhook lifecycle" value={eventsUrl} disabled />
      </div>
    </Card>
  )
}
