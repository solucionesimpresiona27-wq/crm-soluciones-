import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { claves } from '@/app/consultas'
import { api } from '@/data/api'
import type { CambiosPartida, CambiosPedido, CategoriaArchivo, DatosFactura, DatosPedido, NuevaPartida } from '@/data/modulos/pedidos/contrato'
import type { EstadoPedido } from '@/data/tipos'

/** Claves de TanStack Query del módulo (todas cuelgan de "pedidos" para invalidar de un golpe). */
export const clavesPedidos = {
  todo: ['pedidos'] as const,
  activos: ['pedidos', 'lista', 'activos'] as const,
  cerrados: ['pedidos', 'lista', 'cerrados'] as const,
  detalle: (id: string) => ['pedidos', 'detalle', id] as const,
  eventos: (id: string) => ['pedidos', 'detalle', id, 'eventos'] as const,
  archivos: (id: string) => ['pedidos', 'detalle', id, 'archivos'] as const,
}

export const usePedidosActivos = () => useQuery({ queryKey: clavesPedidos.activos, queryFn: () => api.pedidos.listar() })

/** Finalizados y cancelados: solo se piden al abrir el filtro "Cerrados". */
export const usePedidosCerrados = (activo: boolean) =>
  useQuery({
    queryKey: clavesPedidos.cerrados,
    queryFn: () => api.pedidos.listar({ estados: ['finalizado', 'cancelado'] }),
    enabled: activo,
  })

export const usePedido = (id: string) => useQuery({ queryKey: clavesPedidos.detalle(id), queryFn: () => api.pedidos.obtener(id), enabled: Boolean(id) })
export const useEventosPedido = (id: string) => useQuery({ queryKey: clavesPedidos.eventos(id), queryFn: () => api.pedidos.eventos(id), enabled: Boolean(id) })
export const useArchivosPedido = (id: string) => useQuery({ queryKey: clavesPedidos.archivos(id), queryFn: () => api.archivos.listar(id), enabled: Boolean(id) })

function useInvalidar() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: clavesPedidos.todo })
    void qc.invalidateQueries({ queryKey: ['produccion'] })
    void qc.invalidateQueries({ queryKey: claves.dashboard })
  }
}

/** Mutación del módulo: invalida pedidos y panel; los errores se muestran como aviso. */
function useAccion<V, R = void>(fn: (v: V) => Promise<R>, avisarError = true) {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: fn,
    onSuccess: invalidar,
    onError: avisarError ? (e: Error) => toast.error(e.message) : undefined,
  })
}

export const useCrearPedido = () => useAccion((d: DatosPedido) => api.pedidos.crear(d), false)
export const useActualizarPedido = () => useAccion((v: { id: string; cambios: CambiosPedido }) => api.pedidos.actualizar(v.id, v.cambios))
export const useCambiarEtapa = () =>
  useAccion((v: { id: string; estado: EstadoPedido; motivo?: string }) => api.pedidos.cambiarEstado(v.id, v.estado, v.motivo))
export const useAgregarNota = () => useAccion((v: { id: string; mensaje: string }) => api.pedidos.agregarNota(v.id, v.mensaje))
export const useFacturar = () => useAccion((v: { id: string; datos: DatosFactura }) => api.pedidos.facturar(v.id, v.datos))
export const useAgregarPartida = () => useAccion((v: { pedidoId: string; partida: NuevaPartida }) => api.pedidos.agregarPartida(v.pedidoId, v.partida), false)
export const useActualizarPartida = () => useAccion((v: { id: string; cambios: CambiosPartida }) => api.pedidos.actualizarPartida(v.id, v.cambios), false)
export const useEliminarPartida = () => useAccion((id: string) => api.pedidos.eliminarPartida(id))

export const useSubirArchivo = () =>
  useAccion((v: { pedidoId: string; archivo: File; categoria: CategoriaArchivo }) => api.archivos.subir(v.pedidoId, v.archivo, { categoria: v.categoria }), false)
export const useAgregarEnlace = () =>
  useAccion((v: { pedidoId: string; nombre: string; enlace: string; categoria: CategoriaArchivo }) =>
    api.archivos.agregarEnlace(v.pedidoId, { nombre: v.nombre, enlace: v.enlace, categoria: v.categoria }), false)
export const useRegistrarAprobacion = () =>
  useAccion((v: { id: string; estado: 'aprobado' | 'cambios' | 'rechazado'; nombre: string; notas?: string | null }) =>
    api.archivos.registrarAprobacion(v.id, { estado: v.estado, aprobado_por_nombre: v.nombre, notas: v.notas }), false)
export const useEliminarArchivo = () => useAccion((id: string) => api.archivos.eliminar(id))
