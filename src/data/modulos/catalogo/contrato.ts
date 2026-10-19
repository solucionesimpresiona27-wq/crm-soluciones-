/**
 * MÓDULO CATÁLOGO · contrato de datos.
 * Espacio: `api.catalogo` (productos, categorías, costos, precios por lista y escalas).
 *
 * Permisos: ver categorías, todo el equipo; productos (con su precio público y escalas) y
 * precios por lista, `ver_precios` (sin él la lista llega vacía); costos, `ver_costos`.
 * Editar: `editar_catalogo`, que solo vale con `ver_precios` (los costos además `ver_costos`).
 * El precio "público" es `precio_venta` del producto; mayoreo y agencia viven aparte y, si un
 * producto no tiene precio en la lista del cliente, se usa el público.
 * Regla del cliente: NO se inventan precios; el catálogo real llega sin precios y los captura el negocio.
 */
import type { MetodoCalculo, ProductoCatalogo } from '@/data/tipos'
import type { Database, Tables } from '@/lib/database.types'

export type { ProductoCatalogo }
export type ListaPrecio = Database['public']['Enums']['lista_precio']

export type Escala = {
  /** Unidades desde las que aplica (m², piezas, millares…) */
  desde: number
  precio: number
}

export type Categoria = Tables<'categorias'>

/** Producto completo para la pantalla del catálogo. */
export interface ProductoFicha extends Omit<Tables<'productos'>, 'busqueda' | 'escalas'> {
  escalas: Escala[]
  categoria: { id: string; nombre: string; grupo: string } | null
  /** Solo con `ver_costos` */
  costos: (NonNullable<ProductoCatalogo['costos']> & { notas: string | null; proveedor: string | null }) | null
  /** Precios de mayoreo y agencia (vacío sin `ver_precios`) */
  precios: PrecioLista[]
}

export interface PrecioLista {
  producto_id: string
  /** mayoreo o agencia (el público es precio_venta) */
  lista: Exclude<ListaPrecio, 'publico'>
  precio: number
  precio_minimo: number | null
  escalas: Escala[]
}

/** Precio que aplica a un producto para una lista (con respaldo al público). */
export interface PrecioAplicado {
  producto_id: string
  lista_aplicada: ListaPrecio
  precio: number | null
  precio_minimo: number | null
  escalas: Escala[]
}

export interface DatosProducto {
  nombre: string
  descripcion?: string | null
  categoria_id?: string | null
  metodo_calculo: MetodoCalculo
  unidad: string
  /** Precio público; null = se cotiza en cada caso */
  precio_venta?: number | null
  precio_minimo?: number | null
  escalas?: Escala[]
  sku?: string | null
  tiempo_entrega?: string | null
  requiere_diseno?: boolean
  requiere_produccion?: boolean
  requiere_instalacion?: boolean
}

export interface DatosCostos {
  costo_material: number
  costo_mano_obra: number
  costo_fijo: number
  desperdicio_pct: number
  ganancia_pct: number
  notas?: string | null
  proveedor?: string | null
}

export interface ApiCatalogo {
  catalogo: {
    /** Productos ACTIVOS para el editor de cotizaciones (con costos si hay `ver_costos`). */
    productos(): Promise<ProductoCatalogo[]>
    /** Catálogo completo para administrarlo, por nombre. */
    listar(filtros?: { texto?: string; categoriaId?: string; incluirInactivos?: boolean }): Promise<ProductoFicha[]>
    obtener(id: string): Promise<ProductoFicha>
    categorias(opciones?: { incluirInactivas?: boolean }): Promise<Categoria[]>
    guardarCategoria(datos: { id?: string; nombre: string; grupo: string; orden?: number; descripcion?: string | null; activo?: boolean }): Promise<Categoria>
    crearProducto(datos: DatosProducto): Promise<ProductoFicha>
    actualizarProducto(id: string, cambios: Partial<DatosProducto>): Promise<ProductoFicha>
    /** Los productos usados en cotizaciones no se borran: se desactivan. */
    activarProducto(id: string, activo: boolean): Promise<void>
    /** Costos base (material, mano de obra, fijo, desperdicio y ganancia). Requiere `ver_costos` y `editar_catalogo`. */
    guardarCostos(productoId: string, costos: DatosCostos): Promise<void>
    /** Precios por lista de todos los productos o de uno. Requiere `ver_precios`. */
    precios(productoId?: string): Promise<PrecioLista[]>
    guardarPrecioLista(datos: PrecioLista): Promise<PrecioLista>
    eliminarPrecioLista(productoId: string, lista: Exclude<ListaPrecio, 'publico'>): Promise<void>
    /** Precio de cada producto activo para una lista (respaldo: precio público). Requiere `ver_precios`. */
    preciosPara(lista: ListaPrecio): Promise<PrecioAplicado[]>
  }
}
