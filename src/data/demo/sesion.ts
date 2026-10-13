/**
 * Sesión y permisos de la VISTA PREVIA. La comparten el núcleo (`apiDemo.ts`) y las
 * implementaciones demo de los módulos (`src/data/modulos/<m>/demo.ts`).
 *
 * Igual que en la base de datos, cada acción exige su permiso: si el rol elegido no lo
 * tiene, se lanza el mismo mensaje que daría la app real.
 */
import { permisosDeRol } from '@/lib/permisos'
import type { Permiso, Rol, SesionUsuario } from '../tipos'
import { almacen } from './almacen'

const CLAVE_ROL = 'impresiona:demo-rol'
const oyentes = new Set<() => void>()
let rolActual: Rol | null = null

try {
  rolActual = (sessionStorage.getItem(CLAVE_ROL) as Rol | null) ?? null
} catch {
  rolActual = null
}

/** Pausa breve para que la vista previa se sienta como una app con servidor (sin pausa en pruebas). */
export const espera = (ms = 260) =>
  import.meta.env.MODE === 'test' ? Promise.resolve() : new Promise<void>((r) => setTimeout(r, ms))

export function sesionDemo(): SesionUsuario | null {
  if (!rolActual) return null
  const perfil = almacen.perfiles.find((p) => p.id === `demo-${rolActual}`)
  if (!perfil) return null
  return {
    id: perfil.id,
    email: perfil.email,
    perfil: structuredClone(perfil),
    permisos: permisosDeRol(rolActual, (perfil.permisos ?? {}) as Partial<Record<Permiso, boolean>>),
  }
}

/** Sesión obligatoria (la app real responde "No autorizado" sin sesión). */
export function usuario(): SesionUsuario {
  const s = sesionDemo()
  if (!s) throw new Error('Sesión requerida')
  return s
}

export const puede = (p: Permiso) => Boolean(sesionDemo()?.permisos[p])
export const esAdmin = () => sesionDemo()?.perfil.rol === 'admin'

/** Exige TODOS los permisos indicados. */
export function exigir(...permisos: Permiso[]) {
  const s = usuario()
  if (!permisos.every((p) => s.permisos[p])) throw new Error('No tienes permiso para realizar esta acción')
  return s
}

/** Exige AL MENOS UNO de los permisos indicados. */
export function exigirAlguno(...permisos: Permiso[]) {
  const s = usuario()
  if (!permisos.some((p) => s.permisos[p])) throw new Error('No tienes permiso para realizar esta acción')
  return s
}

export function exigirAdmin() {
  const s = usuario()
  if (s.perfil.rol !== 'admin') throw new Error('Solo un administrador puede hacer esto')
  return s
}

export function cambiarRol(rol: Rol | null) {
  rolActual = rol
  try {
    if (rol) sessionStorage.setItem(CLAVE_ROL, rol)
    else sessionStorage.removeItem(CLAVE_ROL)
  } catch {
    /* sin almacenamiento: la sesión dura mientras la página esté abierta */
  }
  oyentes.forEach((cb) => cb())
}

export function alCambiarSesion(cb: () => void) {
  oyentes.add(cb)
  return () => {
    oyentes.delete(cb)
  }
}
