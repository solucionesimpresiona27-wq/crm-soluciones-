/** MÓDULO ADMINISTRACIÓN · implementación real (Supabase + función admin-usuarios). */
import { limpio, mensajeError, revisar, supabase, textoBusqueda } from '@/data/comun/real'
import type { Json, TablesUpdate } from '@/lib/database.types'
import type { Permiso, Perfil } from '@/data/tipos'
import type { ApiAdministracion, Usuario } from './contrato'

const TIPOS_LOGO = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']

/** Llama a la función del servidor que administra cuentas (usa la sesión del administrador). */
async function invocarAdmin<T>(cuerpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase().functions.invoke('admin-usuarios', { body: cuerpo })
  if (error) {
    // La función responde {error: "mensaje"}; supabase-js lo deja en error.context (Response)
    const respuesta = (error as { context?: Response }).context
    let mensaje = ''
    try {
      mensaje = respuesta ? ((await respuesta.clone().json()) as { error?: string }).error ?? '' : ''
    } catch {
      mensaje = ''
    }
    throw new Error(mensaje || mensajeError(error))
  }
  return data as T
}

function aUsuario(p: Perfil): Usuario {
  const permisos = (p.permisos && typeof p.permisos === 'object' && !Array.isArray(p.permisos) ? p.permisos : {}) as Partial<Record<Permiso, boolean>>
  return { ...p, permisos_personalizados: { ...permisos } }
}

/**
 * Correo, teléfono, permisos, comisión y último acceso no se leen de la tabla `perfiles`
 * (privilegio por columna): la vista `perfiles_detalle` da el propio perfil o, a administración, todos.
 */
async function obtenerUsuario(id: string) {
  return aUsuario(revisar(await supabase().from('perfiles_detalle').select('*').eq('id', id).single()) as Perfil)
}

