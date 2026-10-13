import type { TonoPildora } from '@/components/glass'
import type { EstadoCotizacion, EstadoPedido } from '@/data/tipos'

export type EstadoCotizacionVisible = EstadoCotizacion | 'vencida'

export const ESTADO_COTIZACION: Record<EstadoCotizacionVisible, { etiqueta: string; tono: TonoPildora }> = {
  borrador: { etiqueta: 'Borrador', tono: 'neutro' },
  enviada: { etiqueta: 'Enviada', tono: 'acento' },
  aceptada: { etiqueta: 'Aceptada', tono: 'exito' },
  rechazada: { etiqueta: 'Rechazada', tono: 'peligro' },
  cancelada: { etiqueta: 'Cancelada', tono: 'neutro' },
  vencida: { etiqueta: 'Vencida', tono: 'aviso' },
}

/** Una cotización abierta cuya vigencia ya pasó se muestra como "Vencida". */
export function estadoVisibleCotizacion(c: { estado: EstadoCotizacion; fecha_vencimiento: string }, hoy: string): EstadoCotizacionVisible {
  if ((c.estado === 'borrador' || c.estado === 'enviada') && c.fecha_vencimiento < hoy) return 'vencida'
  return c.estado
}

export const ESTADO_PEDIDO: Record<EstadoPedido, { etiqueta: string; tono: TonoPildora; corto: string }> = {
  nuevo: { etiqueta: 'Nuevo', corto: 'Nuevo', tono: 'neutro' },
  en_diseno: { etiqueta: 'En diseño', corto: 'Diseño', tono: 'acento' },
  esperando_aprobacion: { etiqueta: 'Esperando aprobación', corto: 'Aprobación', tono: 'luz' },
  aprobado: { etiqueta: 'Aprobado', corto: 'Aprobado', tono: 'acento' },
  en_produccion: { etiqueta: 'En producción', corto: 'Producción', tono: 'acento' },
  acabados: { etiqueta: 'Acabados', corto: 'Acabados', tono: 'acento' },
  listo_entrega: { etiqueta: 'Listo para entrega', corto: 'Listo', tono: 'exito' },
  en_instalacion: { etiqueta: 'En instalación', corto: 'Instalación', tono: 'luz' },
  entregado: { etiqueta: 'Entregado', corto: 'Entregado', tono: 'exito' },
  finalizado: { etiqueta: 'Finalizado', corto: 'Finalizado', tono: 'neutro' },
  pausado: { etiqueta: 'Pausado', corto: 'Pausado', tono: 'aviso' },
  cancelado: { etiqueta: 'Cancelado', corto: 'Cancelado', tono: 'peligro' },
}

/** Flujo de producción en orden (sin pausado/cancelado). */
export const FLUJO_PEDIDO: EstadoPedido[] = [
  'nuevo', 'en_diseno', 'esperando_aprobacion', 'aprobado', 'en_produccion', 'acabados', 'listo_entrega', 'en_instalacion', 'entregado', 'finalizado',
]
