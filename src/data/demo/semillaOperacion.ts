/**
 * Semilla de la vista previa · operación: proveedores, materiales con kárdex (4 en stock bajo),
 * gastos (algunos ligados a pedidos), cortes de caja de los días anteriores y tareas del
 * equipo (de hoy, atrasadas y próximas). DATOS FICTICIOS.
 */
import type { Database } from '@/lib/database.types'
import type { MetodoPago } from '../tipos'
import type { Almacen } from './almacen'
import { aplicarMovimiento, bajoMinimo, calcularCaja, redondear2 } from './reglas'
import { busquedaDe, type Ctx } from './semillaContexto'

type Enums = Database['public']['Enums']
const A = 'demo-admin'
const V = 'demo-ventas'
const D = 'demo-diseno'
const P = 'demo-produccion'
const P2 = 'demo-instalador'

export function semillaProveedores(c: Ctx): Almacen['proveedores'] {
  const filas: Array<[string, string, string | null, string | null, string | null, string | null, string]> = [
    ['prov-lonas', 'Distribuidora de Lonas del Bajío', 'Ramón Ortiz', '3330001100', 'ventas@lonasbajio.demo', 'DLB150301AB1', 'Lonas y sustratos'],
    ['prov-vinil', 'Viniles y Sustratos GDL', 'Karla Núñez', '3330002200', 'pedidos@vinilesgdl.demo', 'VSG170815CD2', 'Viniles'],
    ['prov-papel', 'Papelera Industrial de Occidente', 'Mostrador', '3330003300', null, null, 'Papel'],
    ['prov-tintas', 'Tintas y Equipos Digitales', 'Óscar Lara', '3330004400', 'soporte@tintasdigitales.demo', 'TED190920EF3', 'Tintas y refacciones'],
    ['prov-laser', 'Acrílicos y Corte Láser Jalisco', 'Fernanda Ríos', '3330005500', 'cotiza@laserjalisco.demo', null, 'Maquila y acrílico'],
    ['prov-textil', 'Textiles Promocionales Tapatíos', 'Javier Mora', '3330006600', null, null, 'Textiles'],
  ]
  const creado = c.ts(c.mes(6).dia(3), 10)
  return filas.map(([id, nombre, contacto, whatsapp, email, rfc, categoria]) => ({
    id,
    nombre,
    contacto,
    telefono: null,
    whatsapp,
    email,
    rfc,
    categoria,
    notas: null,
    activo: true,
    busqueda: busquedaDe(nombre, contacto, whatsapp, email, rfc, categoria),
    created_by: A,
    created_at: creado,
    updated_at: creado,
  }))
}

