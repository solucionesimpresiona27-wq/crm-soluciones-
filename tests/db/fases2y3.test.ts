/**
 * Pruebas de las fases 2 y 3 contra Supabase local (`supabase start`):
 * permisos nuevos, listas de precios, tareas y agenda, proveedores e inventario,
 * gastos y utilidad real, corte de caja, comisiones, reportes, cobranza,
 * clientes por reactivar y portal del cliente.
 *
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... npx vitest run tests/db
 *
 * La función de Edge "portal-cliente" se prueba si además se define PORTAL_FN_URL
 * (por ejemplo, ejecutándola con Deno: ver la sección Desarrollo del README).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'

const URL = process.env.SUPABASE_URL ?? ''
const ANON = process.env.SUPABASE_ANON_KEY ?? ''
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const FN_URL = process.env.PORTAL_FN_URL ?? ''
const activo = Boolean(URL && ANON && SERVICE)
const suite = activo ? describe : describe.skip
const suiteFn = activo && FN_URL ? describe : describe.skip

const sistema = activo ? createClient(URL, SERVICE, { auth: { persistSession: false } }) : (null as never)
const PASS = 'Prueba12345'
const sufijo = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`

// Ventana de fechas pasada y única por ejecución: los reportes quedan aislados de otros datos.
const azar = (n: number) => Math.floor(Math.random() * n)
const BASE = new Date(Date.UTC(2001 + azar(19), azar(12), 1 + azar(20)))
const dia = (d: Date, mas = 0) => new Date(d.getTime() + mas * 864e5).toISOString().slice(0, 10)
const BASE_TXT = dia(BASE)
const HOY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date())
const diasEntre = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5)

async function crearUsuario(email: string, appMeta: Record<string, unknown>) {
  const { data, error } = await sistema.auth.admin.createUser({ email, password: PASS, email_confirm: true, app_metadata: appMeta })
  if (error) throw error
  return data.user!.id
}

async function sesion(email: string) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } })
  const { error } = await c.auth.signInWithPassword({ email, password: PASS })
  if (error) throw error
  return c
}

function ok<T>(r: { data: T; error: unknown }): T {
  if (r.error) throw r.error
  return r.data
}

type Fila = Record<string, unknown>
const num = (v: unknown) => Number(v)

suite('Fases 2 y 3: permisos, inventario, gastos, caja, reportes y portal', () => {
  let a: SupabaseClient, v: SupabaseClient, v2: SupabaseClient, d: SupabaseClient, p: SupabaseClient
  let inactivo: SupabaseClient, anon: SupabaseClient
  let idAdmin = '', idVentas = '', idVentas2 = '', idProd = ''
  let clienteId = '', clientePortalId = '', productoId = ''
  let cotizacionId = '', pedidoId = ''
  let proveedorId = '', materialId = ''
  let gastoId = '', gastoCanceladoId = ''

  beforeAll(async () => {
    idAdmin = await crearUsuario(`f23-admin-${sufijo}@prueba.local`, { rol: 'admin', activo: true, nombre: 'Admin Fases' })
    idVentas = await crearUsuario(`f23-ventas-${sufijo}@prueba.local`, { rol: 'ventas', activo: true, nombre: 'Vendedor Fases' })
    idVentas2 = await crearUsuario(`f23-ventas2-${sufijo}@prueba.local`, { rol: 'ventas', activo: true, nombre: 'Vendedora Dos' })
    await crearUsuario(`f23-diseno-${sufijo}@prueba.local`, { rol: 'diseno', activo: true, nombre: 'Diseño Fases' })
    idProd = await crearUsuario(`f23-prod-${sufijo}@prueba.local`, { rol: 'produccion', activo: true, nombre: 'Producción Fases' })
    await crearUsuario(`f23-inactivo-${sufijo}@prueba.local`, { rol: 'ventas', activo: false })
    a = await sesion(`f23-admin-${sufijo}@prueba.local`)
    v = await sesion(`f23-ventas-${sufijo}@prueba.local`)
    v2 = await sesion(`f23-ventas2-${sufijo}@prueba.local`)
    d = await sesion(`f23-diseno-${sufijo}@prueba.local`)
    p = await sesion(`f23-prod-${sufijo}@prueba.local`)
    inactivo = await sesion(`f23-inactivo-${sufijo}@prueba.local`)
    anon = createClient(URL, ANON, { auth: { persistSession: false } })

    const prod = ok(await a.from('productos').select('id').eq('nombre', 'Letrero de acrílico').single()) as { id: string }
    productoId = prod.id
  })

  // -------------------------------------------------------------------
  // Permisos
  // -------------------------------------------------------------------
  it('agrega los permisos de inventario, consumos y gastos sin cambiar los existentes', async () => {
    const lista = ok(await a.rpc('lista_permisos')) as string[]
    expect(lista).toEqual(expect.arrayContaining(['gestionar_inventario', 'registrar_consumos', 'registrar_gastos', 'ver_precios']))
    expect(lista).toHaveLength(16)
    const pa = ok(await a.rpc('mis_permisos')) as Record<string, boolean>
    const pv = ok(await v.rpc('mis_permisos')) as Record<string, boolean>
    const pd = ok(await d.rpc('mis_permisos')) as Record<string, boolean>
    const pp = ok(await p.rpc('mis_permisos')) as Record<string, boolean>
    expect(Object.values(pa).every(Boolean)).toBe(true)
    expect([pv.gestionar_inventario, pv.registrar_consumos, pv.registrar_gastos]).toEqual([false, false, false])
    expect([pd.gestionar_inventario, pd.registrar_consumos, pd.registrar_gastos]).toEqual([false, false, false])
    expect([pp.gestionar_inventario, pp.registrar_consumos, pp.registrar_gastos]).toEqual([false, true, false])
    // Los anteriores siguen igual
    expect(pv.ver_precios && pv.registrar_pagos && !pv.ver_costos && !pv.ver_reportes).toBe(true)
    expect(pp.actualizar_produccion && !pp.ver_precios).toBe(true)
  })

  // -------------------------------------------------------------------
  // Listas de precios
  // -------------------------------------------------------------------
  it('listas de precios: el cliente tiene lista y los precios por lista requieren permisos', async () => {
    const c = ok(await v.from('clientes').insert({ nombre: `Agencia Reventa ${sufijo}` }).select('id, lista_precio').single()) as Fila
    expect(c.lista_precio).toBe('publico')
    ok(await v.from('clientes').update({ lista_precio: 'agencia' }).eq('id', c.id as string))

    ok(await a.from('producto_precios').upsert({ producto_id: productoId, lista: 'mayoreo', precio: 950, precio_minimo: 500, escalas: [{ desde: 10, precio: 900 }] }))
    const { error: publico } = await a.from('producto_precios').insert({ producto_id: productoId, lista: 'publico', precio: 1 })
    expect(publico).toBeTruthy()
    const { error: ventasEscribe } = await v.from('producto_precios').upsert({ producto_id: productoId, lista: 'agencia', precio: 1 })
    expect(ventasEscribe).toBeTruthy()

    const deVentas = ok(await v.from('producto_precios').select('lista, precio').eq('producto_id', productoId)) as Fila[]
    expect(deVentas.find((x) => x.lista === 'mayoreo')?.precio).toBe(950)
    const deProduccion = ok(await p.from('producto_precios').select('*'))
    expect(deProduccion).toEqual([])
  })

  // -------------------------------------------------------------------
  // Pedido base (vendido por "ventas", con costos, en una fecha pasada)
  // -------------------------------------------------------------------
  it('prepara un pedido con costos estimados vendido por ventas en la fecha de prueba', async () => {
    const c = ok(await a.from('clientes').insert({ nombre: `Cliente Utilidad ${sufijo}`, whatsapp: '3300000000' }).select('id').single()) as { id: string }
    clienteId = c.id
    const r = ok(await a.rpc('guardar_cotizacion', {
      p_datos: {
        cliente_id: clienteId, titulo: 'Letreros', fecha: BASE_TXT,
        partidas: [{ producto_id: productoId, concepto: 'Letrero de acrílico 60×40', metodo_calculo: 'pieza', unidad: 'pza', cantidad: 2, precio_unitario: 500, costos: { costo_material: 100, costo_fijo: 50 } }],
      },
    })) as { id: string }
    cotizacionId = r.id
    ok(await a.from('cotizaciones').update({ vendedor_id: idVentas }).eq('id', cotizacionId))
    pedidoId = ok(await a.rpc('convertir_cotizacion_a_pedido', { p_cotizacion: cotizacionId, p_fecha_entrega: dia(BASE, 5) })) as string
    ok(await sistema.from('pedidos').update({ created_at: `${BASE_TXT}T12:00:00-06:00` }).eq('id', pedidoId))
    const ped = ok(await a.from('pedidos').select('total, iva, vendedor_id, fecha_limite_pago').eq('id', pedidoId).single()) as Fila
    expect(num(ped.total)).toBe(1160)
    expect(ped.vendedor_id).toBe(idVentas)
    expect(ped.fecha_limite_pago).toBe(dia(BASE, 5))
  })

  // -------------------------------------------------------------------
  // Proveedores e inventario
  // -------------------------------------------------------------------
  it('proveedores: solo con inventario, gastos o costos', async () => {
    const pr = ok(await a.from('proveedores').insert({ nombre: `Papelera Jalisco ${sufijo}`, categoria: 'Papel', whatsapp: '3399999999' }).select('id').single()) as { id: string }
    proveedorId = pr.id
    expect(ok(await v.from('proveedores').select('id'))).toEqual([])
    expect(ok(await p.from('proveedores').select('id'))).toEqual([])
    const { error } = await v.from('proveedores').insert({ nombre: 'No permitido' })
    expect(error).toBeTruthy()
    const busq = ok(await a.from('proveedores').select('id').ilike('busqueda', '%papelera jalisco%')) as Fila[]
    expect(busq.some((x) => x.id === proveedorId)).toBe(true)
  })

  it('materiales: la existencia inicial queda como ajuste y el costo solo lo ve quien tiene ver_costos', async () => {
    const m = ok(await a.from('materiales').insert({ nombre: `Vinil blanco ${sufijo}`, categoria: 'Vinil', unidad: 'm2', existencia: 10, stock_minimo: 3, proveedor_id: proveedorId }).select('id, existencia, bajo_minimo').single()) as Fila
    materialId = m.id as string
    expect(num(m.existencia)).toBe(10)
    expect(m.bajo_minimo).toBe(false)
    const movs = ok(await p.from('movimientos_inventario').select('tipo, cantidad, referencia, existencia_resultante').eq('material_id', materialId)) as Fila[]
    expect(movs).toEqual([{ tipo: 'ajuste', cantidad: 10, referencia: 'Existencia inicial', existencia_resultante: 10 }])

    ok(await a.from('material_costos').upsert({ material_id: materialId, costo_unitario: 25 }))
    expect(ok(await v.from('material_costos').select('*'))).toEqual([])
    expect(ok(await p.from('material_costos').select('*'))).toEqual([])
    // Todo el equipo ve los materiales; solo inventario los crea
    expect((ok(await d.from('materiales').select('id').eq('id', materialId)) as Fila[]).length).toBe(1)
    const { error } = await p.from('materiales').insert({ nombre: `Lona ${sufijo}`, unidad: 'm2' })
    expect(error).toBeTruthy()
    const { error: duplicado } = await a.from('materiales').insert({ nombre: `VINIL BLANCO ${sufijo}`, unidad: 'm2' })
    expect(duplicado).toBeTruthy()
  })

  it('producción registra consumos y mermas; no entradas ni existencias negativas', async () => {
    const c1 = ok(await p.from('movimientos_inventario').insert({ material_id: materialId, tipo: 'consumo', cantidad: 4, pedido_id: pedidoId }).select('existencia_resultante, usuario_id').single()) as Fila
    expect(num(c1.existencia_resultante)).toBe(6)
    expect(c1.usuario_id).toBe(idProd)

    const { error: entrada } = await p.from('movimientos_inventario').insert({ material_id: materialId, tipo: 'entrada', cantidad: 5 })
    expect(entrada).toBeTruthy()
    const { error: deVentas } = await v.from('movimientos_inventario').insert({ material_id: materialId, tipo: 'consumo', cantidad: 1 })
    expect(deVentas).toBeTruthy()
    const { error: negativo } = await p.from('movimientos_inventario').insert({ material_id: materialId, tipo: 'consumo', cantidad: 7 })
    expect(negativo?.message).toContain('No hay suficiente existencia')
    const { error: cero } = await p.from('movimientos_inventario').insert({ material_id: materialId, tipo: 'consumo', cantidad: 0 })
    expect(cero).toBeTruthy()

    ok(await p.from('movimientos_inventario').insert({ material_id: materialId, tipo: 'merma', cantidad: 3.5, pedido_id: pedidoId, notas: 'Impresión manchada' }))
    const m = ok(await d.from('materiales').select('existencia, bajo_minimo').eq('id', materialId).single()) as Fila
    expect(num(m.existencia)).toBe(2.5)
    expect(m.bajo_minimo).toBe(true)

    const panel = ok(await p.rpc('dashboard_resumen')) as { stock_bajo: { cantidad: number; materiales: Fila[] } }
    expect(panel.stock_bajo.cantidad).toBeGreaterThan(0)
  })

  it('la existencia no se edita a mano y los movimientos no se modifican ni se borran', async () => {
    const { error: directo } = await a.from('materiales').update({ existencia: 100 }).eq('id', materialId)
    expect(directo?.message).toContain('movimientos de inventario')
    ok(await a.from('materiales').update({ ubicacion: 'Bodega A' }).eq('id', materialId))

    const mov = ok(await a.from('movimientos_inventario').select('id').eq('material_id', materialId).limit(1).single()) as { id: string }
    const { error: editar } = await a.from('movimientos_inventario').update({ cantidad: 1 }).eq('id', mov.id)
    expect(editar).toBeTruthy()
    const { error: borrar } = await a.from('movimientos_inventario').delete().eq('id', mov.id)
    expect(borrar).toBeTruthy()
    const { error: borrarMaterial } = await a.from('materiales').delete().eq('id', materialId)
    expect(borrarMaterial).toBeTruthy()
  })

  it('ajustes explícitos, conteo físico y entradas de proveedor', async () => {
    const aj = ok(await a.from('movimientos_inventario').insert({ material_id: materialId, tipo: 'ajuste', cantidad: -5, notas: 'Consumo no registrado' }).select('existencia_resultante').single()) as Fila
    expect(num(aj.existencia_resultante)).toBe(-2.5)

    const { error: sinPermiso } = await p.rpc('ajustar_existencia', { p_material: materialId, p_existencia: 1 })
    expect(sinPermiso).toBeTruthy()
    const conteo = ok(await a.rpc('ajustar_existencia', { p_material: materialId, p_existencia: 20, p_notas: 'Inventario mensual' })) as Fila
    expect(num(conteo.diferencia)).toBe(22.5)

    ok(await a.from('movimientos_inventario').insert({ material_id: materialId, tipo: 'entrada', cantidad: 5, proveedor_id: proveedorId, referencia: 'Factura A-123' }))
    const m = ok(await a.from('materiales').select('existencia, bajo_minimo').eq('id', materialId).single()) as Fila
    expect(num(m.existencia)).toBe(25)
    expect(m.bajo_minimo).toBe(false)
    const kardex = ok(await v.from('movimientos_inventario').select('tipo').eq('material_id', materialId)) as Fila[]
    expect(kardex).toHaveLength(6)
  })

  it('el administrador puede dar el permiso de inventario a una persona', async () => {
    ok(await a.from('perfiles').update({ permisos: { gestionar_inventario: true } }).eq('id', idVentas2))
    ok(await v2.from('movimientos_inventario').insert({ material_id: materialId, tipo: 'entrada', cantidad: 1 }))
    ok(await a.from('perfiles').update({ permisos: {} }).eq('id', idVentas2))
    const { error } = await v2.from('movimientos_inventario').insert({ material_id: materialId, tipo: 'entrada', cantidad: 1 })
    expect(error).toBeTruthy()
    // Regresa la existencia a 25 para los cálculos siguientes
    ok(await a.from('movimientos_inventario').insert({ material_id: materialId, tipo: 'ajuste', cantidad: -1 }))
  })

  // -------------------------------------------------------------------
  // Gastos
  // -------------------------------------------------------------------
  it('gastos: solo con registrar_gastos; se cancelan con motivo y no se reactivan', async () => {
    const g = ok(await a.from('gastos').insert({ fecha: BASE_TXT, concepto: 'Corte láser maquilado', categoria: 'maquila', proveedor_id: proveedorId, pedido_id: pedidoId, monto: 300, metodo_pago: 'efectivo' }).select('id, usuario_id').single()) as Fila
    gastoId = g.id as string
    expect(g.usuario_id).toBe(idAdmin)
    const g2 = ok(await a.from('gastos').insert({ fecha: BASE_TXT, concepto: 'Duplicado', categoria: 'material', pedido_id: pedidoId, monto: 999, metodo_pago: 'transferencia' }).select('id').single()) as Fila
    gastoCanceladoId = g2.id as string

    expect(ok(await v.from('gastos').select('id'))).toEqual([])
    expect(ok(await p.from('gastos').select('id'))).toEqual([])
    const { error: ventas } = await v.from('gastos').insert({ concepto: 'x', monto: 1 })
    expect(ventas).toBeTruthy()

    const { error: sinMotivo } = await a.from('gastos').update({ cancelado: true }).eq('id', gastoCanceladoId)
    expect(sinMotivo?.message).toContain('motivo')
    ok(await a.from('gastos').update({ cancelado: true, motivo_cancelacion: 'Capturado dos veces' }).eq('id', gastoCanceladoId))
    const { error: editar } = await a.from('gastos').update({ monto: 5 }).eq('id', gastoCanceladoId)
    expect(editar).toBeTruthy()
    const { error: reactivar } = await a.from('gastos').update({ cancelado: false }).eq('id', gastoCanceladoId)
    expect(reactivar).toBeTruthy()

    // Borrar solo con eliminar_registros
    const g3 = ok(await a.from('gastos').insert({ concepto: 'Para borrar', monto: 1 }).select('id').single()) as Fila
    ok(await a.from('gastos').delete().eq('id', g3.id as string))
  })

  it('comprobantes de gastos: privados para quien no registra gastos', async () => {
    const pdf = new Blob([new TextEncoder().encode('%PDF-1.4\n%prueba\n')], { type: 'application/pdf' })
    const ruta = `gastos/${gastoId}/factura-${sufijo}.pdf`
    ok(await a.storage.from('comprobantes').upload(ruta, pdf, { contentType: 'application/pdf' }))
    ok(await a.from('gastos').update({ comprobante_path: ruta }).eq('id', gastoId))
    const { data: bajada } = await a.storage.from('comprobantes').download(ruta)
    expect(bajada).toBeTruthy()
    const { data: deVentas, error: errVentas } = await v.storage.from('comprobantes').download(ruta)
    expect(deVentas).toBeNull()
    expect(errVentas).toBeTruthy()
    const { error: subirVentas } = await v.storage.from('comprobantes').upload(`gastos/${gastoId}/otro-${sufijo}.pdf`, pdf, { contentType: 'application/pdf' })
    expect(subirVentas).toBeTruthy()
    // Los comprobantes de pagos siguen funcionando para ventas
    const rutaPago = `pagos/${pedidoId}/spei-${sufijo}.pdf`
    ok(await v.storage.from('comprobantes').upload(rutaPago, pdf, { contentType: 'application/pdf' }))
    const { data: pago } = await v.storage.from('comprobantes').download(rutaPago)
    expect(pago).toBeTruthy()
  })

  it('utilidad real por pedido: gastos ligados y material consumido; solo con costos y reportes', async () => {
    const filas = ok(await a.rpc('utilidad_pedidos', { p_desde: BASE_TXT, p_hasta: BASE_TXT })) as Fila[]
    const u = filas.find((x) => x.pedido_id === pedidoId)!
    expect(u).toBeTruthy()
    expect(num(u.venta)).toBe(1000)
    expect(num(u.costo_estimado)).toBe(250) // (100 × 2) + 50
    expect(num(u.gastos)).toBe(300) // el gasto cancelado no cuenta
    expect(num(u.consumo_material)).toBe(187.5) // (4 + 3.5) m² × $25
    expect(num(u.costo_real)).toBe(487.5)
    expect(num(u.utilidad_estimada)).toBe(750)
    expect(num(u.utilidad_real)).toBe(512.5)
    expect(num(u.margen_real_pct)).toBe(51.3)
    expect(num(u.consumos_sin_costo)).toBe(0)
    const { error: ventas } = await v.rpc('utilidad_pedidos', { p_desde: BASE_TXT, p_hasta: BASE_TXT })
    expect(ventas?.message).toContain('permiso')
  })

  // -------------------------------------------------------------------
  // Pagos del día y corte de caja
  // -------------------------------------------------------------------
  it('corte de caja: resumen por método y por persona, cierre y bloqueo del efectivo', async () => {
    const pago = (c: SupabaseClient, importe: number, metodo: string, tipo = 'abono') =>
      c.from('pagos').insert({ pedido_id: pedidoId, fecha: BASE_TXT, importe, metodo, tipo }).select('id').single()
    ok(await pago(v, 600, 'efectivo', 'anticipo'))
    ok(await pago(v, 200, 'transferencia'))
    ok(await pago(a, 100, 'efectivo'))
    ok(await pago(a, 30, 'efectivo', 'devolucion'))
    const cancelado = ok(await pago(v, 50, 'efectivo')) as { id: string }
    ok(await a.from('pagos').update({ cancelado: true, motivo_cancelacion: 'Error de captura' }).eq('id', cancelado.id))

    const { error: produccion } = await p.rpc('corte_caja_resumen', { p_fecha: BASE_TXT })
    expect(produccion).toBeTruthy()

    const rv = ok(await v.rpc('corte_caja_resumen', { p_fecha: BASE_TXT, p_efectivo_inicial: 500 })) as Record<string, any>
    expect(rv.cerrado).toBe(false)
    expect(rv.totales).toEqual({ entradas: 900, devoluciones: 30, neto: 870 })
    expect(rv.efectivo).toEqual({ entradas: 700, devoluciones: 30, gastos: 300, neto: 370 })
    expect(rv.esperado).toBe(870)
    expect(rv).not.toHaveProperty('gastos')
    const porVentas = rv.por_usuario.find((x: Fila) => x.usuario_id === idVentas)
    expect(porVentas).toMatchObject({ pagos: 2, entradas: 800, neto: 800, efectivo_neto: 600 })
    const porAdmin = rv.por_usuario.find((x: Fila) => x.usuario_id === idAdmin)
    expect(porAdmin).toMatchObject({ pagos: 2, entradas: 100, devoluciones: 30, neto: 70, efectivo_neto: 70 })
    expect(rv.entradas_por_metodo).toEqual(expect.arrayContaining([{ metodo: 'efectivo', pagos: 2, total: 700 }]))
    expect(rv.cancelados).toEqual({ pagos: 1, total: 50 })

    const ra = ok(await a.rpc('corte_caja_resumen', { p_fecha: BASE_TXT })) as Record<string, any>
    expect(ra.gastos.some((g: Fila) => g.id === gastoId)).toBe(true)

    const corte = ok(await v.rpc('cerrar_caja', { p_fecha: BASE_TXT, p_efectivo_inicial: 500, p_efectivo_contado: 860, p_notas: 'Faltan $10' })) as Fila
    expect(num(corte.esperado)).toBe(870)
    expect(num(corte.diferencia)).toBe(-10)
    expect(corte.cerrado_por).toBe(idVentas)
    expect(JSON.stringify(corte.resumen)).not.toContain('Corte láser') // sin detalle de gastos
    const { error: otraVez } = await v.rpc('cerrar_caja', { p_fecha: BASE_TXT, p_efectivo_inicial: 0, p_efectivo_contado: 0 })
    expect(otraVez?.message).toContain('ya está cerrada')
    const { error: futuro } = await v.rpc('cerrar_caja', { p_fecha: '2999-01-01', p_efectivo_inicial: 0, p_efectivo_contado: 0 })
    expect(futuro).toBeTruthy()
    const { error: prodCierra } = await p.rpc('cerrar_caja', { p_fecha: dia(BASE, 1), p_efectivo_inicial: 0, p_efectivo_contado: 0 })
    expect(prodCierra).toBeTruthy()

    expect((ok(await v.from('cortes_caja').select('id').eq('fecha', BASE_TXT)) as Fila[]).length).toBe(1)
    expect(ok(await p.from('cortes_caja').select('id'))).toEqual([])
    const { error: insertarDirecto } = await v.from('cortes_caja').insert({ fecha: dia(BASE, 2), efectivo_contado: 0, esperado: 0, diferencia: 0 })
    expect(insertarDirecto).toBeTruthy()

    // Con la caja cerrada: efectivo bloqueado para ventas; transferencias sí; administración sí
    const { error: efectivo } = await pago(v, 20, 'efectivo')
    expect(efectivo?.message).toContain('ya está cerrada')
    ok(await pago(v, 100, 'transferencia'))
    const deAdmin = ok(await pago(a, 10, 'efectivo')) as { id: string }
    ok(await a.from('pagos').update({ cancelado: true, motivo_cancelacion: 'Prueba de administración' }).eq('id', deAdmin.id))
    const cerrado = ok(await v.rpc('corte_caja_resumen', { p_fecha: BASE_TXT })) as Record<string, any>
    expect(cerrado.cerrado).toBe(true)
    expect(num(cerrado.corte.efectivo_contado)).toBe(860)
    expect(cerrado.efectivo_inicial).toBe(500)
  })

  it('solo administración reabre una caja cerrada y queda en la bitácora', async () => {
    const fecha = dia(BASE, 1)
    ok(await v.rpc('cerrar_caja', { p_fecha: fecha, p_efectivo_inicial: 860, p_efectivo_contado: 860 }))
    const sugerido = ok(await v.rpc('corte_caja_resumen', { p_fecha: dia(BASE, 2) })) as Record<string, any>
    expect(sugerido.efectivo_inicial_sugerido).toBe(860)
    const { error: ventas } = await v.rpc('reabrir_caja', { p_fecha: fecha, p_motivo: 'x' })
    expect(ventas).toBeTruthy()
    const { error: sinMotivo } = await a.rpc('reabrir_caja', { p_fecha: fecha, p_motivo: ' ' })
    expect(sinMotivo).toBeTruthy()
    ok(await a.rpc('reabrir_caja', { p_fecha: fecha, p_motivo: 'Se registró un pago tarde' }))
    expect(ok(await v.from('cortes_caja').select('id').eq('fecha', fecha))).toEqual([])
    const bit = ok(await a.from('bitacora').select('accion, etiqueta').eq('tabla', 'cortes_caja').ilike('etiqueta', '%reabierta%')) as Fila[]
    expect(bit.some((b) => String(b.etiqueta).includes('Se registró un pago tarde'))).toBe(true)
  })

  // -------------------------------------------------------------------
  // Comisiones
  // -------------------------------------------------------------------
  it('comisiones sobre lo cobrado sin IVA; ventas solo ve las suyas', async () => {
    ok(await a.from('perfiles').update({ comision_pct: 10 }).eq('id', idVentas))
    // Cobrado neto del día: 600 + 200 + 100 − 30 + 100 = 970; sin IVA: 970 × 1000/1160 = 836.21
    const propias = ok(await v.rpc('comisiones', { p_desde: BASE_TXT, p_hasta: BASE_TXT })) as Fila[]
    expect(propias).toHaveLength(1)
    expect(propias[0]).toMatchObject({ vendedor_id: idVentas, pedidos: 1, pagos: 5 })
    expect(num(propias[0].cobrado)).toBe(970)
    expect(num(propias[0].base_comision)).toBe(836.21)
    expect(num(propias[0].comision)).toBe(83.62)

    const ajenas = ok(await v.rpc('comisiones_detalle', { p_desde: BASE_TXT, p_hasta: BASE_TXT, p_vendedor: idAdmin })) as Fila[]
    expect(ajenas.every((x) => x.vendedor_id === idVentas)).toBe(true)

    const deOtra = ok(await v2.rpc('comisiones', { p_desde: BASE_TXT, p_hasta: BASE_TXT })) as Fila[]
    expect(deOtra).toHaveLength(1)
    expect(deOtra[0].vendedor_id).toBe(idVentas2)
    expect(num(deOtra[0].comision)).toBe(0)

    const todas = ok(await a.rpc('comisiones', { p_desde: BASE_TXT, p_hasta: BASE_TXT })) as Fila[]
    expect(num(todas.find((x) => x.vendedor_id === idVentas)?.comision)).toBe(83.62)
  })

  // -------------------------------------------------------------------
  // Reportes
  // -------------------------------------------------------------------
  it('reportes de ventas, productos, vendedores y clientes con ver_reportes', async () => {
    const serie = ok(await a.rpc('reporte_ventas', { p_desde: BASE_TXT, p_hasta: dia(BASE, 2), p_agrupar: 'dia' })) as Fila[]
    expect(serie).toHaveLength(3)
    expect(serie[0]).toMatchObject({ periodo: BASE_TXT, pedidos: 1, cotizaciones: 1 })
    expect(num(serie[0].vendido)).toBe(1160)
    expect(num(serie[0].cobrado)).toBe(970)
    expect(num(serie[0].cotizado)).toBe(1160)
    expect(num(serie[1].vendido)).toBe(0)
    const meses = ok(await a.rpc('reporte_ventas', { p_desde: BASE_TXT, p_hasta: dia(BASE, 40), p_agrupar: 'mes' })) as Fila[]
    expect(meses.length).toBeGreaterThanOrEqual(2)
    expect(meses.reduce((s, x) => s + num(x.vendido), 0)).toBe(1160)
    const { error: agrupar } = await a.rpc('reporte_ventas', { p_desde: BASE_TXT, p_hasta: BASE_TXT, p_agrupar: 'año' })
    expect(agrupar).toBeTruthy()

    const prods = ok(await a.rpc('reporte_productos', { p_desde: BASE_TXT, p_hasta: BASE_TXT })) as Fila[]
    expect(prods[0]).toMatchObject({ producto_id: productoId, producto: 'Letrero de acrílico', pedidos: 1 })
    expect(num(prods[0].importe)).toBe(1000)
    expect(num(prods[0].cantidad)).toBe(2)

    const vend = ok(await a.rpc('reporte_vendedores', { p_desde: BASE_TXT, p_hasta: BASE_TXT })) as Fila[]
    const fila = vend.find((x) => x.vendedor_id === idVentas)!
    expect(fila).toMatchObject({ cotizaciones: 1, aceptadas: 1, rechazadas: 0, pedidos: 1 })
    expect(num(fila.tasa_cierre)).toBe(100)
    expect(num(fila.vendido)).toBe(1160)
    expect(num(fila.cobrado)).toBe(970)

    const clientes = ok(await a.rpc('reporte_clientes', { p_desde: BASE_TXT, p_hasta: BASE_TXT })) as Fila[]
    const cli = clientes.find((x) => x.cliente_id === clienteId)!
    expect(num(cli.vendido)).toBe(1160)
    expect(num(cli.cobrado)).toBe(970)
    expect(num(cli.saldo)).toBe(190)

    for (const [fn, args] of [
      ['reporte_ventas', { p_desde: BASE_TXT, p_hasta: BASE_TXT }],
      ['reporte_productos', { p_desde: BASE_TXT, p_hasta: BASE_TXT }],
      ['reporte_vendedores', { p_desde: BASE_TXT, p_hasta: BASE_TXT }],
      ['reporte_clientes', { p_desde: BASE_TXT, p_hasta: BASE_TXT }],
    ] as const) {
      const { error: ev } = await v.rpc(fn, args)
      const { error: ep } = await p.rpc(fn, args)
      expect(ev?.code).toBe('42501')
      expect(ep?.code).toBe('42501')
    }
    const { error: largo } = await a.rpc('reporte_ventas', { p_desde: '2000-01-01', p_hasta: '2030-01-01', p_agrupar: 'dia' })
    expect(largo).toBeTruthy()
  })

  it('cuentas por cobrar con días vencidos; requiere ver_precios', async () => {
    const filas = ok(await v.rpc('cuentas_por_cobrar')) as Fila[]
    const f = filas.find((x) => x.pedido_id === pedidoId)!
    expect(num(f.saldo)).toBe(190)
    expect(f.vencido).toBe(true)
    expect(f.fecha_limite).toBe(dia(BASE, 5))
    expect(f.dias_vencido).toBe(diasEntre(dia(BASE, 5), HOY))
    const { error } = await p.rpc('cuentas_por_cobrar')
    expect(error).toBeTruthy()
  })

  it('clientes por reactivar: sin compras en N días; requiere gestionar_clientes', async () => {
    const lista = ok(await v.rpc('clientes_inactivos')) as Fila[]
    const c = lista.find((x) => x.cliente_id === clienteId)!
    expect(c).toBeTruthy()
    expect(c.vendedor_id).toBe(idVentas)
    expect(c.vendedor).toBe('Vendedor Fases')
    expect(num(c.total_comprado)).toBe(1160)
    expect(c.dias_sin_compra).toBe(diasEntre(BASE_TXT, HOY))
    // Un cliente con compra reciente no aparece
    const reciente = ok(await v.from('clientes').insert({ nombre: `Cliente Reciente ${sufijo}` }).select('id').single()) as { id: string }
    const q = ok(await v.rpc('guardar_cotizacion', { p_datos: { cliente_id: reciente.id, partidas: [{ concepto: 'Volantes', metodo_calculo: 'millar', unidad: 'millar', cantidad: 1, precio_unitario: 400 }] } })) as { id: string }
    ok(await v.rpc('convertir_cotizacion_a_pedido', { p_cotizacion: q.id }))
    const lista2 = ok(await v.rpc('clientes_inactivos', { p_dias: 30 })) as Fila[]
    expect(lista2.some((x) => x.cliente_id === reciente.id)).toBe(false)
    expect(lista2.some((x) => x.cliente_id === clienteId)).toBe(true)
    const { error } = await d.rpc('clientes_inactivos')
    expect(error).toBeTruthy()
  })

  // -------------------------------------------------------------------
  // Tareas y agenda
  // -------------------------------------------------------------------
  it('tareas: todos las ven; solo responsable, autor o administración las editan', async () => {
    const t = ok(await v.from('tareas').insert({ titulo: 'Entregar letreros', tipo: 'entrega', fecha: HOY, hora: '10:30', responsable_id: idProd, pedido_id: pedidoId, created_by: idAdmin, prioridad: 'alta' }).select('*').single()) as Fila
    expect(t.created_by).toBe(idVentas)
    expect(t.cliente_id).toBe(clienteId)
    expect((ok(await d.from('tareas').select('id').eq('id', t.id as string)) as Fila[]).length).toBe(1)

    const ajeno = ok(await d.from('tareas').update({ titulo: 'Hackeado' }).eq('id', t.id as string).select()) as Fila[]
    expect(ajeno).toEqual([])

    const panel = ok(await p.rpc('dashboard_resumen')) as { tareas_hoy: Fila[]; tareas_pendientes: number }
    expect(panel.tareas_hoy.some((x) => x.id === t.id)).toBe(true)
    expect(panel.tareas_pendientes).toBeGreaterThan(0)

    const hecha = ok(await p.from('tareas').update({ completada: true }).eq('id', t.id as string).select('completada, completada_at, completada_por').single()) as Fila
    expect(hecha.completada_por).toBe(idProd)
    expect(hecha.completada_at).toBeTruthy()
    const reabierta = ok(await p.from('tareas').update({ completada: false }).eq('id', t.id as string).select('completada_at').single()) as Fila
    expect(reabierta.completada_at).toBeNull()

    expect(ok(await p.from('tareas').delete().eq('id', t.id as string).select())).toEqual([])
    const propia = ok(await p.from('tareas').insert({ titulo: 'Revisar tintas', tipo: 'recordatorio' }).select('id, responsable_id').single()) as Fila
    expect(propia.responsable_id).toBe(idProd)
    expect((ok(await p.from('tareas').delete().eq('id', propia.id as string).select()) as Fila[]).length).toBe(1)
    expect((ok(await a.from('tareas').update({ prioridad: 'urgente' }).eq('id', t.id as string).select()) as Fila[]).length).toBe(1)
  })

  it('agenda: tareas y entregas para todos; cotizaciones y seguimientos según permisos', async () => {
    const desde = BASE_TXT
    const hasta = dia(BASE, 10)
    ok(await v.from('tareas').insert({ titulo: 'Llamar al cliente', tipo: 'llamada', fecha: dia(BASE, 1), cliente_id: clienteId }))
    const deVentas = ok(await v.rpc('agenda', { p_desde: desde, p_hasta: hasta })) as Fila[]
    expect(deVentas.some((x) => x.origen === 'instalacion' || x.origen === 'entrega')).toBe(true)
    expect(deVentas.some((x) => x.origen === 'tarea' && x.titulo === 'Llamar al cliente')).toBe(true)
    const deProd = ok(await p.rpc('agenda', { p_desde: HOY, p_hasta: HOY })) as Fila[]
    expect(deProd.every((x) => ['tarea', 'entrega', 'instalacion'].includes(x.origen as string))).toBe(true)
    const { error } = await v.rpc('agenda', { p_desde: '2020-01-01', p_hasta: '2022-01-01' })
    expect(error).toBeTruthy()
  })

  // -------------------------------------------------------------------
  // Portal del cliente
  // -------------------------------------------------------------------
  describe('portal del cliente', () => {
    let cotPortal = '', token = '', tokenPedido = '', pedidoPortal = '', archivoV1 = '', archivoV2 = ''
    let errorInvalido: { message: string; code: string } | null = null

    beforeAll(async () => {
      const c = ok(await v.from('clientes').insert({ nombre: `Cliente Portal ${sufijo}`, notas: 'NOTA-CLIENTE-INTERNA' }).select('id').single()) as { id: string }
      clientePortalId = c.id
      const r = ok(await v.rpc('guardar_cotizacion', {
        p_datos: {
          cliente_id: clientePortalId, titulo: 'Lona para fachada', notas: 'Nota visible para el cliente', notas_internas: 'SECRETO-INTERNO',
          partidas: [{ concepto: 'Lona 13 oz', descripcion: 'Con ojillos', metodo_calculo: 'm2', unidad: 'pza', ancho: 3, alto: 1, cantidad: 1, precio_unitario: 540, notas_produccion: 'NOTA-PROD' }],
        },
      })) as { id: string }
      cotPortal = r.id
      const partida = ok(await a.from('partidas').select('id').eq('cotizacion_id', cotPortal).single()) as { id: string }
      ok(await a.from('partida_costos').upsert({ partida_id: partida.id, costo_material: 77.77, costo_total: 233.31 }))
      ok(await v.from('cotizaciones').update({ estado: 'enviada' }).eq('id', cotPortal))
    })

    it('crea y reutiliza enlaces solo con permiso', async () => {
      const e1 = ok(await v.rpc('crear_enlace_portal', { p_tipo: 'cotizacion', p_id: cotPortal })) as Fila
      token = e1.token as string
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
      expect(e1.nuevo).toBe(true)
      const e2 = ok(await v.rpc('crear_enlace_portal', { p_tipo: 'cotizacion', p_id: cotPortal })) as Fila
      expect(e2.token).toBe(token)
      expect(e2.nuevo).toBe(false)
      const e3 = ok(await v.rpc('crear_enlace_portal', { p_tipo: 'cotizacion', p_id: cotPortal, p_nuevo: true })) as Fila
      expect(e3.token).not.toBe(token)
      const { error: prod } = await p.rpc('crear_enlace_portal', { p_tipo: 'cotizacion', p_id: cotPortal })
      expect(prod?.code).toBe('42501')
      const { error: dias } = await v.rpc('crear_enlace_portal', { p_tipo: 'cotizacion', p_id: cotPortal, p_dias: 999 })
      expect(dias).toBeTruthy()
      expect(ok(await p.from('portal_enlaces').select('id'))).toEqual([])
    })

    it('sin sesión no se lee ninguna tabla ni otra función', async () => {
      for (const tabla of ['portal_enlaces', 'portal_respuestas', 'cotizaciones', 'tareas', 'materiales', 'gastos', 'cortes_caja', 'proveedores', 'producto_precios']) {
        const { data, error } = await anon.from(tabla).select('*').limit(1)
        expect(error ?? (data?.length === 0 ? 'vacío' : null)).toBeTruthy()
      }
      for (const fn of ['dashboard_resumen', 'cuentas_por_cobrar', 'lista_permisos']) {
        const { error } = await anon.rpc(fn)
        expect(error).toBeTruthy()
      }
      const { error: crear } = await anon.rpc('crear_enlace_portal', { p_tipo: 'cotizacion', p_id: cotPortal })
      expect(crear).toBeTruthy()
      const { error: firmar } = await anon.rpc('portal_archivos_firmables', { p_token: token })
      expect(firmar).toBeTruthy()
      const { error: firmarVentas } = await v.rpc('portal_archivos_firmables', { p_token: token })
      expect(firmarVentas).toBeTruthy()
    })

    it('muestra la cotización sin costos, notas internas ni datos fiscales ocultos', async () => {
      const conf = ok(await a.from('configuracion').select('rfc, mostrar_datos_fiscales').single()) as Fila
      ok(await a.from('configuracion').update({ rfc: 'PRUEBA010101AA1' }).eq('id', 1))
      try {
        const r = ok(await anon.rpc('portal_obtener', { p_token: token })) as Record<string, any>
        const texto = JSON.stringify(r)
        expect(r.tipo).toBe('cotizacion')
        expect(r.cotizacion.folio).toMatch(/^COT-/)
        expect(r.cotizacion.cliente).toBe(`Cliente Portal ${sufijo}`)
        expect(r.cotizacion.total).toBe(626.4)
        expect(r.cotizacion.puede_aprobar).toBe(true)
        expect(r.cotizacion.notas).toBe('Nota visible para el cliente')
        expect(r.cotizacion.partidas[0]).toMatchObject({ concepto: 'Lona 13 oz', descripcion: 'Con ojillos', importe: 540 })
        for (const prohibido of ['SECRETO-INTERNO', 'NOTA-PROD', 'NOTA-CLIENTE-INTERNA', '"costo', '77.77', 'notas_internas', 'PRUEBA010101AA1', 'cliente_id', 'token']) {
          expect(texto).not.toContain(prohibido)
        }
        expect(r.empresa.nombre).toBeTruthy()
        expect(r).not.toHaveProperty('pedido')
      } finally {
        ok(await a.from('configuracion').update({ rfc: conf.rfc ?? null, mostrar_datos_fiscales: conf.mostrar_datos_fiscales }).eq('id', 1))
      }
    })

    it('token inventado, mal formado, vencido o revocado: el mismo error', async () => {
      const inventado = 'A'.repeat(43)
      const viejo = ok(await v.rpc('crear_enlace_portal', { p_tipo: 'cotizacion', p_id: cotPortal, p_nuevo: true })) as Fila
      ok(await sistema.from('portal_enlaces').update({ expira_at: new Date(Date.now() - 864e5).toISOString() }).eq('id', viejo.id as string))
      const revocado = ok(await v.rpc('crear_enlace_portal', { p_tipo: 'cotizacion', p_id: cotPortal, p_nuevo: true })) as Fila
      ok(await v.rpc('revocar_enlace_portal', { p_enlace: revocado.id }))
      const { error: e1 } = await anon.rpc('portal_obtener', { p_token: inventado })
      errorInvalido = e1 as typeof errorInvalido
      expect(errorInvalido?.message).toContain('no es válido')
      for (const t of ['corto', `${token}'; select 1; --`, viejo.token as string, revocado.token as string, '']) {
        const { error } = await anon.rpc('portal_obtener', { p_token: t })
        expect(error?.message).toBe(errorInvalido!.message)
        expect(error?.code).toBe(errorInvalido!.code)
      }
      const { error: aprobar } = await anon.rpc('portal_aprobar_cotizacion', { p_token: revocado.token, p_nombre: 'Juan Pérez' })
      expect(aprobar?.message).toBe(errorInvalido!.message)
    })

    it('aprueba la cotización una sola vez y lo registra', async () => {
      const { error: corto } = await anon.rpc('portal_aprobar_cotizacion', { p_token: token, p_nombre: 'J' })
      expect(corto?.message).toContain('nombre')
      const { error: largo } = await anon.rpc('portal_aprobar_cotizacion', { p_token: token, p_nombre: 'Juan Pérez', p_comentario: 'x'.repeat(1001) })
      expect(largo?.message).toContain('1000')

      const vista = ok(await anon.rpc('portal_obtener', { p_token: token })) as { cotizacion: { version: string } }
      const r = ok(await anon.rpc('portal_aprobar_cotizacion', { p_token: token, p_nombre: '  Juan   Pérez ', p_comentario: 'Adelante con el trabajo', p_version: vista.cotizacion.version })) as Fila
      expect(r.estado).toBe('aceptada')
      const q = ok(await v.from('cotizaciones').select('estado, aceptada_at').eq('id', cotPortal).single()) as Fila
      expect(q.estado).toBe('aceptada')
      const resp = ok(await v.from('portal_respuestas').select('accion, nombre, comentario').eq('cotizacion_id', cotPortal)) as Fila[]
      expect(resp).toEqual([{ accion: 'aprobar_cotizacion', nombre: 'Juan Pérez', comentario: 'Adelante con el trabajo' }])
      const act = ok(await v.from('actividades').select('descripcion').eq('cliente_id', clientePortalId)) as Fila[]
      expect(act.some((x) => String(x.descripcion).includes('aprobada desde el portal por Juan Pérez'))).toBe(true)
      const bit = ok(await a.from('bitacora').select('usuario_nombre, accion').eq('tabla', 'cotizaciones').eq('registro_id', cotPortal)) as Fila[]
      expect(bit.some((b) => b.usuario_nombre === 'Cliente (portal)' && b.accion === 'cambio_estado')).toBe(true)

      const { error: otraVez } = await anon.rpc('portal_aprobar_cotizacion', { p_token: token, p_nombre: 'Juan Pérez' })
      expect(otraVez?.message).toContain('ya fue aprobada')
      const enlace = ok(await v.from('portal_enlaces').select('vistas').eq('token', token).single()) as Fila
      expect(num(enlace.vistas)).toBeGreaterThan(0)
    })

    it('no aprueba una cotización vencida', async () => {
      const vencida = ok(await v.rpc('guardar_cotizacion', {
        p_datos: { cliente_id: clientePortalId, fecha: dia(new Date(), -40), vigencia_dias: 15, partidas: [{ concepto: 'Tazas', metodo_calculo: 'pieza', unidad: 'pza', cantidad: 10, precio_unitario: 80 }] },
      })) as { id: string }
      ok(await v.from('cotizaciones').update({ estado: 'enviada' }).eq('id', vencida.id))
      const e = ok(await v.rpc('crear_enlace_portal', { p_tipo: 'cotizacion', p_id: vencida.id })) as Fila
      const r = ok(await anon.rpc('portal_obtener', { p_token: e.token })) as Record<string, any>
      expect(r.cotizacion.vigente).toBe(false)
      expect(r.cotizacion.puede_aprobar).toBe(false)
      const { error } = await anon.rpc('portal_aprobar_cotizacion', { p_token: e.token, p_nombre: 'Juan Pérez' })
      expect(error?.message).toContain('venció')
    })

    it('el cliente aprueba o pide cambios a los diseños de su pedido, una vez por diseño', async () => {
      pedidoPortal = ok(await v.rpc('convertir_cotizacion_a_pedido', { p_cotizacion: cotPortal, p_fecha_entrega: dia(new Date(), 7) })) as string
      const subir = async (nombre: string) => {
        const ruta = `pedidos/${pedidoPortal}/${nombre}`
        const png = new Blob([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' })
        ok(await d.storage.from('archivos').upload(ruta, png, { contentType: 'image/png' }))
        const arch = ok(await d.from('archivos').insert({ pedido_id: pedidoPortal, nombre, path: ruta, mime: 'image/png', aprobacion_notas: 'NOTA-DISENO-INTERNA' }).select('id').single()) as { id: string }
        return arch.id
      }
      archivoV1 = await subir(`propuesta-v1-${sufijo}.png`)

      const e = ok(await v.rpc('crear_enlace_portal', { p_tipo: 'pedido', p_id: pedidoPortal })) as Fila
      tokenPedido = e.token as string
      const r = ok(await anon.rpc('portal_obtener', { p_token: tokenPedido })) as Record<string, any>
      expect(r.tipo).toBe('pedido')
      expect(r.pedido.estado).toBe('esperando_aprobacion')
      expect(r.pedido.disenos[0]).toMatchObject({ id: archivoV1, version: 1, estado_aprobacion: 'pendiente', tiene_archivo: true, puede_responder: true })
      expect(r.pedido.etapas).toContain('esperando_aprobacion')
      expect(r.pedido.linea_tiempo.length).toBeGreaterThan(0)
      expect(Object.keys(r.pedido.linea_tiempo[0]).sort()).toEqual(['estado', 'fecha'])
      expect(JSON.stringify(r)).not.toContain('NOTA-DISENO-INTERNA')
      expect(JSON.stringify(r)).not.toContain('pedidos/')
      // El enlace de la cotización también muestra el pedido que salió de ella
      const desdeCot = ok(await anon.rpc('portal_obtener', { p_token: token })) as Record<string, any>
      expect(desdeCot.pedido.folio).toBe(r.pedido.folio)

      const { error: sinComentario } = await anon.rpc('portal_responder_diseno', { p_token: tokenPedido, p_archivo_id: archivoV1, p_aprobado: false, p_nombre: 'Juan Pérez' })
      expect(sinComentario?.message).toContain('cambios')
      const cambios = ok(await anon.rpc('portal_responder_diseno', { p_token: tokenPedido, p_archivo_id: archivoV1, p_aprobado: false, p_nombre: 'Juan Pérez', p_comentario: 'Logo más grande' })) as Fila
      expect(cambios).toMatchObject({ estado_aprobacion: 'cambios', estado_pedido: 'en_diseno' })
      const { error: otraVez } = await anon.rpc('portal_responder_diseno', { p_token: tokenPedido, p_archivo_id: archivoV1, p_aprobado: true, p_nombre: 'Juan Pérez' })
      expect(otraVez?.message).toContain('ya tiene una respuesta')

      archivoV2 = await subir(`propuesta-v2-${sufijo}.png`)
      const aprobado = ok(await anon.rpc('portal_responder_diseno', { p_token: token, p_archivo_id: archivoV2, p_aprobado: true, p_nombre: 'Juan Pérez' })) as Fila
      expect(aprobado).toMatchObject({ estado_aprobacion: 'aprobado', estado_pedido: 'aprobado', version: 2 })
      const arch = ok(await d.from('archivos').select('estado_aprobacion, aprobado_por_nombre, aprobacion_registrada_por').eq('id', archivoV2).single()) as Fila
      expect(arch).toMatchObject({ estado_aprobacion: 'aprobado', aprobado_por_nombre: 'Juan Pérez', aprobacion_registrada_por: null })
      const eventos = ok(await p.from('pedido_eventos').select('tipo, mensaje').eq('pedido_id', pedidoPortal).eq('tipo', 'aprobacion')) as Fila[]
      expect(eventos.some((x) => String(x.mensaje).includes('portal del cliente'))).toBe(true)
    })

    it('no deja tocar diseños de otro pedido ni aprobar cotizaciones con enlace de pedido', async () => {
      const otro = ok(await d.from('archivos').insert({ pedido_id: pedidoId, nombre: 'ajeno.png', enlace_externo: 'https://drive.example/ajeno' }).select('id').single()) as { id: string }
      const { error } = await anon.rpc('portal_responder_diseno', { p_token: tokenPedido, p_archivo_id: otro.id, p_aprobado: true, p_nombre: 'Juan Pérez' })
      expect(error?.message).toContain('no encontrado')
      const { error: cot } = await anon.rpc('portal_aprobar_cotizacion', { p_token: tokenPedido, p_nombre: 'Juan Pérez' })
      expect(cot?.message).toContain('no es de una cotización')
      // Producción no puede usar un enlace para aprobar diseños a nombre del cliente
      const archivoV3 = ok(await d.from('archivos').insert({ pedido_id: pedidoPortal, nombre: 'v3.png', enlace_externo: 'https://drive.example/v3' }).select('id').single()) as { id: string }
      const { error: prod } = await p.rpc('portal_responder_diseno', { p_token: tokenPedido, p_archivo_id: archivoV3.id, p_aprobado: true, p_nombre: 'Juan Pérez' })
      expect(prod).toBeTruthy()
    })

    it('solo la llave de servicio obtiene las rutas de los diseños firmables', async () => {
      const filas = ok(await sistema.rpc('portal_archivos_firmables', { p_token: tokenPedido })) as Fila[]
      expect(filas.map((x) => x.id).sort()).toEqual([archivoV1, archivoV2].sort())
      const { error } = await sistema.rpc('portal_archivos_firmables', { p_token: 'B'.repeat(43) })
      expect(error?.message).toBe(errorInvalido!.message)
    })

    it('al revocar el enlace deja de funcionar', async () => {
      const e = ok(await v.from('portal_enlaces').select('id').eq('token', tokenPedido).single()) as { id: string }
      const { error: prod } = await p.rpc('revocar_enlace_portal', { p_enlace: e.id })
      expect(prod).toBeTruthy()
      ok(await v.rpc('revocar_enlace_portal', { p_enlace: e.id }))
      const { error } = await anon.rpc('portal_obtener', { p_token: tokenPedido })
      expect(error?.message).toBe(errorInvalido!.message)
    })
  })

  // -------------------------------------------------------------------
  // Acceso sin sesión o con usuario inactivo
  // -------------------------------------------------------------------
  it('un usuario inactivo no ve nada de las tablas nuevas', async () => {
    for (const tabla of ['tareas', 'materiales', 'movimientos_inventario', 'proveedores', 'gastos', 'cortes_caja', 'producto_precios', 'portal_enlaces']) {
      const { data } = await inactivo.from(tabla).select('*').limit(1)
      expect(data ?? []).toEqual([])
    }
    const { error } = await inactivo.rpc('agenda', { p_desde: HOY, p_hasta: HOY })
    expect(error).toBeTruthy()
    const { error: tarea } = await inactivo.from('tareas').insert({ titulo: 'No debería' })
    expect(tarea).toBeTruthy()
  })
})

// ---------------------------------------------------------------------
// Función de Edge "portal-cliente" (opcional: requiere PORTAL_FN_URL)
// ---------------------------------------------------------------------
suiteFn('Función portal-cliente', () => {
  let token = '', archivoId = '', pedidoId = ''

  beforeAll(async () => {
    const email = `f23fn-ventas-${sufijo}@prueba.local`
    await crearUsuario(email, { rol: 'ventas', activo: true, nombre: 'Ventas Función' })
    const v = await sesion(email)
    const c = ok(await v.from('clientes').insert({ nombre: `Cliente Función ${sufijo}` }).select('id').single()) as { id: string }
    const q = ok(await v.rpc('guardar_cotizacion', { p_datos: { cliente_id: c.id, partidas: [{ concepto: 'Vinil', metodo_calculo: 'pieza', unidad: 'pza', cantidad: 1, precio_unitario: 100 }] } })) as { id: string }
    pedidoId = ok(await v.rpc('convertir_cotizacion_a_pedido', { p_cotizacion: q.id })) as string
    const ruta = `pedidos/${pedidoId}/diseno-${sufijo}.png`
    ok(await v.storage.from('archivos').upload(ruta, new Blob([Uint8Array.from([137, 80, 78, 71])], { type: 'image/png' }), { contentType: 'image/png' }))
    const arch = ok(await v.from('archivos').insert({ pedido_id: pedidoId, nombre: 'diseño.png', path: ruta, mime: 'image/png' }).select('id').single()) as { id: string }
    archivoId = arch.id
    const e = ok(await v.rpc('crear_enlace_portal', { p_tipo: 'pedido', p_id: pedidoId })) as { token: string }
    token = e.token
  })

  const llamar = (cuerpo: unknown) =>
    fetch(FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` }, body: JSON.stringify(cuerpo) })

  it('entrega URL firmadas de corta duración solo de los diseños del pedido', async () => {
    const r = await llamar({ token })
    expect(r.status).toBe(200)
    const cuerpo = (await r.json()) as { archivos: Array<{ id: string; url: string; expira_en: number }> }
    expect(cuerpo.archivos).toHaveLength(1)
    expect(cuerpo.archivos[0].id).toBe(archivoId)
    expect(cuerpo.archivos[0].expira_en).toBeLessThanOrEqual(600)
    const img = await fetch(cuerpo.archivos[0].url)
    expect(img.status).toBe(200)
    const uno = (await (await llamar({ token, archivo_id: archivoId })).json()) as { archivos: unknown[] }
    expect(uno.archivos).toHaveLength(1)
    const otro = (await (await llamar({ token, archivo_id: '00000000-0000-0000-0000-000000000000' })).json()) as { archivos: unknown[] }
    expect(otro.archivos).toHaveLength(0)
  })

  it('token inválido o solicitud mal formada: respuesta genérica', async () => {
    const r1 = await llamar({ token: 'C'.repeat(43) })
    const r2 = await llamar({ token: 'x' })
    expect(r1.status).toBe(404)
    expect(r2.status).toBe(404)
    expect(await r1.json()).toEqual(await r2.json())
    const r3 = await fetch(FN_URL, { method: 'GET' })
    expect(r3.status).toBe(405)
    const r4 = await fetch(FN_URL, { method: 'POST', body: 'no es json', headers: { 'Content-Type': 'application/json' } })
    expect(r4.status).toBe(400)
    const pre = await fetch(FN_URL, { method: 'OPTIONS' })
    expect(pre.headers.get('access-control-allow-origin')).toBeTruthy()
  })
})
