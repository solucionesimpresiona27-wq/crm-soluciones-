import { expect, type Page } from '@playwright/test'

export const USUARIOS = {
  admin: { email: 'admin@impresiona.local', password: 'Impresiona2026', nombre: 'Ana Ramírez' },
  ventas: { email: 'ventas@impresiona.local', password: 'Impresiona2026', nombre: 'Luis Herrera' },
  diseno: { email: 'diseno@impresiona.local', password: 'Impresiona2026', nombre: 'Sofía Méndez' },
  produccion: { email: 'produccion@impresiona.local', password: 'Impresiona2026', nombre: 'Jorge Castillo' },
} as const

export type Rol = keyof typeof USUARIOS

export async function entrar(page: Page, rol: Rol) {
  const u = USUARIOS[rol]
  await page.goto('/login')
  await page.getByLabel('Correo').fill(u.email)
  await page.getByLabel('Contraseña', { exact: true }).fill(u.password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

/** Falla la prueba si la página registra errores de JavaScript. */
export function vigilarErrores(page: Page) {
  const errores: string[] = []
  page.on('pageerror', (e) => errores.push(e.message))
  return () => expect(errores, `Errores de JavaScript: ${errores.join(' | ')}`).toEqual([])
}
