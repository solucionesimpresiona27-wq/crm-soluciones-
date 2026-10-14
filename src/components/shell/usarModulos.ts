import { useSesion } from '@/app/sesion'
import { CATALOGO, MODULOS, type Modulo, type Seccion } from '@/app/navegacion'
import type { Permiso, SesionUsuario } from '@/data/tipos'

type Acceso = { soloAdmin?: boolean; permisos?: Permiso[] }

/** Regla del menú: solo administración o al menos uno de los permisos (igual que puede()). */
export function permitido(x: Acceso, sesion: SesionUsuario | null) {
  if (x.soloAdmin) return sesion?.perfil.rol === 'admin'
  return !x.permisos || x.permisos.some((p) => Boolean(sesion?.perfil.activo && sesion.permisos[p]))
}

/** Módulos que el usuario puede ver según su rol y permisos. */
export function useModulosVisibles(): Modulo[] {
  const { sesion } = useSesion()
  return MODULOS.filter((m) => permitido(m, sesion))
}

export function moduloDeRuta(ruta: string): Modulo | undefined {
  if (ruta === '/') return MODULOS[0]
  return [...MODULOS, CATALOGO].filter((m) => m.ruta !== '/').find((m) => ruta === m.ruta || ruta.startsWith(`${m.ruta}/`))
}

/** Sección del módulo que corresponde a la ruta (la más específica). */
export function seccionDeRuta(modulo: Modulo, ruta: string): Seccion | undefined {
  return [...(modulo.secciones ?? [])]
    .sort((a, b) => b.ruta.length - a.ruta.length)
    .find((s) => ruta === s.ruta || ruta.startsWith(`${s.ruta}/`))
}

/** ¿Puede el usuario abrir esta ruta? (módulo y sección; las rutas fuera de módulos se permiten). */
export function puedeAbrir(ruta: string, sesion: SesionUsuario | null) {
  const m = moduloDeRuta(ruta)
  if (!m) return true
  if (!permitido(m, sesion)) return false
  const s = seccionDeRuta(m, ruta)
  return !s || permitido(s, sesion)
}

/** Pestañas del módulo que el usuario puede ver (para el menú interno de la página). */
export function useSeccionesVisibles(ruta: string): Seccion[] {
  const { sesion } = useSesion()
  const m = moduloDeRuta(ruta)
  return (m?.secciones ?? []).filter((s) => permitido(s, sesion))
}
