import { afterEach, describe, expect, it } from 'vitest'
import { cambiarA, entrarComo, salir } from '@/data/demo/paraPruebas'
import { catalogoDemo as api } from './demo'

afterEach(salir)

describe('catálogo · vista previa', () => {
  it('productos para el editor: igual que antes (costos solo con ver_costos)', async () => {
    entrarComo('ventas')
    const p = await api.catalogo.productos()
    expect(p).toHaveLength(15)
    expect(p[0]).toMatchObject({ id: 'pr1', nombre: 'Lona impresa', precio_venta: 180, precio_minimo: 150, costos: null })
    expect(p.find((x) => x.id === 'pr8')?.escalas).toEqual([{ desde: 12, precio: 85 }, { desde: 50, precio: 72 }])
    cambiarA('admin')
    expect((await api.catalogo.productos())[0].costos?.costo_material).toBe(62)
  })

  it('sin ver_precios no hay catálogo ni precios (diseño y producción)', async () => {
    for (const rol of ['diseno', 'produccion'] as const) {
      entrarComo(rol)
      expect(await api.catalogo.productos()).toEqual([])
      expect(await api.catalogo.listar({ incluirInactivos: true })).toEqual([])
      await expect(api.catalogo.obtener('pr1')).rejects.toThrow('no encontrado')
      await expect(api.catalogo.preciosPara('mayoreo')).rejects.toThrow('No tienes permiso')
      await expect(api.catalogo.precios('pr1')).rejects.toThrow('No tienes permiso')
      await expect(api.catalogo.actualizarProducto('pr1', { precio_venta: 1 })).rejects.toThrow('No tienes permiso')
      // Las categorías (sin montos) sí
      expect((await api.catalogo.categorias()).length).toBeGreaterThan(0)
      salir()
    }
    for (const rol of ['ventas', 'admin'] as const) {
      entrarComo(rol)
      expect((await api.catalogo.obtener('pr1')).precio_venta).toBe(180)
      salir()
    }
  })

  it('precios por lista con respaldo al público', async () => {
    entrarComo('ventas')
    const mayoreo = await api.catalogo.preciosPara('mayoreo')
    expect(mayoreo.find((x) => x.producto_id === 'pr1')).toMatchObject({ lista_aplicada: 'mayoreo', precio: 160 })
    expect(mayoreo.find((x) => x.producto_id === 'pr4')).toMatchObject({ lista_aplicada: 'publico', precio: 420 })
    await expect(api.catalogo.guardarPrecioLista({ producto_id: 'pr4', lista: 'mayoreo', precio: 380, precio_minimo: null, escalas: [] })).rejects.toThrow('No tienes permiso')
    cambiarA('admin')
    await api.catalogo.guardarPrecioLista({ producto_id: 'pr4', lista: 'mayoreo', precio: 380, precio_minimo: null, escalas: [] })
    expect((await api.catalogo.preciosPara('mayoreo')).find((x) => x.producto_id === 'pr4')?.precio).toBe(380)
    await api.catalogo.eliminarPrecioLista('pr4', 'mayoreo')
    expect((await api.catalogo.precios('pr4')).length).toBe(0)
  })

  it('alta de producto sin precio y categorías', async () => {
    entrarComo('admin')
    const cats = await api.catalogo.categorias()
    expect(cats[0].nombre).toBe('Vinil')
    const p = await api.catalogo.crearProducto({ nombre: 'Lona mesh', metodo_calculo: 'm2', unidad: 'm²', categoria_id: cats[1].id })
    expect(p.precio_venta).toBeNull()
    expect(p.categoria?.nombre).toBe('Lonas y gran formato')
    await api.catalogo.guardarCostos(p.id, { costo_material: 50, costo_mano_obra: 10, costo_fijo: 0, desperdicio_pct: 5, ganancia_pct: 100 })
    expect((await api.catalogo.obtener(p.id)).costos?.costo_material).toBe(50)
  })
})
