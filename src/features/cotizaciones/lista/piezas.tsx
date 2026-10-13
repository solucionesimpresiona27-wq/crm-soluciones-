import * as Tooltip from '@radix-ui/react-tooltip'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { AlarmClock, PackageCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { GlassButton, Pildora } from '@/components/glass'
import { ESTADO_COTIZACION } from '@/lib/estados'
import { fecha } from '@/lib/format'
import { cn } from '@/lib/utils'
import { DIAS_AVISO, textoVigenciaCorto, type FilaCotizacion } from './datos'

/** "13 oct" en el año en curso; con año si es de otro. */
export function fechaCorta(iso: string, hoy: string) {
  if (iso.slice(0, 4) !== hoy.slice(0, 4)) return fecha(iso)
  return format(parseISO(`${iso}T12:00:00`), 'd MMM', { locale: es })
}

/** Vigencia relativa: en ámbar (con ícono) cuando faltan DIAS_AVISO días o menos. */
export function Vigencia({ f, hoy, className }: { f: FilaCotizacion; hoy: string; className?: string }) {
  if (f.abierta) {
    const urgente = f.dias <= DIAS_AVISO
    return (
      <span className={cn('flex min-w-0 flex-col', className)}>
        <span className={cn('inline-flex items-center gap-1 whitespace-nowrap font-medium', urgente ? 'font-semibold text-warning' : 'text-fg')}>
          {urgente ? <AlarmClock className="size-3.5 shrink-0" aria-hidden /> : null}
          {textoVigenciaCorto(f.dias)}
          {urgente ? <span className="sr-only">: vence pronto</span> : null}
        </span>
        <span className="whitespace-nowrap text-xs text-fg-subtle">{fechaCorta(f.fecha_vencimiento, hoy)}</span>
      </span>
    )
  }
  if (f.visible === 'vencida') {
    return (
      <span className={cn('flex min-w-0 flex-col', className)}>
        <span className="whitespace-nowrap font-medium text-fg-muted">{textoVigenciaCorto(f.dias)}</span>
        <span className="whitespace-nowrap text-xs text-fg-subtle">{fechaCorta(f.fecha_vencimiento, hoy)}</span>
      </span>
    )
  }
  return <span className={cn('whitespace-nowrap text-fg-subtle', className)}>{fechaCorta(f.fecha_vencimiento, hoy)}</span>
}

export function EstadoFila({ f }: { f: FilaCotizacion }) {
  const e = ESTADO_COTIZACION[f.visible]
  return (
    <span className="inline-flex items-center gap-1.5">
      <Pildora tono={e.tono}>{e.etiqueta}</Pildora>
      {f.pedido_id ? (
        <span className="grid size-6 place-items-center rounded-full bg-luz/25 text-amber-700 dark:bg-luz/15 dark:text-amber-300" title="Ya es pedido">
          <PackageCheck className="size-3.5" aria-hidden />
          <span className="sr-only">Convertida en pedido</span>
        </span>
      ) : null}
    </span>
  )
}

/** Botón discreto de acción por fila, con globo de ayuda. Área táctil de 44 px. */
export function AccionFila({
  etiqueta,
  icono,
  onClick,
  cargando,
  className,
}: {
  etiqueta: string
  icono: ReactNode
  onClick: () => void
  cargando?: boolean
  className?: string
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <GlassButton
          variante="fantasma"
          tamano="icono"
          aria-label={etiqueta}
          icono={icono}
          cargando={cargando}
          className={className}
          onClick={(e) => {
            e.stopPropagation()
            onClick()
          }}
        />
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content side="top" sideOffset={6} className="glass glass-strong z-50 rounded-full px-3 py-1.5 text-xs font-semibold text-fg shadow-glass">
          {etiqueta}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}
