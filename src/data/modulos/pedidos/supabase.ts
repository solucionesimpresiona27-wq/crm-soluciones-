/** MÓDULO PEDIDOS · implementación real (Supabase). */
import { hoyLocal, limpio, mensajeError, n, nn, nombreArchivoSeguro, revisar, sinError, supabase, textoBusqueda } from '@/data/comun/real'
import type { TablesInsert, TablesUpdate } from '@/lib/database.types'
import type { ApiPedidos, Archivo, CambiosPartida, CambiosPedido, NuevaPartida, PartidaPedido, PedidoDetalle, PedidoLista } from './contrato'

const DURACION_ENLACE = 600

function aLista(f: Record<string, unknown>): PedidoLista {
  return {
    ...(f as unknown as PedidoLista),
    cliente: (f.cliente_nombre as string) ?? '',
    cliente_whatsapp: (f.cliente_whatsapp as string) ?? null,
    atrasado: Boolean(f.atrasado),
    anticipo_recibido: Boolean(f.anticipo_recibido),
    etapas_omitidas: (f.etapas_omitidas as PedidoLista['etapas_omitidas']) ?? [],
    total: nn(f.total),
    pagado: nn(f.pagado),
    saldo: nn(f.saldo),
    num_partidas: n(f.num_partidas),
    num_disenos: n(f.num_disenos),
  }
}

function filaPartida(p: NuevaPartida, pedidoId: string, orden: number): TablesInsert<'partidas'> {
  if (!p.concepto?.trim()) throw new Error('Cada concepto necesita una descripción')
  return {
    pedido_id: pedidoId,
    cotizacion_id: null,
    orden,
    tipo: p.tipo ?? 'concepto',
    producto_id: p.producto_id ?? null,
    concepto: p.concepto.trim(),
    descripcion: limpio(p.descripcion),
    metodo_calculo: p.metodo_calculo,
    unidad: p.unidad ?? 'pza',
    ancho: p.ancho ?? null,
    alto: p.alto ?? null,
    largo: p.largo ?? null,
    cantidad: p.cantidad,
    precio_unitario: p.precio_unitario,
    descuento_pct: p.descuento_pct ?? 0,
    notas_produccion: limpio(p.notas_produccion),
  }
}

function filaCambiosPartida(c: CambiosPartida): TablesUpdate<'partidas'> {
  const f: TablesUpdate<'partidas'> = {}
  if (c.concepto !== undefined) {
    if (!c.concepto.trim()) throw new Error('Cada concepto necesita una descripción')
    f.concepto = c.concepto.trim()
  }
  if (c.cantidad !== undefined && !(c.cantidad > 0)) throw new Error('La cantidad debe ser mayor a cero')
  for (const k of ['descripcion', 'notas_produccion'] as const) if (c[k] !== undefined) f[k] = limpio(c[k])
  for (const k of ['metodo_calculo', 'unidad', 'ancho', 'alto', 'largo', 'cantidad', 'precio_unitario', 'descuento_pct'] as const) {
    if (c[k] !== undefined) (f as Record<string, unknown>)[k] = c[k]
  }
  return f
}

function filaPedido(c: CambiosPedido): TablesUpdate<'pedidos'> {
  const f: TablesUpdate<'pedidos'> = {}
  if (c.titulo !== undefined) f.titulo = c.titulo.trim()
  for (const k of ['descripcion', 'direccion_instalacion', 'notas_internas'] as const) if (c[k] !== undefined) f[k] = limpio(c[k])
  for (const k of ['fecha_entrega', 'fecha_limite_pago'] as const) if (c[k] !== undefined) f[k] = c[k] || null
  for (const k of ['prioridad', 'requiere_instalacion', 'responsable_id', 'disenador_id', 'contacto_id', 'etapas_omitidas', 'anticipo_pct', 'aplica_iva', 'iva_pct', 'requiere_factura'] as const) {
    if (c[k] !== undefined) (f as Record<string, unknown>)[k] = c[k]
  }
  return f
}

async function nombres(ids: Array<string | null>) {
  const unicos = [...new Set(ids.filter(Boolean))] as string[]
  if (!unicos.length) return new Map<string, string>()
  const filas = revisar(await supabase().from('perfiles').select('id, nombre').in('id', unicos))
  return new Map(filas.map((p) => [p.id, p.nombre]))
}

