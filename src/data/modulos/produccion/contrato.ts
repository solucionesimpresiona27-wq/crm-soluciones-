/**
 * MÓDULO PRODUCCIÓN · contrato de datos.
 * Espacio: `api.produccion` (tablero por etapas y hoja de orden de trabajo).
 *
 * Nunca incluye precios, totales ni pagos (PLAN.md §3: Producción trabaja sin precios),
 * aunque quien consulte sí tenga `ver_precios`.
 * Permisos: ver, todo el equipo activo; mover de etapa y editar notas de producción,
 * `actualizar_produccion` o `gestionar_pedidos`. Cancelar o reabrir pedidos es de Pedidos.
 */
import type { EstadoPedido, MetodoCalculo, TipoPartida } from '@/data/tipos'
import type { Database } from '@/lib/database.types'

type Enums = Database['public']['Enums']

/** Tarjeta del tablero (sin montos). */
export interface OrdenTrabajo {
  id: string
  folio: string
  titulo: string
  descripcion: string | null
  cliente_id: string
  /** Producción solo ve el nombre del cliente en su orden */
  cliente: string
  estado: EstadoPedido
  estado_anterior: EstadoPedido | null
  motivo_estado: string | null
  etapas_omitidas: EstadoPedido[]
  prioridad: Enums['prioridad']
  fecha_entrega: string | null
  atrasado: boolean
  requiere_instalacion: boolean
  direccion_instalacion: string | null
  responsable_id: string | null
  responsable: string | null
  disenador_id: string | null
  disenador: string | null
  /** Si ya hay anticipo (sin decir cuánto) */
  anticipo_recibido: boolean
  num_partidas: number
  num_disenos: number
  created_at: string
  updated_at: string
}

/** Concepto de la hoja de trabajo (sin precio). */
export interface PartidaOrden {
  id: string
  orden: number
  tipo: TipoPartida
  concepto: string
  descripcion: string | null
  metodo_calculo: MetodoCalculo
  unidad: string
  ancho: number | null
  alto: number | null
  largo: number | null
  cantidad: number
  notas_produccion: string | null
}

export interface HojaOrden {
  orden: OrdenTrabajo
  partidas: PartidaOrden[]
  /** Diseños del pedido (el más reciente primero); el archivo se abre con `api.archivos.url(id)` */
  disenos: Array<{
    id: string
    nombre: string
    version: number | null
    estado_aprobacion: Enums['estado_archivo']
    mime: string | null
    tiene_archivo: boolean
    enlace_externo: string | null
    created_at: string
  }>
  /** Notas de la línea de tiempo (lo más reciente primero) */
  notas: Array<{ id: number; mensaje: string; usuario: string | null; created_at: string }>
}

export interface FiltrosTablero {
  responsableId?: string
  /** Folio, título o cliente */
  texto?: string
  /** Incluye los entregados (por omisión, solo trabajo pendiente) */
  incluirEntregados?: boolean
}

export interface ApiProduccion {
  produccion: {
    /** Órdenes activas (sin finalizados ni cancelados), por fecha de entrega. */
    tablero(filtros?: FiltrosTablero): Promise<OrdenTrabajo[]>
    /** Hoja de orden de trabajo para imprimir o consultar en el taller. */
    orden(id: string): Promise<HojaOrden>
    /** Arrastrar a otra etapa. "pausado" exige motivo. */
    moverEtapa(id: string, estado: EstadoPedido, motivo?: string): Promise<void>
    /** Notas de producción de un concepto (medidas, acabados, cuidados). */
    guardarNotaPartida(partidaId: string, notas: string): Promise<void>
    /** Nota en la línea de tiempo del pedido (evidencias, avisos al equipo). */
    agregarNota(id: string, mensaje: string): Promise<void>
  }
}
