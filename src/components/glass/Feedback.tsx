import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Esqueleto de carga con brillo de cristal. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-control bg-fg/[0.06]', className)} aria-hidden>
      <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/[0.07]" />
    </div>
  )
}

export type TonoPildora = 'neutro' | 'acento' | 'luz' | 'exito' | 'aviso' | 'peligro'

const tonos: Record<TonoPildora, string> = {
  neutro: 'bg-fg/[0.07] text-fg-muted',
  acento: 'bg-accent/[0.14] text-accent dark:bg-navy-400/20 dark:text-navy-200',
  luz: 'bg-luz/25 text-amber-700 dark:bg-luz/15 dark:text-amber-300',
  exito: 'bg-success-soft text-success',
  aviso: 'bg-warning-soft text-warning',
  peligro: 'bg-danger-soft text-danger',
}

/** Pastilla de estado. El punto de color refuerza el estado sin depender solo del color del texto. */
export function Pildora({ tono = 'neutro', children, punto = true, className }: { tono?: TonoPildora; children: ReactNode; punto?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-semibold', tonos[tono], className)}>
      {punto ? <span className="size-1.5 rounded-full bg-current opacity-80" aria-hidden /> : null}
      {children}
    </span>
  )
}

/** Estado vacío: invita a actuar. */
export function EstadoVacio({ icono, titulo, descripcion, accion, className }: { icono?: ReactNode; titulo: string; descripcion?: string; accion?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-14 text-center', className)}>
      {icono ? (
        <div className="glass glass-thick grid size-16 place-items-center rounded-full text-fg-muted [&_svg]:size-7">{icono}</div>
      ) : null}
      <div>
        <p className="text-md font-semibold text-fg">{titulo}</p>
        {descripcion ? <p className="mx-auto mt-1 max-w-sm text-sm text-fg-muted">{descripcion}</p> : null}
      </div>
      {accion}
    </div>
  )
}
