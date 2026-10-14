import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { claves } from '@/app/consultas'
import { api } from '@/data/api'
import type { DatosCostos, DatosProducto, ListaPrecio, PrecioLista } from '@/data/modulos/catalogo/contrato'

export const clavesCatalogo = {
  todo: ['catalogo'] as const,
  lista: (inactivos: boolean) => ['catalogo', 'lista', inactivos] as const,
  categorias: ['catalogo', 'categorias'] as const,
  preciosPara: (lista: ListaPrecio) => ['catalogo', 'preciosPara', lista] as const,
}

export const useFichas = (incluirInactivos: boolean) =>
  useQuery({ queryKey: clavesCatalogo.lista(incluirInactivos), queryFn: () => api.catalogo.listar({ incluirInactivos }) })

export const useCategorias = () =>
  useQuery({ queryKey: clavesCatalogo.categorias, queryFn: () => api.catalogo.categorias({ incluirInactivas: true }), staleTime: 5 * 60_000 })

export const useProductosCalculadora = () => useQuery({ queryKey: claves.productos, queryFn: () => api.catalogo.productos(), staleTime: 60_000 })

export const usePreciosPara = (lista: ListaPrecio, habilitado: boolean) =>
  useQuery({ queryKey: clavesCatalogo.preciosPara(lista), queryFn: () => api.catalogo.preciosPara(lista), enabled: habilitado && lista !== 'publico' })

function useRefrescar() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: clavesCatalogo.todo })
    void qc.invalidateQueries({ queryKey: claves.productos })
  }
}

export interface GuardarProducto {
  id?: string
  datos: DatosProducto
  activo: boolean
  /** Solo si el usuario puede ver costos */
  costos?: DatosCostos | null
  /** Listas con precio; las que falten se eliminan (solo con ver_precios) */
  listas?: PrecioLista[] | null
  listasPrevias?: Array<PrecioLista['lista']>
}

export function useGuardarProducto() {
  const refrescar = useRefrescar()
  return useMutation({
    mutationFn: async ({ id, datos, activo, costos, listas, listasPrevias = [] }: GuardarProducto) => {
      const ficha = id ? await api.catalogo.actualizarProducto(id, datos) : await api.catalogo.crearProducto(datos)
      if (ficha.activo !== activo) await api.catalogo.activarProducto(ficha.id, activo)
      if (costos) await api.catalogo.guardarCostos(ficha.id, costos)
      if (listas) {
        for (const l of listas) await api.catalogo.guardarPrecioLista({ ...l, producto_id: ficha.id })
        for (const previa of listasPrevias) if (!listas.some((l) => l.lista === previa)) await api.catalogo.eliminarPrecioLista(ficha.id, previa)
      }
      return ficha
    },
    onSuccess: refrescar,
  })
}

export function useGuardarCategoria() {
  const refrescar = useRefrescar()
  return useMutation({ mutationFn: api.catalogo.guardarCategoria, onSuccess: refrescar })
}
