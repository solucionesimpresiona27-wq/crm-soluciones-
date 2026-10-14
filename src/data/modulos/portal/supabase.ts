/**
 * MÓDULO PORTAL · implementación real.
 * Las funciones públicas usan un cliente de Supabase SIN sesión (rol anon), con su propia
 * llave de almacenamiento: aunque alguien del equipo tenga la sesión abierta en el mismo
 * navegador, el portal nunca envía su token. Solo usa la llave pública (anon).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { mensajeError, n, revisar, sinError, supabase } from '@/data/comun/real'
import type { Database } from '@/lib/database.types'
import { DEMO } from '@/lib/supabase'
import { ENLACE_NO_VALIDO, type ApiPortal, type ArchivoPortal, type EnlacePortal, type VistaPortal } from './contrato'

let publico: SupabaseClient<Database> | null = null

function clientePublico() {
  if (DEMO) throw new Error('Supabase no se usa en la vista previa')
  if (publico) return publico
  const url = import.meta.env.VITE_SUPABASE_URL
  const llave = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !llave) throw new Error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY. Revisa el archivo .env.local.')
  publico = createClient<Database>(url, llave, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'impresiona-portal-publico' },
  })
  return publico
}

/** Errores del portal: token inválido, vencido o revocado → mismo mensaje. */
function errorPortal(error: unknown): never {
  const e = error as { code?: string; status?: number; message?: string }
  if (e?.code === 'PT404' || e?.status === 404) throw new Error(ENLACE_NO_VALIDO)
  throw new Error(mensajeError(error))
}

const urlPublica = (token: string) => `${typeof window === 'undefined' ? '' : window.location.origin}/portal/${encodeURIComponent(token)}`

function aEnlace(f: Record<string, unknown>, folio: string, creadoPor: string | null): EnlacePortal {
  const e = f as unknown as EnlacePortal
  return {
    id: e.id,
    tipo: e.tipo,
    cotizacion_id: e.cotizacion_id,
    pedido_id: e.pedido_id,
    folio,
    token: e.token,
    url: urlPublica(e.token),
    expira_at: e.expira_at,
    revocado: e.revocado,
    revocado_at: e.revocado_at,
    vistas: n(e.vistas),
    ultimo_acceso_at: e.ultimo_acceso_at,
    created_by: e.created_by,
    creado_por: creadoPor,
    created_at: e.created_at,
    vigente: !e.revocado && new Date(e.expira_at).getTime() > Date.now(),
  }
}

const CAMPOS = 'id, tipo, cotizacion_id, pedido_id, token, expira_at, revocado, revocado_at, vistas, ultimo_acceso_at, created_by, created_at, cotizacion:cotizaciones(folio), pedido:pedidos(folio), autor:perfiles!created_by(nombre)'

function conFolio(f: Record<string, unknown>) {
  const { cotizacion, pedido, autor, ...resto } = f as Record<string, unknown> & {
    cotizacion: { folio: string } | null
    pedido: { folio: string } | null
    autor: { nombre: string } | null
  }
  return aEnlace(resto, cotizacion?.folio ?? pedido?.folio ?? '', autor?.nombre ?? null)
}

export const portalSupabase: ApiPortal = {
  portal: {
    async enlaces({ cotizacionId, pedidoId }) {
      const sb = supabase()
      const condiciones: string[] = []
      if (cotizacionId) condiciones.push(`cotizacion_id.eq.${cotizacionId}`)
      if (pedidoId) {
        condiciones.push(`pedido_id.eq.${pedidoId}`)
        const ped = await sb.from('pedidos').select('cotizacion_id').eq('id', pedidoId).maybeSingle()
        if (ped.data?.cotizacion_id) condiciones.push(`cotizacion_id.eq.${ped.data.cotizacion_id}`)
      }
      if (!condiciones.length) return []
      const filas = revisar(await sb.from('portal_enlaces').select(CAMPOS).or(condiciones.join(',')).order('created_at', { ascending: false }))
      return filas.map((f) => conFolio(f as unknown as Record<string, unknown>))
    },

    async crearEnlace(tipo, id, opciones = {}) {
      const sb = supabase()
      const r = revisar(
        await sb.rpc('crear_enlace_portal', { p_tipo: tipo, p_id: id, ...(opciones.dias ? { p_dias: opciones.dias } : {}), ...(opciones.nuevo ? { p_nuevo: true } : {}) }),
      ) as unknown as { id: string; nuevo: boolean }
      const fila = revisar(await sb.from('portal_enlaces').select(CAMPOS).eq('id', r.id).single())
      return { ...conFolio(fila as unknown as Record<string, unknown>), nuevo: r.nuevo }
    },

    async revocarEnlace(id) {
      sinError(await supabase().rpc('revocar_enlace_portal', { p_enlace: id }))
    },

    async respuestas({ cotizacionId, pedidoId }) {
      let q = supabase().from('portal_respuestas').select('*')
      if (cotizacionId) q = q.eq('cotizacion_id', cotizacionId)
      if (pedidoId) q = q.eq('pedido_id', pedidoId)
      return revisar(await q.order('created_at', { ascending: false }).limit(200))
    },

    urlPublica,

    async obtener(token) {
      // POST (predeterminado de supabase-js): portal_obtener cuenta las visitas
      const r = await clientePublico().rpc('portal_obtener', { p_token: token })
      if (r.error) errorPortal(r.error)
      return r.data as unknown as VistaPortal
    },

    async aprobarCotizacion(token, nombre, comentario) {
      const r = await clientePublico().rpc('portal_aprobar_cotizacion', { p_token: token, p_nombre: nombre, ...(comentario?.trim() ? { p_comentario: comentario.trim() } : {}) })
      if (r.error) errorPortal(r.error)
      return r.data as unknown as { ok: true; folio: string; estado: 'aceptada' }
    },

    async responderDiseno(token, archivoId, aprobado, nombre, comentario) {
      const r = await clientePublico().rpc('portal_responder_diseno', {
        p_token: token,
        p_archivo_id: archivoId,
        p_aprobado: aprobado,
        p_nombre: nombre,
        ...(comentario?.trim() ? { p_comentario: comentario.trim() } : {}),
      })
      if (r.error) errorPortal(r.error)
      return r.data as unknown as Awaited<ReturnType<ApiPortal['portal']['responderDiseno']>>
    },

    async archivos(token, archivoId) {
      const { data, error } = await clientePublico().functions.invoke('portal-cliente', { body: { token, ...(archivoId ? { archivo_id: archivoId } : {}) } })
      if (error) {
        const respuesta = (error as { context?: Response }).context
        if (respuesta?.status === 404) throw new Error(ENLACE_NO_VALIDO)
        let mensaje = ''
        try {
          mensaje = respuesta ? ((await respuesta.clone().json()) as { error?: string }).error ?? '' : ''
        } catch {
          mensaje = ''
        }
        throw new Error(mensaje || 'No se pudieron preparar los archivos. Intenta de nuevo en unos minutos.')
      }
      return ((data as { archivos?: ArchivoPortal[] })?.archivos ?? []) as ArchivoPortal[]
    },
  },
}
