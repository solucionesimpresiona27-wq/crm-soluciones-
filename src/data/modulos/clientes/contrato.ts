/**
 * MÓDULO CLIENTES · contrato de datos.
 * Espacios: `api.clientes`, `api.contactos`, `api.actividades`.
 *
 * Permisos (los aplica la base de datos; la vista previa los imita):
 *   * Ver clientes y contactos: cualquier usuario activo.
 *   * Crear o editar clientes y contactos, ver y registrar actividades: `gestionar_clientes`.
 *   * Eliminar un cliente: `eliminar_registros` (si tiene cotizaciones o pedidos, mejor desactivarlo).
 *   * Montos del historial y del resumen: solo con `ver_precios`.
 */
import type { ClienteBreve, EstadoCotizacion, EstadoPedido, MetodoPago } from '@/data/tipos'
import type { Database, Tables } from '@/lib/database.types'

type Enums = Database['public']['Enums']

export type ListaPrecio = Enums['lista_precio']
export type TipoCliente = 'persona' | 'empresa'
export type TipoActividad = 'nota' | 'llamada' | 'whatsapp' | 'correo' | 'visita' | 'reunion'

export const LISTAS_PRECIO: Record<ListaPrecio, string> = {
  publico: 'Público',
  mayoreo: 'Mayoreo',
  agencia: 'Agencia / revendedor',
}

export const TIPOS_ACTIVIDAD: Record<TipoActividad, string> = {
  nota: 'Nota',
  llamada: 'Llamada',
  whatsapp: 'WhatsApp',
  correo: 'Correo',
  visita: 'Visita',
  reunion: 'Reunión',
}

/** Ficha completa del cliente (fila de `clientes` sin la columna interna `busqueda`). */
export type Cliente = Omit<Tables<'clientes'>, 'busqueda'> & {
  vendedor: { id: string; nombre: string } | null
}

/** Renglón de la lista de clientes. */
export interface ClienteLista {
  id: string
  nombre: string
  tipo: string
  whatsapp: string | null
  telefono: string | null
  email: string | null
  ciudad: string | null
  etiquetas: string[]
  lista_precio: ListaPrecio
  requiere_factura: boolean
  dias_credito: number
  activo: boolean
  vendedor_id: string | null
  vendedor: string | null
  ultima_compra_at: string | null
  created_at: string
}

export interface FiltrosClientes {
  /** Busca en nombre, teléfonos, correo, RFC y razón social (sin acentos) */
  texto?: string
  etiqueta?: string
  vendedorId?: string
  lista?: ListaPrecio
  /** Por omisión solo activos */
  incluirInactivos?: boolean
  /** Máximo de renglones (500 por omisión) */
  limite?: number
}

/** Datos que se capturan en el formulario del cliente. Texto vacío se guarda como nulo. */
export interface DatosCliente {
  nombre: string
  tipo?: TipoCliente
  telefono?: string | null
  whatsapp?: string | null
  email?: string | null
  direccion?: string | null
  ciudad?: string | null
  notas?: string | null
  etiquetas?: string[]
  origen?: string | null
  requiere_factura?: boolean
  rfc?: string | null
  razon_social?: string | null
  regimen_fiscal?: string | null
  codigo_postal_fiscal?: string | null
  uso_cfdi?: string | null
  email_facturacion?: string | null
  dias_credito?: number
  vendedor_id?: string | null
  lista_precio?: ListaPrecio
}

/** Totales del cliente (función resumen_cliente). Los montos solo llegan con `ver_precios`. */
export interface ResumenCliente {
  pedidos: number
  pedidos_activos: number
  cotizaciones: number
  ultima_compra: string | null
  total_comprado?: number
  total_pagado?: number
  saldo?: number
  cotizado_abierto?: number
}

/** Historial del cliente. Sin `ver_precios`: cotizaciones y pagos vacíos y pedidos sin montos. */
export interface HistorialCliente {
  cotizaciones: Array<{ id: string; folio: string; titulo: string | null; fecha: string; estado: EstadoCotizacion; total: number; pedido_id: string | null }>
  pedidos: Array<{
    id: string
    folio: string
    titulo: string
    estado: EstadoPedido
    estado_pago: Enums['estado_pago']
    fecha_entrega: string | null
    created_at: string
    total: number | null
    saldo: number | null
  }>
  pagos: Array<{ id: string; pedido_id: string; folio: string; fecha: string; importe: number; tipo: Enums['tipo_pago']; metodo: MetodoPago; cancelado: boolean }>
}

