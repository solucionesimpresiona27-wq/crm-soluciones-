import { CircleCheck, ListTodo } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Tarea } from '@/data/modulos/agenda/contrato'
import { useCompletarTarea, useMisPendientes } from '@/features/agenda/consultas'
import { CirculoCompletar } from '@/features/agenda/piezas'
import { Pildora } from '@/components/glass'
import type { DashboardResumen, EntregaProxima } from '@/data/tipos'
import { ESTADO_PEDIDO } from '@/lib/estados'
import { cn } from '@/lib/utils'
import type { Tamano } from './composicion'
import { Modulo, TituloModulo } from './Modulo'
import { cuandoEntrega } from './util'

const MAXIMO: Record<Tamano, number> = {
  '2x1': 2,
  '1x2': 4,
  '2x2': 5,
  '1x1': 1,
}

function FilaPendiente({ p, hoy, angosto }: { p: EntregaProxima; hoy: string; angosto: boolean }) {
  const info = ESTADO_PEDIDO[p.estado]
  const cuando = cuandoEntrega(p.fecha_entrega, hoy)
  const destacada = p.prioridad === 'urgente' || p.prioridad === 'alta'
  return (
    <li className="flex items-start gap-3">
      <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', destacada ? 'bg-luz shadow-[0_0_10px_rgba(249,194,6,0.8)]' : 'bg-fg/15')} aria-hidden />
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

/** Tarea propia de hoy (o vencida) con su círculo para completarla desde el panel. */
function FilaTarea({ t, hecha, onCompletar }: { t: Tarea; hecha: boolean; onCompletar: (v: boolean) => void }) {
  return (
    <li className="flex items-center gap-3">
      <CirculoCompletar hecha={hecha} titulo={t.titulo} onCambio={onCompletar} />
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm font-semibold text-fg', hecha && 'text-fg-subtle line-through decoration-fg/40')}>{t.titulo}</p>
        <p className="flex min-w-0 items-baseline gap-2 text-xs text-fg-muted">
          <span className={cn('shrink-0 font-medium', t.vencida && !hecha ? 'text-warning' : 'text-fg')}>{t.vencida ? 'Atrasada' : t.hora ? `Hoy ${t.hora}` : 'Hoy'}</span>
          {t.cliente ? <span className="truncate">{t.cliente}</span> : null}
        </p>
      </div>
    </li>
  )
}

/** Tareas propias de hoy y vencidas (agenda); las que se completan aquí se quedan tachadas hasta salir del panel. */
function useTareasHoy() {
  const consulta = useMisPendientes()
  const completar = useCompletarTarea()
  const [hechas, setHechas] = useState<Record<string, Tarea>>({})
  const lista = [...(consulta.data ?? []).filter((t) => !hechas[t.id]), ...Object.values(hechas)]
  const cambiar = (t: Tarea, v: boolean) => {
    setHechas((h) => {
      const n = { ...h }
      if (v) n[t.id] = t
      else delete n[t.id]
      return n
    })
    completar.mutate(
      { id: t.id, completada: v },
      {
        onError: () =>
          setHechas((h) => {
            const n = { ...h }
            delete n[t.id]
            return n
          }),
      },
    )
  }
  return { lista, hechas, cambiar }
}

/** Pedidos asignados a la persona que entró (responsable o diseñador). */
export function PendientesModulo({ r, tamano }: { r: DashboardResumen; tamano: Tamano }) {
  const lista = r.mis_pendientes
  const tareas = useTareasHoy()
  const max = MAXIMO[tamano]
  const angosto = tamano === '1x2'
  // Las tareas de hoy van primero; los pedidos llenan el resto del espacio
  const nTareas = Math.min(tareas.lista.length, lista.length ? Math.max(1, max - 1) : max)
  const nPedidos = Math.max(0, max - nTareas)
  const pendientesTareas = tareas.lista.filter((t) => !tareas.hechas[t.id]).length
  const total = lista.length + pendientesTareas
  return (
    <Modulo etiqueta="Mis pendientes" className="flex flex-col">
      <TituloModulo
        icono={<ListTodo />}
        extra={
          lista.length > nPedidos ? (
            <Link
              to="/pedidos"
              className="-my-2 inline-flex h-11 items-center rounded-full px-3 text-xs font-semibold text-accent outline-none transition-colors hover:bg-[var(--control-bg)] dark:text-navy-200"
            >
              Ver los {lista.length}
            </Link>
          ) : total ? (
            <span className="grid h-6 min-w-6 place-items-center rounded-full bg-[var(--control-bg)] px-2 text-xs font-bold text-fg">{total}</span>
          ) : null
        }
      >
        Mis pendientes
      </TituloModulo>
      {lista.length || tareas.lista.length ? (
        <>
          <ul className={cn('mt-4 flex flex-col', angosto ? 'gap-4' : 'gap-3.5', tamano === '2x1' && 'mt-3')}>
            {tareas.lista.slice(0, nTareas).map((t) => (
              <FilaTarea key={t.id} t={t} hecha={Boolean(tareas.hechas[t.id])} onCompletar={(v) => tareas.cambiar(t, v)} />
            ))}
            {lista.slice(0, nPedidos).map((p) => (
              <FilaPendiente key={p.id} p={p} hoy={r.hoy} angosto={angosto} />
            ))}
          </ul>
          {/* En módulos altos con pocos pendientes, el cierre dice que no falta nada (y no queda un hueco mudo) */}
          {tamano !== '2x1' && nTareas + Math.min(lista.length, nPedidos) < max && lista.length <= nPedidos ? (
            <p className="mt-auto flex items-center gap-2 pt-4 text-xs font-medium text-fg-muted">
              <CircleCheck className="size-4 shrink-0 text-success" aria-hidden />
              Es todo lo que tienes asignado.
            </p>
          ) : null}
        </>
      ) : (
        <div className="flex flex-1 items-center gap-3 pt-3">
          <CircleCheck className="size-6 shrink-0 text-success" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-fg">Nada asignado a ti</p>
            <p className="text-xs text-fg-muted">Tus pedidos y las tareas de hoy de la agenda aparecen aquí.</p>
          </div>
        </div>
      )}
    </Modulo>
  )
}
