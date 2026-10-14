import { afterEach, describe, expect, it } from 'vitest'
import { cambiarA, entrarComo, salir } from '@/data/demo/paraPruebas'
import { reportesDemo as api } from './demo'

afterEach(salir)

describe('reportes · vista previa', () => {
  it('ventas por mes cuadran con la serie del panel', async () => {
    entrarComo('admin')
    const meses = await api.reportes.ventas('2026-05-01', '2026-10-31', 'mes')
    expect(meses.map((m) => [m.periodo, m.vendido, m.cobrado])).toEqual([
      ['2026-05-01', 84200, 71500],
      ['2026-06-01', 96400, 88100],
      ['2026-07-01', 78900, 80300],
      ['2026-08-01', 112300, 97600],
      ['2026-09-01', 104800, 101200],
      ['2026-10-01', 121650, 86420],
    ])
    const semanas = await api.reportes.ventas('2026-10-01', '2026-10-13', 'semana')
    expect(semanas[0].periodo).toBe('2026-09-28')
  })

  it('productos, vendedores, clientes y utilidad', async () => {
    entrarComo('admin')
    const productos = await api.reportes.productos('2026-10-01', '2026-10-31')
    expect(productos[0].producto).toBe('Lona impresa')
    const vendedores = await api.reportes.vendedores('2026-10-01', '2026-10-31')
    expect(vendedores.map((v) => v.nombre).sort()).toEqual(['Ana Ramírez', 'Luis Herrera'])
    const clientes = await api.reportes.clientes('2026-05-01', '2026-10-31', 3)
    expect(clientes[0].nombre).toBe('Inmobiliaria Horizonte')
    const utilidad = await api.reportes.utilidad('2026-10-01', '2026-10-31')
    const letras = utilidad.find((u) => u.folio === 'PED-0041')!
    expect(letras.gastos).toBe(2385)
    expect(letras.consumo_material).toBe(1960)
    expect(letras.costo_estimado).toBe(8700)
  })

  it('permisos: ventas no ve reportes; utilidad exige ver_costos', async () => {
    entrarComo('ventas')
    await expect(api.reportes.ventas('2026-10-01', '2026-10-31')).rejects.toThrow('No tienes permiso')
    cambiarA('admin')
    await expect(api.reportes.ventas('2026-10-31', '2026-10-01')).rejects.toThrow('posterior')
  })
})
