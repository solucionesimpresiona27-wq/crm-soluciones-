/** MÓDULO CATÁLOGO · implementación de la vista previa (almacén en memoria, datos ficticios). */
import { almacen as a, copia, nuevoId } from '@/data/demo/almacen'
import { ahoraISO, busquedaDe, diferencias, registrarBitacora } from '@/data/demo/reglas'
import { espera, exigir, puede, sesionDemo, usuario } from '@/data/demo/sesion'
import { normalizar } from '@/lib/utils'
import type { ApiCatalogo, DatosProducto, Escala, PrecioAplicado, PrecioLista, ProductoCatalogo, ProductoFicha } from './contrato'

type ProductoFila = (typeof a.productos)[number]
const limpio = (v: string | null | undefined) => (v?.trim() ? v.trim() : null)
const escalas = (v: unknown): Escala[] => (Array.isArray(v) ? (v as Escala[]).map((e) => ({ desde: Number(e.desde), precio: Number(e.precio) })) : [])

function categoriaDe(p: ProductoFila) {
  const c = a.categorias.find((x) => x.id === p.categoria_id)
  return c ? { id: c.id, nombre: c.nombre, grupo: c.grupo } : null
}

function aPrecio(f: (typeof a.producto_precios)[number]): PrecioLista {
  return { producto_id: f.producto_id, lista: f.lista as PrecioLista['lista'], precio: f.precio, precio_minimo: f.precio_minimo, escalas: escalas(f.escalas) }
}

function aFicha(p: ProductoFila): ProductoFicha {
  const { busqueda: _b, escalas: e, ...resto } = p
  const c = puede('ver_costos') ? a.producto_costos.find((x) => x.producto_id === p.id) : undefined
  return copia({
    ...resto,
    escalas: escalas(e),
    categoria: categoriaDe(p),
    costos: c
      ? { costo_material: c.costo_material, costo_mano_obra: c.costo_mano_obra, costo_fijo: c.costo_fijo, desperdicio_pct: c.desperdicio_pct, ganancia_pct: c.ganancia_pct, notas: c.notas, proveedor: c.proveedor }
      : null,
    precios: puede('ver_precios') ? a.producto_precios.filter((x) => x.producto_id === p.id).map(aPrecio) : [],
  })
}

function producto(id: string) {
  const p = a.productos.find((x) => x.id === id)
  if (!p) throw new Error('Producto no encontrado')
  return p
}

function aplicar(p: ProductoFila, d: Partial<DatosProducto>) {
  if (d.nombre !== undefined) {
    if (!d.nombre.trim()) throw new Error('Escribe el nombre del producto')
    p.nombre = d.nombre.trim()
  }
  for (const k of ['descripcion', 'sku', 'tiempo_entrega'] as const) if (d[k] !== undefined) p[k] = limpio(d[k])
  if (d.categoria_id !== undefined) p.categoria_id = d.categoria_id
  if (d.metodo_calculo !== undefined) p.metodo_calculo = d.metodo_calculo
  if (d.unidad !== undefined) p.unidad = d.unidad
  for (const k of ['precio_venta', 'precio_minimo'] as const) {
    if (d[k] !== undefined) {
      if (d[k] !== null && d[k]! < 0) throw new Error('Los precios no pueden ser negativos')
      p[k] = d[k] ?? null
    }
  }
  if (d.escalas !== undefined) p.escalas = [...d.escalas].sort((x, y) => x.desde - y.desde)
  for (const k of ['requiere_diseno', 'requiere_produccion', 'requiere_instalacion'] as const) if (d[k] !== undefined) p[k] = d[k]!
  p.busqueda = busquedaDe(p.nombre, a.categorias.find((c) => c.id === p.categoria_id)?.nombre)
  p.updated_at = ahoraISO()
}

