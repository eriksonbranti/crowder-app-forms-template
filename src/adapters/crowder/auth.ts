// Crowder Embedded App protocol — Bearer auth para webhooks server-to-server.
// Spec: https://crowder-docs.vercel.app/embedded-app/
import { createHash, timingSafeEqual } from "crypto"

/**
 * Verifica un Bearer token contra una o más keys aceptadas. Compara digests
 * sha256 con timingSafeEqual y acumula resultados sin short-circuit para no
 * filtrar timing sobre cuál slot matcheó (relevante con doble-aceptación).
 */
export function verifyBearer(
  authorizationHeader: string | null,
  acceptedKeys: readonly (string | null)[],
): boolean {
  if (!authorizationHeader) return false
  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim())
  if (!match) return false

  const presented = sha256(match[1])
  let matched = false
  for (const k of acceptedKeys) {
    if (k && timingSafeEqual(presented, sha256(k))) matched = true
  }
  return matched
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest()
}
