import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { claves } from '@/app/consultas'
import { api } from '@/data/api'
import type { BorradorCotizacion, EstadoCotizacion } from '@/data/tipos'

/** Consultas y acciones de cotizaciones compartidas por lista, detalle y editor. */
export const useCotizaciones = () => useQuery({ queryKey: claves.cotizaciones, queryFn: () => api.cotizaciones.listar() })

export const useCotizacion = (id: string | undefined) =>
  useQuery({ queryKey: claves.cotizacion(id ?? ''), queryFn: () => api.cotizaciones.obtener(id!), enabled: Boolean(id) })

export const useProductos = () => useQuery({ queryKey: claves.productos, queryFn: () => api.catalogo.productos(), staleTime: 5 * 60_000 })

function useInvalidar() {
  const qc = useQueryClient()
  return (id?: string) => {
    void qc.invalidateQueries({ queryKey: claves.cotizaciones })
    void qc.invalidateQueries({ queryKey: claves.dashboard })
    if (id) void qc.invalidateQueries({ queryKey: claves.cotizacion(id) })
  }
}

export function useGuardarCotizacion() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: (b: BorradorCotizacion) => api.cotizaciones.guardar(b),
    onSuccess: (r) => invalidar(r.id),
  })
}

export function useCambiarEstadoCotizacion() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: (v: { id: string; estado: EstadoCotizacion; motivo?: string }) => api.cotizaciones.cambiarEstado(v.id, v.estado, v.motivo),
    onSuccess: (_r, v) => invalidar(v.id),
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useDuplicarCotizacion() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: (id: string) => api.cotizaciones.duplicar(id),
    onSuccess: (nuevo) => invalidar(nuevo),
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useConvertirCotizacion() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: (v: { id: string; fechaEntrega?: string | null; titulo?: string | null }) =>
      api.cotizaciones.convertir(v.id, { fechaEntrega: v.fechaEntrega, titulo: v.titulo }),
    onSuccess: (_r, v) => invalidar(v.id),
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useEliminarCotizacion() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: (id: string) => api.cotizaciones.eliminar(id),
    onSuccess: () => invalidar(),
    onError: (e: Error) => toast.error(e.message),
  })
}
