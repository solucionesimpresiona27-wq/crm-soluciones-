import { afterEach, describe, expect, it } from 'vitest'
import { almacen } from '@/data/demo/almacen'
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

  it('diseño y producción ligan tareas solo a clientes con pedidos (los que encuentran en el buscador)', async () => {
    const conPedidos = (id: string) => almacen.pedidos.some((p) => p.cliente_id === id)
    const sinPedidos = almacen.clientes.find((c) => c.activo && !conPedidos(c.id))!
    const conPedido = almacen.clientes.find((c) => c.activo && conPedidos(c.id))!
    for (const rol of ['diseno', 'produccion'] as const) {
      entrarComo(rol)
      expect((await api.tareas.buscarClientes(conPedido.nombre.slice(0, 6))).map((c) => c.id), rol).toContain(conPedido.id)
      expect((await api.tareas.buscarClientes(sinPedidos.nombre)).map((c) => c.id), rol).not.toContain(sinPedidos.id)
      const t = await api.tareas.crear({ titulo: 'Llevar muestras', cliente_id: conPedido.id })
      expect(t.cliente).toBe(conPedido.nombre)
      await expect(api.tareas.crear({ titulo: 'Preguntar por un cliente', cliente_id: sinPedidos.id })).rejects.toThrow('clientes con pedidos')
      await expect(api.tareas.actualizar(t.id, { cliente_id: sinPedidos.id })).rejects.toThrow('clientes con pedidos')
      salir()
    }
    // Ventas encuentra y liga a cualquier cliente; quien no lo ve puede completar la tarea sin perder la liga
    entrarComo('ventas')
    expect((await api.tareas.buscarClientes(sinPedidos.nombre)).map((c) => c.id)).toContain(sinPedidos.id)
    const ajena = await api.tareas.crear({ titulo: 'Llamar al prospecto', cliente_id: sinPedidos.id, responsable_id: 'demo-produccion' })
    cambiarA('produccion')
    const hecha = await api.tareas.completar(ajena.id)
    expect(hecha.cliente).toBeNull()
    expect(almacen.tareas.find((x) => x.id === ajena.id)?.cliente_id).toBe(sinPedidos.id)
    await api.tareas.actualizar(ajena.id, { titulo: 'Llamar al prospecto (hecho)' })
    expect(almacen.tareas.find((x) => x.id === ajena.id)?.cliente_id).toBe(sinPedidos.id)
  })

  it('buscador para ligar clientes: sin acentos; correo solo con permiso de clientes (como clientes_operacion.busqueda)', async () => {
    const conPedidos = (id: string) => almacen.pedidos.some((p) => p.cliente_id === id)
    const acentuado = almacen.clientes.find((c) => c.activo && conPedidos(c.id) && c.nombre !== c.nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))!
    const sinAcentos = acentuado.nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    const conCorreo = almacen.clientes.find((c) => c.activo && c.email && conPedidos(c.id))!
    for (const rol of ['admin', 'ventas', 'diseno', 'produccion'] as const) {
      entrarComo(rol)
      expect((await api.tareas.buscarClientes(sinAcentos)).map((c) => c.id), rol).toContain(acentuado.id)
      const porCorreo = (await api.tareas.buscarClientes(conCorreo.email!)).map((c) => c.id)
      if (rol === 'admin' || rol === 'ventas') expect(porCorreo, rol).toContain(conCorreo.id)
      else expect(porCorreo, rol).not.toContain(conCorreo.id)
      salir()
    }
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

  it('obtener: folio del pedido solo para quien ve pedidos', async () => {
    entrarComo('ventas')
    const t = await api.tareas.crear({ titulo: 'Confirmar medidas', pedido_id: 'demo-ped-h' })
    const folio = almacen.pedidos.find((p) => p.id === 'demo-ped-h')!.folio
    expect((await api.tareas.obtener(t.id)).folio_pedido).toBe(folio)
    cambiarA('produccion')
    expect((await api.tareas.obtener(t.id)).folio_pedido).toBeNull()
    await expect(api.tareas.obtener('no-existe')).rejects.toThrow('No se encontró la tarea')
  })
})
