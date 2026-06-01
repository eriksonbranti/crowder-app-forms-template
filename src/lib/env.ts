import { z } from "zod"

// Conexión runtime al pooler de Supabase (port 6543). La integración Vercel ↔
// Supabase la inyecta como POSTGRES_URL automáticamente; para correr local
// setearla en .env.local con el mismo nombre.
const serverSchema = z.object({
  POSTGRES_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  // Sin CRON_SECRET el endpoint /api/cron/expire queda deshabilitado.
  // Generar con `openssl rand -base64 32` si querés activarlo.
  CRON_SECRET: z.string().min(32).optional(),
})

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
})

const isServer = typeof window === "undefined"

const parsedPublic = publicSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
})

if (!parsedPublic.success) {
  console.error(
    "Invalid public env vars:",
    parsedPublic.error.flatten().fieldErrors,
  )
  throw new Error("Invalid public environment variables")
}

let serverData: z.infer<typeof serverSchema> | null = null

if (isServer) {
  const parsed = serverSchema.safeParse({
    POSTGRES_URL: process.env.POSTGRES_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
  })

  if (!parsed.success) {
    console.error(
      "Invalid server env vars:",
      parsed.error.flatten().fieldErrors,
    )
    throw new Error("Invalid server environment variables")
  }

  serverData = parsed.data
}

export const env = {
  ...parsedPublic.data,
  get POSTGRES_URL() {
    return serverData!.POSTGRES_URL
  },
  get SUPABASE_SERVICE_ROLE_KEY() {
    return serverData!.SUPABASE_SERVICE_ROLE_KEY
  },
  get CRON_SECRET() {
    return serverData!.CRON_SECRET
  },
}
