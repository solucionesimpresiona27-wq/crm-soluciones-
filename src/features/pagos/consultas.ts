import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { claves } from '@/app/consultas'
import { api } from '@/data/api'
import type { FiltrosPagos, NuevoPago } from '@/data/modulos/pagos/contrato'

/** Claves de TanStack Query del módulo de pagos. */
export const clavesPagos = {
  pagos: (f: FiltrosPagos) => ['pagos', 'lista', f] as const,
  cobranza: ['pagos', 'cobranza'] as const,
  caja: (fecha: string) => ['pagos', 'caja', fecha] as const,
  cortes: ['pagos', 'cortes'] as const,
  comisiones: (desde: string, hasta: string) => ['pagos', 'comisiones', desde, hasta] as const,
  detalleComisiones: (desde: string, hasta: string, v?: string) => ['pagos', 'comisiones', desde, hasta, 'detalle', v ?? ''] as const,
}

export const usePagos = (f: FiltrosPagos) =>
  useQuery({ queryKey: clavesPagos.pagos(f), queryFn: () => api.pagos.listar(f), placeholderData: keepPreviousData })

export const useCuentasPorCobrar = (activo = true) =>
  useQuery({ queryKey: clavesPagos.cobranza, queryFn: () => api.cobranza.cuentasPorCobrar(), enabled: activo })

export const useResumenCaja = (fecha: string) =>
  useQuery({ queryKey: clavesPagos.caja(fecha), queryFn: () => api.caja.resumen(fecha), placeholderData: keepPreviousData })

export const useCortes = () => useQuery({ queryKey: clavesPagos.cortes, queryFn: () => api.caja.cortes({ limite: 30 }) })

export const useComisiones = (desde: string, hasta: string) =>
  useQuery({ queryKey: clavesPagos.comisiones(desde, hasta), queryFn: () => api.comisiones.resumen(desde, hasta), placeholderData: keepPreviousData, enabled: Boolean(desde && hasta && hasta >= desde) })

export const useDetalleComisiones = (desde: string, hasta: string, vendedor?: string) =>
  useQuery({
    queryKey: clavesPagos.detalleComisiones(desde, hasta, vendedor),
    queryFn: () => api.comisiones.detalle(desde, hasta, vendedor),
    enabled: Boolean(vendedor && desde && hasta && hasta >= desde),
  })

/** Pedido para cobrar cuando se abre el diálogo desde un pedido concreto. */
export const usePedidoParaCobro = (id: string | undefined) =>
  useQuery({ queryKey: ['pedidos', 'detalle', id ?? ''], queryFn: () => api.pedidos.obtener(id!), enabled: Boolean(id) })

/** Un cobro cambia saldos, caja, comisiones, pedidos y el inicio: se refresca todo lo relacionado. */
export function useInvalidarCobros() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: ['pagos'] })
    void qc.invalidateQueries({ queryKey: ['pedidos'] })
    void qc.invalidateQueries({ queryKey: claves.dashboard })
  }
}

export function useRegistrarPago() {
  const invalidar = useInvalidarCobros()
  return useMutation({
    mutationFn: async (v: { datos: NuevoPago; comprobante?: File | null }) => {
      const pago = await api.pagos.registrar(v.datos)
      if (!v.comprobante) return { pago, errorComprobante: null as string | null }
      try {
        return { pago: await api.pagos.subirComprobante(pago.id, v.comprobante), errorComprobante: null }
      } catch (e) {
        return { pago, errorComprobante: (e as Error).message }
      }
    },
    onSuccess: invalidar,
  })
}

export function useCancelarPago() {
  const invalidar = useInvalidarCobros()
  return useMutation({
    mutationFn: (v: { id: string; motivo: string }) => api.pagos.cancelar(v.id, v.motivo),
    onSuccess: invalidar,
  })
}

export function useSubirComprobante() {
  const invalidar = useInvalidarCobros()
  return useMutation({
    mutationFn: (v: { id: string; archivo: File }) => api.pagos.subirComprobante(v.id, v.archivo),
    onSuccess: () => {
      invalidar()
      toast.success('Comprobante adjuntado')
    },
    onError: (e: Error) => toast.error(`No se pudo adjuntar el comprobante: ${e.message}`),
  })
}

export function useCerrarCaja() {
  const invalidar = useInvalidarCobros()
  return useMutation({
    mutationFn: (d: { fecha: string; efectivo_inicial: number; efectivo_contado: number; notas?: string | null }) => api.caja.cerrar(d),
    onSuccess: invalidar,
  })
}

export function useReabrirCaja() {
  const invalidar = useInvalidarCobros()
  return useMutation({
    mutationFn: (v: { fecha: string; motivo: string }) => api.caja.reabrir(v.fecha, v.motivo),
    onSuccess: invalidar,
  })
}

/** Abre el comprobante en otra pestaña con un enlace temporal. La pestaña se abre antes para que el navegador no la bloquee. */
export async function abrirComprobante(id: string) {
  const ventana = window.open('', '_blank')
  try {
    const url = await api.pagos.urlComprobante(id)
    if (!url) {
      ventana?.close()
      toast('Este pago no tiene comprobante')
      return
    }
    if (ventana) {
      ventana.opener = null
      ventana.location.href = url
    } else window.open(url, '_blank', 'noopener,noreferrer')
  } catch (e) {
    ventana?.close()
    toast.error(`No se pudo abrir el comprobante: ${(e as Error).message}`)
  }
}
