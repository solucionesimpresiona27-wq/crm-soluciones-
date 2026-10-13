/**
 * Calculadora de cotizaciones.
 *
 * Replica las fórmulas de la base de datos (unidades_cobro, importe de partidas y
 * tg_calcular_totales) para mostrar resultados en vivo. La base de datos es la
 * fuente final de los totales guardados.
 */
import type { Database } from './database.types'
import { redondear } from './utils'

export type MetodoCalculo = Database['public']['Enums']['metodo_calculo']
export type TipoPartida = Database['public']['Enums']['tipo_partida']

export interface InfoMetodo {
  etiqueta: string
  /** Unidad de venta que aparece en la cotización */
  unidad: string
  /** Nombre del campo cantidad */
  cantidad: string
  /** Medidas que se capturan */
  medidas: 'area' | 'largo' | null
  /** Unidad sobre la que se cobra el precio */
  unidadCobro: string
}

export const METODOS: Record<MetodoCalculo, InfoMetodo> = {
  pieza: { etiqueta: 'Por pieza', unidad: 'pza', cantidad: 'Piezas', medidas: null, unidadCobro: 'pieza' },
  m2: { etiqueta: 'Por metro cuadrado', unidad: 'pza', cantidad: 'Piezas', medidas: 'area', unidadCobro: 'm²' },
  metro_lineal: { etiqueta: 'Por metro lineal', unidad: 'pza', cantidad: 'Piezas', medidas: 'largo', unidadCobro: 'm' },
  millar: { etiqueta: 'Por millar', unidad: 'millar', cantidad: 'Millares', medidas: null, unidadCobro: 'millar' },
  hora: { etiqueta: 'Por hora', unidad: 'hr', cantidad: 'Horas', medidas: null, unidadCobro: 'hora' },
  servicio: { etiqueta: 'Por servicio', unidad: 'servicio', cantidad: 'Servicios', medidas: null, unidadCobro: 'servicio' },
  proyecto: { etiqueta: 'Por proyecto', unidad: 'proyecto', cantidad: 'Proyectos', medidas: null, unidadCobro: 'proyecto' },
  mensualidad: { etiqueta: 'Mensualidad', unidad: 'mes', cantidad: 'Meses', medidas: null, unidadCobro: 'mes' },
}

export const TIPOS_PARTIDA: Record<TipoPartida, string> = {
  concepto: 'Producto o servicio',
  instalacion: 'Instalación',
  transporte: 'Transporte',
  diseno: 'Diseño',
  extra: 'Cargo adicional',
}

export interface Escala {
  desde: number
  precio: number
}

/** Unidades sobre las que se cobra: m² totales, metros lineales totales o la cantidad. */
export function unidadesCobro(
  metodo: MetodoCalculo,
  cantidad: number,
  ancho?: number | null,
  alto?: number | null,
  largo?: number | null,
) {
  const c = Number(cantidad) || 0
  if (metodo === 'm2') return (Number(ancho) || 0) * (Number(alto) || 0) * c
  if (metodo === 'metro_lineal') return (Number(largo) || 0) * c
  return c
}

/** Precio por unidad de cobro aplicando precios por volumen (el mayor "desde" alcanzado). */
export function precioConEscalas(precioBase: number | null | undefined, escalas: Escala[] | null | undefined, unidades: number) {
  let precio = precioBase ?? null
  let desdeAplicado = -Infinity
  for (const e of escalas ?? []) {
    if (unidades >= e.desde && e.desde > desdeAplicado) {
      precio = e.precio
      desdeAplicado = e.desde
    }
  }
  return precio
}

export type ModoPrecio = 'catalogo' | 'costo' | 'manual'

export interface EntradaCalculo {
  metodo: MetodoCalculo
  cantidad: number
  ancho?: number | null
  alto?: number | null
  largo?: number | null
  /** Costos por unidad de cobro */
  costoMaterial?: number
  costoManoObra?: number
  /** Costo fijo por trabajo (preparación, arte, montaje) */
  costoFijo?: number
  desperdicioPct?: number
  /** Ganancia deseada sobre el costo */
  gananciaPct?: number
  modoPrecio: ModoPrecio
  precioCatalogo?: number | null
  escalas?: Escala[] | null
  precioMinimo?: number | null
  /** Precio por unidad de cobro capturado a mano */
  precioManual?: number | null
}

export interface ResultadoCalculo {
  unidadesCobro: number
  /** Costo variable por unidad de cobro, con desperdicio */
  costoUnidad: number
  costoTotal: number
  /** Precio por unidad de cobro (m², pieza, millar…) */
  precioUnidadCobro: number | null
  /** Precio por unidad de venta (lo que aparece en la cotización) */
  precioUnitario: number
  importe: number
  utilidad: number
  /** Margen sobre la venta (utilidad / importe) */
  margenPct: number | null
  /** Ganancia sobre el costo (utilidad / costo) */
  gananciaRealPct: number | null
  aplicoMinimo: boolean
  sinPrecio: boolean
}

