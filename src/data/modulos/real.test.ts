/**
 * Capa de datos REAL por módulos (src/data/modulos/<m>/supabase.ts) contra Supabase local.
 * Comprueba que cada contrato funciona con la base de datos y sus permisos (RLS):
 *
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... npm run test:db
 * (sin esas variables la prueba se omite; vive aquí para revisar sus tipos con los de la app)
 *
 * No cierra la caja de hoy (otras pruebas registran pagos en efectivo de hoy).
 */
import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const entorno = process.env
const URL = entorno.SUPABASE_URL ?? ''
const ANON = entorno.SUPABASE_ANON_KEY ?? ''
const SERVICE = entorno.SUPABASE_SERVICE_ROLE_KEY ?? ''
const activo = Boolean(URL && ANON && SERVICE)
const suite = activo ? describe : describe.skip

const PASS = 'Prueba12345'
const sufijo = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`
const correo = (rol: string) => `mod-${rol}-${sufijo}@prueba.local`
const HOY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date())

type ApiReal = (typeof import('@/data/supabaseApi'))['apiSupabase']
let api: ApiReal

async function como(rol: 'admin' | 'ventas' | 'diseno' | 'produccion') {
  await api.sesion.cerrar()
  await api.sesion.iniciar(correo(rol), PASS)
}

suite('Capa de datos real por módulos', () => {
  const ids: Record<string, string> = {}

  beforeAll(async () => {
    vi.stubEnv('VITE_SUPABASE_URL', URL)
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', ANON)
    vi.stubEnv('VITE_DEMO', 'false')
    const sistema = createClient(URL, SERVICE, { auth: { persistSession: false } })
    for (const [rol, nombre] of [
      ['admin', 'Admin Módulos'],
      ['ventas', 'Ventas Módulos'],
      ['diseno', 'Diseño Módulos'],
      ['produccion', 'Producción Módulos'],
    ] as const) {
      const { data, error } = await sistema.auth.admin.createUser({ email: correo(rol), password: PASS, email_confirm: true, app_metadata: { rol, activo: true, nombre } })
      if (error) throw error
      ids[rol] = data.user!.id
    }
    api = (await import('@/data/supabaseApi')).apiSupabase
  }, 60_000)

  afterAll(async () => {
    await api?.sesion.cerrar()
    vi.unstubAllEnvs()
  })

  it('la composición expone todos los espacios del contrato', () => {
    expect(Object.keys(api).sort()).toEqual(
      [
        'actividades', 'agenda', 'archivos', 'bitacora', 'busqueda', 'caja', 'catalogo', 'clientes', 'cobranza', 'comisiones', 'configuracion', 'contactos',
        'cotizaciones', 'dashboard', 'gastos', 'inventario', 'materiales', 'oportunidades', 'pagos', 'pedidos', 'plantillas', 'portal', 'produccion',
        'proveedores', 'reportes', 'sesion', 'tareas', 'usuarios',
      ].sort(),
    )
  })

  it('núcleo y administración: sesión, configuración, plantillas, equipo y panel', async () => {
    await como('admin')
    const s = await api.sesion.actual()
    expect(s?.perfil.rol).toBe('admin')
    expect(s?.permisos.gestionar_inventario).toBe(true)
    const conf = await api.configuracion.obtener()
    expect(conf.id).toBe(1)
    const plantillas = await api.plantillas.listar()
    expect(plantillas.some((p) => p.clave === 'portal_cotizacion')).toBe(true)
    expect((await api.usuarios.listar()).some((u) => u.id === ids.ventas)).toBe(true)
    const u = await api.usuarios.cambiarPermisos(ids.ventas, { exportar_datos: true })
    expect(u.permisos_personalizados.exportar_datos).toBe(true)
    await api.usuarios.cambiarPermisos(ids.ventas, { exportar_datos: null })
    const panel = await api.dashboard.resumen()
    expect(panel.stock_bajo).toBeDefined()
    expect((await api.bitacora.listar({ limite: 3 })).length).toBeGreaterThan(0)
  })

  it('clientes, contactos, actividades y embudo', async () => {
    await como('ventas')
    const c = await api.clientes.crear({ nombre: `Cliente módulos ${sufijo}`, whatsapp: '3300000000', etiquetas: ['prueba'] })
    ids.cliente = c.id
    expect((await api.clientes.buscar(`módulos ${sufijo}`)).map((x) => x.id)).toEqual([c.id])
    const ficha = await api.clientes.actualizar(c.id, { lista_precio: 'mayoreo', rfc: 'mod200101aa1' })
    expect(ficha.rfc).toBe('MOD200101AA1')
    expect(ficha.vendedor).toBeNull()
    expect((await api.clientes.listar({ texto: sufijo })).length).toBe(1)
    expect(await api.clientes.etiquetas()).toContain('prueba')
    const ct = await api.contactos.crear(c.id, { nombre: 'Contacto 1', principal: true })
    await api.contactos.crear(c.id, { nombre: 'Contacto 2', principal: true })
    expect((await api.contactos.listar(c.id)).find((x) => x.id === ct.id)?.principal).toBe(false)
    const o = await api.oportunidades.crear({ cliente_id: c.id, titulo: 'Oportunidad de prueba', valor_estimado: 1500, proxima_accion_fecha: HOY })
    expect(o.cliente.nombre).toBe(c.nombre)
    await expect(api.oportunidades.moverEtapa(o.id, 'perdido')).rejects.toThrow('motivo')
    const perdida = await api.oportunidades.moverEtapa(o.id, 'perdido', 'Sin presupuesto')
    expect(perdida.cerrada_at).not.toBeNull()
    expect((await api.oportunidades.listar({ clienteId: c.id })).map((x) => x.id)).toEqual([o.id])
    expect((await api.oportunidades.resumen()).perdido?.cantidad).toBeGreaterThan(0)
    const act = await api.actividades.registrar({ cliente_id: c.id, oportunidad_id: o.id, tipo: 'llamada', descripcion: 'Llamada de prueba' })
    expect(act.usuario).toBe('Ventas Módulos')
    expect((await api.actividades.listar({ oportunidadId: o.id })).length).toBe(1)
    expect((await api.clientes.resumen(c.id)).pedidos).toBe(0)
    await como('diseno')
    await expect(api.actividades.listar({ clienteId: c.id })).resolves.toEqual([])
    await expect(api.clientes.crear({ nombre: 'No debe' })).rejects.toThrow()
  })

  it('catálogo: productos, precios por lista y respaldo al público', async () => {
    await como('admin')
    const productos = await api.catalogo.productos()
    expect(productos.length).toBeGreaterThan(10)
    const p = await api.catalogo.crearProducto({ nombre: `Producto módulos ${sufijo}`, metodo_calculo: 'pieza', unidad: 'pza', precio_venta: 100 })
    ids.producto = p.id
    await api.catalogo.guardarPrecioLista({ producto_id: p.id, lista: 'mayoreo', precio: 80, precio_minimo: null, escalas: [{ desde: 50, precio: 70 }] })
    await api.catalogo.guardarCostos(p.id, { costo_material: 30, costo_mano_obra: 5, costo_fijo: 0, desperdicio_pct: 0, ganancia_pct: 100 })
    const ficha = await api.catalogo.obtener(p.id)
    expect(ficha.precios).toEqual([{ producto_id: p.id, lista: 'mayoreo', precio: 80, precio_minimo: null, escalas: [{ desde: 50, precio: 70 }] }])
    expect(ficha.costos?.costo_material).toBe(30)
    const mayoreo = await api.catalogo.preciosPara('mayoreo')
    expect(mayoreo.find((x) => x.producto_id === p.id)?.precio).toBe(80)
    const agencia = await api.catalogo.preciosPara('agencia')
    expect(agencia.find((x) => x.producto_id === p.id)).toMatchObject({ lista_aplicada: 'publico', precio: 100 })
    expect((await api.catalogo.categorias()).length).toBeGreaterThan(10)
    await como('produccion')
    await expect(api.catalogo.precios(p.id)).resolves.toEqual([])
    expect((await api.catalogo.obtener(p.id)).costos).toBeNull()
  })

  it('pedidos, archivos, producción, pagos y cobranza', async () => {
    await como('ventas')
    const { id, folio } = await api.pedidos.crear({
      cliente_id: ids.cliente,
      titulo: 'Pedido de módulos',
      fecha_entrega: HOY,
      partidas: [{ concepto: 'Producto de prueba', metodo_calculo: 'pieza', cantidad: 2, precio_unitario: 500, producto_id: ids.producto }],
    })
    ids.pedido = id
    expect(folio).toMatch(/^PED-/)
    const d = await api.pedidos.obtener(id)
    expect(d.montos?.total).toBe(1160)
    expect(d.partidas[0].importe).toBe(1000)
    await api.pedidos.agregarNota(id, 'Nota de prueba')
    await api.pedidos.cambiarEstado(id, 'en_diseno')
    const archivo = await api.archivos.agregarEnlace(id, { nombre: 'Diseño v1', enlace: 'https://example.com/v1.pdf' })
    expect(archivo.version).toBe(1)
    expect((await api.pedidos.obtener(id)).estado).toBe('esperando_aprobacion')
    await api.archivos.registrarAprobacion(archivo.id, { estado: 'aprobado', aprobado_por_nombre: 'Cliente' })
    expect((await api.archivos.url(archivo.id))).toBe('https://example.com/v1.pdf')
    const subido = await api.archivos.subir(id, new Blob(['%PDF-1.4 prueba'], { type: 'application/pdf' }), { nombre: 'referencia.pdf', categoria: 'referencia' })
    expect(await api.archivos.url(subido.id)).toMatch(/^http/)
    await api.archivos.eliminar(subido.id)
    const eventos = await api.pedidos.eventos(id)
    expect(eventos.map((e) => e.tipo)).toEqual(expect.arrayContaining(['creado', 'nota', 'estado', 'archivo', 'aprobacion']))

    const pago = await api.pagos.registrar({ pedido_id: id, importe: 580, tipo: 'anticipo', metodo: 'transferencia', referencia: 'SPEI prueba' })
    expect(pago.folio).toBe(folio)
    expect(pago.registrado_por_nombre).toBe('Ventas Módulos')
    const conComprobante = await api.pagos.subirComprobante(pago.id, new Blob(['img'], { type: 'image/png' }))
    expect(conComprobante.comprobante_path).toMatch(new RegExp(`^pagos/${id}/`))
    expect(await api.pagos.urlComprobante(pago.id)).toMatch(/^http/)
    expect((await api.pagos.porPedido(id)).length).toBe(1)
    const cxc = await api.cobranza.cuentasPorCobrar()
    expect(cxc.find((x) => x.pedido_id === id)?.saldo).toBe(580)
    await expect(api.pagos.cancelar(pago.id, 'Prueba')).rejects.toThrow()
    const caja = await api.caja.resumen()
    expect(caja.fecha).toBe(HOY)
    expect(caja.cerrado).toBe(false)
    expect((await api.comisiones.resumen(HOY, HOY)).map((c) => c.nombre)).toEqual(['Ventas Módulos'])

    await como('produccion')
    const tablero = await api.produccion.tablero()
    const orden = tablero.find((o) => o.id === id)!
    expect(orden).not.toHaveProperty('total')
    expect(orden.cliente).toBe(`Cliente módulos ${sufijo}`)
    const hoja = await api.produccion.orden(id)
    expect(hoja.partidas[0]).not.toHaveProperty('precio_unitario')
    await api.produccion.moverEtapa(id, 'en_produccion')
    await api.produccion.guardarNotaPartida(hoja.partidas[0].id, 'Cuidar el color')
    expect((await api.produccion.orden(id)).partidas[0].notas_produccion).toBe('Cuidar el color')
    const sinPrecios = await api.pedidos.obtener(id)
    expect(sinPrecios.montos).toBeNull()
    expect(sinPrecios.total).toBeNull()
    await expect(api.pagos.listar({ pedidoId: id })).resolves.toEqual([])

    await como('admin')
    await api.pagos.cancelar(pago.id, 'Prueba de cancelación')
    expect((await api.pedidos.obtener(id)).estado_pago).toBe('pendiente')
    await api.pedidos.facturar(id, { facturado: true, folio_factura: 'A-9999' })
    expect((await api.pedidos.obtener(id)).folio_factura).toBe('A-9999')
  })

  it('inventario, proveedores y gastos', async () => {
    await como('admin')
    const prov = await api.proveedores.crear({ nombre: `Proveedor módulos ${sufijo}`, rfc: 'pmo' })
    expect(prov.rfc).toBe('PMO')
    const m = await api.materiales.crear({ nombre: `Material módulos ${sufijo}`, unidad: 'm2', stock_minimo: 10, existencia_inicial: 12, costo_unitario: 40, proveedor_id: prov.id })
    expect(m.existencia).toBe(12)
    expect(m.costo_unitario).toBe(40)
    expect(m.proveedor).toBe(prov.nombre)
    await api.inventario.registrar({ material_id: m.id, tipo: 'entrada', cantidad: 8, proveedor_id: prov.id, referencia: 'Factura 1' })
    const ajuste = await api.inventario.ajustar(m.id, 18, 'Conteo')
    expect(ajuste.diferencia).toBe(-2)
    const g = await api.gastos.registrar({ concepto: 'Compra de prueba', categoria: 'material', monto: 320, metodo_pago: 'transferencia', proveedor_id: prov.id, pedido_id: ids.pedido })
    expect(g.folio_pedido).toMatch(/^PED-/)
    expect((await api.gastos.listar({ pedidoId: ids.pedido })).map((x) => x.id)).toEqual([g.id])
    await api.gastos.cancelar(g.id, 'Prueba')
    await como('produccion')
    await api.inventario.registrar({ material_id: m.id, tipo: 'consumo', cantidad: 9, pedido_id: ids.pedido })
    expect((await api.materiales.obtener(m.id)).bajo_minimo).toBe(true)
    expect((await api.inventario.stockBajo()).some((x) => x.id === m.id)).toBe(true)
    await expect(api.inventario.registrar({ material_id: m.id, tipo: 'consumo', cantidad: 100 })).rejects.toThrow('No hay suficiente existencia')
    await expect(api.inventario.registrar({ material_id: m.id, tipo: 'entrada', cantidad: 1 })).rejects.toThrow()
    expect((await api.materiales.obtener(m.id)).costo_unitario).toBeNull()
    const kardex = await api.inventario.movimientos({ materialId: m.id })
    expect(kardex.map((k) => k.tipo)).toEqual(['consumo', 'ajuste', 'entrada', 'ajuste'])
    // Sin permiso la base no devuelve filas (RLS); la vista previa además avisa con un error
    await expect(api.gastos.listar()).resolves.toEqual([])
  })

  it('agenda y reportes', async () => {
    await como('diseno')
    const t = await api.tareas.crear({ titulo: 'Tarea de módulos', pedido_id: ids.pedido, hora: '09:30' })
    expect(t.cliente_id).toBe(ids.cliente)
    expect(t.hora).toBe('09:30')
    expect((await api.tareas.misPendientes()).some((x) => x.id === t.id)).toBe(true)
    expect((await api.tareas.completar(t.id)).completada).toBe(true)
    const cal = await api.agenda.calendario(HOY, HOY)
    expect(cal.some((e) => e.id === t.id)).toBe(true)
    await como('admin')
    const ventas = await api.reportes.ventas(HOY, HOY, 'dia')
    expect(ventas[0].pedidos).toBeGreaterThan(0)
    expect(Array.isArray(await api.reportes.productos(HOY, HOY))).toBe(true)
    expect(Array.isArray(await api.reportes.vendedores(HOY, HOY))).toBe(true)
    expect((await api.reportes.clientes(HOY, HOY, 200)).some((c) => c.cliente_id === ids.cliente)).toBe(true)
    const utilidad = await api.reportes.utilidad(HOY, HOY)
    expect(utilidad.find((u) => u.pedido_id === ids.pedido)?.consumo_material).toBe(360)
    expect(Array.isArray(await api.clientes.inactivos(30))).toBe(true)
  })

  it('portal: el CRM crea el enlace y el cliente lo usa sin sesión', async () => {
    await como('admin')
    const e = await api.portal.crearEnlace('pedido', ids.pedido, { dias: 5 })
    expect(e.nuevo).toBe(true)
    expect(e.url).toContain(`/portal/${e.token}`)
    expect((await api.portal.crearEnlace('pedido', ids.pedido)).id).toBe(e.id)
    expect((await api.portal.enlaces({ pedidoId: ids.pedido })).map((x) => x.id)).toEqual([e.id])
    // Las funciones públicas usan su propio cliente sin sesión (anon)
    const vista = await api.portal.obtener(e.token)
    expect(vista.pedido?.titulo).toBe('Pedido de módulos')
    expect(vista.empresa.rfc).toBeUndefined()
    await api.portal.revocarEnlace(e.id)
    await expect(api.portal.obtener(e.token)).rejects.toThrow('no es válido')
    await expect(api.portal.obtener('token-inventado-que-no-existe-0123456789')).rejects.toThrow('no es válido')
  })
})
