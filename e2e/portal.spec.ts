import { expect, test } from '@playwright/test'
import { vigilarErrores } from './ayuda'
import { readFileSync } from 'node:fs'
import { clienteComo, crearCotizacion } from './datos'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const sbUrl = () => env.VITE_SUPABASE_URL as string
const sbAnon = () => env.VITE_SUPABASE_ANON_KEY as string

// Conceptos de crearCotizacion(): total $1,113.60 con IVA

async function enlaceDeCotizacion() {
  const cot = await crearCotizacion('ventas', { estado: 'enviada' })
  const db = await clienteComo('ventas')
  const { data, error } = await db.rpc('crear_enlace_portal', { p_tipo: 'cotizacion', p_id: cot.id })
  if (error) throw error
  return { ...cot, token: (data as { token: string }).token }
}

// Contexto SIN sesión: el portal no depende de la sesión del equipo
test.use({ storageState: { cookies: [], origins: [] } })

test('el cliente abre su cotización sin sesión, la aprueba y no puede aprobarla dos veces', async ({ page }) => {
  const sinErrores = vigilarErrores(page)
  const c = await enlaceDeCotizacion()

  await page.goto(`/portal/${c.token}`)
  await expect(page.getByText(c.folio).first()).toBeVisible()
  await expect(page.getByText('$1,113.60').first()).toBeVisible()

  await page.getByRole('button', { name: 'Aprobar cotización' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Aprobar cotización' })
  await dialogo.getByLabel('Tu nombre').fill('Cliente de Prueba')
  await dialogo.getByRole('button', { name: 'Sí, aprobar cotización' }).dblclick()
  await expect(page.getByText('Cotización aprobada')).toBeVisible()
  await expect(page.getByText(/Por Cliente de Prueba/)).toBeVisible()

  const db = await clienteComo('admin')
  const { data } = await db.from('cotizaciones').select('estado').eq('id', c.id).single()
  expect((data as { estado: string }).estado).toBe('aceptada')
  const { count } = await db.from('portal_respuestas').select('id', { count: 'exact', head: true }).eq('cotizacion_id', c.id)
  expect(count).toBe(1)

  // El mismo enlace ya no ofrece aprobar
  await page.reload()
  await expect(page.getByText('Cotización aprobada')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Aprobar cotización' })).toHaveCount(0)
  // Y el servidor tampoco lo permite
  const { createClient } = await import('@supabase/supabase-js')
  const anon = createClient(process.env.E2E_SB_URL ?? sbUrl(), process.env.E2E_SB_ANON ?? sbAnon(), { auth: { persistSession: false } })
  const otra = await anon.rpc('portal_aprobar_cotizacion', { p_token: c.token, p_nombre: 'Otra Persona' })
  expect(otra.error).not.toBeNull()
  const { count: despues } = await db.from('portal_respuestas').select('id', { count: 'exact', head: true }).eq('cotizacion_id', c.id)
  expect(despues).toBe(1)
  sinErrores()
})

test('un token inventado muestra el mensaje genérico', async ({ page }) => {
  await page.goto('/portal/token-inventado-que-no-existe-0123456789abcdef')
  await expect(page.getByText('Este enlace ya no está disponible. Pide uno nuevo a Soluciones Impresiona.')).toBeVisible()
})
