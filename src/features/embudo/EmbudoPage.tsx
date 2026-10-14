import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { ChevronDown, Filter, Plus, RotateCcw, Search, Target, Trophy, XCircle } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useEquipo } from '@/app/consultas'
import { useSesion } from '@/app/sesion'
import { AnimatedNumber, EstadoVacio, GlassButton, GlassInput, GlassPanel, GlassSelect, SegmentedControl, Skeleton } from '@/components/glass'
import { ETAPAS_EMBUDO, type EtapaComercial, type Oportunidad } from '@/data/modulos/embudo/contrato'
import { useEsMovil } from '@/hooks/useMediaQuery'
import { dinero, hoyISO } from '@/lib/format'
import { normalizar, cn } from '@/lib/utils'
import { resorte } from '@/lib/motion'
import { useMoverEtapa, useOportunidades } from './consultas'
import { DetalleOportunidad } from './DetalleOportunidad'
import { MotivoPerdidaModal } from './MotivoPerdidaModal'
import { OportunidadModal } from './OportunidadModal'
import { TarjetaOportunidad } from './Tarjeta'
import { etiquetaEtapa, metricas, porEtapa } from './util'

const CORTO: Record<EtapaComercial, string> = {
  prospecto_nuevo: 'Prospecto',
  contactado: 'Contactado',
  interesado: 'Interesado',
  cotizacion_enviada: 'Cotizada',
  en_seguimiento: 'Seguimiento',
  ganado: 'Ganado',
  perdido: 'Perdido',
}

function inicioMes() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
}

/** Cápsula de métrica del encabezado. */
function Metrica({ etiqueta, children, luz, onClick, activo }: { etiqueta: string; children: React.ReactNode; luz?: boolean; onClick?: () => void; activo?: boolean }) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-pressed={onClick ? activo : undefined}
      className={cn(
        'glass flex min-h-11 shrink-0 items-center gap-2.5 rounded-full py-1.5 pl-4 pr-4 text-left outline-none',
        luz ? 'glass-on-luz' : 'glass-clear',
        onClick && 'glass-interactive',
        activo && 'ring-2 ring-accent/50',
      )}
    >
      <span className={cn('text-xs leading-tight', luz ? 'text-current opacity-80' : 'text-fg-subtle')}>{etiqueta}</span>
      <span className={cn('num text-lg font-semibold tracking-tight leading-tight', luz ? 'text-current' : 'text-fg')}>{children}</span>
    </Comp>
  )
}

function TarjetaArrastrable(props: { o: Oportunidad; hoy: string; conPrecios: boolean; onAbrir: () => void; onMover: (e: EtapaComercial) => void; arrastrable: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: props.o.id, data: { etapa: props.o.etapa }, disabled: !props.arrastrable })
  // El menú "Mover a…" es la alternativa con teclado; la tarjeta no necesita ser un botón extra
  const { role: _r, tabIndex: _t, ...atributos } = attributes
  return (
    <TarjetaOportunidad
      ref={setNodeRef}
      {...atributos}
      {...listeners}
      oportunidad={props.o}
      hoy={props.hoy}
      conPrecios={props.conPrecios}
      onAbrir={props.onAbrir}
      onMover={props.onMover}
      fantasma={isDragging}
      className={props.arrastrable ? 'cursor-grab touch-manipulation active:cursor-grabbing' : undefined}
    />
  )
}

