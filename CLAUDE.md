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

- La UI llama **siempre** a `api` (`@/data/api`), nunca a Supabase directo.

## Capa de datos por módulos

```
src/data/
  api.ts            Api = ApiNucleo (sesion, dashboard, busqueda, cotizaciones) & contratos de módulo
  supabaseApi.ts    real: componer(núcleo, clientesSupabase, …)   ← solo orquestador
  demo/apiDemo.ts   vista previa: componer(núcleo, clientesDemo, …) ← solo orquestador
  comun/            componer.ts (falla si dos módulos definen el mismo espacio) y real.ts
                    (supabase(), revisar(), mensajeError(), limpio(), hoyLocal() en zona de Guadalajara…)
  modulos/<modulo>/ contrato.ts (interfaz Api<Modulo> + tipos, con JSDoc) · supabase.ts · demo.ts · demo.test.ts
  demo/             almacen.ts (tablas en memoria), semilla*.ts (datos ficticios), reglas.ts (triggers simulados),
                    sesion.ts (permisos de la vista previa), paraPruebas.ts
```

| Módulo | Espacios de `api` | Pantallas (`src/features/…`) |
|---|---|---|
| clientes | `clientes` (incl. `buscar`, `crear`, listas de precio, `inactivos`), `contactos`, `actividades` | `clientes/` |
| embudo | `oportunidades` | `embudo/` |
| pedidos | `pedidos` (eventos, facturación), `archivos` (diseños y aprobaciones) | `pedidos/` |
| produccion | `produccion` (tablero y órdenes **sin precios**) | `produccion/` |
| pagos | `pagos`, `cobranza`, `caja` (corte), `comisiones` | `pagos/` |
| inventario | `materiales`, `inventario` (movimientos), `proveedores`, `gastos` | `inventario/` |
| agenda | `tareas`, `agenda` (calendario agregado) | `agenda/` |
| reportes | `reportes` | `reportes/` |
| administracion | `configuracion` (logo), `plantillas`, `usuarios` (función `admin-usuarios`), `bitacora` | `usuarios/`, `configuracion/` |
| catalogo | `catalogo` (productos, categorías, costos, precios por lista) | `catalogo/`, `calculadora/` |
| portal | `portal` (enlaces y vista pública sin sesión) | `portal/` (ruta pública `/portal/:token`) |

**Reglas para los agentes de módulo** (las revisa `src/data/modulos/estructura.test.ts`):
- Cada módulo edita **solo** `src/data/modulos/<modulo>/` y `src/features/<modulo>/`. Un método nuevo va en su `contrato.ts` (con JSDoc en español) y se implementa en su `supabase.ts` **y** su `demo.ts`, con prueba en `demo.test.ts`.
- Un módulo no importa archivos de otro módulo. `supabase.ts`/`contrato.ts` nunca importan `data/demo`; `demo.ts`/`contrato.ts` nunca importan Supabase.
- Lo compartido (`api.ts`, núcleo, `tipos.ts`, `comun/`, `demo/almacen.ts`/semillas/reglas, `app/rutas.tsx`, `app/navegacion.ts`, `components/`, `lib/`) se pide al orquestador.
- Real: `revisar(await …)` para lanzar errores en español con `mensajeError`; los permisos los aplica la base (RLS/RPC, error 42501). Los tipos generados de RPC que devuelven tablas marcan columnas como no nulas aunque puedan serlo: decláralas `| null` en el contrato.
- Las páginas ya existen como stubs (`ModuloPendiente`) y sus rutas ya están en `rutas.tsx` (los módulos con pestañas usan `/*` y `secciones` en `MODULOS`); el agente solo reemplaza sus páginas. El flag `pendiente` de `MODULOS` lo quita el orquestador.
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
- **`cn()` y tamaños de letra**: un `text-<tamaño>` posterior elimina un `leading-*` anterior (los tamaños traen su interlineado). Pon `leading-*` **después** del tamaño, sobre todo con `.glass-text` y cifras grandes. Las escalas propias (`text-hero`, `rounded-sheet`, `shadow-glass`…) están registradas en `src/lib/utils.ts`; si agregas una al tema, regístrala ahí.
- **Áreas táctiles**: la variante `pointer-coarse:` agranda controles solo en pantallas táctiles (p. ej. `h-9 pointer-coarse:h-11`).
- Textos: verbos claros en botones ("Guardar cotización", no "Enviar"), errores que dicen qué pasó y cómo resolverlo, sin MAYÚSCULAS sostenidas.
- Estados vacíos con `EstadoVacio`; carga con `Skeleton`; estados con `Pildora` y `ESTADO_COTIZACION` / `ESTADO_PEDIDO` de `@/lib/estados`.

## Vista previa (demo)

`VITE_DEMO=true` usa `HashRouter` y `data/demo/apiDemo.ts`: datos ficticios en memoria, nunca escribe en Supabase. El aviso "Vista previa con datos ficticios" debe permanecer visible.

- **Almacén central** (`src/data/demo/almacen.ts`): tablas en memoria con la forma de las Row de `database.types.ts`, sembradas por `semilla*.ts` con fechas relativas a hoy. Todos los `modulos/<m>/demo.ts` leen y escriben ese almacén, así lo que se cobra en Pagos aparece en el pedido, el panel y los reportes.
- `reglas.ts` imita los triggers/funciones de la base (totales, saldos, existencias, corte de caja, bitácora). Exige los mismos permisos que la base con `exigir('permiso')` de `demo/sesion.ts`.
- Devuelve siempre copias (`copia()`), usa `nuevoId()` y nunca red, Supabase ni almacenamiento persistente (al recargar vuelve a la semilla). Pruebas: `entrarComo(rol)` de `demo/paraPruebas.ts` (fija el día con `vi.setSystemTime` y reinicia el almacén con `reiniciarAlmacen()`).
- Datos claramente de ejemplo (nombres y teléfonos ficticios, sin precios inventados fuera del catálogo de muestra). Si un módulo necesita más datos o una tabla nueva, se pide al orquestador.
