#!/usr/bin/env node
// Corre las migraciones de Drizzle automáticamente durante el build en Vercel.
//
// - En Vercel (VERCEL=1): si hay POSTGRES_URL_NON_POOLING, migra.
//   Si no, falla con un mensaje claro (probablemente falta vincular Supabase).
// - Fuera de Vercel: no-op. Localmente se corre `npm run db:migrate` a mano.
//
// Usamos el migrator programático de drizzle-orm en lugar de `drizzle-kit
// migrate` por dos motivos:
//   1. drizzle-kit se traga el error de Postgres (solo imprime
//      "applying migrations…" y sale con código 1), lo que hace imposible
//      diagnosticar el fallo desde los logs de Vercel.
//   2. El migrator programático envuelve cada migración en una transacción,
//      así un corte de conexión a mitad hace rollback en vez de dejar objetos
//      huérfanos que rompen todos los deploys siguientes con "already exists".
//
// Requiere conexión directa (POSTGRES_URL_NON_POOLING), no el pooler.

import postgres from "postgres"
import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"

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

const sql = postgres(process.env.POSTGRES_URL_NON_POOLING, { max: 1 })
try {
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle/migrations" })
  console.log("[migrate-on-deploy] migrations applied successfully")
} catch (error) {
  console.error("[migrate-on-deploy] migration failed:")
  console.error(error)
  process.exitCode = 1
} finally {
  await sql.end()
}
