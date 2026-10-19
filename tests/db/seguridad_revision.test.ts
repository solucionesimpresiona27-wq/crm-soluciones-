/**
 * Revisión de seguridad (migración 20261019000200_seguridad_revision.sql) contra Supabase local.
 * La interfaz solo oculta: aquí se prueba que la BASE niega, permite o rechaza con los cuatro
 * roles (administración, ventas, diseño y producción).
 *
 *   R1. Precios de venta solo con "ver_precios" (catálogo, comisiones, reportes) y las pantallas de
 *       producción siguen funcionando sin montos.
 *   R2. Datos completos de clientes y del equipo solo para quien los necesita.
 *   R3. Una cotización aprobada en el portal, aceptada o convertida ya no se modifica por ningún
 *       camino; duplicar y convertir siguen funcionando.
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

const sistema = activo ? createClient(URL, SERVICE, { auth: { persistSession: false } }) : (null as never)
const PASS = 'Prueba12345'
const sufijo = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`
const ROLES = ['admin', 'ventas', 'diseno', 'produccion'] as const
type Rol = (typeof ROLES)[number]
type Fila = Record<string, unknown>

async function crearUsuario(email: string, appMeta: Record<string, unknown>, permisos?: Record<string, boolean>) {
  const { data, error } = await sistema.auth.admin.createUser({ email, password: PASS, email_confirm: true, app_metadata: appMeta })
  if (error) throw error
  const id = data.user!.id
  if (permisos) ok(await sistema.from('perfiles').update({ permisos }).eq('id', id))
  return id
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

/** Una escritura que la base no deja hacer: error, o ningún renglón afectado (RLS). */
function rechazada(r: { data: unknown; error: unknown }) {
  return r.error !== null || (Array.isArray(r.data) && r.data.length === 0)
}