export const catalogoDemo: ApiCatalogo = {
  catalogo: {
    async productos() {
      const conCostos = Boolean(sesionDemo()?.permisos.ver_costos)
      return a.productos
        .filter((p) => p.activo)
        .map((p): ProductoCatalogo => {
          const c = conCostos ? a.producto_costos.find((x) => x.producto_id === p.id) : undefined
          return copia({
            id: p.id,
            nombre: p.nombre,
            descripcion: p.descripcion,
            metodo_calculo: p.metodo_calculo,
            unidad: p.unidad,
            precio_venta: p.precio_venta,
            precio_minimo: p.precio_minimo,
            escalas: escalas(p.escalas),
            categoria: categoriaDe(p),
            costos: c ? { costo_material: c.costo_material, costo_mano_obra: c.costo_mano_obra, costo_fijo: c.costo_fijo, desperdicio_pct: c.desperdicio_pct, ganancia_pct: c.ganancia_pct } : null,
          })
        })
    },

    async listar(filtros = {}) {
      usuario()
      await espera(200)
      const t = normalizar(filtros.texto ?? '')
      return a.productos
        .filter((p) => filtros.incluirInactivos || p.activo)
        .filter((p) => !filtros.categoriaId || p.categoria_id === filtros.categoriaId)
        .filter((p) => !t || (p.busqueda ?? '').includes(t))
        .sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'))
        .map(aFicha)
    },

    async obtener(id) {
      usuario()
      return aFicha(producto(id))
    },

    async categorias(opciones = {}) {
      usuario()
      return copia(a.categorias.filter((c) => opciones.incluirInactivas || c.activo).sort((x, y) => x.orden - y.orden || x.nombre.localeCompare(y.nombre, 'es')))
    },

    async guardarCategoria(datos) {
      const s = exigir('editar_catalogo')
      if (!datos.nombre?.trim() || !datos.grupo?.trim()) throw new Error('Escribe el nombre y el grupo de la categoría')
      const ahora = ahoraISO()
      let c = datos.id ? a.categorias.find((x) => x.id === datos.id) : undefined
      if (datos.id && !c) throw new Error('Categoría no encontrada')
      if (!c) {
        c = { id: nuevoId('cat'), nombre: '', grupo: '', orden: 500, descripcion: null, activo: true, created_at: ahora, updated_at: ahora }
        a.categorias.push(c)
      }
      c.nombre = datos.nombre.trim()
      c.grupo = datos.grupo.trim()
      if (datos.orden !== undefined) c.orden = datos.orden
      if (datos.descripcion !== undefined) c.descripcion = limpio(datos.descripcion)
      if (datos.activo !== undefined) c.activo = datos.activo
      c.updated_at = ahora
      registrarBitacora(a, { tabla: 'categorias', registro_id: c.id, accion: datos.id ? 'modificar' : 'crear', etiqueta: c.nombre, usuario_id: s.id })
      return copia(c)
    },

    async crearProducto(datos) {
      const s = exigir('editar_catalogo')
      await espera()
      const ahora = ahoraISO()
      const p: ProductoFila = {
        id: nuevoId('pr'),
        nombre: '',
        descripcion: null,
        categoria_id: null,
        metodo_calculo: datos.metodo_calculo,
        unidad: datos.unidad,
        precio_venta: null,
        precio_minimo: null,
        escalas: [],
        sku: null,
        tiempo_entrega: null,
        requiere_diseno: true,
        requiere_produccion: true,
        requiere_instalacion: false,
        activo: true,
        busqueda: null,
        created_by: s.id,
        created_at: ahora,
        updated_at: ahora,
      }
      aplicar(p, { ...datos, nombre: datos.nombre ?? '' })
      a.productos.push(p)
      registrarBitacora(a, { tabla: 'productos', registro_id: p.id, accion: 'crear', etiqueta: p.nombre, usuario_id: s.id })
      return aFicha(p)
    },

    async actualizarProducto(id, cambios) {
      const s = exigir('editar_catalogo')
      await espera()
      const p = producto(id)
      const antes = { ...p }
      const prueba = { ...p }
      aplicar(prueba, cambios)
      Object.assign(p, prueba)
      registrarBitacora(a, { tabla: 'productos', registro_id: id, accion: 'modificar', etiqueta: p.nombre, cambios: diferencias(antes, p), usuario_id: s.id })
      return aFicha(p)
    },

    async activarProducto(id, activo) {
      const s = exigir('editar_catalogo')
      const p = producto(id)
      p.activo = activo
      p.updated_at = ahoraISO()
      registrarBitacora(a, { tabla: 'productos', registro_id: id, accion: 'modificar', etiqueta: p.nombre, cambios: { activo: [!activo, activo] }, usuario_id: s.id })
    },

    async guardarCostos(productoId, costos) {
      const s = exigir('ver_costos', 'editar_catalogo')
      const p = producto(productoId)
      for (const v of [costos.costo_material, costos.costo_mano_obra, costos.costo_fijo, costos.desperdicio_pct, costos.ganancia_pct]) {
        if (!(v >= 0)) throw new Error('Los costos y porcentajes no pueden ser negativos')
      }
      const fila = { producto_id: productoId, ...costos, notas: limpio(costos.notas), proveedor: limpio(costos.proveedor), updated_at: ahoraISO() }
      const existente = a.producto_costos.find((x) => x.producto_id === productoId)
      if (existente) Object.assign(existente, fila)
      else a.producto_costos.push(fila)
      registrarBitacora(a, { tabla: 'producto_costos', registro_id: productoId, accion: existente ? 'modificar' : 'crear', etiqueta: `Costos de ${p.nombre}`, usuario_id: s.id })
    },

    async precios(productoId) {
      exigir('ver_precios')
      return a.producto_precios.filter((x) => !productoId || x.producto_id === productoId).map(aPrecio)
    },

    async guardarPrecioLista(datos) {
      const s = exigir('editar_catalogo')
      const p = producto(datos.producto_id)
      if ((datos.lista as string) === 'publico') throw new Error('El precio público se edita en el producto')
      if (!(datos.precio >= 0)) throw new Error('El precio no puede ser negativo')
      const ahora = ahoraISO()
      const fila = { producto_id: datos.producto_id, lista: datos.lista, precio: datos.precio, precio_minimo: datos.precio_minimo, escalas: [...datos.escalas].sort((x, y) => x.desde - y.desde), updated_at: ahora }
      const existente = a.producto_precios.find((x) => x.producto_id === datos.producto_id && x.lista === datos.lista)
      if (existente) Object.assign(existente, fila)
      else a.producto_precios.push({ ...fila, created_at: ahora })
      registrarBitacora(a, { tabla: 'producto_precios', registro_id: datos.producto_id, accion: existente ? 'modificar' : 'crear', etiqueta: `Precio ${datos.lista} de ${p.nombre}`, usuario_id: s.id })
      return aPrecio(a.producto_precios.find((x) => x.producto_id === datos.producto_id && x.lista === datos.lista)!)
    },

    async eliminarPrecioLista(productoId, lista) {
      const s = exigir('editar_catalogo')
      const i = a.producto_precios.findIndex((x) => x.producto_id === productoId && x.lista === lista)
      if (i >= 0) {
        a.producto_precios.splice(i, 1)
        registrarBitacora(a, { tabla: 'producto_precios', registro_id: productoId, accion: 'eliminar', etiqueta: `Precio ${lista} de ${producto(productoId).nombre}`, usuario_id: s.id })
      }
    },

    async preciosPara(lista) {
      exigir('ver_precios')
      return a.productos
        .filter((p) => p.activo)
        .map((p): PrecioAplicado => {
          const e = lista === 'publico' ? undefined : a.producto_precios.find((x) => x.producto_id === p.id && x.lista === lista)
          return e
            ? { producto_id: p.id, lista_aplicada: lista, precio: e.precio, precio_minimo: e.precio_minimo, escalas: escalas(e.escalas) }
            : { producto_id: p.id, lista_aplicada: 'publico', precio: p.precio_venta, precio_minimo: p.precio_minimo, escalas: escalas(p.escalas) }
        })
    },
  },
}
