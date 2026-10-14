import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/data/api'
import type { TipoEnlace } from '@/data/modulos/portal/contrato'

/** Mensaje público y genérico: nunca revela si el enlace existió, venció o se revocó. */
export const MENSAJE_ENLACE = 'Este enlace ya no está disponible. Pide uno nuevo a Soluciones Impresiona.'

export const clavePortal = (token: string) => ['portal', 'publico', token] as const

/** Vista pública. Sin reintentos ni recarga al enfocar: cada lectura cuenta como una vista. */
export function useVistaPortal(token: string) {
  return useQuery({
    queryKey: clavePortal(token),
    queryFn: () => api.portal.obtener(token),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: Infinity,
    enabled: token.length > 0 && token.length <= 200,
  })
}

export function useArchivosPortal(token: string, activo: boolean) {
  return useQuery({
    queryKey: ['portal', 'archivos', token],
    queryFn: () => api.portal.archivos(token),
    retry: false,
    refetchOnWindowFocus: false,
    // Las URL temporales duran 10 minutos
    staleTime: 8 * 60_000,
    refetchInterval: 8 * 60_000,
    enabled: activo,
  })
}

const claveEnlaces = (tipo: TipoEnlace, id: string) => ['portal', 'enlaces', tipo, id] as const

export function useEnlacesPortal(tipo: TipoEnlace, id: string, activo = true) {
  return useQuery({
    queryKey: claveEnlaces(tipo, id),
    queryFn: () => api.portal.enlaces(tipo === 'cotizacion' ? { cotizacionId: id } : { pedidoId: id }),
    enabled: activo && !!id,
  })
}

export function useCrearEnlace(tipo: TipoEnlace, id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (opciones: { dias?: number; nuevo?: boolean }) => api.portal.crearEnlace(tipo, id, opciones),
    onSettled: () => qc.invalidateQueries({ queryKey: claveEnlaces(tipo, id) }),
  })
}

export function useRevocarEnlace(tipo: TipoEnlace, id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (enlaceId: string) => api.portal.revocarEnlace(enlaceId),
    onSettled: () => qc.invalidateQueries({ queryKey: claveEnlaces(tipo, id) }),
  })
}
