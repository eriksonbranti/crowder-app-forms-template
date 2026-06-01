# Crowder Partner Forms

Template open source para que partners de Crowder construyan **formularios
custom estilo Google Forms** —con grupos y preguntas de cualquier tipo— que se
exponen en el iframe embebido en el checkout de la ticketera. Pensado para
**maratones y congresos**.

Este repo es una **implementación de referencia** del protocolo Embedded App de
Crowder, documentado en <https://crowder-docs.vercel.app/embedded-app/>. Si vas
a construir tu propia integración desde cero, esa doc es el contrato; este
template muestra cómo se ve implementado en Next.js + Supabase.

## Desplegar

Hay dos caminos. Elegí según lo que prefieras:

| | 🚀 Despliegue rápido | 🔄 Despliegue sincronizado |
|---|---|---|
| Cómo | Botón "Deploy with Vercel" | Fork + import en Vercel |
| Esfuerzo inicial | 1 clic | ~2 clics más |
| Recibe mejoras del template | ❌ No (queda congelado en la versión del día) | ✅ Sí (se actualiza solo) |
| Para quién | Probar rápido, demos, algo desechable | Producción que quiere mantenerse al día |

> **¿Por qué el botón no se actualiza?** Vercel **clona** el repo (no hace un
> fork real) y, por seguridad, GitHub no le deja copiar los archivos de
> `.github/workflows`. Sin esa relación de fork ni esos workflows, no hay forma
> de que la copia reciba mejoras automáticamente. Si querés actualizaciones,
> usá el camino sincronizado.

### 🚀 Opción A — Despliegue rápido (botón)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fgetcrowder%2Fcrowder-app-forms-template&project-name=crowder-app-forms-template&repository-name=crowder-app-forms-template)

1. **Hacé clic en "Deploy with Vercel"** arriba. Vercel clona el repo a tu
   cuenta de GitHub y crea el proyecto. No hace falta cargar variables de
   entorno todavía; las inyecta Supabase más abajo.
2. Continuá en **[Conectar Supabase y arrancar](#conectar-supabase-y-arrancar)**.

### 🔄 Opción B — Despliegue sincronizado (fork)

Este camino mantiene tu copia conectada al template de Crowder, así recibís las
mejoras automáticamente.

1. **Forkeá el repo**: entrá a
   <https://github.com/getcrowder/crowder-app-forms-template/fork> y hacé clic
   en **Create fork**. Queda como `tu-usuario/crowder-app-forms-template`.
2. **Activá las actualizaciones automáticas**: en tu fork, abrí la pestaña
   **Actions** y hacé clic en el botón verde **"I understand my workflows,
   enable them"**. (GitHub deshabilita los workflows en forks por defecto; este
   paso prende el que sincroniza con Crowder.)
3. **Importá el fork en Vercel**: andá a **Add New… → Project → Import Git
   Repository** y elegí tu fork. Si no aparece, clic en **"Adjust GitHub App
   Permissions"** para darle acceso. Hacé **Deploy**.
