import { expect, test, type Page } from '@playwright/test'
import { USUARIOS, entrar, vigilarErrores } from './ayuda'
import { clienteComo, sufijo } from './datos'

/** Guarda la sección con la barra "Cambios sin guardar". */
async function guardarSeccion(page: Page) {
  const barra = page.getByRole('status').filter({ hasText: 'Cambios sin guardar' })
  await barra.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Cambios guardados').first()).toBeVisible()
  await expect(barra).toHaveCount(0)
}

test('admin cambia nombre comercial y vigencia: se usan en la cotización nueva y quedan en la bitácora', async ({ page }) => {
  const sinErrores = vigilarErrores(page)
  const admin = await clienteComo('admin')
  const antes = (await admin.from('configuracion').select('nombre_comercial, vigencia_dias').eq('id', 1).single()).data!
  const nombre = `Impresiona Prueba ${sufijo()}`
  const vigencia = antes.vigencia_dias === 21 ? 22 : 21
  try {
    await entrar(page, 'admin')
    await page.goto('/configuracion/empresa')
    await page.getByLabel('Nombre comercial').fill(nombre)
    await guardarSeccion(page)

    await page.getByRole('button', { name: /^Cotizaciones/ }).click()
    await expect(page).toHaveURL(/\/configuracion\/cotizaciones$/)
    await expect(page.getByRole('heading', { name: 'Cotizaciones', level: 2 })).toBeVisible()
    await page.waitForTimeout(1500)
    await page.getByLabel('Vigencia').fill(String(vigencia))
    await expect(page.getByRole('status').filter({ hasText: 'Cambios sin guardar' })).toBeVisible()
    // Cambios sin guardar: salir pide confirmación
    await page.getByRole('button', { name: /^Clientes/ }).click()
    await expect(page.getByRole('dialog', { name: 'Tienes cambios sin guardar' })).toBeVisible()
    await page.getByRole('button', { name: 'Seguir editando' }).click()
    await guardarSeccion(page)

    // La base guardó y la app lo usa (useConfiguracion alimenta editor y PDF)
    const despues = (await admin.from('configuracion').select('nombre_comercial, vigencia_dias').eq('id', 1).single()).data!
    expect(despues).toEqual({ nombre_comercial: nombre, vigencia_dias: vigencia })
    await page.goto('/cotizaciones/nueva')
    await expect(page.getByLabel('Vigencia')).toHaveValue(String(vigencia))

    // Bitácora: el cambio de configuración con antes → después
    await page.goto('/usuarios/bitacora?tabla=configuracion')
    const entrada = page.getByRole('listitem').filter({ hasText: 'Vigencia (días)' }).first()
    await expect(entrada).toBeVisible()
    await expect(entrada.getByText(String(vigencia), { exact: true })).toBeVisible()
    await expect(page.getByRole('listitem').filter({ hasText: nombre }).first()).toBeVisible()
    sinErrores()
  } finally {
    await admin.from('configuracion').update(antes).eq('id', 1)
  }
})

test('admin concede ver_costos a ventas, ventas lo ve tras recargar y luego vuelve a los del rol', async ({ page, browser }) => {
  const sinErrores = vigilarErrores(page)
  const admin = await clienteComo('admin')
  const ventasId = (await admin.from('perfiles').select('id').eq('email', USUARIOS.ventas.email).single()).data!.id as string
  const original = (await admin.from('perfiles').select('permisos').eq('id', ventasId).single()).data!.permisos
  await admin.from('perfiles').update({ permisos: {} }).eq('id', ventasId)

  const ctxVentas = await browser.newContext()
  const ventas = await ctxVentas.newPage()
  try {
    await entrar(page, 'admin')
    await page.goto(`/usuarios?usuario=${ventasId}`)
    const dialogo = page.getByRole('dialog')
    await dialogo.getByRole('radio', { name: /Permisos/ }).or(dialogo.getByRole('tab', { name: /Permisos/ })).first().click()
    const costos = dialogo.getByRole('switch', { name: 'Ver costos, márgenes y utilidades' })
    await expect(costos).toHaveAttribute('aria-checked', 'false')
    await costos.click()
    await expect(costos).toHaveAttribute('aria-checked', 'true')
    await expect(dialogo.getByText('Concedido a mano')).toBeVisible()

    // Ventas entra (sesión nueva = permisos recargados) y ve los costos internos del editor
    await entrar(ventas, 'ventas')
    await ventas.goto('/cotizaciones/nueva')
    await ventas.getByRole('button', { name: 'Agregar producto o servicio' }).click()
    await expect(ventas.getByText('Costos internos').first()).toBeVisible()

    // Admin vuelve a los del rol
    await dialogo.getByRole('button', { name: 'Volver a los del rol' }).click()
    await expect(costos).toHaveAttribute('aria-checked', 'false')
    await ventas.reload()
    await ventas.getByRole('button', { name: 'Agregar producto o servicio' }).click()
    await expect(ventas.getByPlaceholder('Lona impresa 13 oz, playeras con logo…')).toBeVisible()
    await expect(ventas.getByText('Costos internos')).toHaveCount(0)
    sinErrores()
  } finally {
    await admin.from('perfiles').update({ permisos: original ?? {} }).eq('id', ventasId)
    await ctxVentas.close()
  }
})

test('ventas no puede entrar a usuarios ni configuración', async ({ page }) => {
  await entrar(page, 'ventas')
  for (const ruta of ['/usuarios', '/usuarios/bitacora', '/configuracion', '/configuracion/fiscales']) {
    await page.goto(ruta)
    await expect(page.getByText(/no está disponible para tu rol|solo para administración/).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Agregar usuario' })).toHaveCount(0)
    await expect(page.getByLabel('Nombre comercial')).toHaveCount(0)
  }
  // Y la base de datos tampoco lo deja (RLS)
  const db = await clienteComo('ventas')
  const r = await db.from('configuracion').update({ vigencia_dias: 99 }).eq('id', 1).select()
  expect(r.data ?? []).toHaveLength(0)
})