suite('Revisión de seguridad: precios, clientes y equipo, cotizaciones aprobadas', () => {
  const c = {} as Record<Rol, SupabaseClient>
  const id = {} as Record<Rol, string>
  let reportesSinPrecios: SupabaseClient, catalogoSinPrecios: SupabaseClient
  let anon: SupabaseClient
  // Datos de prueba
  let productoId = ''
  let clienteActivo = '', clienteCerrado = '', clienteSinPedidos = ''
  let pedidoActivo = '', pedidoCerrado = '', cotActiva = ''
  const tel = { activo: `33${Date.now().toString().slice(-8)}`, cerrado: '3398765432', sinPedidos: '3311223344' }

  async function venta(nombre: string, telefono: string, precio = 1000) {
    const cl = ok(await c.ventas.from('clientes').insert({
      nombre, whatsapp: telefono, telefono, email: `${sufijo}-${telefono}@cliente.local`, rfc: 'XAXX010101000',
      razon_social: `${nombre} SA de CV`, direccion: 'Av. Siempre Viva 742', notas: 'Paga a 15 días', lista_precio: 'mayoreo',
    }).select('id').single()) as { id: string }
    ok(await c.ventas.from('contactos').insert({ cliente_id: cl.id, nombre: 'Contacto privado', telefono: '3300000001', email: 'contacto@cliente.local' }))
    const q = ok(await c.ventas.rpc('guardar_cotizacion', {
      p_datos: { cliente_id: cl.id, titulo: nombre, partidas: [{ concepto: 'Lona', metodo_calculo: 'pieza', unidad: 'pza', cantidad: 1, precio_unitario: precio }] },
    })) as { id: string }
    return { clienteId: cl.id, cotizacionId: q.id }
  }

  beforeAll(async () => {
    for (const rol of ROLES) {
      const email = `rev-${rol}-${sufijo}@prueba.local`
      id[rol] = await crearUsuario(email, { rol, activo: true, nombre: `Revisión ${rol}` })
      c[rol] = await sesion(email)
    }
    ok(await sistema.from('perfiles').update({ telefono: '3312345678', comision_pct: 5 }).eq('id', id.ventas))
    // Permisos a mano que dependen de "ver_precios"
    await crearUsuario(`rev-reportes-${sufijo}@prueba.local`, { rol: 'ventas', activo: true, nombre: 'Reportes sin precios' }, { ver_precios: false, ver_reportes: true })
    await crearUsuario(`rev-catalogo-${sufijo}@prueba.local`, { rol: 'diseno', activo: true, nombre: 'Catálogo sin precios' }, { editar_catalogo: true })
    reportesSinPrecios = await sesion(`rev-reportes-${sufijo}@prueba.local`)
    catalogoSinPrecios = await sesion(`rev-catalogo-${sufijo}@prueba.local`)
    anon = createClient(URL, ANON, { auth: { persistSession: false } })

    // Producto con precio público y escalas (lo captura administración)
    productoId = (ok(await c.admin.from('productos').insert({
      nombre: `Producto revisión ${sufijo}`, metodo_calculo: 'pieza', unidad: 'pza', precio_venta: 123.45, precio_minimo: 100,
      escalas: [{ desde: 10, precio: 99 }],
    }).select('id').single()) as { id: string }).id
    ok(await c.admin.from('producto_precios').insert({ producto_id: productoId, lista: 'mayoreo', precio: 111 }))

    // Cliente con pedido en proceso, cliente con pedido ya finalizado y cliente sin pedidos
    const a1 = await venta(`Cliente activo ${sufijo}`, tel.activo)
    clienteActivo = a1.clienteId
    cotActiva = a1.cotizacionId
    pedidoActivo = ok(await c.ventas.rpc('convertir_cotizacion_a_pedido', { p_cotizacion: a1.cotizacionId })) as string
    ok(await sistema.from('pedidos').update({ requiere_instalacion: true, direccion_instalacion: 'Calle Taller 1' }).eq('id', pedidoActivo))
    const b1 = await venta(`Cliente cerrado ${sufijo}`, tel.cerrado)
    clienteCerrado = b1.clienteId
    pedidoCerrado = ok(await c.ventas.rpc('convertir_cotizacion_a_pedido', { p_cotizacion: b1.cotizacionId })) as string
    ok(await sistema.from('pedidos').update({ estado: 'finalizado' }).eq('id', pedidoCerrado))
    clienteSinPedidos = (await venta(`Cliente sin pedidos ${sufijo}`, tel.sinPedidos)).clienteId
  })

  // ===================================================================
  // R1 · Precios de venta
  // ===================================================================
  describe('R1 · precios de venta solo con ver_precios', () => {
    it('catálogo: precio público, mínimo, escalas y listas solo para administración y ventas', async () => {
      for (const rol of ROLES) {
        const prod = ok(await c[rol].from('productos').select('id, precio_venta, precio_minimo, escalas').eq('id', productoId)) as Fila[]
        const lista = ok(await c[rol].from('producto_precios').select('precio').eq('producto_id', productoId)) as Fila[]
        if (rol === 'admin' || rol === 'ventas') {
          expect(Number(prod[0].precio_venta)).toBe(123.45)
          expect(Number(lista[0].precio)).toBe(111)
          // select('*') sigue funcionando para quien tiene permiso (no hay privilegios por columna)
          ok(await c[rol].from('productos').select('*').eq('id', productoId).single())
        } else {
          expect(prod, `${rol} no debe leer productos`).toEqual([])
          expect(lista).toEqual([])
        }
      }
    })

    it('catálogo: solo administración cambia precios; los demás roles son rechazados', async () => {
      for (const rol of ['ventas', 'diseno', 'produccion'] as const) {
        const r = await c[rol].from('productos').update({ precio_venta: 1 }).eq('id', productoId).select('id')
        expect(rechazada(r), `${rol} no debe cambiar precios`).toBe(true)
        const ins = await c[rol].from('productos').insert({ nombre: `Pirata ${rol} ${sufijo}`, metodo_calculo: 'pieza', unidad: 'pza', precio_venta: 1 })
        expect(ins.error, `${rol} no debe crear productos`).toBeTruthy()
      }
      ok(await c.admin.from('productos').update({ precio_minimo: 101 }).eq('id', productoId).select('id').single())
      const p = ok(await c.admin.from('productos').select('precio_venta, precio_minimo').eq('id', productoId).single()) as Fila
      expect(Number(p.precio_venta)).toBe(123.45)
      expect(Number(p.precio_minimo)).toBe(101)
    })

    it('"editar_catalogo" y "ver_reportes" no valen sin "ver_precios" (ni en mis_permisos)', async () => {
      const mpCat = ok(await catalogoSinPrecios.rpc('mis_permisos')) as Record<string, boolean>
      expect(mpCat.editar_catalogo).toBe(false)
      const ins = await catalogoSinPrecios.from('productos').insert({ nombre: `Sin precios ${sufijo}`, metodo_calculo: 'pieza', unidad: 'pza', precio_venta: 5 })
      expect(ins.error).toBeTruthy()

      const mpRep = ok(await reportesSinPrecios.rpc('mis_permisos')) as Record<string, boolean>
      expect(mpRep.ver_reportes).toBe(false)
      const hoy = new Date().toISOString().slice(0, 10)
      for (const fn of ['reporte_ventas', 'reporte_productos', 'reporte_clientes', 'reporte_vendedores'] as const) {
        const { error } = await reportesSinPrecios.rpc(fn, { p_desde: hoy, p_hasta: hoy })
        expect(error?.code, fn).toBe('42501')
      }
      expect((await reportesSinPrecios.rpc('corte_caja_resumen', {})).error?.code).toBe('42501')
      expect((await reportesSinPrecios.from('cortes_caja').select('id')).data).toEqual([])
      const panel = ok(await reportesSinPrecios.rpc('dashboard_resumen')) as Fila
      expect(panel.ventas_mes).toBeUndefined()
      expect(panel.cobrado_mes).toBeUndefined()
      // Administración y ventas, igual que siempre
      expect((ok(await c.admin.rpc('mis_permisos')) as Record<string, boolean>).ver_reportes).toBe(true)
      expect((ok(await c.ventas.rpc('mis_permisos')) as Record<string, boolean>).ver_precios).toBe(true)
    })

    it('comisiones (lo cobrado): sin "ver_precios" se niegan; ventas ve las suyas y administración todas', async () => {
      const rango = { p_desde: '2021-01-01', p_hasta: '2030-12-31' }
      for (const rol of ['diseno', 'produccion'] as const) {
        expect((await c[rol].rpc('comisiones', rango)).error?.code, rol).toBe('42501')
        expect((await c[rol].rpc('comisiones_detalle', rango)).error?.code, rol).toBe('42501')
      }
      const propias = ok(await c.ventas.rpc('comisiones', rango)) as Fila[]
      expect(propias.map((x) => x.vendedor_id)).toEqual([id.ventas])
      ok(await c.admin.rpc('comisiones', rango))
    })

    it('producción y diseño: tablero, orden de trabajo, partidas e inventario funcionan sin montos', async () => {
      const columnas = 'id, folio, titulo, cliente_nombre, estado, prioridad, fecha_entrega, requiere_instalacion, direccion_instalacion, anticipo_recibido, num_partidas, total, pagado, saldo'
      for (const rol of ROLES) {
        const ot = ok(await c[rol].from('ordenes_trabajo').select(columnas).eq('id', pedidoActivo).single()) as Fila
        expect(ot.cliente_nombre).toBe(`Cliente activo ${sufijo}`)
        expect(ot.direccion_instalacion).toBe('Calle Taller 1')
        const partidas = ok(await c[rol].from('orden_partidas').select('concepto, cantidad, precio_unitario, importe').eq('pedido_id', pedidoActivo)) as Fila[]
        expect(partidas[0].concepto).toBe('Lona')
        if (rol === 'admin' || rol === 'ventas') {
          expect(Number(ot.total)).toBeGreaterThan(0)
          expect(Number(partidas[0].precio_unitario)).toBe(1000)
        } else {
          expect([ot.total, ot.pagado, ot.saldo]).toEqual([null, null, null])
          expect([partidas[0].precio_unitario, partidas[0].importe]).toEqual([null, null])
          // Las tablas con montos siguen cerradas
          expect(ok(await c[rol].from('pedidos').select('id, total').eq('id', pedidoActivo))).toEqual([])
          expect(ok(await c[rol].from('partidas').select('id').eq('pedido_id', pedidoActivo))).toEqual([])
        }
        ok(await c[rol].from('materiales').select('id, nombre, existencia').limit(5))
        ok(await c[rol].from('movimientos_inventario').select('id, tipo, cantidad, material:materiales(nombre), usuario:perfiles!usuario_id(nombre)').limit(5))
        ok(await c[rol].from('archivos').select('id, autor:perfiles!subido_por(nombre)').eq('pedido_id', pedidoActivo))
      }
      // Producción sigue moviendo etapas y escribiendo notas de producción
      ok(await c.produccion.rpc('cambiar_estado_pedido', { p_pedido: pedidoActivo, p_estado: 'en_diseno' }))
      const partida = (ok(await c.produccion.from('orden_partidas').select('id').eq('pedido_id', pedidoActivo).limit(1).single()) as { id: string }).id
      ok(await c.produccion.rpc('actualizar_notas_partida', { p_partida: partida, p_notas: 'Lona con ojillos' }))
    })
  })

  // ===================================================================
  // R2 · Clientes y equipo
  // ===================================================================
  describe('R2 · clientes y perfiles', () => {
    it('clientes y contactos completos: administración y ventas sí; diseño y producción no', async () => {
      for (const rol of ROLES) {
        const cl = ok(await c[rol].from('clientes').select('*').eq('id', clienteActivo)) as Fila[]
        const ct = ok(await c[rol].from('contactos').select('*').eq('cliente_id', clienteActivo)) as Fila[]
        if (rol === 'admin' || rol === 'ventas') {
          expect(cl[0]).toMatchObject({ rfc: 'XAXX010101000', direccion: 'Av. Siempre Viva 742', notas: 'Paga a 15 días', lista_precio: 'mayoreo' })
          expect(ct.length).toBe(1)
        } else {
          expect(cl, `${rol} no debe leer clientes`).toEqual([])
          expect(ct, `${rol} no debe leer contactos`).toEqual([])
          expect(ok(await c[rol].from('clientes').select('id').limit(1))).toEqual([])
          expect((await c[rol].rpc('resumen_cliente', { p_cliente: clienteActivo })).error?.code).toBe('42501')
        }
      }
    })

    it('clientes_operacion: nombre de clientes con pedidos, contacto solo con un pedido en proceso, nunca correo', async () => {
      for (const rol of ['diseno', 'produccion'] as const) {
        const filas = ok(await c[rol].from('clientes_operacion').select('*').in('id', [clienteActivo, clienteCerrado, clienteSinPedidos])) as Fila[]
        const de = (x: string) => filas.find((f) => f.id === x)
        expect(de(clienteActivo)).toMatchObject({ nombre: `Cliente activo ${sufijo}`, whatsapp: tel.activo, telefono: tel.activo, email: null, requiere_factura: false })
        expect(de(clienteCerrado)).toMatchObject({ nombre: `Cliente cerrado ${sufijo}`, whatsapp: null, telefono: null, email: null })
        expect(de(clienteSinPedidos), `${rol} no debe ver clientes sin pedidos`).toBeUndefined()
        expect(Object.keys(filas[0]).sort()).toEqual(['activo', 'email', 'id', 'nombre', 'requiere_factura', 'telefono', 'tipo', 'whatsapp'])
        // Lo mismo en ordenes_trabajo
        const ot = ok(await c[rol].from('ordenes_trabajo').select('id, cliente_whatsapp').in('id', [pedidoActivo, pedidoCerrado])) as Fila[]
        expect(ot.find((x) => x.id === pedidoActivo)?.cliente_whatsapp).toBe(tel.activo)
        expect(ot.find((x) => x.id === pedidoCerrado)?.cliente_whatsapp).toBeNull()
      }
      for (const rol of ['admin', 'ventas'] as const) {
        const filas = ok(await c[rol].from('clientes_operacion').select('*').in('id', [clienteActivo, clienteCerrado, clienteSinPedidos])) as Fila[]
        expect(filas.length).toBe(3)
        expect(filas.find((f) => f.id === clienteCerrado)?.whatsapp).toBe(tel.cerrado)
        expect(filas.find((f) => f.id === clienteSinPedidos)?.email).toBe(`${sufijo}-${tel.sinPedidos}@cliente.local`)
        const ot = ok(await c[rol].from('ordenes_trabajo').select('cliente_whatsapp').eq('id', pedidoCerrado).single()) as Fila
        expect(ot.cliente_whatsapp).toBe(tel.cerrado)
      }
    })

    it('búsqueda, agenda y archivos del cliente no filtran datos a diseño y producción', async () => {
      // Tarea de ventas ligada a un cliente sin pedidos y una ligada al cliente con pedido
      const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
      ok(await c.ventas.from('tareas').insert([
        { titulo: `Llamar a prospecto ${sufijo}`, fecha: hoy, cliente_id: clienteSinPedidos, responsable_id: id.ventas },
        { titulo: `Instalar con cliente ${sufijo}`, fecha: hoy, cliente_id: clienteActivo, responsable_id: id.produccion },
      ]))
      // Archivo del cliente (no de un pedido)
      ok(await c.ventas.from('archivos').insert({ cliente_id: clienteSinPedidos, categoria: 'referencia', nombre: `logo-${sufijo}.png`, enlace_externo: 'https://ejemplo.local/logo.png' }))

      for (const rol of ROLES) {
        const completo = rol === 'admin' || rol === 'ventas'
        const porTelefono = ok(await c[rol].rpc('busqueda_global', { p_texto: tel.activo })) as { clientes: Fila[]; pedidos: Fila[] }
        const porNombre = ok(await c[rol].rpc('busqueda_global', { p_texto: `Cliente activo ${sufijo}` })) as { clientes: Fila[]; pedidos: Fila[] }
        expect(porNombre.pedidos.some((x) => x.id === pedidoActivo), rol).toBe(true)
        if (completo) {
          expect(porTelefono.clientes.map((x) => x.id)).toContain(clienteActivo)
          expect(porTelefono.pedidos.some((x) => x.id === pedidoActivo)).toBe(true)
        } else {
          expect(porTelefono.clientes, `${rol}: búsqueda sin clientes`).toEqual([])
          expect(porNombre.clientes).toEqual([])
          expect(porTelefono.pedidos, `${rol}: no encuentra pedidos por teléfono del cliente`).toEqual([])
        }

        const agenda = ok(await c[rol].rpc('agenda', { p_desde: hoy, p_hasta: hoy })) as Fila[]
        const prospecto = agenda.find((x) => x.titulo === `Llamar a prospecto ${sufijo}`)
        const instalar = agenda.find((x) => x.titulo === `Instalar con cliente ${sufijo}`)
        expect(instalar?.cliente).toBe(`Cliente activo ${sufijo}`)
        expect(prospecto?.cliente ?? null).toBe(completo ? `Cliente sin pedidos ${sufijo}` : null)
        const tareas = ok(await c[rol].from('tareas').select('titulo, cliente:clientes_operacion(nombre)').in('cliente_id', [clienteSinPedidos, clienteActivo])) as unknown as Array<{ titulo: string; cliente: { nombre: string } | null }>
        expect(tareas.find((t) => t.titulo.startsWith('Llamar'))?.cliente?.nombre ?? null).toBe(completo ? `Cliente sin pedidos ${sufijo}` : null)
        expect(tareas.find((t) => t.titulo.startsWith('Instalar'))?.cliente?.nombre).toBe(`Cliente activo ${sufijo}`)

        const archivos = ok(await c[rol].from('archivos').select('id').eq('cliente_id', clienteSinPedidos)) as Fila[]
        expect(archivos.length, `${rol}: archivos del cliente`).toBe(completo ? 1 : 0)
      }
    })

    it('editar clientes y contactos: diseño y producción son rechazados', async () => {
      for (const rol of ['diseno', 'produccion'] as const) {
        expect(rechazada(await c[rol].from('clientes').update({ telefono: '3300000000' }).eq('id', clienteActivo).select('id'))).toBe(true)
        expect((await c[rol].from('clientes').insert({ nombre: `Pirata ${sufijo}` })).error).toBeTruthy()
        expect((await c[rol].from('contactos').insert({ cliente_id: clienteActivo, nombre: 'Pirata' })).error).toBeTruthy()
      }
      const cl = ok(await c.admin.from('clientes').select('telefono').eq('id', clienteActivo).single()) as Fila
      expect(cl.telefono).toBe(tel.activo)
    })

    it('perfiles: todos ven nombre, rol y puesto; correo, teléfono, permisos, comisión y último acceso solo administración o uno mismo', async () => {
      for (const rol of ROLES) {
        const publicos = ok(await c[rol].from('perfiles').select('id, nombre, puesto, rol, activo').in('id', [id.ventas, id.produccion])) as Fila[]
        expect(publicos.length, rol).toBe(2)
        for (const col of ['email', 'telefono', 'permisos', 'comision_pct', 'ultimo_acceso', '*']) {
          const { error } = await c[rol].from('perfiles').select(col).eq('id', id.ventas)
          expect(error?.code, `${rol} no debe leer perfiles.${col}`).toBe('42501')
        }
        const detalle = ok(await c[rol].from('perfiles_detalle').select('id, email, telefono, comision_pct, permisos')) as Fila[]
        if (rol === 'admin') {
          expect(detalle.find((x) => x.id === id.ventas)).toMatchObject({ telefono: '3312345678' })
          expect(Number(detalle.find((x) => x.id === id.ventas)?.comision_pct)).toBe(5)
        } else {
          expect(detalle.map((x) => x.id), `${rol} solo se ve a sí mismo`).toEqual([id[rol]])
        }
      }
      // Embebidos de responsables siguen funcionando para todos
      ok(await c.produccion.from('pedido_eventos').select('id, usuario:perfiles!usuario_id(nombre)').eq('pedido_id', pedidoActivo))
      // Editar: uno mismo (sin comisión ni rol) o administración
      ok(await c.produccion.from('perfiles').update({ telefono: '3399990000' }).eq('id', id.produccion).select('id').single())
      expect(rechazada(await c.produccion.from('perfiles').update({ telefono: '3300000000' }).eq('id', id.ventas).select('id'))).toBe(true)
      expect((await c.ventas.from('perfiles').update({ comision_pct: 50 }).eq('id', id.ventas)).error?.code).toBe('42501')
      ok(await c.admin.from('perfiles').update({ puesto: 'Instalador' }).eq('id', id.produccion).select('id').single())
      const yo = ok(await c.produccion.from('perfiles_detalle').select('telefono, puesto').single()) as Fila
      expect(yo).toEqual({ telefono: '3399990000', puesto: 'Instalador' })
    })

    it('contacto del vendedor (para el PDF): solo quien ve la cotización', async () => {
      for (const rol of ROLES) {
        const filas = ok(await c[rol].rpc('contacto_vendedor', { p_cotizacion: cotActiva })) as Fila[]
        if (rol === 'admin' || rol === 'ventas') expect(filas[0]).toMatchObject({ id: id.ventas, telefono: '3312345678' })
        else expect(filas, rol).toEqual([])
      }
    })
  })

  // ===================================================================
  // R3 · Cotizaciones aprobadas, aceptadas o convertidas
  // ===================================================================
  describe('R3 · una cotización aprobada ya no se modifica', () => {
    let aprobada = '', partidaId = '', totalAntes = 0

    beforeAll(async () => {
      const q = await venta(`Cliente portal ${sufijo}`, '3355512345', 2500)
      aprobada = q.cotizacionId
      ok(await c.ventas.from('cotizaciones').update({ estado: 'enviada' }).eq('id', aprobada))
      const { token } = ok(await c.ventas.rpc('crear_enlace_portal', { p_tipo: 'cotizacion', p_id: aprobada })) as { token: string }
      ok(await anon.rpc('portal_aprobar_cotizacion', { p_token: token, p_nombre: 'Cliente que aprueba', p_comentario: null }))
      const fila = ok(await c.ventas.from('cotizaciones').select('estado, total, partidas(id)').eq('id', aprobada).single()) as { estado: string; total: number; partidas: Array<{ id: string }> }
      expect(fila.estado).toBe('aceptada')
      totalAntes = Number(fila.total)
      partidaId = fila.partidas[0].id
    })

    it('aprobada en el portal: ningún rol cambia sus datos, partidas ni costos', async () => {
      const datos = { id: aprobada, cliente_id: (ok(await c.ventas.from('cotizaciones').select('cliente_id').eq('id', aprobada).single()) as { cliente_id: string }).cliente_id }
      for (const rol of ROLES) {
        const guardar = await c[rol].rpc('guardar_cotizacion', {
          p_datos: { ...datos, titulo: 'Cambiada', partidas: [{ id: partidaId, concepto: 'Lona', metodo_calculo: 'pieza', unidad: 'pza', cantidad: 1, precio_unitario: 1 }] },
        })
        expect(guardar.error, `${rol}: guardar_cotizacion`).toBeTruthy()
        if (rol === 'admin' || rol === 'ventas') expect(guardar.error?.message).toContain('aprobó esta cotización desde el portal')
        expect(rechazada(await c[rol].from('cotizaciones').update({ titulo: 'Cambiada' }).eq('id', aprobada).select('id')), `${rol}: título`).toBe(true)
        expect(rechazada(await c[rol].from('cotizaciones').update({ descuento_valor: 500 }).eq('id', aprobada).select('id')), `${rol}: descuento`).toBe(true)
        expect(rechazada(await c[rol].from('cotizaciones').update({ estado: 'borrador' }).eq('id', aprobada).select('id')), `${rol}: a borrador`).toBe(true)
        expect(rechazada(await c[rol].from('cotizaciones').update({ estado: 'enviada' }).eq('id', aprobada).select('id')), `${rol}: a enviada`).toBe(true)
        expect(rechazada(await c[rol].from('cotizaciones').update({ aceptada_at: null }).eq('id', aprobada).select('id')), `${rol}: aceptada_at`).toBe(true)
        expect(rechazada(await c[rol].from('partidas').update({ precio_unitario: 1 }).eq('id', partidaId).select('id')), `${rol}: partida`).toBe(true)
        expect(rechazada(await c[rol].from('partidas').delete().eq('id', partidaId).select('id')), `${rol}: borrar partida`).toBe(true)
        const nueva = await c[rol].from('partidas').insert({ cotizacion_id: aprobada, concepto: 'Extra', cantidad: 1, precio_unitario: 1, tipo: 'concepto', metodo_calculo: 'pieza', unidad: 'pza' })
        expect(nueva.error, `${rol}: partida nueva`).toBeTruthy()
        const costo = await c[rol].from('partida_costos').upsert({ partida_id: partidaId, costo_material: 1 }).select('partida_id')
        expect(rechazada(costo), `${rol}: costos`).toBe(true)
      }
      const { error } = await c.ventas.from('cotizaciones').update({ titulo: 'Cambiada' }).eq('id', aprobada)
      expect(error?.message).toContain('Duplícala para hacer una versión nueva')
      // Sacar la partida a otra cotización tampoco
      const otra = await venta(`Otra cotización ${sufijo}`, '3355500000')
      expect((await c.ventas.from('partidas').update({ cotizacion_id: otra.cotizacionId }).eq('id', partidaId)).error).toBeTruthy()
      const despues = ok(await c.admin.from('cotizaciones').select('estado, titulo, total, partidas(id, precio_unitario)').eq('id', aprobada).single()) as { estado: string; titulo: string; total: number; partidas: Fila[] }
      expect(despues.estado).toBe('aceptada')
      expect(despues.titulo).toBe(`Cliente portal ${sufijo}`)
      expect(Number(despues.total)).toBe(totalAntes)
      expect(despues.partidas.map((x) => Number(x.precio_unitario))).toEqual([2500])
    })

    it('lo interno sí cambia: notas internas y PDF', async () => {
      ok(await c.ventas.from('cotizaciones').update({ notas_internas: 'Llamar el lunes', pdf_path: `cotizaciones/${aprobada}/x.pdf` }).eq('id', aprobada).select('id').single())
    })

    it('duplicar crea una versión nueva editable y convertir en pedido sigue funcionando', async () => {
      const copia = ok(await c.ventas.rpc('duplicar_cotizacion', { p_cotizacion: aprobada })) as string
      const q = ok(await c.ventas.from('cotizaciones').select('estado, cliente_id').eq('id', copia).single()) as { estado: string; cliente_id: string }
      expect(q.estado).toBe('borrador')
      ok(await c.ventas.rpc('guardar_cotizacion', {
        p_datos: { id: copia, cliente_id: q.cliente_id, titulo: 'Versión 2', partidas: [{ concepto: 'Lona', metodo_calculo: 'pieza', unidad: 'pza', cantidad: 2, precio_unitario: 2400 }] },
      }))
      for (const rol of ['diseno', 'produccion'] as const) {
        expect((await c[rol].rpc('convertir_cotizacion_a_pedido', { p_cotizacion: aprobada })).error?.code, rol).toBe('42501')
      }
      const pedido = ok(await c.ventas.rpc('convertir_cotizacion_a_pedido', { p_cotizacion: aprobada })) as string
      const ped = ok(await c.ventas.from('pedidos').select('total').eq('id', pedido).single()) as Fila
      expect(Number(ped.total)).toBe(totalAntes)
      // Ya convertida: el mensaje lleva al pedido; tampoco se puede rechazar ni cancelar
      const { error } = await c.ventas.from('cotizaciones').update({ titulo: 'Otra vez' }).eq('id', aprobada)
      expect(error?.message).toContain('ya se convirtió en el pedido')
      expect((await c.admin.from('cotizaciones').update({ estado: 'cancelada' }).eq('id', aprobada)).error?.message).toContain('ya se convirtió')
    })

    it('aceptada a mano: tampoco se edita ni regresa a borrador; sí se puede rechazar', async () => {
      const q = await venta(`Cliente acepta ${sufijo}`, '3355567890', 900)
      ok(await c.ventas.from('cotizaciones').update({ estado: 'aceptada' }).eq('id', q.cotizacionId))
      const g = await c.ventas.rpc('guardar_cotizacion', {
        p_datos: { id: q.cotizacionId, cliente_id: q.clienteId, partidas: [{ concepto: 'Lona', metodo_calculo: 'pieza', unidad: 'pza', cantidad: 1, precio_unitario: 1 }] },
      })
      expect(g.error?.message).toContain('ya fue aceptada')
      ok(await c.ventas.from('cotizaciones').update({ estado: 'rechazada', motivo_rechazo: 'Cambió de proveedor' }).eq('id', q.cotizacionId).select('id').single())
      const regreso = await c.admin.from('cotizaciones').update({ estado: 'borrador' }).eq('id', q.cotizacionId)
      expect(regreso.error?.message).toContain('ya fue aceptada')
      expect((await c.ventas.from('partidas').update({ cantidad: 3 }).eq('cotizacion_id', q.cotizacionId)).error?.message).toContain('ya fue aceptada')
      // Una cotización abierta sigue editándose como siempre
      const abierta = await venta(`Cliente abierto ${sufijo}`, '3355511111', 700)
      ok(await c.ventas.from('cotizaciones').update({ titulo: 'Se puede editar' }).eq('id', abierta.cotizacionId).select('id').single())
      ok(await c.ventas.from('partidas').update({ cantidad: 2 }).eq('cotizacion_id', abierta.cotizacionId).select('id'))
    })
  })
})
