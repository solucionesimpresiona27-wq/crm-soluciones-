import { afterEach, describe, expect, it } from 'vitest'
import { almacen } from '@/data/demo/almacen'
import { cambiarA, entrarComo, salir } from '@/data/demo/paraPruebas'
import { pagosDemo as api } from './demo'

afterEach(salir)

describe('pagos · vista previa', () => {
  it('lista, cobranza y comisiones', async () => {
    entrarComo('admin')
    const delPedido = await api.pagos.porPedido('demo-ped-k')
    expect(delPedido.map((p) => p.tipo)).toEqual(['anticipo', 'devolucion'])
    const cxc = await api.cobranza.cuentasPorCobrar()
    expect(cxc).toHaveLength(12)
    expect(cxc[0].vencido).toBe(true)
    expect(cxc.slice(0, 2).map((c) => c.folio).sort()).toEqual(['PED-0033', 'PED-0035'])
    const comisiones = await api.comisiones.resumen('2026-10-01', '2026-10-31')
    const luis = comisiones.find((c) => c.nombre === 'Luis Herrera')!
    expect(luis.comision_pct).toBe(5)
    expect(luis.comision).toBeCloseTo(luis.base_comision * 0.05, 1)
    cambiarA('ventas')
    const propias = await api.comisiones.resumen('2026-10-01', '2026-10-31')
    expect(propias.map((c) => c.nombre)).toEqual(['Luis Herrera'])
  })

  it('registrar y cancelar actualizan el pedido', async () => {
    entrarComo('ventas')
    const p = await api.pagos.registrar({ pedido_id: 'demo-ped-e', importe: 1740, tipo: 'anticipo', metodo: 'transferencia', referencia: 'SPEI 1' })
    const pedido = almacen.pedidos.find((x) => x.id === 'demo-ped-e')!
    expect(pedido.estado_pago).toBe('anticipo')
    expect(pedido.saldo).toBe(1740)
    await expect(api.pagos.cancelar(p.id, 'Error')).rejects.toThrow('No tienes permiso')
    cambiarA('admin')
    await api.pagos.cancelar(p.id, 'Se capturó dos veces')
    expect(pedido.estado_pago).toBe('pendiente')
    await expect(api.pagos.registrar({ pedido_id: 'demo-ped-k', importe: 10, metodo: 'efectivo' })).rejects.toThrow('cancelado')
  })

  it('corte de caja: cerrar bloquea efectivo de ese día para no administradores', async () => {
    entrarComo('ventas')
    const r = await api.caja.resumen()
    expect(r.efectivo.entradas).toBe(870)
    expect(r.efectivo.gastos).toBe(450)
    expect(r.efectivo_inicial_sugerido).not.toBeNull()
    const corte = await api.caja.cerrar({ fecha: r.fecha, efectivo_inicial: r.efectivo_inicial, efectivo_contado: r.esperado })
    expect(corte.diferencia).toBe(0)
    await expect(api.pagos.registrar({ pedido_id: 'demo-ped-j', importe: 100, metodo: 'efectivo' })).rejects.toThrow('ya está cerrada')
    await api.pagos.registrar({ pedido_id: 'demo-ped-j', importe: 100, metodo: 'transferencia' })
    await expect(api.caja.reabrir(r.fecha, 'Faltó un pago')).rejects.toThrow('Solo un administrador')
    cambiarA('admin')
    await api.caja.reabrir(r.fecha, 'Faltó un pago')
    expect((await api.caja.cortes()).some((c) => c.fecha === r.fecha)).toBe(false)
  })

  it('diseño no ve pagos', async () => {
    entrarComo('diseno')
    await expect(api.pagos.listar()).rejects.toThrow('No tienes permiso')
    await expect(api.caja.resumen()).rejects.toThrow('No tienes permiso')
  })

  it('sin ver_precios tampoco hay comisiones (lo cobrado es un monto de venta)', async () => {
    for (const rol of ['diseno', 'produccion'] as const) {
      entrarComo(rol)
      await expect(api.comisiones.resumen('2026-10-01', '2026-10-31')).rejects.toThrow('ver precios')
      await expect(api.comisiones.detalle('2026-10-01', '2026-10-31')).rejects.toThrow('ver precios')
      salir()
    }
    entrarComo('ventas')
    expect(Array.isArray(await api.comisiones.resumen('2026-10-01', '2026-10-31'))).toBe(true)
  })
})
