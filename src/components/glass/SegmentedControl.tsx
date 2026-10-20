import { LayoutGroup, motion } from 'motion/react'
import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
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
  /** id del panel que muestra el contenido del segmento activo (aria-controls) */
  idPanel?: string
}

/** Selector segmentado: el indicador de cristal se desliza entre opciones. */
export function SegmentedControl<T extends string>({
  segmentos,
  valor,
  onCambio,
  etiqueta,
  className,
  tamano = 'md',
  idPanel,
}: SegmentedControlProps<T>) {
  const id = useId()
  const lista = useRef<HTMLDivElement>(null)

  // Patrón de pestañas: flechas, Inicio y Fin mueven la selección y el foco
  const alTeclear = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = segmentos.findIndex((s) => s.valor === valor)
    let j = i
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % segmentos.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + segmentos.length) % segmentos.length
    else if (e.key === 'Home') j = 0
    else if (e.key === 'End') j = segmentos.length - 1
    else return
    e.preventDefault()
    onCambio(segmentos[j].valor)
    lista.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[j]?.focus()
  }

  return (
    <LayoutGroup id={id}>
      <div
        ref={lista}
        role="tablist"
        aria-label={etiqueta}
        onKeyDown={alTeclear}
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
              aria-controls={activo ? idPanel : undefined}
              tabIndex={activo ? 0 : -1}
              onClick={() => onCambio(s.valor)}
              className={cn(
                'relative z-0 inline-flex shrink-0 items-center gap-1.5 rounded-full font-semibold outline-none transition-colors duration-200',
                tamano === 'sm' ? 'h-8 px-3 text-xs pointer-coarse:h-11' : 'h-9 px-4 text-sm pointer-coarse:h-11',
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
