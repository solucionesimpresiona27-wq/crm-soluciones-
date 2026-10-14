import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/data/api'
import type { DatosCliente, DatosContacto, ListaPrecio, NuevaActividad } from '@/data/modulos/clientes/contrato'

/** Claves de TanStack Query del módulo: todo cuelga de ['clientes'] para invalidar de un golpe. */
export const clavesClientes = {
  todo: ['clientes'] as const,
  lista: ['clientes', { vista: 'lista' }] as const,
  saldos: ['clientes', { vista: 'saldos' }] as const,
  inactivos: (dias: number) => ['clientes', { vista: 'inactivos', dias }] as const,
  ficha: (id: string) => ['clientes', { vista: 'ficha', id: id }] as const,
  resumen: (id: string) => ['clientes', { vista: 'resumen', id: id }] as const,
  historial: (id: string) => ['clientes', { vista: 'historial', id: id }] as const,
  contactos: (id: string) => ['clientes', { vista: 'contactos', id: id }] as const,
  actividades: (id: string) => ['clientes', { vista: 'actividades', id: id }] as const,
}

export const useClientesLista = () => useQuery({ queryKey: clavesClientes.lista, queryFn: () => api.clientes.listar({ limite: 2000 }) })

export const useSaldosClientes = (activo: boolean) =>
  useQuery({ queryKey: clavesClientes.saldos, queryFn: () => api.clientes.saldos(), enabled: activo })

export const useClientesInactivos = (dias: number, activo: boolean) =>
  useQuery({ queryKey: clavesClientes.inactivos(dias), queryFn: () => api.clientes.inactivos(dias), enabled: activo && dias > 0 })

export const useCliente = (id: string) => useQuery({ queryKey: clavesClientes.ficha(id), queryFn: () => api.clientes.obtener(id) })
export const useResumenCliente = (id: string) => useQuery({ queryKey: clavesClientes.resumen(id), queryFn: () => api.clientes.resumen(id) })
export const useHistorialCliente = (id: string) => useQuery({ queryKey: clavesClientes.historial(id), queryFn: () => api.clientes.historial(id) })
export const useContactos = (id: string) => useQuery({ queryKey: clavesClientes.contactos(id), queryFn: () => api.contactos.listar(id) })
export const useActividades = (id: string, activo: boolean) =>
  useQuery({ queryKey: clavesClientes.actividades(id), queryFn: () => api.actividades.listar({ clienteId: id, limite: 100 }), enabled: activo })
export const useEtiquetas = () => useQuery({ queryKey: ['clientes', { vista: 'etiquetas' }], queryFn: () => api.clientes.etiquetas(), staleTime: 60_000 })

function useInvalidar() {
  const qc = useQueryClient()
  return () => void qc.invalidateQueries({ queryKey: clavesClientes.todo })
}

export function useActualizarCliente(id: string) {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: (cambios: Partial<DatosCliente>) => api.clientes.actualizar(id, cambios),
    onSuccess: invalidar,
  })
}

export function useAsignarLista(id: string) {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: (lista: ListaPrecio) => api.clientes.asignarListaPrecio(id, lista),
    onSuccess: invalidar,
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useActivarCliente(id: string) {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: (activo: boolean) => api.clientes.activar(id, activo),
    onSuccess: invalidar,
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useEliminarCliente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.clientes.eliminar(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: clavesClientes.lista }),
  })
}

export function useGuardarContacto(clienteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id?: string; datos: DatosContacto }) => (v.id ? api.contactos.actualizar(v.id, v.datos) : api.contactos.crear(clienteId, v.datos)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clavesClientes.contactos(clienteId) })
      void qc.invalidateQueries({ queryKey: clavesClientes.lista })
    },
  })
}

export function useEliminarContacto(clienteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.contactos.eliminar(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clavesClientes.contactos(clienteId) })
      void qc.invalidateQueries({ queryKey: clavesClientes.lista })
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useRegistrarActividad(clienteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (datos: Omit<NuevaActividad, 'cliente_id'>) => api.actividades.registrar({ ...datos, cliente_id: clienteId }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: clavesClientes.actividades(clienteId) }),
  })
}

export function useEliminarActividad(clienteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.actividades.eliminar(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: clavesClientes.actividades(clienteId) }),
    onError: (e: Error) => toast.error(e.message),
  })
}
