/**
 * Semilla de la vista previa · ventas: cotizaciones (las de siempre), pedidos con partidas,
 * costos, pagos, línea de tiempo y archivos de diseño. DATOS FICTICIOS.
 *
 * Los números están armados para que el panel muestre EXACTAMENTE lo mismo que la vista
 * previa anterior (ventas del mes $121,650, cobrado $86,420, por cobrar $60,629 en 12 pedidos,
 * etc.), pero ahora salen de los registros: lo que se cobre en Pagos cambia el panel.
 *   * 12 pedidos activos (los de antes), 3 terminados y 1 cancelado en el mes actual.
 *   * 32 pedidos históricos finalizados (PED-0001…0032) que reproducen la serie de 6 meses.
 *   * Algunos anticipos de hace 5 meses se cobraron antes de capturar el pedido (por eso la
 *     serie cuadra con lo cobrado).
 */
import { importePartida } from '@/lib/calculadora'
import { FLUJO_PEDIDO } from '@/lib/estados'
import type { Database } from '@/lib/database.types'
import type { EstadoPedido, MetodoCalculo, MetodoPago, Perfil, Rol, TipoPartida } from '../tipos'
import type { Almacen, PedidoFila } from './almacen'
import { cotizacionesDemo } from './datosDemo'
import { eventoPedido, recalcularPedido, redondear2 } from './reglas'
import type { Ctx } from './semillaContexto'

type Enums = Database['public']['Enums']

interface DefPartida {
  producto?: string
  tipo?: TipoPartida
  concepto: string
  descripcion?: string
  metodo: MetodoCalculo
  unidad?: string
  ancho?: number
  alto?: number
  largo?: number
  cantidad: number
  pu: number
  costo?: number
  notas?: string
}

interface DefPago {
  fecha: string
  importe: number
  tipo: Enums['tipo_pago']
  metodo: MetodoPago
  por: string
  referencia?: string
  notas?: string
}

/**
 * Diseñador asignado solo donde Diseño es responsable: el panel de "Mis pendientes" de cada
 * rol (pedidos donde soy responsable o diseñador) queda igual que en la vista previa anterior.
 */
interface DefPedido {
  id: string
  folio?: string
  cliente: string
  titulo: string
  estado: EstadoPedido
  prioridad?: Enums['prioridad']
  /** Fecha de alta (AAAA-MM-DD) */
  creado: string
  entrega: string | null
  instalacion?: boolean
  direccion?: string
  vendedor: string
  responsable?: string | null
  disenador?: string | null
  cotizacion?: string
  iva?: boolean
  omitidas?: EstadoPedido[]
  estadoAnterior?: EstadoPedido
  motivo?: string
  limitePago?: string | null
  /** Folio CFDI si ya se facturó */
  factura?: string
  descripcion?: string
  notasInternas?: string
  /** Fecha en que llegó a su estado final (entregado/finalizado/cancelado) */
  terminado?: string
  partidas: DefPartida[]
  pagos: DefPago[]
}

/** Serie del panel (6 meses, del más antiguo al actual): [vendido, cobrado]. */
export const SERIE_OBJETIVO: Array<[number, number]> = [
  [84200, 71500],
  [96400, 88100],
  [78900, 80300],
  [112300, 97600],
  [104800, 101200],
  [121650, 86420],
]

const A = 'demo-admin'
const V = 'demo-ventas'
const D = 'demo-diseno'
const P = 'demo-produccion'

/** Subtotal que, con IVA del 16 %, da exactamente `total` (o null si no existe). */
function subtotalConIva(total: number) {
  const base = Math.round((total / 1.16) * 100)
  for (const delta of [0, -1, 1, -2, 2]) {
    const s = (base + delta) / 100
    if (redondear2(s + redondear2(s * 0.16)) === total) return s
  }
  return null
}

/** El total más cercano a `aprox` que se puede formar con un subtotal + 16 % de IVA. */
function alcanzable(aprox: number) {
  for (let j = 0; j < 10; j++) {
    for (const t of [aprox + j / 100, aprox - j / 100]) {
      if (subtotalConIva(redondear2(t)) !== null) return redondear2(t)
    }
  }
  throw new Error(`Semilla: no hay total alcanzable cerca de ${aprox}`)
}

/**
 * Pedido histórico pagado: anticipo del 50 % al darlo de alta y liquidación días después.
 * Con `liquidacion` fija (la parte que se cobra al mes siguiente) el total se ajusta al más
 * cercano posible con IVA y el anticipo es la diferencia.
 */
function historico(
  id: string,
  cliente: string,
  titulo: string,
  creado: string,
  liquidado: string,
  total: number,
  vendedor: string,
  partida: Omit<DefPartida, 'cantidad' | 'pu'>,
  opciones: { iva?: boolean; metodo?: MetodoPago; anticipo?: number; liquidacion?: number; anticipoFecha?: string; factura?: string; notasInternas?: string } = {},
): DefPedido {
  const iva = opciones.iva ?? true
  if (iva && (opciones.anticipo !== undefined || opciones.liquidacion !== undefined)) total = alcanzable(total)
  const sub = iva ? subtotalConIva(total) : total
  if (sub === null) throw new Error(`Semilla: no hay subtotal exacto para ${total}`)
  const anticipo =
    opciones.anticipo ?? (opciones.liquidacion !== undefined ? redondear2(total - opciones.liquidacion) : redondear2(total / 2))
  const metodo = opciones.metodo ?? 'transferencia'
  return {
    id,
    cliente,
    titulo,
    estado: 'finalizado',
    creado,
    entrega: liquidado,
    vendedor,
    responsable: P,
    iva,
    terminado: liquidado,
    factura: opciones.factura,
    notasInternas: opciones.notasInternas,
    partidas: [{ ...partida, cantidad: 1, pu: sub, costo: Math.round(sub * 0.52) }],
    pagos: [
      { fecha: opciones.anticipoFecha ?? creado, importe: anticipo, tipo: 'anticipo', metodo, por: vendedor },
      { fecha: liquidado, importe: redondear2(total - anticipo), tipo: 'liquidacion', metodo, por: vendedor },
    ],
  }
}

