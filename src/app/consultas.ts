import { QueryClient, useQuery } from '@tanstack/react-query'
import { api } from '@/data/api'

export const clienteConsultas = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true },
    mutations: { retry: 0 },
  },
})

export const claves = {
  configuracion: ['configuracion'] as const,
  plantillas: ['plantillas'] as const,
  equipo: ['equipo'] as const,
  dashboard: ['dashboard'] as const,
  productos: ['productos'] as const,
  cotizaciones: ['cotizaciones'] as const,
  cotizacion: (id: string) => ['cotizaciones', id] as const,
  clientes: (q: string) => ['clientes', q] as const,
  busqueda: (q: string) => ['busqueda', q] as const,
}

export const useConfiguracion = () =>
  useQuery({ queryKey: claves.configuracion, queryFn: () => api.configuracion.obtener(), staleTime: 5 * 60_000 })

export const usePlantillas = () =>
  useQuery({ queryKey: claves.plantillas, queryFn: () => api.plantillas.listar(), staleTime: 5 * 60_000 })

export const useEquipo = () => useQuery({ queryKey: claves.equipo, queryFn: () => api.usuarios.equipo(), staleTime: 5 * 60_000 })
