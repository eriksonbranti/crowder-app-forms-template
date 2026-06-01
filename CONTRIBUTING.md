# Contributing

Gracias por interesarte en mejorar **crowder-app-forms-template**. Este repo es un
template open source que cada partner clona y despliega a su propia
infraestructura; los aportes acá benefician a toda esa base de instalaciones.

## Antes de abrir un PR

1. **Abrí un issue primero** para cambios no triviales (features nuevos,
   refactors, cambios de schema). Para fixes chicos y typos podés ir directo
   al PR.
2. **Buscá issues existentes**: puede que ya estemos trabajando en eso.

## Setup

Ver [README.md → Setup local](README.md#setup-local). Resumen:

```bash
corepack enable && corepack prepare pnpm@10.3.0 --activate
pnpm install
cp .env.example .env.local   # cargar valores reales
pnpm db:migrate
pnpm dev
```

## Antes de commitear

```bash
pnpm typecheck
pnpm lint
```

Ambos tienen que pasar. Para cambios de UI, **probá dark y light mode** en el
navegador (ver [AGENTS.md → regla 1](AGENTS.md)).

Para cambios de schema:

```bash
pnpm db:generate
```

Y commiteá el SQL + snapshot generados en `drizzle/migrations/`.

## Estilo de PR

- **Un PR, un cambio**. No mezclar features con refactors.
- **Título corto** (< 70 chars) en imperativo: "Add X", "Fix Y", "Refactor Z".
- **Descripción** con el *por qué*, no solo el *qué* (el diff ya muestra el qué).
- **Sin secretos** en el diff (.env*, keys, tokens).

## Estilo de código

Las reglas no negociables están en [AGENTS.md](AGENTS.md). Lo más importante:

- TypeScript estricto, nada de `any` sin justificación.
- Server components por defecto; `"use client"` solo cuando hace falta.
- Tokens semánticos para colores (no `bg-gray-*` sin `dark:`).
- Validación con Zod en boundaries (API routes, env vars, form submit).

## Reportar bugs

Abrí un [issue](../../issues) con:

- Versión / commit del repo.
- Pasos para reproducir.
- Comportamiento esperado vs. real.
- Logs / screenshots si aplican.

## Reportar vulnerabilidades

**No abras un issue público.** Ver [SECURITY.md](SECURITY.md).

## Licencia

Al contribuir aceptás que tu aporte se licencia bajo MIT (ver [LICENSE](LICENSE)).
