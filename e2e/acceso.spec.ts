import { expect, test } from '@playwright/test'
import { USUARIOS, entrar, vigilarErrores } from './ayuda'

test('muestra un error claro con contraseña incorrecta', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Correo').fill(USUARIOS.ventas.email)
  await page.getByLabel('Contraseña', { exact: true }).fill('incorrecta123')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText(/^Correo o contraseña incorrectos/)
  await expect(page).toHaveURL(/\/login/)
})

test('valida el correo antes de intentar entrar', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Escribe tu correo y tu contraseña para entrar.')
  await page.getByLabel('Correo').fill('ventas')
  await page.getByLabel('Contraseña', { exact: true }).fill('algo')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('nombre@correo.com')
  await expect(page).toHaveURL(/\/login/)
})

test('sin sesión, cualquier página lleva al inicio de sesión y después regresa a ella', async ({ page }) => {
  await page.goto('/cotizaciones')
  await expect(page).toHaveURL(/\/login/)
  await page.getByLabel('Correo').fill(USUARIOS.ventas.email)
  await page.getByLabel('Contraseña', { exact: true }).fill(USUARIOS.ventas.password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/cotizaciones$/)
  // Navegar enseguida no debe ser revertido por el inicio de sesión
  await page.goto('/')
  await page.getByRole('link', { name: 'Cotizaciones' }).first().click()
  await expect(page).toHaveURL(/\/cotizaciones$/)
})

test('entra, conserva la sesión al recargar y cierra sesión', async ({ page }) => {
  const sinErrores = vigilarErrores(page)
  await entrar(page, 'admin')
  await expect(page.getByRole('heading', { level: 1, name: 'Inicio' })).toBeVisible()
  await page.reload()
  await expect(page).not.toHaveURL(/\/login/)
  await page.getByRole('button', { name: 'Menú de usuario' }).click()
  await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/login/)
  sinErrores()
})

test('el menú respeta el rol: producción no ve cotizaciones ni administración', async ({ page }) => {
  await entrar(page, 'produccion')
  const menu = page.getByRole('complementary', { name: 'Menú principal' })
  await expect(menu.getByRole('link', { name: 'Producción' })).toBeVisible()
  await expect(menu.getByRole('link', { name: 'Cotizaciones' })).toHaveCount(0)
  await expect(menu.getByRole('link', { name: 'Usuarios' })).toHaveCount(0)
  await expect(menu.getByRole('link', { name: 'Reportes' })).toHaveCount(0)
})

test('el tema oscuro se guarda entre visitas', async ({ page }) => {
  await entrar(page, 'ventas')
  const html = page.locator('html')
  const antes = await html.getAttribute('data-theme')
  await page.getByRole('button', { name: /Cambiar a modo/ }).click()
  await expect(html).not.toHaveAttribute('data-theme', antes ?? '')
  const despues = await html.getAttribute('data-theme')
  await page.reload()
  await expect(html).toHaveAttribute('data-theme', despues ?? '')
})

test('un enlace de contraseña sin sesión explica cómo pedir otro', async ({ page }) => {
  await page.goto('/nueva-contrasena')
  await expect(page.getByText('Este enlace ya no es válido')).toBeVisible()
  await page.getByRole('button', { name: 'Pedir un enlace nuevo' }).click()
  await expect(page).toHaveURL(/\/login/)
})
