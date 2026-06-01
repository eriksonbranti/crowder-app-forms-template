// Compartido por el editor (cliente) y el server action que persiste la lista.
// postMessage compara contra `event.origin` (esquema://host, sin path), así
// que normalizamos a esa forma y rechazamos cualquier path.
export type NormalizeOriginResult =
  | { ok: true; value: string }
  | { ok: false; error: string }

export function normalizeOrigin(input: string): NormalizeOriginResult {
  const trimmed = input.trim()
  if (!trimmed) return { ok: false, error: "ingresá una URL" }
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return {
      ok: false,
      error: "URL inválida (ej. https://checkout.partner.com)",
    }
  }
  if (url.pathname !== "/" && url.pathname !== "") {
    return { ok: false, error: "no incluyas un path; usá solo el origen" }
  }
  return { ok: true, value: `${url.protocol}//${url.host}` }
}

export const MAX_ORIGINS = 50

// Normaliza y deduplica una lista de orígenes, rechazando la primera entrada
// inválida. Compartido por los server actions de form y de Settings.
export function parseOriginsList(
  origins: string[],
): { ok: true; value: string[] } | { ok: false; error: string } {
  const normalized: string[] = []
  for (const raw of origins) {
    const result = normalizeOrigin(raw)
    if (!result.ok) return { ok: false, error: result.error }
    normalized.push(result.value)
  }
  if (normalized.length > MAX_ORIGINS) {
    return { ok: false, error: `Máximo ${MAX_ORIGINS} orígenes.` }
  }
  return { ok: true, value: Array.from(new Set(normalized)) }
}

// Override semantics (igual que el theme): si el form define su propia lista,
// reemplaza a la global; si está vacía, hereda los orígenes globales.
export function resolveAllowedOrigins(
  formOrigins: readonly string[],
  globalOrigins: readonly string[],
): string[] {
  return formOrigins.length > 0 ? [...formOrigins] : [...globalOrigins]
}

// Unión de orígenes efectivos de varios forms (cada uno resuelto con su
// fallback global). Se usa al validar el origen de un batch de submissions que
// puede abarcar varios forms en una sola request.
export function unionEffectiveOrigins(
  perForm: readonly (readonly string[])[],
  globalOrigins: readonly string[],
): string[] {
  const out = new Set<string>()
  for (const formOrigins of perForm) {
    for (const o of resolveAllowedOrigins(formOrigins, globalOrigins)) {
      out.add(o)
    }
  }
  return Array.from(out)
}
