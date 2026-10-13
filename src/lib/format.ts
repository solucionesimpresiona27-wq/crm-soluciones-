import { format, formatDistanceToNowStrict, isToday, isTomorrow, isYesterday, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 })
const mxnCorto = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  notation: 'compact',
  maximumFractionDigits: 1,
})
const numero = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 3 })

export function dinero(valor: number | string | null | undefined) {
  if (valor === null || valor === undefined || valor === '') return '—'
  return mxn.format(Number(valor))
}

export function dineroCorto(valor: number | string | null | undefined) {
  if (valor === null || valor === undefined || valor === '') return '—'
  const n = Number(valor)
  return Math.abs(n) < 10000 ? mxn.format(n).replace(/\.00$/, '') : mxnCorto.format(n)
}

export function cantidad(valor: number | string | null | undefined) {
  if (valor === null || valor === undefined || valor === '') return '—'
  return numero.format(Number(valor))
}

export function porcentaje(valor: number | null | undefined, decimales = 0) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '—'
  return `${valor.toFixed(decimales)}%`
}

function aFecha(valor: string | Date) {
  return typeof valor === 'string' ? (valor.length === 10 ? parseISO(`${valor}T12:00:00`) : parseISO(valor)) : valor
}

/** 13 oct 2026 */
export function fecha(valor: string | Date | null | undefined) {
  if (!valor) return '—'
  return format(aFecha(valor), "d MMM yyyy", { locale: es })
}

/** 13 de octubre de 2026 */
export function fechaLarga(valor: string | Date | null | undefined) {
  if (!valor) return '—'
  return format(aFecha(valor), "d 'de' MMMM 'de' yyyy", { locale: es })
}

/** Hoy, Mañana, Ayer o "jue 16 oct" */
export function fechaRelativa(valor: string | Date | null | undefined) {
  if (!valor) return '—'
  const d = aFecha(valor)
  if (isToday(d)) return 'Hoy'
  if (isTomorrow(d)) return 'Mañana'
  if (isYesterday(d)) return 'Ayer'
  return format(d, 'EEE d MMM', { locale: es })
}

export function haceCuanto(valor: string | Date | null | undefined) {
  if (!valor) return '—'
  return `hace ${formatDistanceToNowStrict(aFecha(valor), { locale: es })}`
}

export function hoyISO() {
  const d = new Date()
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10)
}

export function sumarDias(fechaISO: string, dias: number) {
  const d = aFecha(fechaISO)
  d.setDate(d.getDate() + dias)
  return format(d, 'yyyy-MM-dd')
}

/** Teléfono mexicano legible: 33 3492 2524 */
export function telefono(valor: string | null | undefined) {
  if (!valor) return '—'
  const d = valor.replace(/\D/g, '').replace(/^52(1)?/, '')
  if (d.length === 10) return `${d.slice(0, 2)} ${d.slice(2, 6)} ${d.slice(6)}`
  return valor
}
