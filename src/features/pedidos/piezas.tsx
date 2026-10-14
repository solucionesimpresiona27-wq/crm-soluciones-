import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { AlarmClock, ChevronsUp, Flame } from 'lucide-react'
import { Pildora, type TonoPildora } from '@/components/glass'
import type { EstadoPago, Prioridad } from '@/data/modulos/pedidos/contrato'
import type { EstadoPedido } from '@/data/tipos'
import { ESTADO_PEDIDO } from '@/lib/estados'
import { fecha } from '@/lib/format'
import { cn, iniciales } from '@/lib/utils'
import { PRIORIDAD, textoEntrega } from './lista/datos'

export function EtapaPildora({ estado, className }: { estado: EstadoPedido; className?: string }) {
  const e = ESTADO_PEDIDO[estado]
  return (
    <Pildora tono={e.tono} className={className}>
      {e.etiqueta}
    </Pildora>
  )
}

/** Prioridad: solo alta y urgente llaman la atención; normal y baja quedan en texto discreto. */
export function PrioridadMarca({ prioridad, compacta }: { prioridad: Prioridad; compacta?: boolean }) {
  if (prioridad === 'urgente') {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-semibold text-danger">
        <Flame className="size-3.5 shrink-0" aria-hidden />
        Urgente
      </span>
    )
  }
  if (prioridad === 'alta') {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-semibold text-warning">
        <ChevronsUp className="size-3.5 shrink-0" aria-hidden />
        Alta
      </span>
    )
  }
  if (compacta) return null
  return <span className="whitespace-nowrap text-sm text-fg-subtle">{PRIORIDAD[prioridad].etiqueta}</span>
}

/** "13 oct" en el año en curso; con año si es de otro. */
export function fechaCorta(iso: string, hoy: string) {
  if (iso.slice(0, 4) !== hoy.slice(0, 4)) return fecha(iso)
  return format(parseISO(`${iso}T12:00:00`), 'd MMM', { locale: es })
}

/** Entrega relativa; en rojo con ícono si está atrasada, en ámbar si es hoy o mañana. */
export function Entrega({ fechaEntrega, dias, atrasado, cerrado, hoy, className }: { fechaEntrega: string | null; dias: number | null; atrasado: boolean; cerrado: boolean; hoy: string; className?: string }) {
  if (!fechaEntrega || dias === null) return <span className={cn('whitespace-nowrap text-sm text-fg-subtle', className)}>Sin fecha</span>
  if (cerrado) return <span className={cn('whitespace-nowrap text-sm text-fg-subtle', className)}>{fechaCorta(fechaEntrega, hoy)}</span>
  const pronto = !atrasado && dias >= 0 && dias <= 1
  return (
    <span className={cn('flex min-w-0 flex-col', className)}>
      <span className={cn('inline-flex items-center gap-1 whitespace-nowrap text-sm font-medium', atrasado ? 'font-semibold text-danger' : pronto ? 'font-semibold text-warning' : 'text-fg')}>
        {atrasado || pronto ? <AlarmClock className="size-3.5 shrink-0" aria-hidden /> : null}
        {atrasado ? `Atrasado · ${textoEntrega(dias).toLowerCase()}` : textoEntrega(dias)}
      </span>
      <span className="whitespace-nowrap text-xs text-fg-subtle">{fechaCorta(fechaEntrega, hoy)}</span>
    </span>
  )
}

export function Avatar({ nombre, className }: { nombre: string; className?: string }) {
  return (
    <span
      className={cn('grid size-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-navy-500 to-navy-700 text-2xs font-bold text-white', className)}
      title={nombre}
      aria-hidden
    >
      {iniciales(nombre)}
    </span>
  )
}

export const ESTADO_PAGO: Record<EstadoPago, { etiqueta: string; tono: TonoPildora }> = {
  pendiente: { etiqueta: 'Sin anticipo', tono: 'aviso' },
  anticipo: { etiqueta: 'Con anticipo', tono: 'acento' },
  parcial: { etiqueta: 'Pago parcial', tono: 'acento' },
  liquidado: { etiqueta: 'Liquidado', tono: 'exito' },
  reembolsado: { etiqueta: 'Reembolsado', tono: 'neutro' },
}

export function PagoPildora({ estado }: { estado: EstadoPago }) {
  const e = ESTADO_PAGO[estado]
  return <Pildora tono={e.tono}>{e.etiqueta}</Pildora>
}
