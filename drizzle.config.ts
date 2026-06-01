import { defineConfig } from "drizzle-kit"
import { config } from "dotenv"

// Next.js usa .env.local para overrides locales; cargamos ambos así
// `pnpm db:*` funciona sin tener que duplicar valores en .env.
config({ path: ".env.local" })
config({ path: ".env" })

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // Migraciones requieren conexión directa (no el pooler en port 6543).
    // La integración Supabase ↔ Vercel inyecta POSTGRES_URL_NON_POOLING; para
    // correr `pnpm db:*` local hay que setearla manualmente en .env.local.
    url: process.env.POSTGRES_URL_NON_POOLING!,
  },
  strict: true,
  verbose: true,
})
