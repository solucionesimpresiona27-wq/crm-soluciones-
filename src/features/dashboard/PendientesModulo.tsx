import { CircleCheck, ListTodo } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Pildora } from '@/components/glass'
import type { DashboardResumen, EntregaProxima } from '@/data/tipos'
import { ESTADO_PEDIDO } from '@/lib/estados'
import { cn } from '@/lib/utils'
import type { Tamano } from './composicion'
import { Modulo, TituloModulo } from './Modulo'
import { cuandoEntrega } from './util'

const MAXIMO: Record<Tamano, number> = { '2x1': 2, '1x2': 4, '2x2': 5, '1x1': 1 }

function FilaPendiente({ p, hoy, angosto }: { p: EntregaProxima; hoy: string; angosto: boolean }) {
  const info = ESTADO_PEDIDO[p.estado]
  const cuando = cuandoEntrega(p.fecha_entrega, hoy)
  const destacada = p.prioridad === 'urgente' || p.prioridad === 'alta'
  return (
    <li className="flex items-start gap-3">
      <span
        className={cn(
          'mt-1.5 size-2 shrink-0 rounded-full',
          destacada ? 'bg-luz shadow-[0_0_10px_rgba(249,194,6,0.8)]' : 'bg-fg/15',
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-fg">{p.titulo}</p>
        <p className="flex min-w-0 items-baseline gap-2 text-xs text-fg-muted">
          <span className={cn('shrink-0 font-medium', cuando.atrasado ? 'text-danger' : 'text-fg')}>{cuando.texto}</span>
          <span className="num shrink-0 text-fg-subtle">{p.folio}</span>
          <span className="truncate">{p.cliente}</span>
        </p>
        {destacada ? <span className="sr-only">Prioridad {p.prioridad}</span> : null}
        {angosto ? (
          <Pildora tono={info.tono} className="mt-1.5">
            {info.corto}
          </Pildora>
        ) : null}
      </div>
      {!angosto ? (
        <Pildora tono={info.tono} className="shrink-0">
          {info.corto}
        </Pildora>
      ) : null}
    </li>
  )
}

/** Pedidos asignados a la persona que entró (responsable o diseñador). */
export function PendientesModulo({ r, tamano }: { r: DashboardResumen; tamano: Tamano }) {
  const lista = r.mis_pendientes
  const max = MAXIMO[tamano]
  const angosto = tamano === '1x2'
  return (
    <Modulo etiqueta="Mis pendientes" className="flex flex-col">
      <TituloModulo
        icono={<ListTodo />}
        extra={
          lista.length > max ? (
            <Link
              to="/pedidos"
              className="-my-2 inline-flex h-11 items-center rounded-full px-3 text-xs font-semibold text-accent outline-none transition-colors hover:bg-[var(--control-bg)] dark:text-navy-200"
            >
              Ver los {lista.length}
            </Link>
          ) : lista.length ? (
            <span className="grid h-6 min-w-6 place-items-center rounded-full bg-[var(--control-bg)] px-2 text-xs font-bold text-fg">{lista.length}</span>
          ) : null
        }
      >
        Mis pendientes
      </TituloModulo>
      {lista.length ? (
        <ul className={cn('mt-4 flex flex-col', angosto ? 'gap-4' : 'gap-3.5', tamano === '2x1' && 'mt-3')}>
          {lista.slice(0, max).map((p) => (
            <FilaPendiente key={p.id} p={p} hoy={r.hoy} angosto={angosto} />
          ))}
        </ul>
      ) : (
        <div className="flex flex-1 items-center gap-3 pt-3">
          <CircleCheck className="size-6 shrink-0 text-success" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-fg">Nada asignado a ti</p>
            <p className="text-xs text-fg-muted">Cuando te asignen un pedido aparecerá aquí.</p>
          </div>
        </div>
      )}
    </Modulo>
  )
}
