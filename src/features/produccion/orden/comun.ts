import type { OrdenTrabajo } from '@/data/modulos/produccion/contrato'

export const PRIORIDAD: Record<OrdenTrabajo['prioridad'], string> = {
  baja: 'Baja',
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
}

/** Casillas de revisión del taller (en pantalla y en la hoja impresa). */
export const PASOS_TALLER: Array<{
  id: string
  texto: string
  soloInstalacion?: boolean
}> = [
  { id: 'material', texto: 'Material y medidas revisados' },
  { id: 'diseno', texto: 'Impresión comparada con el diseño aprobado' },
  { id: 'acabados', texto: 'Acabados listos (corte, ojillos, laminado)' },
  { id: 'empaque', texto: 'Empacado y protegido para entrega' },
  {
    id: 'instalacion',
    texto: 'Instalación terminada y fotos tomadas',
    soloInstalacion: true,
  },
]
