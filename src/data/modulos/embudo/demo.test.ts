import { afterEach, describe, expect, it } from 'vitest'
import { entrarComo, salir } from '@/data/demo/paraPruebas'
import { embudoDemo as api } from './demo'

afterEach(salir)

describe('embudo · vista previa', () => {
  it('tablero y resumen como el panel', async () => {
    entrarComo('ventas')
    const ops = await api.oportunidades.listar()
    expect(ops).toHaveLength(21)
    expect(ops[0].id).toBe('o2') // la próxima acción más atrasada primero
    const r = await api.oportunidades.resumen()
    expect(r.prospecto_nuevo).toEqual({ cantidad: 4, valor: 18400 })
    expect((await api.oportunidades.listar({ cerradas: 'todas' })).length).toBe(23)
    const d = await api.oportunidades.obtener('o1')
    expect(d.cotizaciones.map((c) => c.folio)).toEqual(['COT-0004'])
  })

  it('mover a perdido exige motivo y cierra la oportunidad', async () => {
    entrarComo('ventas')
    await expect(api.oportunidades.moverEtapa('o3', 'perdido')).rejects.toThrow('motivo')
    const o = await api.oportunidades.moverEtapa('o3', 'perdido', 'No contestó')
    expect(o.cerrada_at).not.toBeNull()
    const reabierta = await api.oportunidades.moverEtapa('o3', 'contactado')
    expect(reabierta.cerrada_at).toBeNull()
    expect(reabierta.motivo_perdida).toBeNull()
  })

  it('crear y permisos', async () => {
    entrarComo('ventas')
    const o = await api.oportunidades.crear({ cliente_id: 'c12', titulo: 'Tarjetas', valor_estimado: 1200 })
    expect(o.responsable).toBe('Luis Herrera')
    await expect(api.oportunidades.eliminar(o.id)).rejects.toThrow('No tienes permiso')
    entrarComo('diseno')
    await expect(api.oportunidades.listar()).rejects.toThrow('No tienes permiso')
  })
})
