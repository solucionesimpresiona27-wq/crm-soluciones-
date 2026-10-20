import { describe, expect, it } from 'vitest'
import type { CotizacionCompleta } from '@/data/tipos'
import { hitosCotizacion } from './calculos'

const base = {
  id: 'c1',
  folio: 'COT-0001',
  fecha_vencimiento: '2026-11-03',
  estado: 'borrador',
  motivo_rechazo: null,
  pedido_folio: null,
  enviada_at: null,
  aceptada_at: null,
  created_at: '2026-10-19T15:00:00Z',
  vendedor: null,
  partidas: [],
} as unknown as CotizacionCompleta

const claves = (c: Partial<CotizacionCompleta>, visible: Parameters<typeof hitosCotizacion>[1] = 'borrador') =>
  hitosCotizacion({ ...base, ...c }, visible).map((h) => `${h.clave}:${h.tono}`)

describe('hitosCotizacion', () => {
  it('un borrador marca el envío como pendiente', () => {
    expect(claves({})).toEqual(['creada:hecho', 'enviada:pendiente', 'aceptada:pendiente', 'pedido:pendiente'])
  })

  it('una cotización aceptada sin fecha de envío no dice que falta enviarla', () => {
    const h = claves({ estado: 'aceptada', aceptada_at: '2026-10-19T16:00:00Z', pedido_folio: 'PED-0001' }, 'aceptada')
    expect(h).toEqual(['creada:hecho', 'aceptada:hecho', 'pedido:hecho'])
  })

  it('con fecha de envío la muestra como hecha', () => {
    expect(claves({ estado: 'enviada', enviada_at: '2026-10-19T16:00:00Z' }, 'enviada')).toContain('enviada:hecho')
  })
})
