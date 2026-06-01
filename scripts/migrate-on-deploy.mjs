#!/usr/bin/env node
// Corre las migraciones de Drizzle automáticamente durante el build en Vercel.
//
// - En Vercel (VERCEL=1): si hay POSTGRES_URL_NON_POOLING, migra.
//   Si no, falla con un mensaje claro (probablemente falta vincular Supabase).
// - Fuera de Vercel: no-op. Localmente se corre `npm run db:migrate` a mano.
//
// Drizzle Kit lee la conexión desde drizzle.config.ts, que usa
// POSTGRES_URL_NON_POOLING (necesario para DDL contra Supabase).

import { spawnSync } from "node:child_process"

if (process.env.VERCEL !== "1") {
  console.log("[migrate-on-deploy] skip: not running on Vercel")
  process.exit(0)
}

if (!process.env.POSTGRES_URL_NON_POOLING) {
  console.error(
    "[migrate-on-deploy] POSTGRES_URL_NON_POOLING not set. Link the Supabase " +
      "integration in Vercel (Project → Storage → Connect Supabase) so it gets " +
      "injected automatically.",
  )
  process.exit(1)
}

console.log("[migrate-on-deploy] applying drizzle migrations…")
const result = spawnSync("npx", ["drizzle-kit", "migrate"], {
  stdio: "inherit",
  env: process.env,
})

process.exit(result.status ?? 1)