/** Materiales, costos y movimientos (entradas, consumos ligados a pedidos, una merma y un ajuste). */
export function semillaInventario(a: Almacen, c: Ctx) {
  type Mat = [id: string, nombre: string, categoria: string, unidad: Enums['unidad_material'], minimo: number, proveedor: string | null, costo: number, ubicacion: string, activo?: boolean]
  const mats: Mat[] = [
    ['mat-lona', 'Lona front 13 oz', 'Lonas', 'm2', 50, 'prov-lonas', 38, 'Rack A'],
    ['mat-vinil', 'Vinil blanco brillante', 'Viniles', 'm2', 30, 'prov-vinil', 42, 'Rack B'],
    ['mat-micro', 'Vinil microperforado', 'Viniles', 'm2', 15, 'prov-vinil', 68, 'Rack B'],
    ['mat-esmerilado', 'Vinil esmerilado', 'Viniles', 'm2', 10, 'prov-vinil', 75, 'Rack B'],
    ['mat-couche300', 'Papel couché 300 g tabloide', 'Papel', 'hoja', 500, 'prov-papel', 4.2, 'Anaquel 1'],
    ['mat-couche150', 'Papel couché 150 g tabloide', 'Papel', 'hoja', 1000, 'prov-papel', 2.1, 'Anaquel 1'],
    ['mat-tinta-c', 'Tinta eco-solvente cian', 'Tintas', 'litro', 2, 'prov-tintas', 620, 'Gabinete de tintas'],
    ['mat-tinta-m', 'Tinta eco-solvente magenta', 'Tintas', 'litro', 2, 'prov-tintas', 620, 'Gabinete de tintas'],
    ['mat-acrilico', 'Acrílico transparente 3 mm (1.22 × 2.44 m)', 'Acrílico', 'pieza', 4, 'prov-laser', 980, 'Bodega'],
    ['mat-dtf', 'Película DTF', 'Textil', 'metro', 20, 'prov-textil', 55, 'Rack C'],
    ['mat-tazas', 'Tazas blancas 11 oz para sublimar', 'Promocionales', 'pieza', 36, 'prov-textil', 28, 'Bodega'],
    ['mat-playeras', 'Playeras dry-fit blancas', 'Textil', 'pieza', 24, 'prov-textil', 62, 'Rack C'],
    ['mat-ojillos', 'Ojillos metálicos', 'Accesorios', 'millar', 1, 'prov-lonas', 180, 'Cajón de accesorios'],
    ['mat-mesh', 'Lona mesh', 'Lonas', 'm2', 0, 'prov-lonas', 52, 'Rack A', false],
  ]
  const alta = c.mes(4).dia(1)
  for (const [id, nombre, categoria, unidad, minimo, proveedor, costo, ubicacion, activo] of mats) {
    const creado = c.ts(alta, 9)
    a.materiales.push({
      id,
      nombre,
      categoria,
      unidad,
      existencia: 0,
      stock_minimo: minimo,
      bajo_minimo: false,
      proveedor_id: proveedor,
      ubicacion,
      notas: activo === false ? 'Ya no se compra: se usa lona front.' : null,
      activo: activo ?? true,
      busqueda: busquedaDe(nombre, categoria, ubicacion),
      created_by: A,
      created_at: creado,
      updated_at: creado,
    })
    a.material_costos.push({ material_id: id, costo_unitario: costo, updated_at: creado })
  }

  const f = (n: number) => c.enMesActual(c.dia(n))
  const m = (k: number, d: number) => c.mes(k).dia(d)
  type Mov = [material: string, tipo: Enums['tipo_movimiento'], cantidad: number, fecha: string, quien: string, extra?: { pedido?: string; proveedor?: string; referencia?: string; notas?: string }]
  const movs: Mov[] = [
    ['mat-lona', 'ajuste', 80, alta, A, { referencia: 'Existencia inicial' }],
    ['mat-vinil', 'ajuste', 60, alta, A, { referencia: 'Existencia inicial' }],
    ['mat-micro', 'ajuste', 40, alta, A, { referencia: 'Existencia inicial' }],
    ['mat-esmerilado', 'ajuste', 26, alta, A, { referencia: 'Existencia inicial' }],
    ['mat-couche300', 'ajuste', 1500, alta, A, { referencia: 'Existencia inicial' }],
    ['mat-couche150', 'ajuste', 2000, alta, A, { referencia: 'Existencia inicial' }],
    ['mat-tinta-c', 'ajuste', 5, alta, A, { referencia: 'Existencia inicial' }],
    ['mat-tinta-m', 'ajuste', 5, alta, A, { referencia: 'Existencia inicial' }],
    ['mat-acrilico', 'ajuste', 6, alta, A, { referencia: 'Existencia inicial' }],
    ['mat-dtf', 'ajuste', 60, alta, A, { referencia: 'Existencia inicial' }],
    ['mat-tazas', 'ajuste', 84, alta, A, { referencia: 'Existencia inicial' }],
    ['mat-playeras', 'ajuste', 40, alta, A, { referencia: 'Existencia inicial' }],
    ['mat-ojillos', 'ajuste', 3, alta, A, { referencia: 'Existencia inicial' }],
    ['mat-dtf', 'consumo', 15, m(3, 11), P, { pedido: 'demo-h3-4' }],
    ['mat-couche150', 'consumo', 970, m(2, 6), P, { referencia: 'Volantes de mostrador' }],
    ['mat-lona', 'consumo', 64.6, m(2, 24), P, { pedido: 'demo-h2-1' }],
    ['mat-playeras', 'consumo', 36, m(2, 14), P, { pedido: 'demo-h2-6' }],
    ['mat-lona', 'entrada', 150, m(1, 5), A, { proveedor: 'prov-lonas', referencia: 'Factura DLB-2231' }],
    ['mat-vinil', 'entrada', 50, m(1, 5), A, { proveedor: 'prov-vinil', referencia: 'Factura VSG-0918' }],
    ['mat-couche150', 'entrada', 1000, m(1, 5), A, { proveedor: 'prov-papel', referencia: 'Nota 5512' }],
    ['mat-vinil', 'consumo', 21.4, m(1, 15), P, { pedido: 'demo-h1-2' }],
    ['mat-micro', 'consumo', 18, m(1, 18), P, { pedido: 'demo-h1-3' }],
    ['mat-esmerilado', 'consumo', 8, m(1, 19), P, { pedido: 'demo-h1-4' }],
    ['mat-tinta-c', 'consumo', 1.5, m(1, 20), P, { referencia: 'Consumo de impresora del mes' }],
    ['mat-tinta-m', 'consumo', 2, m(1, 20), P, { referencia: 'Consumo de impresora del mes' }],
    ['mat-vinil', 'consumo', 24.6, m(1, 23), P, { pedido: 'demo-h1-5' }],
    ['mat-lona', 'consumo', 120, m(1, 26), P, { pedido: 'demo-h1-1' }],
    ['mat-ojillos', 'consumo', 0.5, m(1, 26), P, { pedido: 'demo-h1-1' }],
    ['mat-couche300', 'consumo', 250, f(-13), P, { pedido: 'demo-ped-l' }],
    ['mat-esmerilado', 'consumo', 12, f(-11), P, { pedido: 'demo-ped-a' }],
    ['mat-playeras', 'entrada', 26, f(-10), A, { proveedor: 'prov-textil', referencia: 'Para PED-0040', pedido: 'demo-ped-c' }],
    ['mat-acrilico', 'entrada', 4, f(-9), A, { proveedor: 'prov-laser', referencia: 'Nota 0377' }],
    ['mat-acrilico', 'consumo', 2, f(-8), P, { pedido: 'demo-ped-d' }],
    ['mat-lona', 'consumo', 3.4, f(-15), P, { pedido: 'demo-ped-b' }],
    ['mat-lona', 'merma', 4, f(-6), P, { notas: 'Impresión con bandas: se repitió la lona.' }],
    ['mat-tinta-m', 'consumo', 1.5, f(-5), P, { referencia: 'Consumo de impresora' }],
    ['mat-acrilico', 'consumo', 1, f(-3), P, { pedido: 'demo-ped-3' }],
    ['mat-couche150', 'consumo', 1250, f(-2), P, { pedido: 'demo-ped-g' }],
  ]
  // Se aplican en orden de fecha, como se habrían registrado.
  const orden = movs.map((x, i) => ({ x, i })).sort((p, q) => p.x[3].localeCompare(q.x[3]) || p.i - q.i)
  orden.forEach(({ x: [material, tipo, cantidad, fecha, quien, extra], i }) => {
    const cuando = c.ts(fecha, 9 + (i % 8), 5 + (i % 50))
    aplicarMovimiento(a, {
      id: `mov-${String(i + 1).padStart(3, '0')}`,
      material_id: material,
      tipo,
      cantidad,
      pedido_id: extra?.pedido ?? null,
      proveedor_id: extra?.proveedor ?? null,
      referencia: extra?.referencia ?? null,
      notas: extra?.notas ?? null,
      usuario_id: quien,
      fecha: cuando,
      created_at: cuando,
    })
  })
  for (const mat of a.materiales) mat.bajo_minimo = bajoMinimo(mat)
}

