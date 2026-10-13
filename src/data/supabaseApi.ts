import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'
import type { Api } from './api'
import { PERMISOS, type CotizacionCompleta, type CotizacionLista, type DashboardResumen, type PartidaDoc, type Permisos, type ProductoCatalogo, type ResultadoBusqueda } from './tipos'

/** Convierte errores de Supabase/Postgres en mensajes claros para el usuario. */
export function mensajeError(error: unknown): string {
  if (!error) return 'Ocurrió un error inesperado'
  const e = error as { message?: string; code?: string; details?: string }
  const msg = e.message ?? String(error)
  if (/Invalid login credentials/i.test(msg)) return 'Correo o contraseña incorrectos'
  if (/Email not confirmed/i.test(msg)) return 'Confirma tu correo antes de entrar'
  if (/User is banned/i.test(msg)) return 'Tu cuenta está desactivada. Habla con el administrador.'
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return 'Sin conexión con el servidor. Revisa tu internet.'
  if (e.code === '42501' || /row-level security/i.test(msg)) return msg.includes('permiso') ? msg : 'No tienes permiso para realizar esta acción'
  if (e.code === '23503') return 'No se puede completar porque hay información relacionada'
  if (e.code === '23505') return 'Ya existe un registro con esos datos'
  return msg
}

function revisar<T>(r: { data: T | null; error: unknown }): T {
  if (r.error) throw new Error(mensajeError(r.error))
  if (r.data === null) throw new Error('No se encontró la información solicitada')
  return r.data
}

const n = (v: unknown) => (v === null || v === undefined ? 0 : Number(v))
const nn = (v: unknown) => (v === null || v === undefined ? null : Number(v))

function aPartida(p: Record<string, unknown>): PartidaDoc {
  const c = (p.partida_costos ?? null) as Record<string, unknown> | null
  return {
    id: p.id as string,
    orden: n(p.orden),
    tipo: p.tipo as PartidaDoc['tipo'],
    producto_id: (p.producto_id as string) ?? null,
    concepto: p.concepto as string,
    descripcion: (p.descripcion as string) ?? null,
    metodo_calculo: p.metodo_calculo as PartidaDoc['metodo_calculo'],
    unidad: p.unidad as string,
    ancho: nn(p.ancho),
    alto: nn(p.alto),
    largo: nn(p.largo),
    cantidad: n(p.cantidad),
    precio_unitario: n(p.precio_unitario),
    descuento_pct: n(p.descuento_pct),
    importe: n(p.importe),
    notas_produccion: (p.notas_produccion as string) ?? null,
    costos: c
      ? {
          costo_material: n(c.costo_material),
          costo_mano_obra: n(c.costo_mano_obra),
          costo_fijo: n(c.costo_fijo),
          desperdicio_pct: n(c.desperdicio_pct),
          ganancia_pct: n(c.ganancia_pct),
          costo_total: n(c.costo_total),
          calculo: (c.calculo as Record<string, unknown>) ?? {},
        }
      : null,
  }
}

