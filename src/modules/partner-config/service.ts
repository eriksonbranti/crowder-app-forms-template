import { DomainError } from "@/lib/errors"

import * as repo from "./repository"
import type { PartnerConfig } from "./repository"

export async function getConfig(): Promise<PartnerConfig | null> {
  return repo.get()
}

export async function requireConfig(): Promise<PartnerConfig> {
  const cfg = await repo.get()
  if (!cfg) {
    throw new DomainError(
      "internal_error",
      "partner_config is not initialized — visit /settings to generate an API key",
    )
  }
  return cfg
}

export async function acceptedApiKeys(): Promise<string[]> {
  const cfg = await repo.get()
  if (!cfg) return []
  return [cfg.crowderApiKey, cfg.crowderApiKeyPrevious].filter(
    (k): k is string => !!k,
  )
}

export const updateConfig = repo.upsert
