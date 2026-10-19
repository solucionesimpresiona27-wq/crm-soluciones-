/** MÓDULO CATÁLOGO · implementación real (Supabase). */
import { limpio, mensajeError, n, nn, revisar, sinError, supabase, textoBusqueda } from '@/data/comun/real'
import type { Json, TablesUpdate } from '@/lib/database.types'
import type { ApiCatalogo, DatosProducto, Escala, PrecioAplicado, PrecioLista, ProductoCatalogo, ProductoFicha } from './contrato'

const CAMPOS_FICHA = '*, categoria:categorias(id, nombre, grupo), costos:producto_costos(*), precios:producto_precios(*)'

const escalas = (v: unknown): Escala[] => (Array.isArray(v) ? (v as Escala[]).map((e) => ({ desde: n(e.desde), precio: n(e.precio) })) : [])

function aPrecio(f: Record<string, unknown>): PrecioLista {
  return { producto_id: f.producto_id as string, lista: f.lista as PrecioLista['lista'], precio: n(f.precio), precio_minimo: nn(f.precio_minimo), escalas: escalas(f.escalas) }
}

function aFicha(f: Record<string, unknown>): ProductoFicha {
  const { categoria, costos, precios, busqueda: _b, ...p } = f as Record<string, unknown> & {
    categoria: ProductoFicha['categoria']
    costos: Record<string, unknown> | Array<Record<string, unknown>> | null
    precios: Array<Record<string, unknown>> | null
  }
  const c = Array.isArray(costos) ? costos[0] : costos
  return {
    ...(p as unknown as ProductoFicha),
    precio_venta: nn(p.precio_venta),
    precio_minimo: nn(p.precio_minimo),
    escalas: escalas(p.escalas),
    categoria: categoria ?? null,
    costos: c
      ? {
          costo_material: n(c.costo_material),
          costo_mano_obra: n(c.costo_mano_obra),
          costo_fijo: n(c.costo_fijo),
          desperdicio_pct: n(c.desperdicio_pct),
          ganancia_pct: n(c.ganancia_pct),
          notas: (c.notas as string) ?? null,
          proveedor: (c.proveedor as string) ?? null,
        }
      : null,
    precios: (precios ?? []).map(aPrecio),
  }
}

function filaProducto(d: Partial<DatosProducto>): TablesUpdate<'productos'> {
  const f: TablesUpdate<'productos'> = {}
  if (d.nombre !== undefined) f.nombre = d.nombre.trim()
  for (const k of ['descripcion', 'sku', 'tiempo_entrega'] as const) if (d[k] !== undefined) f[k] = limpio(d[k])
  for (const k of ['categoria_id', 'metodo_calculo', 'unidad', 'precio_venta', 'precio_minimo', 'requiere_diseno', 'requiere_produccion', 'requiere_instalacion'] as const) {
    if (d[k] !== undefined) (f as Record<string, unknown>)[k] = d[k]
  }
  if (d.escalas !== undefined) f.escalas = [...d.escalas].sort((x, y) => x.desde - y.desde) as unknown as NonNullable<Json>
  return f
}

async function obtenerFicha(id: string) {
  // Sin "ver_precios" la base no entrega productos (llevan el precio público): igual que si no existiera
  const r = await supabase().from('productos').select(CAMPOS_FICHA).eq('id', id).maybeSingle()
  if (r.error) throw new Error(mensajeError(r.error))
  if (!r.data) throw new Error('Producto no encontrado')
  return aFicha(r.data as unknown as Record<string, unknown>)
}

