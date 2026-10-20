import { describe, expect, it } from 'vitest'
import { desgloseGastos, leerNumero, nivelExistencia, nombreUnidad } from './util'

describe('inventario · utilidades', () => {
  it('nivel del medidor', () => {
    expect(nivelExistencia({ existencia: 10, stock_minimo: 10 })).toBeCloseTo(0.4)
    expect(nivelExistencia({ existencia: 100, stock_minimo: 10 })).toBe(1)
    expect(nivelExistencia({ existencia: -3, stock_minimo: 10 })).toBe(0)
    expect(nivelExistencia({ existencia: 3, stock_minimo: 0 })).toBe(1)
  })
  it('lee números con coma', () => {
    expect(leerNumero('2,5')).toBe(2.5)
    expect(leerNumero('')).toBeNull()
    expect(leerNumero('abc')).toBeNull()
  })
  it('concuerda la unidad con la cantidad', () => {
    expect(nombreUnidad(1, 'hoja')).toBe('hoja')
    expect(nombreUnidad(780, 'hoja')).toBe('hojas')
    expect(nombreUnidad(-3, 'metro')).toBe('metros')
    expect(nombreUnidad(2.5, 'millar')).toBe('millares')
    expect(nombreUnidad(0, 'pieza')).toBe('piezas')
    expect(nombreUnidad(12, 'm2')).toBe('m²')
    expect(nombreUnidad(4, 'kg')).toBe('kg')
  })
  it('desglose sin cancelados', () => {
    const d = desgloseGastos([
      { categoria: 'maquila', monto: 100, cancelado: false },
      { categoria: 'material', monto: 50.5, cancelado: false },
      { categoria: 'maquila', monto: 20, cancelado: false },
      { categoria: 'renta', monto: 999, cancelado: true },
    ])
    expect(d.total).toBe(170.5)
    expect(d.categorias[0]).toEqual({ categoria: 'maquila', monto: 120, cuantos: 2 })
  })
})
