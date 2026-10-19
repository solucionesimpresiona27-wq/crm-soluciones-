/**
 * MÓDULO PAGOS · contrato de datos.
 * Espacios: `api.pagos` (cobros y comprobantes), `api.cobranza` (quién me debe),
 * `api.caja` (corte de caja diario) y `api.comisiones`.
 *
 * Permisos (los aplica la base de datos; la vista previa los imita):
 *   * Ver pagos y cuentas por cobrar: `ver_precios`. Registrar cobros y comprobantes: `registrar_pagos`.
 *   * Cancelar pagos y registrar devoluciones: `cancelar_pagos` (con motivo; nunca se borran).
 *   * Solo administración cambia importe, tipo, fecha o método de un pago ya registrado.
 *   * Caja: consultar con `registrar_pagos` o `ver_reportes`; cerrar con `registrar_pagos`;
 *     reabrir solo administración. Con la caja del día cerrada, nadie salvo administración
 *     registra o cambia movimientos EN EFECTIVO de ese día (las transferencias sí se permiten).
 *   * Comisiones (lo cobrado es un monto de venta): con `ver_precios`, cada quien ve las suyas;
 *     con `ver_reportes` (que solo vale con `ver_precios`), las de todos.
 */
import type { MetodoPago } from '@/data/tipos'
import type { Database, Tables } from '@/lib/database.types'

type Enums = Database['public']['Enums']
export type TipoPago = Enums['tipo_pago']
export type EstadoPago = Enums['estado_pago']

export const TIPOS_PAGO: Record<TipoPago, string> = {
  anticipo: 'Anticipo',
  abono: 'Abono',
  liquidacion: 'Liquidación',
  devolucion: 'Devolución',
}

export const METODOS_PAGO: Record<MetodoPago, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  deposito: 'Depósito',
  tarjeta: 'Tarjeta',
}

/** Pago con folio del pedido y nombres para mostrar. */
export interface Pago {
  id: string
  pedido_id: string
  folio: string
  pedido_titulo: string
  cliente_id: string | null
  cliente: string | null
  fecha: string
  importe: number
  tipo: TipoPago
  metodo: MetodoPago
  referencia: string | null
  notas: string | null
  comprobante_path: string | null
  registrado_por: string | null
  registrado_por_nombre: string | null
  cancelado: boolean
  motivo_cancelacion: string | null
  cancelado_por: string | null
  cancelado_at: string | null
  created_at: string
}

export interface FiltrosPagos {
  /** Fecha del pago (AAAA-MM-DD) */
  desde?: string
  hasta?: string
  pedidoId?: string
  clienteId?: string
  metodo?: MetodoPago
  tipo?: TipoPago
  /** Por omisión se excluyen los cancelados */
  incluirCancelados?: boolean
  limite?: number
}

export interface NuevoPago {
  pedido_id: string
  importe: number
  /** "abono" por omisión. Las devoluciones requieren `cancelar_pagos`. */
  tipo?: TipoPago
  metodo: MetodoPago
  /** AAAA-MM-DD; hoy por omisión */
  fecha?: string
  referencia?: string | null
  notas?: string | null
}

/** Pedido con saldo (función cuentas_por_cobrar), los vencidos primero. */
export interface CuentaPorCobrar {
  pedido_id: string
  folio: string
  titulo: string
  cliente_id: string
  cliente: string
  whatsapp: string | null
  vendedor_id: string | null
  vendedor: string | null
  estado: Enums['estado_pedido']
  estado_pago: EstadoPago
  total: number
  pagado: number
  saldo: number
  creado: string
  fecha_entrega: string | null
  /** Fecha límite de pago; si no hay, alta + días de crédito; si tampoco, la entrega */
  fecha_limite: string | null
  dias_transcurridos: number
  dias_vencido: number
  vencido: boolean
}