export type Contacto = Tables<'contactos'>

export interface DatosContacto {
  nombre: string
  puesto?: string | null
  telefono?: string | null
  whatsapp?: string | null
  email?: string | null
  /** Al marcar uno como principal se desmarcan los demás del mismo cliente */
  principal?: boolean
  notas?: string | null
}

/** Actividad comercial (llamada, WhatsApp, visita…) con nombres para mostrar. */
export type Actividad = Tables<'actividades'> & { usuario: string | null; oportunidad: string | null }

export interface NuevaActividad {
  cliente_id: string
  oportunidad_id?: string | null
  tipo: TipoActividad
  descripcion: string
  /** ISO; ahora por omisión */
  fecha?: string
}

/** Cliente sin compras recientes (función clientes_inactivos). `total_comprado` es nulo sin `ver_precios`. */
export interface ClienteInactivo {
  cliente_id: string
  nombre: string
  whatsapp: string | null
  telefono: string | null
  email: string | null
  etiquetas: string[]
  ultima_compra: string
  dias_sin_compra: number
  pedidos: number
  total_comprado: number | null
  vendedor_id: string | null
  vendedor: string | null
}

export interface ApiClientes {
  clientes: {
    /** Búsqueda rápida de clientes ACTIVOS (selector del editor de cotizaciones). Máximo 20, por nombre. */
    buscar(texto: string): Promise<ClienteBreve[]>
    /** Alta rápida o completa. Requiere `gestionar_clientes`. */
    crear(datos: DatosCliente): Promise<ClienteBreve>
    /** Lista con filtros, ordenada por nombre. */
    listar(filtros?: FiltrosClientes): Promise<ClienteLista[]>
    /** Ficha completa. */
    obtener(id: string): Promise<Cliente>
    /** Cambia solo los campos enviados. Requiere `gestionar_clientes`. */
    actualizar(id: string, cambios: Partial<DatosCliente>): Promise<Cliente>
    /** Activa o desactiva (los inactivos no salen en búsquedas ni en reactivación). */
    activar(id: string, activo: boolean): Promise<void>
    /** Elimina definitivamente. Requiere `eliminar_registros`; falla si tiene cotizaciones o pedidos. */
    eliminar(id: string): Promise<void>
    /** Conteos y montos del cliente. */
    resumen(id: string): Promise<ResumenCliente>
    /** Cotizaciones, pedidos y pagos del cliente (lo más reciente primero). */
    historial(id: string): Promise<HistorialCliente>
    /** Etiquetas en uso (para sugerirlas en el formulario y filtrar). */
    etiquetas(): Promise<string[]>
    /** Asigna la lista de precios (público, mayoreo o agencia). Requiere `gestionar_clientes`. */
    asignarListaPrecio(id: string, lista: ListaPrecio): Promise<void>
    /**
     * Clientes para reactivar: sin compras desde hace `dias` (por omisión, los días de la
     * configuración). Requiere `gestionar_clientes`.
     */
    inactivos(dias?: number): Promise<ClienteInactivo[]>
  }
  contactos: {
    /** Contactos del cliente, el principal primero. */
    listar(clienteId: string): Promise<Contacto[]>
    crear(clienteId: string, datos: DatosContacto): Promise<Contacto>
    actualizar(id: string, cambios: Partial<DatosContacto>): Promise<Contacto>
    eliminar(id: string): Promise<void>
  }
  actividades: {
    /** Historial de seguimiento, lo más reciente primero. Requiere `gestionar_clientes`. */
    listar(filtros: { clienteId?: string; oportunidadId?: string; limite?: number }): Promise<Actividad[]>
    /** Registra una actividad a nombre de quien tiene la sesión. Requiere `gestionar_clientes`. */
    registrar(datos: NuevaActividad): Promise<Actividad>
    /** Solo la propia o administración. */
    eliminar(id: string): Promise<void>
  }
}
