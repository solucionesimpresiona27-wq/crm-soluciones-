import { expect, test } from '@playwright/test'
import { entrar, vigilarErrores } from './ayuda'
import { clienteComo, sufijo } from './datos'

async function productoSinPrecio() {
  const db = await clienteComo('admin')
  const nombre = `Lona prueba ${sufijo()}`
  const { data, error } = await db.from('productos').insert({ nombre, metodo_calculo: 'm2', unidad: 'm²' }).select('id').single()
  if (error) throw error
  return { id: (data as { id: string }).id, nombre }
}

test('admin captura el precio de un producto sin precio y la calculadora cobra el m² con ese precio', async ({ page }) => {
  const sinErrores = vigilarErrores(page)
  const p = await productoSinPrecio()
  await entrar(page, 'admin')

  await page.goto('/catalogo')
  await page.getByLabel('Buscar en el catálogo').fill(p.nombre)
  const fila = page.locator(`[data-producto="${p.nombre}"]`)
  await fila.getByRole('button', { name: 'Sin precio: captúralo' }).click()

  const dialogo = page.getByRole('dialog', { name: 'Editar producto' })
  await expect(dialogo.getByText('Costos', { exact: true })).toBeVisible()
  await dialogo.getByLabel('Precio por m²').fill('250')
  await expect(dialogo.getByText('Precio público calculado')).toBeVisible()
  await dialogo.getByRole('button', { name: 'Guardar producto' }).click()
  await expect(dialogo).toBeHidden()
  await expect(fila.getByText('$250.00')).toBeVisible()

  const db = await clienteComo('admin')
  const { data } = await db.from('productos').select('precio_venta').eq('id', p.id).single()
  expect(Number((data as { precio_venta: number }).precio_venta)).toBe(250)

  await page.goto('/calculadora')
  await page.getByRole('button', { name: 'Elegir producto del catálogo' }).click()
  await page.getByRole('option', { name: new RegExp(p.nombre) }).click()
  await page.getByLabel('Ancho (m)').fill('2')
  await page.getByLabel('Alto (m)').fill('1.5')
  // 2 × 1.5 = 3 m² × $250 = $750 + IVA 16% = $870
  const resultado = page.locator('[aria-live="polite"]').filter({ hasText: 'Resultado' })
  await expect(resultado.getByText('$750.00').first()).toBeVisible()
  await expect(resultado.getByText('$870.00').first()).toBeVisible()
  await expect(resultado.getByText('Margen')).toBeVisible()

  await page.getByRole('button', { name: 'Crear cotización con esto' }).click()
  await expect(page).toHaveURL(/\/cotizaciones\/nueva/)
  const borrador = await page.evaluate(() => sessionStorage.getItem('impresiona:calculadora:borrador'))
  expect(JSON.parse(borrador ?? '{}').partidas[0]).toMatchObject({ producto_id: p.id, cantidad: 1, precio_unitario: 750 })
  sinErrores()
})

test('ventas ve precios pero no costos ni puede editar el catálogo', async ({ page }) => {
  const sinErrores = vigilarErrores(page)
  await entrar(page, 'ventas')
  await page.goto('/catalogo')
  await expect(page.locator('[data-producto]').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Nuevo producto' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Editar / })).toHaveCount(0)
  await expect(page.getByRole('radio', { name: 'Categorías' })).toHaveCount(0)

  await page.goto('/calculadora')
  await expect(page.getByText('Total con IVA')).toBeVisible()
  await expect(page.getByText('Margen')).toHaveCount(0)
  await expect(page.getByText('Costo + ganancia')).toHaveCount(0)

  // La base también lo impide: ventas no puede cambiar precios
  const db = await clienteComo('ventas')
  const { data } = await db.from('productos').select('id').limit(1).single()
  const r = await db.from('productos').update({ precio_venta: 1 }).eq('id', (data as { id: string }).id).select('id')
  expect(r.error !== null || (r.data ?? []).length === 0).toBe(true)
  sinErrores()
})
