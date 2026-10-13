import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { CotizacionLista } from '@/data/tipos'
import { estadoVisibleCotizacion, type EstadoCotizacionVisible } from '@/lib/estados'
import { dinero, sumarDias } from '@/lib/format'
import { normalizar } from '@/lib/utils'

/** Días de anticipación con los que una cotización enviada se considera "por vencer". */
export const DIAS_AVISO = 3
/** Ventana de la tasa de aceptación (igual que el panel de inicio). */
export const DIAS_TASA = 90

export type Filtro = 'todas' | 'borradores' | 'enviadas' | 'vencidas' | 'aceptadas' | 'rechazadas'

export const FILTROS: Array<{ valor: Filtro; etiqueta: string; estado?: EstadoCotizacionVisible }> = [
  { valor: 'todas', etiqueta: 'Todas' },
  { valor: 'borradores', etiqueta: 'Borradores', estado: 'borrador' },
  { valor: 'enviadas', etiqueta: 'Enviadas', estado: 'enviada' },
  { valor: 'vencidas', etiqueta: 'Vencidas', estado: 'vencida' },
  { valor: 'aceptadas', etiqueta: 'Aceptadas', estado: 'aceptada' },
  { valor: 'rechazadas', etiqueta: 'Rechazadas', estado: 'rechazada' },
]

export function esFiltro(v: string | null): v is Filtro {
  return FILTROS.some((f) => f.valor === v)
}

export interface FilaCotizacion extends CotizacionLista {
  visible: EstadoCotizacionVisible
  /** Días que faltan para el vencimiento (negativo si ya pasó) */
  dias: number
  /** Borrador o enviada y todavía vigente */
  abierta: boolean
  /** Enviada que vence en DIAS_AVISO días o menos */
  porVencer: boolean
  busqueda: string
}

export function diasRestantes(vencimiento: string, hoy: string) {
  return differenceInCalendarDays(parseISO(`${vencimiento}T12:00:00`), parseISO(`${hoy}T12:00:00`))
}

export function prepararFilas(lista: CotizacionLista[], hoy: string): FilaCotizacion[] {
  return lista
    .map((c) => {
      const visible = estadoVisibleCotizacion(c, hoy)
      const dias = diasRestantes(c.fecha_vencimiento, hoy)
      return {
        ...c,
        visible,
        dias,
        abierta: visible === 'borrador' || visible === 'enviada',
        porVencer: visible === 'enviada' && dias >= 0 && dias <= DIAS_AVISO,
        busqueda: normalizar(`${c.folio} ${c.cliente.nombre} ${c.titulo ?? ''}`),
      }
    })
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.folio.localeCompare(a.folio))
}

export function coincideFiltro(f: FilaCotizacion, filtro: Filtro) {
  if (filtro === 'todas') return true
  return FILTROS.find((x) => x.valor === filtro)?.estado === f.visible
}

export interface Resumen {
  abierto: number
  abiertas: number
  porVencer: number
  aceptadas: number
  cerradas: number
  /** 0 a 1, o null si todavía no hay cotizaciones cerradas en la ventana */
  tasa: number | null
}

export function resumir(filas: FilaCotizacion[], hoy: string): Resumen {
  const desde = sumarDias(hoy, -DIAS_TASA)
  let abierto = 0
  let abiertas = 0
  let porVencer = 0
  let aceptadas = 0
  let cerradas = 0
  for (const f of filas) {
    if (f.abierta) {
      abierto += f.total
      abiertas++
    }
    if (f.porVencer) porVencer++
    if ((f.estado === 'aceptada' || f.estado === 'rechazada') && f.fecha >= desde) {
      cerradas++
      if (f.estado === 'aceptada') aceptadas++
    }
  }
  return { abierto, abiertas, porVencer, aceptadas, cerradas, tasa: cerradas ? aceptadas / cerradas : null }
}

/** "Vence hoy", "Vence mañana", "Vence en 5 días", "Venció ayer", "Venció hace 3 días" */
export function textoVigencia(dias: number) {
  if (dias === 0) return 'Vence hoy'
  if (dias === 1) return 'Vence mañana'
  if (dias > 1) return `Vence en ${dias} días`
  if (dias === -1) return 'Venció ayer'
  return `Venció hace ${-dias} días`
}

/** Versión corta para columnas: "hoy", "mañana", "en 5 días", "hace 3 días" */
export function textoVigenciaCorto(dias: number) {
  if (dias === 0) return 'Hoy'
  if (dias === 1) return 'Mañana'
  if (dias > 1) return `En ${dias} días`
  if (dias === -1) return 'Ayer'
  return `Hace ${-dias} días`
}

/**
 * Formato para AnimatedNumber con montos: en la cola del resorte (a 0.2 % del final)
 * ya muestra la cifra exacta, para que los centavos no sigan cambiando a la vista.
 */
export const dineroAsentado = (valor: number) => (n: number) => dinero(Math.abs(valor - n) <= Math.abs(valor) * 0.002 ? valor : n)
