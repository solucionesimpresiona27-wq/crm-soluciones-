/**
 * Modelo del editor de cotizaciones: estado en pantalla, conversión desde/hacia la API,
 * cálculo en vivo y validación. Todo es puro (sin React) para poder probarlo y razonarlo.
 */
import type {
  BorradorCotizacion,
  ClienteBreve,
  Configuracion,
  CostosPartida,
  CotizacionCompleta,
  MetodoCalculo,
  PartidaDoc,
  ProductoCatalogo,
  TipoPartida,
} from '@/data/tipos'
import {
  METODOS,
  TIPOS_PARTIDA,
  calcularPartida,
  calcularTotales,
  costoPartida,
  importePartida,
  unidadesCobro,
  type ModoPrecio,
  type ResultadoCalculo,
  type Totales,
} from '@/lib/calculadora'
import { hoyISO, sumarDias } from '@/lib/format'
import { redondear } from '@/lib/utils'

export type Num = number | null

export const n = (v: Num | undefined) => (v === null || v === undefined || Number.isNaN(v) ? 0 : v)

export interface CalculoEditor {
  modo: ModoPrecio
  /** Costos por unidad de cobro (m², pieza, millar…) */
  costoMaterial: Num
  costoManoObra: Num
  /** Costo fijo por trabajo (preparación, arte, montaje) */
  costoFijo: Num
  desperdicioPct: Num
  gananciaPct: Num
  /** Precio por unidad de cobro capturado a mano */
  precioManual: Num
}

export interface PartidaEditor {
  /** Llave local estable (para React); `id` queda vacío en conceptos nuevos */
  clave: string
  id: string
  tipo: TipoPartida
  producto_id: string | null
  /** Nombre del producto elegido, para no pisar un concepto escrito a mano */
  productoNombre: string | null
  concepto: string
  descripcion: string
  metodo_calculo: MetodoCalculo
  unidad: string
  ancho: Num
  alto: Num
  largo: Num
  cantidad: Num
  precio_unitario: Num
  descuento_pct: Num
  notas_produccion: string | null
  calc: CalculoEditor
  /** El precio de la fila sigue al cálculo: se actualiza solo al cambiar medidas o cantidad */
  vinculado: boolean
  /** La partida llegó con costos guardados (se conservan aunque queden en cero) */
  conCostos: boolean
  /** Calculadora desplegada (estado de pantalla, no se guarda) */
  abierta: boolean
}

export type ClienteEditor = ClienteBreve & { rfc?: string | null; razon_social?: string | null }

export interface EstadoEditor {
  id?: string
  cliente: ClienteEditor | null
  titulo: string
  fecha: string
  vigencia_dias: Num
  tiempo_entrega: string
  anticipo_pct: Num
  aplica_iva: boolean
  iva_pct: Num
  descuento_tipo: 'monto' | 'pct'
  descuento_valor: Num
  recargo_pct: Num
  recargo_concepto: string
  condiciones: string
  notas: string
  notas_internas: string
  partidas: PartidaEditor[]
}

export const RECARGO_CONCEPTO = 'Recargo por urgencia'

let contador = 0
export function nuevaClave() {
  contador += 1
  const aleatorio =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10)
  return `p-${contador}-${aleatorio}`
}

const calcVacio = (modo: ModoPrecio = 'manual'): CalculoEditor => ({
  modo,
  costoMaterial: null,
  costoManoObra: null,
  costoFijo: null,
  desperdicioPct: null,
  gananciaPct: null,
  precioManual: null,
})

/* ---------------------------------------------------------------------
   Creación
   --------------------------------------------------------------------- */

export function estadoNuevo(config: Configuracion | undefined): EstadoEditor {
  return {
    cliente: null,
    titulo: '',
    fecha: hoyISO(),
    vigencia_dias: config?.vigencia_dias ?? 15,
    tiempo_entrega: config?.tiempo_entrega_default ?? '',
    anticipo_pct: config?.anticipo_pct ?? 50,
    aplica_iva: true,
    iva_pct: config?.iva_pct ?? 16,
    descuento_tipo: 'pct',
    descuento_valor: null,
    recargo_pct: null,
    recargo_concepto: RECARGO_CONCEPTO,
    condiciones: config?.condiciones_cotizacion ?? '',
    notas: '',
    notas_internas: '',
    partidas: [],
  }
}

