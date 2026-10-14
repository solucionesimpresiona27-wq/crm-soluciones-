/**
 * MÓDULO PEDIDOS · contrato de datos.
 * Espacios: `api.pedidos` (pedidos, línea de tiempo y facturación) y `api.archivos`
 * (diseños con versiones y aprobaciones, referencias y evidencias).
 *
 * Permisos (los aplica la base de datos; la vista previa los imita):
 *   * Ver pedidos: todo el equipo. Montos, precios y notas internas solo con `ver_precios`
 *     (sin ese permiso llegan como null). Costos por partida solo con `ver_costos`.
 *   * Crear, editar, facturar, cancelar o reabrir: `gestionar_pedidos`.
 *   * Cambiar de etapa: `actualizar_produccion` o `gestionar_pedidos`.
 *   * Notas en la línea de tiempo: cualquier usuario activo.
 *   * Subir archivos: `actualizar_produccion`, `gestionar_pedidos` o `gestionar_clientes`.
 *   * Registrar aprobaciones de diseño: `aprobar_disenos`.
 *   * Eliminar un archivo: quien lo subió (si no está aprobado) o administración.
 */
import type { CostosPartida, EstadoPedido, MetodoCalculo, TipoPartida } from '@/data/tipos'
import type { Database, Tables } from '@/lib/database.types'

type Enums = Database['public']['Enums']
export type EstadoPago = Enums['estado_pago']
export type Prioridad = Enums['prioridad']
export type EstadoArchivo = Enums['estado_archivo']
export type CategoriaArchivo = 'diseno' | 'referencia' | 'evidencia' | 'otro'

/** Renglón de la lista / tablero de pedidos (vista ordenes_trabajo). */
export interface PedidoLista {
  id: string
  folio: string
  titulo: string
  cotizacion_id: string | null
  cliente_id: string
  cliente: string
  cliente_whatsapp: string | null
  estado: EstadoPedido
  estado_anterior: EstadoPedido | null
  motivo_estado: string | null
  etapas_omitidas: EstadoPedido[]
  prioridad: Prioridad
  fecha_entrega: string | null
  atrasado: boolean
  requiere_instalacion: boolean
  requiere_factura: boolean
  facturado: boolean
  estado_pago: EstadoPago
  anticipo_recibido: boolean
  /** null sin `ver_precios` */
  total: number | null
  pagado: number | null
  saldo: number | null
  vendedor_id: string | null
  responsable_id: string | null
  disenador_id: string | null
  num_partidas: number
  num_disenos: number
  created_at: string
  updated_at: string
  entregado_at: string | null
  finalizado_at: string | null
}

export interface FiltrosPedidos {
  /** Folio, título o cliente */
  texto?: string
  estados?: EstadoPedido[]
  /** Por omisión se excluyen finalizados y cancelados */
  incluirCerrados?: boolean
  clienteId?: string
  responsableId?: string
  vendedorId?: string
  soloAtrasados?: boolean
  /** Fecha de alta (AAAA-MM-DD) */
  desde?: string
  hasta?: string
  limite?: number
}

/** Concepto del pedido. Precios null sin `ver_precios`; costos null sin `ver_costos`. */
export interface PartidaPedido {
  id: string
  orden: number
  tipo: TipoPartida
  producto_id: string | null
  concepto: string
  descripcion: string | null
  metodo_calculo: MetodoCalculo
  unidad: string
  ancho: number | null
  alto: number | null
  largo: number | null
  cantidad: number
  notas_produccion: string | null
  precio_unitario: number | null
  descuento_pct: number | null
  importe: number | null
  costos: CostosPartida | null
}

export interface PedidoDetalle extends PedidoLista {
  descripcion: string | null
  direccion_instalacion: string | null
  contacto_id: string | null
  cotizacion_folio: string | null
  cliente_datos: { id: string; nombre: string; whatsapp: string | null; telefono: string | null; email: string | null; requiere_factura: boolean }
  vendedor: string | null
  responsable: string | null
  disenador: string | null
  /** Con `ver_precios`; null sin él */
  montos: {
    anticipo_pct: number
    aplica_iva: boolean
    iva_pct: number
    subtotal: number
    descuento: number
    recargo: number
    iva: number
    total: number
    pagado: number
    saldo: number
    fecha_limite_pago: string | null
    condiciones: string | null
    notas_internas: string | null
  } | null
  folio_factura: string | null
  fecha_factura: string | null
  partidas: PartidaPedido[]
}

/** Evento de la línea de tiempo con el nombre de quien lo hizo. */
export type EventoPedido = Tables<'pedido_eventos'> & { usuario: string | null }

/** Archivo de un pedido con el nombre de quien lo subió. */
export type Archivo = Tables<'archivos'> & { subido_por_nombre: string | null }

