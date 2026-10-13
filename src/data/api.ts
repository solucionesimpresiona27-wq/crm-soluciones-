import { DEMO } from '@/lib/supabase'
import { apiDemo } from './demo/apiDemo'
import { apiSupabase } from './supabaseApi'
import type {
  BorradorCotizacion,
  ClienteBreve,
  Configuracion,
  CotizacionCompleta,
  CotizacionLista,
  DashboardResumen,
  EstadoCotizacion,
  Perfil,
  Plantilla,
  ProductoCatalogo,
  ResultadoBusqueda,
  Rol,
  SesionUsuario,
} from './tipos'

/**
 * Contrato de acceso a datos. La app usa siempre `api`; en la vista previa se
 * sustituye por datos ficticios en memoria que nunca tocan la base real.
 */
export interface Api {
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
  configuracion: { obtener(): Promise<Configuracion> }
  plantillas: { listar(): Promise<Plantilla[]> }
  usuarios: { equipo(): Promise<Pick<Perfil, 'id' | 'nombre' | 'rol' | 'email' | 'telefono'>[]> }
  dashboard: { resumen(): Promise<DashboardResumen> }
  busqueda: { global(texto: string): Promise<ResultadoBusqueda> }
  clientes: {
    buscar(texto: string): Promise<ClienteBreve[]>
    crear(datos: { nombre: string; whatsapp?: string; email?: string; tipo?: 'persona' | 'empresa'; requiere_factura?: boolean; rfc?: string; razon_social?: string }): Promise<ClienteBreve>
  }
  catalogo: { productos(): Promise<ProductoCatalogo[]> }
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

export const api: Api = DEMO ? apiDemo : apiSupabase
