import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Agrupacion } from '@/data/modulos/reportes/contrato'
import { sumarDias } from '@/lib/format'

export type Periodo = 'mes' | 'mesPasado' | 'trimestre' | 'anio' | 'rango'
export const PERIODOS: Periodo[] = ['mes', 'mesPasado', 'trimestre', 'anio', 'rango']

export interface Rango {
  desde: string
  hasta: string
}

export interface RangoReporte extends Rango {
  periodo: Periodo
  /** Periodo anterior comparable (misma duración o el bloque de calendario previo) */
  anterior: Rango
  agrupar: Agrupacion
  /** "Octubre", "3er trimestre", "1 sep – 14 oct" */
  texto: string
  /** "vs septiembre" */
  textoAnterior: string
}

const d = (s: string) => parseISO(`${s}T12:00:00`)
const iso = (x: Date) => format(x, 'yyyy-MM-dd')
const inicioMes = (s: string) => `${s.slice(0, 8)}01`
const finMes = (s: string) => iso(new Date(d(s).getFullYear(), d(s).getMonth() + 1, 0, 12))
const mover = (s: string, meses: number) => {
  const x = d(s)
  const destino = new Date(x.getFullYear(), x.getMonth() + meses, 1, 12)
  const ultimo = new Date(destino.getFullYear(), destino.getMonth() + 1, 0, 12).getDate()
  return iso(new Date(destino.getFullYear(), destino.getMonth(), Math.min(x.getDate(), ultimo), 12))
}
const mesTexto = (s: string, anio = false) => format(d(s), anio ? 'MMMM yyyy' : 'MMMM', { locale: es })
const mayus = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

export function dias(r: Rango) {
  return differenceInCalendarDays(d(r.hasta), d(r.desde)) + 1
}

/** Agrupación automática: por día hasta 45 días, por semana hasta ~6 meses, después por mes. */
export function agrupacion(r: Rango): Agrupacion {
  const n = dias(r)
  return n <= 45 ? 'dia' : n <= 190 ? 'semana' : 'mes'
}

export function textoFechas(r: Rango, hoy: string) {
  const corta = (s: string) => format(d(s), s.slice(0, 4) === hoy.slice(0, 4) ? 'd MMM' : 'd MMM yyyy', { locale: es }).replace('.', '')
  if (r.desde === r.hasta) return corta(r.desde)
  return `${corta(r.desde)} – ${corta(r.hasta)}`
}

/** Rango del periodo. Los periodos en curso llegan hasta hoy y se comparan contra el mismo tramo del anterior. */
export function rangoReporte(periodo: Periodo, hoy: string, libre?: Partial<Rango>): RangoReporte {
  let desde: string, hasta: string, anterior: Rango, texto: string, textoAnterior: string
  if (periodo === 'mes') {
    desde = inicioMes(hoy)
    hasta = hoy
    anterior = { desde: mover(desde, -1), hasta: mover(hoy, -1) }
    texto = mayus(mesTexto(hoy))
    textoAnterior = `vs ${mesTexto(anterior.desde)}`
  } else if (periodo === 'mesPasado') {
    desde = mover(inicioMes(hoy), -1)
    hasta = finMes(desde)
    anterior = { desde: mover(desde, -1), hasta: finMes(mover(desde, -1)) }
    texto = mayus(mesTexto(desde))
    textoAnterior = `vs ${mesTexto(anterior.desde)}`
  } else if (periodo === 'trimestre') {
    const x = d(hoy)
    const q = Math.floor(x.getMonth() / 3)
    desde = iso(new Date(x.getFullYear(), q * 3, 1, 12))
    hasta = hoy
    anterior = { desde: mover(desde, -3), hasta: mover(hoy, -3) }
    texto = `${q + 1}.º trimestre ${x.getFullYear()}`
    textoAnterior = 'vs trimestre anterior'
  } else if (periodo === 'anio') {
    desde = `${hoy.slice(0, 4)}-01-01`
    hasta = hoy
    anterior = { desde: mover(desde, -12), hasta: mover(hoy, -12) }
    texto = `Año ${hoy.slice(0, 4)}`
    textoAnterior = `vs ${anterior.desde.slice(0, 4)}`
  } else {
    desde = libre?.desde || inicioMes(hoy)
    hasta = libre?.hasta || hoy
    if (hasta < desde) [desde, hasta] = [hasta, desde]
    const n = dias({ desde, hasta })
    anterior = { desde: sumarDias(desde, -n), hasta: sumarDias(desde, -1) }
    texto = textoFechas({ desde, hasta }, hoy)
    textoAnterior = `vs ${n} ${n === 1 ? 'día' : 'días'} previos`
  }
  return { periodo, desde, hasta, anterior, agrupar: agrupacion({ desde, hasta }), texto, textoAnterior }
}

/** Etiqueta del eje según la agrupación. */
export function etiquetaPeriodo(p: string, agrupar: Agrupacion, larga = false) {
  if (agrupar === 'mes') return format(d(p), larga ? 'MMMM yyyy' : 'MMM', { locale: es }).replace('.', '')
  if (agrupar === 'semana') return larga ? `Semana del ${format(d(p), "d 'de' MMMM", { locale: es })}` : format(d(p), 'd MMM', { locale: es }).replace('.', '')
  return format(d(p), larga ? "EEEE d 'de' MMMM" : 'd', { locale: es })
}

/** Variación porcentual; null si no hay base. */
export const variacion = (actual: number, previo: number) => (previo > 0 ? ((actual - previo) / previo) * 100 : null)

/** CSV con BOM para que Excel respete los acentos. */
export function descargarCsv(nombre: string, filas: (string | number | null | undefined)[][]) {
  const celda = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const texto = '﻿' + filas.map((f) => f.map(celda).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Tramos de antigüedad de cuentas por cobrar (días desde el alta del pedido). */
export const TRAMOS = [
  { clave: '0-30', etiqueta: '0–30 días', min: 0, max: 30 },
  { clave: '31-60', etiqueta: '31–60 días', min: 31, max: 60 },
  { clave: '61-90', etiqueta: '61–90 días', min: 61, max: 90 },
  { clave: '90+', etiqueta: 'Más de 90', min: 91, max: Infinity },
] as const

export function antiguedad(cuentas: { saldo: number; dias_transcurridos: number }[]) {
  return TRAMOS.map((t) => {
    const xs = cuentas.filter((c) => c.dias_transcurridos >= t.min && c.dias_transcurridos <= t.max)
    return { ...t, pedidos: xs.length, saldo: Math.round(xs.reduce((s, c) => s + c.saldo, 0) * 100) / 100 }
  })
}