/** Pedido que completa el vendido del mes: sin IVA (cliente sin factura), total = lo que falta. */
function balance(id: string, cliente: string, titulo: string, creado: string, liquidado: string, total: number, vendedor: string, partida: Omit<DefPartida, 'cantidad' | 'pu'>) {
  return historico(id, cliente, titulo, creado, liquidado, redondear2(total), vendedor, partida, { iva: false, metodo: 'efectivo' })
}

const suma = (xs: number[]) => redondear2(xs.reduce((s, x) => s + x, 0))

/** Pedidos de los 5 meses anteriores (se les asigna folio PED-0001… por fecha de alta). */
function historicos(c: Ctx): DefPedido[] {
  const m = (k: number, d: number) => c.mes(k).dia(d)
  const lona = (d = 'Lona impresa 13 oz'): Omit<DefPartida, 'cantidad' | 'pu'> => ({ producto: 'pr1', concepto: d, metodo: 'm2' })
  const vinil = (d = 'Impresión de vinil'): Omit<DefPartida, 'cantidad' | 'pu'> => ({ producto: 'pr2', concepto: d, metodo: 'm2' })
  const libre = (d: string, metodo: MetodoCalculo = 'proyecto'): Omit<DefPartida, 'cantidad' | 'pu'> => ({ concepto: d, metodo })

  const lista: DefPedido[] = []

  // Hace 5 meses: el anticipo del pedido grande se cobró a fin del mes anterior (antes de capturarlo).
  const m5 = [
    historico('demo-h5-1', 'c5', 'Lonas para preventa, primera fase', m(5, 2), m(5, 20), 25001.44, A, lona(), {
      anticipo: 12500.72,
      anticipoFecha: m(6, 27),
      factura: 'A-0101',
      notasInternas: 'El anticipo se recibió antes de dar de alta el pedido en el sistema.',
    }),
    historico('demo-h5-2', 'c4', 'Etiquetas para salsas', m(5, 18), m(4, 3), 2199.28, V, libre('Etiquetas en vinil blanco con suaje', 'millar'), { liquidacion: 199.28, metodo: 'efectivo' }),
    historico('demo-h5-3', 'c9', 'Señalética interior', m(5, 6), m(5, 16), 10440, V, libre('Señalética de acrílico para farmacia', 'pieza')),
    historico('demo-h5-4', 'c11', 'Material para aniversario del hotel', m(5, 8), m(5, 19), 6960, V, lona('Lonas y vinil para eventos')),
    historico('demo-h5-5', 'c1', 'Menú y lonas de verano', m(5, 10), m(5, 22), 13340, V, lona(), { factura: 'A-0108' }),
    historico('demo-h5-6', 'c10', 'Maquila de vinil para agencia', m(5, 12), m(5, 24), 15080, A, vinil(), { factura: 'A-0110' }),
  ]
  m5.push(balance('demo-h5-7', 'c2', 'Playeras para carrera 5K', m(5, 14), m(5, 26), 84200 - suma(m5.map(totalDe)), V, { producto: 'pr9', concepto: 'Playera personalizada', metodo: 'pieza' }))
  lista.push(...m5)

  const m4 = [
    historico('demo-h4-1', 'c3', 'Señalética de recepción', m(4, 22), m(3, 6), 16998.56, A, libre('Letreros de acrílico con vinil de corte', 'pieza'), { liquidacion: 8499.28, factura: 'A-0121' }),
    historico('demo-h4-2', 'c9', 'Vinil para aparador', m(4, 4), m(4, 12), 4640, V, vinil('Vinil microperforado para aparador')),
    historico('demo-h4-3', 'c11', 'Lonas para eventos del hotel', m(4, 6), m(4, 18), 11600, V, lona()),
    historico('demo-h4-4', 'c5', 'Lonas de obra, segunda fase', m(4, 9), m(4, 23), 27840, A, lona(), { factura: 'A-0118' }),
    historico('demo-h4-5', 'c10', 'Maquila de lonas', m(4, 11), m(4, 21), 9280, A, lona(), { factura: 'A-0119' }),
    historico('demo-h4-6', 'c8', 'Rotulación de grúa', m(4, 13), m(4, 25), 6380, A, libre('Rotulación vehicular')),
  ]
  m4.push(balance('demo-h4-7', 'c6', 'Uniformes y lonas escolares', m(4, 15), m(4, 27), 96400 - suma(m4.map(totalDe)), V, lona('Lonas para festival escolar')))
  lista.push(...m4)

  const m3 = [
    historico('demo-h3-1', 'c4', 'Lona y menú del local', m(3, 24), m(2, 5), 14198.56, V, lona(), { liquidacion: 7099.28 }),
    historico('demo-h3-2', 'c1', 'Volantes y lonas de temporada', m(3, 5), m(3, 15), 9860, V, lona(), { factura: 'A-0131' }),
    historico('demo-h3-3', 'c5', 'Señalética de oficinas de ventas', m(3, 8), m(3, 22), 23200, A, libre('Señalética de acrílico y vinil', 'pieza'), { factura: 'A-0133' }),
    historico('demo-h3-4', 'c10', 'Maquila de DTF', m(3, 10), m(3, 17), 5800, A, { producto: 'pr7', concepto: 'DTF textil', metodo: 'metro_lineal' }, { factura: 'A-0134' }),
    historico('demo-h3-5', 'c3', 'Tarjetas y recetarios', m(3, 12), m(3, 19), 3480, A, { producto: 'pr15', concepto: 'Tarjetas de presentación', metodo: 'millar' }, { factura: 'A-0135' }),
  ]
  m3.push(balance('demo-h3-6', 'c2', 'Lonas para gimnasio', m(3, 14), m(3, 26), 78900 - suma(m3.map(totalDe)), V, lona()))
  lista.push(...m3)

  const m2 = [
    historico('demo-h2-1', 'c5', 'Lonas para casa muestra', m(2, 23), m(1, 8), 43598.56, A, lona(), { liquidacion: 21799.28, factura: 'A-0151' }),
    historico('demo-h2-2', 'c1', 'Rotulación de fachada', m(2, 4), m(2, 18), 17400, V, { producto: 'pr4', concepto: 'Rotulación de cristales', metodo: 'm2' }, { factura: 'A-0144' }),
    historico('demo-h2-3', 'c10', 'Maquila de impresión', m(2, 7), m(2, 16), 12760, A, vinil(), { factura: 'A-0146' }),
    historico('demo-h2-4', 'c6', 'Señalética escolar', m(2, 9), m(2, 24), 8700, V, libre('Señalética de PVC para salones', 'pieza'), { factura: 'A-0148' }),
    historico('demo-h2-5', 'c8', 'Letrero del taller', m(2, 11), m(2, 25), 6960, A, { producto: 'pr5', concepto: 'Letrero de acrílico', metodo: 'pieza' }),
  ]
  m2.push(balance('demo-h2-6', 'c2', 'Uniformes de entrenadores', m(2, 13), m(2, 27), 112300 - suma(m2.map(totalDe)), V, { producto: 'pr9', concepto: 'Playera personalizada', metodo: 'pieza' }))
  lista.push(...m2)

  const m1 = [
    historico('demo-h1-1', 'c5', 'Espectacular para preventa', m(1, 24), c.enMesActual(c.dia(-8)), 50798.56, A, lona('Impresión gran formato para espectacular'), { liquidacion: 25399.28, factura: 'A-0170' }),
    historico('demo-h1-2', 'c1', 'Lonas y vinil de aparador', m(1, 3), m(1, 14), 11020, V, vinil(), { factura: 'A-0161' }),
    historico('demo-h1-3', 'c10', 'Maquila de vinil microperforado', m(1, 5), m(1, 19), 16240, A, { producto: 'pr3', concepto: 'Vinil microperforado', metodo: 'm2' }, { factura: 'A-0163' }),
    historico('demo-h1-4', 'c3', 'Vinil esmerilado para consultorios', m(1, 8), m(1, 20), 5220, A, vinil('Vinil esmerilado impreso'), { factura: 'A-0165' }),
    historico('demo-h1-5', 'c4', 'Rótulo de fachada', m(1, 10), m(1, 22), 9280, V, libre('Rotulación de fachada')),
  ]
  m1.push(balance('demo-h1-6', 'c2', 'Toallas bordadas', m(1, 12), m(1, 26), 104800 - suma(m1.map(totalDe)), V, libre('Toallas bordadas con logo', 'pieza')))
  lista.push(...m1)

  return lista
}

