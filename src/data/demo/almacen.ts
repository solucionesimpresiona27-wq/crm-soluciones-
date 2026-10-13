/**
 * ALMACÉN CENTRAL de la vista previa (VITE_DEMO=true).
 *
 * Tablas en memoria con la misma forma que las de la base de datos (tipos Row de
 * `src/lib/database.types.ts`), llenas con DATOS FICTICIOS coherentes entre sí:
 * lo que se cobra en Pagos cambia el pedido, el panel y los reportes.
 *
 * Reglas:
 *   * Nada sale del navegador: no hay red, ni Supabase, ni almacenamiento persistente
 *     (al recargar la página se vuelve a la semilla; solo se recuerda el rol elegido).
 *   * Las implementaciones demo de cada módulo (`src/data/modulos/<m>/demo.ts`) leen y
 *     escriben estas tablas directamente y aplican las reglas de `./reglas.ts`
 *     (las mismas que hacen los triggers y funciones de la base de datos).
 *   * Devuelven siempre COPIAS a la interfaz (`copia()`), nunca las filas del almacén.
 *   * Para pruebas: `reiniciarAlmacen()` vuelve a la semilla (con `vi.setSystemTime` para fijar el día).
 *
 * Es código compartido: si un módulo necesita otra tabla o más datos de ejemplo, pídelo al orquestador.
 */
import type { Database, Tables } from '@/lib/database.types'
import type { Configuracion, CotizacionCompleta, Perfil, Plantilla } from '../tipos'
import { crearSemilla } from './semilla'

type NombreTabla = keyof Database['public']['Tables']
type Fila<T extends NombreTabla> = Tables<T>

export type ClienteFila = Fila<'clientes'>
export type PedidoFila = Fila<'pedidos'>
export type PartidaFila = Fila<'partidas'>
export type EnlacePortalFila = Omit<Fila<'portal_enlaces'>, 'portal_pedido_de_enlace'>

export interface Almacen {
  /** Equipo (incluye un instalador y una cuenta desactivada). El rol elegido al entrar usa el perfil `demo-<rol>`. */
  perfiles: Perfil[]
  configuracion: Configuracion
  plantillas: Plantilla[]
  clientes: ClienteFila[]
  contactos: Fila<'contactos'>[]
  oportunidades: Fila<'oportunidades'>[]
  actividades: Fila<'actividades'>[]
  categorias: Fila<'categorias'>[]
  productos: Fila<'productos'>[]
  producto_costos: Fila<'producto_costos'>[]
  producto_precios: Fila<'producto_precios'>[]
  /**
   * Cotizaciones con la forma del núcleo (cliente, vendedor y partidas incluidos), igual que
   * antes de existir el almacén. El cliente se refresca desde `clientes` al leerlas.
   */
  cotizaciones: CotizacionCompleta[]
  /** Oportunidad de cada cotización (la forma del núcleo no la incluye): cotizacion_id → oportunidad_id */
  cotizacion_oportunidad: Record<string, string>
  pedidos: PedidoFila[]
  /** Partidas de PEDIDOS (las de cotizaciones viven dentro de cada cotización). */
  partidas: PartidaFila[]
  partida_costos: Fila<'partida_costos'>[]
  pagos: Fila<'pagos'>[]
  pedido_eventos: Fila<'pedido_eventos'>[]
  archivos: Fila<'archivos'>[]
  tareas: Fila<'tareas'>[]
  proveedores: Fila<'proveedores'>[]
  materiales: Fila<'materiales'>[]
  material_costos: Fila<'material_costos'>[]
  movimientos_inventario: Fila<'movimientos_inventario'>[]
  gastos: Fila<'gastos'>[]
  cortes_caja: Fila<'cortes_caja'>[]
  portal_enlaces: EnlacePortalFila[]
  portal_respuestas: Fila<'portal_respuestas'>[]
  bitacora: Fila<'bitacora'>[]
  /** Consecutivos (como la tabla folios y las columnas identity). */
  folios: { cotizacion: number; pedido: number; evento: number; bitacora: number; respuesta: number }
}

export const almacen: Almacen = crearSemilla()

/** Vuelve a los datos de la semilla. `hoy` (AAAA-MM-DD) fija la fecha de la semilla en pruebas. */
export function reiniciarAlmacen(hoy?: string) {
  Object.assign(almacen, crearSemilla(hoy))
}

/** Copia profunda para devolver a la interfaz (nunca se entregan las filas del almacén). */
export const copia = <T>(x: T): T => structuredClone(x)

let consecutivo = 0
/** Id nuevo para registros creados en la vista previa. */
export const nuevoId = (prefijo: string) => `${prefijo}-${Date.now().toString(36)}-${(++consecutivo).toString(36)}`
