// One-line JSON logs for Vercel. `createLogger(tag)` captures the start time
// so each `out()` call carries `ms` without each route tracking its own t0.

type LogData = Record<string, unknown>

export type RouteLogger = {
  in(data?: LogData): void
  out(status: number, data?: LogData): void
}

export function createLogger(tag: string): RouteLogger {
  const t0 = Date.now()
  return {
    in(data) {
      console.log(JSON.stringify({ tag, dir: "in", ...data }))
    },
    out(status, data) {
      console.log(
        JSON.stringify({ tag, dir: "out", status, ms: Date.now() - t0, ...data }),
      )
    },
  }
}
