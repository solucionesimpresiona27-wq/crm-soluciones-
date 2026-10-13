import { BellPlus, CalendarDays, ChartColumn, FilePlus2, Hammer, HandCoins, PackagePlus, UserPlus, type LucideIcon } from 'lucide-react'
import type { Permiso } from '@/data/tipos'

export interface AccionRapida {
  id: string
  etiqueta: string
  icono: LucideIcon
  /** Ruta a la que lleva, o acción especial */
  destino: string | 'nuevo-cliente'
  permiso?: Permiso
  /** Color de encendido del botón */
  tono: 'acento' | 'luz'
  destacada?: boolean
}

export const ACCIONES_RAPIDAS: AccionRapida[] = [
  { id: 'cotizacion', etiqueta: 'Nueva cotización', icono: FilePlus2, destino: '/cotizaciones/nueva', permiso: 'gestionar_cotizaciones', tono: 'luz', destacada: true },
  { id: 'cliente', etiqueta: 'Nuevo cliente', icono: UserPlus, destino: 'nuevo-cliente', permiso: 'gestionar_clientes', tono: 'acento' },
  { id: 'pedido', etiqueta: 'Nuevo pedido', icono: PackagePlus, destino: '/pedidos', permiso: 'gestionar_pedidos', tono: 'acento' },
  { id: 'pago', etiqueta: 'Registrar pago', icono: HandCoins, destino: '/pagos', permiso: 'registrar_pagos', tono: 'acento' },
  { id: 'recordatorio', etiqueta: 'Recordatorio', icono: BellPlus, destino: '/agenda', tono: 'acento' },
  { id: 'calendario', etiqueta: 'Calendario', icono: CalendarDays, destino: '/agenda', tono: 'acento' },
  { id: 'produccion', etiqueta: 'Producción', icono: Hammer, destino: '/produccion', permiso: 'actualizar_produccion', tono: 'acento' },
  { id: 'reportes', etiqueta: 'Reportes', icono: ChartColumn, destino: '/reportes', permiso: 'ver_reportes', tono: 'acento' },
]
