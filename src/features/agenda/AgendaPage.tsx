import { CalendarCheck2, ChevronLeft, ChevronRight, CloudOff, RotateCcw } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useEquipo } from '@/app/consultas'
import { useSesion } from '@/app/sesion'
import { AnimatedNumber, EstadoVacio, GlassButton, GlassIconButton, GlassModal, GlassPanel, GlassSelect, SegmentedControl, Skeleton } from '@/components/glass'
import type { EventoAgenda } from '@/data/modulos/agenda/contrato'
import { hoyISO, sumarDias } from '@/lib/format'
import { resorte } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { CapturaRapida } from './CapturaRapida'
import { frase, useCalendario, useCompletarTarea } from './consultas'
import { FilaEvento } from './piezas'
import { TareaModal, type BorradorTarea } from './TareaModal'
import { ORIGEN, aFecha, atrasado, claveEvento, diaCorto, diaLargo, mesLargo, ordenar, rangoMes, rangoSemana } from './util'

type Vista = 'hoy' | 'semana' | 'mes'
type Filtro = 'mias' | 'todas' | 'persona'

/** Agenda (/agenda): "Mis pendientes de hoy", semana y mes con tareas, entregas, seguimientos y cotizaciones por vencer. */
export default function AgendaPage() {
  const { sesion, puede } = useSesion()
  const equipo = useEquipo()
  const reducir = useReducedMotion()
  const hoy = useMemo(() => hoyISO(), [])
  const [params, setParams] = useSearchParams()
  const vista = (['hoy', 'semana', 'mes'].includes(params.get('vista') ?? '') ? params.get('vista') : 'hoy') as Vista
  const [filtro, setFiltro] = useState<Filtro>('mias')
  const [persona, setPersona] = useState<string>('')
  const [borrador, setBorrador] = useState<BorradorTarea | null>(null)
  const completar = useCompletarTarea()
  const yo = sesion?.perfil.id ?? ''
  const taller = !puede('gestionar_clientes')

  const nombres = useMemo(() => new Map((equipo.data ?? []).map((m) => [m.id, m.nombre])), [equipo.data])

  const pasa = (e: EventoAgenda) => {
    if (filtro === 'todas') return true
    const quien = filtro === 'mias' ? yo : persona
    if (!quien) return true
    if (e.origen === 'tarea') return e.responsable_id === quien
    // El taller ve todas las entregas e instalaciones: son trabajo de todos
    if (filtro === 'mias' && taller && (e.origen === 'entrega' || e.origen === 'instalacion')) return true
    return e.responsable_id === quien || (filtro === 'mias' && !e.responsable_id)
  }

  const abrir = (e: EventoAgenda) =>
    setBorrador({
      id: e.id,
      titulo: e.titulo,
      descripcion: e.detalle,
      tipo: (e.tipo as BorradorTarea['tipo']) ?? 'tarea',
      fecha: e.fecha,
      hora: e.hora,
      responsable_id: e.responsable_id,
      prioridad: e.prioridad ?? 'normal',
      cliente: e.cliente_id && e.cliente ? { id: e.cliente_id, nombre: e.cliente } : null,
      pedido: e.pedido_id ? { id: e.pedido_id, nombre: e.folio ?? 'Pedido ligado' } : null,
    })

  // La base decide (RLS): si no puede, el aviso de error lo explica
  const puedeCambiar = () => true
  const fila = {
    hoy,
    onCompletar: (e: EventoAgenda, v: boolean) => completar.mutate({ id: e.id, completada: v }),
    onAbrir: abrir,
    puedeCambiar,
    nombre: (id: string | null) => (filtro !== 'mias' && id ? (id === yo ? 'Yo' : nombres.get(id)?.split(' ')[0]) : null) ?? null,
  }

  const cambiarVista = (v: Vista) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        if (v === 'hoy') n.delete('vista')
        else n.set('vista', v)
        return n
      },
      { replace: true },
    )

  return (
    <div className="flex flex-col gap-4 pt-1">
      <CapturaRapida hoy={hoy} onDetalles={setBorrador} />

      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl<Vista>
          etiqueta="Vista de la agenda"
          valor={vista}
          onCambio={cambiarVista}
          segmentos={[
            { valor: 'hoy', etiqueta: 'Hoy' },
            { valor: 'semana', etiqueta: 'Semana' },
            { valor: 'mes', etiqueta: 'Mes' },
          ]}
          className="max-sm:w-full"
        />
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <SegmentedControl<Filtro>
            etiqueta="De quién"
            valor={filtro}
            onCambio={(f) => {
              setFiltro(f)
              if (f === 'persona' && !persona) setPersona(yo)
            }}
            segmentos={[
              { valor: 'mias', etiqueta: 'Mías' },
              { valor: 'todas', etiqueta: 'Todas' },
              { valor: 'persona', etiqueta: 'Por responsable' },
            ]}
          />
          {filtro === 'persona' ? (
            <GlassSelect value={persona} onChange={(e) => setPersona(e.target.value)} aria-label="Responsable" className="h-11 w-auto rounded-full py-0 text-sm">
              {(equipo.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </GlassSelect>
          ) : null}
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={vista}
          initial={reducir ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducir ? undefined : { opacity: 0, y: -6 }}
          transition={resorte.agil}
        >
          {vista === 'hoy' ? <VistaHoy pasa={pasa} fila={fila} /> : vista === 'semana' ? <VistaSemana pasa={pasa} fila={fila} /> : <VistaMes pasa={pasa} fila={fila} />}
        </motion.div>
      </AnimatePresence>

      <TareaModal borrador={borrador} onCerrar={() => setBorrador(null)} hoy={hoy} />
    </div>
  )
}

interface PropsFila {
  hoy: string
  onCompletar: (e: EventoAgenda, v: boolean) => void
  onAbrir: (e: EventoAgenda) => void
  puedeCambiar: (e: EventoAgenda) => boolean
  nombre: (id: string | null) => string | null
}
interface PropsVista {
  pasa: (e: EventoAgenda) => boolean
  fila: PropsFila
}

function Lista({ eventos, fila, conDia, compacta }: { eventos: EventoAgenda[]; fila: PropsFila; conDia?: boolean; compacta?: boolean }) {
  return (
    <ul className="flex flex-col gap-0.5">
      <AnimatePresence initial={false}>
        {eventos.map((e) => (
          <motion.div key={claveEvento(e)} layout="position" transition={resorte.agil}>
            <FilaEvento
              e={e}
              hoy={fila.hoy}
              conDia={conDia}
              compacta={compacta}
              responsable={fila.nombre(e.responsable_id)}
              onCompletar={fila.onCompletar}
              onAbrir={fila.onAbrir}
              puedeCambiar={fila.puedeCambiar}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </ul>
  )
}

function ErrorAgenda({ mensaje, reintentar }: { mensaje: string; reintentar: () => void }) {
  return (
    <GlassPanel>
      <EstadoVacio
        icono={<CloudOff />}
        titulo="No se pudo cargar la agenda"
        descripcion={`${frase(mensaje)} Revisa tu conexión e inténtalo de nuevo.`}
        accion={
          <GlassButton icono={<RotateCcw />} onClick={reintentar}>
            Reintentar
          </GlassButton>
        }
      />
    </GlassPanel>
  )
}

function Esqueleto() {
  return (
    <GlassPanel className="flex flex-col gap-3 p-5 sm:p-7">
      <Skeleton className="h-10 w-64" />
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-tile" />
      ))}
    </GlassPanel>
  )
}

/* ---------------------------------- Hoy ---------------------------------- */

function VistaHoy({ pasa, fila }: PropsVista) {
  const { hoy } = fila
  const c = useCalendario(sumarDias(hoy, -30), hoy)
  if (c.isPending) return <Esqueleto />
  if (c.isError) return <ErrorAgenda mensaje={c.error.message} reintentar={() => void c.refetch()} />
  const visibles = c.data.filter(pasa)
  const tarde = ordenar(visibles.filter((e) => atrasado(e, hoy)))
  const deHoy = ordenar(visibles.filter((e) => e.fecha === hoy))
  const pendientes = tarde.length + deHoy.filter((e) => !e.completada).length
  const hechas = deHoy.filter((e) => e.completada).length

  return (
    <GlassPanel className="p-4 sm:p-7" aria-label="Mis pendientes de hoy">
      <div className="flex flex-wrap items-end justify-between gap-4 px-1 sm:px-2">
        <div>
          <p className="text-sm font-medium text-fg-muted">{diaLargo(hoy)}</p>
          <h2 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl sm:leading-tight">Mis pendientes de hoy</h2>
        </div>
        <div className="flex items-baseline gap-2" aria-live="polite">
          <AnimatedNumber valor={pendientes} className={cn('num text-display font-semibold leading-none', pendientes ? 'text-fg' : 'text-success')} />
          <span className="text-sm text-fg-muted">
            {pendientes === 1 ? 'pendiente' : 'pendientes'}
            {hechas ? ` · ${hechas} ${hechas === 1 ? 'hecho' : 'hechos'}` : ''}
          </span>
        </div>
      </div>

      {tarde.length ? (
        <section className="mt-6" aria-labelledby="titulo-atrasados">
          <h3 id="titulo-atrasados" className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wide text-warning">
            Atrasados · {tarde.length}
          </h3>
          <Lista eventos={tarde} fila={fila} />
        </section>
      ) : null}

      <section className="mt-6" aria-labelledby="titulo-hoy">
        <h3 id="titulo-hoy" className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
          Hoy · {deHoy.length}
        </h3>
        {deHoy.length ? (
          <Lista eventos={deHoy} fila={fila} />
        ) : (
          <EstadoVacio
            className="py-8"
            icono={<CalendarCheck2 />}
            titulo="Nada para hoy"
            descripcion="Escribe arriba lo que tengas que hacer; las entregas y seguimientos del día aparecerán aquí solos."
          />
        )}
      </section>
    </GlassPanel>
  )
}

/* -------------------------------- Navegador ------------------------------- */

function Navegador({
  titulo,
  onAnterior,
  onSiguiente,
  onHoy,
  esHoy,
  etiqueta,
}: {
  titulo: string
  onAnterior: () => void
  onSiguiente: () => void
  onHoy: () => void
  esHoy: boolean
  etiqueta: string
}) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <h2 className="mr-auto text-xl font-semibold tracking-tight text-fg sm:text-2xl">{titulo}</h2>
      {!esHoy ? (
        <GlassButton variante="cristal" tamano="sm" onClick={onHoy}>
          Ir a hoy
        </GlassButton>
      ) : null}
      <GlassIconButton etiqueta={`${etiqueta} anterior`} icono={<ChevronLeft />} tamano="sm" onClick={onAnterior} />
      <GlassIconButton etiqueta={`${etiqueta} siguiente`} icono={<ChevronRight />} tamano="sm" onClick={onSiguiente} />
    </div>
  )
}

