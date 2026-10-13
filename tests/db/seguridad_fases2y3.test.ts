/**
 * Revisión de seguridad de las fases 2 y 3 contra Supabase local (`supabase start`).
 *
 * "Hallazgos": cada prueba demostró un problema real ANTES de la migración
 * 20261014000900_seguridad_fases_2_y_3.sql (fallaba) y comprueba la corrección (pasa).
 * "Verificado": ataques que la base de datos ya resistía; quedan como pruebas de regresión.
 *
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... npx vitest run tests/db
 *
 * Opcional: DB_URL (cadena de conexión de Postgres, usa `psql`) para revisar los privilegios
 * por defecto de lo que se cree en migraciones futuras.
 */
import { execFileSync } from 'node:child_process'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'

const URL = process.env.SUPABASE_URL ?? ''
const ANON = process.env.SUPABASE_ANON_KEY ?? ''
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const DB_URL = process.env.DB_URL ?? ''
const activo = Boolean(URL && ANON && SERVICE)
const suite = activo ? describe : describe.skip
const itDb = activo && DB_URL ? it : it.skip

const sistema = activo ? createClient(URL, SERVICE, { auth: { persistSession: false } }) : (null as never)
const PASS = 'Prueba12345'
const sufijo = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`

// Fechas pasadas al azar (1980-1999) para la caja: no chocan con las de las otras pruebas.
const usadas = new Set<string>()
function fechaLibre() {
  for (;;) {
    const d = new Date(Date.UTC(1980 + Math.floor(Math.random() * 20), Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 28)))
    const t = d.toISOString().slice(0, 10)
    if (!usadas.has(t)) {
      usadas.add(t)
      return t
    }
  }
}

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

type Fila = Record<string, unknown>
const num = (v: unknown) => Number(v)

suite('Seguridad de las fases 2 y 3', () => {
  let a: SupabaseClient, v: SupabaseClient, v2: SupabaseClient, d: SupabaseClient, p: SupabaseClient
  let sinPrecios: SupabaseClient, conGastos: SupabaseClient, anon: SupabaseClient
  let idAdmin = '', idVentas = '', idVentas2 = '', idConGastos = ''
  // Venta de "ventas2": cotización, pedido y enlace del portal del pedido
  let cotB = '', pedB = '', tokenB = '', clienteB = ''

  async function venta(cliente: SupabaseClient, nombre: string, precio = 1000) {
    const c = ok(await cliente.from('clientes').insert({ nombre }).select('id').single()) as { id: string }
    const q = ok(await cliente.rpc('guardar_cotizacion', {
      p_datos: { cliente_id: c.id, titulo: nombre, partidas: [{ concepto: 'Lona', metodo_calculo: 'pieza', unidad: 'pza', cantidad: 1, precio_unitario: precio }] },
    })) as { id: string }
    return { clienteId: c.id, cotizacionId: q.id }
  }

  beforeAll(async () => {
    idAdmin = await crearUsuario(`seg-admin-${sufijo}@prueba.local`, { rol: 'admin', activo: true, nombre: 'Admin Seguridad' })
    idVentas = await crearUsuario(`seg-ventas-${sufijo}@prueba.local`, { rol: 'ventas', activo: true, nombre: 'Ventas Uno' })
    idVentas2 = await crearUsuario(`seg-ventas2-${sufijo}@prueba.local`, { rol: 'ventas', activo: true, nombre: 'Ventas Dos' })
    await crearUsuario(`seg-diseno-${sufijo}@prueba.local`, { rol: 'diseno', activo: true, nombre: 'Diseño Seguridad' })
    await crearUsuario(`seg-prod-${sufijo}@prueba.local`, { rol: 'produccion', activo: true, nombre: 'Producción Seguridad' })
    // Configuraciones personalizadas que el administrador puede dar desde Usuarios
    await crearUsuario(`seg-sinprecios-${sufijo}@prueba.local`, { rol: 'ventas', activo: true, nombre: 'Mostrador sin precios' }, { ver_precios: false })
    idConGastos = await crearUsuario(`seg-gastos-${sufijo}@prueba.local`, { rol: 'ventas', activo: true, nombre: 'Compras' }, { registrar_gastos: true })
    a = await sesion(`seg-admin-${sufijo}@prueba.local`)
    v = await sesion(`seg-ventas-${sufijo}@prueba.local`)
    v2 = await sesion(`seg-ventas2-${sufijo}@prueba.local`)
    d = await sesion(`seg-diseno-${sufijo}@prueba.local`)
    p = await sesion(`seg-prod-${sufijo}@prueba.local`)
    sinPrecios = await sesion(`seg-sinprecios-${sufijo}@prueba.local`)
    conGastos = await sesion(`seg-gastos-${sufijo}@prueba.local`)
    anon = createClient(URL, ANON, { auth: { persistSession: false } })

    const b = await venta(v2, `Cliente de Ventas Dos ${sufijo}`)
    cotB = b.cotizacionId
    clienteB = b.clienteId
    pedB = ok(await v2.rpc('convertir_cotizacion_a_pedido', { p_cotizacion: cotB })) as string
    tokenB = (ok(await v2.rpc('crear_enlace_portal', { p_tipo: 'pedido', p_id: pedB })) as { token: string }).token
  })

  // ===================================================================
  // Hallazgos
  // ===================================================================
  describe('hallazgos', () => {
    it('comisiones: ventas no puede quedarse con la venta (ni la comisión) de otro vendedor', async () => {
      const ped = ok(await a.from('pedidos').select('vendedor_id').eq('id', pedB).single()) as Fila
      expect(ped.vendedor_id).toBe(idVentas2)

      const { error: e1 } = await v.from('pedidos').update({ vendedor_id: idVentas }).eq('id', pedB)
      expect(e1?.code).toBe('42501')
      const { error: e2 } = await v.from('cotizaciones').update({ vendedor_id: idVentas }).eq('id', cotB)
      expect(e2?.code).toBe('42501')
      const despues = ok(await a.from('pedidos').select('vendedor_id').eq('id', pedB).single()) as Fila
      expect(despues.vendedor_id).toBe(idVentas2)

      // Administración sí reasigna; una venta sin vendedor la puede tomar quien la atiende (solo para sí).
      ok(await a.from('pedidos').update({ vendedor_id: idVentas }).eq('id', pedB))
      ok(await a.from('pedidos').update({ vendedor_id: idVentas2 }).eq('id', pedB))
      const libre = await venta(v, `Cliente sin vendedor ${sufijo}`)
      ok(await a.from('cotizaciones').update({ vendedor_id: null }).eq('id', libre.cotizacionId))
      const { error: paraOtro } = await v.from('cotizaciones').update({ vendedor_id: idVentas2 }).eq('id', libre.cotizacionId)
      expect(paraOtro?.code).toBe('42501')
      ok(await v.from('cotizaciones').update({ vendedor_id: idVentas }).eq('id', libre.cotizacionId))
    })

    it('portal: sin "ver_precios" no se crean ni se leen enlaces (el portal muestra precios)', async () => {
      const { error: pedido } = await sinPrecios.rpc('crear_enlace_portal', { p_tipo: 'pedido', p_id: pedB })
      expect(pedido?.code).toBe('42501')
      const { error: cot } = await sinPrecios.rpc('crear_enlace_portal', { p_tipo: 'cotizacion', p_id: cotB })
      expect(cot?.code).toBe('42501')
      expect(ok(await sinPrecios.from('portal_enlaces').select('token'))).toEqual([])
      // Con el permiso sigue funcionando
      const e = ok(await v.rpc('crear_enlace_portal', { p_tipo: 'pedido', p_id: pedB })) as Fila
      expect(e.token).toBe(tokenB)
    })

    it('corte de caja: un pago en efectivo que se guarda al mismo tiempo no queda fuera del corte', async () => {
      const c = await venta(v, `Cliente Caja ${sufijo}`, 100000)
      const pedido = ok(await v.rpc('convertir_cotizacion_a_pedido', { p_cotizacion: c.cotizacionId })) as string
      for (let ronda = 0; ronda < 3; ronda++) {
        const fecha = fechaLibre()
        const pagos = Array.from({ length: 20 }, () =>
          v.from('pagos').insert({ pedido_id: pedido, fecha, importe: 10, metodo: 'efectivo', tipo: 'abono' }).then((r) => r.error),
        )
        await new Promise((r) => setTimeout(r, 15))
        // Las consultas de supabase-js salen al llamar .then(): el cierre se envía ya, junto con los pagos.
        const cierre = v2.rpc('cerrar_caja', { p_fecha: fecha, p_efectivo_inicial: 0, p_efectivo_contado: 0 }).then((r) => r)
        const errores = await Promise.all(pagos)
        ok(await cierre)
        // Los que llegaron tarde se rechazan por caja cerrada; ninguno por otra razón.
        expect(errores.filter(Boolean).every((e) => e!.code === '42501')).toBe(true)

        const corte = ok(await a.from('cortes_caja').select('esperado').eq('fecha', fecha).single()) as Fila
        const guardados = ok(await a.from('pagos').select('importe').eq('fecha', fecha).eq('pedido_id', pedido).eq('metodo', 'efectivo').eq('cancelado', false)) as Fila[]
        const efectivo = guardados.reduce((s, x) => s + num(x.importe), 0)
        ok(await a.rpc('reabrir_caja', { p_fecha: fecha, p_motivo: 'Prueba de seguridad' }))
        expect({ ronda, esperado: num(corte.esperado) }).toEqual({ ronda, esperado: efectivo })
      }
    })

    it('portal: nombres y comentarios gigantes se rechazan de inmediato, sin ocupar la base', async () => {
      const q = await venta(v, `Cliente Portal Grande ${sufijo}`)
      ok(await v.from('cotizaciones').update({ estado: 'enviada' }).eq('id', q.cotizacionId))
      const token = (ok(await v.rpc('crear_enlace_portal', { p_tipo: 'cotizacion', p_id: q.cotizacionId })) as { token: string }).token
      const enorme = ' a'.repeat(5_000_000) // 10 MB

      let t = Date.now()
      const { error: nombre } = await anon.rpc('portal_aprobar_cotizacion', { p_token: token, p_nombre: enorme })
      expect(nombre?.code).not.toBe('57014') // statement timeout
      expect(nombre?.message).toContain('120')
      expect(Date.now() - t).toBeLessThan(2500)

      t = Date.now()
      const { error: comentario } = await anon.rpc('portal_aprobar_cotizacion', { p_token: token, p_nombre: 'Juan Pérez', p_comentario: enorme })
      expect(comentario?.code).not.toBe('57014')
      expect(comentario?.message).toContain('1000')
      expect(Date.now() - t).toBeLessThan(2500)

      t = Date.now()
      const { error: diseno } = await anon.rpc('portal_responder_diseno', {
        p_token: tokenB, p_archivo_id: '00000000-0000-0000-0000-000000000000', p_aprobado: false, p_nombre: 'Juan Pérez', p_comentario: enorme,
      })
      expect(diseno?.code).not.toBe('57014')
      expect(diseno?.message).toContain('1000')
      expect(Date.now() - t).toBeLessThan(2500)

      const sigue = ok(await v.from('cotizaciones').select('estado').eq('id', q.cotizacionId).single()) as Fila
      expect(sigue.estado).toBe('enviada')
    })

    it('portal-cliente: solo se firman archivos guardados en la carpeta de ese pedido', async () => {
      const otro = ok(await v.from('clientes').insert({ nombre: `Otro cliente ${sufijo}` }).select('id').single()) as { id: string }
      const insertar = async (nombre: string, path: string) =>
        (ok(await d.from('archivos').insert({ pedido_id: pedB, nombre, path, mime: 'application/pdf' }).select('id').single()) as { id: string }).id
      const bueno = await insertar('propuesta.pdf', `pedidos/${pedB}/propuesta-${sufijo}.pdf`)
      const ajeno = await insertar('ine.pdf', `clientes/${otro.id}/ine.pdf`)
      const salto = await insertar('salto.pdf', `pedidos/${pedB}/../../clientes/${otro.id}/ine.pdf`)
      const firmables = (ok(await sistema.rpc('portal_archivos_firmables', { p_token: tokenB })) as Fila[]).map((x) => x.id)
      expect(firmables).toContain(bueno)
      expect(firmables).not.toContain(ajeno)
      expect(firmables).not.toContain(salto)
    })

    it('diseños: la evidencia de la aprobación del cliente no la cambia quien no puede aprobar', async () => {
      const arch = ok(await d.from('archivos').insert({ pedido_id: pedB, nombre: 'final.png', path: `pedidos/${pedB}/final-${sufijo}.png`, mime: 'image/png' }).select('id').single()) as { id: string }
      ok(await anon.rpc('portal_responder_diseno', { p_token: tokenB, p_archivo_id: arch.id, p_aprobado: true, p_nombre: 'Cliente Real' }))
      const antes = ok(await a.from('archivos').select('aprobado_por_nombre, aprobacion_notas, aprobacion_registrada_por, aprobacion_at').eq('id', arch.id).single()) as Fila

      // Producción (sin "aprobar_disenos") no reescribe quién aprobó ni las notas
      const { error: nombre } = await p.from('archivos').update({ aprobado_por_nombre: 'Otra persona' }).eq('id', arch.id)
      expect(nombre?.code).toBe('42501')
      const { error: notas } = await p.from('archivos').update({ aprobacion_notas: 'Aprobado por teléfono' }).eq('id', arch.id)
      expect(notas?.code).toBe('42501')
      // ...ni quién registró la aprobación ni cuándo (los pone la base de datos)
      await p.from('archivos').update({ aprobacion_registrada_por: idAdmin, aprobacion_at: '2001-01-01T00:00:00Z' }).eq('id', arch.id)
      const despues = ok(await a.from('archivos').select('aprobado_por_nombre, aprobacion_notas, aprobacion_registrada_por, aprobacion_at').eq('id', arch.id).single()) as Fila
      expect(despues).toEqual(antes)
      // Lo demás del archivo lo sigue pudiendo cambiar
      ok(await p.from('archivos').update({ nombre: 'final-impresion.png' }).eq('id', arch.id))
    })

    it('proveedores: quién lo registró lo pone la base de datos', async () => {
      const pr = ok(await conGastos.from('proveedores').insert({ nombre: `Maquila Norte ${sufijo}`, created_by: idAdmin }).select('id, created_by').single()) as Fila
      expect(pr.created_by).toBe(idConGastos)
      ok(await conGastos.from('proveedores').update({ created_by: idAdmin }).eq('id', pr.id as string))
      const otra = ok(await a.from('proveedores').select('created_by').eq('id', pr.id as string).single()) as Fila
      expect(otra.created_by).toBe(idConGastos)
    })

    itDb('privilegios por defecto: lo que se cree en migraciones futuras tampoco queda abierto a anon', () => {
      const sql = `
        begin;
        create function public.zz_seguridad_prueba() returns int language sql as 'select 1';
        create table public.zz_seguridad_prueba (id int);
        select json_build_object(
          'anon_ejecuta', has_function_privilege('anon', 'public.zz_seguridad_prueba()', 'execute'),
          'auth_ejecuta', has_function_privilege('authenticated', 'public.zz_seguridad_prueba()', 'execute'),
          'servicio_ejecuta', has_function_privilege('service_role', 'public.zz_seguridad_prueba()', 'execute'),
          'anon_tabla', has_table_privilege('anon', 'public.zz_seguridad_prueba', 'select, insert, update, delete, truncate, references, trigger'),
          'auth_truncate', has_table_privilege('authenticated', 'public.zz_seguridad_prueba', 'truncate, references, trigger')
        );
        rollback;`
      const salida = execFileSync('psql', [DB_URL, '-q', '-At', '-v', 'ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8' }).trim()
      expect(JSON.parse(salida)).toEqual({ anon_ejecuta: false, auth_ejecuta: true, servicio_ejecuta: true, anon_tabla: false, auth_truncate: false })
    })
  })

  // ===================================================================
  // Verificado (ya estaba bien; quedan como pruebas de regresión)
  // ===================================================================
  describe('verificado', () => {
    it('anon: la API solo publica las tres funciones del portal (ninguna tabla ni otra función)', async () => {
      const r = await fetch(`${URL}/rest/v1/`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } })
      const esquema = (await r.json()) as { paths: Record<string, unknown> }
      expect(Object.keys(esquema.paths).sort()).toEqual(['/', '/rpc/portal_aprobar_cotizacion', '/rpc/portal_obtener', '/rpc/portal_responder_diseno'])
    })

    it('inventario: consumos simultáneos o en lote nunca dejan existencia negativa', async () => {
      const m = ok(await a.from('materiales').insert({ nombre: `Vinil concurrencia ${sufijo}`, unidad: 'metro', existencia: 10 }).select('id').single()) as { id: string }
      const intentos = await Promise.all(
        Array.from({ length: 8 }, () => p.from('movimientos_inventario').insert({ material_id: m.id, tipo: 'consumo', cantidad: 3 }).then((r) => r.error)),
      )
      expect(intentos.filter((e) => !e)).toHaveLength(3)
      let mat = ok(await p.from('materiales').select('existencia').eq('id', m.id).single()) as Fila
      expect(num(mat.existencia)).toBe(1)
      const { error: lote } = await p.from('movimientos_inventario').insert([
        { material_id: m.id, tipo: 'consumo', cantidad: 1 },
        { material_id: m.id, tipo: 'merma', cantidad: 1 },
      ])
      expect(lote).toBeTruthy()
      mat = ok(await p.from('materiales').select('existencia').eq('id', m.id).single()) as Fila
      expect(num(mat.existencia)).toBe(1)
      const movs = ok(await a.from('movimientos_inventario').select('id').eq('material_id', m.id)) as Fila[]
      expect(movs).toHaveLength(4) // existencia inicial + 3 consumos
      // Producción no puede "reponer" con una entrada, un ajuste ni cantidades negativas
      for (const mov of [{ tipo: 'entrada', cantidad: 5 }, { tipo: 'ajuste', cantidad: 5 }, { tipo: 'consumo', cantidad: -5 }, { tipo: 'merma', cantidad: 0 }]) {
        const { error } = await p.from('movimientos_inventario').insert({ material_id: m.id, ...mov })
        expect(error).toBeTruthy()
      }
      const { error: directo } = await a.from('materiales').update({ existencia: 999 }).eq('id', m.id)
      expect(directo).toBeTruthy()
    })

    it('reportes, utilidad, caja, cobranza y comisiones ajenas: cerrados sin permiso', async () => {
      const rango = { p_desde: '2020-01-01', p_hasta: '2020-12-31' }
      const llamadas: Array<[string, Record<string, unknown>]> = [
        ['reporte_ventas', { ...rango, p_agrupar: 'mes' }],
        ['reporte_productos', rango],
        ['reporte_vendedores', rango],
        ['reporte_clientes', rango],
        ['utilidad_pedidos', rango],
      ]
      for (const quien of [v, d, p]) {
        for (const [fn, args] of llamadas) {
          const { error } = await quien.rpc(fn, args)
          expect([fn, error?.code]).toEqual([fn, '42501'])
        }
      }
      for (const quien of [d, p]) {
        for (const [fn, args] of [['corte_caja_resumen', {}], ['cuentas_por_cobrar', {}], ['clientes_inactivos', {}], ['cerrar_caja', { p_fecha: '1990-01-01', p_efectivo_inicial: 0, p_efectivo_contado: 0 }]] as const) {
          const { error } = await quien.rpc(fn, args)
          expect([fn, error?.code]).toEqual([fn, '42501'])
        }
      }
      const { error: reabrir } = await v.rpc('reabrir_caja', { p_fecha: '1990-01-01', p_motivo: 'x' })
      expect(reabrir?.code).toBe('42501')
      // Comisiones: pedir las de otra persona devuelve solo las propias
      const periodo = { p_desde: '2017-01-01', p_hasta: '2026-12-31' }
      const ajenas = ok(await v.rpc('comisiones_detalle', { ...periodo, p_vendedor: idVentas2 })) as Fila[]
      expect(ajenas.every((x) => x.vendedor_id === idVentas)).toBe(true)
      const resumen = ok(await v.rpc('comisiones', periodo)) as Fila[]
      expect(resumen.map((x) => x.vendedor_id)).toEqual([idVentas])
      // Costos de materiales y gastos: invisibles para ventas, diseño y producción
      for (const quien of [v, d, p]) {
        expect(ok(await quien.from('material_costos').select('*'))).toEqual([])
        expect(ok(await quien.from('gastos').select('*'))).toEqual([])
        expect(ok(await quien.from('proveedores').select('*'))).toEqual([])
      }
    })

    it('bitácora: registra lo nuevo sin guardar tokens y nadie la modifica por la API', async () => {
      const filas = ok(await a.from('bitacora').select('datos, usuario_nombre').eq('tabla', 'portal_enlaces').order('id', { ascending: false }).limit(50)) as Fila[]
      expect(filas.length).toBeGreaterThan(0)
      expect(JSON.stringify(filas)).not.toContain(tokenB)
      expect(JSON.stringify(filas)).not.toContain('"token"')
      const una = (ok(await a.from('bitacora').select('id').order('id', { ascending: false }).limit(1).single()) as { id: number }).id
      const { error: editar } = await a.from('bitacora').update({ etiqueta: 'alterado' }).eq('id', una)
      expect(editar).toBeTruthy()
      const { error: borrar } = await a.from('bitacora').delete().eq('id', una)
      expect(borrar).toBeTruthy()
      const { error: crear } = await a.from('bitacora').insert({ tabla: 'pagos', accion: 'crear', etiqueta: 'falso' })
      expect(crear).toBeTruthy()
      expect(ok(await v.from('bitacora').select('id').limit(1))).toEqual([])
      // Los cambios del portal quedan atribuidos al cliente
      const portal = ok(await a.from('bitacora').select('usuario_nombre').eq('tabla', 'archivos').eq('usuario_nombre', 'Cliente (portal)').limit(1)) as Fila[]
      expect(portal).toHaveLength(1)
    })

    it('comprobantes de gastos: ventas no los sube, no los descarga ni los mueve de carpeta', async () => {
      const pdf = new Blob(['%PDF-1.4 prueba'], { type: 'application/pdf' })
      const rutaGasto = `gastos/${crypto.randomUUID()}/factura-${sufijo}.pdf`
      ok(await a.storage.from('comprobantes').upload(rutaGasto, pdf, { contentType: 'application/pdf' }))
      const { error: bajar } = await v.storage.from('comprobantes').download(rutaGasto)
      expect(bajar).toBeTruthy()
      const { error: subir } = await v.storage.from('comprobantes').upload(`gastos/${crypto.randomUUID()}/x.pdf`, pdf, { contentType: 'application/pdf' })
      expect(subir).toBeTruthy()
      const rutaPago = `pagos/${pedB}/comprobante-${sufijo}.pdf`
      ok(await v.storage.from('comprobantes').upload(rutaPago, pdf, { contentType: 'application/pdf' }))
      const { error: mover } = await v.storage.from('comprobantes').move(rutaPago, `gastos/${crypto.randomUUID()}/movido.pdf`)
      expect(mover).toBeTruthy()
      const { error: sobrescribir } = await v.storage.from('comprobantes').upload(rutaPago, pdf, { contentType: 'application/pdf', upsert: true })
      expect(sobrescribir).toBeTruthy()
      for (const quien of [d, p]) {
        const { error } = await quien.storage.from('comprobantes').download(rutaPago)
        expect(error).toBeTruthy()
      }
      const lista = ok(await v.storage.from('comprobantes').list('gastos')) as unknown[]
      expect(lista).toEqual([])
      ok(await conGastos.storage.from('comprobantes').download(rutaGasto))
    })

    it('portal: un enlace no alcanza diseños de otro pedido ni cotizaciones de otro cliente', async () => {
      const otra = await venta(v, `Cliente Ajeno ${sufijo}`)
      const pedOtro = ok(await v.rpc('convertir_cotizacion_a_pedido', { p_cotizacion: otra.cotizacionId })) as string
      const archOtro = ok(await d.from('archivos').insert({ pedido_id: pedOtro, nombre: 'ajeno.png', path: `pedidos/${pedOtro}/ajeno.png` }).select('id').single()) as { id: string }
      const { error } = await anon.rpc('portal_responder_diseno', { p_token: tokenB, p_archivo_id: archOtro.id, p_aprobado: true, p_nombre: 'Juan Pérez' })
      expect(error?.message).toContain('no encontrado')
      const firmables = (ok(await sistema.rpc('portal_archivos_firmables', { p_token: tokenB, p_archivo_id: archOtro.id })) as Fila[])
      expect(firmables).toEqual([])
      const r = ok(await anon.rpc('portal_obtener', { p_token: tokenB })) as Record<string, any>
      const texto = JSON.stringify(r)
      expect(texto).not.toContain(pedOtro)
      expect(texto).not.toContain(clienteB) // ni ids internos de clientes
      expect(r.pedido.cliente).toBe(`Cliente de Ventas Dos ${sufijo}`)
    })
  })
})
