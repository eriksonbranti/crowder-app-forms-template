// Helpers for list/index pages that combine `?q=`, `?status=`, `?page=`.
// `null` in overrides clears the param; `undefined` keeps the current value.

export function buildListQuery<S extends string>(
  current: { q?: string; status?: S; page?: number },
  overrides: {
    q?: string | null
    status?: S | null
    page?: number | null
  } = {},
): string {
  const params = new URLSearchParams()
  const q = overrides.q === null ? undefined : (overrides.q ?? current.q)
  const status =
    overrides.status === null ? undefined : (overrides.status ?? current.status)
  const page =
    overrides.page === null ? undefined : (overrides.page ?? current.page)
  if (q) params.set("q", q)
  if (status) params.set("status", status)
  if (page && page > 1) params.set("page", String(page))
  const s = params.toString()
  return s ? `?${s}` : ""
}

export function parseStatusParam<S extends string>(
  value: string | undefined,
  allowed: readonly S[],
): S | undefined {
  return value && (allowed as readonly string[]).includes(value)
    ? (value as S)
    : undefined
}

export function parsePageParam(value: string | undefined): number {
  return Math.max(1, Number(value) || 1)
}