/* --------------------------------- Semana --------------------------------- */

function VistaSemana({ pasa, fila }: PropsVista) {
  const { hoy } = fila
  const [ancla, setAncla] = useState(hoy)
  const r = rangoSemana(ancla)
  const c = useCalendario(r.desde, r.hasta)
  const titulo = `${diaCorto(r.desde)} – ${diaCorto(r.hasta)}`
  const nav = (
    <Navegador
      titulo={`Semana ${titulo}`}
      etiqueta="Semana"
      esHoy={r.dias.includes(hoy)}
      onHoy={() => setAncla(hoy)}
      onAnterior={() => setAncla(sumarDias(ancla, -7))}
      onSiguiente={() => setAncla(sumarDias(ancla, 7))}
    />
  )
  if (c.isError) return <ErrorAgenda mensaje={c.error.message} reintentar={() => void c.refetch()} />
  const eventos = (c.data ?? []).filter(pasa)

  return (
    <GlassPanel className="p-4 sm:p-6">
      {nav}
      {c.isPending ? (
        <Skeleton className="h-80 w-full rounded-tile" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7 xl:gap-2">
          {r.dias.map((d) => {
            const delDia = ordenar(eventos.filter((e) => e.fecha === d))
            const esHoy = d === hoy
            return (
              <section
                key={d}
                aria-label={diaLargo(d)}
                className={cn('flex min-w-0 flex-col rounded-tile p-2 xl:min-h-[22rem]', esHoy ? 'bg-luz-soft/60 ring-1 ring-luz/50' : 'bg-[var(--control-bg)]')}
              >
                <h3 className="flex items-baseline gap-1.5 px-1 pb-2">
                  <span className={cn('text-xs font-semibold uppercase tracking-wide', esHoy ? 'text-fg' : 'text-fg-muted')}>{esHoy ? 'Hoy' : diaCorto(d).split(' ')[0]}</span>
                  <span className={cn('num text-lg font-semibold', d < hoy ? 'text-fg-subtle' : 'text-fg')}>{aFecha(d).getDate()}</span>
                  {delDia.length ? <span className="ml-auto text-xs text-fg-subtle">{delDia.length}</span> : null}
                </h3>
                {delDia.length ? <Lista eventos={delDia} fila={fila} compacta /> : <p className="px-1 text-xs text-fg-subtle xl:hidden">Sin pendientes</p>}
              </section>
            )
          })}
        </div>
      )}
    </GlassPanel>
  )
}

