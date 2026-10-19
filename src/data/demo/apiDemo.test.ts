import { afterEach, describe, expect, it } from 'vitest'
import apiDemo from './apiDemo'
import { almacen } from './almacen'
import { entrarComo, salir } from './paraPruebas'

afterEach(salir)

describe('vista previa · núcleo', () => {
  it('el panel de Administración da exactamente las cifras de la vista previa anterior', async () => {
    entrarComo('admin')
    const r = await apiDemo.dashboard.resumen()
    expect(r.pedidos_activos).toBe(12)
    expect(r.pedidos_atrasados).toBe(2)
    expect(r.pedidos_pausados).toBe(1)
    expect(r.disenos_pendientes).toBe(2)
    expect(r.entregas_proximas).toHaveLength(10)
    expect(r.entregas_proximas.map((e) => e.folio).slice(0, 4)).toEqual(['PED-0033', 'PED-0035', 'PED-0038', 'PED-0042'])
    expect(r.mis_pendientes.map((e) => e.folio)).toEqual(['PED-0036'])
    expect(r.cotizaciones_abiertas).toEqual({ cantidad: 6, total: 44581.35 })
    expect(r.cotizaciones_por_vencer).toHaveLength(1)
    expect(r.tasa_cierre_90d).toBe(66.7)
    expect(r.ventas_mes).toBe(121650)
    expect(r.ventas_mes_anterior).toBe(104800)
    expect(r.cobrado_mes).toBe(86420)
    expect(r.por_cobrar).toEqual({ total: 60629.28, pedidos: 12 })
    expect(r.pagos_vencidos).toEqual({ total: 5974, pedidos: 2 })
    expect(r.serie_mensual?.map((m) => [m.ventas, m.cobrado])).toEqual([
      [84200, 71500],
      [96400, 88100],
      [78900, 80300],
      [112300, 97600],
      [104800, 101200],
      [121650, 86420],
    ])
    expect(r.utilidad_estimada_mes).toEqual({ venta: 104870.69, costo: 58212.4, utilidad: 46658.29 })
    expect(r.seguimientos?.map((s) => s.id).sort()).toEqual(['o1', 'o2'])
    expect(r.embudo?.ganado).toEqual({ cantidad: 5, valor: 62800 })
    expect(r.stock_bajo?.cantidad).toBe(4)
    expect(r.caja_hoy).toEqual({ cerrada: false })
  })

  it('cada rol ve sus pendientes de siempre y nada que no le toca', async () => {
    entrarComo('ventas')
    let r = await apiDemo.dashboard.resumen()
    expect(r.mis_pendientes.map((e) => e.folio)).toEqual(['PED-0035'])
    expect(r.ventas_mes).toBeUndefined()
    entrarComo('diseno')
    r = await apiDemo.dashboard.resumen()
    expect(r.mis_pendientes.map((e) => e.folio)).toEqual(['PED-0044', 'PED-0046', 'PED-0040'])
    expect(r.cotizaciones_abiertas).toBeUndefined()
    entrarComo('produccion')
    r = await apiDemo.dashboard.resumen()
    expect(r.mis_pendientes.map((e) => e.folio)).toEqual(['PED-0033', 'PED-0038', 'PED-0042', 'PED-0041', 'PED-0047', 'PED-0045', 'PED-0048'])
    expect(r.seguimientos).toBeUndefined()
    await expect(apiDemo.cotizaciones.listar()).rejects.toThrow('No tienes permiso')
  })

  it('las cotizaciones se ven como antes', async () => {
    entrarComo('admin')
    const lista = await apiDemo.cotizaciones.listar()
    expect(lista.map((c) => c.folio)).toEqual(['COT-0001', 'COT-0002', 'COT-0003', 'COT-0004', 'COT-0005', 'COT-0006', 'COT-0007', 'COT-0008', 'COT-0009', 'COT-0010'])
    const c = await apiDemo.cotizaciones.obtener('demo-cot-3')
    expect(c.pedido_folio).toBe('PED-0042')
    expect(c.total).toBe(4593.6)
  })

  it('cobrar un pago cambia el pedido, el panel y los reportes', async () => {
    entrarComo('admin')
    const antes = await apiDemo.dashboard.resumen()
    const pago = await apiDemo.pagos.registrar({ pedido_id: 'demo-ped-b', importe: 1044, tipo: 'liquidacion', metodo: 'efectivo' })
    expect(pago.folio).toBe('PED-0035')
    const pedido = almacen.pedidos.find((p) => p.id === 'demo-ped-b')!
    expect(pedido.saldo).toBe(0)
    expect(pedido.estado_pago).toBe('liquidado')
    const despues = await apiDemo.dashboard.resumen()
    expect(despues.cobrado_mes).toBe(antes.cobrado_mes! + 1044)
    expect(despues.por_cobrar).toEqual({ total: 59585.28, pedidos: 11 })
    expect(despues.pagos_vencidos).toEqual({ total: 4930, pedidos: 1 })
    const ventas = await apiDemo.reportes.ventas('2026-10-01', '2026-10-31', 'mes')
    expect(ventas[0].cobrado).toBe(86420 + 1044)
    const caja = await apiDemo.caja.resumen()
    expect(caja.efectivo.entradas).toBe(870 + 1044)
  })

  it('convertir una cotización crea el pedido con folio consecutivo y gana la oportunidad', async () => {
    entrarComo('admin')
    const { pedidoId } = await apiDemo.cotizaciones.convertir('demo-cot-1', { fechaEntrega: '2026-10-20' })
    const p = await apiDemo.pedidos.obtener(pedidoId)
    expect(p.folio).toBe('PED-0049')
    expect(p.cotizacion_folio).toBe('COT-0001')
    expect(p.partidas).toHaveLength(3)
    expect(p.total).toBe((await apiDemo.cotizaciones.obtener('demo-cot-1')).total)
    expect(almacen.oportunidades.find((o) => o.id === 'o12')?.etapa).toBe('ganado')
    const r = await apiDemo.dashboard.resumen()
    expect(r.pedidos_activos).toBe(13)
  })

  it('búsqueda global: clientes, cotizaciones y pedidos', async () => {
    entrarComo('ventas')
    const r = await apiDemo.busqueda.global('rueda')
    expect(r.clientes.map((c) => c.nombre)).toEqual(['Taller Mecánico Rueda'])
    expect(r.pedidos.length).toBeGreaterThan(0)
    entrarComo('produccion')
    expect((await apiDemo.busqueda.global('fachada')).cotizaciones).toEqual([])
    // Sin permiso de clientes: ni la sección de clientes ni pedidos encontrados por su teléfono
    expect((await apiDemo.busqueda.global('rueda')).clientes).toEqual([])
    const tel = almacen.clientes.find((c) => c.nombre === 'Taller Mecánico Rueda')!.whatsapp!
    expect((await apiDemo.busqueda.global(tel)).pedidos).toEqual([])
  })

  it('una cotización aceptada, aprobada en el portal o convertida ya no se edita; se duplica y se convierte', async () => {
    entrarComo('ventas')
    const abierta = almacen.cotizaciones.find((c) => ['borrador', 'enviada'].includes(c.estado) && !c.pedido_id && c.fecha_vencimiento >= '2026-10-13')!
    const datos = (c: (typeof almacen.cotizaciones)[number]) => ({
      id: c.id,
      cliente_id: c.cliente.id,
      titulo: `${c.titulo ?? ''} cambiada`,
      fecha: c.fecha,
      vigencia_dias: c.vigencia_dias,
      tiempo_entrega: c.tiempo_entrega,
      anticipo_pct: c.anticipo_pct,
      aplica_iva: c.aplica_iva,
      iva_pct: c.iva_pct,
      descuento_tipo: c.descuento_tipo,
      descuento_valor: c.descuento_valor,
      recargo_pct: c.recargo_pct,
      recargo_concepto: c.recargo_concepto,
      condiciones: c.condiciones ?? '',
      notas: c.notas,
      notas_internas: c.notas_internas,
      partidas: c.partidas.map((p) => ({ ...p, precio_unitario: 1 })),
    })
    // Aprobada por el cliente en el portal
    const { token } = await apiDemo.portal.crearEnlace('cotizacion', abierta.id)
    await apiDemo.portal.aprobarCotizacion(token, 'Cliente de prueba')
    const aprobada = almacen.cotizaciones.find((c) => c.id === abierta.id)!
    const totalAntes = aprobada.total
    await expect(apiDemo.cotizaciones.guardar(datos(aprobada) as never)).rejects.toThrow('aprobó esta cotización desde el portal')
    await expect(apiDemo.cotizaciones.cambiarEstado(aprobada.id, 'borrador')).rejects.toThrow('Duplícala')
    await expect(apiDemo.cotizaciones.cambiarEstado(aprobada.id, 'enviada')).rejects.toThrow('Duplícala')
    expect(almacen.cotizaciones.find((c) => c.id === abierta.id)!.total).toBe(totalAntes)
    // Duplicar sí: la copia es un borrador editable
    const copiaId = await apiDemo.cotizaciones.duplicar(aprobada.id)
    const copia = almacen.cotizaciones.find((c) => c.id === copiaId)!
    expect(copia.estado).toBe('borrador')
    await apiDemo.cotizaciones.guardar(datos(copia) as never)
    // Convertir también
    const { pedidoId } = await apiDemo.cotizaciones.convertir(aprobada.id, {})
    expect(pedidoId).toBeTruthy()
    await expect(apiDemo.cotizaciones.guardar(datos(aprobada) as never)).rejects.toThrow('ya se convirtió en el pedido')
    await expect(apiDemo.cotizaciones.cambiarEstado(aprobada.id, 'cancelada')).rejects.toThrow('ya se convirtió')
    // Aceptada a mano (sin portal): tampoco; rechazarla sí
    const otra = almacen.cotizaciones.find((c) => ['borrador', 'enviada'].includes(c.estado) && !c.pedido_id && c.id !== abierta.id && c.id !== copiaId)!
    await apiDemo.cotizaciones.cambiarEstado(otra.id, 'aceptada')
    await expect(apiDemo.cotizaciones.guardar(datos(otra) as never)).rejects.toThrow('ya fue aceptada')
    await apiDemo.cotizaciones.cambiarEstado(otra.id, 'rechazada', 'El cliente se arrepintió')
    await expect(apiDemo.cotizaciones.cambiarEstado(otra.id, 'borrador')).rejects.toThrow('ya fue aceptada')
  })
})
