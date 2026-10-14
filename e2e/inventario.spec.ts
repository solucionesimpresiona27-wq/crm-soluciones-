import { expect, test, type Page } from '@playwright/test'
import { entrar, vigilarErrores } from './ayuda'
import { clienteComo, crearCotizacion, sufijo } from './datos'

async function crearPedido() {
  const cot = await crearCotizacion('ventas')
  const db = await clienteComo('ventas')
  const { data: id, error } = await db.rpc('convertir_cotizacion_a_pedido', { p_cotizacion: cot.id })
  if (error) throw error
  const { data } = await db.from('pedidos').select('folio').eq('id', id as string).single()
  return { id: id as string, folio: (data as { folio: string }).folio }
}

async function existencia(nombre: string) {
  const db = await clienteComo('admin')
  const { data, error } = await db.from('materiales').select('existencia').eq('nombre', nombre).single()
  if (error) throw error
  return Number((data as { existencia: number }).existencia)
}

function fila(page: Page, nombre: string) {
  return page.getByRole('row').filter({ hasText: nombre })
}

async function ligarPedido(page: Page, folio: string) {
  const d = page.getByRole('dialog')
  await d.getByPlaceholder('Folio, trabajo o cliente').fill(folio)
  await d.getByRole('option').filter({ hasText: folio }).click()
}

test('material: alta, entrada, consumo de producción ligado a un pedido y alerta de stock bajo', async ({ browser }) => {
  const nombre = `Vinil prueba ${sufijo()}`
  const pedido = await crearPedido()

  const admin = await browser.newPage()
  const errAdmin = vigilarErrores(admin)
  await entrar(admin, 'admin')
  await admin.goto('/inventario')
  await admin.getByRole('button', { name: 'Nuevo material' }).click()
  let d = admin.getByRole('dialog', { name: 'Nuevo material' })
  await d.getByLabel('Nombre').fill(nombre)
  await d.getByLabel('Stock mínimo').fill('10')
  await d.getByLabel('Existencia inicial').fill('5')
  await d.getByLabel('Costo unitario').fill('40')
  await d.getByRole('button', { name: 'Dar de alta material' }).click()
  await expect(d).toBeHidden()
  await expect.poll(() => existencia(nombre)).toBe(5)

  // Entrada: sube la existencia
  await admin.getByPlaceholder('Buscar material').fill(nombre)
  await fila(admin, nombre).getByRole('button', { name: `Entrada de ${nombre}` }).click()
  d = admin.getByRole('dialog')
  await d.getByLabel('Cantidad').fill('20')
  await d.getByLabel('Referencia').fill('Factura A-1')
  await d.getByRole('button', { name: 'Registrar entrada' }).click()
  await expect(d).toBeHidden()
  await expect.poll(() => existencia(nombre)).toBe(25)
  await expect(fila(admin, nombre)).toContainText('25')
  errAdmin()

  // Producción: consumo ligado a un pedido; no ve gastos
  const prod = await browser.newPage()
  const errProd = vigilarErrores(prod)
  await entrar(prod, 'produccion')
  await prod.goto('/inventario')
  await expect(prod.getByRole('tab', { name: 'Gastos y compras' })).toHaveCount(0)
  await prod.getByPlaceholder('Buscar material').fill(nombre)
  await fila(prod, nombre).getByRole('button', { name: `Consumo de ${nombre}` }).click()
  d = prod.getByRole('dialog')
  await expect(d.getByLabel('Costo unitario')).toHaveCount(0)
  await d.getByLabel('Cantidad').fill('18')
  await ligarPedido(prod, pedido.folio)
  await d.getByRole('button', { name: 'Registrar consumo' }).click()
  await expect(d).toBeHidden()
  await expect.poll(() => existencia(nombre)).toBe(7)

  // Queda bajo el mínimo: aparece en "Stock bajo"
  await prod.getByPlaceholder('Buscar material').fill('')
  await prod.getByRole('switch', { name: /con stock bajo/ }).click()
  await expect(prod).toHaveURL(/bajo=1/)
  await expect(fila(prod, nombre)).toBeVisible()

  // El kárdex muestra el consumo con el folio del pedido
  await prod.goto('/inventario/movimientos')
  await expect(prod.getByRole('row').filter({ hasText: nombre }).filter({ hasText: pedido.folio })).toBeVisible()
  await prod.goto('/inventario/gastos')
  await expect(prod.getByRole('button', { name: 'Registrar gasto' })).toHaveCount(0)
  await expect(prod.getByText('Por categoría')).toHaveCount(0)
  errProd()
})

test('administración registra un gasto de maquila ligado a un pedido', async ({ page }) => {
  const sinErrores = vigilarErrores(page)
  const pedido = await crearPedido()
  const concepto = `Maquila corte láser ${sufijo()}`
  await entrar(page, 'admin')
  await page.goto('/inventario/gastos')
  await page.getByRole('button', { name: 'Registrar gasto' }).first().click()
  const d = page.getByRole('dialog', { name: 'Registrar gasto' })
  await d.getByLabel('Concepto').fill(concepto)
  await d.getByLabel('Monto').fill('850')
  await d.getByLabel('Categoría').selectOption('maquila')
  await ligarPedido(page, pedido.folio)
  await d.getByRole('button', { name: 'Guardar gasto' }).click()
  await expect(d).toBeHidden()
  await expect(page.getByRole('row').filter({ hasText: concepto })).toContainText(pedido.folio)

  const db = await clienteComo('admin')
  const { data } = await db.from('gastos').select('monto, categoria, pedido_id').eq('concepto', concepto).single()
  expect(data).toMatchObject({ monto: 850, categoria: 'maquila', pedido_id: pedido.id })
  sinErrores()
})
