import { afterEach, describe, expect, it } from 'vitest'
import { cambiarA, entrarComo, salir } from '@/data/demo/paraPruebas'
import { agendaDemo as api } from './demo'

afterEach(salir)

describe('agenda · vista previa', () => {
  it('mis pendientes de hoy incluyen las atrasadas', async () => {
    entrarComo('ventas')
    const mias = await api.tareas.misPendientes()
    expect(mias.map((t) => t.titulo)).toEqual(['Cobrar el saldo del banner para expo', 'Confirmar diseño de playeras con Gimnasio Titán'])
    expect(mias[0].vencida).toBe(true)
    expect(mias[0].cliente).toBe('Boutique Lirio')
  })

  it('crear, completar y permisos', async () => {
    entrarComo('diseno')
    const t = await api.tareas.crear({ titulo: 'Mandar prueba de color', pedido_id: 'demo-ped-h', hora: '12:00' })
    expect(t.cliente_id).toBe('c7')
    const hecha = await api.tareas.completar(t.id)
    expect(hecha.completada).toBe(true)
    expect(hecha.completada_por).toBe('demo-diseno')
    cambiarA('produccion')
    await expect(api.tareas.eliminar(t.id)).rejects.toThrow('Solo quien creó')
  })

  it('calendario combinado según permisos', async () => {
    entrarComo('admin')
    const todo = await api.agenda.calendario('2026-10-01', '2026-10-31')
    const origenes = new Set(todo.map((e) => e.origen))
    expect([...origenes].sort()).toEqual(['cotizacion', 'entrega', 'instalacion', 'seguimiento', 'tarea'])
    cambiarA('produccion')
    const prod = await api.agenda.calendario('2026-10-01', '2026-10-31')
    expect(prod.some((e) => e.origen === 'seguimiento' || e.origen === 'cotizacion')).toBe(false)
    await expect(api.agenda.calendario('2026-01-01', '2027-06-01')).rejects.toThrow('un año')
  })
})
