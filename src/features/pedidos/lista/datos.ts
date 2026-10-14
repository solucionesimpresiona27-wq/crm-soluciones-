import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { PedidoLista, Prioridad } from '@/data/modulos/pedidos/contrato'
import type { EstadoPedido } from '@/data/tipos'
import { normalizar } from '@/lib/utils'

/** Fases de la lista (agrupan etapas). "Cerrados" se pide aparte, solo al abrirla. */
export const FASES = [
  { valor: 'todos', etiqueta: 'Todos', estados: null },
  { valor: 'diseno', etiqueta: 'En diseño', estados: ['nuevo', 'en_diseno', 'esperando_aprobacion', 'aprobado'] },
  { valor: 'produccion', etiqueta: 'En producción', estados: ['en_produccion', 'acabados'] },
  { valor: 'entrega', etiqueta: 'Listos y entrega', estados: ['listo_entrega', 'en_instalacion', 'entregado'] },
  { valor: 'pausados', etiqueta: 'Pausados', estados: ['pausado'] },
  { valor: 'cerrados', etiqueta: 'Cerrados', estados: ['finalizado', 'cancelado'] },
] as const satisfies ReadonlyArray<{ valor: string; etiqueta: string; estados: readonly EstadoPedido[] | null }>

export type Fase = (typeof FASES)[number]['valor']
export const esFase = (v: string | null): v is Fase => FASES.some((f) => f.valor === v)

export const RAPIDOS = ['atrasados', 'hoy', 'saldo', 'factura'] as const
export type Rapido = (typeof RAPIDOS)[number]
export const esRapido = (v: string | null): v is Rapido => RAPIDOS.includes(v as Rapido)

export const PRIORIDAD: Record<Prioridad, { etiqueta: string; orden: number }> = {
  urgente: { etiqueta: 'Urgente', orden: 0 },
  alta: { etiqueta: 'Alta', orden: 1 },
  normal: { etiqueta: 'Normal', orden: 2 },
  baja: { etiqueta: 'Baja', orden: 3 },
}

export interface FilaPedido extends PedidoLista {
  busqueda: string
  /** Días para la entrega (negativo = atrasado); null sin fecha */
  dias: number | null
  cerrado: boolean
}

export const CERRADOS: EstadoPedido[] = ['finalizado', 'cancelado']

export function diasPara(fechaISO: string | null, hoy: string) {
  if (!fechaISO) return null
  return differenceInCalendarDays(parseISO(`${fechaISO}T12:00:00`), parseISO(`${hoy}T12:00:00`))
}

export function prepararFilas(pedidos: PedidoLista[], hoy: string): FilaPedido[] {
  return pedidos.map((p) => ({
    ...p,
    busqueda: normalizar(`${p.folio} ${p.cliente} ${p.titulo}`),
    dias: diasPara(p.fecha_entrega, hoy),
    cerrado: CERRADOS.includes(p.estado),
  }))
}

export function enFase(f: FilaPedido, fase: Fase) {
  const def = FASES.find((x) => x.valor === fase)
  if (!def?.estados) return !f.cerrado
  return (def.estados as readonly EstadoPedido[]).includes(f.estado)
}

const sinEntregar = (f: FilaPedido) => !['entregado', 'finalizado', 'cancelado'].includes(f.estado)

export function cumpleRapido(f: FilaPedido, r: Rapido) {
  switch (r) {
    case 'atrasados':
      return f.atrasado
    case 'hoy':
      return f.dias === 0 && sinEntregar(f)
    case 'saldo':
      return (f.saldo ?? 0) > 0.009 && f.estado !== 'cancelado'
    case 'factura':
      return f.requiere_factura && !f.facturado && f.estado !== 'cancelado'
  }
}

/** Texto corto de la entrega: "Hoy", "Mañana", "En 3 días", "Hace 2 días". */
export function textoEntrega(dias: number | null) {
  if (dias === null) return 'Sin fecha'
  if (dias === 0) return 'Hoy'
  if (dias === 1) return 'Mañana'
  if (dias === -1) return 'Ayer'
  const n = Math.abs(dias)
  const lapso = n >= 730 ? `${Math.floor(n / 365)} años` : n >= 365 ? 'un año' : n >= 60 ? `${Math.floor(n / 30)} meses` : `${n} días`
  return dias > 0 ? `En ${lapso}` : `Hace ${lapso}`
}
