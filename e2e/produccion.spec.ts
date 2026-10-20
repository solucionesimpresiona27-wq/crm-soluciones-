import { expect, test } from '@playwright/test'
import { entrar, vigilarErrores } from './ayuda'
import { clienteComo, crearCotizacion } from './datos'

/** Pedido real: cotización de ventas convertida y llevada a "En producción". */
async function crearPedidoEnProduccion() {
  const cot = await crearCotizacion('ventas')
  const db = await clienteComo('ventas')
  const conv = await db.rpc('convertir_cotizacion_a_pedido', { p_cotizacion: cot.id })
  if (conv.error) throw conv.error
  const { data: pedido, error } = await db
    .from('pedidos')
    .select('id, folio')
    .eq('id', conv.data as string)
    .single()
  if (error) throw error
  const mov = await db.rpc('cambiar_estado_pedido', { p_pedido: pedido.id, p_estado: 'en_produccion' })
  if (mov.error) throw mov.error
  return { ...cot, pedidoId: pedido.id as string, pedidoFolio: pedido.folio as string }
}

test('producción mueve un pedido de etapa con "Mover a…" y la etapa queda guardada', async ({ page }) => {
  const sinErrores = vigilarErrores(page)
  const p = await crearPedidoEnProduccion()
  await entrar(page, 'produccion')
  await page.goto(`/produccion?q=${encodeURIComponent(p.pedidoFolio)}`)

  const tablero = page.getByLabel('Tablero de producción por etapas')
  const enProduccion = tablero.locator('section[data-etapa="en_produccion"]')
  await expect(enProduccion.getByText(p.titulo)).toBeVisible()
  await expect(enProduccion.getByText(p.cliente)).toBeVisible()
  // Nunca montos en el tablero
  await expect(page.locator('main')).not.toContainText('$')

  await page.getByRole('button', { name: `Mover ${p.pedidoFolio} a otra etapa` }).click()
  await page.getByRole('menuitem', { name: 'Acabados' }).click()
  await expect(tablero.locator('section[data-etapa="acabados"]').getByText(p.titulo)).toBeVisible()
  await expect(page.getByText(`${p.pedidoFolio} pasó a acabados`)).toBeVisible()

  await page.reload()
  await expect(page.getByLabel('Tablero de producción por etapas').locator('section[data-etapa="acabados"]').getByText(p.titulo)).toBeVisible()
  sinErrores()
})

test('la orden de trabajo se abre sin precios y guarda notas de producción', async ({ page }) => {
  const sinErrores = vigilarErrores(page)
  const p = await crearPedidoEnProduccion()
  await entrar(page, 'produccion')
  await page.goto(`/produccion?q=${encodeURIComponent(p.pedidoFolio)}`)
  await page.getByRole('link', { name: p.titulo }).click()
  await expect(page).toHaveURL(new RegExp(`/produccion/${p.pedidoId}$`))

  await expect(page.getByRole('heading', { name: p.titulo })).toBeVisible()
  await expect(page.getByText('Lona impresa 13 oz').first()).toBeVisible()
  await expect(page.getByText(/3[.,]00 × 1[.,]00 m/).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Imprimir' })).toBeVisible()
  await expect(page.locator('main')).not.toContainText('$')

  const nota = page.getByLabel('Notas de producción').first()
  await nota.fill('Ojillos cada 50 cm')
  await page.getByRole('button', { name: 'Guardar nota' }).click()
  await expect(page.getByText('Nota guardada')).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Notas de producción').first()).toHaveValue('Ojillos cada 50 cm')

  // La hoja para imprimir (fuera de la app) tampoco lleva precios
  const hoja = page.locator('.orden-impresion')
  await expect(hoja).toContainText(p.pedidoFolio)
  await expect(hoja).not.toContainText('$')
  sinErrores()
})

test('las columnas largas muestran 30 órdenes y cargan más al pedirlo', async ({ page }) => {
  const sinErrores = vigilarErrores(page)
  await entrar(page, 'admin')
  await page.goto('/produccion')
  const tablero = page.getByLabel('Tablero de producción por etapas')
  await expect(tablero.locator('article').first()).toBeVisible()
  const botonMas = page.getByRole('button', { name: /^Mostrar \d+ más \(quedan \d+\)$/ })
  test.skip((await tablero.locator(botonMas).count()) === 0, 'Ninguna columna pasa de 30 órdenes en esta base')
  // Se fija la columna por su etapa: al cargar todo, el botón desaparece y el filtro "has" cambiaría de columna
  const etapa = await tablero.locator('section[data-etapa]').filter({ has: botonMas }).first().getAttribute('data-etapa')
  const columna = tablero.locator(`section[data-etapa="${etapa}"]`)
  const mas = columna.locator(botonMas)
  await expect(columna.locator('article')).toHaveCount(30)
  await mas.click()
  await expect.poll(() => columna.locator('article').count()).toBeGreaterThan(30)
  sinErrores()
})