export function calcularPartida(e: EntradaCalculo): ResultadoCalculo {
  const unidades = unidadesCobro(e.metodo, e.cantidad, e.ancho, e.alto, e.largo)
  const desperdicio = (Number(e.desperdicioPct) || 0) / 100
  const costoUnidad = (Number(e.costoMaterial) || 0) * (1 + desperdicio) + (Number(e.costoManoObra) || 0)
  const costoTotal = redondear(costoUnidad * unidades + (Number(e.costoFijo) || 0))

  let importeBase = 0
  let precioUnidadCobro: number | null = null
  let sinPrecio = false

  if (e.modoPrecio === 'manual') {
    precioUnidadCobro = Number(e.precioManual) || 0
    importeBase = precioUnidadCobro * unidades
  } else if (e.modoPrecio === 'costo') {
    importeBase = costoTotal * (1 + (Number(e.gananciaPct) || 0) / 100)
    precioUnidadCobro = unidades > 0 ? importeBase / unidades : null
  } else {
    precioUnidadCobro = precioConEscalas(e.precioCatalogo, e.escalas, unidades)
    if (precioUnidadCobro === null) {
      sinPrecio = true
      precioUnidadCobro = 0
    }
    importeBase = precioUnidadCobro * unidades
  }

  let aplicoMinimo = false
  if (e.modoPrecio !== 'manual' && e.precioMinimo && importeBase > 0 && importeBase < e.precioMinimo) {
    importeBase = e.precioMinimo
    aplicoMinimo = true
  }

  const cantidad = Number(e.cantidad) || 0
  const precioUnitario = cantidad > 0 ? redondear(importeBase / cantidad) : 0
  const importe = importePartida(cantidad, precioUnitario, 0)
  const utilidad = redondear(importe - costoTotal)

  return {
    unidadesCobro: redondear(unidades, 4),
    costoUnidad: redondear(costoUnidad, 4),
    costoTotal,
    precioUnidadCobro: precioUnidadCobro === null ? null : redondear(precioUnidadCobro, 4),
    precioUnitario,
    importe,
    utilidad,
    margenPct: importe > 0 ? redondear((utilidad / importe) * 100, 1) : null,
    gananciaRealPct: costoTotal > 0 ? redondear((utilidad / costoTotal) * 100, 1) : null,
    aplicoMinimo,
    sinPrecio,
  }
}

/** Igual que la columna generada partidas.importe */
export function importePartida(cantidad: number, precioUnitario: number, descuentoPct = 0) {
  return redondear((Number(cantidad) || 0) * (Number(precioUnitario) || 0) * (1 - (Number(descuentoPct) || 0) / 100))
}

/** Costo total de una partida a partir de costos por unidad (igual que tg_partida_costo_estimado). */
export function costoPartida(
  metodo: MetodoCalculo,
  cantidad: number,
  medidas: { ancho?: number | null; alto?: number | null; largo?: number | null },
  costos: { costoMaterial?: number; costoManoObra?: number; costoFijo?: number; desperdicioPct?: number },
) {
  const u = unidadesCobro(metodo, cantidad, medidas.ancho, medidas.alto, medidas.largo)
  const unidad = (Number(costos.costoMaterial) || 0) * (1 + (Number(costos.desperdicioPct) || 0) / 100) + (Number(costos.costoManoObra) || 0)
  return redondear(unidad * u + (Number(costos.costoFijo) || 0))
}

export interface EntradaTotales {
  importes: number[]
  descuentoTipo: 'monto' | 'pct'
  descuentoValor: number
  recargoPct: number
  aplicaIva: boolean
  ivaPct: number
}

export interface Totales {
  subtotal: number
  descuento: number
  recargo: number
  base: number
  iva: number
  total: number
}

/** Igual que tg_calcular_totales() en la base de datos. */
export function calcularTotales(t: EntradaTotales): Totales {
  const subtotal = redondear(t.importes.reduce((s, x) => s + (Number(x) || 0), 0))
  const valor = Number(t.descuentoValor) || 0
  const descuento = Math.min(
    subtotal,
    redondear(t.descuentoTipo === 'pct' ? (subtotal * Math.min(valor, 100)) / 100 : valor),
  )
  const recargo = redondear(((subtotal - descuento) * (Number(t.recargoPct) || 0)) / 100)
  const base = redondear(subtotal - descuento + recargo)
  const iva = t.aplicaIva ? redondear((base * (Number(t.ivaPct) || 0)) / 100) : 0
  const total = redondear(base + iva)
  return { subtotal, descuento, recargo, base, iva, total }
}

/** Texto de medidas para la cotización: "3.00 × 2.00 m (6.00 m²)" */
export function describirMedidas(metodo: MetodoCalculo, ancho?: number | null, alto?: number | null, largo?: number | null) {
  const f = (n: number) => n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 3 })
  if (metodo === 'm2' && ancho && alto) return `${f(ancho)} × ${f(alto)} m (${f(ancho * alto)} m²)`
  if (metodo === 'metro_lineal' && largo) return `${f(largo)} m lineales`
  return null
}
