/** MÓDULO ADMINISTRACIÓN · implementación de la vista previa (almacén en memoria, datos ficticios). */
import { almacen as a, copia, nuevoId } from '@/data/demo/almacen'
import { ahoraISO, diferencias, fechaLocal, registrarBitacora } from '@/data/demo/reglas'
import { espera, exigirAdmin, usuario } from '@/data/demo/sesion'
import type { Perfil, Permiso } from '@/data/tipos'
import { normalizar } from '@/lib/utils'
import type { ApiAdministracion, Usuario } from './contrato'

const TIPOS_LOGO = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
const limpio = (v: string | null | undefined) => (v?.trim() ? v.trim() : null)
const passwordValida = (p: string) => p.length >= 8 && /[a-zA-Z]/.test(p) && /\d/.test(p)

function aUsuario(p: Perfil): Usuario {
  const permisos = (p.permisos && typeof p.permisos === 'object' && !Array.isArray(p.permisos) ? p.permisos : {}) as Partial<Record<Permiso, boolean>>
  return copia({ ...p, permisos_personalizados: { ...permisos } })
}

function perfil(id: string) {
  const p = a.perfiles.find((x) => x.id === id)
  if (!p) throw new Error('Usuario no encontrado')
  return p
}

/** Igual que tg_perfiles_proteger(): siempre debe quedar un administrador activo. */
function validarAdmins(p: Perfil, rol: Perfil['rol'], activo: boolean) {
  if (p.rol === 'admin' && p.activo && (rol !== 'admin' || !activo) && !a.perfiles.some((x) => x.id !== p.id && x.rol === 'admin' && x.activo)) {
    throw new Error('Debe existir al menos un administrador activo')
  }
}

