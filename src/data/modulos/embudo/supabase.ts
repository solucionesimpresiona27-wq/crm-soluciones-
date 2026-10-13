/** MÓDULO EMBUDO · implementación real (Supabase). */
import { limpio, mensajeError, n, revisar, supabase, textoBusqueda } from '@/data/comun/real'
import type { TablesUpdate } from '@/lib/database.types'
import type { ApiEmbudo, DatosOportunidad, Oportunidad, ResumenEmbudo } from './contrato'

const CAMPOS = '*, cliente:clientes(id, nombre, whatsapp, telefono, busqueda), responsable:perfiles!responsable_id(nombre)'

function aOportunidad(f: Record<string, unknown>): Oportunidad {
  const { cliente, responsable, ...o } = f as Record<string, unknown> & {
    cliente: { id: string; nombre: string; whatsapp: string | null; telefono: string | null } | null
    responsable: { nombre: string } | null
  }
  return {
    ...(o as unknown as Oportunidad),
    valor_estimado: o.valor_estimado === null ? null : n(o.valor_estimado),
    cliente: { id: cliente?.id ?? '', nombre: cliente?.nombre ?? '', whatsapp: cliente?.whatsapp ?? cliente?.telefono ?? null },
    responsable: responsable?.nombre ?? null,
  }
}

function fila(d: Partial<DatosOportunidad>): TablesUpdate<'oportunidades'> {
  const f: TablesUpdate<'oportunidades'> = {}
  if (d.cliente_id !== undefined) f.cliente_id = d.cliente_id
  if (d.titulo !== undefined) f.titulo = d.titulo.trim()
  if (d.descripcion !== undefined) f.descripcion = limpio(d.descripcion)
  if (d.etapa !== undefined) f.etapa = d.etapa
  if (d.valor_estimado !== undefined) f.valor_estimado = d.valor_estimado
  if (d.responsable_id !== undefined) f.responsable_id = d.responsable_id
  if (d.origen !== undefined) f.origen = limpio(d.origen)
  if (d.proxima_accion !== undefined) f.proxima_accion = limpio(d.proxima_accion)
  if (d.proxima_accion_fecha !== undefined) f.proxima_accion_fecha = d.proxima_accion_fecha || null
  if (d.motivo_perdida !== undefined) f.motivo_perdida = limpio(d.motivo_perdida)
  return f
}

function inicioMes() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
}

export const embudoSupabase: ApiEmbudo = {
  oportunidades: {
    async listar(filtros = {}) {
      let q = supabase().from('oportunidades').select(CAMPOS)
      if (filtros.responsableId) q = q.eq('responsable_id', filtros.responsableId)
      if (filtros.clienteId) q = q.eq('cliente_id', filtros.clienteId)
      const cerradas = filtros.cerradas ?? 'mes'
      if (cerradas === 'ninguna') q = q.not('etapa', 'in', '(ganado,perdido)')
      else if (cerradas === 'mes') q = q.or(`etapa.not.in.(ganado,perdido),cerrada_at.gte.${inicioMes()}`)
      const filas = revisar(await q.order('proxima_accion_fecha', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false }).limit(1000))
      const t = textoBusqueda(filtros.texto ?? '')
      return filas
        .filter((f) => !t || `${textoBusqueda(f.titulo)} ${(f.cliente as { busqueda?: string } | null)?.busqueda ?? ''}`.includes(t))
        .map((f) => aOportunidad(f as unknown as Record<string, unknown>))
    },

    async obtener(id) {
      const sb = supabase()
      const [o, cot] = await Promise.all([
        sb.from('oportunidades').select(CAMPOS).eq('id', id).single(),
        // Sin "ver_precios" la base devuelve la lista vacía
        sb.from('cotizaciones').select('id, folio, titulo, estado, total, fecha').eq('oportunidad_id', id).order('fecha', { ascending: false }),
      ])
      return {
        ...aOportunidad(revisar(o) as unknown as Record<string, unknown>),
        cotizaciones: revisar(cot).map((c) => ({ ...c, total: n(c.total) })),
      }
    },

    async crear(datos) {
      if (!datos.titulo?.trim()) throw new Error('Escribe el título de la oportunidad')
      const f = revisar(
        await supabase()
          .from('oportunidades')
          .insert({ ...fila(datos), cliente_id: datos.cliente_id, titulo: datos.titulo.trim() })
          .select(CAMPOS)
          .single(),
      )
      return aOportunidad(f as unknown as Record<string, unknown>)
    },

    async actualizar(id, cambios) {
      const f = revisar(await supabase().from('oportunidades').update(fila(cambios)).eq('id', id).select(CAMPOS).single())
      return aOportunidad(f as unknown as Record<string, unknown>)
    },

    async moverEtapa(id, etapa, motivoPerdida) {
      if (etapa === 'perdido' && !motivoPerdida?.trim()) throw new Error('Indica el motivo por el que se perdió la oportunidad')
      const f = revisar(
        await supabase()
          .from('oportunidades')
          .update({ etapa, motivo_perdida: etapa === 'perdido' ? motivoPerdida!.trim() : null })
          .eq('id', id)
          .select(CAMPOS)
          .single(),
      )
      return aOportunidad(f as unknown as Record<string, unknown>)
    },

    async eliminar(id) {
      const r = await supabase().from('oportunidades').delete().eq('id', id).select('id')
      if (r.error) throw new Error(mensajeError(r.error))
      if (!r.data?.length) throw new Error('No tienes permiso para eliminar oportunidades o ya no existe')
    },

    async resumen() {
      const filas = revisar(
        await supabase()
          .from('oportunidades')
          .select('etapa, valor_estimado')
          .or(`etapa.not.in.(ganado,perdido),cerrada_at.gte.${inicioMes()}`)
          .limit(5000),
      )
      const r: ResumenEmbudo = {}
      for (const f of filas) {
        const x = (r[f.etapa] ??= { cantidad: 0, valor: 0 })
        x.cantidad++
        x.valor += n(f.valor_estimado)
      }
      return r
    },
  },
}
