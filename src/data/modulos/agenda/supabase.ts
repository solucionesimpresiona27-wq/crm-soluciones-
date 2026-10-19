/** MÓDULO AGENDA · implementación real (Supabase). */
import { hoyLocal, limpio, mensajeError, revisar, supabase } from '@/data/comun/real'
import type { TablesUpdate } from '@/lib/database.types'
import type { ApiAgenda, DatosTarea, EventoAgenda, Tarea } from './contrato'

// El cliente sale de clientes_operacion: Diseño y Producción (sin permiso de clientes) solo ven el
// nombre de los clientes que tienen pedidos; quien ve clientes, el de todos.
const CAMPOS = '*, responsable:perfiles!responsable_id(nombre), cliente:clientes_operacion(nombre), pedido:pedidos(folio)'

function aTarea(f: Record<string, unknown>): Tarea {
  const { responsable, cliente, pedido, ...t } = f as Record<string, unknown> & {
    responsable: { nombre: string } | null
    cliente: { nombre: string } | null
    pedido: { folio: string } | null
  }
  const tarea = t as unknown as Tarea
  return {
    ...tarea,
    hora: tarea.hora ? tarea.hora.slice(0, 5) : null,
    responsable: responsable?.nombre ?? null,
    cliente: cliente?.nombre ?? null,
    // Producción no ve pedidos (montos): el folio llega vacío y la UI usa el título
    folio_pedido: pedido?.folio ?? null,
    vencida: !tarea.completada && tarea.fecha < hoyLocal(),
  }
}

function fila(d: Partial<DatosTarea>): TablesUpdate<'tareas'> {
  const f: TablesUpdate<'tareas'> = {}
  if (d.titulo !== undefined) f.titulo = d.titulo.trim()
  if (d.descripcion !== undefined) f.descripcion = limpio(d.descripcion)
  if (d.hora !== undefined) f.hora = d.hora || null
  for (const k of ['tipo', 'fecha', 'responsable_id', 'prioridad', 'cliente_id', 'pedido_id', 'oportunidad_id', 'cotizacion_id'] as const) {
    if (d[k] !== undefined) (f as Record<string, unknown>)[k] = d[k]
  }
  return f
}

export const agendaSupabase: ApiAgenda = {
  tareas: {
    async listar(filtros = {}) {
      let q = supabase().from('tareas').select(CAMPOS)
      if (filtros.desde) q = q.gte('fecha', filtros.desde)
      if (filtros.hasta) q = q.lte('fecha', filtros.hasta)
      if (filtros.responsableId) q = q.eq('responsable_id', filtros.responsableId)
      if (filtros.clienteId) q = q.eq('cliente_id', filtros.clienteId)
      if (filtros.pedidoId) q = q.eq('pedido_id', filtros.pedidoId)
      if (filtros.oportunidadId) q = q.eq('oportunidad_id', filtros.oportunidadId)
      if (filtros.cotizacionId) q = q.eq('cotizacion_id', filtros.cotizacionId)
      if (!filtros.incluirCompletadas) q = q.eq('completada', false)
      const filas = revisar(await q.order('fecha').order('hora', { ascending: true, nullsFirst: false }).order('titulo').limit(filtros.limite ?? 500))
      return filas.map((f) => aTarea(f as unknown as Record<string, unknown>))
    },

    async misPendientes() {
      const sb = supabase()
      const { data } = await sb.auth.getUser()
      if (!data.user) throw new Error('Sesión requerida')
      const filas = revisar(
        await sb
          .from('tareas')
          .select(CAMPOS)
          .eq('responsable_id', data.user.id)
          .eq('completada', false)
          .lte('fecha', hoyLocal())
          .order('fecha')
          .order('hora', { ascending: true, nullsFirst: false })
          .order('titulo'),
      )
      return filas.map((f) => aTarea(f as unknown as Record<string, unknown>))
    },

    async crear(datos) {
      if (!datos.titulo?.trim()) throw new Error('Escribe la tarea')
      const f = revisar(
        await supabase()
          .from('tareas')
          .insert({ ...fila(datos), titulo: datos.titulo.trim(), fecha: datos.fecha ?? hoyLocal() })
          .select(CAMPOS)
          .single(),
      )
      return aTarea(f as unknown as Record<string, unknown>)
    },

    async actualizar(id, cambios) {
      const f = revisar(await supabase().from('tareas').update(fila(cambios)).eq('id', id).select(CAMPOS).single())
      return aTarea(f as unknown as Record<string, unknown>)
    },

    async completar(id, completada = true) {
      const f = revisar(await supabase().from('tareas').update({ completada }).eq('id', id).select(CAMPOS).single())
      return aTarea(f as unknown as Record<string, unknown>)
    },

    async eliminar(id) {
      const r = await supabase().from('tareas').delete().eq('id', id).select('id')
      if (r.error) throw new Error(mensajeError(r.error))
      if (!r.data?.length) throw new Error('Solo quien creó la tarea o administración pueden eliminarla')
    },
  },

  agenda: {
    async calendario(desde, hasta) {
      const filas = revisar(await supabase().rpc('agenda', { p_desde: desde, p_hasta: hasta }))
      // Los tipos generados marcan todo como obligatorio, pero muchas columnas pueden ser nulas.
      return (filas as unknown as EventoAgenda[]).map((e) => ({ ...e, hora: e.hora ? e.hora.slice(0, 5) : null }))
    },
  },
}
