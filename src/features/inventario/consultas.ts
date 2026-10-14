import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { claves } from '@/app/consultas'
import { api } from '@/data/api'
import type {
  DatosGasto,
  DatosMaterial,
  DatosProveedor,
  FiltrosGastos,
  FiltrosMateriales,
  FiltrosMovimientos,
  NuevoMovimiento,
} from '@/data/modulos/inventario/contrato'

/** Claves de TanStack Query del módulo de inventario. */
export const clavesInventario = {
  materiales: (f: FiltrosMateriales) => ['inventario', 'materiales', f] as const,
  movimientos: (f: FiltrosMovimientos) => ['inventario', 'movimientos', f] as const,
  proveedores: (inactivos: boolean) => ['inventario', 'proveedores', inactivos] as const,
  gastos: (f: FiltrosGastos) => ['inventario', 'gastos', f] as const,
  pedidos: (texto: string) => ['inventario', 'pedidos', texto] as const,
}

export const useMateriales = (f: FiltrosMateriales = {}) =>
  useQuery({ queryKey: clavesInventario.materiales(f), queryFn: () => api.materiales.listar(f), placeholderData: keepPreviousData })

export const useMovimientos = (f: FiltrosMovimientos, activo = true) =>
  useQuery({ queryKey: clavesInventario.movimientos(f), queryFn: () => api.inventario.movimientos(f), placeholderData: keepPreviousData, enabled: activo })

export const useProveedores = (activo = true, inactivos = false) =>
  useQuery({ queryKey: clavesInventario.proveedores(inactivos), queryFn: () => api.proveedores.listar({ incluirInactivos: inactivos }), enabled: activo })

export const useGastos = (f: FiltrosGastos, activo = true) =>
  useQuery({ queryKey: clavesInventario.gastos(f), queryFn: () => api.gastos.listar(f), placeholderData: keepPreviousData, enabled: activo })

/** Pedidos abiertos para ligar un consumo o un gasto (folio, título o cliente). */
export const usePedidosParaLigar = (texto: string, activo = true) =>
  useQuery({
    queryKey: clavesInventario.pedidos(texto),
    // El filtro de texto se aplica después del límite en la implementación real: se pide todo y se recorta aquí
    queryFn: async () => (await api.pedidos.listar({ texto: texto.trim() || undefined })).slice(0, 20),
    enabled: activo,
    placeholderData: keepPreviousData,
  })

function useInvalidar() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: ['inventario'] })
    void qc.invalidateQueries({ queryKey: claves.dashboard })
  }
}

export function useGuardarMaterial() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: (v: { id?: string; datos: DatosMaterial }) => {
      if (!v.id) return api.materiales.crear(v.datos)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { existencia_inicial, ...cambios } = v.datos
      return api.materiales.actualizar(v.id, cambios)
    },
    onSuccess: invalidar,
  })
}

export function useActivarMaterial() {
  const invalidar = useInvalidar()
  return useMutation({ mutationFn: (v: { id: string; activo: boolean }) => api.materiales.activar(v.id, v.activo), onSuccess: invalidar })
}

/** Movimiento; en una entrada puede actualizar el costo unitario y registrar el gasto de la compra. */
export function useRegistrarMovimiento() {
  const invalidar = useInvalidar()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { datos: NuevoMovimiento; costoUnitario?: number | null; gasto?: DatosGasto | null; existenciaContada?: number }) => {
      const mov =
        v.datos.tipo === 'ajuste' && v.existenciaContada !== undefined
          ? await api.inventario.ajustar(v.datos.material_id, v.existenciaContada, v.datos.notas ?? undefined)
          : await api.inventario.registrar(v.datos)
      const avisos: string[] = []
      if (v.costoUnitario !== undefined && v.costoUnitario !== null) {
        try {
          await api.materiales.actualizar(v.datos.material_id, { costo_unitario: v.costoUnitario })
        } catch (e) {
          avisos.push(`No se actualizó el costo: ${(e as Error).message}`)
        }
      }
      if (v.gasto) {
        try {
          await api.gastos.registrar(v.gasto)
        } catch (e) {
          avisos.push(`La entrada quedó, pero el gasto no: ${(e as Error).message}`)
        }
      }
      return { mov, avisos }
    },
    onSuccess: () => {
      invalidar()
      void qc.invalidateQueries({ queryKey: ['pedidos'] })
    },
  })
}

export function useGuardarProveedor() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: (v: { id?: string; datos: DatosProveedor }) => (v.id ? api.proveedores.actualizar(v.id, v.datos) : api.proveedores.crear(v.datos)),
    onSuccess: invalidar,
  })
}

export function useActivarProveedor() {
  const invalidar = useInvalidar()
  return useMutation({ mutationFn: (v: { id: string; activo: boolean }) => api.proveedores.activar(v.id, v.activo), onSuccess: invalidar })
}

export function useRegistrarGasto() {
  const invalidar = useInvalidar()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { datos: DatosGasto; comprobante?: File | null }) => {
      const gasto = await api.gastos.registrar(v.datos)
      if (!v.comprobante) return { gasto, errorComprobante: null as string | null }
      try {
        return { gasto: await api.gastos.subirComprobante(gasto.id, v.comprobante), errorComprobante: null }
      } catch (e) {
        return { gasto, errorComprobante: (e as Error).message }
      }
    },
    onSuccess: () => {
      invalidar()
      void qc.invalidateQueries({ queryKey: ['pagos'] })
      void qc.invalidateQueries({ queryKey: ['reportes'] })
    },
  })
}

export function useCancelarGasto() {
  const invalidar = useInvalidar()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: string; motivo: string }) => api.gastos.cancelar(v.id, v.motivo),
    onSuccess: () => {
      invalidar()
      void qc.invalidateQueries({ queryKey: ['pagos'] })
    },
  })
}
