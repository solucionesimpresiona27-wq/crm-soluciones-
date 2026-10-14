import { describe, expect, it } from 'vitest'
import type { Oportunidad } from '@/data/modulos/embudo/contrato'
import { diasDesde, estadoAccion, metricas, porEtapa } from './util'

const op = (p: Partial<Oportunidad>): Oportunidad =>
  ({ id: Math.random().toString(), etapa: 'contactado', valor_estimado: null, proxima_accion_fecha: null, cerrada_at: null, updated_at: '2026-10-01T10:00:00Z', ...p }) as Oportunidad

describe('embudo/util', () => {
  it('clasifica la próxima acción', () => {
    expect(estadoAccion('2026-10-13', '2026-10-14')).toBe('atrasada')
    expect(estadoAccion('2026-10-14', '2026-10-14')).toBe('hoy')
    expect(estadoAccion('2026-10-20', '2026-10-14')).toBe('proxima')
    expect(estadoAccion(null, '2026-10-14')).toBeNull()
  })
  it('cuenta días', () => expect(diasDesde('2026-10-01T23:00:00Z', '2026-10-14')).toBe(13))
  it('calcula métricas', () => {
    const m = metricas(
      [
        op({ valor_estimado: 1000, proxima_accion_fecha: '2026-10-15' }),
        op({ valor_estimado: 500 }),
        op({ etapa: 'ganado', cerrada_at: '2026-09-01T00:00:00Z', valor_estimado: 9999 }),
        op({ etapa: 'perdido', cerrada_at: '2026-08-01T00:00:00Z' }),
        op({ etapa: 'perdido', cerrada_at: '2026-01-01T00:00:00Z' }),
      ],
      '2026-10-14',
    )
    expect(m).toMatchObject({ valorEnJuego: 1500, abiertas: 2, sinAccion: 1, ganadas90: 1, perdidas90: 1, tasaCierre: 0.5 })
  })
  it('agrupa solo cerradas del mes', () => {
    const g = porEtapa([op({}), op({ etapa: 'ganado', cerrada_at: '2026-10-02T00:00:00Z' }), op({ etapa: 'ganado', cerrada_at: '2026-09-02T00:00:00Z' })], '2026-10-01T00:00:00Z')
    expect(g.contactado).toHaveLength(1)
    expect(g.ganado).toHaveLength(1)
  })
})
