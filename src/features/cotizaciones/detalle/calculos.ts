import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { CotizacionCompleta } from '@/data/tipos'
import { costoPartida } from '@/lib/calculadora'
import type { EstadoCotizacionVisible } from '@/lib/estados'
import { redondear } from '@/lib/utils'

export interface CostosCotizacion {
  /** Subtotal − descuento + recargo (sin IVA) */
  base: number
  costo: number
  utilidad: number
  /** Utilidad / base, en % */
  margen: number | null
  /** Partidas sin costo capturado (la utilidad real puede ser menor) */
  sinCosto: number
}

/** Costo y utilidad estimados a partir de los costos de cada partida (solo con permiso ver_costos). */
export function costosCotizacion(c: CotizacionCompleta): CostosCotizacion {
  const base = redondear(c.subtotal - c.descuento + c.recargo)
  let costo = 0
  let sinCosto = 0
  for (const p of c.partidas) {
    if (!p.costos) {
      sinCosto++
      continue
    }
    costo +=
      p.costos.costo_total ??
      costoPartida(p.metodo_calculo, p.cantidad, p, {
        costoMaterial: p.costos.costo_material,
        costoManoObra: p.costos.costo_mano_obra,
        costoFijo: p.costos.costo_fijo,
        desperdicioPct: p.costos.desperdicio_pct,
      })
  }
  costo = redondear(costo)
  const utilidad = redondear(base - costo)
  return { base, costo, utilidad, margen: base > 0 ? (utilidad / base) * 100 : null, sinCosto }
}

export const anticipoDe = (c: CotizacionCompleta) => redondear((c.total * c.anticipo_pct) / 100)

/** "13 oct 2026, 10:00" */
export function fechaHora(iso: string) {
  return format(parseISO(iso), "d MMM yyyy, HH:mm", { locale: es })
}

export type TonoHito = 'hecho' | 'pendiente' | 'aviso' | 'peligro'

export interface Hito {
  clave: string
  titulo: string
  cuando: string | null
  detalle?: string | null
  tono: TonoHito
}

/** Recorrido de la cotización en orden del proceso (no todos los pasos tienen fecha registrada). */
export function hitosCotizacion(c: CotizacionCompleta, visible: EstadoCotizacionVisible): Hito[] {
  const hitos: Hito[] = [{ clave: 'creada', titulo: 'Creada', cuando: fechaHora(c.created_at), detalle: c.vendedor ? `Por ${c.vendedor.nombre}` : null, tono: 'hecho' }]
  // Sin fecha de envío: en borrador falta enviarla; si ya avanzó (p. ej. se aceptó en mostrador) el paso no aplica.
  if (c.enviada_at) hitos.push({ clave: 'enviada', titulo: 'Enviada al cliente', cuando: fechaHora(c.enviada_at), tono: 'hecho' })
  else if (c.estado === 'borrador') hitos.push({ clave: 'enviada', titulo: 'Enviada al cliente', cuando: null, detalle: 'Todavía no se envía', tono: 'pendiente' })
  else if (c.estado === 'enviada') hitos.push({ clave: 'enviada', titulo: 'Enviada al cliente', cuando: null, tono: 'hecho' })
  if (visible === 'vencida') {
    hitos.push({ clave: 'vencida', titulo: 'Venció sin respuesta', cuando: format(parseISO(`${c.fecha_vencimiento}T12:00:00`), 'd MMM yyyy', { locale: es }), tono: 'aviso' })
  }
  if (c.estado === 'rechazada') {
    hitos.push({ clave: 'rechazada', titulo: 'Rechazada', cuando: null, detalle: c.motivo_rechazo ? `Motivo: ${c.motivo_rechazo}` : null, tono: 'peligro' })
    return hitos
  }
  if (c.estado === 'cancelada') {
    hitos.push({ clave: 'cancelada', titulo: 'Cancelada', cuando: null, tono: 'peligro' })
    return hitos
  }
  hitos.push(
    c.aceptada_at
      ? { clave: 'aceptada', titulo: 'Aceptada', cuando: fechaHora(c.aceptada_at), tono: 'hecho' }
      : { clave: 'aceptada', titulo: 'Aceptada', cuando: null, detalle: 'Esperando respuesta del cliente', tono: 'pendiente' },
  )
  hitos.push(
    c.pedido_folio
      ? { clave: 'pedido', titulo: `Convertida en el pedido ${c.pedido_folio}`, cuando: null, tono: 'hecho' }
      : { clave: 'pedido', titulo: 'Convertida en pedido', cuando: null, tono: 'pendiente' },
  )
  return hitos
}
