/**
 * MÓDULO PORTAL DEL CLIENTE · contrato de datos.
 * Espacio: `api.portal`.
 *
 * Dos partes:
 *   * CRM (con sesión): crear, listar y revocar enlaces privados de una cotización o pedido.
 *     Requiere `ver_precios` y, según el tipo, `gestionar_cotizaciones` o `gestionar_pedidos`.
 *   * Público (ruta /portal/:token, SIN sesión): el cliente ve su documento, aprueba la
 *     cotización y aprueba o pide cambios a los diseños. En la app real estas llamadas van
 *     como "anon" con un cliente de Supabase sin sesión; nunca llevan la sesión del equipo.
 * Un enlace inválido, vencido o revocado da siempre el mismo error (no revela si existe).
 * Revocar el enlace de un pedido no revoca el de la cotización de la que salió: la pantalla
 * debe listar y revocar ambos (`enlaces({ pedidoId })` ya los incluye).
 */
import type { EstadoCotizacion, EstadoPedido, MetodoCalculo, TipoPartida } from '@/data/tipos'
import type { Database, Tables } from '@/lib/database.types'

type Enums = Database['public']['Enums']
export type TipoEnlace = 'cotizacion' | 'pedido'

/** Mensaje único para enlaces inválidos, vencidos o revocados. */
export const ENLACE_NO_VALIDO = 'Este enlace ya no está disponible. Pide uno nuevo a Soluciones Impresiona.'

/** La cotización cambió entre que el cliente la abrió y la aprobó (mismo texto que la base). */
export const COTIZACION_ACTUALIZADA =
  'Tu asesor actualizó esta cotización mientras la revisabas. Revisa la versión actual y vuelve a aprobarla.'

export interface EnlacePortal {
  id: string
  tipo: TipoEnlace
  cotizacion_id: string | null
  pedido_id: string | null
  /** Folio del documento (COT-0001 / PED-0044) */
  folio: string
  token: string
  /** Enlace listo para compartir por WhatsApp */
  url: string
  expira_at: string
  revocado: boolean
  revocado_at: string | null
  vistas: number
  ultimo_acceso_at: string | null
  created_by: string | null
  creado_por: string | null
  created_at: string
  /** No revocado y sin vencer */
  vigente: boolean
}

export type RespuestaPortal = Tables<'portal_respuestas'>

/** Concepto visible para el cliente (sin costos ni notas de producción). */
export interface PartidaPortal {
  orden: number
  tipo: TipoPartida
  concepto: string
  descripcion: string | null
  metodo_calculo: MetodoCalculo
  unidad: string
  ancho: number | null
  alto: number | null
  largo: number | null
  cantidad: number
  precio_unitario: number
  descuento_pct: number
  importe: number
}

export interface DisenoPortal {
  id: string
  nombre: string
  version: number | null
  estado_aprobacion: Enums['estado_archivo']
  mime: string | null
  tiene_archivo: boolean
  /** Solo enlaces http(s) */
  enlace_externo: string | null
  created_at: string
  aprobado_por_nombre: string | null
  aprobacion_at: string | null
  puede_responder: boolean
}

/** Lo que ve el cliente (función portal_obtener). */
export interface VistaPortal {
  tipo: TipoEnlace
  expira_at: string
  empresa: {
    nombre: string
    eslogan?: string
    ciudad?: string
    direccion?: string
    telefono?: string
    whatsapp?: string
    email?: string
    sitio_web?: string
    instagram?: string
    facebook?: string
    tiktok?: string
    logo_url?: string
    color_primario?: string
    color_secundario?: string
    datos_bancarios?: string
    /** Solo si la configuración permite mostrar datos fiscales */
    rfc?: string
    razon_social?: string
    regimen_fiscal?: string
  }
  cotizacion?: {
    folio: string
    titulo: string | null
    fecha: string
    fecha_vencimiento: string
    vigente: boolean
    estado: EstadoCotizacion
    cliente: string
    contacto: string | null
    vendedor: string | null
    tiempo_entrega: string | null
    anticipo_pct: number
    anticipo: number
    aplica_iva: boolean
    iva_pct: number
    subtotal: number
    descuento: number
    recargo_pct: number
    recargo_concepto: string
    recargo: number
    iva: number
    total: number
    condiciones: string | null
    notas: string | null
    enviada_at: string | null
    aceptada_at: string | null
    puede_aprobar: boolean
    aprobacion: { nombre: string; fecha: string } | null
    partidas: PartidaPortal[]
    /** Huella de lo que ve el cliente (conceptos, precios, totales, condiciones). Se manda al aprobar. */
    version: string
  }
  pedido?: {
    folio: string
    titulo: string
    estado: EstadoPedido
    estado_pago: Enums['estado_pago']
    cliente: string
    fecha_entrega: string | null
    requiere_instalacion: boolean
    created_at: string
    entregado_at: string | null
    anticipo_pct: number
    subtotal: number
    descuento: number
    recargo: number
    iva: number
    total: number
    pagado: number
    saldo: number
    condiciones: string | null
    /** Etapas que recorre este pedido (sin las omitidas) */
    etapas: EstadoPedido[]
    linea_tiempo: Array<{ estado: EstadoPedido; fecha: string }>
    partidas: PartidaPortal[]
    disenos: DisenoPortal[]
  }
}

export interface ArchivoPortal {
  id: string
  nombre: string
  version: number | null
  mime: string | null
  /** URL temporal (10 minutos) */
  url: string
  expira_en: number
}

export interface ApiPortal {
  portal: {
    // ---- CRM (con sesión) ----
    /** Enlaces de una cotización, o de un pedido más los de la cotización de la que salió. */
    enlaces(filtros: { cotizacionId?: string; pedidoId?: string }): Promise<EnlacePortal[]>
    /** Reutiliza el enlace vigente salvo `nuevo: true`. Vigencia de 1 a 180 días (30 por omisión). */
    crearEnlace(tipo: TipoEnlace, id: string, opciones?: { dias?: number; nuevo?: boolean }): Promise<EnlacePortal & { nuevo: boolean }>
    revocarEnlace(id: string): Promise<void>
    /** Aprobaciones y cambios pedidos por el cliente desde el portal (evidencia). */
    respuestas(filtros: { cotizacionId?: string; pedidoId?: string }): Promise<RespuestaPortal[]>
    /** URL pública del portal para un token. */
    urlPublica(token: string): string
    // ---- Público (sin sesión) ----
    obtener(token: string): Promise<VistaPortal>
    /**
     * Aprueba la versión que vio el cliente (`version` de `obtener`). Si el asesor la cambió
     * mientras tanto, falla con `COTIZACION_ACTUALIZADA`. Nombre de 2 a 120 caracteres; comentario hasta 1000.
     */
    aprobarCotizacion(token: string, version: string, nombre: string, comentario?: string): Promise<{ ok: true; folio: string; estado: EstadoCotizacion }>
    /** Pedir cambios exige comentario. */
    responderDiseno(
      token: string,
      archivoId: string,
      aprobado: boolean,
      nombre: string,
      comentario?: string,
    ): Promise<{ ok: true; archivo_id: string; version: number | null; estado_aprobacion: Enums['estado_archivo']; estado_pedido: EstadoPedido }>
    /** Enlaces temporales de los diseños con archivo (función de servidor portal-cliente). */
    archivos(token: string, archivoId?: string): Promise<ArchivoPortal[]>
  }
}
