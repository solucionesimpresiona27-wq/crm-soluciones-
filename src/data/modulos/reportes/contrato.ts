/**
 * MÓDULO REPORTES · contrato de datos.
 * Espacio: `api.reportes`.
 *
 * Criterios (iguales a la base de datos):
 *   * vendido  = total de pedidos no cancelados, por fecha de alta del pedido.
 *   * cobrado  = pagos no cancelados menos devoluciones, por fecha del pago.
 *   * cotizado = cotizaciones enviadas, aceptadas o rechazadas, por fecha de la cotización.
 * Permisos: `ver_reportes`; la utilidad además `ver_costos`. Para cuentas por cobrar,
 * comisiones y clientes por reactivar usa `api.cobranza`, `api.comisiones` y `api.clientes.inactivos`.
 */
import type { Database } from '@/lib/database.types'

type Enums = Database['public']['Enums']
export type Agrupacion = 'dia' | 'semana' | 'mes'

export interface VentasPeriodo {
  /** Primer día del periodo (AAAA-MM-DD) */
  periodo: string
  vendido: number
  pedidos: number
  cobrado: number
  cotizado: number
  cotizaciones: number
}

export interface ProductoVendido {
  /** null para conceptos sin producto del catálogo (se agrupan por tipo) */
  producto_id: string | null
  producto: string
  categoria: string | null
  tipo: string | null
  unidad: string | null
  cantidad: number
  /** m², metros lineales o piezas según el método */
  unidades: number
  importe: number
  pedidos: number
}

export interface DesempenoVendedor {
  vendedor_id: string | null
  nombre: string
  cotizaciones: number
  cotizado: number
  aceptadas: number
  rechazadas: number
  /** % de aceptadas entre aceptadas y rechazadas; null sin cerradas */
  tasa_cierre: number | null
  pedidos: number
  vendido: number
  cobrado: number
  ticket_promedio: number | null
}

export interface MejorCliente {
  cliente_id: string
  nombre: string
  whatsapp: string | null
  pedidos: number
  vendido: number
  cobrado: number
  saldo: number
  ticket_promedio: number
  ultima_compra: string | null
}

/** Utilidad por pedido. Venta sin IVA; costo real = gastos ligados + consumos × costo actual. */
export interface UtilidadPedido {
  pedido_id: string
  folio: string
  titulo: string
  cliente_id: string
  cliente: string
  vendedor_id: string | null
  estado: Enums['estado_pedido']
  estado_pago: Enums['estado_pago']
  fecha: string
  venta: number
  costo_estimado: number
  gastos: number
  consumo_material: number
  costo_real: number
  utilidad_estimada: number
  utilidad_real: number
  margen_estimado_pct: number | null
  margen_real_pct: number | null
  /** Consumos de materiales sin costo capturado (la utilidad real sale más alta) */
  consumos_sin_costo: number
}

export interface ApiReportes {
  reportes: {
    /** Serie por día (hasta 400 días), semana o mes. Fechas AAAA-MM-DD. */
    ventas(desde: string, hasta: string, agrupar?: Agrupacion): Promise<VentasPeriodo[]>
    /** Productos más vendidos por importe. */
    productos(desde: string, hasta: string, limite?: number): Promise<ProductoVendido[]>
    /** Cotizaciones, tasa de cierre, ventas y cobranza por vendedor. */
    vendedores(desde: string, hasta: string): Promise<DesempenoVendedor[]>
    /** Mejores clientes por lo vendido en el periodo. */
    clientes(desde: string, hasta: string, limite?: number): Promise<MejorCliente[]>
    /** Utilidad estimada y real por pedido. Requiere `ver_reportes` y `ver_costos`. */
    utilidad(desde: string, hasta: string): Promise<UtilidadPedido[]>
  }
}
