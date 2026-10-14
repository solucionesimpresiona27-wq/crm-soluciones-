/** MÓDULO INVENTARIO · implementación real (Supabase). */
import { hoyLocal, limpio, mensajeError, n, nombreArchivoSeguro, revisar, sinError, supabase, textoBusqueda } from '@/data/comun/real'
import type { TablesUpdate } from '@/lib/database.types'
import type { ApiInventario, DatosGasto, DatosMaterial, DatosProveedor, Gasto, Material, Movimiento } from './contrato'

const CAMPOS_MATERIAL = '*, proveedor:proveedores(nombre), costo:material_costos(costo_unitario)'
const CAMPOS_MOV = '*, material:materiales(nombre, unidad), usuario:perfiles!usuario_id(nombre), pedido:pedidos(folio), proveedor:proveedores(nombre)'
const CAMPOS_GASTO = '*, proveedor:proveedores(nombre), pedido:pedidos(folio), usuario:perfiles!usuario_id(nombre)'
const DURACION_ENLACE = 600

function aMaterial(f: Record<string, unknown>): Material {
  const { proveedor, costo, busqueda: _b, ...m } = f as Record<string, unknown> & {
    proveedor: { nombre: string } | null
    costo: { costo_unitario: number } | Array<{ costo_unitario: number }> | null
  }
  const c = Array.isArray(costo) ? costo[0] : costo
  return {
    ...(m as unknown as Material),
    existencia: n(m.existencia),
    stock_minimo: n(m.stock_minimo),
    bajo_minimo: Boolean(m.bajo_minimo),
    proveedor: proveedor?.nombre ?? null,
    costo_unitario: c ? n(c.costo_unitario) : null,
  }
}

function aMovimiento(f: Record<string, unknown>): Movimiento {
  const { material, usuario, pedido, proveedor, ...m } = f as Record<string, unknown> & {
    material: { nombre: string; unidad: Movimiento['unidad'] } | null
    usuario: { nombre: string } | null
    pedido: { folio: string } | null
    proveedor: { nombre: string } | null
  }
  return {
    ...(m as unknown as Movimiento),
    cantidad: n(m.cantidad),
    existencia_resultante: n(m.existencia_resultante),
    material: material?.nombre ?? '',
    unidad: material?.unidad ?? 'pieza',
    usuario: usuario?.nombre ?? null,
    folio_pedido: pedido?.folio ?? null,
    proveedor: proveedor?.nombre ?? null,
  }
}

/**
 * Producción y diseño no leen la tabla `pedidos` (precios): el folio se completa con la vista
 * `ordenes_trabajo`, que sí pueden ver.
 */
async function conFolios(movs: Movimiento[]): Promise<Movimiento[]> {
  const faltan = [...new Set(movs.filter((m) => m.pedido_id && !m.folio_pedido).map((m) => m.pedido_id as string))]
  if (!faltan.length) return movs
  const { data } = await supabase().from('ordenes_trabajo').select('id, folio').in('id', faltan)
  const mapa = new Map((data ?? []).map((o) => [o.id as string, o.folio as string]))
  return movs.map((m) => (m.pedido_id && !m.folio_pedido ? { ...m, folio_pedido: mapa.get(m.pedido_id) ?? null } : m))
}

function aGasto(f: Record<string, unknown>): Gasto {
  const { proveedor, pedido, usuario, ...g } = f as Record<string, unknown> & {
    proveedor: { nombre: string } | null
    pedido: { folio: string } | null
    usuario: { nombre: string } | null
  }
  return { ...(g as unknown as Gasto), monto: n(g.monto), proveedor: proveedor?.nombre ?? null, folio_pedido: pedido?.folio ?? null, usuario: usuario?.nombre ?? null }
}

function filaMaterial(d: Partial<DatosMaterial>): TablesUpdate<'materiales'> {
  const f: TablesUpdate<'materiales'> = {}
  if (d.nombre !== undefined) f.nombre = d.nombre.trim()
  for (const k of ['categoria', 'ubicacion', 'notas'] as const) if (d[k] !== undefined) f[k] = limpio(d[k])
  if (d.unidad !== undefined) f.unidad = d.unidad
  if (d.stock_minimo !== undefined) f.stock_minimo = d.stock_minimo
  if (d.proveedor_id !== undefined) f.proveedor_id = d.proveedor_id
  return f
}

function filaProveedor(d: Partial<DatosProveedor>): TablesUpdate<'proveedores'> {
  const f: TablesUpdate<'proveedores'> = {}
  if (d.nombre !== undefined) f.nombre = d.nombre.trim()
  for (const k of ['contacto', 'telefono', 'whatsapp', 'categoria', 'notas'] as const) if (d[k] !== undefined) f[k] = limpio(d[k])
  if (d.email !== undefined) f.email = limpio(d.email)?.toLowerCase() ?? null
  if (d.rfc !== undefined) f.rfc = limpio(d.rfc)?.toUpperCase() ?? null
  return f
}

