/**
 * MÓDULO AGENDA · contrato de datos.
 * Espacios: `api.tareas` (tareas y recordatorios, "Mis pendientes de hoy") y `api.agenda`
 * (calendario combinado).
 *
 * Permisos: todo el equipo activo ve y crea tareas. Editar o completar: responsable, autor o
 * administración. Eliminar: autor o administración. En el calendario, los seguimientos del
 * embudo requieren `gestionar_clientes` y las cotizaciones por vencer `ver_precios` (sin montos).
 */
import type { Database, Tables } from '@/lib/database.types'

type Enums = Database['public']['Enums']
export type TipoTarea = Enums['tipo_tarea']
export type Prioridad = Enums['prioridad']

export const TIPOS_TAREA: Record<TipoTarea, string> = {
  tarea: 'Tarea',
  llamada: 'Llamada',
  seguimiento: 'Seguimiento',
  entrega: 'Entrega',
  instalacion: 'Instalación',
  recordatorio: 'Recordatorio',
}

/** Tarea con nombres para mostrar. `vencida`: sin completar y con fecha anterior a hoy. */
export type Tarea = Tables<'tareas'> & {
  responsable: string | null
  cliente: string | null
  folio_pedido: string | null
  vencida: boolean
}

export interface FiltrosTareas {
  /** AAAA-MM-DD */
  desde?: string
  hasta?: string
  responsableId?: string
  clienteId?: string
  pedidoId?: string
  oportunidadId?: string
  cotizacionId?: string
  /** Por omisión solo pendientes */
  incluirCompletadas?: boolean
  limite?: number
}

export interface DatosTarea {
  titulo: string
  descripcion?: string | null
  tipo?: TipoTarea
  /** AAAA-MM-DD; hoy por omisión */
  fecha?: string
  /** HH:MM */
  hora?: string | null
  /** Quien la crea, por omisión */
  responsable_id?: string | null
  prioridad?: Prioridad
  cliente_id?: string | null
  pedido_id?: string | null
  oportunidad_id?: string | null
  cotizacion_id?: string | null
}

export type OrigenAgenda = 'tarea' | 'entrega' | 'instalacion' | 'seguimiento' | 'cotizacion'

/** Renglón del calendario combinado (función agenda). */
export interface EventoAgenda {
  origen: OrigenAgenda
  /** Id de la tarea, pedido, oportunidad o cotización según el origen */
  id: string
  fecha: string
  hora: string | null
  titulo: string
  detalle: string | null
  tipo: string | null
  prioridad: Prioridad | null
  completada: boolean
  responsable_id: string | null
  cliente_id: string | null
  cliente: string | null
  pedido_id: string | null
  cotizacion_id: string | null
  oportunidad_id: string | null
  folio: string | null
  estado: string | null
}

export interface ApiAgenda {
  tareas: {
    /** Por fecha y hora. */
    listar(filtros?: FiltrosTareas): Promise<Tarea[]>
    /** Mis tareas sin completar con fecha de hoy o anterior ("Mis pendientes de hoy"). */
    misPendientes(): Promise<Tarea[]>
    /** Si se liga a un pedido, cotización u oportunidad, el cliente se toma de ahí. */
    crear(datos: DatosTarea): Promise<Tarea>
    actualizar(id: string, cambios: Partial<DatosTarea>): Promise<Tarea>
    /** Marca o desmarca como hecha (guarda quién y cuándo). */
    completar(id: string, completada?: boolean): Promise<Tarea>
    eliminar(id: string): Promise<void>
  }
  agenda: {
    /** Tareas, entregas, instalaciones, seguimientos y cotizaciones por vencer (máximo 366 días). */
    calendario(desde: string, hasta: string): Promise<EventoAgenda[]>
  }
}