export interface NuevaPartida {
  tipo?: TipoPartida
  producto_id?: string | null
  concepto: string
  descripcion?: string | null
  metodo_calculo: MetodoCalculo
  unidad?: string
  ancho?: number | null
  alto?: number | null
  largo?: number | null
  cantidad: number
  precio_unitario: number
  descuento_pct?: number
  notas_produccion?: string | null
}

/** Pedido directo (sin cotización). Para pedidos que vienen de una cotización usa `api.cotizaciones.convertir`. */
export interface DatosPedido {
  cliente_id: string
  titulo: string
  descripcion?: string | null
  /** AAAA-MM-DD */
  fecha_entrega?: string | null
  prioridad?: Prioridad
  requiere_instalacion?: boolean
  direccion_instalacion?: string | null
  responsable_id?: string | null
  disenador_id?: string | null
  contacto_id?: string | null
  /** Por omisión se calculan con los conceptos (sin diseño, sin taller o sin instalación) */
  etapas_omitidas?: EstadoPedido[]
  anticipo_pct?: number
  aplica_iva?: boolean
  iva_pct?: number
  fecha_limite_pago?: string | null
  requiere_factura?: boolean
  notas_internas?: string | null
  /** Puede ir vacío: los conceptos se agregan después con `agregarPartida`. */
  partidas: NuevaPartida[]
}

/** Cambios a un concepto del pedido (los que no se envían no cambian). */
export type CambiosPartida = Partial<Omit<NuevaPartida, 'tipo' | 'producto_id'>>

export type CambiosPedido = Partial<Omit<DatosPedido, 'cliente_id' | 'partidas'>>

export interface DatosFactura {
  facturado: boolean
  folio_factura?: string | null
  /** AAAA-MM-DD; hoy por omisión al marcar facturado */
  fecha_factura?: string | null
}

export interface ApiPedidos {
  pedidos: {
    /** Pedidos de la vista de órdenes de trabajo, por fecha de entrega (sin fecha al final). */
    listar(filtros?: FiltrosPedidos): Promise<PedidoLista[]>
    /** Detalle completo con conceptos. */
    obtener(id: string): Promise<PedidoDetalle>
    /** Pedido directo; los conceptos pueden ir vacíos y agregarse después. Requiere `gestionar_pedidos`. */
    crear(datos: DatosPedido): Promise<{ id: string; folio: string }>
    /** Cambia datos generales (no conceptos ni etapa). Requiere `gestionar_pedidos`. */
    actualizar(id: string, cambios: CambiosPedido): Promise<void>
    /**
     * Cambia la etapa. "pausado" y "cancelado" exigen motivo; cancelar o reabrir un pedido
     * cancelado/finalizado requiere `gestionar_pedidos`.
     */
    cambiarEstado(id: string, estado: EstadoPedido, motivo?: string): Promise<void>
    /** Nota en la línea de tiempo. */
    agregarNota(id: string, mensaje: string): Promise<void>
    /** Línea de tiempo (lo más antiguo primero). */
    eventos(id: string): Promise<EventoPedido[]>
    /** Facturación externa: marca facturado con folio CFDI. Requiere `gestionar_pedidos`. */
    facturar(id: string, datos: DatosFactura): Promise<void>
    /** Agrega un concepto al final del pedido (los totales se recalculan). Requiere `gestionar_pedidos` y `ver_precios`. */
    agregarPartida(pedidoId: string, partida: NuevaPartida): Promise<void>
    /** Cambia un concepto (cantidad, precio, notas de producción…). Requiere `gestionar_pedidos` y `ver_precios`. */
    actualizarPartida(id: string, cambios: CambiosPartida): Promise<void>
    /** Quita un concepto del pedido. Requiere `gestionar_pedidos`. */
    eliminarPartida(id: string): Promise<void>
  }
  archivos: {
    /** Archivos del pedido, lo más reciente primero. */
    listar(pedidoId: string): Promise<Archivo[]>
    /** Sube un archivo ligero (JPG, PNG o PDF). Los diseños quedan "pendientes" con versión consecutiva. */
    subir(pedidoId: string, archivo: File | Blob, opciones?: { nombre?: string; categoria?: CategoriaArchivo }): Promise<Archivo>
    /** Liga a un original pesado (Drive, Dropbox…) en lugar de subirlo. */
    agregarEnlace(pedidoId: string, datos: { nombre: string; enlace: string; categoria?: CategoriaArchivo }): Promise<Archivo>
    /** Registra la respuesta del cliente a un diseño. Requiere `aprobar_disenos`. */
    registrarAprobacion(id: string, datos: { estado: 'aprobado' | 'cambios' | 'rechazado'; aprobado_por_nombre: string; notas?: string | null }): Promise<Archivo>
    /** Enlace temporal (10 minutos) para ver o descargar; el enlace externo tal cual. */
    url(id: string): Promise<string | null>
    eliminar(id: string): Promise<void>
  }
}
