import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarClock, FileClock, GripVertical, MapPin } from 'lucide-react'
import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Pildora } from '@/components/glass'
import type { OrdenTrabajo } from '@/data/modulos/produccion/contrato'
import { fechaRelativa } from '@/lib/format'
import { cn, iniciales } from '@/lib/utils'
import { diasParaEntrega } from './etapas'

/** Fecha de entrega con el aviso que importa: atrasada (rojo), hoy o mañana (luz) o la fecha corta. */
export function Entrega({
  o,
  hoy,
  className,
  soloAviso,
}: {
  o: Pick<OrdenTrabajo, 'fecha_entrega' | 'atrasado'>
  hoy: string
  className?: string
  soloAviso?: boolean
}) {
  const dias = diasParaEntrega(o.fecha_entrega, hoy)
  if (dias === null) return soloAviso ? null : <span className={cn('text-xs text-fg-subtle', className)}>Sin fecha de entrega</span>
  const atrasado = o.atrasado || dias < 0
  const pronto = !atrasado && dias <= 1
  if (soloAviso && !atrasado && !pronto) return null
  const texto = atrasado
    ? Math.abs(dias) > 45
      ? `Atrasado desde ${format(parseISO(o.fecha_entrega!), 'd MMM', { locale: es })}`
      : `Atrasado ${Math.abs(dias) === 1 ? '1 día' : `${Math.abs(dias)} días`}`
    : dias === 0
      ? 'Entrega hoy'
      : dias === 1
        ? 'Entrega mañana'
        : fechaRelativa(o.fecha_entrega)
  return (
    <span
      className={cn(
        'inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap text-xs [&_svg]:shrink-0 font-semibold [&_svg]:size-3.5',
        atrasado ? 'text-danger' : pronto ? 'text-amber-700 dark:text-amber-300' : 'text-fg-muted',
        className,
      )}
    >
      <CalendarClock aria-hidden />
      <span className="truncate first-letter:uppercase" title={texto}>{texto}</span>
    </span>
  )
}

export function Avatar({ nombre, className }: { nombre: string; className?: string }) {
  return (
    <span
      title={`Responsable: ${nombre}`}
      className={cn(
        'grid size-7 shrink-0 place-items-center rounded-full bg-accent/[0.12] text-2xs font-bold text-accent dark:bg-navy-300/20 dark:text-navy-100',
        className,
      )}
    >
      <span aria-hidden>{iniciales(nombre)}</span>
      <span className="sr-only">Responsable: {nombre}</span>
    </span>
  )
}

export interface TarjetaOrdenProps extends HTMLAttributes<HTMLElement> {
  o: OrdenTrabajo
  hoy: string
  /** Botón "Mover a…" (menú) */
  menu?: ReactNode
  /** Asa de arrastre (teclado); si falta, no se muestra */
  asa?: ReactNode
  /** Copia que va pegada al puntero mientras se arrastra (sin enlaces ni menú) */
  flotante?: boolean
  /** La original mientras su copia se arrastra */
  fantasma?: boolean
}

/** Tarjeta de cristal de una orden: lo que el taller necesita de un vistazo, nunca montos. */
export const TarjetaOrden = forwardRef<HTMLElement, TarjetaOrdenProps>(function TarjetaOrden(
  { o, hoy, menu, asa, flotante, fantasma, className, ...props },
  ref,
) {
  const urgente = o.prioridad === 'urgente'
  return (
    <article
      ref={ref}
      aria-label={`${o.folio}, ${o.titulo}`}
      className={cn(
        'glass glass-strong relative rounded-tile p-3.5 pl-4 transition-opacity duration-200',
        fantasma && 'opacity-35 saturate-50',
        flotante && 'cursor-grabbing',
        className,
      )}
      {...props}
    >
      {urgente ? <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-luz shadow-[0_0_14px_2px_rgba(249,194,6,0.55)]" aria-hidden /> : null}

      <div className="flex items-start gap-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="num text-xs font-semibold text-fg-muted">{o.folio}</span>
            {urgente ? (
              <Pildora tono="luz" className="h-5 px-2 text-2xs">
                Urgente
              </Pildora>
            ) : o.prioridad === 'alta' ? (
              <Pildora tono="aviso" className="h-5 px-2 text-2xs">
                Alta
              </Pildora>
            ) : null}
          </div>
          <h3 className="mt-1 line-clamp-2 text-[0.9375rem] font-semibold text-fg [text-wrap:pretty] leading-snug">
            {flotante ? (
              o.titulo
            ) : (
              <Link
                to={`/produccion/${o.id}`}
                className="rounded-[4px] outline-none after:absolute after:inset-0 after:rounded-tile focus-visible:after:ring-2 focus-visible:after:ring-accent dark:focus-visible:after:ring-navy-200"
              >
                {o.titulo}
              </Link>
            )}
          </h3>
          <p className="mt-0.5 truncate text-sm text-fg-muted">{o.cliente}</p>
        </div>
        {menu || asa ? (
          <div className="relative z-10 -mr-1.5 -mt-1.5 flex shrink-0 items-center">
            {asa}
            {menu}
          </div>
        ) : null}
      </div>

      {o.estado === 'pausado' && o.motivo_estado ? (
        <p className="mt-2 rounded-control bg-warning-soft/70 px-2.5 py-1.5 text-xs text-fg-muted">
          <span className="font-semibold text-warning">Pausado: </span>
          {o.motivo_estado}
        </p>
      ) : null}

      <div className="mt-3 flex min-h-7 items-center gap-2">
        <Entrega o={o} hoy={hoy} className="min-w-0" />
        <div className="ml-auto flex items-center gap-1.5">
          {o.num_pendientes > 0 ? (
            <span
              title={o.num_pendientes === 1 ? '1 diseño espera aprobación del cliente' : `${o.num_pendientes} diseños esperan aprobación del cliente`}
              className="num inline-flex h-6 items-center gap-1 rounded-full bg-luz/25 px-2 text-2xs font-bold text-amber-800 dark:bg-luz/15 dark:text-amber-200 [&_svg]:size-3.5"
            >
              <FileClock aria-hidden />
              {o.num_pendientes}
              <span className="sr-only">{o.num_pendientes === 1 ? 'diseño por aprobar' : 'diseños por aprobar'}</span>
            </span>
          ) : null}
          {o.requiere_instalacion ? (
            <span
              title={o.direccion_instalacion ? `Instalación: ${o.direccion_instalacion}` : 'Lleva instalación'}
              className="grid size-6 place-items-center rounded-full bg-fg/[0.07] text-fg-muted [&_svg]:size-3.5"
            >
              <MapPin aria-hidden />
              <span className="sr-only">Lleva instalación</span>
            </span>
          ) : null}
          {o.responsable ? <Avatar nombre={o.responsable} /> : null}
        </div>
      </div>
    </article>
  )
})

/** Asa para tomar la tarjeta con el teclado (Espacio) o el mouse. */
export const AsaArrastre = forwardRef<HTMLButtonElement, HTMLAttributes<HTMLButtonElement> & { folio: string }>(function AsaArrastre(
  { folio, className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={`Arrastrar ${folio} a otra etapa`}
      className={cn(
        'hidden size-9 cursor-grab touch-none place-items-center rounded-full text-fg-subtle outline-none transition-colors hover:bg-[var(--control-bg)] hover:text-fg focus-visible:ring-2 focus-visible:ring-accent md:grid dark:focus-visible:ring-navy-200 [&_svg]:size-4',
        className,
      )}
      {...props}
    >
      <GripVertical aria-hidden />
    </button>
  )
})
