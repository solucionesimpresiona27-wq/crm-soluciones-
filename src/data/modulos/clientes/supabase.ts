/** MÓDULO CLIENTES · implementación real (Supabase). */
import { limpio, mensajeError, n, nn, revisar, revisarOpcional, sinError, supabase, textoBusqueda } from '@/data/comun/real'
import type { TablesInsert, TablesUpdate } from '@/lib/database.types'
import type { ApiClientes, Cliente, ClienteLista, DatosCliente, DatosContacto, HistorialCliente, ResumenCliente } from './contrato'

/** Un id que no es UUID (enlace mal copiado) no llega a la base: evita errores 400 y se trata como "no encontrado". */
function exigirId(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error('Cliente no encontrado')
}

const CAMPOS_BREVE = 'id, nombre, whatsapp, telefono, email, requiere_factura'
const CAMPOS_LISTA =
  'id, nombre, tipo, whatsapp, telefono, email, ciudad, etiquetas, lista_precio, requiere_factura, dias_credito, activo, vendedor_id, ultima_compra_at, created_at, rfc, vendedor:perfiles!vendedor_id(nombre), contactos(nombre, puesto, whatsapp, principal, created_at)'

/** Normaliza lo capturado: textos vacíos → null, RFC en mayúsculas. Solo incluye lo enviado. */
function filaCliente(d: Partial<DatosCliente>) {
  const f: Record<string, unknown> = {}
  const textos = ['telefono', 'whatsapp', 'email', 'direccion', 'ciudad', 'notas', 'origen', 'razon_social', 'regimen_fiscal', 'codigo_postal_fiscal', 'uso_cfdi', 'email_facturacion'] as const
  if (d.nombre !== undefined) f.nombre = d.nombre.trim()
  for (const k of textos) if (d[k] !== undefined) f[k] = limpio(d[k])
  if (d.rfc !== undefined) f.rfc = limpio(d.rfc)?.toUpperCase() ?? null
  if (d.email !== undefined) f.email = limpio(d.email)?.toLowerCase() ?? null
  for (const k of ['tipo', 'requiere_factura', 'dias_credito', 'vendedor_id', 'lista_precio'] as const) if (d[k] !== undefined) f[k] = d[k]
  if (d.etiquetas !== undefined) f.etiquetas = [...new Set(d.etiquetas.map((e) => e.trim()).filter(Boolean))]
  return f
}

function aCliente(c: Record<string, unknown>): Cliente {
  const { busqueda: _b, vendedor, ...resto } = c
  return { ...(resto as Omit<Cliente, 'vendedor'>), vendedor: (vendedor as Cliente['vendedor']) ?? null }
}