function filaGasto(d: Partial<DatosGasto>): TablesUpdate<'gastos'> {
  const f: TablesUpdate<'gastos'> = {}
  if (d.concepto !== undefined) f.concepto = d.concepto.trim()
  for (const k of ['referencia', 'notas'] as const) if (d[k] !== undefined) f[k] = limpio(d[k])
  for (const k of ['fecha', 'categoria', 'monto', 'metodo_pago', 'proveedor_id', 'pedido_id'] as const) if (d[k] !== undefined) (f as Record<string, unknown>)[k] = d[k]
  return f
}

async function guardarCosto(materialId: string, costo: number | null | undefined) {
  if (costo === undefined || costo === null) return
  if (costo < 0) throw new Error('El costo no puede ser negativo')
  sinError(await supabase().from('material_costos').upsert({ material_id: materialId, costo_unitario: costo }))
}

async function obtenerMaterial(id: string) {
  return aMaterial(revisar(await supabase().from('materiales').select(CAMPOS_MATERIAL).eq('id', id).single()) as unknown as Record<string, unknown>)
}

export const inventarioSupabase: ApiInventario = {
  materiales: {
    async listar(filtros = {}) {
      let q = supabase().from('materiales').select(CAMPOS_MATERIAL)
      if (!filtros.incluirInactivos) q = q.eq('activo', true)
      if (filtros.categoria) q = q.eq('categoria', filtros.categoria)
      if (filtros.soloBajoMinimo) q = q.eq('bajo_minimo', true)
      const t = textoBusqueda(filtros.texto ?? '')
      if (t) q = q.ilike('busqueda', `%${t}%`)
      const filas = revisar(await q.order('nombre').limit(1000))
      return filas.map((f) => aMaterial(f as unknown as Record<string, unknown>))
    },

    obtener: obtenerMaterial,

    async crear(datos) {
      if (!datos.nombre?.trim()) throw new Error('Escribe el nombre del material')
      if ((datos.existencia_inicial ?? 0) < 0) throw new Error('La existencia inicial no puede ser negativa')
      const f = revisar(
        await supabase()
          .from('materiales')
          .insert({ ...filaMaterial(datos), nombre: datos.nombre.trim(), unidad: datos.unidad, existencia: datos.existencia_inicial ?? 0 })
          .select('id')
          .single(),
      )
      await guardarCosto(f.id, datos.costo_unitario)
      return obtenerMaterial(f.id)
    },

    async actualizar(id, cambios) {
      const { costo_unitario, ...resto } = cambios
      const fila = filaMaterial(resto)
      if (Object.keys(fila).length) revisar(await supabase().from('materiales').update(fila).eq('id', id).select('id').single())
      await guardarCosto(id, costo_unitario)
      return obtenerMaterial(id)
    },

    async activar(id, activo) {
      revisar(await supabase().from('materiales').update({ activo }).eq('id', id).select('id').single())
    },

    async eliminar(id) {
      const r = await supabase().from('materiales').delete().eq('id', id).select('id')
      if ((r.error as { code?: string } | null)?.code === '23503') throw new Error('El material ya tiene movimientos: desactívalo en lugar de eliminarlo')
      if (r.error) throw new Error(mensajeError(r.error))
      if (!r.data?.length) throw new Error('No tienes permiso para eliminar materiales o ya no existe')
    },
  },

  inventario: {
    async movimientos(filtros = {}) {
      let q = supabase().from('movimientos_inventario').select(CAMPOS_MOV)
      if (filtros.materialId) q = q.eq('material_id', filtros.materialId)
      if (filtros.pedidoId) q = q.eq('pedido_id', filtros.pedidoId)
      if (filtros.tipo) q = q.eq('tipo', filtros.tipo)
      if (filtros.desde) q = q.gte('fecha', `${filtros.desde}T00:00:00`)
      if (filtros.hasta) q = q.lte('fecha', `${filtros.hasta}T23:59:59`)
      const filas = revisar(await q.order('fecha', { ascending: false }).order('created_at', { ascending: false }).limit(filtros.limite ?? 300))
      return conFolios(filas.map((f) => aMovimiento(f as unknown as Record<string, unknown>)))
    },

    async registrar(datos) {
      if (datos.tipo === 'ajuste' ? datos.cantidad === 0 : !(datos.cantidad > 0)) throw new Error('Indica una cantidad mayor a cero')
      const f = revisar(
        await supabase()
          .from('movimientos_inventario')
          .insert({
            material_id: datos.material_id,
            tipo: datos.tipo,
            cantidad: datos.cantidad,
            pedido_id: datos.pedido_id ?? null,
            proveedor_id: datos.proveedor_id ?? null,
            referencia: limpio(datos.referencia),
            notas: limpio(datos.notas),
            ...(datos.fecha ? { fecha: datos.fecha } : {}),
          })
          .select(CAMPOS_MOV)
          .single(),
      )
      return aMovimiento(f as unknown as Record<string, unknown>)
    },

    async ajustar(materialId, existencia, notas) {
      const r = revisar(await supabase().rpc('ajustar_existencia', { p_material: materialId, p_existencia: existencia, ...(notas?.trim() ? { p_notas: notas.trim() } : {}) })) as unknown as Record<string, unknown>
      return { movimiento_id: (r.movimiento_id as string) ?? null, existencia: n(r.existencia), diferencia: n(r.diferencia) }
    },

    async stockBajo() {
      const filas = revisar(await supabase().from('materiales').select(CAMPOS_MATERIAL).eq('bajo_minimo', true).order('nombre'))
      return filas.map((f) => aMaterial(f as unknown as Record<string, unknown>))
    },
  },

  proveedores: {
    async listar(filtros = {}) {
      let q = supabase().from('proveedores').select('*')
      if (!filtros.incluirInactivos) q = q.eq('activo', true)
      const t = textoBusqueda(filtros.texto ?? '')
      if (t) q = q.ilike('busqueda', `%${t}%`)
      const filas = revisar(await q.order('nombre').limit(1000))
      return filas.map(({ busqueda: _b, ...p }) => p)
    },
    async crear(datos) {
      if (!datos.nombre?.trim()) throw new Error('Escribe el nombre del proveedor')
      const { busqueda: _b, ...p } = revisar(await supabase().from('proveedores').insert({ ...filaProveedor(datos), nombre: datos.nombre.trim() }).select('*').single())
      return p
    },
    async actualizar(id, cambios) {
      const { busqueda: _b, ...p } = revisar(await supabase().from('proveedores').update(filaProveedor(cambios)).eq('id', id).select('*').single())
      return p
    },
    async activar(id, activo) {
      revisar(await supabase().from('proveedores').update({ activo }).eq('id', id).select('id').single())
    },
    async eliminar(id) {
      const r = await supabase().from('proveedores').delete().eq('id', id).select('id')
      if (r.error) throw new Error(mensajeError(r.error))
      if (!r.data?.length) throw new Error('No tienes permiso para eliminar proveedores o ya no existe')
    },
  },

  gastos: {
    async listar(filtros = {}) {
      let q = supabase().from('gastos').select(CAMPOS_GASTO)
      if (filtros.desde) q = q.gte('fecha', filtros.desde)
      if (filtros.hasta) q = q.lte('fecha', filtros.hasta)
      if (filtros.categoria) q = q.eq('categoria', filtros.categoria)
      if (filtros.proveedorId) q = q.eq('proveedor_id', filtros.proveedorId)
      if (filtros.pedidoId) q = q.eq('pedido_id', filtros.pedidoId)
      if (!filtros.incluirCancelados) q = q.eq('cancelado', false)
      const filas = revisar(await q.order('fecha', { ascending: false }).order('created_at', { ascending: false }).limit(filtros.limite ?? 500))
      return filas.map((f) => aGasto(f as unknown as Record<string, unknown>))
    },
    async registrar(datos) {
      if (!datos.concepto?.trim()) throw new Error('Escribe el concepto del gasto')
      if (!(datos.monto > 0)) throw new Error('El monto debe ser mayor a cero')
      const f = revisar(
        await supabase()
          .from('gastos')
          .insert({ ...filaGasto(datos), concepto: datos.concepto.trim(), categoria: datos.categoria, monto: datos.monto, metodo_pago: datos.metodo_pago, fecha: datos.fecha ?? hoyLocal() })
          .select(CAMPOS_GASTO)
          .single(),
      )
      return aGasto(f as unknown as Record<string, unknown>)
    },
    async actualizar(id, cambios) {
      const f = revisar(await supabase().from('gastos').update(filaGasto(cambios)).eq('id', id).select(CAMPOS_GASTO).single())
      return aGasto(f as unknown as Record<string, unknown>)
    },
    async cancelar(id, motivo) {
      if (!motivo?.trim()) throw new Error('Indica el motivo de la cancelación del gasto')
      revisar(await supabase().from('gastos').update({ cancelado: true, motivo_cancelacion: motivo.trim() }).eq('id', id).select('id').single())
    },
    async subirComprobante(id, archivo) {
      const sb = supabase()
      const ruta = `gastos/${id}/${nombreArchivoSeguro((archivo as File).name || 'comprobante')}`
      const subida = await sb.storage.from('comprobantes').upload(ruta, archivo, { contentType: archivo.type || undefined, upsert: true })
      if (subida.error) throw new Error(mensajeError(subida.error))
      const f = revisar(await sb.from('gastos').update({ comprobante_path: ruta }).eq('id', id).select(CAMPOS_GASTO).single())
      return aGasto(f as unknown as Record<string, unknown>)
    },
    async urlComprobante(id) {
      const sb = supabase()
      const g = revisar(await sb.from('gastos').select('comprobante_path').eq('id', id).single())
      if (!g.comprobante_path) return null
      const firmado = await sb.storage.from('comprobantes').createSignedUrl(g.comprobante_path, DURACION_ENLACE)
      if (firmado.error) throw new Error(mensajeError(firmado.error))
      return firmado.data.signedUrl
    },
    async eliminar(id) {
      const r = await supabase().from('gastos').delete().eq('id', id).select('id')
      if (r.error) throw new Error(mensajeError(r.error))
      if (!r.data?.length) throw new Error('No tienes permiso para eliminar gastos o ya no existe')
    },
  },
}