export const administracionSupabase: ApiAdministracion = {
  configuracion: {
    async obtener() {
      return revisar(await supabase().from('configuracion').select('*').eq('id', 1).single())
    },
    async guardar(cambios) {
      const { id: _i, updated_at: _u, ...resto } = cambios as Record<string, unknown>
      return revisar(await supabase().from('configuracion').update(resto as TablesUpdate<'configuracion'>).eq('id', 1).select('*').single())
    },
    async subirLogo(archivo) {
      if (!TIPOS_LOGO.includes(archivo.type)) throw new Error('El logo debe ser PNG, JPG, WebP o SVG')
      if (archivo.size > 2 * 1024 * 1024) throw new Error('El logo pesa más de 2 MB. Usa una versión más ligera.')
      const sb = supabase()
      const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg' }[archivo.type]
      const ruta = `logo-${Date.now()}.${extension}`
      const subida = await sb.storage.from('marca').upload(ruta, archivo, { contentType: archivo.type, upsert: false })
      if (subida.error) throw new Error(mensajeError(subida.error))
      const url = sb.storage.from('marca').getPublicUrl(ruta).data.publicUrl
      return revisar(await sb.from('configuracion').update({ logo_url: url }).eq('id', 1).select('*').single())
    },
    async quitarLogo() {
      return revisar(await supabase().from('configuracion').update({ logo_url: null }).eq('id', 1).select('*').single())
    },
  },

  plantillas: {
    async listar() {
      return revisar(await supabase().from('plantillas_mensaje').select('*').eq('activo', true).order('orden'))
    },
    async todas() {
      return revisar(await supabase().from('plantillas_mensaje').select('*').order('orden'))
    },
    async guardar(id, cambios) {
      const f: TablesUpdate<'plantillas_mensaje'> = {}
      if (cambios.nombre !== undefined) f.nombre = cambios.nombre.trim()
      if (cambios.texto !== undefined) {
        if (!cambios.texto.trim()) throw new Error('El mensaje no puede quedar vacío')
        f.texto = cambios.texto
      }
      if (cambios.activo !== undefined) f.activo = cambios.activo
      if (cambios.orden !== undefined) f.orden = cambios.orden
      return revisar(await supabase().from('plantillas_mensaje').update(f).eq('id', id).select('*').single())
    },
    async crear(datos) {
      const clave = textoBusqueda(datos.clave).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
      if (!clave) throw new Error('Escribe una clave para la plantilla')
      if (!datos.texto?.trim()) throw new Error('El mensaje no puede quedar vacío')
      return revisar(
        await supabase()
          .from('plantillas_mensaje')
          .insert({ clave, nombre: datos.nombre.trim(), contexto: datos.contexto, texto: datos.texto, orden: datos.orden ?? 200 })
          .select('*')
          .single(),
      )
    },
  },

  usuarios: {
    async equipo() {
      // Solo lo que cualquiera del equipo puede ver de los demás
      return revisar(await supabase().from('perfiles').select('id, nombre, rol, puesto').eq('activo', true).order('nombre'))
    },
    async listar() {
      const filas = revisar(await supabase().from('perfiles_detalle').select('*').order('activo', { ascending: false }).order('nombre'))
      return filas.map((f) => aUsuario(f as Perfil))
    },
    async crear(datos) {
      return invocarAdmin<{ id: string }>({
        accion: 'crear',
        email: datos.email.trim().toLowerCase(),
        password: datos.password,
        nombre: datos.nombre.trim(),
        rol: datos.rol,
        telefono: limpio(datos.telefono),
        puesto: limpio(datos.puesto),
      })
    },
    async actualizar(id, cambios) {
      const f: TablesUpdate<'perfiles'> = {}
      if (cambios.nombre !== undefined) {
        if (!cambios.nombre.trim()) throw new Error('Escribe el nombre')
        f.nombre = cambios.nombre.trim()
      }
      if (cambios.telefono !== undefined) f.telefono = limpio(cambios.telefono)
      if (cambios.puesto !== undefined) f.puesto = limpio(cambios.puesto)
      if (cambios.rol !== undefined) f.rol = cambios.rol
      if (cambios.comision_pct !== undefined) {
        if (cambios.comision_pct < 0 || cambios.comision_pct > 100) throw new Error('La comisión debe estar entre 0 y 100 %')
        f.comision_pct = cambios.comision_pct
      }
      revisar(await supabase().from('perfiles').update(f).eq('id', id).select('id').single())
      return obtenerUsuario(id)
    },
    async cambiarPermisos(id, permisos) {
      const actual = await obtenerUsuario(id)
      const nuevos: Record<string, boolean> = { ...actual.permisos_personalizados } as Record<string, boolean>
      for (const [k, v] of Object.entries(permisos)) {
        if (v === null || v === undefined) delete nuevos[k]
        else nuevos[k] = v
      }
      revisar(await supabase().from('perfiles').update({ permisos: nuevos as NonNullable<Json> }).eq('id', id).select('id').single())
      return obtenerUsuario(id)
    },
    async activar(id, activo) {
      await invocarAdmin({ accion: activo ? 'activar' : 'desactivar', id })
    },
    async restablecerContrasena(id, password) {
      await invocarAdmin({ accion: 'restablecer_password', id, password })
    },
    async cambiarEmail(id, email) {
      await invocarAdmin({ accion: 'cambiar_email', id, email: email.trim().toLowerCase() })
    },
  },

  bitacora: {
    async listar(filtros = {}) {
      let q = supabase().from('bitacora').select('*')
      if (filtros.tabla) q = q.eq('tabla', filtros.tabla)
      if (filtros.usuarioId) q = q.eq('usuario_id', filtros.usuarioId)
      if (filtros.registroId) q = q.eq('registro_id', filtros.registroId)
      if (filtros.accion) q = q.eq('accion', filtros.accion)
      if (filtros.desde) q = q.gte('created_at', `${filtros.desde}T00:00:00`)
      if (filtros.hasta) q = q.lte('created_at', `${filtros.hasta}T23:59:59`)
      if (filtros.antesDe) q = q.lt('id', filtros.antesDe)
      const t = filtros.texto?.trim().replace(/[%,()*]/g, ' ')
      if (t) q = q.ilike('etiqueta', `%${t}%`)
      return revisar(await q.order('id', { ascending: false }).limit(Math.min(filtros.limite ?? 100, 500)))
    },
  },
}

