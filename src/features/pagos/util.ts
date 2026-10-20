import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { MetodoPago } from '@/data/tipos'
import type { Pago, TipoPago } from '@/data/modulos/pagos/contrato'
import { dinero, fecha, sumarDias } from '@/lib/format'
import { redondear } from '@/lib/utils'

export type Periodo = 'hoy' | 'semana' | 'mes' | 'rango'

/** Rango de fechas (AAAA-MM-DD) del periodo. La semana empieza en lunes; semana y mes llegan hasta hoy. */
export function rangoPeriodo(periodo: Periodo, hoy: string, rango?: { desde?: string; hasta?: string }) {
  if (periodo === 'hoy') return { desde: hoy, hasta: hoy }
  if (periodo === 'semana') {
    const dia = parseISO(`${hoy}T12:00:00`).getDay()
    return { desde: sumarDias(hoy, -((dia + 6) % 7)), hasta: hoy }
  }
  if (periodo === 'mes') return { desde: `${hoy.slice(0, 8)}01`, hasta: hoy }
  const desde = rango?.desde || `${hoy.slice(0, 8)}01`
  const hasta = rango?.hasta || hoy
  return desde <= hasta ? { desde, hasta } : { desde: hasta, hasta: desde }
}

/** Mes anterior completo. */
export function mesAnterior(hoy: string) {
  const fin = sumarDias(`${hoy.slice(0, 8)}01`, -1)
  return { desde: `${fin.slice(0, 8)}01`, hasta: fin }
}

/** "13 oct" en el año en curso; con año si es de otro. */
export function fechaCorta(iso: string, hoy: string) {
  if (iso.slice(0, 4) !== hoy.slice(0, 4)) return fecha(iso)
  return format(parseISO(`${iso.slice(0, 10)}T12:00:00`), 'd MMM', { locale: es })
}

/** "13 – 20 oct", "1 sep – 14 oct" o "Hoy". */
export function textoRango(desde: string, hasta: string, hoy: string) {
  if (desde === hasta) return desde === hoy ? 'hoy' : fechaCorta(desde, hoy)
  if (desde.slice(0, 7) === hasta.slice(0, 7)) return `${Number(desde.slice(8))} – ${fechaCorta(hasta, hoy)}`
  return `${fechaCorta(desde, hoy)} – ${fechaCorta(hasta, hoy)}`
}

/** Importe con signo: las devoluciones restan. */
export const conSigno = (p: Pick<Pago, 'tipo' | 'importe'>) => (p.tipo === 'devolucion' ? -p.importe : p.importe)

export interface TotalesPagos {
  entradas: number
  devoluciones: number
  neto: number
  pagos: number
  porMetodo: Partial<Record<MetodoPago, number>>
}

export function totalesPagos(pagos: Pick<Pago, 'tipo' | 'importe' | 'metodo' | 'cancelado'>[]): TotalesPagos {
  const t: TotalesPagos = { entradas: 0, devoluciones: 0, neto: 0, pagos: 0, porMetodo: {} }
  for (const p of pagos) {
    if (p.cancelado) continue
    t.pagos++
    if (p.tipo === 'devolucion') t.devoluciones = redondear(t.devoluciones + p.importe)
    else t.entradas = redondear(t.entradas + p.importe)
    t.porMetodo[p.metodo] = redondear((t.porMetodo[p.metodo] ?? 0) + conSigno(p))
  }
  t.neto = redondear(t.entradas - t.devoluciones)
  return t
}

/**
 * Tipo sugerido para un cobro: anticipo si el pedido no tiene pagos, liquidación si el
 * importe cubre el saldo, abono en otro caso.
 */
export function tipoSugerido(pedido: { pagado: number; saldo: number }, importe: number): TipoPago {
  if (pedido.saldo > 0 && importe > 0 && importe >= pedido.saldo - 0.005) return 'liquidacion'
  if (pedido.pagado <= 0) return 'anticipo'
  return 'abono'
}

/** Valida el importe; devuelve el mensaje de error o null. */
export function validarImporte(importe: number | null, tipo: TipoPago, pedido: { pagado: number; saldo: number }): string | null {
  if (importe === null || Number.isNaN(importe)) return 'Escribe el importe recibido'
  if (!(importe > 0)) return 'El importe debe ser mayor a cero'
  if (Math.abs(importe * 100 - Math.round(importe * 100)) > 1e-6) return 'Usa como máximo dos decimales'
  if (tipo === 'devolucion') {
    if (importe > pedido.pagado + 0.005) return `No puedes devolver más de lo pagado (${dinero(pedido.pagado)})`
    return null
  }
  if (pedido.saldo <= 0) return 'Este pedido ya está liquidado; solo puedes registrar una devolución'
  if (importe > pedido.saldo + 0.005) return `El importe es mayor al saldo (${dinero(pedido.saldo)}). Revisa la cantidad o registra solo el saldo`
  return null
}

/** Convierte "1,250.50" o "$1250" en número; null si está vacío o no es válido. */
export function leerImporte(texto: string): number | null {
  const limpio = texto.replace(/[$,\s]/g, '')
  if (!limpio) return null
  const n = Number(limpio)
  return Number.isFinite(n) ? n : NaN
}

/** Duración legible a partir de días: "1 día", "18 días", "3 meses", "2 años". */
export function duracionDias(dias: number) {
  const d = Math.max(0, Math.floor(dias))
  if (d < 60) return `${d} ${d === 1 ? 'día' : 'días'}`
  if (d < 365) {
    const m = Math.floor(d / 30)
    return `${m} meses`
  }
  const a = Math.floor(d / 365)
  return `${a === 1 ? 'más de un año' : `${a} años`}`
}

/** CSV con BOM para que Excel respete los acentos. */
export function descargarCsv(nombre: string, filas: (string | number | null)[][]) {
  const celda = (v: string | number | null) => {
    const s = v === null ? '' : String(v)
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

/** dinero() que asienta el conteo animado en la cifra exacta. */
export const dineroAsentado = (valor: number) => (n: number) => dinero(Math.abs(valor - n) <= Math.abs(valor) * 0.002 ? valor : n)
