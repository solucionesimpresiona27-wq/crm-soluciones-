/**
 * MÓDULO INVENTARIO · contrato de datos.
 * Espacios: `api.materiales` (catálogo de materiales y costo), `api.inventario` (kárdex:
 * entradas, consumos, mermas y ajustes), `api.proveedores` y `api.gastos` (compras, maquila
 * y gastos del negocio).
 *
 * Permisos (los aplica la base de datos; la vista previa los imita):
 *   * Ver materiales y movimientos: todo el equipo. Costo unitario: `ver_costos`.
 *   * Crear/editar materiales, entradas y ajustes: `gestionar_inventario`.
 *   * Consumos y mermas: `registrar_consumos` o `gestionar_inventario`.
 *   * Proveedores: ver con `gestionar_inventario`, `registrar_gastos` o `ver_costos`; editar con
 *     `gestionar_inventario` o `registrar_gastos`; eliminar con `eliminar_registros`.
 *   * Gastos: ver con `registrar_gastos` o `ver_costos`; registrar, editar y cancelar con
 *     `registrar_gastos`; eliminar con `eliminar_registros`. Con la caja del día cerrada, solo
 *     administración registra o cambia gastos EN EFECTIVO de ese día.
 * La existencia la calcula la base de datos con los movimientos (no se edita directo).
 */
import type { MetodoPago } from '@/data/tipos'
import type { Database, Tables } from '@/lib/database.types'

type Enums = Database['public']['Enums']
export type UnidadMaterial = Enums['unidad_material']
export type TipoMovimiento = Enums['tipo_movimiento']
export type CategoriaGasto = Enums['categoria_gasto']

export const UNIDADES_MATERIAL: Record<UnidadMaterial, string> = {
  m2: 'm²',
  metro: 'metro',
  hoja: 'hoja',
  pieza: 'pieza',
  litro: 'litro',
  rollo: 'rollo',
  kg: 'kg',
  millar: 'millar',
}

export const TIPOS_MOVIMIENTO: Record<TipoMovimiento, string> = {
  entrada: 'Entrada',
  consumo: 'Consumo',
  ajuste: 'Ajuste',
  merma: 'Merma',
}

export const CATEGORIAS_GASTO: Record<CategoriaGasto, string> = {
  material: 'Material',
  maquila: 'Maquila',
  servicios: 'Servicios',
  renta: 'Renta',
  nomina: 'Nómina',
  transporte: 'Transporte',
  publicidad: 'Publicidad',
  impuestos: 'Impuestos',
  otros: 'Otros',
}

/** Material con proveedor y costo (el costo solo con `ver_costos`). */
export type Material = Omit<Tables<'materiales'>, 'busqueda' | 'bajo_minimo'> & {
  bajo_minimo: boolean
  proveedor: string | null
  costo_unitario: number | null
}

export interface FiltrosMateriales {
  texto?: string
  categoria?: string
  soloBajoMinimo?: boolean
  incluirInactivos?: boolean
}

export interface DatosMaterial {
  nombre: string
  categoria?: string | null
  unidad: UnidadMaterial
  stock_minimo?: number
  proveedor_id?: string | null
  ubicacion?: string | null
  notas?: string | null
  /** Solo al crear: queda como ajuste "Existencia inicial" */
  existencia_inicial?: number
  /** Requiere `ver_costos` */
  costo_unitario?: number | null
}

/** Movimiento del kárdex con nombres para mostrar. */
export type Movimiento = Tables<'movimientos_inventario'> & {
  material: string
  unidad: UnidadMaterial
  usuario: string | null
  folio_pedido: string | null
  proveedor: string | null
}

export interface FiltrosMovimientos {
  materialId?: string
  pedidoId?: string
  tipo?: TipoMovimiento
  /** AAAA-MM-DD */
  desde?: string
  hasta?: string
  limite?: number
}

export interface NuevoMovimiento {
  material_id: string
  tipo: TipoMovimiento
  /** Siempre positiva salvo en ajuste (diferencia con signo). Mejor usa `ajustar` para contar inventario. */
  cantidad: number
  pedido_id?: string | null
  proveedor_id?: string | null
  referencia?: string | null
  notas?: string | null
  /** ISO; ahora por omisión. No futura. */
  fecha?: string
}