export const catalogoSupabase: ApiCatalogo = {
  catalogo: {
    async productos() {
      const sb = supabase()
      const [productos, costos] = await Promise.all([
        sb
          .from('productos')
          .select('id, nombre, descripcion, metodo_calculo, unidad, precio_venta, precio_minimo, escalas, categoria:categorias(id, nombre, grupo, orden)')
          .eq('activo', true)
          .order('nombre'),
        sb.from('producto_costos').select('*'),
      ])
      const lista = revisar(productos)
      const mapaCostos = new Map((costos.data ?? []).map((c) => [c.producto_id, c]))
      return lista.map((p): ProductoCatalogo => {
        const c = mapaCostos.get(p.id)
        return {
          id: p.id,
          nombre: p.nombre,
          descripcion: p.descripcion,
          metodo_calculo: p.metodo_calculo,
          unidad: p.unidad,
          precio_venta: nn(p.precio_venta),
          precio_minimo: nn(p.precio_minimo),
          escalas: Array.isArray(p.escalas) ? (p.escalas as { desde: number; precio: number }[]) : [],
          categoria: p.categoria ? { id: p.categoria.id, nombre: p.categoria.nombre, grupo: p.categoria.grupo } : null,
          costos: c
            ? {
                costo_material: n(c.costo_material),
                costo_mano_obra: n(c.costo_mano_obra),
                costo_fijo: n(c.costo_fijo),
                desperdicio_pct: n(c.desperdicio_pct),
                ganancia_pct: n(c.ganancia_pct),
              }
            : null,
        }
      })
    },

    async listar(filtros = {}) {
      let q = supabase().from('productos').select(CAMPOS_FICHA)
      if (!filtros.incluirInactivos) q = q.eq('activo', true)
      if (filtros.categoriaId) q = q.eq('categoria_id', filtros.categoriaId)
      const t = textoBusqueda(filtros.texto ?? '')
      if (t) q = q.ilike('busqueda', `%${t}%`)
      const filas = revisar(await q.order('nombre').limit(2000))
      return filas.map((f) => aFicha(f as unknown as Record<string, unknown>))
    },

    obtener: obtenerFicha,

    async categorias(opciones = {}) {
      let q = supabase().from('categorias').select('*')
      if (!opciones.incluirInactivas) q = q.eq('activo', true)
      return revisar(await q.order('orden').order('nombre'))
    },

    async guardarCategoria(datos) {
      if (!datos.nombre?.trim() || !datos.grupo?.trim()) throw new Error('Escribe el nombre y el grupo de la categoría')
      const fila = {
        nombre: datos.nombre.trim(),
        grupo: datos.grupo.trim(),
        ...(datos.orden !== undefined ? { orden: datos.orden } : {}),
        ...(datos.descripcion !== undefined ? { descripcion: limpio(datos.descripcion) } : {}),
        ...(datos.activo !== undefined ? { activo: datos.activo } : {}),
      }
      const sb = supabase()
      return revisar(datos.id ? await sb.from('categorias').update(fila).eq('id', datos.id).select('*').single() : await sb.from('categorias').insert(fila).select('*').single())
    },

    async crearProducto(datos) {
      if (!datos.nombre?.trim()) throw new Error('Escribe el nombre del producto')
      const f = revisar(
        await supabase()
          .from('productos')
          .insert({ ...filaProducto(datos), nombre: datos.nombre.trim(), metodo_calculo: datos.metodo_calculo, unidad: datos.unidad })
          .select('id')
          .single(),
      )
      return obtenerFicha(f.id)
    },

    async actualizarProducto(id, cambios) {
      revisar(await supabase().from('productos').update(filaProducto(cambios)).eq('id', id).select('id').single())
      return obtenerFicha(id)
    },

    async activarProducto(id, activo) {
      revisar(await supabase().from('productos').update({ activo }).eq('id', id).select('id').single())
    },

    async guardarCostos(productoId, costos) {
      sinError(
        await supabase()
          .from('producto_costos')
          .upsert({ producto_id: productoId, ...costos, notas: limpio(costos.notas), proveedor: limpio(costos.proveedor) }),
      )
    },

    async precios(productoId) {
      let q = supabase().from('producto_precios').select('*')
      if (productoId) q = q.eq('producto_id', productoId)
      return revisar(await q.order('producto_id').order('lista')).map((f) => aPrecio(f as unknown as Record<string, unknown>))
    },

    async guardarPrecioLista(datos) {
      if (!(datos.precio >= 0)) throw new Error('El precio no puede ser negativo')
      const f = revisar(
        await supabase()
          .from('producto_precios')
          .upsert({
            producto_id: datos.producto_id,
            lista: datos.lista,
            precio: datos.precio,
            precio_minimo: datos.precio_minimo,
            escalas: [...datos.escalas].sort((x, y) => x.desde - y.desde) as unknown as NonNullable<Json>,
          })
          .select('*')
          .single(),
      )
      return aPrecio(f as unknown as Record<string, unknown>)
    },

    async eliminarPrecioLista(productoId, lista) {
      const r = await supabase().from('producto_precios').delete().eq('producto_id', productoId).eq('lista', lista)
      if (r.error) throw new Error(mensajeError(r.error))
    },

    async preciosPara(lista) {
      const sb = supabase()
      const [productos, especiales] = await Promise.all([
        sb.from('productos').select('id, precio_venta, precio_minimo, escalas').eq('activo', true),
        lista === 'publico' ? Promise.resolve({ data: [], error: null }) : sb.from('producto_precios').select('*').eq('lista', lista),
      ])
      const mapa = new Map(revisar(especiales as { data: Array<Record<string, unknown>> | null; error: unknown }).map((f) => [f.producto_id as string, aPrecio(f)]))
      return revisar(productos).map((p): PrecioAplicado => {
        const e = mapa.get(p.id)
        return e
          ? { producto_id: p.id, lista_aplicada: lista, precio: e.precio, precio_minimo: e.precio_minimo, escalas: e.escalas }
          : { producto_id: p.id, lista_aplicada: 'publico', precio: nn(p.precio_venta), precio_minimo: nn(p.precio_minimo), escalas: escalas(p.escalas) }
      })
    },
  },
}
