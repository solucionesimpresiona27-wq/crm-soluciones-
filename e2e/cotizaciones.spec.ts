import { expect, test, type Page } from '@playwright/test'
import { entrar, vigilarErrores } from './ayuda'
import { clienteComo, crearCotizacion } from './datos'

// Conceptos de crearCotizacion(): 2 lonas de 3 m² a $180 c/u + instalación $600 = $960 + IVA 16 % = $1,113.60
// (el precio unitario es por pieza; la calculadora ya lo multiplicó por los m²)
const TOTAL = '$1,113.60'

async function abrirDesdeLista(page: Page, folio: string) {
  await page.goto('/cotizaciones')
  await page.getByRole('searchbox', { name: /Buscar cotizaciones/ }).or(page.getByLabel(/Buscar cotizaciones/)).fill(folio)
  await page.getByRole('link', { name: folio }).first().click()
  await expect(page).toHaveURL(/\/cotizaciones\/[0-9a-f-]{36}$/)
}

test('ventas encuentra su cotización en la lista y ve el detalle sin costos', async ({ page }) => {
  const sinErrores = vigilarErrores(page)
  const cot = await crearCotizacion('ventas')
  await entrar(page, 'ventas')
  await abrirDesdeLista(page, cot.folio)

  await expect(page.getByRole('heading', { name: cot.cliente })).toBeVisible()
  await expect(page.getByText(cot.titulo).first()).toBeVisible()
  await expect(page.getByText(TOTAL).first()).toBeVisible()
  await expect(page.getByText('Lona impresa 13 oz').first()).toBeVisible()
  // Ventas no tiene ver_costos: ni el módulo ni la utilidad aparecen
  await expect(page.getByLabel('Costos y utilidad')).toHaveCount(0)
  await expect(page.getByText('Utilidad estimada')).toHaveCount(0)
  sinErrores()
})

test('administración ve costos y utilidad estimada', async ({ page }) => {
  const cot = await crearCotizacion('admin', { conCostos: true })
  await entrar(page, 'admin')
  await page.goto(`/cotizaciones/${cot.id}`)
  const costos = page.getByLabel('Costos y utilidad')
  await expect(costos).toBeVisible()
  // Costo: (20 × 1.10 + 10) × 6 m² = $192 → utilidad sobre $960 = $768
  await expect(costos.getByText('$768').first()).toBeVisible()
})

test('duplicar crea un borrador nuevo y lleva a la copia', async ({ page }) => {
  const sinErrores = vigilarErrores(page)
  const cot = await crearCotizacion('ventas', { estado: 'enviada' })
  await entrar(page, 'ventas')
  await page.goto(`/cotizaciones/${cot.id}`)
  await expect(page.getByRole('heading', { name: cot.cliente })).toBeVisible()
  await page.getByRole('button', { name: 'Duplicar', exact: true }).click()
  await expect(page).not.toHaveURL(new RegExp(cot.id))
  await expect(page).toHaveURL(/\/cotizaciones\/[0-9a-f-]{36}$/)
  await expect(page.getByText(`${cot.titulo} (copia)`).first()).toBeVisible()
  await expect(page.getByText('Borrador').first()).toBeVisible()
  await expect(page.getByText(TOTAL).first()).toBeVisible()
  sinErrores()
})

test('convertir en pedido muestra el folio del pedido y bloquea la edición', async ({ page }) => {
  const sinErrores = vigilarErrores(page)
  const cot = await crearCotizacion('ventas', { estado: 'enviada' })
  await entrar(page, 'ventas')
  await page.goto(`/cotizaciones/${cot.id}`)
  await page.getByRole('button', { name: 'Convertir en pedido', exact: true }).click()
  const dialogo = page.getByRole('dialog', { name: 'Convertir en pedido' })
  await expect(dialogo).toBeVisible()
  await dialogo.getByRole('button', { name: 'En una semana' }).click()
  await dialogo.getByRole('button', { name: 'Convertir en pedido' }).click()
  const listo = page.getByRole('dialog', { name: 'Pedido creado' })
  await expect(listo.getByText(/PED-\d{4}/)).toBeVisible()
  await listo.getByRole('button', { name: 'Listo' }).click()
  await expect(page.getByText('Aceptada').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Editar', exact: true })).toBeDisabled()
  sinErrores()
})

// Revisión de seguridad (R3): antes una cotización aprobada por el cliente en el portal se podía seguir editando.
test('una cotización aprobada por el cliente en el portal ya no se edita y se duplica como versión nueva', async ({ page }) => {
  const sinErrores = vigilarErrores(page)
  const cot = await crearCotizacion('ventas', { estado: 'enviada' })
  const db = await clienteComo('ventas')
  const enlace = await db.rpc('crear_enlace_portal', { p_tipo: 'cotizacion', p_id: cot.id })
  expect(enlace.error).toBeNull()
  const aprobacion = await db.rpc('portal_aprobar_cotizacion', { p_token: (enlace.data as { token: string }).token, p_nombre: 'Cliente de Prueba' })
  expect(aprobacion.error).toBeNull()

  await entrar(page, 'ventas')
  await page.goto(`/cotizaciones/${cot.id}`)
  await expect(page.getByRole('heading', { name: cot.cliente })).toBeVisible()
  const editar = page.getByRole('button', { name: 'Editar', exact: true })
  await expect(editar).toBeDisabled()
  await expect(editar).toHaveAccessibleDescription(/Duplícala para hacer una versión nueva/)
  // La base también lo impide, aunque se llame directo
  const { error } = await db.from('cotizaciones').update({ titulo: 'Cambio a escondidas' }).eq('id', cot.id)
  expect(error?.message).toContain('aprobó esta cotización desde el portal')

  // El editor tampoco abre
  await page.goto(`/cotizaciones/${cot.id}/editar`)
  await expect(page.getByText(`${cot.folio} ya fue aceptada`)).toBeVisible()
  await page.getByRole('button', { name: 'Volver a la cotización' }).click()

  await page.getByRole('button', { name: 'Duplicar como versión nueva' }).click()
  await expect(page).not.toHaveURL(new RegExp(cot.id))
  await expect(page).toHaveURL(/\/cotizaciones\/[0-9a-f-]{36}$/)
  await expect(page.getByText('Borrador').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Editar', exact: true })).toBeEnabled()
  sinErrores()
})

test('producción no tiene acceso a cotizaciones ni ve montos', async ({ page }) => {
  const cot = await crearCotizacion('ventas')
  await entrar(page, 'produccion')
  await page.goto('/cotizaciones')
  await expect(page.getByText('Las cotizaciones son para ventas y administración')).toBeVisible()
  await page.goto(`/cotizaciones/${cot.id}`)
  await expect(page.getByText('Las cotizaciones son para ventas y administración')).toBeVisible()
  await expect(page.locator('main')).not.toContainText('$')
})
