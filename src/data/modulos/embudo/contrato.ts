/**
 * MÓDULO EMBUDO · contrato de datos.
 * Espacio: `api.oportunidades`.
 *
 * Permisos: ver, crear, editar y mover oportunidades requiere `gestionar_clientes`;
 * eliminarlas, `eliminar_registros`. Las cotizaciones ligadas solo se ven con `ver_precios`.
 * Al pasar a "ganado" o "perdido" la base guarda la fecha de cierre; "perdido" exige motivo.
 * Una cotización enviada adelanta la oportunidad a "cotizacion_enviada" y una aceptada la gana.
 */
import type { EstadoCotizacion } from '@/data/tipos'
import type { Database, Tables } from '@/lib/database.types'

export type EtapaComercial = Database['public']['Enums']['etapa_comercial']

/** Etapas del tablero en orden. */
export const ETAPAS_EMBUDO: Array<{ etapa: EtapaComercial; etiqueta: string; cerrada?: boolean }> = [
  { etapa: 'prospecto_nuevo', etiqueta: 'Prospecto' },
  { etapa: 'contactado', etiqueta: 'Contactado' },
  { etapa: 'interesado', etiqueta: 'Interesado' },
  { etapa: 'cotizacion_enviada', etiqueta: 'Cotización enviada' },
  { etapa: 'en_seguimiento', etiqueta: 'En seguimiento' },
  { etapa: 'ganado', etiqueta: 'Ganado', cerrada: true },
  { etapa: 'perdido', etiqueta: 'Perdido', cerrada: true },
]

/** Oportunidad con los nombres que muestra la tarjeta del tablero. */
export type Oportunidad = Tables<'oportunidades'> & {
  cliente: { id: string; nombre: string; whatsapp: string | null }
  responsable: string | null
}

export interface OportunidadDetalle extends Oportunidad {
  /** Cotizaciones ligadas (vacío sin `ver_precios`) */
  cotizaciones: Array<{ id: string; folio: string; titulo: string | null; estado: EstadoCotizacion; total: number; fecha: string }>
}

export interface FiltrosOportunidades {
  responsableId?: string
  clienteId?: string
  texto?: string
  /**
   * Cerradas que se incluyen: 'mes' (ganadas/perdidas este mes, como el panel; por omisión),
   * 'todas' o 'ninguna'.
   */
  cerradas?: 'mes' | 'todas' | 'ninguna'
}

export interface DatosOportunidad {
  cliente_id: string
  titulo: string
  descripcion?: string | null
  etapa?: EtapaComercial
  valor_estimado?: number | null
  responsable_id?: string | null
  origen?: string | null
  proxima_accion?: string | null
  /** AAAA-MM-DD */
  proxima_accion_fecha?: string | null
  motivo_perdida?: string | null
}

/** Conteo y valor por etapa (abiertas + cerradas este mes), igual que el panel. */
export type ResumenEmbudo = Partial<Record<EtapaComercial, { cantidad: number; valor: number }>>

export interface ApiEmbudo {
  oportunidades: {
    /** Oportunidades para el tablero, por fecha de próxima acción (sin fecha al final). */
    listar(filtros?: FiltrosOportunidades): Promise<Oportunidad[]>
    obtener(id: string): Promise<OportunidadDetalle>
    crear(datos: DatosOportunidad): Promise<Oportunidad>
    /** Cambia solo los campos enviados (sin `cliente_id`). */
    actualizar(id: string, cambios: Partial<Omit<DatosOportunidad, 'cliente_id'>>): Promise<Oportunidad>
    /** Mueve de etapa (arrastrar en el tablero). "perdido" exige motivo. */
    moverEtapa(id: string, etapa: EtapaComercial, motivoPerdida?: string): Promise<Oportunidad>
    /** Requiere `eliminar_registros`. */
    eliminar(id: string): Promise<void>
    /** Conteo y valor por etapa. */
    resumen(): Promise<ResumenEmbudo>
  }
}