export const apiSupabase: Api = {
  sesion: {
    async actual() {
      const sb = supabase()
      const { data } = await sb.auth.getSession()
      const user = data.session?.user
      if (!user) return null
      const [perfil, permisos] = await Promise.all([
        sb.from('perfiles').select('*').eq('id', user.id).maybeSingle(),
        sb.rpc('mis_permisos'),
      ])
      if (perfil.error) throw new Error(mensajeError(perfil.error))
      if (!perfil.data) return null
      const p = (permisos.data ?? {}) as Record<string, boolean>
      return {
        id: user.id,
        email: user.email ?? '',
        perfil: perfil.data,
        permisos: Object.fromEntries(PERMISOS.map((k) => [k, Boolean(p[k])])) as Permisos,
      }
    },
    async iniciar(email, password) {
      const sb = supabase()
      const { error } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
      if (error) throw new Error(mensajeError(error))
      await sb.rpc('registrar_acceso')
    },
    async cerrar() {
      await supabase().auth.signOut()
    },
    async recuperar(email) {
      const destino = `${window.location.origin}/nueva-contrasena`
      const { error } = await supabase().auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: destino })
      if (error) throw new Error(mensajeError(error))
    },
    async nuevaContrasena(password) {
      const { error } = await supabase().auth.updateUser({ password })
      if (error) throw new Error(mensajeError(error))
    },
    alCambiar(cb) {
      const { data } = supabase().auth.onAuthStateChange((evento) => {
        if (evento === 'SIGNED_IN' || evento === 'SIGNED_OUT' || evento === 'USER_UPDATED') cb()
      })
      return () => data.subscription.unsubscribe()
    },
  },

  configuracion: {
    async obtener() {
      return revisar(await supabase().from('configuracion').select('*').eq('id', 1).single())
    },
  },

  plantillas: {
    async listar() {
      return revisar(await supabase().from('plantillas_mensaje').select('*').eq('activo', true).order('orden'))
    },
  },

  usuarios: {
    async equipo() {
      return revisar(
        await supabase().from('perfiles').select('id, nombre, rol, email, telefono').eq('activo', true).order('nombre'),
      )
    },
  },

  dashboard: {
    async resumen() {
      return revisar(await supabase().rpc('dashboard_resumen')) as unknown as DashboardResumen
    },
  },

  busqueda: {
    async global(texto) {
      return revisar(await supabase().rpc('busqueda_global', { p_texto: texto })) as unknown as ResultadoBusqueda
    },
  },

  clientes: {
    async buscar(texto) {
      const sb = supabase()
      let q = sb.from('clientes').select('id, nombre, whatsapp, telefono, email, requiere_factura').eq('activo', true)
      const t = texto
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[%,()]/g, ' ')
      if (t) q = q.ilike('busqueda', `%${t}%`)
      return revisar(await q.order('nombre').limit(20))
    },
    async crear(datos) {
      return revisar(
        await supabase()
          .from('clientes')
          .insert({
            nombre: datos.nombre.trim(),
            whatsapp: datos.whatsapp?.trim() || null,
            email: datos.email?.trim() || null,
            tipo: datos.tipo ?? 'empresa',
            requiere_factura: datos.requiere_factura ?? false,
            rfc: datos.rfc?.trim().toUpperCase() || null,
            razon_social: datos.razon_social?.trim() || null,
          })
          .select('id, nombre, whatsapp, telefono, email, requiere_factura')
          .single(),
      )
    },
  },

  catalogo: {
    async productos() {
      const sb = supabase()
      const [productos, costos] = await Promise.all([
        sb
          .from('productos')
          .select('id, nombre, descripcion, metodo_calculo, unidad, precio_venta, precio_minimo, escalas, categoria:categorias(id, nombre, grupo, orden)')
          .eq('activo', true)
          .order('nombre'),
        sb.from('producto_costos').select('*'),
      ])
      const lista = revisar(productos)
      const mapaCostos = new Map((costos.data ?? []).map((c) => [c.producto_id, c]))
      return lista.map((p): ProductoCatalogo => {
        const c = mapaCostos.get(p.id)
        return {
          id: p.id,
          nombre: p.nombre,
          descripcion: p.descripcion,
          metodo_calculo: p.metodo_calculo,
          unidad: p.unidad,
          precio_venta: nn(p.precio_venta),
          precio_minimo: nn(p.precio_minimo),
          escalas: Array.isArray(p.escalas) ? (p.escalas as { desde: number; precio: number }[]) : [],
          categoria: p.categoria ? { id: p.categoria.id, nombre: p.categoria.nombre, grupo: p.categoria.grupo } : null,
          costos: c
            ? {
                costo_material: n(c.costo_material),
                costo_mano_obra: n(c.costo_mano_obra),
                costo_fijo: n(c.costo_fijo),
                desperdicio_pct: n(c.desperdicio_pct),
                ganancia_pct: n(c.ganancia_pct),
              }
            : null,
        }
      })
    },
  },

  cotizaciones: {
    async listar() {
      const datos = revisar(
        await supabase()
          .from('cotizaciones')
          .select(
            'id, folio, titulo, fecha, fecha_vencimiento, estado, total, pedido_id, enviada_at, created_at, cliente:clientes(id, nombre, whatsapp, telefono), vendedor:perfiles!vendedor_id(nombre)',
          )
          .order('created_at', { ascending: false })
          .limit(500),
      )
      return datos.map((c) => ({ ...c, total: n(c.total) })) as unknown as CotizacionLista[]
    },

    async obtener(id) {
      const sb = supabase()
      const c = revisar(
        await sb
          .from('cotizaciones')
          .select(
            '*, cliente:clientes(id, nombre, whatsapp, telefono, email, rfc, razon_social, direccion, ciudad, requiere_factura), vendedor:perfiles!vendedor_id(id, nombre, email, telefono), pedido:pedidos!cotizaciones_pedido_fk(folio), partidas(*, partida_costos(*))',
          )
          .eq('id', id)
          .order('orden', { referencedTable: 'partidas' })
          .single(),
      ) as unknown as Record<string, unknown>
      const numericos = ['vigencia_dias', 'anticipo_pct', 'iva_pct', 'descuento_valor', 'recargo_pct', 'subtotal', 'descuento', 'recargo', 'iva', 'total']
      const r = { ...c } as Record<string, unknown>
      for (const k of numericos) r[k] = n(c[k])
      r.partidas = ((c.partidas as Record<string, unknown>[]) ?? []).map(aPartida)
      r.pedido_folio = (c.pedido as { folio: string } | null)?.folio ?? null
      delete r.pedido
      return r as unknown as CotizacionCompleta
    },

    async guardar(borrador) {
      const r = revisar(await supabase().rpc('guardar_cotizacion', { p_datos: borrador as unknown as Json }))
      return r as unknown as { id: string; folio: string }
    },

    async cambiarEstado(id, estado, motivo) {
      revisar(
        await supabase()
          .from('cotizaciones')
          .update({ estado, motivo_rechazo: estado === 'rechazada' ? motivo ?? null : null })
          .eq('id', id),
      )
    },

    async duplicar(id) {
      return revisar(await supabase().rpc('duplicar_cotizacion', { p_cotizacion: id })) as string
    },

    async convertir(id, opciones) {
      const pedidoId = revisar(
        await supabase().rpc('convertir_cotizacion_a_pedido', {
          p_cotizacion: id,
          p_fecha_entrega: opciones.fechaEntrega ?? undefined,
          p_titulo: opciones.titulo ?? undefined,
        }),
      ) as string
      return { pedidoId }
    },

    async eliminar(id) {
      revisar(await supabase().from('cotizaciones').delete().eq('id', id))
    },

    async compartirPdf(id, folio, pdf, diasVigencia) {
      const sb = supabase()
      const ruta = `cotizaciones/${id}/${folio}.pdf`
      const subida = await sb.storage.from('documentos').upload(ruta, pdf, { upsert: true, contentType: 'application/pdf' })
      if (subida.error) throw new Error(mensajeError(subida.error))
      const registro = await sb.from('cotizaciones').update({ pdf_path: ruta }).eq('id', id)
      // No impide compartir: el enlace firmado funciona aunque no se haya registrado la ruta
      if (registro.error) console.warn('No se registró la ruta del PDF de la cotización:', mensajeError(registro.error))
      const firmado = await sb.storage.from('documentos').createSignedUrl(ruta, Math.max(1, diasVigencia) * 86400)
      return firmado.data?.signedUrl ?? null
    },
  },
}

export default apiSupabase