function totalDe(d: DefPedido) {
  return suma(d.pagos.map((p) => (p.tipo === 'devolucion' ? -p.importe : p.importe)))
}

/** Pedidos del mes actual: los 12 activos que ya mostraba la vista previa, 3 terminados y 1 cancelado. */
function delMes(c: Ctx): DefPedido[] {
  const f = (n: number) => c.enMesActual(c.dia(n))
  const h = c.dia
  return [
    {
      id: 'demo-ped-f', folio: 'PED-0033', cliente: 'c8', titulo: 'Rotulación de camioneta', estado: 'pausado', estadoAnterior: 'en_produccion',
      motivo: 'El cliente pidió esperar: la camioneta sigue en el taller de hojalatería.', prioridad: 'normal', creado: f(-18),
      entrega: h(-4), limitePago: h(-4), instalacion: true, direccion: 'Taller Mecánico Rueda, Tonalá', vendedor: V, responsable: P,
      partidas: [
        { tipo: 'concepto', concepto: 'Rotulación vehicular en vinil laminado', descripcion: 'Laterales y puerta trasera de camioneta de 3.5 t', metodo: 'proyecto', cantidad: 1, pu: 7300, costo: 4300, notas: 'Lavar y desengrasar la carrocería antes de aplicar.' },
        { tipo: 'instalacion', concepto: 'Instalación en taller', metodo: 'servicio', cantidad: 1, pu: 1200, costo: 600 },
      ],
      pagos: [{ fecha: f(-18), importe: 4930, tipo: 'anticipo', metodo: 'transferencia', por: V, referencia: 'SPEI 4471' }],
    },
    {
      id: 'demo-ped-k', folio: 'PED-0034', cliente: 'c6', titulo: 'Lonas para kermés', estado: 'cancelado', motivo: 'La escuela canceló el evento; se devolvió el anticipo.',
      creado: f(-17), entrega: h(-10), vendedor: V, responsable: P, terminado: f(-15),
      partidas: [{ producto: 'pr1', concepto: 'Lona impresa 13 oz', metodo: 'm2', ancho: 2, alto: 1, cantidad: 5, pu: 400, costo: 900 }],
      pagos: [
        { fecha: f(-17), importe: 1160, tipo: 'anticipo', metodo: 'transferencia', por: V, referencia: 'SPEI 3310' },
        { fecha: f(-15), importe: 1160, tipo: 'devolucion', metodo: 'transferencia', por: A, notas: 'Devolución por cancelación del evento' },
      ],
    },
    {
      id: 'demo-ped-b', folio: 'PED-0035', cliente: 'c7', titulo: 'Banner para expo', estado: 'listo_entrega', prioridad: 'urgente', creado: f(-16),
      entrega: h(-1), limitePago: h(-1), vendedor: V, responsable: V,
      partidas: [{ concepto: 'Banner roll-up 0.85 × 2 m con estructura', descripcion: 'Impresión en lona front con estuche', metodo: 'pieza', cantidad: 2, pu: 900, costo: 1100 }],
      pagos: [{ fecha: f(-16), importe: 1044, tipo: 'anticipo', metodo: 'efectivo', por: V }],
    },
    {
      id: 'demo-ped-e', folio: 'PED-0036', cliente: 'c4', titulo: 'Menú digital', estado: 'nuevo', prioridad: 'baja', creado: f(-15),
      entrega: h(9), limitePago: h(9), vendedor: A, responsable: A, omitidas: ['en_produccion', 'acabados', 'en_instalacion'],
      descripcion: 'Menú para pantalla y código QR en las mesas. Falta que el cliente mande los precios.',
      partidas: [
        { tipo: 'diseno', concepto: 'Diseño de menú digital', metodo: 'proyecto', cantidad: 1, pu: 1800, costo: 700 },
        { concepto: 'Código QR impreso en acrílico para mesa', metodo: 'pieza', cantidad: 6, pu: 200, costo: 640 },
      ],
      pagos: [],
    },
    {
      id: 'demo-ped-l', folio: 'PED-0037', cliente: 'c1', titulo: 'Tarjetas de presentación', estado: 'finalizado', creado: f(-14), entrega: f(-11),
      vendedor: V, responsable: P, terminado: f(-11), factura: 'A-0181',
      partidas: [{ producto: 'pr15', concepto: 'Tarjetas de presentación couché 300 g', descripcion: 'Frente y vuelta, laminado mate', metodo: 'millar', cantidad: 2, pu: 600, costo: 650 }],
      pagos: [
        { fecha: f(-14), importe: 696, tipo: 'anticipo', metodo: 'efectivo', por: V },
        { fecha: f(-11), importe: 696, tipo: 'liquidacion', metodo: 'efectivo', por: V },
      ],
    },
    {
      id: 'demo-ped-a', folio: 'PED-0038', cliente: 'c6', titulo: 'Vinil para cristales de recepción', estado: 'en_instalacion', creado: f(-13),
      entrega: h(0), limitePago: h(0), instalacion: true, direccion: 'Escuela Montessori Arcoíris, recepción', vendedor: V, responsable: P,
      partidas: [
        { concepto: 'Vinil esmerilado impreso para cristales', metodo: 'm2', ancho: 2, alto: 1.5, cantidad: 4, pu: 1125, costo: 2600, notas: 'Medidas de cada cristal: 2 × 1.5 m.' },
        { tipo: 'instalacion', concepto: 'Instalación', metodo: 'servicio', cantidad: 1, pu: 1000, costo: 500 },
      ],
      pagos: [{ fecha: f(-13), importe: 3190, tipo: 'anticipo', metodo: 'transferencia', por: V, referencia: 'SPEI 5528' }],
    },
    {
      id: 'demo-ped-m', folio: 'PED-0039', cliente: 'c3', titulo: 'Recetarios impresos', estado: 'finalizado', creado: f(-12), entrega: f(-9),
      vendedor: A, responsable: P, terminado: f(-9), factura: 'A-0183',
      partidas: [{ concepto: 'Recetarios media carta, block de 100 hojas', metodo: 'pieza', cantidad: 10, pu: 100, costo: 520 }],
      pagos: [{ fecha: f(-9), importe: 1160, tipo: 'liquidacion', metodo: 'transferencia', por: A, referencia: 'SPEI 6012' }],
    },
    {
      id: 'demo-ped-c', folio: 'PED-0040', cliente: 'c2', titulo: 'Playeras para torneo', estado: 'en_diseno', creado: f(-11),
      entrega: h(6), limitePago: h(6), vendedor: V, responsable: D, disenador: D,
      partidas: [{ producto: 'pr9', concepto: 'Playera dry-fit sublimada', descripcion: 'Número y nombre en la espalda', metodo: 'pieza', cantidad: 26, pu: 250, costo: 4160 }],
      pagos: [{ fecha: f(-11), importe: 3770, tipo: 'anticipo', metodo: 'tarjeta', por: V, referencia: 'Terminal 0921' }],
    },
    {
      id: 'demo-ped-d', folio: 'PED-0041', cliente: 'c8', titulo: 'Letras volumétricas', estado: 'acabados', prioridad: 'alta', creado: f(-10),
      entrega: h(2), limitePago: h(2), instalacion: true, direccion: 'Taller Mecánico Rueda, fachada principal', vendedor: A, responsable: P,
      partidas: [
        { concepto: 'Letras volumétricas de acrílico con luz LED', descripcion: '"TALLER RUEDA", 40 cm de alto', metodo: 'pieza', cantidad: 1, pu: 11800, costo: 7800, notas: 'Pintar los cantos en negro mate.' },
        { tipo: 'instalacion', concepto: 'Instalación en fachada', metodo: 'servicio', cantidad: 1, pu: 1700, costo: 900 },
      ],
      pagos: [{ fecha: f(-10), importe: 7830, tipo: 'anticipo', metodo: 'transferencia', por: A, referencia: 'SPEI 7741' }],
    },
    {
      id: 'demo-ped-3', folio: 'PED-0042', cliente: 'c3', titulo: 'Señalética de consultorios', estado: 'en_produccion', prioridad: 'alta', creado: f(-4),
      entrega: h(1), limitePago: h(1), instalacion: true, direccion: 'Clínica Dental Sonríe, Guadalajara', vendedor: A, responsable: P, cotizacion: 'demo-cot-3',
      partidas: [
        { producto: 'pr5', concepto: 'Letrero de acrílico 3 mm con vinil de corte', descripcion: '30 × 10 cm, con separadores', metodo: 'pieza', cantidad: 8, pu: 420, costo: 1760 },
        { tipo: 'instalacion', concepto: 'Instalación', metodo: 'servicio', cantidad: 1, pu: 600, costo: 300 },
      ],
      pagos: [{ fecha: f(-4), importe: 2296.8, tipo: 'anticipo', metodo: 'transferencia', por: A, referencia: 'SPEI 8120' }],
    },
    {
      id: 'demo-ped-n', folio: 'PED-0043', cliente: 'c7', titulo: 'Etiquetas para bolsas', estado: 'entregado', creado: f(-4), entrega: f(-2),
      vendedor: V, responsable: V, terminado: f(-2),
      partidas: [{ concepto: 'Etiquetas en papel kraft con suaje', metodo: 'millar', cantidad: 2, pu: 568.93, costo: 630 }],
      pagos: [{ fecha: f(-2), importe: 1319.92, tipo: 'liquidacion', metodo: 'efectivo', por: V }],
    },
    {
      id: 'demo-ped-5', folio: 'PED-0044', cliente: 'c5', titulo: 'Lonas para desarrollos', estado: 'esperando_aprobacion', creado: f(-3),
      entrega: h(3), limitePago: h(3), vendedor: A, responsable: D, disenador: D, cotizacion: 'demo-cot-5',
      notasInternas: 'Se amplió a 14 lonas después de aprobar la cotización; el precio de mayoreo ya incluye el descuento.',
      partidas: [
        { producto: 'pr1', concepto: 'Lona impresa 13 oz', descripcion: 'Con ojillos y refuerzo perimetral', metodo: 'm2', ancho: 6, alto: 3, cantidad: 4, pu: 3240, costo: 6800 },
        { producto: 'pr1', concepto: 'Lona impresa 13 oz (segunda fase)', metodo: 'm2', ancho: 6, alto: 3, cantidad: 10, pu: 3240, costo: 17000 },
        { producto: 'pr1', concepto: 'Lona para caseta de ventas', metodo: 'm2', ancho: 3, alto: 2, cantidad: 3, pu: 1137.61, costo: 1700 },
        { tipo: 'transporte', concepto: 'Transporte a obra', metodo: 'servicio', cantidad: 2, pu: 700, costo: 900 },
      ],
      pagos: [{ fecha: f(-3), importe: 29100, tipo: 'anticipo', metodo: 'transferencia', por: A, referencia: 'SPEI 8803' }],
    },
    {
      id: 'demo-ped-g', folio: 'PED-0045', cliente: 'c1', titulo: 'Volantes de temporada', estado: 'en_produccion', creado: f(-3),
      entrega: h(4), limitePago: h(4), vendedor: V, responsable: P,
      partidas: [{ concepto: 'Volantes media carta couché 150 g', descripcion: 'Frente y vuelta', metodo: 'millar', cantidad: 5, pu: 500, costo: 1450 }],
      pagos: [{ fecha: f(-3), importe: 1450, tipo: 'anticipo', metodo: 'efectivo', por: V }],
    },
    {
      id: 'demo-ped-h', folio: 'PED-0046', cliente: 'c7', titulo: 'Vinil para vitrina', estado: 'en_diseno', prioridad: 'alta', creado: f(-2),
      entrega: h(5), limitePago: h(5), instalacion: true, direccion: 'Boutique Lirio, aparador principal', vendedor: V, responsable: D, disenador: D,
      partidas: [
        { concepto: 'Vinil de corte para vitrina', metodo: 'm2', ancho: 1.2, alto: 0.8, cantidad: 2, pu: 650, costo: 600 },
        { tipo: 'instalacion', concepto: 'Instalación', metodo: 'servicio', cantidad: 1, pu: 300, costo: 150 },
      ],
      pagos: [{ fecha: f(-2), importe: 928, tipo: 'anticipo', metodo: 'efectivo', por: V }],
    },
    {
      id: 'demo-ped-i', folio: 'PED-0047', cliente: 'c2', titulo: 'Lona de inauguración', estado: 'aprobado', creado: f(-1),
      entrega: h(2), limitePago: h(2), instalacion: true, direccion: 'Gimnasio Titán, sucursal Zapopan', vendedor: V, responsable: P,
      partidas: [
        { producto: 'pr1', concepto: 'Lona impresa 13 oz', metodo: 'm2', ancho: 5, alto: 2, cantidad: 1, pu: 1800, costo: 1100 },
        { tipo: 'instalacion', concepto: 'Instalación con andamio', metodo: 'servicio', cantidad: 1, pu: 1200, costo: 500 },
      ],
      pagos: [{ fecha: f(-1), importe: 1740, tipo: 'anticipo', metodo: 'deposito', por: V, referencia: 'Depósito en ventanilla' }],
    },
    {
      id: 'demo-ped-j', folio: 'PED-0048', cliente: 'c4', titulo: 'Etiquetas para salsas', estado: 'en_produccion', prioridad: 'baja', creado: f(0),
      entrega: h(8), limitePago: h(8), vendedor: V, responsable: P,
      partidas: [{ concepto: 'Etiquetas en vinil blanco con suaje', metodo: 'millar', cantidad: 3, pu: 500, costo: 852.4 }],
      pagos: [{ fecha: f(0), importe: 870, tipo: 'anticipo', metodo: 'efectivo', por: V }],
    },
  ]
}

