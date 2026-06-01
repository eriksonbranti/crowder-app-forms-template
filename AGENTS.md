# AGENTS.md

Guía para agentes de IA (Claude Code, Cursor, Codex, etc.) trabajando en
**crowder-app-forms-template**. Lee esto antes de tocar código.

## Qué es este repo

Template open source de Next.js 15 (App Router) para que partners de Crowder
construyan formularios custom estilo Google Forms que se exponen en un iframe
embebido en el checkout de la ticketera. Pensado para maratones y congresos.

Es una **implementación de referencia** del protocolo Embedded App de Crowder.
La especificación del contrato (lifecycle, endpoints, postMessage, headers) vive
en <https://crowder-docs.vercel.app/embedded-app/>. Si tocás `/api/*`,
`/embed/*` o el handshake con el parent, esa doc es la fuente de verdad.

## Stack

- **Framework:** Next.js 15 (App Router, React 19, Turbopack en dev)
- **UI:** Tremor + Tailwind CSS 3 + Radix UI + Remixicon
- **Theming:** `next-themes` (dark / light / system)
- **Auth:** Supabase Auth (magic link / PKCE) — solo para el dashboard
- **DB:** Supabase Postgres + Drizzle ORM (`drizzle/migrations`)
- **Validación:** Zod
- **Deploy:** Vercel (incluye Cron Jobs en [vercel.json](vercel.json))

## Estructura

```
src/
  app/
    (dashboard)/   → dashboard autenticado (forms, submissions, transactions, webhooks, settings)
    api/           → endpoints REST (Crowder lifecycle, validate, submit)
    auth/          → callback PKCE de Supabase
    embed/         → iframe público embebido en el checkout
    login/         → magic link
    layout.tsx
    globals.css
  components/      → componentes Tremor-style reutilizables (Button, Card, Input, ...)
    dashboard/     → bloques específicos del dashboard
    embed/         → bloques específicos del iframe
    form-builder/  → builder no-code (outline + canvas + inspector)
    form-renderer/ → renderer de formularios (single + multi-step wizard)
    ui/            → Navigation, etc.
  lib/             → db, form-schema, supabase client, utils
  modules/         → lógica de negocio (lifecycle, submissions, ...)
  adapters/        → integraciones externas (Crowder API, webhooks)
  middleware.ts    → Supabase session refresh
drizzle/migrations → SQL + snapshots de Drizzle
```

## Reglas no negociables

### 1. Dark mode + light mode (CRÍTICO)

**Todo lo que se construya debe soportar dark y light mode.** Sin excepciones.

El proyecto tiene un sistema de **tokens semánticos** que adapta los colores
automáticamente al modo activo. Si usás los tokens, no hace falta escribir
`dark:` a mano.

- **Theming:** `next-themes` con `class` strategy (clase `dark` en `<html>`).
- **CSS vars:** definidas en [src/app/globals.css](src/app/globals.css) con
  bloques `:root` (light) y `.dark` (dark).
- **Tokens Tailwind:** mapeados en [tailwind.config.ts](tailwind.config.ts).

**Tokens disponibles** (usar siempre estos en vez de grays hardcodeados):

| Token | Uso típico |
|---|---|
| `bg-background` / `text-foreground` | superficie principal de la página |
| `bg-card` / `text-card-foreground` | tarjetas, paneles |
| `bg-popover` / `text-popover-foreground` | popovers, dropdowns |
| `bg-muted` / `text-muted-foreground` | superficies sutiles, texto secundario |
| `bg-subtle` / `text-subtle-foreground` | hovers, code blocks, fondos atenuados |
| `bg-accent` / `text-accent-foreground` | acentos suaves (focus, selección) |
| `text-secondary-foreground` | texto secundario |
| `text-faint` / `border-faint` / `bg-faint` | texto/borde muy atenuado (disabled, placeholders) |
| `border-border` / `border-input` / `divide-border` | bordes y separadores |
| `ring-ring` | focus rings |
| `bg-primary` / `text-primary` / `text-primary-foreground` / `border-primary` | acción primaria |
| `bg-destructive` / `text-destructive` / `border-destructive` | errores, eliminación |

