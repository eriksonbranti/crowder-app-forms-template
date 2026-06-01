# Security Policy

## Reportar una vulnerabilidad

Si encontrás una vulnerabilidad de seguridad en este template, por favor **no
abras un issue público**. Reportala de forma privada a:

- **Email**: security@getcrowder.com

Incluí en el reporte:

- Descripción del problema y su impacto.
- Pasos para reproducirlo (PoC si es posible).
- Versión / commit del repo afectado.
- Sugerencia de fix si la tenés.

Vamos a confirmar la recepción dentro de 72hs hábiles y a coordinar disclosure
responsable. Si el fix es relevante para todos los partners que clonaron este
template, lo publicamos en el repo y avisamos vía Releases.

## Alcance

Este repo es un **template open source**. Cada partner que lo despliegue es
responsable de su propia instancia (variables de entorno, base de datos,
acceso al dashboard). Reportes de seguridad sobre el *código del template*
están en alcance; sobre instancias específicas en producción, contactá al
partner que opera esa instancia.

## Modelo de seguridad

Ver la sección [Seguridad del README](README.md#seguridad) para un resumen del
modelo: headers, origin enforcement, rate limiting, RLS y CSV export.

## Buenas prácticas para quienes despliegan

- Deshabilitar signup público en Supabase Auth después de crear los admins.
- Mantener Next.js y dependencias actualizadas (`pnpm audit` periódicamente).
- Configurar `allowedOrigins` por formulario en lugar de aceptar `*`.
- Si exponés `/api/cron/expire`, usá un `CRON_SECRET` de ≥32 chars generado
  con `openssl rand -base64 32`.
- Rotar `SUPABASE_SERVICE_ROLE_KEY` si sospechás de compromiso.