/* ---------------------------------- Mes ---------------------------------- */

const SEMANA = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']

function VistaMes({ pasa, fila }: PropsVista) {
  const { hoy } = fila
  const [ancla, setAncla] = useState(hoy)
  const [dia, setDia] = useState<string | null>(null)
  const r = rangoMes(ancla)
  const c = useCalendario(r.desde, r.hasta)
  const cambiarMes = (n: number) => {
    const d = aFecha(ancla)
    const m = new Date(d.getFullYear(), d.getMonth() + n, 15)
    setAncla(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-15`)
  }
  if (c.isError) return <ErrorAgenda mensaje={c.error.message} reintentar={() => void c.refetch()} />
  const eventos = (c.data ?? []).filter(pasa)
  const porDia = new Map<string, EventoAgenda[]>()
  for (const e of eventos) porDia.set(e.fecha, [...(porDia.get(e.fecha) ?? []), e])
  const delDia = dia ? ordenar(porDia.get(dia) ?? []) : []

  return (
    <GlassPanel className="p-3 sm:p-6">
      <Navegador
        titulo={mesLargo(ancla)}
        etiqueta="Mes"
        esHoy={r.mes === hoy.slice(0, 7)}
        onHoy={() => setAncla(hoy)}
        onAnterior={() => cambiarMes(-1)}
        onSiguiente={() => cambiarMes(1)}
      />
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5" role="grid" aria-label={`Calendario de ${mesLargo(ancla)}`}>
        {SEMANA.map((s) => (
          <div key={s} className="pb-1 text-center text-2xs font-semibold uppercase tracking-wide text-fg-subtle" role="columnheader">
            {s}
          </div>
        ))}
        {r.dias.map((d) => {
          const lista = porDia.get(d) ?? []
          const pend = lista.filter((e) => !e.completada)
          const fuera = d.slice(0, 7) !== r.mes
          const esHoy = d === hoy
          const tipos = [...new Set(pend.map((e) => e.origen))]
          return (
            <button
              key={d}
              type="button"
              role="gridcell"
              onClick={() => setDia(d)}
              aria-label={`${diaLargo(d)}: ${pend.length ? `${pend.length} pendientes` : 'sin pendientes'}`}
              className={cn(
                'flex min-h-14 flex-col items-center gap-1 rounded-control p-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent sm:min-h-24 sm:items-start sm:p-2',
                fuera ? 'opacity-45' : 'bg-[var(--control-bg)] hover:bg-fg/10',
              )}
            >
              <span
                className={cn(
                  'num grid size-7 place-items-center rounded-full text-sm font-semibold',
                  esHoy ? 'bg-luz text-luz-fg shadow-[0_4px_14px_-6px_rgba(249,194,6,0.9)]' : 'text-fg',
                )}
              >
                {aFecha(d).getDate()}
              </span>
              {pend.length ? (
                <>
                  <span className="flex flex-wrap justify-center gap-0.5 sm:hidden" aria-hidden>
                    {tipos.slice(0, 4).map((t) => (
                      <span key={t} className={cn('size-1.5 rounded-full', ORIGEN[t].punto)} />
                    ))}
                  </span>
                  <span className="hidden w-full flex-col gap-0.5 sm:flex" aria-hidden>
                    {pend.slice(0, 2).map((e) => (
                      <span key={claveEvento(e)} className="flex min-w-0 items-center gap-1 text-left text-2xs text-fg-muted">
                        <span className={cn('size-1.5 shrink-0 rounded-full', ORIGEN[e.origen].punto)} />
                        <span className="truncate">{e.titulo}</span>
                      </span>
                    ))}
                    {pend.length > 2 ? <span className="text-2xs font-medium text-fg-subtle">+{pend.length - 2} más</span> : null}
                  </span>
                </>
              ) : null}
            </button>
          )
        })}
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-fg-muted" aria-label="Colores por tipo">
        {Object.entries(ORIGEN).map(([k, o]) => (
          <li key={k} className="flex items-center gap-1.5">
            <span className={cn('size-2 rounded-full', o.punto)} aria-hidden />
            {o.etiqueta}
          </li>
        ))}
      </ul>

      <GlassModal
        abierto={Boolean(dia)}
        onCambio={(v) => !v && setDia(null)}
        titulo={dia ? diaLargo(dia) : ''}
        descripcion={delDia.length ? `${delDia.length} en la agenda` : undefined}
      >
        {delDia.length ? (
          <Lista eventos={delDia} fila={{ ...fila, onAbrir: (e) => (setDia(null), fila.onAbrir(e)) }} />
        ) : (
          <EstadoVacio className="py-6" icono={<CalendarCheck2 />} titulo="Día libre" descripcion="No hay tareas, entregas ni seguimientos este día." />
        )}
      </GlassModal>
    </GlassPanel>
  )
}
