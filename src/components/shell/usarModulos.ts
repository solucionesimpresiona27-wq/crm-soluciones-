import { useSesion } from '@/app/sesion'
import { MODULOS, type Modulo } from '@/app/navegacion'

/** Módulos que el usuario puede ver según su rol y permisos. */
export function useModulosVisibles(): Modulo[] {
  const { sesion, puede } = useSesion()
  const admin = sesion?.perfil.rol === 'admin'
  return MODULOS.filter((m) => (m.soloAdmin ? admin : !m.permisos || m.permisos.some((p) => puede(p))))
}

export function moduloDeRuta(ruta: string): Modulo | undefined {
  if (ruta === '/') return MODULOS[0]
  return MODULOS.filter((m) => m.ruta !== '/').find((m) => ruta === m.ruta || ruta.startsWith(`${m.ruta}/`))
}
