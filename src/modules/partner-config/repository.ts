import { eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { partnerConfig, type PartnerTheme } from "@/lib/db/schema"

export type { PartnerTheme }

export type PartnerConfig = {
  id: number
  crowderApiKey: string
  crowderApiKeyPrevious: string | null
  supportedCurrencies: string[]
  protocolVersions: string[]
  allowedOrigins: string[]
  theme: PartnerTheme | null
  updatedAt: Date
}

export async function get(): Promise<PartnerConfig | null> {
  const [row] = await db
    .select()
    .from(partnerConfig)
    .where(eq(partnerConfig.id, 1))
    .limit(1)
  return (row as PartnerConfig | undefined) ?? null
}

export async function upsert(input: {
  crowderApiKey: string
  crowderApiKeyPrevious: string | null
  supportedCurrencies: string[]
  protocolVersions: string[]
  allowedOrigins?: string[]
  theme?: PartnerTheme | null
}): Promise<PartnerConfig> {
  const [row] = await db
    .insert(partnerConfig)
    .values({ id: 1, ...input, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: partnerConfig.id,
      set: { ...input, updatedAt: new Date() },
    })
    .returning()
  return row as PartnerConfig
}
