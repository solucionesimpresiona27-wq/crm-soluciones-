/**
 * Revisión de seguridad de las fases 2 y 3 contra Supabase local (`supabase start`).
 *
 * "Hallazgos": cada prueba demostró un problema real ANTES de su corrección (fallaba) y
 * comprueba la corrección (pasa): migraciones 20261014000900_seguridad_fases_2_y_3.sql y
 * 20261014001000_seguridad_fases_2_y_3_b.sql, y la función de Edge portal-cliente.
 * "Verificado": ataques que la base de datos ya resistía; quedan como pruebas de regresión.
 *
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... npx vitest run tests/db
 *
 * DB_URL (cadena de conexión de Postgres, usa `psql`) revisa los privilegios por defecto de lo
 * que se cree en migraciones futuras. Con Supabase local (127.0.0.1:54321) se usa la cadena
 * local de siempre si no se indica otra.
 * PORTAL_FN_URL (opcional) prueba la función de Edge "portal-cliente" corriendo con Deno.
 */
import { execFileSync } from 'node:child_process'
import { connect } from 'node:net'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'

const URL = process.env.SUPABASE_URL ?? ''
const ANON = process.env.SUPABASE_ANON_KEY ?? ''
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const FN_URL = process.env.PORTAL_FN_URL ?? ''
const hayPsql = (() => {
  try {
    execFileSync('psql', ['--version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
})()
const DB_URL = process.env.DB_URL ?? (URL.includes('127.0.0.1:54321') && hayPsql ? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' : '')
const activo = Boolean(URL && ANON && SERVICE)
const suite = activo ? describe : describe.skip
const itDb = activo && DB_URL ? it : it.skip
const itFn = activo && FN_URL ? it : it.skip

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

// Solicitud HTTP "a mano" (para mandar un Content-Length que no corresponde al cuerpo).
// Devuelve la primera línea de la respuesta o "sin respuesta" si no contesta a tiempo.
function solicitudCruda(destino: string, encabezados: string[], cuerpo: string, ms = 3000): Promise<string> {
  const u = new globalThis.URL(destino)
  return new Promise((resolve) => {
    const s = connect(Number(u.port || 80), u.hostname)
    let datos = ''
    const fin = setTimeout(() => {
      s.destroy()
      resolve('sin respuesta')
    }, ms)
    s.on('connect', () => s.write(`POST ${u.pathname} HTTP/1.1\r\nHost: ${u.host}\r\n${encabezados.join('\r\n')}\r\n\r\n${cuerpo}`))
    s.on('data', (b) => {
      datos += b.toString()
      if (datos.includes('\r\n')) {
        clearTimeout(fin)
        s.destroy()
        resolve(datos.split('\r\n')[0])
      }
    })
    s.on('error', () => {
      clearTimeout(fin)
      resolve('error de conexión')
    })
  })
}

suite('Seguridad de las fases 2 y 3', () => {
  let a: SupabaseClient, v: SupabaseClient, v2: SupabaseClient, d: SupabaseClient, p: SupabaseClient
  let sinPrecios: SupabaseClient, conGastos: SupabaseClient, conBorrar: SupabaseClient, deBaja: SupabaseClient
  let anon: SupabaseClient
  let idAdmin = '', idVentas = '', idVentas2 = '', idConGastos = '', idDeBaja = ''
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
    await crearUsuario(`seg-borrar-${sufijo}@prueba.local`, { rol: 'ventas', activo: true, nombre: 'Compras con borrado' }, { registrar_gastos: true, eliminar_registros: true })
    idDeBaja = await crearUsuario(`seg-baja-${sufijo}@prueba.local`, { rol: 'ventas', activo: true, nombre: 'Persona dada de baja' })
    a = await sesion(`seg-admin-${sufijo}@prueba.local`)
    v = await sesion(`seg-ventas-${sufijo}@prueba.local`)
    v2 = await sesion(`seg-ventas2-${sufijo}@prueba.local`)
    d = await sesion(`seg-diseno-${sufijo}@prueba.local`)
    p = await sesion(`seg-prod-${sufijo}@prueba.local`)
    sinPrecios = await sesion(`seg-sinprecios-${sufijo}@prueba.local`)
    conGastos = await sesion(`seg-gastos-${sufijo}@prueba.local`)
    conBorrar = await sesion(`seg-borrar-${sufijo}@prueba.local`)
    deBaja = await sesion(`seg-baja-${sufijo}@prueba.local`)
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

    // --- Segunda parte (migración 20261014001000) ---

    it('diseños aprobados: nadie (salvo administración) apunta el diseño aprobado a otro archivo', async () => {
      const ruta = `pedidos/${pedB}/arte-${sufijo}.png`
      const arch = ok(await d.from('archivos').insert({ pedido_id: pedB, nombre: 'arte.png', path: ruta, mime: 'image/png' }).select('id').single()) as { id: string }
      ok(await anon.rpc('portal_responder_diseno', { p_token: tokenB, p_archivo_id: arch.id, p_aprobado: true, p_nombre: 'Cliente Real' }))

      // Producción (sin "aprobar_disenos") y diseño no cambian el archivo que aprobó el cliente
      const intentos: Array<[SupabaseClient, Fila]> = [
        [p, { path: `pedidos/${pedB}/otro-${sufijo}.png` }],
        [p, { enlace_externo: 'https://ejemplo.com/otro-arte' }],
        [d, { path: `pedidos/${pedB}/otro-${sufijo}.png` }],
      ]
      for (const [quien, cambio] of intentos) {
        const { error } = await quien.from('archivos').update(cambio).eq('id', arch.id)
        expect([cambio, error?.code]).toEqual([cambio, '42501'])
      }
      const fila = ok(await a.from('archivos').select('path, enlace_externo, estado_aprobacion').eq('id', arch.id).single())
      expect(fila).toEqual({ path: ruta, enlace_externo: null, estado_aprobacion: 'aprobado' })

      // Un diseño pendiente sí se reemplaza; quien registra aprobaciones puede retirar la
      // aprobación y cambiar el archivo a la vez; administración puede todo.
      const pend = ok(await d.from('archivos').insert({ pedido_id: pedB, nombre: 'pendiente.png', path: `pedidos/${pedB}/pendiente-${sufijo}.png` }).select('id').single()) as { id: string }
      ok(await p.from('archivos').update({ path: `pedidos/${pedB}/pendiente-b-${sufijo}.png` }).eq('id', pend.id))
      ok(await d.from('archivos').update({ estado_aprobacion: 'pendiente', path: `pedidos/${pedB}/arte-v2-${sufijo}.png` }).eq('id', arch.id))
      ok(await a.from('archivos').update({ estado_aprobacion: 'aprobado', path: ruta }).eq('id', arch.id))
      ok(await a.from('archivos').update({ enlace_externo: 'https://ejemplo.com/arte-final' }).eq('id', arch.id))
    })

    it('diseños: quien sube un diseño no deja precargado quién lo aprobó ni las notas de aprobación', async () => {
      const arch = ok(await p.from('archivos').insert({
        pedido_id: pedB, nombre: 'prueba-color.png', path: `pedidos/${pedB}/prueba-color-${sufijo}.png`,
        aprobado_por_nombre: 'Juan Cliente', aprobacion_notas: 'Aprobado por teléfono',
      }).select('id, aprobado_por_nombre, aprobacion_notas, estado_aprobacion').single()) as Fila
      expect(arch).toMatchObject({ aprobado_por_nombre: null, aprobacion_notas: null, estado_aprobacion: 'pendiente' })
      // Al registrar la aprobación sin nombre no aparece el nombre que intentó precargar
      ok(await d.from('archivos').update({ estado_aprobacion: 'aprobado' }).eq('id', arch.id as string))
      const evento = ok(await a.from('pedido_eventos').select('mensaje').eq('pedido_id', pedB).eq('tipo', 'aprobacion').order('created_at', { ascending: false }).limit(1).single()) as Fila
      expect(evento.mensaje).not.toContain('Juan Cliente')
    })

    it('diseños aprobados: quien los subió no borra el archivo guardado para reemplazarlo por otro', async () => {
      const png = (...b: number[]) => new Blob([Uint8Array.from(b)], { type: 'image/png' })
      const ruta = `pedidos/${pedB}/arte-guardado-${sufijo}.png`
      ok(await d.storage.from('archivos').upload(ruta, png(137, 80, 78, 71, 1), { contentType: 'image/png' }))
      const arch = ok(await d.from('archivos').insert({ pedido_id: pedB, nombre: 'arte.png', path: ruta, mime: 'image/png' }).select('id').single()) as { id: string }
      ok(await anon.rpc('portal_responder_diseno', { p_token: tokenB, p_archivo_id: arch.id, p_aprobado: true, p_nombre: 'Cliente Real' }))

      await d.storage.from('archivos').remove([ruta])
      const { error: resubir } = await d.storage.from('archivos').upload(ruta, png(0, 0, 0), { contentType: 'image/png' })
      expect(resubir).toBeTruthy()
      const { error: sobrescribir } = await d.storage.from('archivos').upload(ruta, png(0, 0, 0), { contentType: 'image/png', upsert: true })
      expect(sobrescribir).toBeTruthy()
      const { error: mover } = await d.storage.from('archivos').move(ruta, `pedidos/${pedB}/movido-${sufijo}.png`)
      expect(mover).toBeTruthy()
      const guardado = ok(await a.storage.from('archivos').download(ruta)) as Blob
      expect([...new Uint8Array(await guardado.arrayBuffer())]).toEqual([137, 80, 78, 71, 1])

      // Un archivo de un diseño pendiente sí lo borra quien lo subió
      const rutaPend = `pedidos/${pedB}/pendiente-guardado-${sufijo}.png`
      ok(await d.storage.from('archivos').upload(rutaPend, png(1, 2, 3), { contentType: 'image/png' }))
      ok(await d.from('archivos').insert({ pedido_id: pedB, nombre: 'pendiente.png', path: rutaPend }))
      expect(ok(await d.storage.from('archivos').remove([rutaPend]))).toHaveLength(1)
    })

    it('caja: sin "ver_precios" no se leen los pagos del día por el corte de caja', async () => {
      const c = await venta(v, `Cliente Caja Precios ${sufijo}`, 5000)
      const pedido = ok(await v.rpc('convertir_cotizacion_a_pedido', { p_cotizacion: c.cotizacionId })) as string
      const fecha = fechaLibre()
      ok(await v.from('pagos').insert({ pedido_id: pedido, fecha, importe: 1234.5, metodo: 'efectivo', tipo: 'abono' }))
      ok(await v.rpc('cerrar_caja', { p_fecha: fecha, p_efectivo_inicial: 0, p_efectivo_contado: 1234.5 }))
      try {
        // Sin "ver_precios" no ve los pagos en su tabla...
        expect(ok(await sinPrecios.from('pagos').select('id').eq('fecha', fecha))).toEqual([])
        // ...ni a través del corte de caja (resumen, corte guardado o cierre)
        const { data: resumen, error } = await sinPrecios.rpc('corte_caja_resumen', { p_fecha: fecha })
        expect(error?.code).toBe('42501')
        expect(resumen).toBeNull()
        expect(ok(await sinPrecios.from('cortes_caja').select('resumen').eq('fecha', fecha))).toEqual([])
        const { error: cerrar } = await sinPrecios.rpc('cerrar_caja', { p_fecha: fechaLibre(), p_efectivo_inicial: 0, p_efectivo_contado: 0 })
        expect(cerrar?.code).toBe('42501')
        // Ventas (con "ver_precios") sigue igual
        const r = ok(await v.rpc('corte_caja_resumen', { p_fecha: fecha })) as { esperado: number; cerrado: boolean }
        expect([num(r.esperado), r.cerrado]).toEqual([1234.5, true])
      } finally {
        ok(await a.rpc('reabrir_caja', { p_fecha: fecha, p_motivo: 'Prueba de seguridad' }))
      }
    })

    it('caja: con el día cerrado, los gastos en efectivo tampoco se borran (salvo administración)', async () => {
      const fecha = fechaLibre()
      const g = ok(await conBorrar.from('gastos').insert({ fecha, concepto: `Tinta ${sufijo}`, categoria: 'material', monto: 300, metodo_pago: 'efectivo' }).select('id').single()) as { id: string }
      ok(await v.rpc('cerrar_caja', { p_fecha: fecha, p_efectivo_inicial: 1000, p_efectivo_contado: 700 }))
      try {
        const { error } = await conBorrar.from('gastos').delete().eq('id', g.id)
        expect(error?.code).toBe('42501')
        expect(ok(await a.from('gastos').select('id').eq('id', g.id))).toHaveLength(1)
      } finally {
        ok(await a.rpc('reabrir_caja', { p_fecha: fecha, p_motivo: 'Prueba de seguridad' }))
      }
      // Con la caja abierta sí lo puede borrar (tiene "eliminar_registros")
      ok(await conBorrar.from('gastos').delete().eq('id', g.id))
      expect(ok(await a.from('gastos').select('id').eq('id', g.id))).toEqual([])
    })

    itFn('portal-cliente: rechaza cuerpos enormes sin leerlos ni esperarlos', async () => {
      const grande = await fetch(FN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenB, relleno: 'x'.repeat(3000) }),
      })
      expect(grande.status).toBe(413)
      // Anuncia 50 MB y no los manda: antes la función se quedaba esperando el cuerpo completo.
      const linea = await solicitudCruda(FN_URL, ['Content-Type: application/json', 'Content-Length: 50000000'], '{"token":')
      expect(linea).toContain('413')
      // Una solicitud normal sigue funcionando
      const normal = await fetch(FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tokenB }) })
      expect(normal.status).toBe(200)
    })
  })

  // ===================================================================
  // Verificado (ya estaba bien; quedan como pruebas de regresión)
  // ===================================================================
  describe('verificado', () => {
    it('usuario dado de baja: con la sesión que le quedaba no borra ni cambia sus archivos ni sus notas', async () => {
      const ruta = `pedidos/${pedB}/baja-${sufijo}.pdf`
      ok(await deBaja.storage.from('archivos').upload(ruta, new Blob(['%PDF-1.4 baja'], { type: 'application/pdf' }), { contentType: 'application/pdf' }))
      const arch = ok(await deBaja.from('archivos').insert({ pedido_id: pedB, nombre: 'cotizacion-proveedor.pdf', path: ruta, categoria: 'referencia' }).select('id').single()) as { id: string }
      const act = ok(await deBaja.from('actividades').insert({ cliente_id: clienteB, tipo: 'nota', descripcion: 'Cliente pidió factura', usuario_id: idDeBaja }).select('id').single()) as { id: string }

      // Administración lo da de baja; el token de su sesión sigue vigente hasta que expire.
      ok(await sistema.from('perfiles').update({ activo: false }).eq('id', idDeBaja))
      await deBaja.storage.from('archivos').remove([ruta])
      await deBaja.from('archivos').update({ nombre: 'otro.pdf' }).eq('id', arch.id)
      await deBaja.from('archivos').delete().eq('id', arch.id)
      await deBaja.from('actividades').update({ descripcion: 'Borrado' }).eq('id', act.id)
      await deBaja.from('actividades').delete().eq('id', act.id)

      expect(ok(await a.storage.from('archivos').download(ruta))).toBeTruthy()
      expect(ok(await a.from('archivos').select('nombre').eq('id', arch.id))).toEqual([{ nombre: 'cotizacion-proveedor.pdf' }])
      expect(ok(await a.from('actividades').select('descripcion').eq('id', act.id))).toEqual([{ descripcion: 'Cliente pidió factura' }])
    })

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

    itFn('portal-cliente: firma solo diseños de la carpeta del pedido y no filtra detalles en los errores', async () => {
      const otro = ok(await v.from('clientes').insert({ nombre: `Cliente INE ${sufijo}` }).select('id').single()) as { id: string }
      const rutaAjena = `clientes/${otro.id}/ine-${sufijo}.pdf`
      ok(await v.storage.from('archivos').upload(rutaAjena, new Blob(['%PDF-1.4 INE'], { type: 'application/pdf' }), { contentType: 'application/pdf' }))
      const ajeno = ok(await d.from('archivos').insert({ pedido_id: pedB, nombre: 'propuesta-final.pdf', path: rutaAjena }).select('id').single()) as { id: string }
      const llamar = (cuerpo: unknown) =>
        fetch(FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
      const todos = (await (await llamar({ token: tokenB })).json()) as { archivos: Array<{ id: string; url: string }> }
      expect(todos.archivos.map((x) => x.id)).not.toContain(ajeno.id)
      expect(JSON.stringify(todos)).not.toContain('clientes/')
      const uno = (await (await llamar({ token: tokenB, archivo_id: ajeno.id })).json()) as { archivos: unknown[] }
      expect(uno.archivos).toEqual([])
      // Token revocado: mismo 404 genérico que uno inventado
      const nuevo = ok(await v2.rpc('crear_enlace_portal', { p_tipo: 'pedido', p_id: pedB, p_nuevo: true })) as { id: string; token: string }
      ok(await v2.rpc('revocar_enlace_portal', { p_enlace: nuevo.id }))
      const revocado = await llamar({ token: nuevo.token })
      const inventado = await llamar({ token: 'Z'.repeat(43) })
      expect([revocado.status, inventado.status]).toEqual([404, 404])
      expect(await revocado.json()).toEqual(await inventado.json())
    })
  })
})
