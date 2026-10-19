import { afterEach, describe, expect, it } from 'vitest'
import { cambiarA, entrarComo, salir } from '@/data/demo/paraPruebas'
import { clientesDemo as api } from './demo'

afterEach(salir)

describe('clientes · vista previa', () => {
  it('lista, ficha, resumen e historial', async () => {
    entrarComo('ventas')
    const lista = await api.clientes.listar()
    expect(lista.length).toBe(17)
    expect(lista.some((c) => c.nombre === 'Papelería El Lápiz')).toBe(false)
    expect((await api.clientes.listar({ incluirInactivos: true })).length).toBe(18)
    expect((await api.clientes.listar({ lista: 'mayoreo' })).map((c) => c.id).sort()).toEqual(['c17', 'c5'])
    const c5 = await api.clientes.obtener('c5')
    expect(c5.vendedor?.nombre).toBe('Ana Ramírez')
    const r = await api.clientes.resumen('c5')
    expect(r.pedidos_activos).toBe(1)
    expect(r.saldo).toBeCloseTo(29100.48, 2)
    const h = await api.clientes.historial('c5')
    expect(h.pedidos[0].folio).toBe('PED-0044')
    expect(h.pagos.length).toBeGreaterThan(5)
  })

  it('sin ver_precios el historial no trae montos', async () => {
    entrarComo('diseno')
    const h = await api.clientes.historial('c5')
    expect(h.cotizaciones).toEqual([])
    expect(h.pagos).toEqual([])
    expect(h.pedidos.every((p) => p.total === null)).toBe(true)
    // La ficha (resumen) ya no es de Diseño: igual que resumen_cliente() en la base
    await expect(api.clientes.resumen('c5')).rejects.toThrow('No tienes permiso')
  })

  it('diseño y producción no leen clientes ni contactos; ventas y administración, sí', async () => {
    for (const rol of ['diseno', 'produccion'] as const) {
      entrarComo(rol)
      expect(await api.clientes.listar()).toEqual([])
      expect(await api.clientes.buscar('a')).toEqual([])
      expect(await api.clientes.etiquetas()).toEqual([])
      expect(await api.contactos.listar('c5')).toEqual([])
      await expect(api.clientes.obtener('c5')).rejects.toThrow('no encontrado')
      await expect(api.clientes.actualizar('c5', { telefono: '3300000000' })).rejects.toThrow('No tienes permiso')
      salir()
    }
    for (const rol of ['ventas', 'admin'] as const) {
      entrarComo(rol)
      const c5 = await api.clientes.obtener('c5')
      expect(c5.nombre).toBeTruthy()
      expect((await api.clientes.listar()).length).toBe(17)
      salir()
    }
  })

  it('crear, editar, lista de precios, contactos y actividades', async () => {
    entrarComo('ventas')
    const nuevo = await api.clientes.crear({ nombre: '  Panadería La Espiga ', whatsapp: '3300000000', rfc: 'pes200101aa1' })
    expect((await api.clientes.buscar('espiga')).map((c) => c.id)).toEqual([nuevo.id])
    const editado = await api.clientes.actualizar(nuevo.id, { etiquetas: ['panaderia', 'panaderia', ' nueva '], dias_credito: 15 })
    expect(editado.etiquetas).toEqual(['panaderia', 'nueva'])
    expect(editado.rfc).toBe('PES200101AA1')
    await api.clientes.asignarListaPrecio(nuevo.id, 'mayoreo')
    expect((await api.clientes.obtener(nuevo.id)).lista_precio).toBe('mayoreo')
    const ct = await api.contactos.crear(nuevo.id, { nombre: 'Rosa', principal: true })
    await api.contactos.crear(nuevo.id, { nombre: 'Pablo', principal: true })
    expect((await api.contactos.listar(nuevo.id)).find((x) => x.id === ct.id)?.principal).toBe(false)
    const act = await api.actividades.registrar({ cliente_id: nuevo.id, tipo: 'llamada', descripcion: 'Primera llamada' })
    expect(act.usuario).toBe('Luis Herrera')
    expect((await api.actividades.listar({ clienteId: nuevo.id })).length).toBe(1)
  })

  it('reactivación: clientes sin compras en 90 días', async () => {
    entrarComo('ventas')
    const inactivos = await api.clientes.inactivos()
    expect(inactivos.map((c) => c.nombre).sort()).toEqual(['Farmacia San Rafael', 'Hotel Vista Chapala'])
    expect(inactivos[0].dias_sin_compra).toBeGreaterThan(90)
  })

  it('permisos: producción no edita clientes; no se elimina un cliente con historial', async () => {
    entrarComo('produccion')
    await expect(api.clientes.crear({ nombre: 'X' })).rejects.toThrow('No tienes permiso')
    await expect(api.actividades.listar({ clienteId: 'c1' })).rejects.toThrow('No tienes permiso')
    cambiarA('admin')
    await expect(api.clientes.eliminar('c1')).rejects.toThrow('Desactívalo')
    await api.clientes.eliminar('c16')
    await expect(api.clientes.obtener('c16')).rejects.toThrow('no encontrado')
  })

  it('saldos por cliente y contacto principal en la lista', async () => {
    entrarComo('ventas')
    const saldos = await api.clientes.saldos()
    expect(saldos.c5).toBeCloseTo(29100.48, 2)
    const lista = await api.clientes.listar()
    expect(lista.some((c) => c.contacto_principal !== null)).toBe(true)
    cambiarA('diseno')
    expect(await api.clientes.saldos()).toEqual({})
  })
})
