import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/data/api'
import type { DatosOportunidad, EtapaComercial, Oportunidad, OportunidadDetalle } from '@/data/modulos/embudo/contrato'

export const clavesEmbudo = {
  todo: ['oportunidades'] as const,
  lista: ['oportunidades', 'tablero'] as const,
  detalle: (id: string) => ['oportunidades', 'detalle', id] as const,
  actividades: (id: string) => ['oportunidades', 'actividades', id] as const,
}

/**
 * Todas las oportunidades (las cerradas también, para la tasa de cierre de 90 días).
 * `staleTime: 0`: otras pantallas cambian la etapa (una cotización enviada o aceptada la adelanta),
 * así que al volver al tablero se revalida en segundo plano sin dejar de mostrar lo que ya había.
 */
export const useOportunidades = () => useQuery({ queryKey: clavesEmbudo.lista, queryFn: () => api.oportunidades.listar({ cerradas: 'todas' }), staleTime: 0 })

export const useOportunidad = (id: string | null) =>
  useQuery({ queryKey: clavesEmbudo.detalle(id ?? ''), queryFn: () => api.oportunidades.obtener(id!), enabled: Boolean(id), staleTime: 0 })

/** Solo se piden cuando la oportunidad existe (un enlace viejo o mal escrito no provoca errores en cadena). */
export const useActividadesOportunidad = (id: string | null, existe = true) =>
  useQuery({ queryKey: clavesEmbudo.actividades(id ?? ''), queryFn: () => api.actividades.listar({ oportunidadId: id!, limite: 50 }), enabled: Boolean(id) && existe })

function useInvalidar() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: clavesEmbudo.todo })
    void qc.invalidateQueries({ queryKey: ['dashboard'] })
  }
}

/** Mueve de etapa con actualización optimista del tablero. */
export function useMoverEtapa() {
  const qc = useQueryClient()
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: (v: { id: string; etapa: EtapaComercial; motivo?: string }) => api.oportunidades.moverEtapa(v.id, v.etapa, v.motivo),
    onMutate: async (v) => {
      await Promise.all([qc.cancelQueries({ queryKey: clavesEmbudo.lista }), qc.cancelQueries({ queryKey: clavesEmbudo.detalle(v.id) })])
      const antes = qc.getQueryData<Oportunidad[]>(clavesEmbudo.lista)
      const ahora = new Date().toISOString()
      const cambiar = <T extends Oportunidad>(o: T): T => ({
        ...o,
        etapa: v.etapa,
        updated_at: ahora,
        etapa_cambiada_at: o.etapa === v.etapa ? o.etapa_cambiada_at : ahora,
        cerrada_at: v.etapa === 'ganado' || v.etapa === 'perdido' ? (o.cerrada_at ?? ahora) : null,
        motivo_perdida: v.etapa === 'perdido' ? (v.motivo ?? null) : null,
      })
      qc.setQueryData<Oportunidad[]>(clavesEmbudo.lista, (l) => l?.map((o) => (o.id === v.id ? cambiar(o) : o)))
      // El cajón de detalle también refleja la etapa nueva al instante
      const detalleAntes = qc.getQueryData<OportunidadDetalle>(clavesEmbudo.detalle(v.id))
      if (detalleAntes) qc.setQueryData(clavesEmbudo.detalle(v.id), cambiar(detalleAntes))
      return { antes, detalleAntes }
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.antes) qc.setQueryData(clavesEmbudo.lista, ctx.antes)
      if (ctx?.detalleAntes) qc.setQueryData(clavesEmbudo.detalle(ctx.detalleAntes.id), ctx.detalleAntes)
      toast.error('No se pudo mover la oportunidad', { description: e.message })
    },
    onSettled: invalidar,
  })
}

export function useGuardarOportunidad() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: (v: { id?: string; datos: DatosOportunidad }) => {
      if (!v.id) return api.oportunidades.crear(v.datos)
      const { cliente_id: _c, ...cambios } = v.datos
      return api.oportunidades.actualizar(v.id, cambios)
    },
    onSuccess: invalidar,
  })
}

export function useEliminarOportunidad() {
  const invalidar = useInvalidar()
  return useMutation({ mutationFn: (id: string) => api.oportunidades.eliminar(id), onSuccess: invalidar })
}

export function useRegistrarActividadOportunidad(o: { id: string; cliente_id: string } | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { tipo: Parameters<typeof api.actividades.registrar>[0]['tipo']; descripcion: string }) =>
      api.actividades.registrar({ cliente_id: o!.cliente_id, oportunidad_id: o!.id, ...v }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clavesEmbudo.actividades(o!.id) })
      void qc.invalidateQueries({ queryKey: ['clientes'] })
    },
  })
}
