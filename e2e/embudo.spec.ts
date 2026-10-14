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

  const prospecto = page.locator('section[data-etapa="prospecto_nuevo"]')
  await expect(prospecto.getByText(titulo)).toBeVisible()

  // Mover a Interesado con el menú accesible
  await page.getByRole('button', { name: `Mover “${titulo}” a otra etapa` }).click()
  await page.getByRole('menuitem', { name: 'Interesado' }).click()
  await expect(page.locator('section[data-etapa="interesado"]').getByText(titulo)).toBeVisible()
  await expect.poll(async () => (await db.from('oportunidades').select('etapa').eq('titulo', titulo).single()).data?.etapa).toBe('interesado')
  await page.reload()
  await expect(page.locator('section[data-etapa="interesado"]').getByText(titulo)).toBeVisible()

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
  await expect(page.getByRole('region', { name: 'Perdidas este mes' }).getByText(titulo)).toBeVisible()
  sinErrores()
})