export type Proveedor = Omit<Tables<'proveedores'>, 'busqueda'>

export interface DatosProveedor {
  nombre: string
  contacto?: string | null
  telefono?: string | null
  whatsapp?: string | null
  email?: string | null
  rfc?: string | null
  categoria?: string | null
  notas?: string | null
}

/** Gasto con nombres para mostrar. */
export type Gasto = Tables<'gastos'> & { proveedor: string | null; folio_pedido: string | null; usuario: string | null }

export interface FiltrosGastos {
  desde?: string
  hasta?: string
  categoria?: CategoriaGasto
  proveedorId?: string
  pedidoId?: string
  incluirCancelados?: boolean
  limite?: number
}

export interface DatosGasto {
  /** AAAA-MM-DD; hoy por omisión */
  fecha?: string
  concepto: string
  categoria: CategoriaGasto
  /** Con IVA si lo hubo */
  monto: number
  metodo_pago: MetodoPago
  proveedor_id?: string | null
  /** Para la utilidad real del pedido (maquila, material comprado para ese trabajo…) */
  pedido_id?: string | null
  referencia?: string | null
  notas?: string | null
}

export interface ApiInventario {
  materiales: {
    /** Materiales por nombre. */
    listar(filtros?: FiltrosMateriales): Promise<Material[]>
    obtener(id: string): Promise<Material>
    /** Requiere `gestionar_inventario`. La existencia inicial queda como ajuste. */
    crear(datos: DatosMaterial): Promise<Material>
    /** Datos generales (no la existencia: usa `api.inventario.ajustar`). */
    actualizar(id: string, cambios: Partial<Omit<DatosMaterial, 'existencia_inicial'>>): Promise<Material>
    /** Un material con movimientos no se borra: se desactiva. */
    activar(id: string, activo: boolean): Promise<void>
    /** Solo materiales sin movimientos. */
    eliminar(id: string): Promise<void>
  }
  inventario: {
    /** Kárdex (lo más reciente primero). */
    movimientos(filtros?: FiltrosMovimientos): Promise<Movimiento[]>
    /** Entrada, consumo, merma o ajuste. Un consumo o merma que deje existencia negativa se rechaza. */
    registrar(datos: NuevoMovimiento): Promise<Movimiento>
    /** Conteo físico: deja la existencia en `existencia` con un ajuste. Requiere `gestionar_inventario`. */
    ajustar(materialId: string, existencia: number, notas?: string): Promise<{ movimiento_id: string | null; existencia: number; diferencia: number }>
    /** Materiales activos en o por debajo del mínimo (alerta de stock). */
    stockBajo(): Promise<Material[]>
  }
  proveedores: {
    listar(filtros?: { texto?: string; incluirInactivos?: boolean }): Promise<Proveedor[]>
    crear(datos: DatosProveedor): Promise<Proveedor>
    actualizar(id: string, cambios: Partial<DatosProveedor>): Promise<Proveedor>
    activar(id: string, activo: boolean): Promise<void>
    /** Requiere `eliminar_registros`. */
    eliminar(id: string): Promise<void>
  }
  gastos: {
    /** Gastos por fecha (lo más reciente primero). */
    listar(filtros?: FiltrosGastos): Promise<Gasto[]>
    registrar(datos: DatosGasto): Promise<Gasto>
    actualizar(id: string, cambios: Partial<DatosGasto>): Promise<Gasto>
    /** Con motivo; un gasto cancelado no se reactiva. */
    cancelar(id: string, motivo: string): Promise<void>
    /** Sube el comprobante (imagen o PDF). Requiere `registrar_gastos`. */
    subirComprobante(id: string, archivo: File | Blob): Promise<Gasto>
    /** Enlace temporal (10 minutos) del comprobante. */
    urlComprobante(id: string): Promise<string | null>
    /** Requiere `eliminar_registros`. */
    eliminar(id: string): Promise<void>
  }
}
