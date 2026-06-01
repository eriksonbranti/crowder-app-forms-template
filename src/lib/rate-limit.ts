import { NextResponse, type NextRequest } from "next/server"

import { jsonError } from "@/lib/http"

// Best-effort in-memory rate limiter. Per warm serverless instance — Vercel can
// spawn multiple instances, so the effective limit is N × LIMIT. Good enough as
// a defense-in-depth against trivial abuse; for production grade limits, wire
// up Upstash Ratelimit or Vercel KV by replacing the body of `take()`.
type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

const MAX_KEYS = 10_000
const SWEEP_INTERVAL_MS = 1_000

export type RateLimitBucket = "submit" | "clear"

let lastSweepAt = 0

function evictIfFull(now: number): void {
  if (buckets.size <= MAX_KEYS) return
  if (now - lastSweepAt >= SWEEP_INTERVAL_MS) {
    lastSweepAt = now
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k)
  }
  // Still over cap: evict oldest by insertion order (≈ oldest resetAt for a
  // uniform windowMs) instead of clearing — clearing would hand every attacker
  // a fresh quota the moment the cap is hit.
  let toEvict = buckets.size - MAX_KEYS
  if (toEvict <= 0) return
  for (const k of buckets.keys()) {
    if (toEvict-- <= 0) break
    buckets.delete(k)
  }
}

function take(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    evictIfFull(now)
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (existing.count >= limit) return false
  existing.count += 1
  return true
}

function clientIp(req: NextRequest): string {
  // Prefer Vercel's edge-set header (not client-controllable). Fall back to the
  // rightmost XFF entry — closest to our edge, hardest to spoof.
  const vercel = req.headers.get("x-vercel-forwarded-for")
  if (vercel) return vercel.split(",").pop()!.trim()
  const xff = req.headers.get("x-forwarded-for")
  if (xff) return xff.split(",").pop()!.trim()
  return req.headers.get("x-real-ip") ?? "unknown"
}

export function rateLimit(
  req: NextRequest,
  opts: { bucket: RateLimitBucket; limit: number; windowMs: number },
): NextResponse | null {
  const key = `${opts.bucket}:${clientIp(req)}`
  if (take(key, opts.limit, opts.windowMs)) return null
  const res = jsonError("rate_limited", "too many requests")
  res.headers.set("Retry-After", String(Math.ceil(opts.windowMs / 1000)))
  return res
}