/** Concepto vacío según el botón con que se agrega. */
export function nuevaPartida(tipo: TipoPartida): PartidaEditor {
  const servicio = tipo === 'instalacion' || tipo === 'transporte'
  const metodo: MetodoCalculo = servicio ? 'servicio' : 'pieza'
  return {
    clave: nuevaClave(),
    id: '',
    tipo,
    producto_id: null,
    productoNombre: null,
    concepto: servicio ? TIPOS_PARTIDA[tipo] : '',
    descripcion: '',
    metodo_calculo: metodo,
    unidad: METODOS[metodo].unidad,
    ancho: null,
    alto: null,
    largo: null,
    cantidad: 1,
    precio_unitario: null,
    descuento_pct: null,
    notas_produccion: null,
    calc: calcVacio('manual'),
    vinculado: false,
    conCostos: false,
    // Un producto nuevo invita a usar el catálogo; instalación y transporte suelen ser un precio directo.
    abierta: !servicio,
  }
}

function modoGuardado(p: PartidaDoc): ModoPrecio | null {
  const m = p.costos?.calculo?.modo
  return m === 'catalogo' || m === 'costo' || m === 'manual' ? m : null
}

export function partidaDesdeDoc(p: PartidaDoc): PartidaEditor {
  const u = unidadesCobro(p.metodo_calculo, p.cantidad, p.ancho, p.alto, p.largo)
  const precioCobro = u > 0 ? redondear((p.precio_unitario * p.cantidad) / u, 4) : p.precio_unitario
  const modo = modoGuardado(p) ?? (p.producto_id ? 'catalogo' : 'manual')
  return {
    clave: nuevaClave(),
    id: p.id,
    tipo: p.tipo,
    producto_id: p.producto_id,
    productoNombre: null,
    concepto: p.concepto,
    descripcion: p.descripcion ?? '',
    metodo_calculo: p.metodo_calculo,
    unidad: p.unidad,
    ancho: p.ancho,
    alto: p.alto,
    largo: p.largo,
    cantidad: p.cantidad,
    precio_unitario: p.precio_unitario,
    descuento_pct: p.descuento_pct || null,
    notas_produccion: p.notas_produccion,
    calc: {
      modo,
      costoMaterial: p.costos?.costo_material ?? null,
      costoManoObra: p.costos?.costo_mano_obra ?? null,
      costoFijo: p.costos?.costo_fijo ?? null,
      desperdicioPct: p.costos?.desperdicio_pct ?? null,
      gananciaPct: p.costos?.ganancia_pct ?? null,
      precioManual: precioCobro,
    },
    vinculado: false,
    conCostos: Boolean(p.costos),
    abierta: false,
  }
}

export function estadoDesdeCotizacion(c: CotizacionCompleta): EstadoEditor {
  return {
    id: c.id,
    cliente: c.cliente,
    titulo: c.titulo ?? '',
    fecha: c.fecha,
    vigencia_dias: c.vigencia_dias,
    tiempo_entrega: c.tiempo_entrega ?? '',
    anticipo_pct: c.anticipo_pct,
    aplica_iva: c.aplica_iva,
    iva_pct: c.iva_pct,
    descuento_tipo: c.descuento_tipo,
    descuento_valor: c.descuento_valor || null,
    recargo_pct: c.recargo_pct || null,
    recargo_concepto: c.recargo_concepto || RECARGO_CONCEPTO,
    condiciones: c.condiciones ?? '',
    notas: c.notas ?? '',
    notas_internas: c.notas_internas ?? '',
    partidas: [...c.partidas].sort((a, b) => a.orden - b.orden).map(partidaDesdeDoc),
  }
}

export function duplicarPartida(p: PartidaEditor): PartidaEditor {
  return { ...p, calc: { ...p.calc }, clave: nuevaClave(), id: '', abierta: false }
}

/* ---------------------------------------------------------------------
   Calculadora
   --------------------------------------------------------------------- */

export function productoSinPrecio(prod: ProductoCatalogo | undefined) {
  return Boolean(prod) && prod!.precio_venta === null && !(prod!.escalas?.length)
}

