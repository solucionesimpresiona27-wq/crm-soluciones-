import { expect, test } from '@playwright/test'
import { USUARIOS, entrar, vigilarErrores } from './ayuda'

test('administración ve ventas, cobranza y accesos directos', async ({ page }) => {
  const sinErrores = vigilarErrores(page)
  await entrar(page, 'admin')
  const nombre = USUARIOS.admin.nombre.split(' ')[0]
  await expect(page.getByRole('heading', { name: new RegExp(nombre) })).toBeVisible()
  const main = page.locator('main')
  await expect(main.getByText(/Ventas de /).first()).toBeVisible()
  await expect(main.getByText('Por cobrar').first()).toBeVisible()
  await expect(main.getByRole('button', { name: 'Nueva cotización' }).first()).toBeVisible()
  sinErrores()
})

test('el acceso directo Nueva cotización abre el editor', async ({ page }) => {
  await entrar(page, 'ventas')
  await page.locator('main').getByRole('button', { name: 'Nueva cotización' }).first().click()
  await expect(page).toHaveURL(/\/cotizaciones\/nueva$/)
})

for (const rol of ['produccion', 'diseno'] as const) {
  test(`${rol}: el panel muestra pedidos y agenda, nunca montos`, async ({ page }) => {
    const sinErrores = vigilarErrores(page)
    await entrar(page, rol)
    const main = page.locator('main')
    await expect(main.getByText('Producción').first()).toBeVisible()
    await expect(main.getByText('Agenda').first()).toBeVisible()
    await expect(main).not.toContainText('$')
    await expect(main.getByText(/Ventas de /)).toHaveCount(0)
    sinErrores()
  })
}
