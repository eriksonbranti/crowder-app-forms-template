"use client"

import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { env } from "@/lib/env"

let cached: SupabaseClient | null = null

export function getBrowserSupabase(): SupabaseClient {
  if (!cached) {
    cached = createBrowserClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    )
  }
  return cached
}
