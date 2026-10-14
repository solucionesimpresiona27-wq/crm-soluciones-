import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { claves } from '@/app/consultas'
import { api } from '@/data/api'
import type { FiltrosBitacora } from '@/data/modulos/administracion/contrato'

export const claveUsuarios = ['usuarios', 'lista'] as const
const POR_PAGINA = 40

export const useUsuarios = () => useQuery({ queryKey: claveUsuarios, queryFn: () => api.usuarios.listar() })

/** Mutación que refresca la lista del equipo (y los selectores de responsable). */
export function useMutacionUsuarios<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: claveUsuarios })
      void qc.invalidateQueries({ queryKey: claves.equipo })
      void qc.invalidateQueries({ queryKey: ['bitacora'] })
    },
  })
}

export function useBitacora(filtros: Omit<FiltrosBitacora, 'antesDe' | 'limite'>) {
  return useInfiniteQuery({
    queryKey: ['bitacora', filtros],
    initialPageParam: undefined as number | undefined,
    queryFn: ({ pageParam }) => api.bitacora.listar({ ...filtros, antesDe: pageParam, limite: POR_PAGINA }),
    getNextPageParam: (ultima) => (ultima.length < POR_PAGINA ? undefined : ultima[ultima.length - 1]?.id),
  })
}
