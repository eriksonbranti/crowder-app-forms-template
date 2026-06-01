import { getConfig } from "@/modules/partner-config"

import { SettingsForm } from "./_components/SettingsForm"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const cfg = await getConfig()

  return (
    <main>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          API key de Crowder y monedas soportadas.
        </p>
      </div>

      <SettingsForm
        apiKey={cfg?.crowderApiKey ?? null}
        previousKey={cfg?.crowderApiKeyPrevious ?? null}
        currencies={cfg?.supportedCurrencies ?? []}
        allowedOrigins={cfg?.allowedOrigins ?? []}
        brandPrimary={cfg?.theme?.primary ?? null}
      />
    </main>
  )
}