export const clientesSupabase: ApiClientes = {
  clientes: {
    async buscar(texto) {
      let q = supabase().from('clientes').select(CAMPOS_BREVE).eq('activo', true)
      const t = textoBusqueda(texto)
      if (t) q = q.ilike('busqueda', `%${t}%`)
      return revisar(await q.order('nombre').limit(20))
    },

    async crear(datos) {
      return revisar(
        await supabase()
          .from('clientes')
          .insert({ tipo: 'empresa', ...filaCliente(datos), nombre: datos.nombre.trim() } as TablesInsert<'clientes'>)
          .select(CAMPOS_BREVE)
          .single(),
      )
    },

    async listar(filtros = {}) {
      let q = supabase().from('clientes').select(CAMPOS_LISTA)
      if (!filtros.incluirInactivos) q = q.eq('activo', true)
      const t = textoBusqueda(filtros.texto ?? '')
      if (t) q = q.ilike('busqueda', `%${t}%`)
      if (filtros.etiqueta) q = q.contains('etiquetas', [filtros.etiqueta])
      if (filtros.vendedorId) q = q.eq('vendedor_id', filtros.vendedorId)
      if (filtros.lista) q = q.eq('lista_precio', filtros.lista)
      const filas = revisar(await q.order('nombre').limit(filtros.limite ?? 500))
      return filas.map(({ vendedor, contactos, ...c }) => {
        type Ct = { nombre: string; puesto: string | null; whatsapp: string | null; principal: boolean; created_at: string }
        const lista = ((contactos ?? []) as Ct[]).slice().sort((x, y) => Number(y.principal) - Number(x.principal) || x.created_at.localeCompare(y.created_at))
        const p = lista[0]
        return {
          ...c,
          vendedor: (vendedor as { nombre: string } | null)?.nombre ?? null,
          contacto_principal: p ? { nombre: p.nombre, puesto: p.puesto, whatsapp: p.whatsapp } : null,
        } as ClienteLista
      })
    },

    async obtener(id) {
      // Enlace incompleto o cliente borrado (o sin permiso): "no encontrado" sin error HTTP ni reintentos.
      exigirId(id)
      const c = revisarOpcional(await supabase().from('clientes').select('*, vendedor:perfiles!vendedor_id(id, nombre)').eq('id', id).maybeSingle())
      if (!c) throw new Error('Cliente no encontrado')
      return aCliente(c as unknown as Record<string, unknown>)
    },

    async actualizar(id, cambios) {
      const c = revisar(
        await supabase().from('clientes').update(filaCliente(cambios) as TablesUpdate<'clientes'>).eq('id', id).select('*, vendedor:perfiles!vendedor_id(id, nombre)').single(),
      )
      return aCliente(c as unknown as Record<string, unknown>)
    },

    async activar(id, activo) {
      revisar(await supabase().from('clientes').update({ activo }).eq('id', id).select('id').single())
    },

    async eliminar(id) {
      const r = await supabase().from('clientes').delete().eq('id', id).select('id')
      if ((r.error as { code?: string } | null)?.code === '23503') {
        throw new Error('No se puede eliminar: el cliente tiene cotizaciones, pedidos o pagos. Desactívalo para ocultarlo.')
      }
      if (r.error) throw new Error(mensajeError(r.error))
      if (!r.data?.length) throw new Error('No tienes permiso para eliminar clientes o el cliente ya no existe')
    },

    async resumen(id) {
      exigirId(id)
      const r = revisar(await supabase().rpc('resumen_cliente', { p_cliente: id })) as unknown as Record<string, unknown>
      const resumen: ResumenCliente = {
        pedidos: n(r.pedidos),
        pedidos_activos: n(r.pedidos_activos),
        cotizaciones: n(r.cotizaciones),
        ultima_compra: (r.ultima_compra as string) ?? null,
      }
      for (const k of ['total_comprado', 'total_pagado', 'saldo', 'cotizado_abierto'] as const) if (k in r) resumen[k] = n(r[k])
      return resumen
    },

    async historial(id) {
      exigirId(id)
      const sb = supabase()
      // Sin "ver_precios" la base devuelve cotizaciones y pagos vacíos y la vista de órdenes sin montos.
      const [cot, ped, pag] = await Promise.all([
        sb.from('cotizaciones').select('id, folio, titulo, fecha, estado, total, pedido_id').eq('cliente_id', id).order('created_at', { ascending: false }).limit(200),
        sb.from('ordenes_trabajo').select('id, folio, titulo, estado, estado_pago, fecha_entrega, created_at, total, saldo').eq('cliente_id', id).order('created_at', { ascending: false }).limit(200),
        sb.from('pagos').select('id, pedido_id, fecha, importe, tipo, metodo, cancelado, pedido:pedidos(folio)').eq('cliente_id', id).order('fecha', { ascending: false }).limit(300),
      ])
      const h: HistorialCliente = {
        cotizaciones: revisar(cot).map((c) => ({ ...c, total: n(c.total) })),
        pedidos: revisar(ped).map((p) => ({ ...p, total: nn(p.total), saldo: nn(p.saldo) }) as HistorialCliente['pedidos'][number]),
        pagos: revisar(pag).map(({ pedido, ...p }) => ({ ...p, importe: n(p.importe), folio: (pedido as { folio: string } | null)?.folio ?? '' })),
      }
      return h
    },

    async etiquetas() {
      const filas = revisar(await supabase().from('clientes').select('etiquetas').eq('activo', true).limit(2000))
      return [...new Set(filas.flatMap((f) => f.etiquetas ?? []))].sort((a, b) => a.localeCompare(b, 'es'))
    },

    async asignarListaPrecio(id, lista) {
      revisar(await supabase().from('clientes').update({ lista_precio: lista }).eq('id', id).select('id').single())
    },

    async inactivos(dias) {
      const filas = revisar(await supabase().rpc('clientes_inactivos', dias ? { p_dias: dias } : {}))
      return filas.map((f) => ({ ...f, total_comprado: nn(f.total_comprado), pedidos: n(f.pedidos), dias_sin_compra: n(f.dias_sin_compra) }))
    },

    async saldos() {
      // La política de pedidos exige "ver_precios": sin él, la consulta llega vacía.
      const filas = revisar(await supabase().from('pedidos').select('cliente_id, saldo').neq('estado', 'cancelado').gt('saldo', 0).limit(5000))
      const r: Record<string, number> = {}
      for (const f of filas) r[f.cliente_id] = Math.round(((r[f.cliente_id] ?? 0) + n(f.saldo)) * 100) / 100
      return r
    },
  },

  contactos: {
    async listar(clienteId) {
      exigirId(clienteId)
      return revisar(
        await supabase().from('contactos').select('*').eq('cliente_id', clienteId).order('principal', { ascending: false }).order('nombre'),
      )
    },
    async crear(clienteId, datos) {
      const sb = supabase()
      if (datos.principal) sinError(await sb.from('contactos').update({ principal: false }).eq('cliente_id', clienteId))
      return revisar(await sb.from('contactos').insert({ ...filaContacto(datos), cliente_id: clienteId, nombre: datos.nombre.trim() } as TablesInsert<'contactos'>).select('*').single())
    },
    async actualizar(id, cambios) {
      const sb = supabase()
      if (cambios.principal) {
        const actual = revisar(await sb.from('contactos').select('cliente_id').eq('id', id).single())
        sinError(await sb.from('contactos').update({ principal: false }).eq('cliente_id', actual.cliente_id).neq('id', id))
      }
      return revisar(await sb.from('contactos').update(filaContacto(cambios) as TablesUpdate<'contactos'>).eq('id', id).select('*').single())
    },
    async eliminar(id) {
      const r = await supabase().from('contactos').delete().eq('id', id).select('id')
      if (r.error) throw new Error(mensajeError(r.error))
      if (!r.data?.length) throw new Error('No tienes permiso para eliminar contactos o el contacto ya no existe')
    },
  },

  actividades: {
    async listar({ clienteId, oportunidadId, limite }) {
      let q = supabase().from('actividades').select('*, usuario:perfiles!usuario_id(nombre), oportunidad:oportunidades(titulo)')
      if (clienteId) exigirId(clienteId)
      if (clienteId) q = q.eq('cliente_id', clienteId)
      if (oportunidadId) q = q.eq('oportunidad_id', oportunidadId)
      const filas = revisar(await q.order('fecha', { ascending: false }).limit(limite ?? 200))
      return filas.map(({ usuario, oportunidad, ...a }) => ({
        ...a,
        usuario: (usuario as { nombre: string } | null)?.nombre ?? null,
        oportunidad: (oportunidad as { titulo: string } | null)?.titulo ?? null,
      }))
    },
    async registrar(datos) {
      const fila = revisar(
        await supabase()
          .from('actividades')
          .insert({
            cliente_id: datos.cliente_id,
            oportunidad_id: datos.oportunidad_id ?? null,
            tipo: datos.tipo,
            descripcion: datos.descripcion.trim(),
            ...(datos.fecha ? { fecha: datos.fecha } : {}),
          })
          .select('*, usuario:perfiles!usuario_id(nombre), oportunidad:oportunidades(titulo)')
          .single(),
      )
      const { usuario, oportunidad, ...a } = fila
      return {
        ...a,
        usuario: (usuario as { nombre: string } | null)?.nombre ?? null,
        oportunidad: (oportunidad as { titulo: string } | null)?.titulo ?? null,
      }
    },
    async eliminar(id) {
      const r = await supabase().from('actividades').delete().eq('id', id).select('id')
      if (r.error) throw new Error(mensajeError(r.error))
      if (!r.data?.length) throw new Error('Solo puedes eliminar tus propias actividades')
    },
  },
}

function filaContacto(d: Partial<DatosContacto>) {
  const f: Record<string, unknown> = {}
  if (d.nombre !== undefined) f.nombre = d.nombre.trim()
  for (const k of ['puesto', 'telefono', 'whatsapp', 'notas'] as const) if (d[k] !== undefined) f[k] = limpio(d[k])
  if (d.email !== undefined) f.email = limpio(d.email)?.toLowerCase() ?? null
  if (d.principal !== undefined) f.principal = d.principal
  return f
}
