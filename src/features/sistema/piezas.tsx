import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Cédula de la vitrina: nombre y propósito de cada sección. Va sobre cristal fuerte
 * para leerse con cualquier fondo, incluso con las rayas de alto contraste.
 */
function Cedula({ id, icono, titulo, children }: { id: string; icono: ReactNode; titulo: string; children: ReactNode }) {
  return (
    <div className="glass glass-strong flex max-w-2xl items-start gap-3 self-start rounded-module p-2 pr-5">
      <span
        className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--control-bg)] text-fg-muted shadow-[inset_0_1px_0_var(--inner-hi)] [&_svg]:size-[1.1rem]"
        aria-hidden
      >
        {icono}
      </span>
      <div className="min-w-0 py-0.5">
        <h3 id={id} className="text-md font-semibold tracking-tight text-fg">
          {titulo}
        </h3>
        <p className="text-sm text-fg-muted">{children}</p>
      </div>
    </div>
  )
}

export function Seccion({
  id,
  icono,
  titulo,
  descripcion,
  children,
  className,
}: {
  id: string
  icono: ReactNode
  titulo: string
  descripcion: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section aria-labelledby={`${id}-titulo`} className={cn('flex min-w-0 flex-col gap-4', className)}>
      <Cedula id={`${id}-titulo`} icono={icono} titulo={titulo}>
        {descripcion}
      </Cedula>
      {children}
    </section>
  )
}

/** Subtítulo dentro de un módulo de la vitrina. */
export function Subtitulo({ children, detalle, className }: { children: ReactNode; detalle?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5', className)}>
      <h4 className="text-sm font-semibold text-fg">{children}</h4>
      {detalle ? <p className="text-xs text-fg-muted">{detalle}</p> : null}
    </div>
  )
}

/** Muestra con pie: el control arriba y, debajo, su nombre y un dato. */
export function Muestra({ titulo, detalle, children, className }: { titulo: ReactNode; detalle?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <figure className={cn('flex min-w-0 flex-col items-center gap-2.5', className)}>
      {children}
      <figcaption className="text-center">
        <span className="block text-xs font-semibold leading-tight text-fg">{titulo}</span>
        {detalle ? <span className="block text-xs leading-tight text-fg-muted">{detalle}</span> : null}
      </figcaption>
    </figure>
  )
}
