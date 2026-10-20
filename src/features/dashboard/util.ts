import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { DashboardResumen, EntregaProxima, EstadoPedido } from '@/data/tipos'
import { FLUJO_PEDIDO } from '@/lib/estados'

/** Pesos sin centavos para cifras de resumen (los detalles usan dinero()). */
const pesosFmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })
const enteroFmt = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 })

export const pesos = (n: number) => pesosFmt.format(n)
export const entero = (n: number) => enteroFmt.format(n)

/** Marcas compactas para ejes: $0, $50 mil, $1.2 M */
export function pesosEje(n: number) {
  if (n === 0) return '$0'
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toLocaleString('es-MX', { maximumFractionDigits: 1 })} M`
  if (Math.abs(n) >= 1000) return `$${Math.round(n / 1000)} mil`
  return pesos(n)
}

export function aFecha(iso: string) {
  return iso.length === 10 ? parseISO(`${iso}T12:00:00`) : parseISO(iso)
}

export function nombreMes(mes: string, largo = false) {
  const [a, m] = mes.split('-').map(Number)
  return format(new Date(a, m - 1, 1), largo ? 'MMMM' : 'MMM', { locale: es }).replace('.', '')
}

export function saludo(fecha = new Date()) {
  const h = fecha.getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

export function fechaEncabezado(hoy: string) {
  const t = format(aFecha(hoy), "EEEE d 'de' MMMM", { locale: es })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** Días entre hoy y la fecha (negativo = ya pasó). */
export function diasHasta(fecha: string, hoy: string) {
  return differenceInCalendarDays(aFecha(fecha), aFecha(hoy))
}

/** "1 día", "4 días", "3 meses" o "más de un año" (los atrasos muy viejos no se cuentan en días). */
function atraso(dias: number) {
  if (dias === 1) return '1 día'
  if (dias < 60) return `${dias} días`
  if (dias < 365) return `${Math.floor(dias / 30)} meses`
  return dias < 730 ? 'más de un año' : `más de ${Math.floor(dias / 365)} años`
}

/** "Hoy", "Mañana", "En 3 días", "Atrasado 4 días" o "Atrasado 3 meses". */
export function cuandoEntrega(fecha: string, hoy: string) {
  const d = diasHasta(fecha, hoy)
  if (d < 0) return { texto: `Atrasado ${atraso(-d)}`, atrasado: true }
  if (d === 0) return { texto: 'Hoy', atrasado: false }
  if (d === 1) return { texto: 'Mañana', atrasado: false }
  return { texto: `En ${d} días`, atrasado: false }
}

export const plural = (n: number, uno: string, varios: string) => `${entero(n)} ${n === 1 ? uno : varios}`

/* ---------------------------------------------------------------------
   Producción: fases del taller (agrupan las etapas de ESTADO_PEDIDO)
   --------------------------------------------------------------------- */
export type IdFase = 'diseno' | 'taller' | 'entrega' | 'pausado'

export const FASES: Array<{ id: IdFase; etiqueta: string; estados: EstadoPedido[] }> = [
  { id: 'diseno', etiqueta: 'Diseño', estados: ['nuevo', 'en_diseno', 'esperando_aprobacion'] },
  { id: 'taller', etiqueta: 'Taller', estados: ['aprobado', 'en_produccion', 'acabados'] },
  { id: 'entrega', etiqueta: 'Entrega', estados: ['listo_entrega', 'en_instalacion'] },
  { id: 'pausado', etiqueta: 'Pausado', estados: ['pausado'] },
]

/** Etapas activas en el orden del flujo (sin entregados ni finalizados) más "pausado". */
export const ETAPAS_ACTIVAS: EstadoPedido[] = [
  ...FLUJO_PEDIDO.filter((e) => e !== 'entregado' && e !== 'finalizado'),
  'pausado',
]

export function conteoFases(porEstado: DashboardResumen['pedidos_por_estado']) {
  return FASES.map((f) => ({ ...f, cantidad: f.estados.reduce((t, e) => t + (porEstado[e] ?? 0), 0) }))
}

export function conteoEtapas(porEstado: DashboardResumen['pedidos_por_estado']) {
  return ETAPAS_ACTIVAS.map((estado) => ({ estado, cantidad: porEstado[estado] ?? 0 })).filter((e) => e.cantidad > 0)
}

/** Pedidos conocidos (entregas próximas y pendientes propios), sin duplicados. */
export function pedidosConocidos(r: DashboardResumen): EntregaProxima[] {
  const vistos = new Map<string, EntregaProxima>()
  for (const p of [...r.entregas_proximas, ...r.mis_pendientes]) {
    if (!vistos.has(p.id)) vistos.set(p.id, p)
  }
  return [...vistos.values()].sort((a, b) => a.fecha_entrega.localeCompare(b.fecha_entrega))
}

export const ESTADOS_LISTOS: EstadoPedido[] = ['listo_entrega', 'en_instalacion']
