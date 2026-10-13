/**
 * Reglas de negocio de la VISTA PREVIA: imitan los triggers y funciones de la base de datos
 * (totales y estado de pago del pedido, línea de tiempo, bitácora, caja cerrada, existencias).
 * Las usan la semilla y las implementaciones demo de los módulos. Reciben el almacén como
 * parámetro para no depender del orden de carga.
 *
 * Es código compartido: si un módulo necesita cambiar una regla, pídelo al orquestador.
 */
import { calcularTotales } from '@/lib/calculadora'
import type { Json } from '@/lib/database.types'
import { normalizar } from '@/lib/utils'
import type { EstadoPedido, MetodoPago } from '../tipos'
import type { Almacen, PedidoFila } from './almacen'

export const redondear2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100

/** AAAA-MM-DD en hora local del navegador (la base usa la hora de Guadalajara). */
export function fechaLocal(valor: string | Date = new Date()) {
  const d = typeof valor === 'string' ? new Date(valor) : valor
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Marca de tiempo ISO para una fecha local (AAAA-MM-DD) a cierta hora local. */
export function marca(fecha: string, hora = 10, minuto = 0) {
  return new Date(`${fecha}T${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}:00`).toISOString()
}

export const ahoraISO = () => new Date().toISOString()

/** Texto de búsqueda (como las columnas generadas `busqueda`). */
export const busquedaDe = (...partes: Array<string | null | undefined>) => normalizar(partes.filter(Boolean).join(' '))

export function nombrePerfil(a: Almacen, id: string | null | undefined) {
  return id ? (a.perfiles.find((p) => p.id === id)?.nombre ?? null) : null
}

export function nombreCliente(a: Almacen, id: string | null | undefined) {
  return id ? (a.clientes.find((c) => c.id === id)?.nombre ?? null) : null
}

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------

export const ESTADOS_CERRADOS: EstadoPedido[] = ['entregado', 'finalizado', 'cancelado']

/** Igual que tg_calcular_totales(): totales desde las partidas y cobranza desde los pagos. */
export function recalcularPedido(a: Almacen, pedido: PedidoFila) {
  const importes = a.partidas.filter((p) => p.pedido_id === pedido.id).map((p) => Number(p.importe ?? 0))
  const t = calcularTotales({
    importes,
    descuentoTipo: pedido.descuento_tipo === 'pct' ? 'pct' : 'monto',
    descuentoValor: pedido.descuento_valor,
    recargoPct: pedido.recargo_pct,
    aplicaIva: pedido.aplica_iva,
    ivaPct: pedido.iva_pct,
  })
  pedido.subtotal = t.subtotal
  pedido.descuento = t.descuento
  pedido.recargo = t.recargo
  pedido.iva = t.iva
  pedido.total = t.total

  const pagos = a.pagos.filter((p) => p.pedido_id === pedido.id && !p.cancelado)
  const pagado = redondear2(pagos.reduce((s, p) => s + (p.tipo === 'devolucion' ? -p.importe : p.importe), 0))
  const huboPagos = pagos.some((p) => p.tipo !== 'devolucion')
  const soloAnticipos = pagos.filter((p) => p.tipo !== 'devolucion').every((p) => p.tipo === 'anticipo')
  pedido.pagado = pagado
  pedido.saldo = redondear2(pedido.total - pagado)
  pedido.estado_pago =
    pagado <= 0 && huboPagos
      ? 'reembolsado'
      : pagado <= 0
        ? 'pendiente'
        : pedido.total > 0 && pagado >= pedido.total
          ? 'liquidado'
          : soloAnticipos
            ? 'anticipo'
            : 'parcial'
}

/** Agrega un evento a la línea de tiempo del pedido (pedido_eventos). */
export function eventoPedido(
  a: Almacen,
  pedidoId: string,
  e: { tipo: string; estado_de?: EstadoPedido | null; estado_a?: EstadoPedido | null; mensaje?: string | null; usuario_id?: string | null; created_at?: string },
) {
  a.pedido_eventos.push({
    id: a.folios.evento++,
    pedido_id: pedidoId,
    tipo: e.tipo,
    estado_de: e.estado_de ?? null,
    estado_a: e.estado_a ?? null,
    mensaje: e.mensaje ?? null,
    usuario_id: e.usuario_id ?? null,
    created_at: e.created_at ?? ahoraISO(),
  })
}

/**
 * Igual que tg_pedidos_estado() + tg_pedidos_eventos(): valida el motivo, guarda el estado
 * anterior al pausar, fechas de entrega/cierre y registra el evento.
 */
export function aplicarEstadoPedido(a: Almacen, p: PedidoFila, estado: EstadoPedido, motivo: string | null, usuarioId: string | null, cuando = ahoraISO()) {
  if (p.estado === estado) return
  if ((estado === 'pausado' || estado === 'cancelado') && !motivo?.trim()) {
    throw new Error(`Indica el motivo para ${estado === 'pausado' ? 'pausar' : 'cancelar'} el pedido`)
  }
  const anterior = p.estado
  if (estado === 'pausado') {
    p.estado_anterior = anterior
    p.motivo_estado = motivo!.trim()
  } else if (estado === 'cancelado') {
    p.motivo_estado = motivo!.trim()
    p.cancelado_at = cuando
  } else {
    p.motivo_estado = null
    p.estado_anterior = null
  }
  if (anterior === 'cancelado' && estado !== 'cancelado') p.cancelado_at = null
  if (estado === 'entregado') p.entregado_at ??= cuando
  if (estado === 'finalizado') {
    p.entregado_at ??= cuando
    p.finalizado_at ??= cuando
  }
  p.estado = estado
  p.updated_at = cuando
  eventoPedido(a, p.id, {
    tipo: 'estado',
    estado_de: anterior,
    estado_a: estado,
    mensaje: estado === 'pausado' || estado === 'cancelado' ? p.motivo_estado : null,
    usuario_id: usuarioId,
    created_at: cuando,
  })
}

// ---------------------------------------------------------------------------
// Bitácora
// ---------------------------------------------------------------------------

export type AccionBitacora = 'crear' | 'modificar' | 'eliminar' | 'cambio_estado' | 'aprobar' | 'cancelar'

export function registrarBitacora(
  a: Almacen,
  e: { tabla: string; registro_id: string | null; accion: AccionBitacora; etiqueta: string | null; cambios?: Json | null; datos?: Json | null; usuario_id: string | null; created_at?: string },
) {
  a.bitacora.push({
    id: a.folios.bitacora++,
    tabla: e.tabla,
    registro_id: e.registro_id,
    accion: e.accion,
    etiqueta: e.etiqueta,
    cambios: e.cambios ?? null,
    datos: e.datos ?? null,
    usuario_id: e.usuario_id,
    usuario_nombre: e.usuario_id ? nombrePerfil(a, e.usuario_id) : 'Sistema',
    created_at: e.created_at ?? ahoraISO(),
  })
}

/** Cambios {campo: [antes, después]} entre dos versiones de un registro (para la bitácora). */
export function diferencias(antes: Record<string, unknown>, despues: Record<string, unknown>, ignorar: string[] = ['updated_at', 'busqueda']) {
  const cambios: Record<string, [unknown, unknown]> = {}
  for (const k of Object.keys(despues)) {
    if (ignorar.includes(k)) continue
    if (JSON.stringify(antes[k]) !== JSON.stringify(despues[k])) cambios[k] = [antes[k] ?? null, despues[k] ?? null]
  }
  return cambios as unknown as Json
}

// ---------------------------------------------------------------------------
// Caja
// ---------------------------------------------------------------------------

export const cajaCerrada = (a: Almacen, fecha: string) => a.cortes_caja.some((c) => c.fecha === fecha)

/**
 * Igual que tg_caja_cerrada(): con la caja del día cerrada, solo administración registra o
 * cambia movimientos EN EFECTIVO de esa fecha.
 */
export function validarCajaAbierta(a: Almacen, fecha: string, metodo: MetodoPago, esAdmin: boolean) {
  if (esAdmin || metodo !== 'efectivo' || !cajaCerrada(a, fecha)) return
  const [y, m, d] = fecha.split('-')
  throw new Error(
    `La caja del ${d}/${m}/${y} ya está cerrada. Pide a administración que la reabra para registrar o cambiar movimientos en efectivo de ese día.`,
  )
}

/** Resultado de corte_caja_calcular() (misma forma que la función de la base de datos). */
export interface CalculoCaja {
  fecha: string
  cerrado: boolean
  efectivo_inicial: number
  efectivo_inicial_sugerido: number | null
  totales: { entradas: number; devoluciones: number; neto: number }
  efectivo: { entradas: number; devoluciones: number; gastos: number; neto: number }
  esperado: number
  entradas_por_metodo: Array<{ metodo: MetodoPago; pagos: number; total: number }>
  devoluciones_por_metodo: Array<{ metodo: MetodoPago; pagos: number; total: number }>
  por_usuario: Array<{ usuario_id: string | null; nombre: string; pagos: number; entradas: number; devoluciones: number; neto: number; efectivo_neto: number }>
  pagos: Array<{ id: string; pedido_id: string; folio: string; cliente: string | null; tipo: string; metodo: MetodoPago; importe: number; referencia: string | null; registrado_por: string | null; usuario: string | null; created_at: string }>
  cancelados: { pagos: number; total: number }
  corte: (Almacen['cortes_caja'][number] & { cerrado_por_nombre: string | null }) | null
  gastos_por_metodo?: Array<{ metodo: MetodoPago; gastos: number; total: number }>
  gastos?: Array<{ id: string; concepto: string; categoria: string; monto: number; metodo_pago: MetodoPago; proveedor: string | null; pedido_id: string | null }>
}

/** Igual que corte_caja_calcular(p_fecha, p_efectivo_inicial, p_detalle_gastos). */
export function calcularCaja(a: Almacen, fecha: string, efectivoInicial: number | null, detalleGastos: boolean): CalculoCaja {
  const corte = a.cortes_caja.find((c) => c.fecha === fecha) ?? null
  const sugerido = [...a.cortes_caja].filter((c) => c.fecha < fecha).sort((x, y) => y.fecha.localeCompare(x.fecha))[0]?.efectivo_contado ?? null
  const inicial = efectivoInicial ?? corte?.efectivo_inicial ?? sugerido ?? 0
  const delDia = a.pagos.filter((p) => p.fecha === fecha && !p.cancelado).sort((x, y) => x.created_at.localeCompare(y.created_at))
  const suma = (xs: number[]) => redondear2(xs.reduce((s, x) => s + x, 0))
  const entradas = suma(delDia.filter((p) => p.tipo !== 'devolucion').map((p) => p.importe))
  const devoluciones = suma(delDia.filter((p) => p.tipo === 'devolucion').map((p) => p.importe))
  const efEntradas = suma(delDia.filter((p) => p.tipo !== 'devolucion' && p.metodo === 'efectivo').map((p) => p.importe))
  const efDevoluciones = suma(delDia.filter((p) => p.tipo === 'devolucion' && p.metodo === 'efectivo').map((p) => p.importe))
  const gastosDia = a.gastos.filter((g) => g.fecha === fecha && !g.cancelado).sort((x, y) => x.created_at.localeCompare(y.created_at))
  const efGastos = suma(gastosDia.filter((g) => g.metodo_pago === 'efectivo').map((g) => g.monto))

  const porMetodo = (lista: typeof delDia) => {
    const m = new Map<MetodoPago, { metodo: MetodoPago; pagos: number; total: number }>()
    for (const p of lista) {
      const x = m.get(p.metodo) ?? { metodo: p.metodo, pagos: 0, total: 0 }
      x.pagos++
      x.total = redondear2(x.total + p.importe)
      m.set(p.metodo, x)
    }
    return [...m.values()].sort((x, y) => x.metodo.localeCompare(y.metodo))
  }

  const usuarios = new Map<string, CalculoCaja['por_usuario'][number]>()
  for (const p of delDia) {
    const k = p.registrado_por ?? ''
    const u = usuarios.get(k) ?? { usuario_id: p.registrado_por, nombre: nombrePerfil(a, p.registrado_por) ?? 'Sin usuario', pagos: 0, entradas: 0, devoluciones: 0, neto: 0, efectivo_neto: 0 }
    const signo = p.tipo === 'devolucion' ? -1 : 1
    u.pagos++
    if (signo > 0) u.entradas = redondear2(u.entradas + p.importe)
    else u.devoluciones = redondear2(u.devoluciones + p.importe)
    u.neto = redondear2(u.entradas - u.devoluciones)
    if (p.metodo === 'efectivo') u.efectivo_neto = redondear2(u.efectivo_neto + signo * p.importe)
    usuarios.set(k, u)
  }

  const canceladosDia = a.pagos.filter((p) => p.fecha === fecha && p.cancelado)
  const r: CalculoCaja = {
    fecha,
    cerrado: Boolean(corte),
    efectivo_inicial: inicial,
    efectivo_inicial_sugerido: sugerido,
    totales: { entradas, devoluciones, neto: redondear2(entradas - devoluciones) },
    efectivo: { entradas: efEntradas, devoluciones: efDevoluciones, gastos: efGastos, neto: redondear2(efEntradas - efDevoluciones - efGastos) },
    esperado: redondear2(inicial + efEntradas - efDevoluciones - efGastos),
    entradas_por_metodo: porMetodo(delDia.filter((p) => p.tipo !== 'devolucion')),
    devoluciones_por_metodo: porMetodo(delDia.filter((p) => p.tipo === 'devolucion')),
    por_usuario: [...usuarios.values()].sort((x, y) => x.nombre.localeCompare(y.nombre)),
    pagos: delDia.map((p) => {
      const ped = a.pedidos.find((x) => x.id === p.pedido_id)
      return {
        id: p.id,
        pedido_id: p.pedido_id,
        folio: ped?.folio ?? '',
        cliente: nombreCliente(a, p.cliente_id),
        tipo: p.tipo,
        metodo: p.metodo,
        importe: p.importe,
        referencia: p.referencia,
        registrado_por: p.registrado_por,
        usuario: nombrePerfil(a, p.registrado_por),
        created_at: p.created_at,
      }
    }),
    cancelados: { pagos: canceladosDia.length, total: suma(canceladosDia.map((p) => p.importe)) },
    corte: corte ? { ...corte, cerrado_por_nombre: nombrePerfil(a, corte.cerrado_por) } : null,
  }
  if (detalleGastos) {
    const m = new Map<MetodoPago, { metodo: MetodoPago; gastos: number; total: number }>()
    for (const g of gastosDia) {
      const x = m.get(g.metodo_pago) ?? { metodo: g.metodo_pago, gastos: 0, total: 0 }
      x.gastos++
      x.total = redondear2(x.total + g.monto)
      m.set(g.metodo_pago, x)
    }
    r.gastos_por_metodo = [...m.values()].sort((x, y) => x.metodo.localeCompare(y.metodo))
    r.gastos = gastosDia.map((g) => ({
      id: g.id,
      concepto: g.concepto,
      categoria: g.categoria,
      monto: g.monto,
      metodo_pago: g.metodo_pago,
      proveedor: a.proveedores.find((p) => p.id === g.proveedor_id)?.nombre ?? null,
      pedido_id: g.pedido_id,
    }))
  }
  return r
}

// ---------------------------------------------------------------------------
// Inventario
// ---------------------------------------------------------------------------

/** Igual que delta_inventario(): entrada y ajuste suman (el ajuste lleva signo); consumo y merma restan. */
export const deltaInventario = (tipo: string, cantidad: number) => (tipo === 'entrada' || tipo === 'ajuste' ? cantidad : -cantidad)

export function existenciaCalculada(a: Almacen, materialId: string) {
  return Math.round(a.movimientos_inventario.filter((m) => m.material_id === materialId).reduce((s, m) => s + deltaInventario(m.tipo, m.cantidad), 0) * 1000) / 1000
}

/** Igual que la columna generada bajo_minimo. */
export function bajoMinimo(m: { activo: boolean; existencia: number; stock_minimo: number }) {
  return m.activo && (m.existencia < 0 || (m.stock_minimo > 0 && m.existencia <= m.stock_minimo))
}

/**
 * Igual que los triggers de movimientos_inventario: valida existencia suficiente para consumos
 * y mermas, calcula la existencia resultante y actualiza el material.
 */
export function aplicarMovimiento(
  a: Almacen,
  mov: Omit<Almacen['movimientos_inventario'][number], 'existencia_resultante' | 'created_at'> & { created_at?: string },
) {
  const material = a.materiales.find((m) => m.id === mov.material_id)
  if (!material) throw new Error('Material no encontrado')
  if (mov.tipo === 'ajuste' ? mov.cantidad === 0 : !(mov.cantidad > 0)) throw new Error('Indica una cantidad mayor a cero')
  const actual = existenciaCalculada(a, material.id)
  const nueva = Math.round((actual + deltaInventario(mov.tipo, mov.cantidad)) * 1000) / 1000
  if (nueva < 0 && (mov.tipo === 'consumo' || mov.tipo === 'merma')) {
    throw new Error(
      `No hay suficiente existencia de ${material.nombre}: quedan ${actual} ${material.unidad}. Registra primero la entrada del material o pide un ajuste de inventario.`,
    )
  }
  const fila = { ...mov, existencia_resultante: nueva, created_at: mov.created_at ?? ahoraISO() }
  a.movimientos_inventario.push(fila)
  material.existencia = nueva
  material.bajo_minimo = bajoMinimo(material)
  return fila
}

// ---------------------------------------------------------------------------
// Folios, etapas y archivos de diseño
// ---------------------------------------------------------------------------

/** Siguiente folio (como tg_asignar_folio): PED-0049, COT-0011… */
export function siguienteFolio(a: Almacen, tipo: 'pedido' | 'cotizacion') {
  const prefijo = tipo === 'pedido' ? a.configuracion.prefijo_pedido || 'PED' : a.configuracion.prefijo_cotizacion || 'COT'
  return `${prefijo}-${String(a.folios[tipo]++).padStart(4, '0')}`
}

/**
 * Etapas que se omiten según los conceptos (igual que convertir_cotizacion_a_pedido):
 * sin diseño → sin etapas de diseño; sin producción → sin taller; sin instalación → sin instalación.
 */
export function etapasOmitidas(a: Almacen, partidas: Array<{ tipo: string; producto_id: string | null }>) {
  const prod = (id: string | null) => a.productos.find((p) => p.id === id)
  const diseno = partidas.some((p) => (p.tipo === 'diseno' ? true : ['instalacion', 'transporte'].includes(p.tipo) ? false : (prod(p.producto_id)?.requiere_diseno ?? true)))
  const produccion = partidas.some((p) => (['instalacion', 'transporte', 'diseno'].includes(p.tipo) ? false : (prod(p.producto_id)?.requiere_produccion ?? true)))
  const instalacion = partidas.some((p) => p.tipo === 'instalacion' || Boolean(prod(p.producto_id)?.requiere_instalacion))
  const omitidas: EstadoPedido[] = []
  if (!diseno) omitidas.push('en_diseno', 'esperando_aprobacion', 'aprobado')
  if (!produccion) omitidas.push('en_produccion', 'acabados')
  if (!instalacion) omitidas.push('en_instalacion')
  return { omitidas, instalacion }
}

type ArchivoFila = Almacen['archivos'][number]

/**
 * Igual que tg_archivos_antes/después al subir: versión consecutiva y "pendiente" para diseños,
 * evento en la línea de tiempo y el pedido pasa a "esperando aprobación" si estaba en diseño.
 */
export function registrarArchivo(a: Almacen, fila: ArchivoFila, usuarioId: string | null) {
  const pedido = fila.pedido_id ? a.pedidos.find((p) => p.id === fila.pedido_id) : undefined
  if (pedido && !fila.cliente_id) fila.cliente_id = pedido.cliente_id
  if (fila.categoria === 'diseno') {
    if (fila.pedido_id) fila.version = Math.max(0, ...a.archivos.filter((x) => x.pedido_id === fila.pedido_id && x.categoria === 'diseno').map((x) => x.version ?? 0)) + 1
    fila.estado_aprobacion = 'pendiente'
  } else {
    fila.version = null
    fila.estado_aprobacion = 'no_aplica'
  }
  fila.aprobacion_registrada_por = null
  fila.aprobacion_at = null
  a.archivos.push(fila)
  if (!pedido) return fila
  eventoPedido(a, pedido.id, {
    tipo: 'archivo',
    mensaje: fila.categoria === 'diseno' ? `Diseño v${fila.version} subido: ${fila.nombre}` : `Archivo agregado: ${fila.nombre}`,
    usuario_id: usuarioId,
  })
  if (fila.categoria === 'diseno' && ['nuevo', 'en_diseno'].includes(pedido.estado) && !pedido.etapas_omitidas.includes('esperando_aprobacion')) {
    aplicarEstadoPedido(a, pedido, 'esperando_aprobacion', null, usuarioId)
  }
  return fila
}

/**
 * Igual que la aprobación de archivos (tg_archivos_*): registra quién respondió, evento en la
 * línea de tiempo y avanza el pedido a "aprobado" o lo regresa a "en diseño".
 */
export function responderArchivo(
  a: Almacen,
  archivo: ArchivoFila,
  estado: 'aprobado' | 'cambios' | 'rechazado' | 'pendiente',
  datos: { nombre: string | null; notas: string | null; usuarioId: string | null },
) {
  if (archivo.categoria !== 'diseno') throw new Error('Solo los diseños requieren aprobación')
  if (archivo.estado_aprobacion === estado && archivo.aprobado_por_nombre === datos.nombre && archivo.aprobacion_notas === datos.notas) return archivo
  const cambio = archivo.estado_aprobacion !== estado
  archivo.estado_aprobacion = estado
  archivo.aprobado_por_nombre = datos.nombre
  archivo.aprobacion_notas = datos.notas
  if (cambio) {
    archivo.aprobacion_registrada_por = datos.usuarioId
    archivo.aprobacion_at = ahoraISO()
  }
  archivo.updated_at = ahoraISO()
  const pedido = archivo.pedido_id ? a.pedidos.find((p) => p.id === archivo.pedido_id) : undefined
  if (!pedido || !cambio) return archivo
  const txt = { aprobado: 'aprobado', cambios: 'cambios solicitados', rechazado: 'rechazado', pendiente: 'pendiente de aprobación' }[estado]
  eventoPedido(a, pedido.id, {
    tipo: 'aprobacion',
    mensaje: `Diseño v${archivo.version ?? '?'}: ${txt}${datos.nombre?.trim() ? ` por ${datos.nombre.trim()}` : ''}${datos.notas?.trim() ? `. ${datos.notas.trim()}` : ''}`,
    usuario_id: datos.usuarioId,
  })
  if (estado === 'aprobado' && ['nuevo', 'en_diseno', 'esperando_aprobacion'].includes(pedido.estado) && !pedido.etapas_omitidas.includes('aprobado')) {
    aplicarEstadoPedido(a, pedido, 'aprobado', null, datos.usuarioId)
  } else if (['cambios', 'rechazado'].includes(estado) && ['esperando_aprobacion', 'aprobado'].includes(pedido.estado) && !pedido.etapas_omitidas.includes('en_diseno')) {
    aplicarEstadoPedido(a, pedido, 'en_diseno', null, datos.usuarioId)
  }
  return archivo
}

/** Vista previa de un archivo de ejemplo (imagen SVG generada en el navegador; nada se descarga). */
export function vistaPreviaArchivo(nombre: string) {
  const texto = nombre.replace(/[<>&"]/g, '')
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">` +
    `<rect width="1200" height="800" fill="#22426B"/><rect x="40" y="40" width="1120" height="720" rx="32" fill="none" stroke="#F9C206" stroke-width="6" stroke-dasharray="18 14"/>` +
    `<text x="600" y="380" font-family="sans-serif" font-size="56" font-weight="700" fill="#ffffff" text-anchor="middle">${texto}</text>` +
    `<text x="600" y="460" font-family="sans-serif" font-size="32" fill="#F9C206" text-anchor="middle">Vista previa · archivo ficticio</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
