import type { CotizacionCompleta } from '@/data/tipos'

/** id del aviso que explica por qué no se edita (lo lee el botón Editar con aria-describedby). */
export const ID_AVISO_BLOQUEO = 'aviso-bloqueo-cotizacion'

/**
 * Por qué una cotización ya no se edita (nulo = se puede editar). La base aplica la misma regla
 * (cotizacion_bloqueo): convertida en pedido, aprobada por el cliente en el portal o aceptada
 * alguna vez (la aprobación del portal siempre la deja aceptada, con aceptada_at).
 */
export function motivoBloqueo(c: Pick<CotizacionCompleta, 'pedido_id' | 'pedido_folio' | 'estado' | 'aceptada_at'>): string | null {
  if (c.pedido_id) return `Ya es el pedido ${c.pedido_folio ?? ''}: los cambios se hacen en el pedido. Si necesitas otra versión, duplícala.`.replace('  ', ' ')
  if (c.estado === 'aceptada' || c.aceptada_at) return 'El cliente ya la aceptó: para respetar lo acordado no se edita. Duplícala para hacer una versión nueva.'
  return null
}