/** Gastos del mes y de meses anteriores; varios ligados a pedidos (utilidad real) y uno cancelado. */
export function semillaGastos(c: Ctx): Almacen['gastos'] {
  const f = (n: number) => c.enMesActual(c.dia(n))
  const m = (k: number, d: number) => c.mes(k).dia(d)
  type G = [fecha: string, concepto: string, categoria: Enums['categoria_gasto'], monto: number, metodo: MetodoPago, quien: string, extra?: { proveedor?: string; pedido?: string; referencia?: string; cancelado?: string }]
  const gastos: G[] = [
    [m(3, 1), 'Renta del local', 'renta', 8500, 'transferencia', A],
    [m(2, 1), 'Renta del local', 'renta', 8500, 'transferencia', A],
    [m(2, 24), 'Maquila de impresión gran formato', 'maquila', 6200, 'transferencia', A, { proveedor: 'prov-lonas', pedido: 'demo-h2-1' }],
    [m(1, 1), 'Renta del local', 'renta', 8500, 'transferencia', A],
    [m(1, 5), 'Compra de lona front 13 oz (150 m²)', 'material', 5700, 'transferencia', A, { proveedor: 'prov-lonas', referencia: 'Factura DLB-2231' }],
    [m(1, 5), 'Compra de vinil blanco (50 m²)', 'material', 2100, 'transferencia', A, { proveedor: 'prov-vinil', referencia: 'Factura VSG-0918' }],
    [m(1, 5), 'Compra de papel couché 150 g (1000 hojas)', 'material', 2100, 'efectivo', A, { proveedor: 'prov-papel', referencia: 'Nota 5512' }],
    [m(1, 26), 'Estructura para espectacular', 'maquila', 7400, 'transferencia', A, { pedido: 'demo-h1-1' }],
    [m(1, 12), 'Luz (CFE)', 'servicios', 1280, 'transferencia', A],
    [c.inicioMes, 'Renta del local', 'renta', 8500, 'transferencia', A],
    [f(-10), 'Playeras dry-fit para torneo (26 pzas)', 'material', 1612, 'efectivo', A, { proveedor: 'prov-textil', pedido: 'demo-ped-c' }],
    [f(-9), 'Compra de acrílico 3 mm (4 hojas)', 'material', 3920, 'transferencia', A, { proveedor: 'prov-laser', referencia: 'Nota 0377' }],
    [f(-8), 'Maquila de corte láser para letras', 'maquila', 2200, 'transferencia', A, { proveedor: 'prov-laser', pedido: 'demo-ped-d' }],
    [f(-7), 'Publicidad en redes sociales', 'publicidad', 1200, 'tarjeta', A],
    [f(-6), 'Luz (CFE)', 'servicios', 1350, 'transferencia', A],
    [f(-5), 'Internet del local', 'servicios', 599, 'tarjeta', A],
    [f(-4), 'Tinta magenta (compra duplicada)', 'material', 1240, 'transferencia', A, { proveedor: 'prov-tintas', cancelado: 'Se capturó dos veces la misma compra.' }],
    [f(-1), 'Tornillería y taquetes para letras', 'material', 185, 'efectivo', V, { pedido: 'demo-ped-d' }],
    [f(0), 'Gasolina para instalación en Escuela Montessori', 'transporte', 450, 'efectivo', V, { pedido: 'demo-ped-a' }],
  ]
  return gastos.map(([fecha, concepto, categoria, monto, metodo, quien, extra], i) => {
    const cuando = c.ts(fecha, 12 + (i % 6), 40)
    return {
      id: `gasto-${String(i + 1).padStart(3, '0')}`,
      fecha,
      concepto,
      categoria,
      proveedor_id: extra?.proveedor ?? null,
      pedido_id: extra?.pedido ?? null,
      monto,
      metodo_pago: metodo,
      referencia: extra?.referencia ?? null,
      comprobante_path: null,
      notas: null,
      cancelado: Boolean(extra?.cancelado),
      motivo_cancelacion: extra?.cancelado ?? null,
      cancelado_por: extra?.cancelado ? A : null,
      cancelado_at: extra?.cancelado ? cuando : null,
      usuario_id: quien,
      created_at: cuando,
      updated_at: cuando,
    }
  })
}

