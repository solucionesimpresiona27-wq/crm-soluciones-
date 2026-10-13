# CRM Soluciones Impresiona

CRM web para una imprenta/agencia de publicidad en Guadalajara (México). Interfaz en **español de México**.
Plan funcional completo en `PLAN.md`.

## Stack

- React 19 + TypeScript + Vite 7, Tailwind CSS 3.4, React Router 7 (modo librería), TanStack Query 5.
- **Motion for React** (`motion/react`, nunca `framer-motion`) para animaciones. Ver `.claude/skills/motion/`.
- Radix UI (dialog, dropdown, tooltip…) + `cmdk`, `sonner` (avisos), `lucide-react` (íconos), `date-fns` (es).
- Supabase (Postgres + Auth + Storage). Migraciones en `supabase/migrations/`, función de usuarios en `supabase/functions/admin-usuarios/`.
- No agregues dependencias sin justificarlo.

## Comandos

- `npm run dev`: app real (requiere `.env.local` con Supabase). `VITE_DEMO=true npm run dev`: vista previa con datos ficticios.
- `npm run typecheck` · `npm test` (unitarias) · pruebas de BD: `tests/db/` (requieren `supabase start`).
- `supabase db reset` aplica migraciones; `npm run db:types` regenera `src/lib/database.types.ts`.

## Arquitectura

```
src/
  app/            proveedores (tema, sesión), rutas, navegación (MODULOS), consultas comunes
  components/
    glass/        Impresiona Glass Design System (usa SIEMPRE estos componentes)
    shell/        menú lateral, barra superior, navegación móvil, paleta de comandos
  data/           api.ts (contrato), supabaseApi.ts (real), demo/ (vista previa en memoria), tipos.ts
  features/<mod>/ páginas y componentes de cada módulo (+ consultas.ts con hooks de TanStack Query)
  lib/            calculadora, formato, estados, whatsapp, permisos, motion (resortes)
  styles/         tokens y material de cristal (index.css)
```

- La UI llama **siempre** a `api` (`@/data/api`), nunca a Supabase directo. Si agregas un método, impleméntalo en `supabaseApi.ts` **y** en `demo/apiDemo.ts`.
- Permisos: `useSesion().puede('ver_costos')`. La seguridad real está en la base de datos (RLS); la UI solo oculta.
- Montos en MXN con `dinero()` de `@/lib/format`; cifras con la clase `num` (tabulares).
- Inserciones masivas con supabase-js: usa `{ defaultToNull: false }` o envía todos los campos.

## Impresiona Glass Design System (obligatorio)

Estética Liquid Glass (Centro de Control de Apple) con la marca: azul `#22426B` y amarillo `#F9C206` del logo.

- **Material**: `GlassSurface` / clases `.glass`, `.glass-strong` (contenido con datos), `.glass-clear`, `.glass-thick` (controles), `.glass-lens` (refracción, solo Chromium). Nunca inventes otro estilo de tarjeta.
- **Jerarquía de radios**: `rounded-sheet` (paneles, 32px) > `rounded-module` (widgets, 28px) > `rounded-tile` (22px) > `rounded-control` (campos, 16px) > `rounded-full` (botones, cápsulas).
- **Botones**: `GlassButton` (cápsula; `primario` = azul, `luz` = amarillo, `cristal`, `fantasma`, `peligro`), `GlassIconButton` (círculo tipo Centro de Control; `activo` + `tono="luz"|"acento"`), `GlassToggle` (cápsula con pozo de ícono), `SegmentedControl` (indicador deslizante).
- **"Luz" amarilla** = encendido/destacado/pendiente importante. **Azul** = acción principal. No uses otros colores de acento.
- **Legibilidad**: tablas, formularios y precios van sobre `GlassPanel` (cristal fuerte). Texto con `text-fg`, `text-fg-muted`, `text-fg-subtle`.
- **Movimiento**: resortes de `@/lib/motion` (`resorte.presion`, `agil`, `suave`, `expansion`, `modal`). Anima `transform` y `opacity`; nunca `width`/`height`/`top` en bucles. Respeta `useReducedMotion()`. Una sola entrada orquestada por pantalla; nada de animar cada tarjeta por animar.
- **Motion + transform de Tailwind**: Motion reemplaza `transform`. No combines clases `-translate-*` con animaciones `x/y/scale` en el mismo elemento; usa un contenedor para posicionar.
- **Accesibilidad**: foco visible, `aria-label` en botones de solo ícono, contraste AA sobre cristal, áreas táctiles ≥ 44px.
- **Responsive**: celular con barra inferior y hojas desde abajo (`GlassModal` lo hace solo); escritorio con menú lateral y cuadrículas.
- Textos: verbos claros en botones ("Guardar cotización", no "Enviar"), errores que dicen qué pasó y cómo resolverlo, sin MAYÚSCULAS sostenidas.
- Estados vacíos con `EstadoVacio`; carga con `Skeleton`; estados con `Pildora` y `ESTADO_COTIZACION` / `ESTADO_PEDIDO` de `@/lib/estados`.

## Vista previa (demo)

`VITE_DEMO=true` usa `HashRouter` y `data/demo/apiDemo.ts`: datos ficticios en memoria, nunca escribe en Supabase. El aviso "Vista previa con datos ficticios" debe permanecer visible.
