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

test('la búsqueda global encuentra módulos y abre el detalle del cliente', async ({ page }) => {
  const sinErrores = vigilarErrores(page)
  await entrar(page, 'admin')
  await expect(page.getByRole('heading', { level: 1, name: 'Inicio' })).toBeVisible()
  await page.keyboard.press('Control+k')
  const buscar = page.getByPlaceholder('Busca un cliente, folio o módulo')
  await buscar.fill('cobros')
  await page.getByRole('option', { name: /Pagos/ }).click()
  await expect(page).toHaveURL(/\/pagos$/)

  // La búsqueda es asíncrona: se reintenta hasta que el clic cae en un resultado ya estable
  await expect(async () => {
    if (!(await buscar.isVisible())) await page.keyboard.press('Control+k')
    await buscar.fill('cliente')
    await page.locator('[cmdk-group]', { hasText: 'Clientes' }).getByRole('option').first().click({ timeout: 3000 })
    await expect(page).toHaveURL(/\/clientes\/[0-9a-f-]{36}$/, { timeout: 3000 })
  }).toPass({ timeout: 20_000 })
  sinErrores()
})

test.describe('celular', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

  test('la barra inferior solo ofrece lo que el rol puede abrir', async ({ page }) => {
    await entrar(page, 'diseno')
    const barra = page.getByRole('navigation', { name: 'Navegación principal' })
    await expect(barra.getByRole('link', { name: 'Cotizar' })).toHaveCount(0)
    await barra.getByRole('link', { name: 'Producción' }).click()
    await expect(page).toHaveURL(/\/produccion$/)
  })

  test('administración cotiza desde la barra inferior y el panel no se desborda', async ({ page }) => {
    await entrar(page, 'admin')
    await expect(page.getByText('Por cobrar').first()).toBeVisible()
    // Las cifras terminan de animarse antes de medir
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    // En celular el navegador ensancha la ventana si algo se sale: se compara con el ancho de la pantalla
    const desborde = (await page.evaluate<number>('document.documentElement.scrollWidth')) - 390
    expect(desborde).toBeLessThanOrEqual(0)
    await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'Cotizar' }).click()
    await expect(page).toHaveURL(/\/cotizaciones$/)
  })
})
