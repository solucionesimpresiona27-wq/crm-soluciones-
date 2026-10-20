import { expect, test } from '@playwright/test'
import { entrar, vigilarErrores } from './ayuda'
import { clienteComo, sufijo } from './datos'

test('ventas crea una oportunidad, la mueve con "Mover a…" y la marca como perdida solo con motivo', async ({ page }) => {
  const sinErrores = vigilarErrores(page)
  const s = sufijo()
  const db = await clienteComo('ventas')
  const { data: cliente, error } = await db.from('clientes').insert({ nombre: `Cliente Embudo ${s}`, whatsapp: '3312345678' }).select('id, nombre').single()
  if (error) throw error
  const titulo = `Lona embudo ${s}`

  await entrar(page, 'ventas')
  await page.goto('/embudo')
  await page.getByRole('button', { name: 'Nueva oportunidad' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Nueva oportunidad' })
  await dialogo.getByLabel('Cliente').fill(cliente!.nombre)
  await dialogo.getByRole('button', { name: new RegExp('^' + cliente!.nombre) }).click()
  await dialogo.getByLabel('Título').fill(titulo)
  await dialogo.getByLabel('Valor estimado').fill('2500')
  await dialogo.getByRole('button', { name: 'Crear oportunidad' }).click()
  await expect(dialogo).toBeHidden()

  // Filtra por título: con muchas oportunidades abiertas la columna se muestra por tandas
  await page.getByLabel('Buscar oportunidades').fill(titulo)
  const prospecto = page.locator('section[data-etapa="prospecto_nuevo"]')
  await expect(prospecto.getByText(titulo)).toBeVisible()

  // Mover a Interesado con el menú accesible
  await page.getByRole('button', { name: `Mover “${titulo}” a otra etapa` }).click()
  await page.getByRole('menuitem', { name: 'Interesado' }).click()
  await expect(page.locator('section[data-etapa="interesado"]').getByText(titulo)).toBeVisible()
  await expect.poll(async () => (await db.from('oportunidades').select('etapa').eq('titulo', titulo).single()).data?.etapa).toBe('interesado')
  await page.reload()
  await page.getByLabel('Buscar oportunidades').fill(titulo)
  await expect(page.locator('section[data-etapa="interesado"]').getByText(titulo)).toBeVisible()

  // El detalle refleja la etapa y el seguimiento registrado
  await page.getByRole('button', { name: `Abrir ${titulo} de ${cliente!.nombre}` }).click()
  const detalle = page.getByRole('dialog', { name: titulo })
  await expect(detalle.getByText(/· Interesado$/)).toBeVisible()
  await detalle.getByLabel('¿Qué pasó?').fill('Le llamé, pide muestras')
  await detalle.getByRole('button', { name: 'Registrar' }).click()
  await expect(detalle.getByText('Le llamé, pide muestras')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(detalle).toBeHidden()

  // Perdido sin motivo: no deja
  await page.getByRole('button', { name: `Mover “${titulo}” a otra etapa` }).click()
  await page.getByRole('menuitem', { name: 'Perdido' }).click()
  const motivo = page.getByRole('dialog', { name: '¿Por qué se perdió?' })
  await motivo.getByRole('button', { name: 'Marcar como perdida' }).click()
  await expect(motivo.getByText(/Elige un motivo/)).toBeVisible()
  await expect(motivo).toBeVisible()
  expect((await db.from('oportunidades').select('etapa').eq('titulo', titulo).single()).data?.etapa).toBe('interesado')

  // Con motivo: sí
  await motivo.getByRole('radio', { name: 'Precio' }).click()
  await motivo.getByRole('button', { name: 'Marcar como perdida' }).click()
  await expect(motivo).toBeHidden()
  await expect.poll(async () => (await db.from('oportunidades').select('etapa, motivo_perdida').eq('titulo', titulo).single()).data).toEqual({ etapa: 'perdido', motivo_perdida: 'Precio' })
  await page.getByRole('button', { name: /Perdidas este mes/ }).click()
  await expect(page.getByRole('region', { name: 'Perdidas este mes' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Perdidas este mes' }).getByText(titulo)).toBeVisible()
  sinErrores()
})

test('un enlace a una oportunidad que no existe muestra un aviso, no una carga eterna', async ({ page }) => {
  const sinErrores = vigilarErrores(page)
  await entrar(page, 'ventas')
  await page.goto('/embudo?op=00000000-0000-4000-8000-000000000000')
  const detalle = page.getByRole('dialog')
  await expect(detalle.getByText('No se pudo abrir la oportunidad')).toBeVisible()
  await expect(detalle.getByText(/ya no existe/)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page).not.toHaveURL(/op=/)
  sinErrores()
})
