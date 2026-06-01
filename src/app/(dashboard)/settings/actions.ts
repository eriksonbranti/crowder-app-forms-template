"use server"

import { randomBytes } from "crypto"
import { revalidatePath } from "next/cache"

import { getCurrentUser } from "@/adapters/supabase/server"
import { parseOriginsList } from "@/lib/origins"
import { isValidHex } from "@/lib/theme"
import { getConfig, updateConfig } from "@/modules/partner-config"
import { expireStale } from "@/modules/transactions"

function generateApiKey(): string {
  return randomBytes(32).toString("base64url")
}

async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) throw new Error("unauthorized")
}

export async function generateOrRotateKey(): Promise<{
  apiKey: string
  hasPrevious: boolean
}> {
  await requireAuth()
  const current = await getConfig()
  const newKey = generateApiKey()

  const next = await updateConfig({
    crowderApiKey: newKey,
    crowderApiKeyPrevious: current?.crowderApiKey ?? null,
    supportedCurrencies: current?.supportedCurrencies ?? [],
    protocolVersions: current?.protocolVersions ?? ["1.2"],
    allowedOrigins: current?.allowedOrigins ?? [],
    theme: current?.theme ?? null,
  })
  revalidatePath("/settings")
  return {
    apiKey: next.crowderApiKey,
    hasPrevious: !!next.crowderApiKeyPrevious,
  }
}

export async function clearPreviousKey(): Promise<void> {
  await requireAuth()
  const current = await getConfig()
  if (!current) return
  await updateConfig({ ...current, crowderApiKeyPrevious: null })
  revalidatePath("/settings")
}

export async function updateCurrencies(currencies: string[]): Promise<void> {
  await requireAuth()
  const current = await getConfig()
  if (!current) throw new Error("partner_config not initialized — generate an API key first")
  await updateConfig({
    ...current,
    supportedCurrencies: currencies
      .map((c) => c.trim().toUpperCase())
      .filter((c) => /^[A-Z]{3}$/.test(c)),
  })
  revalidatePath("/settings")
}

export async function updateBrandPrimary(hex: string | null): Promise<void> {
  await requireAuth()
  const current = await getConfig()
  if (!current) throw new Error("partner_config not initialized — generate an API key first")
  const next = hex?.trim() || null
  if (next && !isValidHex(next)) throw new Error("invalid hex color")
  await updateConfig({
    ...current,
    theme: next ? { primary: next } : null,
  })
  revalidatePath("/settings")
}

export async function updateAllowedOrigins(
  origins: string[],
): Promise<{ ok: boolean; error?: string }> {
  await requireAuth()
  const current = await getConfig()
  if (!current) {
    return {
      ok: false,
      error: "Generá una API key primero para inicializar la config.",
    }
  }
  const parsed = parseOriginsList(origins)
  if (!parsed.ok) return { ok: false, error: parsed.error }
  await updateConfig({ ...current, allowedOrigins: parsed.value })
  revalidatePath("/settings")
  return { ok: true }
}

export async function runExpireStale(): Promise<{ expired: number }> {
  await requireAuth()
  const expired = await expireStale()
  revalidatePath("/transactions")
  return { expired }
}
