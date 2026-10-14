import { afterEach, describe, expect, it } from 'vitest'
import { entrarComo, salir } from '@/data/demo/paraPruebas'
import { produccionDemo as api } from './demo'

afterEach(salir)

describe('producción · vista previa', () => {
  it('tablero sin montos aunque se tenga ver_precios', async () => {
    entrarComo('admin')
    const t = await api.produccion.tablero()
    expect(t).toHaveLength(12)
    expect(Object.keys(t[0])).not.toContain('total')
    expect(t[0].folio).toBe('PED-0033')
    const hoja = await api.produccion.orden('demo-ped-d')
    expect(hoja.partidas[0]).not.toHaveProperty('precio_unitario')
    expect(hoja.partidas[0].notas_produccion).toMatch(/negro mate/)
    expect(hoja.disenos.map((d) => d.version)).toEqual([2, 1])
  })

  it('producción mueve etapas y guarda notas; no cancela', async () => {
    entrarComo('produccion')
    await api.produccion.moverEtapa('demo-ped-d', 'listo_entrega')
    expect((await api.produccion.tablero()).find((o) => o.id === 'demo-ped-d')?.estado).toBe('listo_entrega')
    await api.produccion.guardarNotaPartida('demo-ped-d-pa1', 'Revisar luz LED')
    await api.produccion.agregarNota('demo-ped-d', 'Listo para instalar el viernes')
    const hoja = await api.produccion.orden('demo-ped-d')
    expect(hoja.partidas[0].notas_produccion).toBe('Revisar luz LED')
    expect(hoja.notas[0].mensaje).toBe('Listo para instalar el viernes')
    await expect(api.produccion.moverEtapa('demo-ped-d', 'cancelado', 'x')).rejects.toThrow('Solo ventas o administración')
  })
})
