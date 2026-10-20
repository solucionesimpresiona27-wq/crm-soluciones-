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
 *   Ronda 2 (20261019000300_seguridad_revision_b.sql): panel sin nombres de clientes ajenos, tareas
 *       ligadas solo a clientes con pedidos, aprobación con control de versión, carreras al aprobar
 *       o convertir, ON DELETE SET NULL con cotizaciones cerradas y contacto oculto por permiso.
 *   Ronda 3 (20261019000400_seguridad_revision_c.sql): producto a nulo solo por el borrado del
 *       catálogo (no a mano) y búsqueda de clientes sin acentos en clientes_operacion.
 *
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... npx vitest run tests/db
 */
import { execFileSync, spawn } from 'node:child_process'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'

const URL = process.env.SUPABASE_URL ?? ''
const ANON = process.env.SUPABASE_ANON_KEY ?? ''
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const activo = Boolean(URL && ANON && SERVICE)
const suite = activo ? describe : describe.skip
const hayPsql = (() => {
  try {
    execFileSync('psql', ['--version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
})()
const DB_URL = process.env.DB_URL ?? (URL.includes('127.0.0.1:54321') && hayPsql ? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' : '')
const itDb = activo && DB_URL ? it : it.skip

/** Corre SQL en otra conexión (psql) sin esperar: para abrir una transacción que dure. */
function psqlEnParalelo(sql: string) {
  return new Promise<{ codigo: number | null; salida: string }>((resolve) => {
    const p = spawn('psql', [DB_URL, '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql])
    let salida = ''
    p.stdout.on('data', (d) => (salida += d))
    p.stderr.on('data', (d) => (salida += d))
    p.on('close', (codigo) => resolve({ codigo, salida }))
  })
}
const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms))

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
        expect(Object.keys(filas[0]).sort()).toEqual(['activo', 'busqueda', 'contacto_visible', 'email', 'id', 'nombre', 'requiere_factura', 'telefono', 'tipo', 'whatsapp'])
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
        const detalle = ok(await c[rol].from('perfiles_detalle').select('id, email, telefono, comision_pct, permisos').in('id', [id.ventas, id.produccion, id[rol]])) as Fila[]
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
      const vista = ok(await anon.rpc('portal_obtener', { p_token: token })) as { cotizacion: { version: string } }
      ok(await anon.rpc('portal_aprobar_cotizacion', { p_token: token, p_nombre: 'Cliente que aprueba', p_comentario: null, p_version: vista.cotizacion.version }))
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
  // ===================================================================
  // Ronda 2 (20261019000300_seguridad_revision_b.sql)
  // ===================================================================
  describe('Ronda 2 · ajustes de la revisión', () => {
    const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

    async function cotizacionConEnlace(nombre: string, telefono: string, precio = 100) {
      const q = await venta(`${nombre} ${sufijo}`, telefono, precio)
      ok(await c.ventas.from('cotizaciones').update({ estado: 'enviada' }).eq('id', q.cotizacionId))
      const { token } = ok(await c.ventas.rpc('crear_enlace_portal', { p_tipo: 'cotizacion', p_id: q.cotizacionId })) as { token: string }
      return { ...q, token }
    }
    const version = async (token: string) => ((ok(await anon.rpc('portal_obtener', { p_token: token })) as { cotizacion: { version: string; total: number } }).cotizacion)

    it('panel: tareas_hoy no da el nombre de un cliente sin pedidos a diseño y producción (como agenda)', async () => {
      // Ventas les asigna tareas (Ventas sí puede ligar cualquier cliente)
      for (const rol of ['diseno', 'produccion'] as const) {
        ok(await c.ventas.from('tareas').insert([
          { titulo: `Panel prospecto ${rol} ${sufijo}`, fecha: hoy(), cliente_id: clienteSinPedidos, responsable_id: id[rol] },
          { titulo: `Panel cliente ${rol} ${sufijo}`, fecha: hoy(), cliente_id: clienteActivo, responsable_id: id[rol] },
        ]))
        const panel = ok(await c[rol].rpc('dashboard_resumen')) as { tareas_hoy: Fila[] }
        const prospecto = panel.tareas_hoy.find((t) => t.titulo === `Panel prospecto ${rol} ${sufijo}`)
        const cliente = panel.tareas_hoy.find((t) => t.titulo === `Panel cliente ${rol} ${sufijo}`)
        expect(prospecto, rol).toBeTruthy()
        expect(prospecto?.cliente, `${rol}: nombre del prospecto`).toBeNull()
        expect(prospecto?.cliente_id, `${rol}: id del prospecto`).toBeNull()
        expect(cliente?.cliente, rol).toBe(`Cliente activo ${sufijo}`)
      }
      ok(await c.ventas.from('tareas').insert({ titulo: `Panel ventas ${sufijo}`, fecha: hoy(), cliente_id: clienteSinPedidos, responsable_id: id.ventas }))
      const ventas = ok(await c.ventas.rpc('dashboard_resumen')) as { tareas_hoy: Fila[] }
      expect(ventas.tareas_hoy.find((t) => t.titulo === `Panel ventas ${sufijo}`)?.cliente).toBe(`Cliente sin pedidos ${sufijo}`)
    })

    it('tareas: diseño y producción solo ligan clientes con pedidos (y los encuentran en clientes_operacion)', async () => {
      for (const rol of ['diseno', 'produccion'] as const) {
        // El buscador de la agenda: encuentra a los clientes de pedidos, no a los prospectos
        const encontrados = ok(await c[rol].from('clientes_operacion').select('id').eq('activo', true).ilike('nombre', `%${sufijo}%`)) as Fila[]
        expect(encontrados.map((x) => x.id), rol).toEqual(expect.arrayContaining([clienteActivo, clienteCerrado]))
        expect(encontrados.map((x) => x.id), rol).not.toContain(clienteSinPedidos)
        // Ligar a un cliente con pedido sí; a uno sin pedidos (que no ve), no
        const propia = ok(await c[rol].from('tareas').insert({ titulo: `Ligar ${rol} ${sufijo}`, fecha: hoy(), cliente_id: clienteActivo, responsable_id: id[rol] }).select('id').single()) as { id: string }
        const sin = await c[rol].from('tareas').insert({ titulo: `Espiar ${rol} ${sufijo}`, fecha: hoy(), cliente_id: clienteSinPedidos, responsable_id: id[rol] })
        expect(sin.error?.code, `${rol}: insertar con prospecto`).toBe('42501')
        expect(sin.error?.message).toContain('clientes con pedidos')
        const cambio = await c[rol].from('tareas').update({ cliente_id: clienteSinPedidos }).eq('id', propia.id)
        expect(cambio.error?.code, `${rol}: cambiar a prospecto`).toBe('42501')
        // Una tarea que Ventas ligó a un prospecto se puede completar y editar sin perder la liga
        const ajena = ok(await c.ventas.from('tareas').insert({ titulo: `Ajena ${rol} ${sufijo}`, fecha: hoy(), cliente_id: clienteSinPedidos, responsable_id: id[rol] }).select('id').single()) as { id: string }
        ok(await c[rol].from('tareas').update({ completada: true, titulo: `Ajena hecha ${rol} ${sufijo}` }).eq('id', ajena.id).select('id').single())
        const fila = ok(await sistema.from('tareas').select('cliente_id, completada').eq('id', ajena.id).single()) as Fila
        expect(fila).toEqual({ cliente_id: clienteSinPedidos, completada: true })
      }
    })

    it('pedido cerrado: clientes_operacion dice que el contacto está oculto por permiso, no que falta', async () => {
      for (const rol of ROLES) {
        const completo = rol === 'admin' || rol === 'ventas'
        const filas = ok(await c[rol].from('clientes_operacion').select('id, whatsapp, contacto_visible').in('id', [clienteActivo, clienteCerrado])) as Fila[]
        const cerrado = filas.find((x) => x.id === clienteCerrado)!
        const activo = filas.find((x) => x.id === clienteActivo)!
        expect(activo.contacto_visible, rol).toBe(true)
        expect(activo.whatsapp, rol).toBe(tel.activo)
        expect(cerrado.contacto_visible, rol).toBe(completo)
        expect(cerrado.whatsapp, rol).toBe(completo ? tel.cerrado : null)
      }
    })

    it('portal: el cliente aprueba la versión que vio; si el asesor la cambió, se rechaza', async () => {
      const q = await cotizacionConEnlace('Cliente versión', '3355544444')
      const vista = await version(q.token)
      expect(vista.version).toMatch(/^[0-9a-f]{32}$/)
      expect(Number(vista.total)).toBe(116)
      // Ventas cambia el precio mientras el cliente la revisa
      ok(await c.ventas.rpc('guardar_cotizacion', {
        p_datos: { id: q.cotizacionId, cliente_id: q.clienteId, titulo: `Cliente versión ${sufijo}`, partidas: [{ concepto: 'Lona', metodo_calculo: 'pieza', unidad: 'pza', cantidad: 1, precio_unitario: 9000 }] },
      }))
      const vieja = await anon.rpc('portal_aprobar_cotizacion', { p_token: q.token, p_nombre: 'Cliente Ficticio', p_version: vista.version })
      expect(vieja.error?.message).toContain('actualizó esta cotización mientras la revisabas')
      const sinVersion = await anon.rpc('portal_aprobar_cotizacion', { p_token: q.token, p_nombre: 'Cliente Ficticio' })
      expect(sinVersion.error?.message).toContain('actualizó esta cotización')
      let fila = ok(await c.ventas.from('cotizaciones').select('estado').eq('id', q.cotizacionId).single()) as Fila
      expect(fila.estado).toBe('enviada')
      expect(ok(await c.ventas.from('portal_respuestas').select('id').eq('cotizacion_id', q.cotizacionId))).toEqual([])
      // Lo interno (notas internas, PDF) no cambia la versión
      const actual = await version(q.token)
      expect(Number(actual.total)).toBe(10440)
      ok(await c.ventas.from('cotizaciones').update({ notas_internas: 'Cliente pidió factura', pdf_path: `cotizaciones/${q.cotizacionId}/v2.pdf` }).eq('id', q.cotizacionId))
      expect((await version(q.token)).version).toBe(actual.version)
      ok(await anon.rpc('portal_aprobar_cotizacion', { p_token: q.token, p_nombre: 'Cliente Ficticio', p_version: actual.version }))
      fila = ok(await c.ventas.from('cotizaciones').select('estado, total').eq('id', q.cotizacionId).single()) as Fila
      expect(fila.estado).toBe('aceptada')
      expect(Number(fila.total)).toBe(10440)
      // La huella no se expone como función suelta
      expect((await anon.rpc('portal_version_cotizacion', { p_cotizacion: q.cotizacionId })).error).toBeTruthy()
      expect((await c.ventas.rpc('portal_version_cotizacion', { p_cotizacion: q.cotizacionId })).error).toBeTruthy()
    })

    itDb('carrera: un concepto insertado mientras se aprueba o se convierte espera y se rechaza', async () => {
      // Aprobación desde el portal en una transacción que tarda en confirmar
      const q = await cotizacionConEnlace('Cliente carrera', '3355533333')
      const vista = await version(q.token)
      const aprobar = psqlEnParalelo(
        `begin; select public.portal_aprobar_cotizacion('${q.token}', 'Cliente Ficticio', null, '${vista.version}'); select pg_sleep(2); commit;`,
      )
      await pausa(800)
      const colada = await c.ventas.from('partidas').insert({ cotizacion_id: q.cotizacionId, concepto: 'Colada', cantidad: 1, precio_unitario: 5000, tipo: 'concepto', metodo_calculo: 'pieza', unidad: 'pza' })
      const r = await aprobar
      expect(r.codigo, r.salida).toBe(0)
      expect(r.salida).toContain('"ok": true')
      expect(colada.error?.message).toContain('aprobó esta cotización desde el portal')
      const fila = ok(await c.ventas.from('cotizaciones').select('estado, total, partidas(concepto)').eq('id', q.cotizacionId).single()) as { estado: string; total: number; partidas: Fila[] }
      expect(fila.estado).toBe('aceptada')
      expect(Number(fila.total)).toBe(116)
      expect(fila.partidas.map((p) => p.concepto)).toEqual(['Lona'])

      // Conversión en pedido en una transacción que tarda en confirmar
      const p = await venta(`Cliente conversión ${sufijo}`, '3355522222')
      const claims = JSON.stringify({ sub: id.ventas, role: 'authenticated' })
      const convertir = psqlEnParalelo(
        `begin; set local role authenticated; select set_config('request.jwt.claims', '${claims}', true); select public.convertir_cotizacion_a_pedido('${p.cotizacionId}'); select pg_sleep(2); commit;`,
      )
      await pausa(800)
      const otra = await c.ventas.from('partidas').insert({ cotizacion_id: p.cotizacionId, concepto: 'Colada', cantidad: 1, precio_unitario: 5000, tipo: 'concepto', metodo_calculo: 'pieza', unidad: 'pza' })
      const rc = await convertir
      expect(rc.codigo, rc.salida).toBe(0)
      expect(otra.error?.message).toContain('ya se convirtió en el pedido')
      const cot = ok(await c.ventas.from('cotizaciones').select('total, pedido_id, partidas(concepto)').eq('id', p.cotizacionId).single()) as { total: number; pedido_id: string; partidas: Fila[] }
      const ped = ok(await c.ventas.from('pedidos').select('total').eq('id', cot.pedido_id).single()) as Fila
      expect(cot.partidas.map((x) => x.concepto)).toEqual(['Lona'])
      expect(Number(ped.total)).toBe(Number(cot.total))
    })

    it('borrar un usuario, un contacto o un producto ligados a una cotización cerrada sigue funcionando', async () => {
      const email = `rev-borrar-${sufijo}@prueba.local`
      const vendedorId = await crearUsuario(email, { rol: 'ventas', activo: true, nombre: 'Vendedor que se va' })
      const vendedor = await sesion(email)
      const cl = ok(await vendedor.from('clientes').insert({ nombre: `Cliente borrar ${sufijo}` }).select('id').single()) as { id: string }
      const ct = ok(await vendedor.from('contactos').insert({ cliente_id: cl.id, nombre: 'Contacto que se borra' }).select('id').single()) as { id: string }
      const otroContacto = ok(await vendedor.from('contactos').insert({ cliente_id: cl.id, nombre: 'Otro contacto' }).select('id').single()) as { id: string }
      const prod = ok(await c.admin.from('productos').insert({ nombre: `Producto que se borra ${sufijo}`, metodo_calculo: 'pieza', unidad: 'pza', precio_venta: 50 }).select('id').single()) as { id: string }
      // Con costo de catálogo: la partida recibe su costo estimado (partida_costos)
      ok(await c.admin.from('producto_costos').insert({ producto_id: prod.id, costo_material: 10 }))
      const q = ok(await vendedor.rpc('guardar_cotizacion', {
        p_datos: { cliente_id: cl.id, contacto_id: ct.id, partidas: [{ producto_id: prod.id, concepto: 'Tarjetas', metodo_calculo: 'pieza', unidad: 'pza', cantidad: 1, precio_unitario: 50 }] },
      })) as { id: string }
      ok(await sistema.from('cotizaciones').update({ contacto_id: ct.id }).eq('id', q.id))
      ok(await vendedor.from('cotizaciones').update({ estado: 'aceptada' }).eq('id', q.id))
      const antes = ok(await sistema.from('cotizaciones').select('created_by, contacto_id, total').eq('id', q.id).single()) as Fila
      expect(antes.created_by).toBe(vendedorId)
      expect(antes.contacto_id).toBe(ct.id)
      const partida = (ok(await sistema.from('partidas').select('id').eq('cotizacion_id', q.id).single()) as { id: string }).id
      expect(ok(await sistema.from('partida_costos').select('partida_id').eq('partida_id', partida))).toHaveLength(1)

      // Cambiar el contacto por otro sigue rechazado; pasarlo a nulo por el borrado, no
      expect((await c.ventas.from('cotizaciones').update({ contacto_id: otroContacto.id }).eq('id', q.id)).error?.message).toContain('ya fue aceptada')
      ok(await c.ventas.from('contactos').delete().eq('id', ct.id).select('id').single())
      ok(await c.admin.from('productos').delete().eq('id', prod.id).select('id').single())
      const { error } = await sistema.auth.admin.deleteUser(vendedorId)
      expect(error).toBeNull()

      const despues = ok(await sistema.from('cotizaciones').select('created_by, contacto_id, estado, total, partidas(producto_id, concepto, precio_unitario)').eq('id', q.id).single()) as Fila & { partidas: Fila[] }
      expect(despues.created_by).toBeNull()
      expect(despues.contacto_id).toBeNull()
      expect(despues.estado).toBe('aceptada')
      expect(Number(despues.total)).toBe(Number(antes.total))
      expect(despues.partidas.map((p) => ({ ...p, precio_unitario: Number(p.precio_unitario) }))).toEqual([{ producto_id: null, concepto: 'Tarjetas', precio_unitario: 50 }])
      // El costo que venía del producto borrado se quita, como en una cotización abierta
      expect(ok(await sistema.from('partida_costos').select('partida_id').eq('partida_id', partida))).toHaveLength(0)
      // Y el resto de la partida sigue congelado
      expect((await c.ventas.from('partidas').update({ concepto: 'Otra cosa' }).eq('cotizacion_id', q.id)).error?.message).toContain('ya fue aceptada')
    })
  })

  describe('Ronda 3 · ajustes de la revisión', () => {
    it('cotización cerrada: nadie pasa producto_id a nulo a mano (borraría sus costos); el pedido conserva el costo', async () => {
      const prod = ok(await c.admin.from('productos').insert({ nombre: `Producto con costo ${sufijo}`, metodo_calculo: 'pieza', unidad: 'pza', precio_venta: 80 }).select('id').single()) as { id: string }
      ok(await c.admin.from('producto_costos').insert({ producto_id: prod.id, costo_material: 25 }))
      const cl = ok(await c.ventas.from('clientes').insert({ nombre: `Cliente costo ${sufijo}` }).select('id').single()) as { id: string }
      const q = ok(await c.ventas.rpc('guardar_cotizacion', {
        p_datos: { cliente_id: cl.id, titulo: 'Con costo', partidas: [{ producto_id: prod.id, concepto: 'Volantes', metodo_calculo: 'pieza', unidad: 'pza', cantidad: 1, precio_unitario: 80 }] },
      })) as { id: string }
      ok(await c.ventas.from('cotizaciones').update({ estado: 'enviada' }).eq('id', q.id))
      const { token } = ok(await c.ventas.rpc('crear_enlace_portal', { p_tipo: 'cotizacion', p_id: q.id })) as { token: string }
      const vista = ok(await anon.rpc('portal_obtener', { p_token: token })) as { cotizacion: { version: string } }
      ok(await anon.rpc('portal_aprobar_cotizacion', { p_token: token, p_nombre: 'Cliente', p_comentario: null, p_version: vista.cotizacion.version }))
      const partida = (ok(await sistema.from('partidas').select('id').eq('cotizacion_id', q.id).single()) as { id: string }).id
      const costos = async () => ok(await sistema.from('partida_costos').select('costo_total, calculo').eq('partida_id', partida)) as Fila[]
      expect(await costos()).toHaveLength(1)
      const intentar = async (motivo: string) => {
        for (const rol of ROLES) {
          const r = await c[rol].from('partidas').update({ producto_id: null }).eq('cotizacion_id', q.id).select('id')
          expect(rechazada(r), `${rol}: producto a nulo (${motivo})`).toBe(true)
          if (rol === 'admin' || rol === 'ventas') expect(r.error, `${rol}: ${motivo}`).toBeTruthy()
        }
        const fila = ok(await sistema.from('partidas').select('producto_id').eq('id', partida).single()) as Fila
        expect(fila.producto_id, motivo).toBe(prod.id)
        expect(await costos(), motivo).toHaveLength(1)
      }
      await intentar('aprobada')
      const pedido = ok(await c.ventas.rpc('convertir_cotizacion_a_pedido', { p_cotizacion: q.id })) as string
      await intentar('convertida')
      const enPedido = ok(await sistema.from('partidas').select('producto_id, partida_costos(costo_total)').eq('pedido_id', pedido)) as Array<Fila & { partida_costos: Fila | Fila[] | null }>
      expect(enPedido).toHaveLength(1)
      expect(enPedido[0].producto_id).toBe(prod.id)
      const pc = enPedido[0].partida_costos
      expect(Array.isArray(pc) ? pc.length : pc ? 1 : 0).toBe(1)
      // En una cotización abierta sigue siendo una edición normal
      const abierta = await venta(`Cliente abierta ${sufijo}`, '3355500001')
      ok(await c.ventas.from('partidas').update({ producto_id: productoId }).eq('cotizacion_id', abierta.cotizacionId).select('id'))
      expect(ok(await c.ventas.from('partidas').update({ producto_id: null }).eq('cotizacion_id', abierta.cotizacionId).select('id'))).toHaveLength(1)
    }, 30_000)

    it('clientes_operacion.busqueda: sin acentos para todos; correo y RFC solo con permiso de clientes; contacto solo si se ve', async () => {
      const tq = await venta(`Taquería El Güero ${sufijo}`, '3355577777')
      ok(await c.ventas.rpc('convertir_cotizacion_a_pedido', { p_cotizacion: tq.cotizacionId }))
      const buscar = async (rol: Rol, texto: string) =>
        (ok(await c[rol].from('clientes_operacion').select('id').eq('activo', true).ilike('busqueda', `%${texto}%`).limit(200)) as Fila[]).map((x) => x.id)
      for (const rol of ROLES) {
        const completo = rol === 'admin' || rol === 'ventas'
        expect(await buscar(rol, `taqueria el guero ${sufijo}`), `${rol}: sin acentos`).toContain(tq.clienteId)
        expect(await buscar(rol, '3355577777'), `${rol}: teléfono con pedido en proceso`).toContain(tq.clienteId)
        expect(await buscar(rol, `${sufijo}-3355577777@cliente.local`), `${rol}: correo`).toEqual(completo ? [tq.clienteId] : [])
        expect((await buscar(rol, `cliente cerrado ${sufijo}`)), `${rol}: nombre de pedido cerrado`).toContain(clienteCerrado)
        expect(await buscar(rol, tel.cerrado), `${rol}: teléfono de pedido cerrado`).toSatisfy((ids: unknown[]) => ids.includes(clienteCerrado) === completo)
        expect(await buscar(rol, `cliente sin pedidos ${sufijo}`), `${rol}: prospecto`).toEqual(completo ? [clienteSinPedidos] : [])
      }
      // Igual que clientes.busqueda para quien ve clientes (el buscador de antes)
      const viejo = (ok(await c.ventas.from('clientes').select('id').ilike('busqueda', `%taqueria el guero ${sufijo}%`)) as Fila[]).map((x) => x.id)
      expect(await buscar('ventas', `taqueria el guero ${sufijo}`)).toEqual(viejo)
    }, 30_000)
  })
})