/** Modos de precio disponibles: "Catálogo" solo con producto; "Costo + ganancia" solo con permiso de costos. */
export function modosDisponibles(p: PartidaEditor, puedeCostos: boolean): ModoPrecio[] {
  const modos: ModoPrecio[] = []
  if (p.producto_id) modos.push('catalogo')
  if (puedeCostos) modos.push('costo')
  modos.push('manual')
  return modos
}

export function resultadoPartida(p: PartidaEditor, prod: ProductoCatalogo | undefined, puedeCostos: boolean): ResultadoCalculo {
  const modo = modosDisponibles(p, puedeCostos).includes(p.calc.modo) ? p.calc.modo : 'manual'
  return calcularPartida({
    metodo: p.metodo_calculo,
    cantidad: n(p.cantidad),
    ancho: p.ancho,
    alto: p.alto,
    largo: p.largo,
    costoMaterial: n(p.calc.costoMaterial),
    costoManoObra: n(p.calc.costoManoObra),
    costoFijo: n(p.calc.costoFijo),
    desperdicioPct: n(p.calc.desperdicioPct),
    gananciaPct: n(p.calc.gananciaPct),
    modoPrecio: modo,
    precioCatalogo: prod?.precio_venta ?? null,
    escalas: prod?.escalas ?? [],
    precioMinimo: prod?.precio_minimo ?? null,
    precioManual: p.calc.precioManual,
  })
}

/** Un resultado se puede aplicar a la fila si hay qué cobrar y un precio positivo. */
export function resultadoAplicable(r: ResultadoCalculo) {
  return !r.sinPrecio && r.unidadesCobro > 0 && r.precioUnitario > 0
}

export function mismoPrecio(a: Num, b: number) {
  return Math.abs(n(a) - b) < 0.005
}

/** Si la fila está vinculada al cálculo, actualiza su precio. */
export function sincronizar(p: PartidaEditor, prod: ProductoCatalogo | undefined, puedeCostos: boolean): PartidaEditor {
  if (!p.vinculado) return p
  const r = resultadoPartida(p, prod, puedeCostos)
  if (!resultadoAplicable(r) || mismoPrecio(p.precio_unitario, r.precioUnitario)) return p
  return { ...p, precio_unitario: r.precioUnitario }
}

/** Cambia el método y ajusta la unidad si seguía la del método anterior. */
export function cambiarMetodo(p: PartidaEditor, metodo: MetodoCalculo): PartidaEditor {
  const unidadAnterior = METODOS[p.metodo_calculo].unidad
  const unidad = !p.unidad.trim() || p.unidad === unidadAnterior ? METODOS[metodo].unidad : p.unidad
  return { ...p, metodo_calculo: metodo, unidad }
}

/**
 * Llena la fila con un producto del catálogo: concepto, método, unidad, precio (con escalas y mínimo)
 * y, si el usuario puede verlos, los costos para que la utilidad quede registrada.
 */
export function aplicarProducto(p: PartidaEditor, prod: ProductoCatalogo, puedeCostos: boolean): PartidaEditor {
  const conservarConcepto = p.concepto.trim() && p.concepto !== p.productoNombre
  const metodo = prod.metodo_calculo
  const medidas = METODOS[metodo].medidas
  const sinPrecio = productoSinPrecio(prod)
  const costos = puedeCostos ? prod.costos : null
  const modo: ModoPrecio = sinPrecio ? (costos ? 'costo' : 'manual') : 'catalogo'
  const base: PartidaEditor = {
    ...p,
    producto_id: prod.id,
    productoNombre: prod.nombre,
    concepto: conservarConcepto ? p.concepto : prod.nombre,
    descripcion: p.descripcion.trim() ? p.descripcion : (prod.descripcion ?? ''),
    metodo_calculo: metodo,
    unidad: medidas ? METODOS[metodo].unidad : prod.unidad || METODOS[metodo].unidad,
    ancho: medidas === 'area' ? p.ancho : null,
    alto: medidas === 'area' ? p.alto : null,
    largo: medidas === 'largo' ? p.largo : null,
    calc: {
      ...p.calc,
      modo,
      ...(costos
        ? {
            costoMaterial: costos.costo_material,
            costoManoObra: costos.costo_mano_obra,
            costoFijo: costos.costo_fijo,
            desperdicioPct: costos.desperdicio_pct,
            gananciaPct: costos.ganancia_pct,
          }
        : {}),
    },
    vinculado: modo !== 'manual',
  }
  // Sin precio de lista ni costos: el precio se captura a mano (no se deja el de otro producto).
  if (modo === 'manual') return { ...base, precio_unitario: null, calc: { ...base.calc, precioManual: null } }
  return sincronizar(base, prod, puedeCostos)
}

