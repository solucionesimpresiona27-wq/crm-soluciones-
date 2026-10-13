import type { Database, Tables } from '@/lib/database.types'

type Enums = Database['public']['Enums']

export type Rol = Enums['rol_usuario']
export type EstadoCotizacion = Enums['estado_cotizacion']
export type EstadoPedido = Enums['estado_pedido']
export type MetodoPago = Enums['metodo_pago']
export type TipoPartida = Enums['tipo_partida']
export type MetodoCalculo = Enums['metodo_calculo']

export const PERMISOS = [
  'ver_precios',
  'ver_costos',
  'ver_reportes',
  'gestionar_clientes',
  'gestionar_cotizaciones',
  'gestionar_pedidos',
  'actualizar_produccion',
  'aprobar_disenos',
  'registrar_pagos',
  'cancelar_pagos',
  'editar_catalogo',
  'exportar_datos',
  'eliminar_registros',
] as const

export type Permiso = (typeof PERMISOS)[number]
export type Permisos = Record<Permiso, boolean>

export type Perfil = Tables<'perfiles'>
export type Configuracion = Tables<'configuracion'>
export type Plantilla = Tables<'plantillas_mensaje'>

export interface SesionUsuario {
  id: string
  email: string
  perfil: Perfil
  permisos: Permisos
}

export interface ClienteBreve {
  id: string
  nombre: string
  whatsapp: string | null
  telefono: string | null
  email: string | null
  requiere_factura?: boolean
}

export interface ProductoCatalogo {
  id: string
  nombre: string
  descripcion: string | null
  metodo_calculo: MetodoCalculo
  unidad: string
  precio_venta: number | null
  precio_minimo: number | null
  escalas: { desde: number; precio: number }[]
  categoria: { id: string; nombre: string; grupo: string } | null
  /** Solo con permiso ver_costos */
  costos: {
    costo_material: number
    costo_mano_obra: number
    costo_fijo: number
    desperdicio_pct: number
    ganancia_pct: number
  } | null
}

export interface CotizacionLista {
  id: string
  folio: string
  titulo: string | null
  fecha: string
  fecha_vencimiento: string
  estado: EstadoCotizacion
  total: number
  pedido_id: string | null
  enviada_at: string | null
  created_at: string
  cliente: { id: string; nombre: string; whatsapp: string | null; telefono: string | null }
  vendedor: { nombre: string } | null
}

export interface CostosPartida {
  costo_material: number
  costo_mano_obra: number
  costo_fijo: number
  desperdicio_pct: number
  ganancia_pct: number
  costo_total?: number
  calculo?: Record<string, unknown>
}

export interface PartidaDoc {
  id: string
  orden: number
  tipo: TipoPartida
  producto_id: string | null
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
  notas_produccion: string | null
  costos: CostosPartida | null
}

export interface CotizacionCompleta {
  id: string
  folio: string
  titulo: string | null
  fecha: string
  vigencia_dias: number
  fecha_vencimiento: string
  estado: EstadoCotizacion
  motivo_rechazo: string | null
  tiempo_entrega: string | null
  anticipo_pct: number
  aplica_iva: boolean
  iva_pct: number
  descuento_tipo: 'monto' | 'pct'
  descuento_valor: number
  recargo_pct: number
  recargo_concepto: string
  subtotal: number
  descuento: number
  recargo: number
  iva: number
  total: number
  condiciones: string | null
  notas: string | null
  notas_internas: string | null
  pedido_id: string | null
  pedido_folio: string | null
  enviada_at: string | null
  aceptada_at: string | null
  created_at: string
  updated_at: string
  cliente: ClienteBreve & { rfc: string | null; razon_social: string | null; direccion: string | null; ciudad: string | null }
  vendedor: { id: string; nombre: string; email: string; telefono: string | null } | null
  partidas: PartidaDoc[]
}

/** Lo que el editor envía a guardar_cotizacion() */
export interface BorradorCotizacion {
  id?: string
  cliente_id: string
  titulo: string
  fecha: string
  vigencia_dias: number
  tiempo_entrega: string
  anticipo_pct: number
  aplica_iva: boolean
  iva_pct: number
  descuento_tipo: 'monto' | 'pct'
  descuento_valor: number
  recargo_pct: number
  recargo_concepto: string
  condiciones: string
  notas: string
  notas_internas: string
  partidas: Array<Omit<PartidaDoc, 'importe' | 'orden'>>
}

export interface EntregaProxima {
  id: string
  folio: string
  titulo: string
  estado: EstadoPedido
  prioridad: Enums['prioridad']
  fecha_entrega: string
  cliente: string
  requiere_instalacion?: boolean
}

export interface DashboardResumen {
  hoy: string
  pedidos_por_estado: Partial<Record<EstadoPedido, number>>
  pedidos_activos: number
  pedidos_atrasados: number
  pedidos_pausados: number
  entregas_proximas: EntregaProxima[]
  mis_pendientes: EntregaProxima[]
  disenos_pendientes: number
  cotizaciones_abiertas?: { cantidad: number; total: number }
  cotizaciones_por_vencer?: Array<{ id: string; folio: string; titulo: string | null; total: number; fecha_vencimiento: string; cliente: string }>
  tasa_cierre_90d?: number | null
  ventas_mes?: number
  ventas_mes_anterior?: number
  cobrado_mes?: number
  por_cobrar?: { total: number; pedidos: number }
  pagos_vencidos?: { total: number; pedidos: number }
  serie_mensual?: Array<{ mes: string; ventas: number; cobrado: number }>
  utilidad_estimada_mes?: { venta: number; costo: number; utilidad: number }
  seguimientos?: Array<{
    id: string
    titulo: string
    etapa: Enums['etapa_comercial']
    proxima_accion: string | null
    proxima_accion_fecha: string
    valor_estimado: number | null
    cliente: string
    cliente_id: string
    whatsapp: string | null
  }>
  embudo?: Partial<Record<Enums['etapa_comercial'], { cantidad: number; valor: number }>>
}

export interface ResultadoBusqueda {
  clientes: Array<{ id: string; nombre: string; telefono: string | null; email: string | null }>
  cotizaciones: Array<{ id: string; folio: string; titulo: string | null; estado: EstadoCotizacion; total: number; cliente: string }>
  pedidos: Array<{ id: string; folio: string; titulo: string; estado: EstadoPedido; cliente: string }>
}
