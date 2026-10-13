import { expect, test } from '@playwright/test'
import { entrar, vigilarErrores } from './ayuda'
import { clienteComo, sufijo } from './datos'

test('ventas arma una cotización con la calculadora por m², la guarda y los totales coinciden', async ({ page }) => {
  const sinErrores = vigilarErrores(page)
  const db = await clienteComo('ventas')
  const marca = sufijo()
  const cliente = `Cliente Editor ${marca}`
  const titulo = `Fachada de prueba ${marca}`
  const alta = await db.from('clientes').insert({ nombre: cliente, whatsapp: '3311112222' })
  expect(alta.error).toBeNull()

  await entrar(page, 'ventas')
  await page.goto('/cotizaciones/nueva')

  // Cliente
  await page.getByPlaceholder('Nombre, WhatsApp o correo').fill(cliente)
  await page.getByRole('option', { name: new RegExp(cliente) }).click()
  await page.getByPlaceholder('¿Qué se cotiza?').fill(titulo)

  // Concepto con calculadora: 2 piezas de 2 × 1.5 m a $200 el m² → $600 por pieza → $1,200
  await page.getByRole('button', { name: 'Agregar producto o servicio' }).click()
  await page.getByPlaceholder('Lona impresa 13 oz, playeras con logo…').fill('Lona impresa')
  await page.getByRole('radio', { name: 'Por metro cuadrado' }).click()
  await page.getByLabel('Ancho').fill('2')
  await page.getByLabel('Alto').fill('1.5')
  await page.getByLabel('Piezas').fill('2')
  await page.getByLabel('Precio por m²').fill('200')
  await page.getByRole('button', { name: 'Usar este precio' }).click()
  await expect(page.getByLabel('Importe $1,200.00')).toBeVisible()

  // Instalación a precio directo: $400
  await page.getByRole('button', { name: 'Agregar instalación' }).click()
  await page.getByLabel(/Precio unitario/).last().fill('400')

  // Ventas no ve costos ni utilidad
  await expect(page.getByText(/Utilidad estimada/)).toHaveCount(0)
  await expect(page.getByText('Costos internos')).toHaveCount(0)

  // ($1,200 + $400) × 1.16 = $1,856.00
  const resumen = page.getByLabel('Resumen de la cotización')
  await expect(resumen.getByText('$1,856.00').first()).toBeVisible()
  await resumen.getByRole('button', { name: 'Guardar cotización' }).click()

  await expect(page).toHaveURL(/\/cotizaciones\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('heading', { name: cliente })).toBeVisible()
  await expect(page.getByText('$1,856.00').first()).toBeVisible()

  // La base de datos calculó el mismo total
  const id = page.url().split('/').pop()!
  const { data } = await db.from('cotizaciones').select('subtotal, iva, total, estado').eq('id', id).single()
  expect(data).toMatchObject({ subtotal: 1600, iva: 256, total: 1856, estado: 'borrador' })
  sinErrores()
})

test('salir con cambios sin guardar pide confirmación', async ({ page }) => {
  await entrar(page, 'ventas')
  await page.goto('/cotizaciones/nueva')
  await page.getByPlaceholder('¿Qué se cotiza?').fill('Borrador sin guardar')
  await page.getByRole('link', { name: 'Inicio' }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page).toHaveURL(/\/cotizaciones\/nueva$/)
})

test('producción no puede abrir el editor', async ({ page }) => {
  await entrar(page, 'produccion')
  await page.goto('/cotizaciones/nueva')
  await expect(page.getByRole('button', { name: 'Guardar cotización' })).toHaveCount(0)
})
