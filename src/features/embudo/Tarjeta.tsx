import * as Menu from '@radix-ui/react-dropdown-menu'
import { ArrowRightLeft, CalendarClock, Check, MoreHorizontal } from 'lucide-react'
import { forwardRef, type HTMLAttributes } from 'react'
import { ETAPAS_EMBUDO, type EtapaComercial, type Oportunidad } from '@/data/modulos/embudo/contrato'
import { dinero, fechaRelativa } from '@/lib/format'
import { cn } from '@/lib/utils'
import { diasDesde, estadoAccion, iniciales } from './util'

/** Menú "Mover a…" (alternativa accesible y táctil al arrastre). */
export function MenuMover({ oportunidad, onMover, className, conTexto }: { oportunidad: Oportunidad; onMover: (e: EtapaComercial) => void; className?: string; conTexto?: boolean }) {
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger
        aria-label={`Mover “${oportunidad.titulo}” a otra etapa`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'inline-flex shrink-0 items-center justify-center gap-2 rounded-full text-fg-muted outline-none transition-colors hover:bg-[var(--control-bg-hover)] hover:text-fg data-[state=open]:bg-[var(--control-bg-hover)] [&_svg]:size-[1.05rem]',
          conTexto ? 'glass glass-interactive h-11 px-4 text-sm font-semibold text-fg' : 'size-11',
          className,
        )}
      >
        {conTexto ? <ArrowRightLeft aria-hidden /> : <MoreHorizontal aria-hidden />}
        {conTexto ? 'Mover a…' : null}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align="end"
          sideOffset={6}
          collisionPadding={12}
          onClick={(e) => e.stopPropagation()}
          className="glass glass-strong z-[60] w-60 rounded-module p-2 shadow-glass-lg outline-none"
        >
          <Menu.Label className="px-3 pb-1 pt-1.5 text-xs font-medium text-fg-subtle">Mover a…</Menu.Label>
          {ETAPAS_EMBUDO.map((e) => {
            const actual = e.etapa === oportunidad.etapa
            return (
              <Menu.Item
                key={e.etapa}
                disabled={actual}
                onSelect={() => onMover(e.etapa)}
                className={cn(
                  'flex h-11 cursor-pointer items-center gap-3 rounded-full px-3 text-sm font-medium text-fg outline-none transition-colors data-[disabled]:cursor-default data-[disabled]:text-fg-subtle data-[highlighted]:bg-[var(--control-bg-hover)]',
                  e.etapa === 'perdido' && !actual && 'text-danger',
                )}
              >
                <span className={cn('size-2 rounded-full', e.etapa === 'ganado' ? 'bg-success' : e.etapa === 'perdido' ? 'bg-danger' : 'bg-accent/60 dark:bg-navy-300')} aria-hidden />
                <span className="flex-1">{e.etiqueta}</span>
                {actual ? <Check className="size-4" aria-label="Etapa actual" /> : null}
              </Menu.Item>
            )
          })}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )
}

interface PropsTarjeta extends HTMLAttributes<HTMLDivElement> {
  oportunidad: Oportunidad
  hoy: string
  conPrecios: boolean
  onAbrir?: () => void
  onMover?: (e: EtapaComercial) => void
  levantada?: boolean
  fantasma?: boolean
}

/** Tarjeta de cristal de una oportunidad en el tablero. */
export const TarjetaOportunidad = forwardRef<HTMLDivElement, PropsTarjeta>(function TarjetaOportunidad(
  { oportunidad: o, hoy, conPrecios, onAbrir, onMover, levantada, fantasma, className, ...props },
  ref,
) {
  const estado = o.etapa === 'ganado' || o.etapa === 'perdido' ? null : estadoAccion(o.proxima_accion_fecha, hoy)
  const dias = diasDesde(o.updated_at, hoy)
  return (
    <div
      ref={ref}
      {...props}
      className={cn(
        'glass glass-strong group relative flex flex-col gap-2 rounded-tile p-3.5 pr-2 text-left outline-none',
        'focus-visible:ring-2 focus-visible:ring-accent/60',
        levantada && 'rotate-[1.5deg] shadow-glass-lg',
        fantasma && 'opacity-40',
        className,
      )}
    >
      <div className="flex items-start gap-1">
        <button
          type="button"
          onClick={onAbrir}
          className="min-w-0 flex-1 rounded-control text-left outline-none after:absolute after:inset-0 after:rounded-tile focus-visible:after:ring-2 focus-visible:after:ring-accent/60"
          aria-label={`Abrir ${o.titulo} de ${o.cliente.nombre}`}
        >
          <span className="block truncate text-xs font-medium text-fg-muted">{o.cliente.nombre}</span>
          <span className="mt-0.5 line-clamp-2 block font-semibold leading-snug text-fg">{o.titulo}</span>
        </button>
        {onMover ? <MenuMover oportunidad={o} onMover={onMover} className="relative z-10 -mr-0.5 -mt-1.5" /> : null}
      </div>

      {conPrecios && o.valor_estimado != null ? (
        <span className="num text-lg font-semibold leading-tight tracking-tight text-fg">{dinero(o.valor_estimado).replace(/\.00$/, '')}</span>
      ) : null}

      {o.etapa === 'perdido' && o.motivo_perdida ? (
        <p className="line-clamp-2 text-xs text-fg-muted">
          <span className="font-semibold text-danger">Motivo:</span> {o.motivo_perdida}
        </p>
      ) : estado ? (
        <p
          className={cn(
            'flex items-start gap-1.5 rounded-control px-2 py-1.5 text-xs',
            estado === 'atrasada' && 'bg-warning-soft text-warning',
            estado === 'hoy' && 'bg-luz/25 font-medium text-amber-800 dark:bg-luz/15 dark:text-amber-200',
            estado === 'proxima' && 'bg-fg/[0.05] text-fg-muted',
          )}
        >
          <CalendarClock className="mt-px size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0">
            <span className="font-semibold">{estado === 'atrasada' ? 'Atrasada · ' : estado === 'hoy' ? 'Hoy · ' : `${fechaRelativa(o.proxima_accion_fecha)} · `}</span>
            {o.proxima_accion ?? 'Dar seguimiento'}
          </span>
        </p>
      ) : o.etapa !== 'ganado' ? (
        <p className="text-xs text-fg-subtle">Sin próxima acción</p>
      ) : null}

      <div className="flex items-center gap-2 pr-1.5 text-xs text-fg-subtle">
        <span className="grid size-6 place-items-center rounded-full bg-accent/[0.12] text-[0.625rem] font-bold text-accent dark:bg-navy-400/25 dark:text-navy-100" title={o.responsable ?? 'Sin responsable'} aria-hidden>
          {o.responsable ? iniciales(o.responsable) : '–'}
        </span>
        <span className="min-w-0 flex-1 truncate">{o.responsable ?? 'Sin responsable'}</span>
        <span className="num shrink-0" title="Días desde el último movimiento">
          {dias === 0 ? 'hoy' : `${dias} d`}
        </span>
      </div>
    </div>
  )
})
