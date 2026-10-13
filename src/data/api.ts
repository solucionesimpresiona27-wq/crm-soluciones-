import implementacion from '@/data/implementacion'
import type { ApiAdministracion } from './modulos/administracion/contrato'
import type { ApiAgenda } from './modulos/agenda/contrato'
import type { ApiCatalogo } from './modulos/catalogo/contrato'
import type { ApiClientes } from './modulos/clientes/contrato'
import type { ApiEmbudo } from './modulos/embudo/contrato'
import type { ApiInventario } from './modulos/inventario/contrato'
import type { ApiPagos } from './modulos/pagos/contrato'
import type { ApiPedidos } from './modulos/pedidos/contrato'
import type { ApiPortal } from './modulos/portal/contrato'
import type { ApiProduccion } from './modulos/produccion/contrato'
import type { ApiReportes } from './modulos/reportes/contrato'
import type {
  BorradorCotizacion,
  CotizacionCompleta,
  CotizacionLista,
  DashboardResumen,
  EstadoCotizacion,
  ResultadoBusqueda,
  Rol,
  SesionUsuario,
} from './tipos'

/**
 * NÚCLEO del acceso a datos: sesión, panel, búsqueda global y cotizaciones.
 * Lo mantiene el orquestador (lo usan todas las pantallas).
 */
export interface ApiNucleo {
  sesion: {
    actual(): Promise<SesionUsuario | null>
    iniciar(email: string, password: string): Promise<void>
    /** Solo vista previa: entrar con un rol de ejemplo */
    iniciarDemo?(rol: Rol): Promise<void>
    cerrar(): Promise<void>
    recuperar(email: string): Promise<void>
    nuevaContrasena(password: string): Promise<void>
    alCambiar(cb: () => void): () => void
  }
  dashboard: { resumen(): Promise<DashboardResumen> }
  busqueda: { global(texto: string): Promise<ResultadoBusqueda> }
  cotizaciones: {
    listar(): Promise<CotizacionLista[]>
    obtener(id: string): Promise<CotizacionCompleta>
    guardar(borrador: BorradorCotizacion): Promise<{ id: string; folio: string }>
    cambiarEstado(id: string, estado: EstadoCotizacion, motivo?: string): Promise<void>
    duplicar(id: string): Promise<string>
    convertir(id: string, opciones: { fechaEntrega?: string | null; titulo?: string | null }): Promise<{ pedidoId: string }>
    eliminar(id: string): Promise<void>
    /** Sube el PDF y devuelve un enlace temporal para compartir */
    compartirPdf(id: string, folio: string, pdf: Blob, diasVigencia: number): Promise<string | null>
  }
}

/**
 * Contrato completo de acceso a datos: el núcleo más un contrato por módulo
 * (`src/data/modulos/<modulo>/contrato.ts`). La app usa siempre `api`; en la vista previa se
 * sustituye por datos ficticios en memoria que nunca tocan la base real.
 *
 * Espacios de cada módulo (un espacio pertenece a un solo módulo):
 *   clientes        api.clientes, api.contactos, api.actividades
 *   embudo          api.oportunidades
 *   pedidos         api.pedidos, api.archivos
 *   produccion      api.produccion
 *   pagos           api.pagos, api.cobranza, api.caja, api.comisiones
 *   inventario      api.materiales, api.inventario, api.proveedores, api.gastos
 *   agenda          api.tareas, api.agenda
 *   reportes        api.reportes
 *   administracion  api.configuracion, api.plantillas, api.usuarios, api.bitacora
 *   catalogo        api.catalogo
 *   portal          api.portal
 */
export type Api = ApiNucleo &
  ApiClientes &
  ApiEmbudo &
  ApiPedidos &
  ApiProduccion &
  ApiPagos &
  ApiInventario &
  ApiAgenda &
  ApiReportes &
  ApiAdministracion &
  ApiCatalogo &
  ApiPortal

/** Real (Supabase) o vista previa (en memoria), según VITE_DEMO al compilar. Ver vite.config.ts. */
export const api: Api = implementacion
