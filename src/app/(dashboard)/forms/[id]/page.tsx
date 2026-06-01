import { RiArrowLeftLine } from "@remixicon/react"
import { headers } from "next/headers"
import Link from "next/link"
import { notFound } from "next/navigation"

import { TabNav } from "@/components/dashboard/TabNav"
import { getForm, listVersions } from "@/modules/forms"
import type { FormVersion } from "@/modules/forms"
import { getConfig } from "@/modules/partner-config"
import { DomainError } from "@/lib/errors"
import { DEFAULT_BRAND_HEX } from "@/lib/theme"

import { BrandCard } from "./_components/BrandCard"
import { EmbedCard } from "./_components/EmbedCard"
import { FormEditor } from "./_components/FormEditor"

export const dynamic = "force-dynamic"

export default async function FormDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const [{ id }, { tab: tabParam }] = await Promise.all([params, searchParams])
  const tab: "editor" | "integration" | "appearance" =
    tabParam === "integration" || tabParam === "appearance"
      ? tabParam
      : "editor"

  let form, versions, cfg
  try {
    ;[form, versions, cfg] = await Promise.all([
      getForm(id),
      tab === "editor" ? listVersions(id) : Promise.resolve<FormVersion[]>([]),
      tab === "appearance" || tab === "integration"
        ? getConfig()
        : Promise.resolve(null),
    ])
  } catch (err) {
    if (err instanceof DomainError && err.code === "not_found") notFound()
    throw err
  }

  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https")
  const baseUrl = `${proto}://${host}`
  const embedUrl = `${baseUrl}/embed/${form.id}`

  const tabs = [
    { key: "editor", label: "Editor", href: `/forms/${form.id}` },
    {
      key: "integration",
      label: "Integración",
      href: `/forms/${form.id}?tab=integration`,
    },
    {
      key: "appearance",
      label: "Apariencia",
      href: `/forms/${form.id}?tab=appearance`,
    },
  ]

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/forms"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
        >
          <RiArrowLeftLine className="size-3.5" aria-hidden="true" />
          Formularios
        </Link>
        <span className="font-mono text-xs text-muted-foreground">
          {form.id}
        </span>
      </div>

      <TabNav tabs={tabs} active={tab} />

      {tab === "editor" && <FormEditor form={form} versions={versions} />}

      {tab === "integration" && (
        <EmbedCard
          formId={form.id}
          embedUrl={embedUrl}
          baseUrl={baseUrl}
          allowedOrigins={form.allowedOrigins}
          globalOrigins={cfg?.allowedOrigins ?? []}
          published={Boolean(form.publishedAt)}
          enabled={form.enabled}
        />
      )}

      {tab === "appearance" && (
        <BrandCard
          formId={form.id}
          formPrimary={form.theme?.primary ?? null}
          shopPrimary={cfg?.theme?.primary ?? null}
          defaultPrimary={DEFAULT_BRAND_HEX}
        />
      )}
    </main>
  )
}