function Columna({
  etapa,
  ops,
  hoy,
  conPrecios,
  arrastrando,
  onAbrir,
  onMover,
  arrastrable,
  className,
}: {
  etapa: (typeof ETAPAS_EMBUDO)[number]
  ops: Oportunidad[]
  hoy: string
  conPrecios: boolean
  arrastrando: boolean
  onAbrir: (o: Oportunidad) => void
  onMover: (o: Oportunidad, e: EtapaComercial) => void
  arrastrable: boolean
  className?: string
}) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa.etapa })
  const valor = ops.reduce((s, o) => s + (o.valor_estimado ?? 0), 0)
  const Icono = etapa.etapa === 'ganado' ? Trophy : etapa.etapa === 'perdido' ? XCircle : null
  return (
    <section
      ref={setNodeRef}
      aria-label={`${etapa.etiqueta}: ${ops.length} oportunidades`}
      data-etapa={etapa.etapa}
      className={cn(
        'glass glass-clear flex min-h-[12rem] flex-col rounded-module p-2 transition-[box-shadow] duration-200',
        isOver && 'ring-2 ring-luz/80',
        arrastrando && !isOver && 'ring-1 ring-[var(--divider)]',
        className,
      )}
    >
      <header className="flex items-baseline gap-2 px-2 pb-2 pt-1.5">
        {Icono ? <Icono className={cn('size-4 self-center', etapa.etapa === 'ganado' ? 'text-success' : 'text-danger')} aria-hidden /> : null}
        <h2 className="truncate text-sm font-semibold text-fg">{etapa.etiqueta}</h2>
        <span className="num text-sm text-fg-subtle">{ops.length}</span>
        {conPrecios && valor > 0 ? <span className="num ml-auto text-xs font-medium text-fg-muted">{dinero(valor).replace(/\.\d\d$/, '')}</span> : null}
      </header>
      {etapa.cerrada ? <p className="-mt-1.5 px-2 pb-2 text-xs text-fg-subtle">Cerradas este mes</p> : null}
      <div className="flex flex-1 flex-col gap-2">
        {ops.map((o) => (
          <TarjetaArrastrable key={o.id} o={o} hoy={hoy} conPrecios={conPrecios} arrastrable={arrastrable} onAbrir={() => onAbrir(o)} onMover={(e) => onMover(o, e)} />
        ))}
        {!ops.length ? (
          <p className="grid flex-1 place-items-center rounded-tile border border-dashed border-[var(--divider)] px-3 py-6 text-center text-xs text-fg-subtle">
            {arrastrable ? 'Suelta aquí una oportunidad' : 'Sin oportunidades'}
          </p>
        ) : null}
      </div>
    </section>
  )
}


/** Escritorio: Ganado y Perdido como zonas plegables (también reciben tarjetas al arrastrar). */
function ZonaCerrada({
  etapa,
  ops,
  abierta,
  onAlternar,
  conPrecios,
  arrastrando,
}: {
  etapa: 'ganado' | 'perdido'
  ops: Oportunidad[]
  abierta: boolean
  onAlternar: () => void
  conPrecios: boolean
  arrastrando: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa })
  const valor = ops.reduce((s, o) => s + (o.valor_estimado ?? 0), 0)
  const ganado = etapa === 'ganado'
  const Icono = ganado ? Trophy : XCircle
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onAlternar}
      aria-expanded={abierta}
      data-etapa={etapa}
      className={cn(
        'glass glass-interactive flex min-h-14 items-center gap-3 rounded-tile px-4 py-2 text-left outline-none transition-[box-shadow] duration-200',
        abierta ? 'glass-strong' : 'glass-clear',
        isOver && 'ring-2 ring-luz/80',
        arrastrando && !isOver && 'ring-1 ring-dashed ring-[var(--divider)]',
      )}
    >
      <span className={cn('grid size-9 place-items-center rounded-full [&_svg]:size-[1.1rem]', ganado ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger')} aria-hidden>
        <Icono />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-fg">
          {ganado ? 'Ganadas' : 'Perdidas'} este mes <span className="num font-normal text-fg-subtle">{ops.length}</span>
        </span>
        <span className="block text-xs text-fg-subtle">{arrastrando ? `Suelta aquí para marcarla como ${ganado ? 'ganada' : 'perdida'}` : abierta ? 'Toca para ocultar' : 'Toca para ver'}</span>
      </span>
      {conPrecios && valor > 0 ? <span className="num text-base font-semibold text-fg">{dinero(valor).replace(/\.00$/, '')}</span> : null}
      <ChevronDown className={cn('size-4 text-fg-subtle transition-transform', abierta && 'rotate-180')} aria-hidden />
    </button>
  )
}