export const administracionDemo: ApiAdministracion = {
  configuracion: {
    async obtener() {
      return copia(a.configuracion)
    },
    async guardar(cambios) {
      const s = exigirAdmin()
      await espera(300)
      const { id: _i, updated_at: _u, ...resto } = cambios as Record<string, unknown>
      const antes = { ...a.configuracion }
      Object.assign(a.configuracion, resto, { updated_at: ahoraISO() })
      registrarBitacora(a, { tabla: 'configuracion', registro_id: '1', accion: 'modificar', etiqueta: 'Configuración del negocio', cambios: diferencias(antes, a.configuracion), usuario_id: s.id })
      return copia(a.configuracion)
    },
    async subirLogo(archivo) {
      const s = exigirAdmin()
      await espera(400)
      if (!TIPOS_LOGO.includes(archivo.type)) throw new Error('El logo debe ser PNG, JPG, WebP o SVG')
      if (archivo.size > 2 * 1024 * 1024) throw new Error('El logo pesa más de 2 MB. Usa una versión más ligera.')
      // El logo se queda en la memoria del navegador: nada se sube a ningún servidor.
      a.configuracion.logo_url = URL.createObjectURL(archivo)
      a.configuracion.updated_at = ahoraISO()
      registrarBitacora(a, { tabla: 'configuracion', registro_id: '1', accion: 'modificar', etiqueta: 'Configuración del negocio', cambios: { logo_url: [null, 'logo nuevo'] }, usuario_id: s.id })
      return copia(a.configuracion)
    },
    async quitarLogo() {
      exigirAdmin()
      a.configuracion.logo_url = null
      a.configuracion.updated_at = ahoraISO()
      return copia(a.configuracion)
    },
  },

  plantillas: {
    async listar() {
      return copia(a.plantillas.filter((p) => p.activo).sort((x, y) => x.orden - y.orden))
    },
    async todas() {
      exigirAdmin()
      return copia([...a.plantillas].sort((x, y) => x.orden - y.orden))
    },
    async guardar(id, cambios) {
      const s = exigirAdmin()
      const p = a.plantillas.find((x) => x.id === id)
      if (!p) throw new Error('Plantilla no encontrada')
      if (cambios.texto !== undefined && !cambios.texto.trim()) throw new Error('El mensaje no puede quedar vacío')
      const antes = { ...p }
      if (cambios.nombre !== undefined) p.nombre = cambios.nombre.trim()
      if (cambios.texto !== undefined) p.texto = cambios.texto
      if (cambios.activo !== undefined) p.activo = cambios.activo
      if (cambios.orden !== undefined) p.orden = cambios.orden
      p.updated_at = ahoraISO()
      registrarBitacora(a, { tabla: 'plantillas_mensaje', registro_id: id, accion: 'modificar', etiqueta: p.nombre, cambios: diferencias(antes, p), usuario_id: s.id })
      return copia(p)
    },
    async crear(datos) {
      const s = exigirAdmin()
      const clave = normalizar(datos.clave).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
      if (!clave) throw new Error('Escribe una clave para la plantilla')
      if (a.plantillas.some((p) => p.clave === clave)) throw new Error('Ya existe un registro con esos datos')
      if (!datos.texto?.trim()) throw new Error('El mensaje no puede quedar vacío')
      const ahora = ahoraISO()
      const p = { id: nuevoId('p'), clave, nombre: datos.nombre.trim(), contexto: datos.contexto, texto: datos.texto, orden: datos.orden ?? 200, activo: true, created_at: ahora, updated_at: ahora }
      a.plantillas.push(p)
      registrarBitacora(a, { tabla: 'plantillas_mensaje', registro_id: p.id, accion: 'crear', etiqueta: p.nombre, usuario_id: s.id })
      return copia(p)
    },
  },

  usuarios: {
    async equipo() {
      return a.perfiles
        .filter((p) => p.activo)
        .sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'))
        .map(({ id, nombre, rol, email, telefono }) => ({ id, nombre, rol, email, telefono }))
    },
    async listar() {
      exigirAdmin()
      await espera(200)
      return [...a.perfiles].sort((x, y) => Number(y.activo) - Number(x.activo) || x.nombre.localeCompare(y.nombre, 'es')).map(aUsuario)
    },
    async crear(datos) {
      const s = exigirAdmin()
      await espera(500)
      const email = datos.email.trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Correo inválido')
      if (!datos.nombre?.trim()) throw new Error('Escribe el nombre')
      if (!passwordValida(datos.password)) throw new Error('La contraseña debe tener al menos 8 caracteres, con letras y números')
      if (a.perfiles.some((p) => p.email === email)) throw new Error('Ya existe un usuario con ese correo')
      const ahora = ahoraISO()
      const p: Perfil = {
        id: nuevoId('demo-usuario'),
        nombre: datos.nombre.trim(),
        email,
        rol: datos.rol,
        telefono: limpio(datos.telefono),
        puesto: limpio(datos.puesto),
        activo: true,
        permisos: {},
        comision_pct: 0,
        ultimo_acceso: null,
        created_at: ahora,
        updated_at: ahora,
      }
      a.perfiles.push(p)
      registrarBitacora(a, { tabla: 'perfiles', registro_id: p.id, accion: 'crear', etiqueta: p.nombre, usuario_id: s.id })
      return { id: p.id }
    },
    async actualizar(id, cambios) {
      const s = usuario()
      const p = perfil(id)
      const admin = s.perfil.rol === 'admin'
      if (!admin && (s.id !== id || cambios.rol !== undefined || cambios.comision_pct !== undefined)) {
        throw new Error('Solo un administrador puede cambiar el rol, estado, permisos o comisión de un usuario')
      }
      if (cambios.nombre !== undefined && !cambios.nombre.trim()) throw new Error('Escribe el nombre')
      if (cambios.comision_pct !== undefined && (cambios.comision_pct < 0 || cambios.comision_pct > 100)) throw new Error('La comisión debe estar entre 0 y 100 %')
      if (cambios.rol !== undefined) validarAdmins(p, cambios.rol, p.activo)
      const antes = { ...p }
      if (cambios.nombre !== undefined) p.nombre = cambios.nombre.trim()
      if (cambios.telefono !== undefined) p.telefono = limpio(cambios.telefono)
      if (cambios.puesto !== undefined) p.puesto = limpio(cambios.puesto)
      if (cambios.rol !== undefined) p.rol = cambios.rol
      if (cambios.comision_pct !== undefined) p.comision_pct = cambios.comision_pct
      p.updated_at = ahoraISO()
      registrarBitacora(a, { tabla: 'perfiles', registro_id: id, accion: 'modificar', etiqueta: p.nombre, cambios: diferencias(antes, p), usuario_id: s.id })
      return aUsuario(p)
    },
    async cambiarPermisos(id, permisos) {
      const s = exigirAdmin()
      const p = perfil(id)
      const nuevos = { ...((p.permisos as Record<string, boolean>) ?? {}) }
      for (const [k, v] of Object.entries(permisos)) {
        if (v === null || v === undefined) delete nuevos[k]
        else nuevos[k] = v
      }
      registrarBitacora(a, { tabla: 'perfiles', registro_id: id, accion: 'modificar', etiqueta: p.nombre, cambios: { permisos: [p.permisos, nuevos] }, usuario_id: s.id })
      p.permisos = nuevos
      p.updated_at = ahoraISO()
      return aUsuario(p)
    },
    async activar(id, activo) {
      const s = exigirAdmin()
      const p = perfil(id)
      if (!activo && id === s.id) throw new Error('No puedes desactivar tu propia cuenta')
      validarAdmins(p, p.rol, activo)
      if (p.activo === activo) return
      p.activo = activo
      p.updated_at = ahoraISO()
      registrarBitacora(a, { tabla: 'perfiles', registro_id: id, accion: 'modificar', etiqueta: p.nombre, cambios: { activo: [!activo, activo] }, usuario_id: s.id })
    },
    async restablecerContrasena(id, password) {
      exigirAdmin()
      perfil(id)
      if (!passwordValida(password)) throw new Error('La contraseña debe tener al menos 8 caracteres, con letras y números')
      // En la vista previa no hay contraseñas reales: no se guarda nada.
    },
    async cambiarEmail(id, email) {
      exigirAdmin()
      const p = perfil(id)
      const nuevo = email.trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nuevo)) throw new Error('Correo inválido')
      if (a.perfiles.some((x) => x.id !== id && x.email === nuevo)) throw new Error('Ya existe un usuario con ese correo')
      p.email = nuevo
      p.updated_at = ahoraISO()
    },
  },

  bitacora: {
    async listar(filtros = {}) {
      exigirAdmin()
      await espera(200)
      const t = normalizar(filtros.texto ?? '')
      return copia(
        a.bitacora
          .filter((b) => !filtros.tabla || b.tabla === filtros.tabla)
          .filter((b) => !filtros.usuarioId || b.usuario_id === filtros.usuarioId)
          .filter((b) => !filtros.registroId || b.registro_id === filtros.registroId)
          .filter((b) => !filtros.accion || b.accion === filtros.accion)
          .filter((b) => (!filtros.desde || fechaLocal(b.created_at) >= filtros.desde) && (!filtros.hasta || fechaLocal(b.created_at) <= filtros.hasta))
          .filter((b) => !filtros.antesDe || b.id < filtros.antesDe)
          .filter((b) => !t || normalizar(b.etiqueta ?? '').includes(t))
          .sort((x, y) => y.id - x.id)
          .slice(0, Math.min(filtros.limite ?? 100, 500)),
      )
    },
  },
}
