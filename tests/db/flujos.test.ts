/**
 * Pruebas de la base de datos contra Supabase local (`supabase start`).
 * Verifican permisos por rol, totales automáticos, conversión a pedido, pagos y bitácora.
 *
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... npx vitest run tests/db
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'

const URL = process.env.SUPABASE_URL ?? ''
const ANON = process.env.SUPABASE_ANON_KEY ?? ''
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const activo = Boolean(URL && ANON && SERVICE)
const suite = activo ? describe : describe.skip

const admin = activo ? createClient(URL, SERVICE, { auth: { persistSession: false } }) : (null as never)
const PASS = 'Prueba12345'
const sufijo = Date.now().toString(36)

async function crearUsuario(email: string, appMeta: Record<string, unknown> = {}) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASS,
    email_confirm: true,
    app_metadata: appMeta,
  })
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

suite('Flujos de negocio y permisos', () => {
  let a: SupabaseClient, v: SupabaseClient, d: SupabaseClient, p: SupabaseClient, inactivo: SupabaseClient
  let idVentas = ''
  let clienteId = '', oportunidadId = '', cotizacionId = '', pedidoId = '', productoId = ''

  beforeAll(async () => {
    // El primer usuario del sistema se vuelve administrador
    const { count } = await admin.from('perfiles').select('*', { count: 'exact', head: true }).eq('rol', 'admin')
    const emailAdmin = count ? `admin@prueba.local` : `admin@prueba.local`
    if (!count) await crearUsuario(emailAdmin)
    idVentas = await crearUsuario(`ventas-${sufijo}@prueba.local`, { rol: 'ventas', activo: true, nombre: 'Vendedora Prueba' })
    await crearUsuario(`diseno-${sufijo}@prueba.local`, { rol: 'diseno', activo: true, nombre: 'Diseñador Prueba' })
    await crearUsuario(`prod-${sufijo}@prueba.local`, { rol: 'produccion', activo: true, nombre: 'Producción Prueba' })
    await crearUsuario(`inactivo-${sufijo}@prueba.local`)
    a = await sesion(emailAdmin)
    v = await sesion(`ventas-${sufijo}@prueba.local`)
    d = await sesion(`diseno-${sufijo}@prueba.local`)
    p = await sesion(`prod-${sufijo}@prueba.local`)
    inactivo = await sesion(`inactivo-${sufijo}@prueba.local`)
  })

  it('asigna permisos efectivos por rol', async () => {
    const pa = ok(await a.rpc('mis_permisos')) as Record<string, boolean>
    const pv = ok(await v.rpc('mis_permisos')) as Record<string, boolean>
    const pp = ok(await p.rpc('mis_permisos')) as Record<string, boolean>
    expect(Object.values(pa).every(Boolean)).toBe(true)
    expect(pv.ver_precios).toBe(true)
    expect(pv.ver_costos).toBe(false)
    expect(pp.ver_precios).toBe(false)
    expect(pp.actualizar_produccion).toBe(true)
  })

  it('un usuario inactivo no ve información', async () => {
    const { data } = await inactivo.from('clientes').select('id')
    expect(data).toEqual([])
    const { data: conf } = await inactivo.from('configuracion').select('*')
    expect(conf).toEqual([])
  })

  it('sin sesión no hay acceso', async () => {
    const anon = createClient(URL, ANON, { auth: { persistSession: false } })
    const { data, error } = await anon.from('clientes').select('id')
    expect(error ?? data?.length === 0).toBeTruthy()
  })

  it('ventas no puede cambiar su propio rol', async () => {
    const { error } = await v.from('perfiles').update({ rol: 'admin' }).eq('id', idVentas)
    expect(error).toBeTruthy()
  })

  it('el administrador captura costos y precio de un producto', async () => {
    const prod = ok(await a.from('productos').select('id').eq('nombre', 'Lona impresa').single()) as { id: string }
    productoId = prod.id
    ok(await a.from('productos').update({ precio_venta: 180 }).eq('id', productoId))
    ok(await a.from('producto_costos').upsert({
      producto_id: productoId, costo_material: 60, costo_mano_obra: 10, desperdicio_pct: 10, costo_fijo: 0, ganancia_pct: 100,
    }))
    const { data } = await v.from('producto_costos').select('*')
    expect(data).toEqual([])
  })

  it('ventas crea cliente, oportunidad y cotización con totales automáticos', async () => {
    const c = ok(await v.from('clientes').insert({ nombre: 'Taquería El Güero', whatsapp: '3312345678' }).select().single()) as { id: string }
    clienteId = c.id
    const o = ok(await v.from('oportunidades').insert({ cliente_id: clienteId, titulo: 'Lona fachada', valor_estimado: 2000 }).select().single()) as { id: string }
    oportunidadId = o.id
    const q = ok(await v.from('cotizaciones').insert({ cliente_id: clienteId, oportunidad_id: oportunidadId, titulo: 'Lona fachada' }).select().single()) as { id: string; folio: string }
    cotizacionId = q.id
    expect(q.folio).toMatch(/^COT-\d{4}$/)
    ok(await v.from('partidas').insert([
      { cotizacion_id: cotizacionId, orden: 1, tipo: 'concepto', producto_id: productoId, concepto: 'Lona impresa 13 oz', metodo_calculo: 'm2', unidad: 'pza', ancho: 3, alto: 2, cantidad: 2, precio_unitario: 1080 },
      { cotizacion_id: cotizacionId, orden: 2, tipo: 'instalacion', concepto: 'Instalación', metodo_calculo: 'servicio', unidad: 'servicio', cantidad: 1, precio_unitario: 500 },
    ], { defaultToNull: false }))
    ok(await v.from('cotizaciones').update({ descuento_tipo: 'pct', descuento_valor: 10, recargo_pct: 5 }).eq('id', cotizacionId))
    const t = ok(await v.from('cotizaciones').select('subtotal, descuento, recargo, iva, total').eq('id', cotizacionId).single()) as Record<string, number>
    // subtotal 2160 + 500 = 2660; desc 266; recargo 5% de 2394 = 119.70; base 2513.70; iva 402.19; total 2915.89
    expect(Number(t.subtotal)).toBe(2660)
    expect(Number(t.descuento)).toBe(266)
    expect(Number(t.recargo)).toBe(119.7)
    expect(Number(t.iva)).toBe(402.19)
    expect(Number(t.total)).toBe(2915.89)
  })

  it('el costo estimado se calcula desde el catálogo y solo lo ve quien tiene ver_costos', async () => {
    const { data: vc } = await v.from('partida_costos').select('*')
    expect(vc).toEqual([])
    const costos = ok(await a.from('partidas').select('concepto, partida_costos(costo_total)').eq('cotizacion_id', cotizacionId).order('orden')) as unknown as Array<{ partida_costos: { costo_total: number } | null }>
    // (60 × 1.10 + 10) × (3 × 2 × 2 = 12 m²) = 76 × 12 = 912
    expect(Number(costos[0].partida_costos?.costo_total)).toBe(912)
  })

  it('enviar la cotización avanza la oportunidad', async () => {
    ok(await v.from('cotizaciones').update({ estado: 'enviada' }).eq('id', cotizacionId))
    const o = ok(await v.from('oportunidades').select('etapa').eq('id', oportunidadId).single()) as { etapa: string }
    expect(o.etapa).toBe('cotizacion_enviada')
  })

  it('duplica la cotización con folio nuevo', async () => {
    const nueva = ok(await v.rpc('duplicar_cotizacion', { p_cotizacion: cotizacionId })) as string
    const q = ok(await v.from('cotizaciones').select('folio, estado, total').eq('id', nueva).single()) as { folio: string; estado: string; total: number }
    expect(q.estado).toBe('borrador')
    expect(Number(q.total)).toBe(2915.89)
  })

  it('convierte la cotización en pedido sin recapturar', async () => {
    pedidoId = ok(await v.rpc('convertir_cotizacion_a_pedido', { p_cotizacion: cotizacionId, p_fecha_entrega: '2030-01-15' })) as string
    const ped = ok(await v.from('pedidos').select('folio, total, estado, etapas_omitidas, requiere_instalacion').eq('id', pedidoId).single()) as Record<string, unknown>
    expect(ped.folio).toMatch(/^PED-\d{4}$/)
    expect(Number(ped.total)).toBe(2915.89)
    expect(ped.requiere_instalacion).toBe(true)
    expect(ped.etapas_omitidas).toEqual([])
    const q = ok(await v.from('cotizaciones').select('estado, pedido_id').eq('id', cotizacionId).single()) as Record<string, unknown>
    expect(q.estado).toBe('aceptada')
    const o = ok(await v.from('oportunidades').select('etapa').eq('id', oportunidadId).single()) as { etapa: string }
    expect(o.etapa).toBe('ganado')
    const { error } = await v.rpc('convertir_cotizacion_a_pedido', { p_cotizacion: cotizacionId })
    expect(error?.message).toContain('ya se convirtió')
  })

  it('registra pagos y calcula saldo y estado de pago', async () => {
    ok(await v.from('pagos').insert({ pedido_id: pedidoId, importe: 1500, tipo: 'anticipo', metodo: 'transferencia', referencia: 'SPEI 123' }))
    let ped = ok(await v.from('pedidos').select('pagado, saldo, estado_pago').eq('id', pedidoId).single()) as Record<string, number | string>
    expect(ped.estado_pago).toBe('anticipo')
    expect(Number(ped.saldo)).toBe(1415.89)
    const pago2 = ok(await v.from('pagos').insert({ pedido_id: pedidoId, importe: 1415.89, tipo: 'liquidacion', metodo: 'efectivo' }).select().single()) as { id: string }
    ped = ok(await v.from('pedidos').select('pagado, saldo, estado_pago').eq('id', pedidoId).single()) as Record<string, number | string>
    expect(ped.estado_pago).toBe('liquidado')
    // Ventas no puede cancelar pagos; admin sí, con motivo
    const { error } = await v.from('pagos').update({ cancelado: true, motivo_cancelacion: 'error' }).eq('id', pago2.id)
    expect(error).toBeTruthy()
    const { error: sinMotivo } = await a.from('pagos').update({ cancelado: true }).eq('id', pago2.id)
    expect(sinMotivo).toBeTruthy()
    ok(await a.from('pagos').update({ cancelado: true, motivo_cancelacion: 'Pago duplicado' }).eq('id', pago2.id))
    ped = ok(await v.from('pedidos').select('estado_pago, saldo').eq('id', pedidoId).single()) as Record<string, number | string>
    expect(ped.estado_pago).toBe('anticipo')
    // Los pagos no se eliminan
    const { error: borrar } = await a.from('pagos').delete().eq('id', pago2.id)
    expect(borrar).toBeTruthy()
  })

  it('producción ve órdenes sin montos y cambia etapas, pero no cancela', async () => {
    const { data: directos } = await p.from('pedidos').select('id')
    expect(directos).toEqual([])
    const ot = ok(await p.from('ordenes_trabajo').select('folio, total, saldo, anticipo_recibido').eq('id', pedidoId).single()) as Record<string, unknown>
    expect(ot.total).toBeNull()
    expect(ot.anticipo_recibido).toBe(true)
    const partidas = ok(await p.from('orden_partidas').select('concepto, precio_unitario, importe').eq('pedido_id', pedidoId)) as Array<Record<string, unknown>>
    expect(partidas.length).toBe(2)
    expect(partidas[0].precio_unitario).toBeNull()
    ok(await p.rpc('cambiar_estado_pedido', { p_pedido: pedidoId, p_estado: 'en_diseno' }))
    const { error } = await p.rpc('cambiar_estado_pedido', { p_pedido: pedidoId, p_estado: 'cancelado', p_motivo: 'x' })
    expect(error).toBeTruthy()
    const { error: sinMotivo } = await p.rpc('cambiar_estado_pedido', { p_pedido: pedidoId, p_estado: 'pausado' })
    expect(sinMotivo).toBeTruthy()
    const { error: pago } = await p.from('pagos').insert({ pedido_id: pedidoId, importe: 1, metodo: 'efectivo' })
    expect(pago).toBeTruthy()
    ok(await p.rpc('agregar_nota_pedido', { p_pedido: pedidoId, p_mensaje: 'Material listo' }))
  })

  it('diseño sube versiones y la aprobación avanza el pedido', async () => {
    const arch = ok(await d.from('archivos').insert({ pedido_id: pedidoId, nombre: 'propuesta.jpg', enlace_externo: 'https://drive.example/x' }).select().single()) as { id: string; version: number }
    expect(arch.version).toBe(1)
    let ot = ok(await d.from('ordenes_trabajo').select('estado').eq('id', pedidoId).single()) as { estado: string }
    expect(ot.estado).toBe('esperando_aprobacion')
    ok(await d.from('archivos').update({ estado_aprobacion: 'aprobado', aprobado_por_nombre: 'Don Güero' }).eq('id', arch.id))
    ot = ok(await d.from('ordenes_trabajo').select('estado').eq('id', pedidoId).single()) as { estado: string }
    expect(ot.estado).toBe('aprobado')
    const eventos = ok(await p.from('pedido_eventos').select('tipo, mensaje').eq('pedido_id', pedidoId)) as Array<{ tipo: string }>
    expect(eventos.some((e) => e.tipo === 'aprobacion')).toBe(true)
  })

  it('la bitácora registra cambios y solo la ve el administrador', async () => {
    const { data: deVentas } = await v.from('bitacora').select('id')
    expect(deVentas).toEqual([])
    const filas = ok(await a.from('bitacora').select('tabla, accion, usuario_nombre').eq('registro_id', pedidoId)) as Array<{ accion: string }>
    expect(filas.some((f) => f.accion === 'crear')).toBe(true)
    expect(filas.some((f) => f.accion === 'cambio_estado')).toBe(true)
  })

  it('el panel de control respeta permisos', async () => {
    const ra = ok(await a.rpc('dashboard_resumen')) as Record<string, unknown>
    const rp = ok(await p.rpc('dashboard_resumen')) as Record<string, unknown>
    expect(ra).toHaveProperty('ventas_mes')
    expect(ra).toHaveProperty('utilidad_estimada_mes')
    expect(rp).not.toHaveProperty('ventas_mes')
    expect(rp).not.toHaveProperty('cotizaciones_abiertas')
    expect(rp).toHaveProperty('pedidos_por_estado')
  })

  it('la búsqueda global encuentra por nombre sin acentos y por folio', async () => {
    const r = ok(await v.rpc('busqueda_global', { p_texto: 'guero' })) as Record<string, unknown[]>
    expect(r.clientes.length).toBeGreaterThan(0)
    const r2 = ok(await p.rpc('busqueda_global', { p_texto: 'PED-' })) as Record<string, unknown[]>
    expect(r2.pedidos.length).toBeGreaterThan(0)
    expect(r2.cotizaciones).toEqual([])
  })
})

suite('Guardado atómico de cotizaciones', () => {
  let v: SupabaseClient, a: SupabaseClient
  let clienteId = ''

  beforeAll(async () => {
    const email = `ventas2-${sufijo}@prueba.local`
    await crearUsuario(email, { rol: 'ventas', activo: true, nombre: 'Ventas Dos' })
    v = await sesion(email)
    a = await sesion('admin@prueba.local')
    const c = ok(await v.from('clientes').insert({ nombre: 'Gimnasio Fuerza' }).select().single()) as { id: string }
    clienteId = c.id
  })

  it('crea, edita y elimina conceptos en una sola llamada', async () => {
    const r = ok(await v.rpc('guardar_cotizacion', {
      p_datos: {
        cliente_id: clienteId, titulo: 'Rotulación', aplica_iva: true,
        partidas: [
          { concepto: 'Vinil para cristal', metodo_calculo: 'm2', unidad: 'pza', ancho: 2, alto: 1.5, cantidad: 2, precio_unitario: 600, costos: { costo_material: 50 } },
          { tipo: 'instalacion', concepto: 'Instalación', metodo_calculo: 'servicio', unidad: 'servicio', cantidad: 1, precio_unitario: 400 },
        ],
      },
    })) as { id: string; folio: string }
    expect(r.folio).toMatch(/^COT-/)
    let q = ok(await v.from('cotizaciones').select('total, partidas(id, concepto, orden)').eq('id', r.id).single()) as { total: number; partidas: Array<{ id: string; concepto: string; orden: number }> }
    expect(Number(q.total)).toBe(1856) // (1200 + 400) × 1.16
    // Ventas no tiene ver_costos: no se guardaron costos manuales
    const { data: costos } = await a.from('partida_costos').select('partida_id').in('partida_id', q.partidas.map((p) => p.id))
    expect(costos).toEqual([])

    const vinil = q.partidas.find((p) => p.orden === 1)!
    ok(await v.rpc('guardar_cotizacion', {
      p_datos: {
        id: r.id, cliente_id: clienteId, titulo: 'Rotulación', aplica_iva: false,
        partidas: [{ id: vinil.id, concepto: 'Vinil esmerilado', metodo_calculo: 'm2', unidad: 'pza', ancho: 2, alto: 1.5, cantidad: 3, precio_unitario: 600 }],
      },
    }))
    q = ok(await v.from('cotizaciones').select('total, partidas(id, concepto, orden)').eq('id', r.id).single()) as typeof q
    expect(q.partidas).toHaveLength(1)
    expect(q.partidas[0].concepto).toBe('Vinil esmerilado')
    expect(Number(q.total)).toBe(1800)
  })

  it('el administrador guarda costos manuales y no se puede editar una cotización convertida', async () => {
    const r = ok(await a.rpc('guardar_cotizacion', {
      p_datos: {
        cliente_id: clienteId,
        partidas: [{ concepto: 'Letrero', metodo_calculo: 'pieza', unidad: 'pza', cantidad: 2, precio_unitario: 1500, costos: { costo_material: 400, costo_mano_obra: 100, costo_fijo: 50 } }],
      },
    })) as { id: string }
    const p = ok(await a.from('partidas').select('partida_costos(costo_total, calculo)').eq('cotizacion_id', r.id).single()) as { partida_costos: { costo_total: number; calculo: { origen: string } } }
    expect(Number(p.partida_costos.costo_total)).toBe(1050)
    expect(p.partida_costos.calculo.origen).toBe('manual')
    ok(await a.rpc('convertir_cotizacion_a_pedido', { p_cotizacion: r.id }))
    const { error } = await a.rpc('guardar_cotizacion', { p_datos: { id: r.id, cliente_id: clienteId, partidas: [] } })
    expect(error?.message).toContain('ya se convirtió')
  })
})

suite('Integridad de documentos', () => {
  let v: SupabaseClient
  let cotId = ''
  let pedidoId = ''

  beforeAll(async () => {
    const email = `ventas3-${sufijo}@prueba.local`
    await crearUsuario(email, { rol: 'ventas', activo: true, nombre: 'Ventas Tres' })
    v = await sesion(email)
    const c = ok(await v.from('clientes').insert({ nombre: 'Panadería Integridad' }).select().single()) as { id: string }
    const r = ok(await v.rpc('guardar_cotizacion', {
      p_datos: { cliente_id: c.id, partidas: [{ concepto: 'Volantes', metodo_calculo: 'millar', unidad: 'millar', cantidad: 1, precio_unitario: 500 }] },
    })) as { id: string }
    cotId = r.id
    pedidoId = ok(await v.rpc('convertir_cotizacion_a_pedido', { p_cotizacion: cotId })) as string
  })

  it('no permite desligar ni editar a mano una cotización convertida', async () => {
    const { error: desligar } = await v.from('cotizaciones').update({ pedido_id: null }).eq('id', cotId)
    expect(desligar?.message).toContain('no se puede desligar')
    const { error: partida } = await v.from('partidas').update({ precio_unitario: 1 }).eq('cotizacion_id', cotId)
    expect(partida?.message).toContain('ya se convirtió')
    const { error: nueva } = await v.from('partidas').insert({ cotizacion_id: cotId, concepto: 'Extra', cantidad: 1, precio_unitario: 1, tipo: 'concepto', metodo_calculo: 'pieza', unidad: 'pza' })
    expect(nueva?.message).toContain('ya se convirtió')
  })

  it('los folios no se pueden cambiar', async () => {
    const { error: e1 } = await v.from('cotizaciones').update({ folio: 'COT-9999' }).eq('id', cotId)
    expect(e1?.message).toContain('folio')
    const { error: e2 } = await v.from('pedidos').update({ folio: 'PED-9999' }).eq('id', pedidoId)
    expect(e2?.message).toContain('folio')
  })

  it('el pedido conserva el vínculo con su cotización y sus conceptos siguen editables', async () => {
    const { error } = await v.from('pedidos').update({ cotizacion_id: null }).eq('id', pedidoId)
    expect(error).toBeTruthy()
    ok(await v.from('partidas').update({ cantidad: 2 }).eq('pedido_id', pedidoId))
    const p = ok(await v.from('pedidos').select('total').eq('id', pedidoId).single()) as { total: number }
    expect(Number(p.total)).toBe(1160)
  })
})
