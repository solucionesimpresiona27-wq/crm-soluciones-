import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/data/api'
import type { Agrupacion } from '@/data/modulos/reportes/contrato'

/** Consultas del módulo de reportes (TanStack Query). */
const opciones = { placeholderData: keepPreviousData, staleTime: 60_000 }

export const useVentas = (desde: string, hasta: string, agrupar: Agrupacion) =>
  useQuery({ queryKey: ['reportes', 'ventas', desde, hasta, agrupar], queryFn: () => api.reportes.ventas(desde, hasta, agrupar), ...opciones })

/** Totales del periodo anterior (una sola fila agrupada por mes basta para sumar). */
export const useVentasAnterior = (desde: string, hasta: string) =>
  useQuery({ queryKey: ['reportes', 'ventas', desde, hasta, 'mes'], queryFn: () => api.reportes.ventas(desde, hasta, 'mes'), ...opciones })

export const useProductos = (desde: string, hasta: string) =>
  useQuery({ queryKey: ['reportes', 'productos', desde, hasta], queryFn: () => api.reportes.productos(desde, hasta, 30), ...opciones })

export const useVendedores = (desde: string, hasta: string) =>
  useQuery({ queryKey: ['reportes', 'vendedores', desde, hasta], queryFn: () => api.reportes.vendedores(desde, hasta), ...opciones })

export const useComisionesPeriodo = (desde: string, hasta: string) =>
  useQuery({ queryKey: ['pagos', 'comisiones', desde, hasta], queryFn: () => api.comisiones.resumen(desde, hasta), ...opciones })

export const useMejoresClientes = (desde: string, hasta: string) =>
  useQuery({ queryKey: ['reportes', 'clientes', desde, hasta], queryFn: () => api.reportes.clientes(desde, hasta, 20), ...opciones })

export const useUtilidad = (desde: string, hasta: string, activo: boolean) =>
  useQuery({ queryKey: ['reportes', 'utilidad', desde, hasta], queryFn: () => api.reportes.utilidad(desde, hasta), enabled: activo, ...opciones })

export const useCobranza = (activo: boolean) =>
  useQuery({ queryKey: ['pagos', 'cobranza'], queryFn: () => api.cobranza.cuentasPorCobrar(), enabled: activo, staleTime: 60_000 })

export const useInactivos = () => useQuery({ queryKey: ['reportes', 'inactivos', 90], queryFn: () => api.clientes.inactivos(90), staleTime: 60_000 })