/** Etapas recorridas hasta el estado actual (sin las omitidas). */
function recorrido(d: DefPedido): EstadoPedido[] {
  const flujo = FLUJO_PEDIDO.filter((e) => !(d.omitidas ?? []).includes(e))
  const destino = d.estado === 'pausado' ? (d.estadoAnterior ?? 'nuevo') : d.estado === 'cancelado' ? 'nuevo' : d.estado
  const hasta = flujo.indexOf(destino)
  const pasos = flujo.slice(0, hasta + 1)
  if (d.estado === 'pausado' || d.estado === 'cancelado') pasos.push(d.estado)
  return pasos
}

function agregarPedido(a: Almacen, c: Ctx, d: DefPedido, folio: string, nombre: (id: string) => string) {
  // Hora de alta creciente con el folio (varios pedidos pueden caer el mismo día al inicio del mes)
  const num = Number(folio.slice(4))
  const creado = c.ts(d.creado, 8 + Math.floor((num * 10) / 60), (num * 10) % 60)
  const cliente = a.clientes.find((x) => x.id === d.cliente)
  if (!cliente) throw new Error(`Semilla: falta el cliente ${d.cliente}`)
  const cot = d.cotizacion ? a.cotizaciones.find((x) => x.id === d.cotizacion) : undefined
  const terminado = d.terminado ? c.ts(d.terminado, 17) : null
  const p: PedidoFila = {
    id: d.id,
    folio,
    cotizacion_id: d.cotizacion ?? null,
    cliente_id: d.cliente,
    contacto_id: a.contactos.find((x) => x.cliente_id === d.cliente && x.principal)?.id ?? null,
    vendedor_id: d.vendedor,
    responsable_id: d.responsable ?? null,
    disenador_id: d.disenador ?? null,
    titulo: d.titulo,
    descripcion: d.descripcion ?? null,
    estado: d.estado,
    estado_anterior: d.estado === 'pausado' ? (d.estadoAnterior ?? null) : null,
    motivo_estado: d.estado === 'pausado' || d.estado === 'cancelado' ? (d.motivo ?? null) : null,
    etapas_omitidas: d.omitidas ?? (d.instalacion ? [] : ['en_instalacion']),
    prioridad: d.prioridad ?? 'normal',
    fecha_entrega: d.entrega,
    requiere_instalacion: d.instalacion ?? false,
    direccion_instalacion: d.direccion ?? null,
    anticipo_pct: 50,
    aplica_iva: d.iva ?? true,
    iva_pct: 16,
    descuento_tipo: 'monto',
    descuento_valor: 0,
    recargo_pct: 0,
    recargo_concepto: 'Recargo por urgencia',
    subtotal: 0,
    descuento: 0,
    recargo: 0,
    iva: 0,
    total: 0,
    condiciones: cot?.condiciones ?? null,
    pagado: 0,
    saldo: 0,
    estado_pago: 'pendiente',
    fecha_limite_pago: d.limitePago ?? null,
    requiere_factura: cliente.requiere_factura,
    facturado: Boolean(d.factura),
    folio_factura: d.factura ?? null,
    fecha_factura: d.factura ? (d.terminado ?? d.creado) : null,
    notas_internas: d.notasInternas ?? null,
    entregado_at: ['entregado', 'finalizado'].includes(d.estado) ? terminado : null,
    finalizado_at: d.estado === 'finalizado' ? terminado : null,
    cancelado_at: d.estado === 'cancelado' ? terminado : null,
    created_by: d.vendedor,
    created_at: creado,
    updated_at: terminado ?? creado,
  }
  a.pedidos.push(p)

  d.partidas.forEach((x, i) => {
    const id = `${d.id}-pa${i + 1}`
    a.partidas.push({
      id,
      cotizacion_id: null,
      pedido_id: d.id,
      orden: i + 1,
      tipo: x.tipo ?? 'concepto',
      producto_id: x.producto ?? null,
      concepto: x.concepto,
      descripcion: x.descripcion ?? null,
      metodo_calculo: x.metodo,
      unidad: x.unidad ?? (x.metodo === 'millar' ? 'millar' : x.metodo === 'servicio' ? 'servicio' : x.metodo === 'proyecto' ? 'proyecto' : 'pza'),
      ancho: x.ancho ?? null,
      alto: x.alto ?? null,
      largo: x.largo ?? null,
      cantidad: x.cantidad,
      precio_unitario: x.pu,
      descuento_pct: 0,
      importe: importePartida(x.cantidad, x.pu),
      notas_produccion: x.notas ?? null,
      created_at: creado,
      updated_at: creado,
    })
    if (x.costo !== undefined) {
      a.partida_costos.push({
        partida_id: id,
        costo_material: 0,
        costo_mano_obra: 0,
        costo_fijo: x.costo,
        desperdicio_pct: 0,
        ganancia_pct: 0,
        costo_total: x.costo,
        calculo: { origen: 'manual' },
        updated_at: creado,
      })
    }
  })

  // Línea de tiempo: alta, asignaciones y cambios de etapa repartidos hasta hoy (o hasta que terminó).
  eventoPedido(a, d.id, {
    tipo: 'creado',
    estado_a: 'nuevo',
    mensaje: cot ? `Pedido creado desde la cotización ${cot.folio}` : 'Pedido creado',
    usuario_id: d.vendedor,
    created_at: creado,
  })
  if (d.responsable) eventoPedido(a, d.id, { tipo: 'asignacion', mensaje: `Responsable: ${nombre(d.responsable)}`, usuario_id: d.vendedor, created_at: creado })
  if (d.disenador) eventoPedido(a, d.id, { tipo: 'asignacion', mensaje: `Diseño asignado a: ${nombre(d.disenador)}`, usuario_id: d.vendedor, created_at: creado })

  d.pagos.forEach((x, i) => {
    const cuando = c.ts(x.fecha, 11 + (i % 5), 20)
    a.pagos.push({
      id: `${d.id}-pg${i + 1}`,
      pedido_id: d.id,
      cliente_id: d.cliente,
      fecha: x.fecha,
      importe: x.importe,
      tipo: x.tipo,
      metodo: x.metodo,
      referencia: x.referencia ?? null,
      comprobante_path: null,
      notas: x.notas ?? null,
      registrado_por: x.por,
      cancelado: false,
      motivo_cancelacion: null,
      cancelado_por: null,
      cancelado_at: null,
      created_at: cuando,
      updated_at: cuando,
    })
    const txt = { anticipo: 'Anticipo registrado', liquidacion: 'Liquidación registrada', devolucion: 'Devolución registrada', abono: 'Pago registrado' }[x.tipo]
    eventoPedido(a, d.id, { tipo: 'pago', mensaje: `${txt} (${x.metodo})`, usuario_id: x.por, created_at: cuando })
  })

  const pasos = recorrido(d).slice(1)
  const inicio = new Date(creado).getTime()
  const fin = terminado ? new Date(terminado).getTime() : Math.max(inicio, Date.now() - 30 * 60_000)
  let previo: EstadoPedido = 'nuevo'
  pasos.forEach((estado, i) => {
    const cuando = new Date(inicio + ((fin - inicio) * (i + 1)) / (pasos.length + 1)).toISOString()
    eventoPedido(a, d.id, {
      tipo: 'estado',
      estado_de: previo,
      estado_a: estado,
      mensaje: estado === 'pausado' || estado === 'cancelado' ? (d.motivo ?? null) : null,
      usuario_id: estado === 'cancelado' ? A : d.responsable ?? d.vendedor,
      created_at: cuando,
    })
    previo = estado
  })
  if (d.factura) {
    eventoPedido(a, d.id, { tipo: 'factura', mensaje: `Marcado como facturado (folio ${d.factura})`, usuario_id: A, created_at: terminado ?? creado })
  }

  recalcularPedido(a, p)
}

