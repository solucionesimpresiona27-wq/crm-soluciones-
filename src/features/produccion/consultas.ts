import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { claves as clavesApp } from '@/app/consultas'
import { api } from '@/data/api'
import type { HojaOrden, OrdenTrabajo } from '@/data/modulos/produccion/contrato'
import type { EstadoPedido } from '@/data/tipos'
import { ESTADO_PEDIDO } from '@/lib/estados'

/** Claves de TanStack Query del módulo (todas bajo "produccion"). */
export const claves = {
  tablero: ['produccion', 'tablero'] as const,
  orden: (id: string) => ['produccion', 'orden', id] as const,
}

/** Todo el tablero de una vez: los filtros (mis órdenes, responsable, búsqueda) se aplican en memoria. */
export const useTablero = () =>
  useQuery({
    queryKey: claves.tablero,
    queryFn: () => api.produccion.tablero(),
  })

export const useOrden = (id: string) =>
  useQuery({
    queryKey: claves.orden(id),
    queryFn: () => api.produccion.orden(id),
    enabled: Boolean(id),
  })

interface Mover {
  orden: Pick<OrdenTrabajo, 'id' | 'folio' | 'estado'>
  estado: EstadoPedido
  motivo?: string
}

/**
 * Cambia la etapa con actualización optimista: la tarjeta cambia de columna al instante y,
 * si la base lo rechaza, regresa a su lugar con un aviso que dice qué pasó.
 */
export function useMoverEtapa() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orden, estado, motivo }: Mover) => api.produccion.moverEtapa(orden.id, estado, motivo),
    onMutate: async ({ orden, estado, motivo }) => {
      await qc.cancelQueries({ queryKey: claves.tablero })
      const antes = qc.getQueryData<OrdenTrabajo[]>(claves.tablero)
      qc.setQueryData<OrdenTrabajo[]>(claves.tablero, (lista) =>
        lista?.map((o) =>
          o.id === orden.id
            ? {
                ...o,
                estado,
                estado_anterior: estado === 'pausado' ? o.estado : null,
                motivo_estado: estado === 'pausado' ? (motivo?.trim() ?? null) : null,
              }
            : o,
        ),
      )
      return { antes }
    },
    onError: (e: Error, { orden }, ctx) => {
      if (ctx?.antes) qc.setQueryData(claves.tablero, ctx.antes)
      toast.error(`No se pudo mover ${orden.folio}`, {
        description: `${e.message}. Regresó a “${ESTADO_PEDIDO[orden.estado].etiqueta}”; inténtalo de nuevo.`,
      })
    },
    onSuccess: (_r, { orden, estado }) => {
      toast.success(`${orden.folio} pasó a ${ESTADO_PEDIDO[estado].etiqueta.toLowerCase()}`)
    },
    onSettled: (_r, _e, { orden }) => {
      void qc.invalidateQueries({ queryKey: claves.tablero })
      void qc.invalidateQueries({ queryKey: claves.orden(orden.id) })
      void qc.invalidateQueries({ queryKey: clavesApp.dashboard })
    },
  })
}

export function useGuardarNotaPartida(pedidoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { partidaId: string; notas: string }) => api.produccion.guardarNotaPartida(v.partidaId, v.notas),
    onSuccess: (_r, v) => {
      qc.setQueryData<HojaOrden>(claves.orden(pedidoId), (h) =>
        h
          ? {
              ...h,
              partidas: h.partidas.map((p) => (p.id === v.partidaId ? { ...p, notas_produccion: v.notas.trim() || null } : p)),
            }
          : h,
      )
    },
    onError: (e: Error) =>
      toast.error('No se guardó la nota', {
        description: `${e.message}. Tu texto sigue en el campo; inténtalo de nuevo.`,
      }),
  })
}

export function useSubirEvidencia(pedidoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (fotos: File[]) => {
      for (const foto of fotos) await api.archivos.subir(pedidoId, foto, { categoria: 'evidencia' })
      return fotos.length
    },
    onSuccess: (cuantas) => toast.success(cuantas === 1 ? 'Evidencia guardada en la orden' : `${cuantas} evidencias guardadas en la orden`),
    onError: (e: Error) =>
      toast.error('No se pudo subir la evidencia', {
        description: `${e.message}. Revisa que sea JPG, PNG o PDF y vuelve a intentarlo.`,
      }),
    onSettled: () => void qc.invalidateQueries({ queryKey: claves.orden(pedidoId) }),
  })
}