**Reglas:**

- Preferí siempre tokens. `bg-background` se adapta solo; no necesita
  `dark:bg-gray-950`.
- Si necesitás un color que el token no cubre (status colors: success,
  warning), podés escribir el par `light dark:` explícito — pero considerá
  agregar el token a `globals.css` + `tailwind.config.ts` si lo vas a
  reusar.
- **Prohibido** introducir nuevos `bg-white`, `text-black`, `bg-gray-*`,
  `border-gray-*` sin `dark:`. Usá el token.
- SVGs/íconos: `currentColor` o token; no hex hardcodeado.
- Charts (Recharts / Tremor) deben leer colores desde los tokens.
- Antes de dar por terminada una UI: **probá ambos modos** en el navegador
  (toggle desde Settings → tema, o cambiando el sistema).

Si dudás si algo se ve bien en el otro modo, asumí que **no** y arregálo.

### 2. Convenciones de código

- TypeScript estricto. Nada de `any` salvo justificación explícita en comentario.
- Componentes React: server components por defecto; `"use client"` solo cuando
  necesites estado/efectos/eventos del navegador.
- Co-locá componentes específicos de una ruta en `_components/` dentro de esa
  ruta (ver `src/app/(dashboard)/forms/[id]/_components/`).
- Estilos vía Tailwind + `tailwind-variants` / `clsx` + `tailwind-merge`
  (utility `cn`). No CSS-in-JS, no styled-components.
- Validación con Zod en boundaries (API routes, form submit, env vars).

### 3. Base de datos

- Cambios de schema: editar [src/lib/db/schema.ts](src/lib/db/schema.ts) y
  generar migración con `pnpm db:generate`. Nunca editar SQL de migraciones
  ya aplicadas; crear una nueva.
- RLS está activado (ver bloque final de
  [`drizzle/migrations/0000_initial.sql`](drizzle/migrations/0000_initial.sql)).
  Cualquier tabla nueva debe quedar con RLS habilitado.

### 4. Seguridad

- Nada de secretos en cliente. `NEXT_PUBLIC_*` solo para lo que de verdad es
  público.
- Endpoints `/api/*` de lifecycle de Crowder deben validar firma/header
  compartido.
- El iframe `/embed/*` es público; toda lógica sensible queda server-side.

## Workflow

1. Hacer el cambio mínimo que resuelve el problema. Nada de refactors
   oportunistas.
2. Verificar:
   ```bash
   pnpm typecheck
   pnpm lint
   ```
4. **Probar la UI en dark y light mode** antes de dar por terminado.
5. Para cambios de DB: `pnpm db:generate` y commitear el SQL + snapshot.

## Scripts útiles

| Script | Qué hace |
|---|---|
| `pnpm dev` | Next.js en modo dev (Turbopack) |
| `pnpm build` | Build de producción |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm db:generate` | Genera migración a partir del schema |
| `pnpm db:migrate` | Aplica migraciones pendientes |
| `pnpm db:studio` | Abre Drizzle Studio |

## Qué NO hacer

- No introducir nuevas librerías de UI (Material, Chakra, etc.) — el stack es
  Tremor + Radix.
- No hardcodear colores que rompan dark mode.
- No commitear archivos `.env*` con valores reales.
- No usar `git add -A` ciegamente — stagear archivos específicos.
- No saltarse hooks de pre-commit (`--no-verify`) salvo que el usuario lo pida.
- No crear documentación nueva (`*.md`) salvo que el usuario lo pida
  explícitamente.

## Modelo de seguridad

Este repo es un template open source. El modelo de seguridad está resumido en
[README.md](README.md#seguridad) y [SECURITY.md](SECURITY.md). Antes de tocar
rutas de `/api/*`, `/embed/*` o migraciones, leé esa sección.