4. Continuá en **[Conectar Supabase y arrancar](#conectar-supabase-y-arrancar)**.

> **Cómo se actualiza después:** nada que hacer. El fork se sincroniza solo a
> diario y Vercel re-despliega al detectar el cambio. Si querés traer una mejora
> al instante: en tu fork, botón **"Sync fork" → Update branch**, o en **Actions
> → Sync con template de Crowder → Run workflow**.

### Conectar Supabase y arrancar

Estos pasos son iguales para ambas opciones.

1. **El primer deploy va a fallar** ❌. Es esperado: todavía no hay base de
   datos. Sin Supabase conectado, el build no encuentra `POSTGRES_URL` y se
   detiene en la migración.

2. **Conectar Supabase desde Vercel**:
   - Abrí el proyecto recién creado en Vercel.
   - Andá a la pestaña **Storage** → **Connect Database**.
   - Elegí **Supabase** → **Create new** (o conectar uno existente).
   - Aceptá los permisos. Vercel + Supabase inyectan automáticamente:
     - `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_PRISMA_URL`
     - `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`
     - `SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`

3. **Re-deployá** desde la pestaña **Deployments** → último deploy → menú "···"
   → **Redeploy**. Esta vez el build corre las migraciones de Drizzle contra
   Supabase y termina ok.

4. **Login + configurar orígenes**. Abrí la URL del proyecto, hacé login con
   Supabase Auth (magic link al mail) y desde **cada formulario** definí los
   *Origins parent permitidos* (las URLs de los checkout que pueden embeberlo).
   Sin esto, el iframe no podrá comunicarse con su parent.

### Después del deploy

- **Crear el primer usuario admin**: Supabase Auth permite signup público por
  defecto. Para evitar que cualquiera se registre en tu dashboard, andá a
  **Supabase → Authentication → Providers → Email** y deshabilitá "Enable
  Sign Up" después de invitarte vos. O usá **Authentication → Users → Invite**
  para dar de alta los admins por mail.

- **Habilitar el cron de expiración** (opcional, hoy no está agendado):
  generar un secret con `openssl rand -base64 32`, agregarlo como
  `CRON_SECRET` en Vercel, y configurar un cron job (Vercel Cron o externo)
  que pegue a `GET /api/cron/expire` con header `Authorization: Bearer <secret>`.

## Setup local

Requiere **pnpm** (declarado en `packageManager` del `package.json`). Instalar
con `corepack enable && corepack prepare pnpm@10.3.0 --activate` o seguir
[la guía oficial](https://pnpm.io/installation).

1. Instalar dependencias:

   ```bash
   pnpm install
   ```

2. Copiar variables de entorno:

   ```bash
   cp .env.example .env.local
   ```

   Y cargar valores reales. Mínimamente necesitás `POSTGRES_URL`,
   `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (y
   `POSTGRES_URL_NON_POOLING` si vas a correr migraciones desde local). Los
   orígenes permitidos para embeber se configuran por formulario desde el
   dashboard.

3. Aplicar migraciones:

   ```bash
   pnpm db:migrate
   ```

4. Iniciar servidor de desarrollo:

   ```bash
   pnpm dev
   ```

   Abrir <http://localhost:3000>.

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 15 (App Router) |
| UI | Tremor + Tailwind CSS |
| Auth | Supabase Auth (solo para dashboard) |
| Base de datos | Supabase Postgres + Drizzle ORM |
| Deploy | Vercel |
| Validación de formularios | Zod schemas generados desde la definición del form |

## Scripts

| Script | Qué hace |
|---|---|
| `pnpm dev` | Servidor Next.js en modo dev |
| `pnpm build` | Build de producción (local) |
| `pnpm vercel-build` | Build usado en Vercel: corre migraciones + `next build` |
| `pnpm start` | Sirve el build de producción |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm db:generate` | Genera nueva migración Drizzle a partir del schema |
| `pnpm db:migrate` | Aplica migraciones pendientes contra `POSTGRES_URL_NON_POOLING` |
| `pnpm db:push` | Push del schema (útil en dev local) |
| `pnpm db:studio` | Abre Drizzle Studio |

## Estructura

```
src/
├── app/                # Routes Next.js (thin controllers)
├── modules/            # Lógica de negocio por dominio
├── adapters/           # Integraciones externas (Crowder, Supabase)
├── lib/                # Infra compartida (db, env, errors, form-schema)
└── components/         # UI (dashboard, form-renderer, form-builder, embed, ui)

drizzle/
└── migrations/         # Migraciones generadas por drizzle-kit
```

## Mapa de integración con Crowder

Este template implementa el protocolo
[Embedded App de Crowder](https://crowder-docs.vercel.app/embedded-app/). Si
estás leyendo el código para aprender o portar a otro stack, estos son los
puntos donde el contrato se materializa:

| Archivo | Pieza del protocolo |
|---|---|
| [src/app/embed/[formId]/page.tsx](src/app/embed/[formId]/page.tsx) | Página servida dentro del iframe del checkout |
| [src/components/embed/EmbedWizard.tsx](src/components/embed/EmbedWizard.tsx) | Handshake `postMessage` iframe ↔ parent (interaction state, height, selected/cleared) |
| [src/app/api/transactions/submit/route.ts](src/app/api/transactions/submit/route.ts) | Submit del form desde el iframe — valida `Origin` contra `forms.allowed_origins` |
| [src/app/api/transactions/[id]/events/route.ts](src/app/api/transactions/[id]/events/route.ts) | Webhook server-to-server de lifecycle (`purchaseReserved`, `purchasePaid`, …) con Bearer auth |
| [src/app/api/transactions/[id]/route.ts](src/app/api/transactions/[id]/route.ts) | Lectura server-to-server del estado de una transacción con Bearer auth |
| [src/adapters/crowder/auth.ts](src/adapters/crowder/auth.ts) | Verificación Bearer con `timingSafeEqual` para los endpoints server-to-server |
| [next.config.ts](next.config.ts) | `Content-Security-Policy: frame-ancestors *` sobre `/embed/*` (solo embed es embebible) |

Cada uno de esos archivos lleva en su tope un comentario `// Crowder Embedded
App protocol — …` con link a la spec.

## Seguridad

Resumen del modelo de seguridad de este template — útil si vas a desplegarlo a
producción para terceros:

- **Headers**: HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy`,
  `Permissions-Policy` y `X-Frame-Options: DENY` se aplican a todas las rutas
  excepto `/embed/*`. El embed expone `Content-Security-Policy: frame-ancestors *`
  porque es embebible por diseño (ver [`next.config.ts`](next.config.ts)).
- **Origin enforcement del iframe**: la validación real de quién puede embeber
  vive en el server. La API (`/api/transactions/submit`) rechaza requests
  cuyo header `Origin` no esté en `forms.allowed_origins` del formulario.
  Configurá los orígenes desde el dashboard del form.
- **Rate limiting**: hay un limiter in-memory best-effort en
  [`src/lib/rate-limit.ts`](src/lib/rate-limit.ts) sobre los endpoints
  públicos. Para producción de alto volumen, reemplazá la implementación por
  Upstash Ratelimit / Vercel KV.
- **Sanitización de markdown**: las descripciones de form se renderizan vía
  [`renderMarkdownLite`](src/lib/form-schema/render.ts) que escapa todo HTML y
  re-introduce un subset acotado de tags + links `https://` validados con
  `new URL()`.
- **RLS**: las tablas tienen RLS habilitado para bloquear PostgREST anon. La
  app conecta con rol `postgres` (BYPASSRLS), por lo que no se requieren
  policies adicionales. Ver [`drizzle/migrations/0000_initial.sql`](drizzle/migrations/0000_initial.sql) (bloque al final).
- **CSV export**: [`csvEscape`](src/lib/csv.ts) neutraliza CSV injection
  (cells con `=`, `+`, `-`, `@`, `|`, `\t`, `\r` se prefijan con `'`).
- **CRON_SECRET**: requerido ≥32 chars. Generá con `openssl rand -base64 32`.

Reporte de vulnerabilidades: ver [`SECURITY.md`](SECURITY.md).

## Licencia

Este template hereda la licencia del template Tremor original que sirvió como
base visual del dashboard. Ver [`LICENSE`](LICENSE).