/** Cortes de caja de los 5 días anteriores con movimientos (la caja de hoy sigue abierta). */
export function semillaCortes(a: Almacen, c: Ctx) {
  const fechas = new Set<string>()
  for (let n = 1; n <= 7 && fechas.size < 5; n++) {
    const d = c.dia(-n)
    if (a.pagos.some((p) => p.fecha === d) || a.gastos.some((g) => g.fecha === d)) fechas.add(d)
  }
  let inicial = 1500
  ;[...fechas].sort().forEach((fecha, i) => {
    const calc = calcularCaja(a, fecha, inicial, false)
    // Un día faltaron $50 en el conteo (para ver la diferencia en el corte)
    const contado = i === 1 ? redondear2(calc.esperado - 50) : calc.esperado
    const { corte: _c, cerrado: _x, efectivo_inicial_sugerido: _s, ...resumen } = calc
    const cerro = i % 2 === 0 ? V : A
    a.cortes_caja.push({
      id: `corte-${fecha}`,
      fecha,
      efectivo_inicial: inicial,
      efectivo_contado: contado,
      esperado: calc.esperado,
      diferencia: redondear2(contado - calc.esperado),
      resumen: resumen as unknown as Almacen['cortes_caja'][number]['resumen'],
      notas: i === 1 ? 'Faltaron $50; se revisará con el equipo.' : null,
      cerrado_por: cerro,
      created_at: c.ts(fecha, 19, 30),
    })
    inicial = contado
  })
}

