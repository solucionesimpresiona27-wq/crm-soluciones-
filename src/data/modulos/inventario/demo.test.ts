import { afterEach, describe, expect, it } from 'vitest'
import { cambiarA, entrarComo, salir } from '@/data/demo/paraPruebas'
import { inventarioDemo as api } from './demo'

afterEach(salir)

describe('inventario · vista previa', () => {
  it('materiales, stock bajo y kárdex; el costo solo con ver_costos', async () => {
    entrarComo('produccion')
    const mats = await api.materiales.listar()
    expect(mats.length).toBe(13)
    expect(mats.every((m) => m.costo_unitario === null)).toBe(true)
    expect((await api.inventario.stockBajo()).map((m) => m.nombre)).toEqual([
      'Lona front 13 oz',
      'Papel couché 150 g tabloide',
      'Tinta eco-solvente magenta',
      'Vinil esmerilado',
    ])
    const kardex = await api.inventario.movimientos({ materialId: 'mat-lona' })
    expect(kardex[0].existencia_resultante).toBe(38)
    cambiarA('admin')
    expect((await api.materiales.obtener('mat-lona')).costo_unitario).toBe(38)
  })

  it('producción registra consumos pero no entradas; no se deja existencia negativa', async () => {
    entrarComo('produccion')
    await api.inventario.registrar({ material_id: 'mat-vinil', tipo: 'consumo', cantidad: 4, pedido_id: 'demo-ped-h' })
    expect((await api.materiales.obtener('mat-vinil')).existencia).toBe(60)
    await expect(api.inventario.registrar({ material_id: 'mat-vinil', tipo: 'entrada', cantidad: 10 })).rejects.toThrow('No tienes permiso')
    await expect(api.inventario.registrar({ material_id: 'mat-tinta-m', tipo: 'consumo', cantidad: 5 })).rejects.toThrow('No hay suficiente existencia')
  })

  it('administración: alta con existencia inicial, ajuste y entrada', async () => {
    entrarComo('admin')
    const m = await api.materiales.crear({ nombre: 'Vinil negro mate', unidad: 'm2', stock_minimo: 10, existencia_inicial: 25, costo_unitario: 45 })
    expect(m.existencia).toBe(25)
    expect(m.costo_unitario).toBe(45)
    const ajuste = await api.inventario.ajustar(m.id, 20, 'Conteo')
    expect(ajuste.diferencia).toBe(-5)
    await api.inventario.registrar({ material_id: m.id, tipo: 'entrada', cantidad: 30, proveedor_id: 'prov-vinil' })
    expect((await api.materiales.obtener(m.id)).existencia).toBe(50)
    await expect(api.materiales.eliminar(m.id)).rejects.toThrow('desactívalo')
  })

  it('gastos y proveedores con sus permisos', async () => {
    entrarComo('ventas')
    await expect(api.gastos.listar()).rejects.toThrow('No tienes permiso')
    await expect(api.proveedores.listar()).rejects.toThrow('No tienes permiso')
    cambiarA('admin')
    const gastos = await api.gastos.listar({ pedidoId: 'demo-ped-d' })
    expect(gastos.map((g) => g.monto).sort((x, y) => x - y)).toEqual([185, 2200])
    const g = await api.gastos.registrar({ concepto: 'Cinta doble cara', categoria: 'material', monto: 120, metodo_pago: 'efectivo' })
    await expect(api.gastos.cancelar(g.id, ' ')).rejects.toThrow('motivo')
    await api.gastos.cancelar(g.id, 'Error de captura')
    expect((await api.gastos.listar()).some((x) => x.id === g.id)).toBe(false)
    const prov = await api.proveedores.crear({ nombre: 'Tornillos del Centro', rfc: 'tdc' })
    expect(prov.rfc).toBe('TDC')
  })
})
