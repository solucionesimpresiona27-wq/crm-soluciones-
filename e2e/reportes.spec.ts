import { expect, test } from '@playwright/test'
import { entrar, vigilarErrores } from './ayuda'
import { clienteComo, crearCotizacion } from './datos'

async function pedidoConPago() {
  const cot = await crearCotizacion('ventas', { conCostos: true })
  const db = await clienteComo('ventas')
  const { data: id, error } = await db.rpc('convertir_cotizacion_a_pedido', { p_cotizacion: cot.id })
  if (error) throw error
  const { data } = await db.from('pedidos').select('folio').eq('id', id as string).single()
  const pago = await db.from('pagos').insert({ pedido_id: id as string, importe: 500, tipo: 'anticipo', metodo: 'efectivo' }).select('id').single()
  if (pago.error) throw pago.error
  return { pedidoId: id as string, folio: (data as { folio: string }).folio }
}

test('administración ve las secciones de reportes con datos reales y cambia el periodo', async ({ page }) => {
  const sinErrores = vigilarErrores(page)
  const p = await pedidoConPago()
  await entrar(page, 'admin')
  await page.goto('/reportes')

  await expect(page.getByRole('heading', { name: 'Ventas', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Cuentas por cobrar' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Clientes para reactivar' })).toBeVisible()
  await expect(page.getByText('Total por cobrar')).toBeVisible()
  await expect(page.getByText('Sin ventas en este periodo')).toBeHidden()

  // Tabla accesible alternativa a la gráfica
  await page.getByRole('button', { name: 'Ver como tabla' }).click()
  await expect(page.getByRole('table').first()).toBeVisible()

  // Periodo en la URL
  await page.getByRole('tab', { name: 'Año' }).click()
  await expect(page).toHaveURL(/periodo=anio/)
  await expect(page.getByText(/Año \d{4}/).first()).toBeVisible()

  // Las secciones conservan el periodo
  await page.getByRole('tab', { name: 'Productos' }).click()
  await expect(page).toHaveURL(/\/reportes\/productos\?periodo=anio/)
  await expect(page.getByRole('heading', { name: 'Productos más vendidos' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Productos ordenados por importe' })).toBeVisible()

  await page.getByRole('tab', { name: 'Vendedores' }).click()
  await expect(page.getByRole('table', { name: /Desempeño de vendedores/ })).toBeVisible()

  await page.getByRole('tab', { name: 'Clientes' }).click()
  await expect(page.getByRole('table', { name: /Mejores clientes/ })).toBeVisible()

  await page.getByRole('tab', { name: 'Utilidad' }).click()
  await expect(page.getByRole('link', { name: p.folio })).toBeVisible()

  // Exportar CSV
  const descarga = page.waitForEvent('download')
  await page.getByRole('button', { name: /Exportar utilidad real por pedido a CSV/ }).click()
  expect((await descarga).suggestedFilename()).toMatch(/^utilidad_.*\.csv$/)

  // Personalizado con fechas
  await page.getByRole('tab', { name: 'Personalizado' }).click()
  await expect(page).toHaveURL(/periodo=rango/)
  await expect(page.getByLabel('Desde')).toBeVisible()
  sinErrores()
})

test('ventas no entra a reportes y la base le niega los datos', async ({ page }) => {
  await entrar(page, 'ventas')
  await page.goto('/reportes')
  await expect(page.getByText('Esta sección no está disponible para tu rol')).toBeVisible()
  const db = await clienteComo('ventas')
  const { error } = await db.rpc('reporte_ventas', { p_desde: '2026-01-01', p_hasta: '2026-01-31', p_agrupar: 'dia' })
  expect(error).not.toBeNull()
})
