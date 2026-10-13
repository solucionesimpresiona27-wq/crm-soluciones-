# CRM Soluciones Impresiona

CRM web de Soluciones Impresiona (Guadalajara): clientes, cotizaciones con calculadora de precios, pedidos, producción y cobranza. Funciona en computadora y celular, y se instala como app desde el navegador.

Diseño: **Impresiona Glass**, un sistema propio inspirado en el Liquid Glass del Centro de Control de Apple, con los colores del logo. Incluye modo claro y oscuro.

**Vista previa del diseño** (datos ficticios, nada se guarda): [docs/VISTA_PREVIA.md](docs/VISTA_PREVIA.md).

## Puesta en marcha (producción)

1. **Base de datos y usuarios**: [docs/GUIA_SUPABASE.md](docs/GUIA_SUPABASE.md). Usa el plan gratuito de Supabase y tarda unos 20 minutos.
2. **Publicación en Hostinger**: [docs/GUIA_HOSTINGER.md](docs/GUIA_HOSTINGER.md). Sirve en cualquier plan, publicado en `crm.solucionesimpresiona.com`.

Costo mensual adicional: **$0** con los planes gratuitos.

## Seguridad

- Cada persona entra con su propio usuario. El registro público está desactivado y el administrador da de alta al equipo.
- Los permisos por rol (Administración, Ventas, Diseño, Producción) se aplican **en la base de datos**, no solo en pantalla. Por ejemplo, Producción no puede leer precios aunque lo intente desde el navegador.
- El navegador solo conoce la llave pública de Supabase. La llave secreta vive únicamente en la función del servidor que administra usuarios.
- Bitácora de cambios: quién creó, modificó, aprobó o canceló cada registro.
- Respaldo semanal gratuito con GitHub Actions (opcional).

## Desarrollo

Requisitos: Node 22. Para la base de datos local se necesitan Docker y la [CLI de Supabase](https://supabase.com/docs/guides/local-development).

```bash
npm install

# Vista previa con datos ficticios (no necesita Supabase)
VITE_DEMO=true npm run dev

# App real con Supabase local
supabase start
cp .env.example .env.local   # llena con los datos de `supabase status`
node scripts/sembrar-local.mjs   # usuarios y datos de prueba (ver variables en el script)
npm run dev
```

| Comando | Para qué |
|---|---|
| `npm run typecheck` | Revisión de tipos |
| `npm test` | Pruebas unitarias y, si hay variables de Supabase local, de base de datos |
| `npm run test:db` | Pruebas de permisos y flujos contra Supabase local |
| `npm run build` / `npm run build:demo` | Compilar la app real o la vista previa |
| `npm run db:instalador` | Regenerar `supabase/instalar.sql` (instalación nueva) y `supabase/actualizar-fases-2-y-3.sql` (actualización de una base existente) a partir de las migraciones |
| `npm run db:types` | Regenerar los tipos de TypeScript de la base de datos |

Funciones de servidor (`supabase/functions`): `admin-usuarios` (alta de usuarios) y `portal-cliente` (archivos del portal del cliente). Para probar `portal-cliente` en local sin el runtime de Edge, ejecútala con Deno y corre sus pruebas:

```bash
SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=... deno run --allow-net --allow-env --allow-read supabase/functions/portal-cliente/index.ts
PORTAL_FN_URL=http://127.0.0.1:8000/ SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... npx vitest run tests/db
```

Convenciones de código y del sistema de diseño: [CLAUDE.md](CLAUDE.md). Plan funcional y fases: [PLAN.md](PLAN.md).
