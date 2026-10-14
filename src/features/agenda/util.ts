import { addDays, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import type { TonoPildora } from '@/components/glass'
import type { EventoAgenda, OrigenAgenda } from '@/data/modulos/agenda/contrato'

export const iso = (d: Date) => format(d, 'yyyy-MM-dd')
export const aFecha = (f: string) => new Date(`${f}T12:00:00`)

/** Semana de lunes a domingo que contiene la fecha. */
export function rangoSemana(f: string) {
  const d = aFecha(f)
  const ini = startOfWeek(d, { weekStartsOn: 1 })
  return {
    desde: iso(ini),
    hasta: iso(endOfWeek(d, { weekStartsOn: 1 })),
    dias: Array.from({ length: 7 }, (_, i) => iso(addDays(ini, i))),
  }
}

/** Cuadrícula del mes (semanas completas, de lunes a domingo). */
export function rangoMes(f: string) {
  const d = aFecha(f)
  const ini = startOfWeek(startOfMonth(d), { weekStartsOn: 1 })
  const fin = endOfWeek(endOfMonth(d), { weekStartsOn: 1 })
  const dias: string[] = []
  for (let x = ini; x <= fin; x = addDays(x, 1)) dias.push(iso(x))
  return { desde: iso(ini), hasta: iso(fin), dias, mes: format(d, 'yyyy-MM') }
}

/** Próximo viernes (hoy si ya es viernes). */
export function proximoViernes(hoy: string) {
  const d = aFecha(hoy)
  return iso(addDays(d, (5 - d.getDay() + 7) % 7))
}

export const diaCorto = (f: string) => format(aFecha(f), 'EEE d', { locale: es }).replace('.', '')
const mayus = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
export const diaLargo = (f: string) => mayus(format(aFecha(f), "EEEE d 'de' MMMM", { locale: es }))
export const mesLargo = (f: string) => mayus(format(aFecha(f), "MMMM 'de' yyyy", { locale: es }))

export const ORIGEN: Record<OrigenAgenda, { etiqueta: string; tono: TonoPildora; punto: string }> = {
  tarea: { etiqueta: 'Tarea', tono: 'acento', punto: 'bg-accent' },
  entrega: { etiqueta: 'Entrega', tono: 'exito', punto: 'bg-success' },
  instalacion: { etiqueta: 'Instalación', tono: 'aviso', punto: 'bg-warning' },
  seguimiento: { etiqueta: 'Seguimiento', tono: 'neutro', punto: 'bg-fg/40' },
  cotizacion: { etiqueta: 'Cotización vence', tono: 'luz', punto: 'bg-luz' },
}

/** Atrasado: sin completar y de un día anterior (solo tareas, entregas e instalaciones). */
export const atrasado = (e: EventoAgenda, hoy: string) => !e.completada && e.fecha < hoy && ['tarea', 'entrega', 'instalacion'].includes(e.origen)

export const claveEvento = (e: EventoAgenda) => `${e.origen}:${e.id}`

/** Pendientes primero, luego por hora. */
export function ordenar(lista: EventoAgenda[]) {
  return [...lista].sort(
    (a, b) =>
      Number(a.completada) - Number(b.completada) || a.fecha.localeCompare(b.fecha) || (a.hora ?? '99').localeCompare(b.hora ?? '99') || a.titulo.localeCompare(b.titulo, 'es'),
  )
}
