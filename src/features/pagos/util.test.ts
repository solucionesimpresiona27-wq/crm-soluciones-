import { describe, expect, it } from 'vitest'
import { duracionDias, leerImporte, mesAnterior, rangoPeriodo, tipoSugerido, totalesPagos, validarImporte } from './util'

describe('pagos · utilidades', () => {
  it('periodos', () => {
    // 14 oct 2026 es miércoles
    expect(rangoPeriodo('hoy', '2026-10-14')).toEqual({ desde: '2026-10-14', hasta: '2026-10-14' })
    expect(rangoPeriodo('semana', '2026-10-14')).toEqual({ desde: '2026-10-12', hasta: '2026-10-14' })
    expect(rangoPeriodo('semana', '2026-10-18')).toEqual({ desde: '2026-10-12', hasta: '2026-10-18' })
    expect(rangoPeriodo('mes', '2026-10-14')).toEqual({ desde: '2026-10-01', hasta: '2026-10-14' })
    expect(rangoPeriodo('rango', '2026-10-14', { desde: '2026-10-10', hasta: '2026-10-02' })).toEqual({ desde: '2026-10-02', hasta: '2026-10-10' })
    expect(mesAnterior('2026-03-14')).toEqual({ desde: '2026-02-01', hasta: '2026-02-28' })
  })

  it('tipo sugerido', () => {
    expect(tipoSugerido({ pagado: 0, saldo: 1000 }, 500)).toBe('anticipo')
    expect(tipoSugerido({ pagado: 0, saldo: 1000 }, 1000)).toBe('liquidacion')
    expect(tipoSugerido({ pagado: 500, saldo: 500 }, 200)).toBe('abono')
    expect(tipoSugerido({ pagado: 500, saldo: 500 }, 500)).toBe('liquidacion')
  })

  it('valida importes', () => {
    const p = { pagado: 300, saldo: 700 }
    expect(validarImporte(null, 'abono', p)).toMatch('Escribe')
    expect(validarImporte(0, 'abono', p)).toMatch('mayor a cero')
    expect(validarImporte(800, 'abono', p)).toMatch('mayor al saldo')
    expect(validarImporte(700, 'liquidacion', p)).toBeNull()
    expect(validarImporte(400, 'devolucion', p)).toMatch('más de lo pagado')
    expect(validarImporte(300, 'devolucion', p)).toBeNull()
    expect(validarImporte(10.123, 'abono', p)).toMatch('dos decimales')
    expect(leerImporte('$1,250.50')).toBe(1250.5)
    expect(leerImporte('')).toBeNull()
  })

  it('totales con devoluciones y cancelados', () => {
    const t = totalesPagos([
      { tipo: 'anticipo', importe: 1000, metodo: 'efectivo', cancelado: false },
      { tipo: 'devolucion', importe: 200, metodo: 'efectivo', cancelado: false },
      { tipo: 'abono', importe: 500, metodo: 'transferencia', cancelado: false },
      { tipo: 'abono', importe: 999, metodo: 'transferencia', cancelado: true },
    ])
    expect(t).toMatchObject({ entradas: 1500, devoluciones: 200, neto: 1300, pagos: 3, porMetodo: { efectivo: 800, transferencia: 500 } })
  })

  it('duración legible', () => {
    expect(duracionDias(0)).toBe('0 días')
    expect(duracionDias(1)).toBe('1 día')
    expect(duracionDias(59)).toBe('59 días')
    expect(duracionDias(95)).toBe('3 meses')
    expect(duracionDias(400)).toBe('más de un año')
    expect(duracionDias(8838)).toBe('24 años')
  })
})
