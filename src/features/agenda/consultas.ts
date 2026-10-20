import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { claves } from '@/app/consultas'
import { api } from '@/data/api'
import type { DatosTarea, EventoAgenda } from '@/data/modulos/agenda/contrato'

export const clavesAgenda = {
  calendario: (desde: string, hasta: string) => ['agenda', 'calendario', desde, hasta] as const,
  misPendientes: ['agenda', 'mis-pendientes'] as const,
}

export const useCalendario = (desde: string, hasta: string) =>
  useQuery({
    queryKey: clavesAgenda.calendario(desde, hasta),
    queryFn: () => api.agenda.calendario(desde, hasta),
    placeholderData: keepPreviousData,
  })

/** Une el mensaje del error con la sugerencia sin dejar doble punto. */
export const frase = (m: string) => (/[.!?]$/.test(m.trim()) ? m.trim() : `${m.trim()}.`)

/** Una tarea con el folio de su pedido (el calendario no lo trae). */
export const useTarea = (id: string | undefined, activo: boolean) =>
  useQuery({
    queryKey: ['agenda', 'tarea', id],
    queryFn: () => api.tareas.obtener(id!),
    enabled: Boolean(id) && activo,
  })

export const useMisPendientes = (activo = true) =>
  useQuery({
    queryKey: clavesAgenda.misPendientes,
    queryFn: () => api.tareas.misPendientes(),
    enabled: activo,
  })

function useInvalidar() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: ['agenda'] })
    void qc.invalidateQueries({ queryKey: claves.dashboard })
  }
}

export function useCrearTarea() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: (d: DatosTarea) => api.tareas.crear(d),
    onSuccess: (t) => {
      invalidar()
      toast.success('Tarea agregada', { description: t.titulo })
    },
    onError: (e) =>
      toast.error('No se pudo agregar la tarea', {
        description: `${frase(e.message)} Revisa los datos e inténtalo de nuevo.`,
      }),
  })
}

export function useActualizarTarea() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: (v: { id: string; cambios: Partial<DatosTarea> }) => api.tareas.actualizar(v.id, v.cambios),
    onSuccess: () => {
      invalidar()
      toast.success('Tarea guardada')
    },
    onError: (e) => toast.error('No se pudo guardar la tarea', { description: e.message }),
  })
}

export function useEliminarTarea() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: (id: string) => api.tareas.eliminar(id),
    onSuccess: () => {
      invalidar()
      toast.success('Tarea eliminada')
    },
    onError: (e) => toast.error('No se pudo eliminar la tarea', { description: e.message }),
  })
}

/** Completar con un toque: se marca al instante en todos los calendarios en caché y se revierte si falla. */
export function useCompletarTarea() {
  const qc = useQueryClient()
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: (v: { id: string; completada: boolean }) => api.tareas.completar(v.id, v.completada),
    onMutate: async ({ id, completada }) => {
      await qc.cancelQueries({ queryKey: ['agenda', 'calendario'] })
      const previos = qc.getQueriesData<EventoAgenda[]>({
        queryKey: ['agenda', 'calendario'],
      })
      qc.setQueriesData<EventoAgenda[]>({ queryKey: ['agenda', 'calendario'] }, (l) => l?.map((e) => (e.origen === 'tarea' && e.id === id ? { ...e, completada } : e)))
      return { previos }
    },
    onError: (e, _v, ctx) => {
      ctx?.previos.forEach(([k, d]) => qc.setQueryData(k, d))
      toast.error('No se pudo marcar la tarea', { description: e.message })
    },
    onSettled: invalidar,
  })
}
