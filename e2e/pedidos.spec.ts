import { expect, test, type Page } from '@playwright/test'
import { deflateSync } from 'node:zlib'
import { entrar, vigilarErrores } from './ayuda'
import { clienteComo, crearCotizacion } from './datos'

// Conceptos de crearCotizacion(): total $1,113.60 con IVA
const TOTAL = '$1,113.60'

/** PNG válido de 2×2 px generado en la prueba (sin archivos externos). */
function pngPequeno() {
  const crc = (buf: Buffer) => {
    let c = ~0
    for (const b of buf) {
      c ^= b
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
    }
    return (~c >>> 0)
  }
  const bloque = (tipo: string, datos: Buffer) => {
    const t = Buffer.from(tipo)
    const largo = Buffer.alloc(4)
    largo.writeUInt32BE(datos.length)
    const c = Buffer.alloc(4)
    c.writeUInt32BE(crc(Buffer.concat([t, datos])))
    return Buffer.concat([largo, t, datos, c])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(2, 0)
  ihdr.writeUInt32BE(2, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const filas = Buffer.from([0, 34, 66, 107, 249, 194, 6, 0, 249, 194, 6, 34, 66, 107])
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloque('IHDR', ihdr), bloque('IDAT', deflateSync(filas)), bloque('IEND', Buffer.alloc(0))])
}

async function crearPedido() {
  const cot = await crearCotizacion('ventas')
  const db = await clienteComo('ventas')
  const { data: id, error } = await db.rpc('convertir_cotizacion_a_pedido', { p_cotizacion: cot.id })
  if (error) throw error
  const { data } = await db.from('pedidos').select('folio').eq('id', id as string).single()
  return { ...cot, pedidoId: id as string, pedidoFolio: (data as { folio: string }).folio }
}

const etapa = (page: Page) => page.getByRole('region', { name: 'Etapas del pedido' })

test('ventas lleva el pedido por sus etapas, pausa, sube y aprueba un diseño y lo factura', async ({ page }) => {
  const sinErrores = vigilarErrores(page)
  const p = await crearPedido()
  await entrar(page, 'ventas')

  // Lo encuentra en la lista
  await page.goto('/pedidos')
  await page.getByLabel(/Buscar pedidos/).fill(p.pedidoFolio)
  await page.getByRole('link', { name: p.pedidoFolio }).first().click()
  await expect(page).toHaveURL(new RegExp(`/pedidos/${p.pedidoId}$`))
  await expect(page.getByRole('heading', { name: p.cliente })).toBeVisible()
  await expect(page.getByText(TOTAL).first()).toBeVisible()

  // Avanza de "Nuevo" a "En diseño"
  await expect(etapa(page).getByText('Nuevo', { exact: true }).first()).toBeVisible()
  await etapa(page).getByRole('button', { name: 'Empezar diseño' }).click()
  await expect(etapa(page).getByText('En diseño', { exact: true })).toBeVisible()

  // Pausa con motivo y reanuda en la misma etapa
  await etapa(page).getByRole('button', { name: 'Pausar', exact: true }).click()
  const dialogo = page.getByRole('dialog')
  await dialogo.getByRole('button', { name: 'Pausar pedido' }).click()
  await expect(dialogo.getByText(/Escribe por qué se pausa/)).toBeVisible()
  await dialogo.getByRole('textbox', { name: 'Motivo' }).fill('Falta el logotipo en vectores')
  await dialogo.getByRole('button', { name: 'Pausar pedido' }).click()
  await expect(page.getByText('Motivo: Falta el logotipo en vectores')).toBeVisible()
  await etapa(page).getByRole('button', { name: /^Reanudar en diseño$/ }).click()
  await expect(etapa(page).getByText('En diseño', { exact: true })).toBeVisible()

  // Sube un diseño: queda v1 por aprobar y el pedido pasa solo a "Esperando aprobación"
  await page.locator('[data-subir-archivo]').setInputFiles({ name: 'prueba-lona.png', mimeType: 'image/png', buffer: pngPequeno() })
  await expect(page.getByText('prueba-lona.png', { exact: true })).toBeVisible()
  await expect(page.getByText('Diseño v1', { exact: false }).first()).toBeVisible()
  await expect(etapa(page).getByText('Esperando aprobación', { exact: true })).toBeVisible()

  // Registra la aprobación del cliente: la base pasa el pedido a "Aprobado"
  await page.getByRole('button', { name: 'Registrar respuesta' }).click()
  await page.getByRole('dialog').getByLabel('¿Quién respondió?').fill('Laura Pérez')
  await page.getByRole('dialog').getByRole('button', { name: 'Registrar aprobación' }).click()
  await expect(page.getByText('Aprobó: Laura Pérez')).toBeVisible()
  await expect(etapa(page).getByText('Aprobado', { exact: true }).first()).toBeVisible()

  // Factura con folio CFDI (si el cliente no la pedía, se activa primero)
  const requiere = page.getByRole('switch', { name: 'El cliente pide factura' })
  if ((await requiere.getAttribute('aria-checked')) !== 'true') await requiere.click()
  await page.getByLabel('Folio CFDI').fill('E2E-777')
  await page.getByRole('button', { name: 'Marcar facturado' }).click()
  await expect(page.getByText('E2E-777', { exact: true })).toBeVisible()
  await expect(page.getByText('Facturado', { exact: true }).first()).toBeVisible()

  // Historial
  await expect(page.getByText('Marcado como facturado (folio E2E-777)')).toBeVisible()
  sinErrores()
})

test('producción ve el pedido sin montos, cambia de etapa y no puede cancelar', async ({ page }) => {
  const sinErrores = vigilarErrores(page)
  const p = await crearPedido()
  await entrar(page, 'produccion')

  await page.goto('/pedidos')
  await page.getByLabel(/Buscar pedidos/).fill(p.pedidoFolio)
  await expect(page.getByRole('link', { name: p.pedidoFolio }).first()).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Saldo' })).toHaveCount(0)
  await expect(page.getByText(/\$\d/)).toHaveCount(0)

  await page.getByRole('link', { name: p.pedidoFolio }).first().click()
  await expect(page.getByRole('heading', { name: p.cliente })).toBeVisible()
  await expect(page.getByText('Lona impresa 13 oz').first()).toBeVisible()
  await expect(page.getByText(/\$\d/)).toHaveCount(0)
  await expect(page.getByText('Total del pedido')).toHaveCount(0)

  await etapa(page).getByRole('button', { name: 'Empezar diseño' }).click()
  await expect(etapa(page).getByText('En diseño', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cancelar pedido' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Pausar', exact: true })).toBeVisible()

  // La base también lo impide
  const db = await clienteComo('produccion')
  const { error } = await db.rpc('cambiar_estado_pedido', { p_pedido: p.pedidoId, p_estado: 'cancelado', p_motivo: 'prueba' })
  expect(error?.message).toMatch(/Solo ventas o administración/)
  sinErrores()
})
