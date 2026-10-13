import { forwardRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { GlassSurface, type GlassSurfaceProps } from './GlassSurface'

/** Tarjeta de cristal para agrupar contenido. */
export const GlassCard = forwardRef<HTMLDivElement, GlassSurfaceProps>(function GlassCard(
  { className, ...props },
  ref,
) {
  return <GlassSurface ref={ref} className={cn('rounded-module p-5', className)} {...props} />
})

/** Panel para contenido con datos (tablas, formularios): cristal más opaco para máxima legibilidad. */
export const GlassPanel = forwardRef<HTMLDivElement, GlassSurfaceProps>(function GlassPanel(
  { className, variante = 'fuerte', ...props },
  ref,
) {
  return <GlassSurface ref={ref} variante={variante} className={cn('rounded-sheet', className)} {...props} />
})

export function EncabezadoPanel({
  titulo,
  descripcion,
  acciones,
  className,
}: {
  titulo: ReactNode
  descripcion?: ReactNode
  acciones?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold tracking-tight text-fg">{titulo}</h2>
        {descripcion ? <p className="mt-0.5 text-sm text-fg-muted">{descripcion}</p> : null}
      </div>
      {acciones ? <div className="flex shrink-0 items-center gap-2">{acciones}</div> : null}
    </div>
  )
}