/** Diseños con versiones y aprobaciones (2 pendientes, como el panel anterior). */
function archivos(a: Almacen, c: Ctx) {
  type Def = [pedido: string, nombre: string, version: number, estado: Enums['estado_archivo'], diasAtras: number, aprobo?: string, notas?: string, externo?: string]
  const defs: Def[] = [
    ['demo-ped-5', 'Lona fachada norte', 1, 'cambios', 3, 'Ing. Roberto Salas', 'Respuesta desde el portal del cliente: cambiar el teléfono de ventas por el 33 0000 0000.'],
    ['demo-ped-5', 'Lona fachada norte', 2, 'pendiente', 1],
    ['demo-ped-5', 'Lona caseta de ventas', 3, 'pendiente', 0],
    ['demo-ped-3', 'Señalética consultorios', 1, 'aprobado', 4, 'Dra. Mariana Gil', 'Aprobado por WhatsApp.'],
    ['demo-ped-d', 'Letras volumétricas', 1, 'cambios', 9, 'Taller Mecánico Rueda', 'Quiere las letras más gruesas.'],
    ['demo-ped-d', 'Letras volumétricas', 2, 'aprobado', 7, 'Taller Mecánico Rueda', 'Aprobado en mostrador.'],
    ['demo-ped-a', 'Vinil esmerilado recepción', 1, 'aprobado', 11, 'Mtra. Elena Campos'],
    ['demo-ped-c', 'Playeras torneo', 1, 'cambios', 6, 'Gimnasio Titán', 'Cambiar el azul por el del logo nuevo.'],
    ['demo-ped-h', 'Vinil vitrina', 1, 'cambios', 1, 'Boutique Lirio', 'Usar la tipografía de la marca.'],
    ['demo-ped-i', 'Lona inauguración', 1, 'aprobado', 1, 'Gimnasio Titán', 'Aprobado por WhatsApp.'],
    ['demo-ped-g', 'Volantes temporada', 1, 'aprobado', 2, 'Mariana Pérez', 'Aprobado por correo.'],
    ['demo-ped-j', 'Etiquetas salsas', 1, 'aprobado', 0, 'Taquería Los Compadres', 'Mismo diseño que el pedido anterior.'],
    ['demo-ped-b', 'Banner expo', 1, 'aprobado', 15, 'Boutique Lirio', 'Aprobado en mostrador.'],
    ['demo-ped-f', 'Rotulación camioneta', 1, 'aprobado', 16, 'Taller Mecánico Rueda', 'Aprobado por WhatsApp.', 'https://example.com/disenos/rotulacion-camioneta-v1.pdf'],
  ]
  defs.forEach(([pedidoId, nombre, version, estado, dias, aprobo, notas, externo], i) => {
    const pedido = a.pedidos.find((p) => p.id === pedidoId)!
    const fecha = c.enMesActual(c.dia(-dias))
    const subido = c.ts(fecha, 9 + (i % 4), 30)
    const respondido = estado === 'pendiente' ? null : c.ts(fecha, 16, 10)
    const archivo = `${nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-')}-v${version}.png`
    a.archivos.push({
      id: `demo-arch-${i + 1}`,
      pedido_id: pedidoId,
      cliente_id: pedido.cliente_id,
      categoria: 'diseno',
      nombre: `${nombre} v${version}`,
      path: externo ? null : `pedidos/${pedidoId}/${archivo}`,
      enlace_externo: externo ?? null,
      mime: externo ? 'application/pdf' : 'image/png',
      tamano: externo ? null : 180_000 + i * 7_300,
      version,
      estado_aprobacion: estado,
      aprobado_por_nombre: aprobo ?? null,
      aprobacion_notas: notas ?? null,
      aprobacion_registrada_por: estado === 'pendiente' ? null : D,
      aprobacion_at: respondido,
      subido_por: D,
      created_at: subido,
      updated_at: respondido ?? subido,
    })
    eventoPedido(a, pedidoId, { tipo: 'archivo', mensaje: `Diseño v${version} subido: ${nombre} v${version}`, usuario_id: D, created_at: subido })
    if (respondido) {
      const txt = estado === 'aprobado' ? 'aprobado' : estado === 'cambios' ? 'cambios solicitados' : 'rechazado'
      eventoPedido(a, pedidoId, {
        tipo: 'aprobacion',
        mensaje: `Diseño v${version}: ${txt}${aprobo ? ` por ${aprobo}` : ''}${notas ? `. ${notas}` : ''}`,
        usuario_id: D,
        created_at: respondido,
      })
    }
  })
  // Referencia del cliente (no requiere aprobación)
  a.archivos.push({
    id: 'demo-arch-ref-1',
    pedido_id: 'demo-ped-c',
    cliente_id: 'c2',
    categoria: 'referencia',
    nombre: 'Logo nuevo del gimnasio',
    path: 'pedidos/demo-ped-c/logo-gimnasio.png',
    enlace_externo: null,
    mime: 'image/png',
    tamano: 96_000,
    version: null,
    estado_aprobacion: 'no_aplica',
    aprobado_por_nombre: null,
    aprobacion_notas: null,
    aprobacion_registrada_por: null,
    aprobacion_at: null,
    subido_por: V,
    created_at: c.ts(c.enMesActual(c.dia(-11)), 12),
    updated_at: c.ts(c.enMesActual(c.dia(-11)), 12),
  })
}

export function semillaVentas(a: Almacen, c: Ctx, perfiles: Record<Rol, Perfil>) {
  a.cotizaciones = cotizacionesDemo(perfiles, c.hoy)
  const nombre = (id: string) => a.perfiles.find((p) => p.id === id)?.nombre ?? 'sin nombre'

  const hist = historicos(c).sort((x, y) => x.creado.localeCompare(y.creado) || x.id.localeCompare(y.id))
  hist.forEach((d, i) => agregarPedido(a, c, d, `PED-${String(i + 1).padStart(4, '0')}`, nombre))
  for (const d of delMes(c)) agregarPedido(a, c, d, d.folio!, nombre)
  a.pedido_eventos.sort((x, y) => x.created_at.localeCompare(y.created_at) || x.id - y.id)

  archivos(a, c)

  // Pedidos por cliente: última compra (como el trigger de pedidos)
  for (const cliente of a.clientes) {
    const fechas = a.pedidos.filter((p) => p.cliente_id === cliente.id).map((p) => p.created_at).sort()
    cliente.ultima_compra_at = fechas.at(-1) ?? null
  }
  a.folios.pedido = a.pedidos.length + 1
  a.folios.cotizacion = a.cotizaciones.length + 1
}
