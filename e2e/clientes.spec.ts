import { expect, test } from '@playwright/test'
import { entrar, vigilarErrores } from './ayuda'
import { clienteComo, crearCotizacion, sufijo } from './datos'

test('ventas crea una empresa con contacto, la busca sin acentos, captura datos fiscales y actividad, y cotiza', async ({ page }) => {
  const sinErrores = vigilarErrores(page)
  const marca = sufijo()
  const nombre = `Papelería Ñandú ${marca}`
  await entrar(page, 'ventas')
  await page.goto('/clientes')

  // Alta rápida con persona de contacto
  await page.getByRole('button', { name: 'Nuevo cliente' }).first().click()
  const alta = page.getByRole('dialog', { name: 'Nuevo cliente' })
  await alta.getByLabel('Nombre comercial').fill(nombre)
  await alta.getByLabel('WhatsApp').fill('33 1234 5678')
  await alta.getByLabel('Persona de contacto').fill('Lucía Ávila')
  await alta.getByLabel('Puesto').fill('Compras')
  await alta.getByRole('button', { name: 'Crear cliente' }).click()
  await expect(page).toHaveURL(/\/clientes\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('heading', { name: nombre })).toBeVisible()
  const contactos = page.locator('[aria-labelledby="titulo-contactos"]')
  await expect(contactos.getByText('Lucía Ávila')).toBeVisible()
  await expect(contactos.getByText('Principal')).toBeVisible()
  const id = page.url().split('/').pop()!

  // Búsqueda instantánea sin acentos ni eñes
  await page.goto('/clientes')
  await page.getByLabel(/Buscar clientes/).fill(`papeleria nandu ${marca.toLowerCase()}`)
  await expect(page.getByRole('link', { name: nombre })).toBeVisible()
  await expect(page.getByRole('link', { name: /Papelería/ })).toHaveCount(1)
  await page.getByRole('link', { name: nombre }).click()
  await expect(page).toHaveURL(new RegExp(`/clientes/${id}$`))

  // Datos fiscales con validación de RFC
  await page.getByRole('button', { name: 'Editar datos fiscales' }).click()
  const fiscal = page.getByRole('dialog', { name: 'Datos fiscales' })
  await fiscal.getByRole('switch', { name: /Requiere factura/ }).click()
  await fiscal.getByLabel('RFC').fill('XYZ12')
  await fiscal.getByRole('button', { name: 'Guardar datos fiscales' }).click()
  await expect(fiscal.getByText(/RFC no válido/)).toBeVisible()
  await fiscal.getByLabel('RFC').fill('PNA201231AB1')
  await fiscal.getByLabel('Razón social').fill(`Papelería Ñandú ${marca}`)
  await fiscal.getByLabel('Régimen fiscal').selectOption({ label: '601 General de Ley Personas Morales' })
  await fiscal.getByLabel('Código postal fiscal').fill('44100')
  await fiscal.getByRole('button', { name: 'Guardar datos fiscales' }).click()
  await expect(fiscal).toBeHidden()
  const modFiscal = page.locator('[aria-labelledby="titulo-fiscal"]')
  await expect(modFiscal.getByText('PNA201231AB1')).toBeVisible()
  await expect(modFiscal.getByText('Requiere factura')).toBeVisible()

  // Actividad rápida
  const actividad = page.locator('[aria-labelledby="titulo-actividad"]')
  await actividad.getByRole('radio', { name: 'Llamada' }).click()
  await actividad.getByLabel('Descripción de la actividad').fill(`Pidió precios de lonas ${marca}`)
  await actividad.getByRole('button', { name: 'Registrar actividad' }).click()
  await expect(actividad.getByText(`Pidió precios de lonas ${marca}`)).toBeVisible()

  // La base guardó todo
  const db = await clienteComo('ventas')
  const { data } = await db.from('clientes').select('rfc, requiere_factura, codigo_postal_fiscal').eq('id', id).single()
  expect(data).toEqual({ rfc: 'PNA201231AB1', requiere_factura: true, codigo_postal_fiscal: '44100' })

  // Nueva cotización con el cliente preseleccionado
  await page.getByRole('button', { name: `Nueva cotización para ${nombre}` }).click()
  await expect(page).toHaveURL(new RegExp(`/cotizaciones/nueva\\?cliente=${id}$`))
  sinErrores()
})

test('la ficha muestra el historial de una cotización creada por API', async ({ page }) => {
  const sinErrores = vigilarErrores(page)
  const cot = await crearCotizacion('ventas')
  const db = await clienteComo('ventas')
  const { data: cliente } = await db.from('clientes').select('id').eq('nombre', cot.cliente).single()
  await entrar(page, 'ventas')
  await page.goto(`/clientes/${cliente!.id}`)
  await expect(page.getByRole('heading', { name: cot.cliente })).toBeVisible()
  const historial = page.locator('[aria-labelledby="titulo-historial"]')
  await expect(historial.getByRole('link', { name: new RegExp(cot.folio) })).toBeVisible()
  await expect(historial.getByText('$1,113.60')).toBeVisible()
  await historial.getByRole('link', { name: new RegExp(cot.folio) }).click()
  await expect(page).toHaveURL(new RegExp(`/cotizaciones/${cot.id}$`))
  sinErrores()
})

// Revisión de seguridad (R2): los datos completos de clientes ya no son de Diseño ni de Producción
// (antes Diseño abría la ficha de cualquier cliente con teléfono, correo y RFC). La base tampoco se los da.
test('diseño y producción ven el aviso de acceso y la base no les da los datos del cliente', async ({ page }) => {
  const cot = await crearCotizacion('ventas')
  const db = await clienteComo('ventas')
  const { data: cliente } = await db.from('clientes').select('id').eq('nombre', cot.cliente).single()
  for (const rol of ['diseno', 'produccion'] as const) {
    await page.context().clearCookies()
    await page.goto('/login')
    await page.evaluate(() => localStorage.clear())
    await entrar(page, rol)
    await page.goto(`/clientes/${cliente!.id}`)
    await expect(page.getByText('Esta sección no está disponible para tu rol')).toBeVisible()
    await expect(page.getByText('$1,113.60')).toHaveCount(0)
    const directo = await clienteComo(rol)
    const { data } = await directo.from('clientes').select('id, telefono, rfc').eq('id', cliente!.id)
    expect(data).toEqual([])
  }
})
