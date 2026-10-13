/** MÓDULO PRODUCCIÓN · implementación real (Supabase). Solo vistas sin montos. */
import { mensajeError, n, nn, revisar, sinError, supabase, textoBusqueda } from '@/data/comun/real'
import type { ApiProduccion, HojaOrden, OrdenTrabajo } from './contrato'

/** Columnas de ordenes_trabajo SIN montos (total, pagado y saldo nunca se piden). */
const COLUMNAS =
  'id, folio, titulo, descripcion, cliente_id, cliente_nombre, estado, estado_anterior, motivo_estado, etapas_omitidas, prioridad, fecha_entrega, atrasado, requiere_instalacion, direccion_instalacion, responsable_id, disenador_id, anticipo_recibido, num_partidas, num_disenos, created_at, updated_at'

async function nombres(ids: Array<string | null>) {
  const unicos = [...new Set(ids.filter(Boolean))] as string[]
  if (!unicos.length) return new Map<string, string>()
  const filas = revisar(await supabase().from('perfiles').select('id, nombre').in('id', unicos))
  return new Map(filas.map((p) => [p.id, p.nombre]))
}

function aOrden(f: Record<string, unknown>, mapa: Map<string, string>): OrdenTrabajo {
  return {
    id: f.id as string,
    folio: f.folio as string,
    titulo: f.titulo as string,
    descripcion: (f.descripcion as string) ?? null,
    cliente_id: f.cliente_id as string,
    cliente: (f.cliente_nombre as string) ?? '',
    estado: f.estado as OrdenTrabajo['estado'],
    estado_anterior: (f.estado_anterior as OrdenTrabajo['estado_anterior']) ?? null,
    motivo_estado: (f.motivo_estado as string) ?? null,
    etapas_omitidas: (f.etapas_omitidas as OrdenTrabajo['etapas_omitidas']) ?? [],
    prioridad: f.prioridad as OrdenTrabajo['prioridad'],
    fecha_entrega: (f.fecha_entrega as string) ?? null,
    atrasado: Boolean(f.atrasado),
    requiere_instalacion: Boolean(f.requiere_instalacion),
    direccion_instalacion: (f.direccion_instalacion as string) ?? null,
    responsable_id: (f.responsable_id as string) ?? null,
    responsable: mapa.get(f.responsable_id as string) ?? null,
    disenador_id: (f.disenador_id as string) ?? null,
    disenador: mapa.get(f.disenador_id as string) ?? null,
    anticipo_recibido: Boolean(f.anticipo_recibido),
    num_partidas: n(f.num_partidas),
    num_disenos: n(f.num_disenos),
    created_at: f.created_at as string,
    updated_at: f.updated_at as string,
  }
}

export const produccionSupabase: ApiProduccion = {
  produccion: {
    async tablero(filtros = {}) {
      let q = supabase().from('ordenes_trabajo').select(COLUMNAS)
      q = q.not('estado', 'in', filtros.incluirEntregados ? '(finalizado,cancelado)' : '(entregado,finalizado,cancelado)')
      if (filtros.responsableId) q = q.eq('responsable_id', filtros.responsableId)
      const filas = revisar(await q.order('fecha_entrega', { ascending: true, nullsFirst: false }).order('folio').limit(500)) as unknown as Array<Record<string, unknown>>
      const mapa = await nombres(filas.flatMap((f) => [f.responsable_id as string, f.disenador_id as string]))
      const t = textoBusqueda(filtros.texto ?? '')
      return filas.map((f) => aOrden(f, mapa)).filter((o) => !t || textoBusqueda(`${o.folio} ${o.titulo} ${o.cliente}`).includes(t))
    },

    async orden(id) {
      const sb = supabase()
      const [orden, partidas, disenos, notas] = await Promise.all([
        sb.from('ordenes_trabajo').select(COLUMNAS).eq('id', id).maybeSingle(),
        sb
          .from('orden_partidas')
          .select('id, orden, tipo, concepto, descripcion, metodo_calculo, unidad, ancho, alto, largo, cantidad, notas_produccion')
          .eq('pedido_id', id)
          .order('orden'),
        sb
          .from('archivos')
          .select('id, nombre, version, estado_aprobacion, mime, path, enlace_externo, created_at')
          .eq('pedido_id', id)
          .eq('categoria', 'diseno')
          .order('version', { ascending: false, nullsFirst: false }),
        sb.from('pedido_eventos').select('id, mensaje, created_at, usuario:perfiles!usuario_id(nombre)').eq('pedido_id', id).eq('tipo', 'nota').order('created_at', { ascending: false }),
      ])
      if (orden.error) throw new Error(mensajeError(orden.error))
      if (!orden.data) throw new Error('Orden de trabajo no encontrada')
      const f = orden.data as unknown as Record<string, unknown>
      const mapa = await nombres([f.responsable_id as string, f.disenador_id as string])
      const hoja: HojaOrden = {
        orden: aOrden(f, mapa),
        partidas: revisar(partidas).map((p) => ({
          id: p.id ?? '',
          orden: n(p.orden),
          tipo: p.tipo ?? 'concepto',
          concepto: p.concepto ?? '',
          descripcion: p.descripcion,
          metodo_calculo: p.metodo_calculo ?? 'pieza',
          unidad: p.unidad ?? 'pza',
          ancho: nn(p.ancho),
          alto: nn(p.alto),
          largo: nn(p.largo),
          cantidad: n(p.cantidad),
          notas_produccion: p.notas_produccion,
        })),
        disenos: revisar(disenos).map(({ path, ...d }) => ({ ...d, tiene_archivo: Boolean(path) })),
        notas: revisar(notas).map(({ usuario, ...x }) => ({ ...x, mensaje: x.mensaje ?? '', usuario: (usuario as { nombre: string } | null)?.nombre ?? null })),
      }
      return hoja
    },

    async moverEtapa(id, estado, motivo) {
      sinError(await supabase().rpc('cambiar_estado_pedido', { p_pedido: id, p_estado: estado, p_motivo: motivo ?? undefined }))
    },

    async guardarNotaPartida(partidaId, notas) {
      sinError(await supabase().rpc('actualizar_notas_partida', { p_partida: partidaId, p_notas: notas }))
    },

    async agregarNota(id, mensaje) {
      revisar(await supabase().rpc('agregar_nota_pedido', { p_pedido: id, p_mensaje: mensaje }))
    },
  },
}
