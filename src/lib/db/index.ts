import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import { env } from "@/lib/env"
import * as schema from "./schema"

type Cache = {
  pgClient?: ReturnType<typeof postgres>
  db?: ReturnType<typeof drizzle<typeof schema>>
}
const cache = globalThis as unknown as Cache

const client =
  cache.pgClient ??
  postgres(env.POSTGRES_URL, {
    prepare: false, // requerido por el Transaction pooler de Supabase (port 6543)
    // Aunque cada lambda warm sirve una request a la vez, dentro de una request
    // hay fan-outs en Promise.all (dashboard/transactions hacen ~8 queries) que
    // con un pool pequeño se serializan. Bench: max=1 → ~3s, max=3 → ~1s,
    // max=5 → ~0.7s (ver docs/scripts/bench-db-pool.ts). Subido a 8 para
    // absorber el fan-out de /transactions sin colgar contra statement_timeout.
    max: process.env.NODE_ENV === "production" ? 8 : 10,
    // Sin estos timeouts, el cliente no se entera de que el pooler cerró una conexión
    // idle → el próximo query cuelga hasta statement_timeout y crashea el lambda.
    idle_timeout: 20,
    max_lifetime: 60 * 30,
    connect_timeout: 10,
    connection: {
      application_name: "crowder-app-forms-template",
      statement_timeout: 8_000,
    },
  })

export const db = cache.db ?? drizzle(client, { schema })

if (process.env.NODE_ENV !== "production") {
  cache.pgClient = client
  cache.db = db
}

export { schema }
