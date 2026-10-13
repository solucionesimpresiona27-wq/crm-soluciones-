import { LayoutGroup, motion } from 'motion/react'
import { useId, type ReactNode } from 'react'
import { resorte } from '@/lib/motion'
import { cn } from '@/lib/utils'

export interface Segmento<T extends string> {
  valor: T
  etiqueta: ReactNode
  conteo?: number
}

export interface SegmentedControlProps<T extends string> {
  segmentos: Segmento<T>[]
  valor: T
  onCambio: (valor: T) => void
  etiqueta: string
  className?: string
  tamano?: 'sm' | 'md'
}

/** Selector segmentado: el indicador de cristal se desliza entre opciones. */
export function SegmentedControl<T extends string>({
  segmentos,
  valor,
  onCambio,
  etiqueta,
  className,
  tamano = 'md',
}: SegmentedControlProps<T>) {
  const id = useId()
  return (
    <LayoutGroup id={id}>
      <div
        role="tablist"
        aria-label={etiqueta}
        className={cn(
          'glass glass-clear relative inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full p-1',
          '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          className,
        )}
      >
        {segmentos.map((s) => {
          const activo = s.valor === valor
          return (
            <button
              key={s.valor}
              type="button"
              role="tab"
              aria-selected={activo}
              onClick={() => onCambio(s.valor)}
              className={cn(
                'relative z-0 inline-flex shrink-0 items-center gap-1.5 rounded-full font-semibold outline-none transition-colors duration-200',
                tamano === 'sm' ? 'h-8 px-3 text-xs' : 'h-9 px-4 text-sm',
                activo ? 'text-fg' : 'text-fg-muted hover:text-fg',
              )}
            >
              {activo ? (
                <motion.span
                  layoutId="indicador"
                  transition={resorte.agil}
                  className="glass glass-thick absolute inset-0 -z-10 rounded-full"
                  style={{ background: 'var(--control-bg-hover)' }}
                />
              ) : null}
              {s.etiqueta}
              {s.conteo !== undefined ? (
                <span
                  className={cn(
                    'num rounded-full px-1.5 text-2xs font-bold',
                    activo ? 'bg-luz text-luz-fg' : 'bg-[var(--control-bg)] text-fg-subtle',
                  )}
                >
                  {s.conteo}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </LayoutGroup>
  )
}
