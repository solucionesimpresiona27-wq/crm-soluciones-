import { describe, expect, it } from 'vitest'
import { agrupacion, antiguedad, rangoReporte } from './periodo'

describe('periodos de reportes', () => {
  const hoy = '2026-10-14'
  it('este mes llega a hoy y compara con el mismo tramo', () => {
    const r = rangoReporte('mes', hoy)
    expect([r.desde, r.hasta, r.anterior.desde, r.anterior.hasta, r.agrupar]).toEqual(['2026-10-01', hoy, '2026-09-01', '2026-09-14', 'dia'])
  })
  it('mes pasado, trimestre, año y rango', () => {
    expect(rangoReporte('mesPasado', hoy)).toMatchObject({ desde: '2026-09-01', hasta: '2026-09-30', anterior: { desde: '2026-08-01', hasta: '2026-08-31' } })
    expect(rangoReporte('trimestre', hoy)).toMatchObject({ desde: '2026-10-01', anterior: { desde: '2026-07-01', hasta: '2026-07-14' } })
    expect(rangoReporte('anio', hoy)).toMatchObject({ desde: '2026-01-01', agrupar: 'mes', anterior: { desde: '2025-01-01', hasta: '2025-10-14' } })
    expect(rangoReporte('rango', hoy, { desde: '2026-10-10', hasta: '2026-10-01' })).toMatchObject({ desde: '2026-10-01', hasta: '2026-10-10', anterior: { desde: '2026-09-21', hasta: '2026-09-30' } })
    expect(rangoReporte('mes', '2026-03-31').anterior.hasta).toBe('2026-02-28')
  })
  it('agrupación y antigüedad', () => {
    expect(agrupacion({ desde: '2026-05-01', hasta: '2026-10-14' })).toBe('semana')
    const t = antiguedad([{ saldo: 100, dias_transcurridos: 0 }, { saldo: 50, dias_transcurridos: 61 }, { saldo: 5, dias_transcurridos: 200 }])
    expect(t.map((x) => x.saldo)).toEqual([100, 0, 50, 5])
  })
})
