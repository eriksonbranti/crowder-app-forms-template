import { notFound } from "next/navigation"

import { findPublished } from "@/modules/forms"
import { getConfig } from "@/modules/partner-config"
import { EmbedWizard } from "@/components/embed/EmbedWizard"
import { resolveAllowedOrigins } from "@/lib/origins"
import { embedThemeStyle } from "@/lib/theme"

export const dynamic = "force-dynamic"

export default async function EmbedFormPage({
  params,
}: {
  params: Promise<{ formId: string }>
}) {
  const { formId } = await params
  const [published, cfg] = await Promise.all([findPublished(formId), getConfig()])

  if (!published) notFound()

  const themeCss = embedThemeStyle(
    published.form.theme ?? cfg?.theme ?? null,
  )

  return (
    <main
      data-embed-page
      className="min-h-screen bg-background text-foreground antialiased"
    >
      {themeCss && <style dangerouslySetInnerHTML={{ __html: themeCss }} />}
      <EmbedWizard
        forms={[
          {
            id: published.form.id,
            title: published.form.title,
            version: published.version.version,
            definition: published.version.definition,
          },
        ]}
        supportedCurrencies={cfg?.supportedCurrencies ?? []}
        parentOrigins={resolveAllowedOrigins(
          published.form.allowedOrigins,
          cfg?.allowedOrigins ?? [],
        )}
        formIdForDiagnostics={published.form.id}
      />
    </main>
  )
}