async function conNombre(filas: Array<Record<string, unknown>>): Promise<Archivo[]> {
  const mapa = await nombres(filas.map((f) => f.subido_por as string | null))
  return filas.map((f) => ({ ...(f as unknown as Archivo), subido_por_nombre: mapa.get(f.subido_por as string) ?? null }))
}

export const pedidosSupabase: ApiPedidos = {
  pedidos: {
    async listar(filtros = {}) {
      let q = supabase().from('ordenes_trabajo').select('*')
      if (filtros.estados?.length) q = q.in('estado', filtros.estados)
      else if (!filtros.incluirCerrados) q = q.not('estado', 'in', '(finalizado,cancelado)')
      if (filtros.clienteId) q = q.eq('cliente_id', filtros.clienteId)
      if (filtros.responsableId) q = q.eq('responsable_id', filtros.responsableId)
      if (filtros.vendedorId) q = q.eq('vendedor_id', filtros.vendedorId)
      if (filtros.soloAtrasados) q = q.eq('atrasado', true)
      if (filtros.desde) q = q.gte('created_at', `${filtros.desde}T00:00:00`)
      if (filtros.hasta) q = q.lte('created_at', `${filtros.hasta}T23:59:59`)
      const filas = revisar(await q.order('fecha_entrega', { ascending: true, nullsFirst: false }).order('folio').limit(filtros.texto ? 2000 : (filtros.limite ?? 500)))
      const t = textoBusqueda(filtros.texto ?? '')
      // El texto se filtra aquí (incluye el nombre del cliente), así que el límite va después
      return filas
        .map((f) => aLista(f as unknown as Record<string, unknown>))
        .filter((p) => !t || textoBusqueda(`${p.folio} ${p.titulo} ${p.cliente}`).includes(t))
        .slice(0, filtros.limite ?? 500)
    },

    async obtener(id) {
      const sb = supabase()
      const [orden, partidas, montos, costos] = await Promise.all([
        sb.from('ordenes_trabajo').select('*').eq('id', id).maybeSingle(),
        sb.from('orden_partidas').select('*').eq('pedido_id', id).order('orden'),
        // Sin "ver_precios" la base no devuelve el pedido (null): los montos quedan ocultos.
        sb
          .from('pedidos')
          .select('anticipo_pct, aplica_iva, iva_pct, subtotal, descuento, recargo, iva, total, pagado, saldo, fecha_limite_pago, condiciones, notas_internas, folio_factura, fecha_factura, cotizacion:cotizaciones!pedidos_cotizacion_id_fkey(folio)')
          .eq('id', id)
          .maybeSingle(),
        // Sin "ver_costos" la base devuelve la lista vacía
        sb.from('partida_costos').select('*, partida:partidas!inner(pedido_id)').eq('partida.pedido_id', id),
      ])
      if (orden.error) throw new Error(mensajeError(orden.error))
      if (!orden.data) throw new Error('Pedido no encontrado')
      const base = aLista(orden.data as unknown as Record<string, unknown>)
      const o = orden.data
      // clientes_operacion: lo mínimo del cliente para trabajar el pedido. Sin permiso de clientes
      // (Diseño, Producción) la base solo da el contacto mientras el pedido está en proceso y nunca el correo.
      const [cliente, mapa] = await Promise.all([
        sb.from('clientes_operacion').select('id, nombre, whatsapp, telefono, email, requiere_factura, contacto_visible').eq('id', base.cliente_id).maybeSingle(),
        nombres([o.vendedor_id, o.responsable_id, o.disenador_id]),
      ])
      if (cliente.error) throw new Error(mensajeError(cliente.error))
      const cd = cliente.data
      const m = montos.data as Record<string, unknown> | null
      const mapaCostos = new Map((costos.data ?? []).map((c) => [c.partida_id, c]))
      const detalle: PedidoDetalle = {
        ...base,
        descripcion: o.descripcion,
        direccion_instalacion: o.direccion_instalacion,
        contacto_id: o.contacto_id,
        cotizacion_folio: (m?.cotizacion as { folio: string } | null)?.folio ?? null,
        cliente_datos: {
          id: base.cliente_id,
          nombre: cd?.nombre ?? base.cliente,
          whatsapp: cd?.whatsapp ?? null,
          telefono: cd?.telefono ?? null,
          email: cd?.email ?? null,
          requiere_factura: Boolean(cd?.requiere_factura),
          contacto_oculto: cd?.contacto_visible === false,
        },
        vendedor: mapa.get(o.vendedor_id ?? '') ?? null,
        responsable: mapa.get(o.responsable_id ?? '') ?? null,
        disenador: mapa.get(o.disenador_id ?? '') ?? null,
        montos: m
          ? {
              anticipo_pct: n(m.anticipo_pct),
              aplica_iva: Boolean(m.aplica_iva),
              iva_pct: n(m.iva_pct),
              subtotal: n(m.subtotal),
              descuento: n(m.descuento),
              recargo: n(m.recargo),
              iva: n(m.iva),
              total: n(m.total),
              pagado: n(m.pagado),
              saldo: n(m.saldo),
              fecha_limite_pago: (m.fecha_limite_pago as string) ?? null,
              condiciones: (m.condiciones as string) ?? null,
              notas_internas: (m.notas_internas as string) ?? null,
            }
          : null,
        folio_factura: (m?.folio_factura as string) ?? null,
        fecha_factura: (m?.fecha_factura as string) ?? null,
        partidas: revisar(partidas).map((p): PartidaPedido => {
          const c = mapaCostos.get(p.id ?? '')
          return {
            id: p.id ?? '',
            orden: n(p.orden),
            tipo: p.tipo ?? 'concepto',
            producto_id: p.producto_id,
            concepto: p.concepto ?? '',
            descripcion: p.descripcion,
            metodo_calculo: p.metodo_calculo ?? 'pieza',
            unidad: p.unidad ?? 'pza',
            ancho: nn(p.ancho),
            alto: nn(p.alto),
            largo: nn(p.largo),
            cantidad: n(p.cantidad),
            notas_produccion: p.notas_produccion,
            precio_unitario: nn(p.precio_unitario),
            descuento_pct: nn(p.descuento_pct),
            importe: nn(p.importe),
            costos: c
              ? {
                  costo_material: n(c.costo_material),
                  costo_mano_obra: n(c.costo_mano_obra),
                  costo_fijo: n(c.costo_fijo),
                  desperdicio_pct: n(c.desperdicio_pct),
                  ganancia_pct: n(c.ganancia_pct),
                  costo_total: n(c.costo_total),
                  calculo: (c.calculo as Record<string, unknown>) ?? {},
                }
              : null,
          }
        }),
      }
      return detalle
    },

    async crear(datos) {
      if (!datos.titulo?.trim()) throw new Error('Escribe el título del pedido')
      const sb = supabase()
      const { partidas, ...cabecera } = datos
      const pedido = revisar(
        await sb
          .from('pedidos')
          .insert({ ...filaPedido(cabecera), cliente_id: datos.cliente_id, titulo: datos.titulo.trim() } as TablesInsert<'pedidos'>)
          .select('id, folio')
          .single(),
      )
      if (!partidas?.length) return pedido
      const r = await sb.from('partidas').insert(partidas.map((p, i) => filaPartida(p, pedido.id, i + 1)), { defaultToNull: false })
      if (r.error) {
        // Sin conceptos el pedido no sirve: se intenta deshacer (requiere permiso de eliminar).
        await sb.from('pedidos').delete().eq('id', pedido.id)
        throw new Error(`No se guardaron los conceptos del pedido: ${mensajeError(r.error)}`)
      }
      return pedido
    },

    async actualizar(id, cambios) {
      revisar(await supabase().from('pedidos').update(filaPedido(cambios)).eq('id', id).select('id').single())
    },

    async cambiarEstado(id, estado, motivo) {
      sinError(await supabase().rpc('cambiar_estado_pedido', { p_pedido: id, p_estado: estado, p_motivo: motivo ?? undefined }))
    },

    async agregarNota(id, mensaje) {
      revisar(await supabase().rpc('agregar_nota_pedido', { p_pedido: id, p_mensaje: mensaje }))
    },

    async eventos(id) {
      const filas = revisar(await supabase().from('pedido_eventos').select('*, usuario:perfiles!usuario_id(nombre)').eq('pedido_id', id).order('created_at').order('id'))
      return filas.map(({ usuario, ...e }) => ({ ...e, usuario: (usuario as { nombre: string } | null)?.nombre ?? null }))
    },

    async facturar(id, datos) {
      revisar(
        await supabase()
          .from('pedidos')
          .update({
            facturado: datos.facturado,
            folio_factura: datos.facturado ? limpio(datos.folio_factura) : null,
            fecha_factura: datos.facturado ? datos.fecha_factura || hoyLocal() : null,
          })
          .eq('id', id)
          .select('id')
          .single(),
      )
    },

    async agregarPartida(pedidoId, partida) {
      if (!(partida.cantidad > 0)) throw new Error('La cantidad debe ser mayor a cero')
      const sb = supabase()
      const ultima = revisar(await sb.from('partidas').select('orden').eq('pedido_id', pedidoId).order('orden', { ascending: false }).limit(1))
      revisar(await sb.from('partidas').insert(filaPartida(partida, pedidoId, n(ultima[0]?.orden) + 1)).select('id').single())
    },

    async actualizarPartida(id, cambios) {
      revisar(await supabase().from('partidas').update(filaCambiosPartida(cambios)).eq('id', id).select('id').single())
    },

    async eliminarPartida(id) {
      const r = await supabase().from('partidas').delete().eq('id', id).select('id')
      if (r.error) throw new Error(mensajeError(r.error))
      if (!r.data?.length) throw new Error('No se pudo quitar el concepto: solo ventas o administración pueden cambiar los conceptos del pedido')
    },
  },

  archivos: {
    async listar(pedidoId) {
      const filas = revisar(await supabase().from('archivos').select('*').eq('pedido_id', pedidoId).order('created_at', { ascending: false }))
      return conNombre(filas as unknown as Array<Record<string, unknown>>)
    },

    async subir(pedidoId, archivo, opciones = {}) {
      const sb = supabase()
      const nombreOriginal = opciones.nombre?.trim() || (archivo as File).name || 'archivo'
      const ruta = `pedidos/${pedidoId}/${Date.now()}-${nombreArchivoSeguro(nombreOriginal)}`
      const subida = await sb.storage.from('archivos').upload(ruta, archivo, { contentType: archivo.type || undefined, upsert: false })
      if (subida.error) throw new Error(mensajeError(subida.error))
      const fila = await sb
        .from('archivos')
        .insert({ pedido_id: pedidoId, categoria: opciones.categoria ?? 'diseno', nombre: nombreOriginal, path: ruta, mime: archivo.type || null, tamano: archivo.size })
        .select('*')
        .single()
      if (fila.error) {
        await sb.storage.from('archivos').remove([ruta])
        throw new Error(mensajeError(fila.error))
      }
      return (await conNombre([fila.data as unknown as Record<string, unknown>]))[0]
    },

    async agregarEnlace(pedidoId, datos) {
      if (!/^https?:\/\//i.test(datos.enlace.trim())) throw new Error('El enlace debe empezar con https://')
      const fila = revisar(
        await supabase()
          .from('archivos')
          .insert({ pedido_id: pedidoId, categoria: datos.categoria ?? 'diseno', nombre: datos.nombre.trim(), enlace_externo: datos.enlace.trim() })
          .select('*')
          .single(),
      )
      return (await conNombre([fila as unknown as Record<string, unknown>]))[0]
    },

    async registrarAprobacion(id, datos) {
      if (!datos.aprobado_por_nombre?.trim()) throw new Error('Escribe quién respondió por parte del cliente')
      const fila = revisar(
        await supabase()
          .from('archivos')
          .update({ estado_aprobacion: datos.estado, aprobado_por_nombre: datos.aprobado_por_nombre.trim(), aprobacion_notas: limpio(datos.notas) })
          .eq('id', id)
          .select('*')
          .single(),
      )
      return (await conNombre([fila as unknown as Record<string, unknown>]))[0]
    },

    async url(id) {
      const sb = supabase()
      const a = revisar(await sb.from('archivos').select('path, enlace_externo').eq('id', id).single())
      if (a.enlace_externo) return a.enlace_externo
      if (!a.path) return null
      const firmado = await sb.storage.from('archivos').createSignedUrl(a.path, DURACION_ENLACE)
      if (firmado.error) throw new Error(mensajeError(firmado.error))
      return firmado.data.signedUrl
    },

    async eliminar(id) {
      const sb = supabase()
      const r = await sb.from('archivos').delete().eq('id', id).select('path')
      if (r.error) throw new Error(mensajeError(r.error))
      if (!r.data?.length) throw new Error('Solo quien subió el archivo (si no está aprobado) o administración pueden eliminarlo')
      const ruta = r.data[0].path
      if (ruta) sinError(await sb.storage.from('archivos').remove([ruta]))
    },
  },
}