export default function EmbudoPage() {
  const { puede, sesion } = useSesion()
  const conPrecios = puede('ver_precios')
  const movil = useEsMovil()
  const reducir = useReducedMotion()
  const hoy = hoyISO()
  const consulta = useOportunidades()
  const equipo = useEquipo()
  const mover = useMoverEtapa()
  const [params, setParams] = useSearchParams()
  const [texto, setTexto] = useState('')
  const responsable = params.get('responsable') ?? ''
  const soloSinAccion = params.get('sin_accion') === '1'
  const [arrastrada, setArrastrada] = useState<Oportunidad | null>(null)
  const [perdida, setPerdida] = useState<Oportunidad | null>(null)
  const [editar, setEditar] = useState<Oportunidad | null | 'nueva'>(null)
  const abiertaId = params.get('op')
  const [etapaMovil, setEtapaMovil] = useState<EtapaComercial>('prospecto_nuevo')
  const carril = useRef<HTMLDivElement>(null)
  const [cerradaAbierta, setCerradaAbierta] = useState<'ganado' | 'perdido' | null>(null)

  const setParam = (k: string, v: string | null) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        if (v) n.set(k, v)
        else n.delete(k)
        return n
      },
      { replace: k !== 'op' },
    )

  const todas = consulta.data ?? []
  const m = useMemo(() => metricas(todas, hoy), [todas, hoy])
  const filtradas = useMemo(() => {
    const t = normalizar(texto.trim())
    return todas.filter(
      (o) =>
        (!responsable || o.responsable_id === responsable) &&
        (!soloSinAccion || (!o.proxima_accion_fecha && o.etapa !== 'ganado' && o.etapa !== 'perdido')) &&
        (!t || normalizar(`${o.titulo} ${o.cliente.nombre}`).includes(t)),
    )
  }, [todas, texto, responsable, soloSinAccion])
  const grupos = useMemo(() => porEtapa(filtradas, inicioMes()), [filtradas])

  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const moverA = (o: Oportunidad, etapa: EtapaComercial) => {
    if (o.etapa === etapa) return
    if (etapa === 'perdido') return setPerdida(o)
    mover.mutate(
      { id: o.id, etapa },
      { onSuccess: () => toast.success(`Movida a ${etiquetaEtapa(etapa)}`, { description: o.titulo }) },
    )
  }

  const alSoltar = (e: DragEndEvent) => {
    setArrastrada(null)
    const o = todas.find((x) => x.id === e.active.id)
    const destino = e.over?.id as EtapaComercial | undefined
    if (o && destino) moverA(o, destino)
  }

  // Celular: el control segmentado y el carril deslizable se sincronizan
  const irAEtapa = (et: EtapaComercial) => {
    setEtapaMovil(et)
    const c = carril.current
    const el = c?.querySelector<HTMLElement>(`[data-etapa="${et}"]`)
    if (c && el) c.scrollTo({ left: el.offsetLeft - c.offsetLeft - 16, behavior: reducir ? 'auto' : 'smooth' })
  }
  useEffect(() => {
    const el = carril.current
    if (!el || !movil) return
    const alDeslizar = () => {
      const i = Math.round(el.scrollLeft / (el.firstElementChild as HTMLElement | null)!.offsetWidth)
      const et = ETAPAS_EMBUDO[Math.min(Math.max(i, 0), ETAPAS_EMBUDO.length - 1)]!.etapa
      setEtapaMovil(et)
    }
    el.addEventListener('scroll', alDeslizar, { passive: true })
    return () => el.removeEventListener('scroll', alDeslizar)
  }, [movil, consulta.isSuccess])

  const abierta = abiertaId ? (todas.find((o) => o.id === abiertaId) ?? null) : null
  const columnas = movil ? ETAPAS_EMBUDO : ETAPAS_EMBUDO.filter((e) => !e.cerrada)

  return (
    <div className="flex flex-col gap-4 pt-1">
      <motion.div
        initial={reducir ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={resorte.suave}
        className="flex flex-col gap-3"
      >
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-fg">Embudo de ventas</h1>
          <GlassButton variante="primario" icono={<Plus />} className="ml-auto" onClick={() => setEditar('nueva')}>
            <span className="hidden sm:inline">Nueva oportunidad</span>
            <span className="sm:hidden">Nueva</span>
          </GlassButton>
        </div>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden" aria-label="Resumen del embudo" role="group">
          {consulta.isPending ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-11 w-44 shrink-0 rounded-full" />)
          ) : (
            <>
              {conPrecios ? (
                <Metrica etiqueta="Valor en juego">
                  <AnimatedNumber valor={m.valorEnJuego} formato={(n) => dinero(Math.round(n)).replace(/\.00$/, '')} />
                </Metrica>
              ) : (
                <Metrica etiqueta="Abiertas">{m.abiertas}</Metrica>
              )}
              <Metrica etiqueta="Tasa de cierre · 90 días">
                {m.tasaCierre === null ? '—' : `${Math.round(m.tasaCierre * 100)}%`}
                <span className="ml-1.5 text-xs font-normal text-fg-subtle">
                  {m.ganadas90}/{m.ganadas90 + m.perdidas90}
                </span>
              </Metrica>
              <Metrica etiqueta="Sin próxima acción" luz={m.sinAccion > 0} activo={soloSinAccion} onClick={m.sinAccion > 0 || soloSinAccion ? () => setParam('sin_accion', soloSinAccion ? null : '1') : undefined}>
                {m.sinAccion}
              </Metrica>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[13rem] flex-1 sm:max-w-sm">
            <GlassInput type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar cliente u oportunidad" aria-label="Buscar oportunidades" icono={<Search />} className="rounded-full" autoComplete="off" />
          </div>
          <GlassSelect aria-label="Filtrar por responsable" value={responsable} onChange={(e) => setParam('responsable', e.target.value || null)} className="w-auto rounded-full sm:w-56">
            <option value="">Todo el equipo</option>
            {sesion ? <option value={sesion.perfil.id}>Mis oportunidades</option> : null}
            {(equipo.data ?? [])
              .filter((x) => x.id !== sesion?.perfil.id)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nombre}
                </option>
              ))}
          </GlassSelect>
        </div>
      </motion.div>

      {movil && consulta.isSuccess ? (
        <SegmentedControl
          etiqueta="Etapa"
          tamano="sm"
          className="-mx-1 self-start"
          valor={etapaMovil}
          onCambio={irAEtapa}
          segmentos={ETAPAS_EMBUDO.map((e) => ({ valor: e.etapa, etiqueta: CORTO[e.etapa], conteo: grupos[e.etapa].length }))}
        />
      ) : null}

      {consulta.isPending ? (
        <div className="flex gap-3 overflow-hidden" role="status" aria-label="Cargando embudo">
          {Array.from({ length: movil ? 1 : 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[26rem] w-full min-w-[16rem] flex-1 rounded-module" />
          ))}
        </div>
      ) : consulta.isError ? (
        <GlassPanel>
          <EstadoVacio
            icono={<Filter />}
            titulo="No se pudo cargar el embudo"
            descripcion={`${consulta.error.message}. Revisa tu conexión e inténtalo de nuevo.`}
            accion={
              <GlassButton icono={<RotateCcw />} onClick={() => void consulta.refetch()}>
                Reintentar
              </GlassButton>
            }
          />
        </GlassPanel>
      ) : !todas.length ? (
        <GlassPanel>
          <EstadoVacio
            icono={<Target />}
            titulo="Tu embudo está vacío"
            descripcion="Cada persona que pide informes por WhatsApp, redes o en mostrador es una oportunidad. Regístrala para no perderle la pista."
            accion={
              <GlassButton variante="primario" icono={<Plus />} onClick={() => setEditar('nueva')}>
                Crear la primera oportunidad
              </GlassButton>
            }
          />
        </GlassPanel>
      ) : (
        <DndContext sensors={sensores} onDragStart={(e: DragStartEvent) => setArrastrada(todas.find((o) => o.id === e.active.id) ?? null)} onDragEnd={alSoltar} onDragCancel={() => setArrastrada(null)}>
          {!movil ? (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                {(['ganado', 'perdido'] as const).map((et) => (
                  <ZonaCerrada key={et} etapa={et} ops={grupos[et]} abierta={cerradaAbierta === et} onAlternar={() => setCerradaAbierta((a) => (a === et ? null : et))} conPrecios={conPrecios} arrastrando={Boolean(arrastrada)} />
                ))}
              </div>
              {cerradaAbierta ? (
                <motion.div
                  key={cerradaAbierta}
                  initial={reducir ? false : { opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={resorte.agil}
                  className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                  aria-label={cerradaAbierta === 'ganado' ? 'Ganadas este mes' : 'Perdidas este mes'}
                  role="region"
                >
                  {grupos[cerradaAbierta].length ? (
                    grupos[cerradaAbierta].map((o) => (
                      <TarjetaArrastrable key={o.id} o={o} hoy={hoy} conPrecios={conPrecios} arrastrable onAbrir={() => setParam('op', o.id)} onMover={(e) => moverA(o, e)} />
                    ))
                  ) : (
                    <p className="col-span-full py-3 text-center text-sm text-fg-subtle">Ninguna este mes.</p>
                  )}
                </motion.div>
              ) : null}
            </div>
          ) : null}
          <div
            ref={carril}
            className={cn(
              'flex gap-3 overflow-x-auto pb-3',
              movil ? '-mx-4 snap-x snap-mandatory scroll-px-4 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : 'lg:grid lg:grid-cols-5 lg:overflow-visible',
            )}
          >
            {columnas.map((e) => (
              <Columna
                key={e.etapa}
                etapa={e}
                ops={grupos[e.etapa]}
                hoy={hoy}
                conPrecios={conPrecios}
                arrastrando={Boolean(arrastrada)}
                arrastrable={!movil}
                onAbrir={(o) => setParam('op', o.id)}
                onMover={moverA}
                className={movil ? 'w-[calc(100vw-2rem)] shrink-0 snap-start' : 'w-72 shrink-0 lg:w-auto'}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={reducir ? null : undefined}>
            {arrastrada ? <TarjetaOportunidad oportunidad={arrastrada} hoy={hoy} conPrecios={conPrecios} levantada /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {filtradas.length === 0 && todas.length > 0 ? (
        <p className="text-center text-sm text-fg-muted">
          Ninguna oportunidad coincide con los filtros.{' '}
          <button type="button" className="font-semibold text-accent underline-offset-2 hover:underline dark:text-navy-200" onClick={() => (setTexto(''), setParams({}, { replace: true }))}>
            Quitar filtros
          </button>
        </p>
      ) : null}

      <OportunidadModal
        abierto={editar !== null}
        onCambio={(a) => !a && setEditar(null)}
        oportunidad={editar === 'nueva' ? null : editar}
        onGuardada={(o) => editar === 'nueva' && movil && irAEtapa(o.etapa)}
      />
      <DetalleOportunidad id={abiertaId} previa={abierta} hoy={hoy} onCerrar={() => setParam('op', null)} onEditar={(o) => setEditar(o)} onMover={moverA} />
      <MotivoPerdidaModal
        abierto={Boolean(perdida)}
        titulo={perdida?.titulo ?? ''}
        onCambio={(a) => !a && setPerdida(null)}
        onConfirmar={(motivo) => {
          const o = perdida!
          setPerdida(null)
          mover.mutate({ id: o.id, etapa: 'perdido', motivo }, { onSuccess: () => toast(`Marcada como perdida`, { description: o.titulo }) })
        }}
      />
    </div>
  )
}
