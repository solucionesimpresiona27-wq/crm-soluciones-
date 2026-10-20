import type { OrdenTrabajo } from '@/data/modulos/produccion/contrato'
import type { EstadoPedido } from '@/data/tipos'
import { ESTADO_PEDIDO } from '@/lib/estados'
import { normalizar } from '@/lib/utils'

/** Etapa en una frase ("Reanudar en producción", "en “Acabados”"), sin repetir el "en" de la etiqueta. */
export function enEtapa(e: EstadoPedido) {
  const t = ESTADO_PEDIDO[e].etiqueta
  return /^en /i.test(t) ? t.toLowerCase() : `en “${t}”`
}

/** Columnas del tablero, en el orden del taller. "nuevo" (esperando anticipo) solo aparece si tiene órdenes. */
export const ETAPAS_TABLERO: EstadoPedido[] = [
  'nuevo',
  'en_diseno',
  'esperando_aprobacion',
  'aprobado',
  'en_produccion',
  'acabados',
  'listo_entrega',
  'en_instalacion',
]

/** Destinos del menú "Mover a…" (pausado pide motivo; entregar cierra el trabajo del taller). */
export const DESTINOS: EstadoPedido[] = [...ETAPAS_TABLERO.filter((e) => e !== 'nuevo'), 'entregado']

export type Alcance = 'todas' | 'mias'

export interface Filtro {
  alcance: Alcance
  responsableId: string
  texto: string
}

export function filtrar(ordenes: OrdenTrabajo[], f: Filtro, yo: string | undefined) {
  const t = normalizar(f.texto.trim())
  return ordenes.filter(
    (o) =>
      (f.alcance === 'todas' || o.responsable_id === yo || o.disenador_id === yo) &&
      (!f.responsableId || (f.responsableId === 'sin' ? !o.responsable_id : o.responsable_id === f.responsableId)) &&
      (!t || normalizar(`${o.folio} ${o.titulo} ${o.cliente}`).includes(t)),
  )
}

/** Urgentes primero; después por fecha de entrega (sin fecha al final) y folio. */
export function ordenar(a: OrdenTrabajo, b: OrdenTrabajo) {
  const u = Number(b.prioridad === 'urgente') - Number(a.prioridad === 'urgente')
  return u || (a.fecha_entrega ?? '9999').localeCompare(b.fecha_entrega ?? '9999') || a.folio.localeCompare(b.folio)
}

export function agrupar(ordenes: OrdenTrabajo[]) {
  const grupos = new Map<EstadoPedido, OrdenTrabajo[]>()
  for (const e of [...ETAPAS_TABLERO, 'pausado' as const]) grupos.set(e, [])
  for (const o of ordenes) grupos.get(o.estado)?.push(o)
  for (const lista of grupos.values()) lista.sort(ordenar)
  return grupos
}

/** Responsables presentes en el tablero (para el filtro), por nombre. */
export function responsables(ordenes: OrdenTrabajo[]) {
  const m = new Map<string, string>()
  let sinAsignar = false
  for (const o of ordenes) {
    if (o.responsable_id) m.set(o.responsable_id, o.responsable ?? 'Sin nombre')
    else sinAsignar = true
  }
  return {
    lista: [...m].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    sinAsignar,
  }
}

/** Días entre hoy y la entrega (negativo = atrasado). */
export function diasParaEntrega(fecha: string | null, hoy: string) {
  if (!fecha) return null
  return Math.round((Date.parse(`${fecha}T12:00:00`) - Date.parse(`${hoy}T12:00:00`)) / 86_400_000)
}
