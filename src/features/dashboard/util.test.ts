import { describe, expect, it } from 'vitest'
import { cuandoEntrega } from './util'

describe('cuandoEntrega', () => {
  const hoy = '2026-10-19'
  it('describe entregas próximas', () => {
    expect(cuandoEntrega('2026-10-19', hoy)).toEqual({ texto: 'Hoy', atrasado: false })
    expect(cuandoEntrega('2026-10-20', hoy)).toEqual({ texto: 'Mañana', atrasado: false })
    expect(cuandoEntrega('2026-10-23', hoy).texto).toBe('En 4 días')
  })
  it('resume los atrasos largos en meses o años', () => {
    expect(cuandoEntrega('2026-10-18', hoy)).toEqual({ texto: 'Atrasado 1 día', atrasado: true })
    expect(cuandoEntrega('2026-10-15', hoy).texto).toBe('Atrasado 4 días')
    expect(cuandoEntrega('2026-07-01', hoy).texto).toBe('Atrasado 3 meses')
    expect(cuandoEntrega('2025-06-01', hoy).texto).toBe('Atrasado más de un año')
    expect(cuandoEntrega('2002-06-01', hoy).texto).toBe('Atrasado más de 24 años')
  })
})
