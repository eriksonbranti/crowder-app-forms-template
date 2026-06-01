const enabled =
  process.env.TIMING === "1" || process.env.NODE_ENV !== "production"

export async function time<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (!enabled) return fn()
  const start = performance.now()
  try {
    return await fn()
  } finally {
    const ms = (performance.now() - start).toFixed(1)
    console.log(`[timing] ${label}: ${ms}ms`)
  }
}

export function timer(label: string) {
  const start = performance.now()
  return () => {
    if (!enabled) return
    const ms = (performance.now() - start).toFixed(1)
    console.log(`[timing] ${label}: ${ms}ms`)
  }
}