/**
 * Precio escrito directo en la fila: deja de seguir al cálculo y, en modo manual,
 * la calculadora toma ese mismo precio (por m², pieza, millar…) para no mostrar otro.
 */
export function conPrecioFila(p: PartidaEditor, precio: Num): PartidaEditor {
  const u = unidadesCobro(p.metodo_calculo, n(p.cantidad), p.ancho, p.alto, p.largo)
  const porCobro = precio === null ? null : u > 0 ? redondear((precio * n(p.cantidad)) / u, 4) : precio
  return {
    ...p,
    precio_unitario: precio,
    vinculado: false,
    calc: p.calc.modo === 'manual' ? { ...p.calc, precioManual: porCobro } : p.calc,
  }
}

export function quitarProducto(p: PartidaEditor): PartidaEditor {
  return { ...p, producto_id: null, productoNombre: null, calc: { ...p.calc, modo: p.calc.modo === 'catalogo' ? 'manual' : p.calc.modo }, vinculado: false }
}

/* ---------------------------------------------------------------------
   Totales
   --------------------------------------------------------------------- */

export const importeFila = (p: PartidaEditor) => importePartida(n(p.cantidad), n(p.precio_unitario), n(p.descuento_pct))

export function totalesDe(e: EstadoEditor): Totales {
  return calcularTotales({
    importes: e.partidas.map(importeFila),
    descuentoTipo: e.descuento_tipo,
    descuentoValor: n(e.descuento_valor),
    recargoPct: n(e.recargo_pct),
    aplicaIva: e.aplica_iva,
    ivaPct: n(e.iva_pct),
  })
}

export const anticipoDe = (e: EstadoEditor, t: Totales) => redondear((t.total * n(e.anticipo_pct)) / 100)

export const vencimientoDe = (e: EstadoEditor) => (e.fecha && n(e.vigencia_dias) > 0 ? sumarDias(e.fecha, n(e.vigencia_dias)) : null)

function tieneCostos(p: PartidaEditor) {
  const c = p.calc
  return p.conCostos || [c.costoMaterial, c.costoManoObra, c.costoFijo].some((v) => n(v) > 0)
}

export function costoFila(p: PartidaEditor) {
  return costoPartida(p.metodo_calculo, n(p.cantidad), p, {
    costoMaterial: n(p.calc.costoMaterial),
    costoManoObra: n(p.calc.costoManoObra),
    costoFijo: n(p.calc.costoFijo),
    desperdicioPct: n(p.calc.desperdicioPct),
  })
}

/** Utilidad estimada (solo con permiso ver_costos): misma regla que el detalle. */
export function utilidadDe(e: EstadoEditor, t: Totales) {
  let costo = 0
  let sinCosto = 0
  for (const p of e.partidas) {
    if (!tieneCostos(p)) {
      sinCosto++
      continue
    }
    costo += costoFila(p)
  }
  costo = redondear(costo)
  const utilidad = redondear(t.base - costo)
  return { costo, utilidad, margen: t.base > 0 ? (utilidad / t.base) * 100 : null, sinCosto }
}

/* ---------------------------------------------------------------------
   Guardado
   --------------------------------------------------------------------- */

function costosDe(p: PartidaEditor): CostosPartida | null {
  if (!tieneCostos(p)) return null
  const c = p.calc
  return {
    costo_material: n(c.costoMaterial),
    costo_mano_obra: n(c.costoManoObra),
    costo_fijo: n(c.costoFijo),
    desperdicio_pct: n(c.desperdicioPct),
    ganancia_pct: n(c.gananciaPct),
    costo_total: costoFila(p),
    calculo: { modo: c.modo, metodo: p.metodo_calculo, origen: 'calculadora' },
  }
}