/** Tareas del equipo: de hoy, atrasadas, próximas y algunas ya completadas. */
export function semillaTareas(c: Ctx): Almacen['tareas'] {
  type T = [titulo: string, tipo: Enums['tipo_tarea'], dias: number, hora: string | null, responsable: string, creador: string, prioridad: Enums['prioridad'], liga?: { cliente?: string; pedido?: string; oportunidad?: string; cotizacion?: string; descripcion?: string; completada?: number }]
  const tareas: T[] = [
    // Administración
    ['Revisar el corte de caja de ayer', 'recordatorio', 0, '09:00', A, A, 'normal'],
    ['Llamar a Constructora Altos de Jalisco por las lonas de obra', 'llamada', 0, '12:30', A, A, 'alta', { cliente: 'c17', oportunidad: 'o10' }],
    ['Autorizar la compra de lona front', 'tarea', -2, null, A, P, 'alta', { descripcion: 'La lona está por debajo del mínimo.' }],
    ['Visitar Ferretería El Tornillo para tomar medidas', 'seguimiento', 5, '10:00', A, A, 'normal', { cliente: 'c14', oportunidad: 'o6' }],
    ['Enviar lista de precios de agencia a Agencia Creativa Nube', 'tarea', 3, null, A, A, 'normal', { cliente: 'c10', oportunidad: 'o11' }],
    ['Pagar internet del local', 'recordatorio', -5, null, A, A, 'baja', { completada: -5 }],
    // Ventas
    ['Cobrar el saldo del banner para expo', 'recordatorio', -1, null, V, V, 'alta', { pedido: 'demo-ped-b' }],
    ['Confirmar diseño de playeras con Gimnasio Titán', 'llamada', 0, '11:00', V, V, 'normal', { pedido: 'demo-ped-c' }],
    ['Enviar muestras de papel a Boutique Lirio', 'tarea', 1, null, V, V, 'normal', { oportunidad: 'o2' }],
    ['Dar seguimiento a la cotización de fachada', 'seguimiento', 2, null, V, V, 'normal', { cotizacion: 'demo-cot-1' }],
    ['Llamar a Farmacia San Rafael para reactivarla', 'llamada', 4, null, V, A, 'baja', { cliente: 'c9', oportunidad: 'o8' }],
    ['Enviar la cotización de la fachada', 'tarea', -1, null, V, V, 'normal', { cotizacion: 'demo-cot-1', completada: -1 }],
    // Diseño
    ['Corregir el teléfono en la lona fachada norte', 'tarea', 0, null, D, A, 'alta', { pedido: 'demo-ped-5' }],
    ['Ajustar la tipografía del vinil para vitrina', 'tarea', -1, null, D, V, 'alta', { pedido: 'demo-ped-h' }],
    ['Propuesta v2 de playeras con el logo nuevo', 'tarea', 1, null, D, V, 'normal', { pedido: 'demo-ped-c' }],
    ['Preparar archivos de etiquetas para salsas', 'tarea', -1, null, D, P, 'normal', { pedido: 'demo-ped-j', completada: 0 }],
    // Producción
    ['Instalar vinil esmerilado en Escuela Montessori', 'instalacion', 0, '16:00', P, A, 'alta', { pedido: 'demo-ped-a' }],
    ['Revisar pintura de las letras volumétricas', 'tarea', 0, null, P, P, 'normal', { pedido: 'demo-ped-d' }],
    ['Pedir ojillos y cinta doble cara', 'recordatorio', -1, null, P, P, 'baja'],
    ['Imprimir etiquetas para salsas', 'tarea', 2, null, P, V, 'normal', { pedido: 'demo-ped-j' }],
    ['Entregar señalética en Clínica Dental Sonríe', 'entrega', 1, '10:00', P, A, 'alta', { pedido: 'demo-ped-3' }],
    ['Instalar lona de inauguración', 'instalacion', 2, '09:00', P2, A, 'normal', { pedido: 'demo-ped-i' }],
  ]
  const clienteDe: Record<string, string> = {
    'demo-ped-b': 'c7', 'demo-ped-c': 'c2', 'demo-ped-5': 'c5', 'demo-ped-h': 'c7', 'demo-ped-j': 'c4', 'demo-ped-a': 'c6',
    'demo-ped-d': 'c8', 'demo-ped-3': 'c3', 'demo-ped-i': 'c2', o2: 'c7', 'demo-cot-1': 'c1',
  }
  return tareas.map(([titulo, tipo, dias, hora, responsable, creador, prioridad, liga], i) => {
    const fecha = c.dia(dias)
    const creada = c.ts(c.dia(Math.min(dias, 0) - 2), 9, 10 + i)
    const completada = liga?.completada !== undefined
    const cuando = completada ? c.ts(c.dia(liga!.completada!), 17, 5) : null
    return {
      id: `tarea-${String(i + 1).padStart(2, '0')}`,
      titulo,
      descripcion: liga?.descripcion ?? null,
      tipo,
      fecha,
      hora,
      responsable_id: responsable,
      cliente_id: liga?.cliente ?? clienteDe[liga?.pedido ?? liga?.oportunidad ?? liga?.cotizacion ?? ''] ?? null,
      pedido_id: liga?.pedido ?? null,
      oportunidad_id: liga?.oportunidad ?? null,
      cotizacion_id: liga?.cotizacion ?? null,
      prioridad,
      completada,
      completada_at: cuando,
      completada_por: completada ? responsable : null,
      created_by: creador,
      created_at: creada,
      updated_at: cuando ?? creada,
    }
  })
}
