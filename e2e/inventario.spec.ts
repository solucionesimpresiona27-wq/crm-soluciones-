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

/** Fecha AAAA-MM-DD en la zona del negocio (Guadalajara). */
const hoyNegocio = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date())

test('kárdex: el filtro por día respeta la hora de Guadalajara y las unidades van en plural', async ({ page }) => {
  const sinErrores = vigilarErrores(page)
  const nombre = `Papel kárdex ${sufijo()}`
  const hoy = hoyNegocio()
  const db = await clienteComo('admin')
  const { data: m, error } = await db.from('materiales').insert({ nombre, unidad: 'hoja', existencia: 0 }).select('id').single()
  if (error) throw error
  // 19:30 en Guadalajara ya es el día siguiente en UTC: debe contar como movimiento de hoy
  const r = await db.from('movimientos_inventario').insert([
    { material_id: m.id, tipo: 'entrada', cantidad: 120, fecha: `${hoy}T19:30:00-06:00` },
    { material_id: m.id, tipo: 'entrada', cantidad: 1, fecha: new Date(Date.now() - 5 * 86400000).toISOString() },
  ])
  if (r.error) throw r.error

  await entrar(page, 'admin')
  await page.goto(`/inventario/movimientos?material=${m.id}`)
  await page.getByLabel('Desde').fill(hoy)
  await page.getByLabel('Hasta').fill(hoy)
  const renglon = page.getByRole('row').filter({ hasText: nombre })
  // El de hace 5 días sale del filtro; el de las 19:30 se queda
  await expect(renglon).toHaveCount(1)
  await expect(renglon).toContainText('+120 hojas')
  await expect(renglon).toContainText('120 hojas')
  sinErrores()
})

test('proveedores: alta, edición y ficha; diseño no ve proveedores ni botones de movimiento', async ({ browser }) => {
  const nombre = `Tintas Prueba ${sufijo()}`
  const admin = await browser.newPage()
  const errAdmin = vigilarErrores(admin)
  await entrar(admin, 'admin')
  await admin.goto('/inventario/proveedores')
  await admin.getByRole('button', { name: 'Nuevo proveedor' }).click()
  let d = admin.getByRole('dialog', { name: 'Nuevo proveedor' })
  await d.getByRole('button', { name: 'Guardar proveedor' }).click()
  await expect(d.getByText('Escribe el nombre del proveedor')).toBeVisible()
  await d.getByLabel('Nombre').fill(nombre)
  await d.getByLabel('Correo').fill('correo-malo')
  await d.getByRole('button', { name: 'Guardar proveedor' }).click()
  await expect(d.getByText(/El correo no parece válido/)).toBeVisible()
  await d.getByLabel('Correo').fill('ventas@tintasprueba.mx')
  await d.getByLabel('WhatsApp').fill('3312345678')
  await d.getByRole('button', { name: 'Guardar proveedor' }).click()
  await expect(d).toBeHidden()

  await admin.getByPlaceholder('Buscar proveedor').fill(nombre)
  await admin.getByRole('button', { name: 'Ver ficha' }).click()
  d = admin.getByRole('dialog', { name: nombre })
  await expect(d).toContainText('ventas@tintasprueba.mx')
  await d.getByRole('button', { name: 'Editar' }).click()
  const e = admin.getByRole('dialog', { name: `Editar ${nombre}` })
  await e.getByLabel('Categoría').fill('Tintas')
  await e.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(e).toBeHidden()
  await expect(d).toContainText('Tintas')
  await admin.keyboard.press('Escape')
  await expect(d).toBeHidden()
  errAdmin()

  const diseno = await browser.newPage()
  const errDiseno = vigilarErrores(diseno)
  await entrar(diseno, 'diseno')
  await diseno.goto('/inventario')
  await expect(diseno.getByRole('table')).toBeVisible()
  await expect(diseno.getByRole('columnheader', { name: 'Proveedor' })).toHaveCount(0)
  await expect(diseno.getByRole('columnheader', { name: 'Costo' })).toHaveCount(0)
  await expect(diseno.getByRole('button', { name: /^(Entrada|Consumo) de / })).toHaveCount(0)
  await expect(diseno.getByRole('tab', { name: 'Proveedores' })).toHaveCount(0)
  errDiseno()
})

test('cancelar un gasto pide motivo y lo saca del total', async ({ page }) => {
  const sinErrores = vigilarErrores(page)
  const concepto = `Papelería ${sufijo()}`
  const db = await clienteComo('admin')
  const r = await db.from('gastos').insert({ concepto, categoria: 'otros', monto: 123.45, metodo_pago: 'efectivo', fecha: hoyNegocio() })
  if (r.error) throw r.error

  await entrar(page, 'admin')
  await page.goto('/inventario/gastos')
  await page.getByRole('tab', { name: 'Hoy' }).click()
  const renglon = page.getByRole('row').filter({ hasText: concepto })
  await expect(renglon).toContainText('$123.45')
  await renglon.getByRole('button', { name: `Cancelar gasto ${concepto}` }).click()
  const d = page.getByRole('dialog', { name: 'Cancelar gasto' })
  await d.getByRole('button', { name: 'Cancelar gasto' }).click()
  await expect(d.getByText('Escribe el motivo de la cancelación')).toBeVisible()
  await d.getByLabel('Motivo').fill('Se capturó dos veces')
  await d.getByRole('button', { name: 'Cancelar gasto' }).click()
  await expect(d).toBeHidden()
  await expect(renglon).toHaveCount(0)
  const { data } = await db.from('gastos').select('cancelado, motivo_cancelacion').eq('concepto', concepto).single()
  expect(data).toMatchObject({ cancelado: true, motivo_cancelacion: 'Se capturó dos veces' })
  sinErrores()
})