/** Lo que se envía a guardar_cotizacion(). Los costos solo viajan si el usuario puede verlos. */
export function aBorrador(e: EstadoEditor, puedeCostos: boolean): BorradorCotizacion {
  return {
    ...(e.id ? { id: e.id } : {}),
    cliente_id: e.cliente?.id ?? '',
    titulo: e.titulo.trim(),
    fecha: e.fecha,
    vigencia_dias: Math.round(n(e.vigencia_dias)),
    tiempo_entrega: e.tiempo_entrega.trim(),
    anticipo_pct: n(e.anticipo_pct),
    aplica_iva: e.aplica_iva,
    iva_pct: n(e.iva_pct),
    descuento_tipo: e.descuento_tipo,
    descuento_valor: n(e.descuento_valor),
    recargo_pct: n(e.recargo_pct),
    recargo_concepto: e.recargo_concepto.trim() || RECARGO_CONCEPTO,
    condiciones: e.condiciones.trim(),
    notas: e.notas.trim(),
    notas_internas: e.notas_internas.trim(),
    partidas: e.partidas.map((p) => {
      const medidas = METODOS[p.metodo_calculo].medidas
      return {
        id: p.id,
        tipo: p.tipo,
        producto_id: p.producto_id,
        concepto: p.concepto.trim(),
        descripcion: p.descripcion.trim() || null,
        metodo_calculo: p.metodo_calculo,
        unidad: p.unidad.trim() || METODOS[p.metodo_calculo].unidad,
        ancho: medidas === 'area' ? p.ancho : null,
        alto: medidas === 'area' ? p.alto : null,
        largo: medidas === 'largo' ? p.largo : null,
        cantidad: n(p.cantidad),
        precio_unitario: n(p.precio_unitario),
        descuento_pct: n(p.descuento_pct),
        notas_produccion: p.notas_produccion,
        costos: puedeCostos ? costosDe(p) : null,
      }
    }),
  }
}

/* ---------------------------------------------------------------------
   Validación
   --------------------------------------------------------------------- */

export interface ErroresFila {
  concepto?: string
  cantidad?: string
  descuento?: string
}

export interface Errores {
  cliente?: string
  fecha?: string
  partidas?: string
  vigencia?: string
  anticipo?: string
  iva?: string
  descuento?: string
  recargo?: string
  filas: Record<string, ErroresFila>
}

export function validar(e: EstadoEditor, t: Totales): Errores {
  const err: Errores = { filas: {} }
  if (!e.cliente) err.cliente = 'Elige un cliente o créalo para poder guardar.'
  if (!e.fecha) err.fecha = 'Elige la fecha de la cotización.'
  if (n(e.vigencia_dias) < 1) err.vigencia = 'La vigencia debe ser de al menos 1 día.'
  if (n(e.anticipo_pct) > 100) err.anticipo = 'El anticipo va de 0 a 100 %.'
  if (e.aplica_iva && n(e.iva_pct) > 100) err.iva = 'El IVA va de 0 a 100 %.'
  if (e.descuento_tipo === 'pct' && n(e.descuento_valor) > 100) err.descuento = 'El descuento no puede pasar del 100 %.'
  if (e.descuento_tipo === 'monto' && n(e.descuento_valor) > t.subtotal && t.subtotal > 0) err.descuento = 'El descuento es mayor que el subtotal.'
  if (n(e.recargo_pct) > 100) err.recargo = 'El recargo va de 0 a 100 %.'

  if (!e.partidas.length) err.partidas = 'Agrega al menos un concepto.'
  for (const p of e.partidas) {
    const f: ErroresFila = {}
    if (!p.concepto.trim()) f.concepto = 'Escribe qué incluye este concepto.'
    if (!(n(p.cantidad) > 0)) f.cantidad = 'La cantidad debe ser mayor a 0.'
    if (n(p.descuento_pct) > 100) f.descuento = 'Máximo 100 %.'
    if (Object.keys(f).length) err.filas[p.clave] = f
  }
  return err
}

export function hayErrores(err: Errores) {
  const { filas, ...resto } = err
  return Object.values(resto).some(Boolean) || Object.keys(filas).length > 0
}

export function primerError(err: Errores): string | null {
  const { filas, ...resto } = err
  const general = Object.values(resto).find(Boolean)
  if (general) return general as string
  const fila = Object.values(filas)[0]
  return fila ? (fila.concepto ?? fila.cantidad ?? fila.descuento ?? null) : null
}
