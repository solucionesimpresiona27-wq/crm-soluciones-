import { ChevronRight, Clock, Wrench } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { Link } from 'react-router-dom'
import { useSesion } from '@/app/sesion'
import { Pildora } from '@/components/glass'
import type { EventoAgenda } from '@/data/modulos/agenda/contrato'
import { TIPOS_TAREA, type TipoTarea } from '@/data/modulos/agenda/contrato'
import { resorte } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { ORIGEN, atrasado, diaCorto } from './util'

/** Círculo de completar: se llena con resorte y la palomita se dibuja. Área táctil de 44 px. */
export function CirculoCompletar({ hecha, titulo, onCambio, deshabilitado }: { hecha: boolean; titulo: string; onCambio: (v: boolean) => void; deshabilitado?: boolean }) {
  const reducir = useReducedMotion()
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={hecha}
      aria-label={hecha ? `Marcar como pendiente: ${titulo}` : `Completar: ${titulo}`}
      disabled={deshabilitado}
      onClick={() => onCambio(!hecha)}
      className="group -m-2 grid size-11 shrink-0 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
    >
      <motion.span
        className={cn(
          'relative grid size-6 place-items-center rounded-full border-2 transition-colors',
          hecha ? 'border-accent bg-accent text-accent-fg' : 'border-fg/25 bg-[var(--control-bg)] group-hover:border-accent/70',
        )}
        whileTap={reducir ? undefined : { scale: 0.82 }}
        animate={reducir ? undefined : { scale: hecha ? [1, 1.18, 1] : 1 }}
        transition={resorte.presion}
      >
        <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
          <motion.path
            d="M3.5 8.5 6.5 11.5 12.5 4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={{ pathLength: hecha ? 1 : 0, opacity: hecha ? 1 : 0 }}
            transition={reducir ? { duration: 0 } : resorte.agil}
          />
        </svg>
      </motion.span>
    </button>
  )
}

function destino(e: EventoAgenda, verPedidos: boolean) {
  if (e.origen === 'entrega' || e.origen === 'instalacion') return verPedidos ? `/pedidos/${e.id}` : `/produccion/${e.id}`
  if (e.origen === 'cotizacion') return `/cotizaciones/${e.id}`
  if (e.origen === 'seguimiento') return `/embudo?op=${e.id}`
  return null
}

export interface FilaEventoProps {
  e: EventoAgenda
  hoy: string
  responsable?: string | null
  /** Muestra el día (vistas de lista con varios días o atrasados) */
  conDia?: boolean
  compacta?: boolean
  onCompletar?: (e: EventoAgenda, v: boolean) => void
  onAbrir?: (e: EventoAgenda) => void
  puedeCambiar?: (e: EventoAgenda) => boolean
}

/** Renglón de la agenda: tarea con círculo de completar, o evento ligado (entrega, seguimiento…) con enlace. */
export function FilaEvento({ e, hoy, responsable, conDia, compacta, onCompletar, onAbrir, puedeCambiar }: FilaEventoProps) {
  const { puede } = useSesion()
  const info = ORIGEN[e.origen]
  const tarde = atrasado(e, hoy)
  const esTarea = e.origen === 'tarea'
  const ruta = destino(e, puede('ver_precios'))
  const tipo = esTarea && e.tipo ? TIPOS_TAREA[e.tipo as TipoTarea] : info.etiqueta
  const meta = [e.cliente, e.folio, e.detalle && e.origen !== 'tarea' ? e.detalle : null, responsable].filter(Boolean).join(' · ')

  const cuerpo = (
    <div className="min-w-0 flex-1">
      <p
        className={cn(
          'flex items-center gap-2 font-semibold text-fg',
          compacta ? 'text-sm' : 'text-base sm:text-sm',
          e.completada && 'text-fg-subtle line-through decoration-fg/40',
        )}
      >
        <span className={compacta ? 'line-clamp-2 break-words' : 'truncate'}>{e.titulo}</span>
        {e.prioridad === 'urgente' || e.prioridad === 'alta' ? (
          <span
            className="size-2 shrink-0 rounded-full bg-luz shadow-[0_0_10px_rgba(249,194,6,0.8)]"
            title={`Prioridad ${e.prioridad}`}
            aria-label={`Prioridad ${e.prioridad}`}
            role="img"
          />
        ) : null}
      </p>
      <p className="flex min-w-0 items-center gap-1.5 text-xs text-fg-muted">
        {tarde ? (
          <span className="shrink-0 font-semibold text-warning">{compacta ? 'Atrasado' : `Atrasado · ${diaCorto(e.fecha)}`}</span>
        ) : conDia ? (
          <span className="shrink-0 font-medium text-fg">{diaCorto(e.fecha)}</span>
        ) : null}
        {e.hora ? (
          <span className="num inline-flex shrink-0 items-center gap-0.5 font-medium text-fg">
            <Clock className="size-3" aria-hidden />
            {e.hora}
          </span>
        ) : null}
        {meta ? <span className="truncate">{meta}</span> : null}
      </p>
    </div>
  )

  return (
    <li
      className={cn(
        'relative flex min-h-[3.25rem] items-center rounded-tile py-2 transition-colors',
        compacta ? 'gap-2 px-1.5' : 'gap-3 px-3',
        tarde ? 'bg-warning-soft/70' : 'hover:bg-[var(--control-bg)]',
      )}
    >
      {esTarea && onCompletar ? (
        <CirculoCompletar hecha={e.completada} titulo={e.titulo} onCambio={(v) => onCompletar(e, v)} deshabilitado={puedeCambiar ? !puedeCambiar(e) : false} />
      ) : (
        <span
          className={cn(
            'grid size-7 shrink-0 place-items-center rounded-full',
            e.completada ? 'bg-fg/5 text-fg-subtle' : 'bg-[var(--control-bg)] text-fg-muted shadow-[inset_0_1px_0_var(--inner-hi)]',
          )}
          aria-hidden
        >
          {e.origen === 'instalacion' ? <Wrench className="size-3.5" /> : <span className={cn('size-2 rounded-full', info.punto)} />}
        </span>
      )}
      {esTarea && onAbrir ? (
        <button
          type="button"
          onClick={() => onAbrir(e)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-control text-left outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label={`Editar tarea: ${e.titulo}`}
        >
          {cuerpo}
        </button>
      ) : ruta ? (
        <Link to={ruta} className="flex min-w-0 flex-1 items-center gap-2 rounded-control outline-none focus-visible:ring-2 focus-visible:ring-accent">
          {cuerpo}
          {!compacta ? <ChevronRight className="size-4 shrink-0 text-fg-subtle" aria-hidden /> : null}
        </Link>
      ) : (
        cuerpo
      )}
      {!compacta ? (
        <Pildora tono={info.tono} className="hidden shrink-0 sm:inline-flex">
          {tipo}
        </Pildora>
      ) : null}
    </li>
  )
}
