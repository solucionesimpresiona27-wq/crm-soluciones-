import { afterEach, describe, expect, it } from 'vitest'
import { almacen } from '@/data/demo/almacen'
import { cambiarA, entrarComo, salir } from '@/data/demo/paraPruebas'
import { pedidosDemo as api } from './demo'

afterEach(salir)

describe('pedidos · vista previa', () => {
  it('lista y detalle; sin ver_precios no hay montos', async () => {
    entrarComo('admin')
    const activos = await api.pedidos.listar()
    expect(activos.map((p) => p.folio)).toContain('PED-0044')
    expect(activos.some((p) => p.estado === 'finalizado')).toBe(false)
    const d = await api.pedidos.obtener('demo-ped-5')
    expect(d.montos?.total).toBe(58200.48)
    expect(d.partidas).toHaveLength(4)
    expect(d.partidas[0].costos?.costo_total).toBe(6800)
    expect(d.cotizacion_folio).toBe('COT-0005')
    cambiarA('produccion')
    const sinPrecios = await api.pedidos.obtener('demo-ped-5')
    expect(sinPrecios.montos).toBeNull()
    expect(sinPrecios.total).toBeNull()
    expect(sinPrecios.partidas[0].precio_unitario).toBeNull()
    expect(sinPrecios.partidas[0].costos).toBeNull()
  })

  it('crear pedido directo y cambiar de etapa con su línea de tiempo', async () => {
    entrarComo('ventas')
    const { id, folio } = await api.pedidos.crear({
      cliente_id: 'c1',
      titulo: 'Lona para evento',
      fecha_entrega: '2026-10-20',
      partidas: [{ concepto: 'Lona 3 × 2 m', metodo_calculo: 'm2', ancho: 3, alto: 2, cantidad: 1, precio_unitario: 1080, producto_id: 'pr1' }],
    })
    expect(folio).toBe('PED-0049')
    const d = await api.pedidos.obtener(id)
    expect(d.montos?.total).toBe(1252.8)
    expect(d.etapas_omitidas).toEqual(['en_instalacion'])
    await expect(api.pedidos.cambiarEstado(id, 'pausado')).rejects.toThrow('motivo')
    await api.pedidos.cambiarEstado(id, 'en_diseno')
    const eventos = await api.pedidos.eventos(id)
    expect(eventos.map((e) => e.tipo)).toEqual(['creado', 'estado'])
    cambiarA('produccion')
    await expect(api.pedidos.cambiarEstado(id, 'cancelado', 'x')).rejects.toThrow('Solo ventas o administración')
  })

  it('diseños: subir deja el pedido esperando aprobación; aprobar lo avanza', async () => {
    entrarComo('diseno')
    const archivo = await api.archivos.subir('demo-ped-c', new Blob(['png'], { type: 'image/png' }), { nombre: 'Playeras v2.png' })
    expect(archivo.version).toBe(2)
    expect(archivo.estado_aprobacion).toBe('pendiente')
    expect(almacen.pedidos.find((p) => p.id === 'demo-ped-c')?.estado).toBe('esperando_aprobacion')
    await api.archivos.registrarAprobacion(archivo.id, { estado: 'aprobado', aprobado_por_nombre: 'Gimnasio Titán' })
    expect(almacen.pedidos.find((p) => p.id === 'demo-ped-c')?.estado).toBe('aprobado')
    expect(await api.archivos.url(archivo.id)).toMatch(/^(blob:|data:)/)
    cambiarA('produccion')
    await expect(api.archivos.registrarAprobacion(archivo.id, { estado: 'cambios', aprobado_por_nombre: 'X' })).rejects.toThrow('No tienes permiso')
  })

  it('facturación externa', async () => {
    entrarComo('admin')
    await api.pedidos.facturar('demo-ped-3', { facturado: true, folio_factura: 'A-0200' })
    const d = await api.pedidos.obtener('demo-ped-3')
    expect(d.facturado).toBe(true)
    expect(d.folio_factura).toBe('A-0200')
    expect((await api.pedidos.eventos('demo-ped-3')).some((e) => e.tipo === 'factura')).toBe(true)
  })
})