/** Resumen del día (función corte_caja_resumen). */
export interface ResumenCaja {
  fecha: string
  cerrado: boolean
  efectivo_inicial: number
  /** Lo contado en el último corte anterior */
  efectivo_inicial_sugerido: number | null
  totales: { entradas: number; devoluciones: number; neto: number }
  efectivo: { entradas: number; devoluciones: number; gastos: number; neto: number }
  /** Efectivo que debería haber en caja */
  esperado: number
  entradas_por_metodo: Array<{ metodo: MetodoPago; pagos: number; total: number }>
  devoluciones_por_metodo: Array<{ metodo: MetodoPago; pagos: number; total: number }>
  por_usuario: Array<{ usuario_id: string | null; nombre: string; pagos: number; entradas: number; devoluciones: number; neto: number; efectivo_neto: number }>
  pagos: Array<{ id: string; pedido_id: string; folio: string; cliente: string | null; tipo: TipoPago | string; metodo: MetodoPago; importe: number; referencia: string | null; registrado_por: string | null; usuario: string | null; created_at: string }>
  cancelados: { pagos: number; total: number }
  corte: CorteCaja | null
  /** Solo con `registrar_gastos` o `ver_costos` */
  gastos_por_metodo?: Array<{ metodo: MetodoPago; gastos: number; total: number }>
  gastos?: Array<{ id: string; concepto: string; categoria: string; monto: number; metodo_pago: MetodoPago; proveedor: string | null; pedido_id: string | null }>
}

export type CorteCaja = Omit<Tables<'cortes_caja'>, 'resumen'> & { cerrado_por_nombre: string | null; resumen?: Tables<'cortes_caja'>['resumen'] }

export interface Comision {
  vendedor_id: string
  nombre: string
  comision_pct: number
  pedidos: number
  pagos: number
  /** Cobrado con IVA */
  cobrado: number
  /** Cobrado sin IVA (base de la comisión) */
  base_comision: number
  comision: number
}

export interface ComisionDetalle {
  vendedor_id: string
  vendedor: string
  comision_pct: number
  pedido_id: string
  folio: string
  cliente: string | null
  pagos: number
  cobrado: number
  base_comision: number
  comision: number
}

export interface ApiPagos {
  pagos: {
    /** Pagos por fecha (lo más reciente primero). */
    listar(filtros?: FiltrosPagos): Promise<Pago[]>
    /** Pagos de un pedido, incluidos los cancelados (lo más antiguo primero). */
    porPedido(pedidoId: string): Promise<Pago[]>
    /** Registra un cobro; el pedido recalcula pagado, saldo y estado de pago. */
    registrar(datos: NuevoPago): Promise<Pago>
    /** Cancela con motivo (no se borra). Requiere `cancelar_pagos`. */
    cancelar(id: string, motivo: string): Promise<void>
    /** Sube el comprobante (imagen o PDF) y lo liga al pago. Requiere `registrar_pagos`. */
    subirComprobante(id: string, archivo: File | Blob): Promise<Pago>
    /** Enlace temporal (10 minutos) del comprobante. */
    urlComprobante(id: string): Promise<string | null>
  }
  cobranza: {
    /** Quién me debe: pedidos no cancelados con saldo. Requiere `ver_precios`. */
    cuentasPorCobrar(): Promise<CuentaPorCobrar[]>
  }
  caja: {
    /** Resumen del día (hoy por omisión). `efectivoInicial` permite simular antes de cerrar. */
    resumen(fecha?: string, efectivoInicial?: number): Promise<ResumenCaja>
    /** Cierra la caja del día con lo contado. Una vez por día; no fechas futuras. */
    cerrar(datos: { fecha: string; efectivo_inicial: number; efectivo_contado: number; notas?: string | null }): Promise<CorteCaja>
    /** Reabre un día cerrado (solo administración, con motivo que queda en la bitácora). */
    reabrir(fecha: string, motivo: string): Promise<void>
    /** Cortes anteriores (lo más reciente primero). */
    cortes(filtros?: { desde?: string; hasta?: string; limite?: number }): Promise<CorteCaja[]>
  }
  comisiones: {
    /** Comisión por vendedor sobre lo COBRADO en el periodo (sin IVA). */
    resumen(desde: string, hasta: string): Promise<Comision[]>
    /** Detalle por pedido. Sin `ver_reportes` solo las propias. */
    detalle(desde: string, hasta: string, vendedorId?: string): Promise<ComisionDetalle[]>
  }
}
