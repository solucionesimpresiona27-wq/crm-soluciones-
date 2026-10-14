import { expect, test } from '@playwright/test'
import { entrar, vigilarErrores } from './ayuda'
import { clienteComo, crearCotizacion, sufijo } from './datos'

/** Hoy en Guadalajara (AAAA-MM-DD), igual que la base. */
const hoy = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date())

test('crear una tarea para hoy, verla en Hoy y en el panel, y completarla', async ({ page }) => {
  const sinErrores = vigilarErrores(page)
  const titulo = `Llamar a cliente E2E ${sufijo()}`
  await entrar(page, 'ventas')
  await page.goto('/agenda')

  await page.getByLabel('Nueva tarea').fill(titulo)
  await page.getByRole('button', { name: 'Agregar tarea', exact: true }).click()
  const panelHoy = page.getByLabel('Mis pendientes de hoy')
  await expect(panelHoy.getByText(titulo)).toBeVisible()

  // En el panel de control, dentro de "Mis pendientes"
  await page.goto('/')
  const modulo = page.getByRole('region', { name: 'Mis pendientes' })
  await expect(modulo.getByText(titulo)).toBeVisible()

  // Completar con un toque en la agenda
  await page.goto('/agenda')
  await page.getByRole('checkbox', { name: `Completar: ${titulo}` }).click()
  await expect(page.getByRole('checkbox', { name: `Marcar como pendiente: ${titulo}` })).toBeChecked()

  const db = await clienteComo('ventas')
  await expect.poll(async () => (await db.from('tareas').select('completada').eq('titulo', titulo).single()).data?.completada).toBe(true)

  // Ya no aparece en el panel (solo pendientes)
  await page.goto('/')
  await expect(page.getByText('Mis pendientes').first()).toBeVisible()
  await expect(page.getByText(titulo)).toHaveCount(0)
  sinErrores()
})

test('una entrega de pedido con fecha de hoy aparece en la vista Hoy', async ({ page }) => {
  const sinErrores = vigilarErrores(page)
  const cot = await crearCotizacion('ventas')
  const db = await clienteComo('ventas')
  const { data: id, error } = await db.rpc('convertir_cotizacion_a_pedido', { p_cotizacion: cot.id })
  if (error) throw error
  const r = await db
    .from('pedidos')
    .update({ fecha_entrega: hoy() })
    .eq('id', id as string)
  if (r.error) throw r.error

  await entrar(page, 'ventas')
  await page.goto('/agenda')
  await page.getByRole('tab', { name: 'Todas' }).click()
  await expect(page.getByLabel('Mis pendientes de hoy').getByText(cot.titulo)).toBeVisible()
  sinErrores()
})
