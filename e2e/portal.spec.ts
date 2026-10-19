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

// Revisión de seguridad (ronda 2): el cliente aprueba la versión que vio, no la que el asesor dejó después
test('si el asesor cambia la cotización mientras el cliente la revisa, la aprobación pide revisar la versión nueva', async ({ page }) => {
  const sinErrores = vigilarErrores(page)
  const c = await enlaceDeCotizacion()
  await page.goto(`/portal/${c.token}`)
  await expect(page.getByText('$1,113.60').first()).toBeVisible()

  // Ventas cambia un precio con el portal abierto
  const ventas = await clienteComo('ventas')
  const cambio = await ventas.from('partidas').update({ precio_unitario: 1000 }).eq('cotizacion_id', c.id).eq('concepto', 'Instalación en sitio').select('id')
  expect(cambio.error).toBeNull()
  const { data: nueva } = await ventas.from('cotizaciones').select('total').eq('id', c.id).single()
  const totalNuevo = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number((nueva as { total: number }).total))

  await page.getByRole('button', { name: 'Aprobar cotización' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Aprobar cotización' })
  await dialogo.getByLabel('Tu nombre').fill('Cliente de Prueba')
  await dialogo.getByRole('button', { name: 'Sí, aprobar cotización' }).click()
  await expect(page.getByText('La cotización cambió')).toBeVisible()
  await expect(dialogo).toBeHidden()
  await expect(page.getByText(totalNuevo).first()).toBeVisible()
  const db = await clienteComo('admin')
  const { data: sigue } = await db.from('cotizaciones').select('estado').eq('id', c.id).single()
  expect((sigue as { estado: string }).estado).toBe('enviada')

  // Ya con la versión actual a la vista, la aprobación sí queda
  await page.getByRole('button', { name: 'Aprobar cotización' }).click()
  await dialogo.getByLabel('Tu nombre').fill('Cliente de Prueba')
  await dialogo.getByRole('button', { name: 'Sí, aprobar cotización' }).click()
  await expect(page.getByText('Cotización aprobada')).toBeVisible()
  const { data: fin } = await db.from('cotizaciones').select('estado, total').eq('id', c.id).single()
  expect(fin).toMatchObject({ estado: 'aceptada' })
  expect(Number((fin as { total: number }).total)).toBe(Number((nueva as { total: number }).total))
  sinErrores()
})

test('un token inventado muestra el mensaje genérico', async ({ page }) => {
  await page.goto('/portal/token-inventado-que-no-existe-0123456789abcdef')
  await expect(page.getByText('Este enlace ya no está disponible. Pide uno nuevo a Soluciones Impresiona.')).toBeVisible()
})
