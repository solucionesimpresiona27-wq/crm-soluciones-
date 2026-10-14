/**
 * Ayudas para las pruebas de las implementaciones demo (`src/data/modulos/<m>/demo.test.ts`).
 * Uso:
 *   beforeEach(() => entrarComo('ventas'))   // semilla nueva, fecha fija y sesión con ese rol
 *   afterEach(salir)
 */
import { vi } from 'vitest'
import type { Rol } from '../tipos'
import { reiniciarAlmacen } from './almacen'
import { cambiarRol } from './sesion'

/** Día fijo de las pruebas (las semillas son relativas a "hoy"). */
export const HOY_PRUEBAS = '2026-10-13'

/** Vuelve a la semilla con la fecha fija y entra con el rol indicado (null = sin sesión). */
export function entrarComo(rol: Rol | null, hoy = HOY_PRUEBAS) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(`${hoy}T18:30:00`))
  reiniciarAlmacen()
  cambiarRol(rol)
}

/** Cambia de rol sin reiniciar los datos (para probar permisos sobre lo ya creado). */
export const cambiarA = (rol: Rol | null) => cambiarRol(rol)

export function salir() {
  cambiarRol(null)
  vi.useRealTimers()
}
