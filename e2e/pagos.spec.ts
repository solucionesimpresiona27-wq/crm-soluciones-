import { expect, test } from '@playwright/test'
import { entrar, vigilarErrores } from './ayuda'
import { clienteComo, crearCotizacion } from './datos'

// Conceptos de crearCotizacion(): total $1,113.60 con IVA

async function crearPedido() {
  const cot = await crearCotizacion('ventas')
  const db = await clienteComo('ventas')
  const { data: id, error } = await db.rpc('convertir_cotizacion_a_pedido', { p_cotizacion: cot.id })
  if (error) throw error
  const { data } = await db.from('pedidos').select('folio').eq('id', id as string).single()
  return { ...cot, pedidoId: id as string, pedidoFolio: (data as { folio: string }).folio }
}

async function pedidoEnBd(id: string) {
  const db = await clienteComo('admin')
  const { data, error } = await db.from('pedidos').select('pagado, saldo, estado_pago').eq('id', id).single()
  if (error) throw error
  return data as { pagado: number; saldo: number; estado_pago: string }
}

test('ventas registra anticipo y liquidación con el diálogo; el corte del día los muestra', async ({ page }) => {
  const sinErrores = vigilarErrores(page)
  const p = await crearPedido()
  await entrar(page, 'ventas')

  // Anticipo: el tipo se sugiere solo (el pedido no tiene pagos)
  await page.goto(`/pagos?pedido=${p.pedidoId}`)
  const dialogo = page.getByRole('dialog', { name: 'Registrar pago' })
  await expect(dialogo.getByText(p.pedidoFolio)).toBeVisible()
  await expect(dialogo.locator('[data-prueba="saldo-pedido"]')).toHaveText('$1,113.60')
  await dialogo.getByLabel('Importe recibido').fill('500')
  await expect(dialogo.getByRole('tab', { name: 'Anticipo' })).toHaveAttribute('aria-selected', 'true')
  await dialogo.getByRole('radio', { name: 'Transferencia' }).click()
  await dialogo.getByLabel('Referencia').fill(`SPEI ${p.pedidoFolio}`)
  await dialogo.getByRole('button', { name: 'Registrar anticipo' }).click()
  await expect(page.getByText(`Anticipo de $500.00 registrado · ${p.pedidoFolio}`)).toBeVisible()
  await expect(dialogo).toBeHidden()
  await expect.poll(async () => Number((await pedidoEnBd(p.pedidoId)).saldo)).toBe(613.6)

  // Un importe mayor al saldo se rechaza antes de guardar
  await page.goto(`/pagos?pedido=${p.pedidoId}`)
  await expect(dialogo.locator('[data-prueba="saldo-pedido"]')).toHaveText('$613.60')
  await dialogo.getByLabel('Importe recibido').fill('700')
  await dialogo.getByRole('button', { name: 'Registrar liquidación' }).click()
  await expect(dialogo.getByText(/mayor al saldo/)).toBeVisible()

  // Liquidación con "Todo el saldo"
  await dialogo.getByRole('button', { name: /Todo el saldo/ }).click()
  await expect(dialogo.getByRole('tab', { name: 'Liquidación' })).toHaveAttribute('aria-selected', 'true')
  await dialogo.getByRole('button', { name: 'Registrar liquidación' }).click()
  await expect(page.getByText(`Liquidación de $613.60 registrado · ${p.pedidoFolio}`)).toBeVisible()
  await expect.poll(async () => (await pedidoEnBd(p.pedidoId)).estado_pago).toBe('liquidado')

  // Aparece en cobros y en el corte de caja de hoy
  await page.getByRole('tab', { name: 'Hoy' }).click()
  await expect(page.getByRole('link', { name: p.pedidoFolio }).first()).toBeVisible()
  await page.getByRole('tab', { name: 'Corte de caja' }).click()
  await expect(page).toHaveURL(/\/pagos\/caja/)
  const movimientos = page.getByRole('table', { name: /Pagos del/ })
  await expect(movimientos.getByText(p.pedidoFolio, { exact: true })).toHaveCount(2)
  sinErrores()
})

test('ventas cierra la caja de un día pasado y administración la reabre', async ({ page, browser }) => {
  const sinErrores = vigilarErrores(page)
  // Día pasado al azar (nunca hoy: cerrar la caja de hoy afectaría otras pruebas)
  const fecha = `20${String(10 + Math.floor(Math.random() * 10))}-0${1 + Math.floor(Math.random() * 9)}-${String(10 + Math.floor(Math.random() * 18))}`
  const admin = await clienteComo('admin')
  await admin.rpc('reabrir_caja', { p_fecha: fecha, p_motivo: 'Preparación de prueba e2e' }) // por si ya estaba cerrada

  await entrar(page, 'ventas')
  await page.goto(`/pagos/caja?fecha=${fecha}`)
  await expect(page.getByText('Caja abierta')).toBeVisible()
  await page.getByRole('textbox', { name: 'Efectivo inicial' }).fill('0')
  await page.getByRole('textbox', { name: 'Efectivo contado' }).fill('0')
  await expect(page.locator('[data-prueba="diferencia"]')).toHaveText('$0.00')
  await expect(page.getByText('Cuadra exacto').first()).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar caja' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar caja' }).click()
  await expect(page.getByText('Caja cerrada')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reabrir caja' })).toHaveCount(0)
  sinErrores()

  const contexto = await browser.newContext()
  const pa = await contexto.newPage()
  await entrar(pa, 'admin')
  await pa.goto(`/pagos/caja?fecha=${fecha}`)
  await expect(pa.getByText('Caja cerrada')).toBeVisible()
  await pa.getByRole('button', { name: 'Reabrir caja' }).click()
  await pa.getByRole('dialog').getByLabel('Motivo').fill('Prueba e2e de reapertura')
  await pa.getByRole('dialog').getByRole('button', { name: 'Reabrir caja' }).click()
  await expect(pa.getByText('Caja abierta')).toBeVisible()
  await contexto.close()
})

test('producción no entra a pagos ni ve montos', async ({ page }) => {
  const sinErrores = vigilarErrores(page)
  await entrar(page, 'produccion')
  for (const ruta of ['/pagos', '/pagos/caja', '/pagos/por-cobrar']) {
    await page.goto(ruta)
    await expect(page.getByText(/no está disponible para tu rol|son para ventas y administración/)).toBeVisible()
    await expect(page.locator('main')).not.toContainText('$')
  }
  await expect(page.getByRole('link', { name: 'Pagos' })).toHaveCount(0)
  sinErrores()
})
