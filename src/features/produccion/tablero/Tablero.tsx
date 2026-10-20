import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core'
import { ChevronsLeftRight, CircleDashed, CirclePause, Inbox } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState, type KeyboardEventHandler, type MouseEventHandler, type ReactNode } from 'react'
import { GlassButton, SegmentedControl } from '@/components/glass'
import type { OrdenTrabajo } from '@/data/modulos/produccion/contrato'
import type { EstadoPedido } from '@/data/tipos'
import { useEsMovil } from '@/hooks/useMediaQuery'
import { ESTADO_PEDIDO } from '@/lib/estados'
import { resorte } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { MenuMover } from './MenuMover'
import { enEtapa } from './etapas'
import { AsaArrastre, TarjetaOrden } from './TarjetaOrden'

const COL = 'col:'
/** Tarjetas que se pintan por columna; el resto aparece con "Mostrar más" (la base real tiene cientos). */
const POR_COLUMNA = 30
const nombre = (e: EstadoPedido) => ESTADO_PEDIDO[e].etiqueta

/** Con el teclado, ← y → saltan de columna en columna (en lugar de moverse de 25 en 25 px). */
const saltoDeColumna: KeyboardCoordinateGetter = (evento, { context, currentCoordinates }) => {
  if (evento.code !== 'ArrowRight' && evento.code !== 'ArrowLeft') return undefined
  evento.preventDefault()
  const columnas = [...context.droppableRects.entries()]
    .filter(([id]) => String(id).startsWith(COL))
    .map(([, r]) => r)
    .sort((a, b) => a.left - b.left)
  if (!columnas.length) return undefined
  const centro = currentCoordinates.x + (context.collisionRect?.width ?? 0) / 2
  let i = columnas.findIndex((r) => centro >= r.left && centro <= r.right)
  if (i < 0) i = columnas.findIndex((r) => r.left > centro) - 1
  const j = Math.max(0, Math.min(columnas.length - 1, i + (evento.code === 'ArrowRight' ? 1 : -1)))
  const destino = columnas[j]
  // Siempre un pequeño cambio vertical: así dnd-kit desplaza el carril Y mueve la tarjeta a la vez
  // (con delta vertical cero solo desplaza y la tarjeta se queda en la columna anterior).
  const y = Math.max(currentCoordinates.y, destino.top + 56)
  return { x: destino.left + 8, y: Math.round(y) === Math.round(currentCoordinates.y) ? y + 1 : y }
}

/** Primero lo que está bajo el puntero; con teclado (sin puntero), lo que se cruza con la tarjeta. */
const colision: CollisionDetection = (args) => {
  const bajoPuntero = pointerWithin(args)
  return bajoPuntero.length ? bajoPuntero : rectIntersection(args)
}

export interface TableroProps {
  grupos: Map<EstadoPedido, OrdenTrabajo[]>
  columnas: EstadoPedido[]
  hoy: string
  puedeMover: boolean
  onMover: (o: OrdenTrabajo, estado: EstadoPedido) => void
  onPausar: (o: OrdenTrabajo) => void
}

export function Tablero({ grupos, columnas, hoy, puedeMover, onMover, onPausar }: TableroProps) {
  const reducir = useReducedMotion()
  const movil = useEsMovil()
  const [activa, setActiva] = useState<OrdenTrabajo | null>(null)
  const [sobreOtra, setSobreOtra] = useState(false)
  const [recien, setRecien] = useState<string | null>(null)
  // "Nuevo" (esperando anticipo) y "Pausado" no son trabajo activo del taller: empiezan plegadas
  const [abiertas, setAbiertas] = useState<Set<EstadoPedido>>(() => new Set())
  const [limites, setLimites] = useState<Partial<Record<EstadoPedido, number>>>({})
  const limite = (e: EstadoPedido) => limites[e] ?? POR_COLUMNA
  const mas = (e: EstadoPedido) => () => setLimites((l) => ({ ...l, [e]: (l[e] ?? POR_COLUMNA) + POR_COLUMNA }))
  const plegable = (e: EstadoPedido) => !movil && (e === 'nuevo' || e === 'pausado')
  const alternar = (e: EstadoPedido) =>
    setAbiertas((a) => {
      const n = new Set(a)
      if (n.has(e)) n.delete(e)
      else n.add(e)
      return n
    })
  const pausados = grupos.get('pausado') ?? []

  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: saltoDeColumna }),
  )

  const buscar = (id: string | number) => [...grupos.values()].flat().find((o) => o.id === id) ?? null

  const alSoltar = ({ active, over }: DragEndEvent) => {
    setActiva(null)
    const o = buscar(active.id)
    if (!o || !over) return
    const estado = String(over.id).slice(COL.length) as EstadoPedido
    if (estado === o.estado) return
    if (estado === 'pausado') {
      onPausar(o)
      return
    }
    setRecien(o.id)
    onMover(o, estado)
  }

  const anuncios: Announcements = {
    onDragStart: ({ active }) => {
      const o = buscar(active.id)
      return o ? `Tomaste ${o.folio}, ${enEtapa(o.estado)}. Flecha izquierda o derecha cambia de etapa; Espacio la suelta y Escape cancela.` : undefined
    },
    onDragOver: ({ active, over }) => {
      const o = buscar(active.id)
      if (!o) return undefined
      return over ? `${o.folio} sobre ${nombre(String(over.id).slice(COL.length) as EstadoPedido)}` : `${o.folio} fuera de las etapas`
    },
    onDragEnd: ({ active, over }) => {
      const o = buscar(active.id)
      if (!o) return undefined
      return over ? `${o.folio} se soltó ${enEtapa(String(over.id).slice(COL.length) as EstadoPedido)}` : `${o.folio} se quedó ${enEtapa(o.estado)}`
    },
    onDragCancel: ({ active }) => {
      const o = buscar(active.id)
      return o ? `Movimiento cancelado. ${o.folio} sigue ${enEtapa(o.estado)}.` : undefined
    },
  }

  // Celular: una columna por pantalla con snap y el selector de etapas sincronizado
  const carril = useRef<HTMLDivElement>(null)
  const todas = useMemo(() => [...columnas, 'pausado' as const], [columnas])
  const [visible, setVisible] = useState<EstadoPedido>(todas[0])
  useEffect(() => {
    if (!todas.includes(visible)) setVisible(todas[0])
  }, [todas, visible])

  const selector = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // La pestaña activa siempre a la vista dentro del selector deslizable
    const tab = selector.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
    const lista = tab?.parentElement
    if (tab && lista)
      lista.scrollTo({
        left: tab.offsetLeft - (lista.clientWidth - tab.clientWidth) / 2,
        behavior: reducir ? 'auto' : 'smooth',
      })
  }, [visible, reducir])

  const irA = (e: EstadoPedido) => {
    setVisible(e)
    const el = carril.current?.querySelector<HTMLElement>(`[data-etapa="${e}"]`)
    if (el && carril.current)
      carril.current.scrollTo({
        left: el.offsetLeft - carril.current.offsetLeft,
        behavior: reducir ? 'auto' : 'smooth',
      })
  }
  const alDesplazar = () => {
    const c = carril.current
    if (!movil || !c) return
    const i = Math.round(c.scrollLeft / Math.max(1, c.clientWidth))
    const e = todas[Math.min(todas.length - 1, Math.max(0, i))]
    if (e && e !== visible) setVisible(e)
  }

  return (
    <DndContext
      sensors={sensores}
      collisionDetection={colision}
      accessibility={{
        announcements: anuncios,
        screenReaderInstructions: {
          draggable:
            'Para mover una orden con el teclado, presiona Espacio, elige la etapa con las flechas izquierda y derecha y vuelve a presionar Espacio para soltarla. Escape cancela.',
        },
      }}
      onDragStart={({ active }: DragStartEvent) => {
        setActiva(buscar(active.id))
        setSobreOtra(false)
      }}
      onDragOver={({ active, over }) => setSobreOtra(Boolean(over && String(over.id) !== `${COL}${buscar(active.id)?.estado}`))}
      onDragEnd={alSoltar}
      onDragCancel={() => setActiva(null)}
    >
      {movil ? (
        <div ref={selector}>
          <SegmentedControl
            etiqueta="Etapa visible"
            tamano="md"
            segmentos={todas.map((e) => ({
              valor: e,
              etiqueta: ESTADO_PEDIDO[e].corto,
              conteo: grupos.get(e)?.length ?? 0,
            }))}
            valor={visible}
            onCambio={irA}
            className="w-full"
          />
        </div>
      ) : null}

      <div
        ref={carril}
        onScroll={alDesplazar}
        className={cn(
          'flex gap-3 overflow-x-auto pb-3 [scrollbar-width:thin]',
          'max-md:snap-x max-md:snap-mandatory max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden',
          'md:-mx-1 md:px-1 lg:h-[calc(100dvh-14.5rem)] lg:min-h-[28rem]',
        )}
        aria-label="Tablero de producción por etapas"
      >
        {columnas.map((e) => (
          <Columna
            key={e}
            estado={e}
            ordenes={grupos.get(e) ?? []}
            plegada={plegable(e) && !abiertas.has(e)}
            onPlegar={plegable(e) ? () => alternar(e) : undefined}
            restantes={Math.max(0, (grupos.get(e)?.length ?? 0) - limite(e))}
            onMas={mas(e)}
          >
            {(grupos.get(e) ?? []).slice(0, limite(e)).map((o) => (
              <Tarjeta key={o.id} o={o} hoy={hoy} puedeMover={puedeMover} recien={recien === o.id} onMover={onMover} onPausar={onPausar} />
            ))}
          </Columna>
        ))}

        {/* Pausados: columna plegable; también recibe tarjetas (pide motivo) */}
        <Columna
          estado="pausado"
          ordenes={pausados}
          plegada={plegable('pausado') && !abiertas.has('pausado')}
          onPlegar={plegable('pausado') ? () => alternar('pausado') : undefined}
          restantes={Math.max(0, pausados.length - limite('pausado'))}
          onMas={mas('pausado')}
        >
          {pausados.slice(0, limite('pausado')).map((o) => (
            <Tarjeta key={o.id} o={o} hoy={hoy} puedeMover={puedeMover} recien={recien === o.id} onMover={onMover} onPausar={onPausar} />
          ))}
        </Columna>
      </div>

      <DragOverlay dropAnimation={reducir || sobreOtra ? null : { duration: 280, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.15)' }} zIndex={60}>
        {activa ? (
          <motion.div
            initial={{ scale: 1, rotate: 0 }}
            animate={reducir ? undefined : { scale: 1.045, rotate: -1.6 }}
            transition={resorte.agil}
            className="rounded-tile shadow-lift"
          >
            <TarjetaOrden o={activa} hoy={hoy} flotante className="shadow-glass-lg" />
          </motion.div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

function Columna({
  estado,
  ordenes,
  children,
  plegada,
  onPlegar,
  restantes = 0,
  onMas,
}: {
  estado: EstadoPedido
  ordenes: OrdenTrabajo[]
  children: ReactNode
  plegada?: boolean
  onPlegar?: () => void
  /** Órdenes de la columna que aún no se muestran */
  restantes?: number
  onMas?: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${COL}${estado}` })
  const reducir = useReducedMotion()
  const info = ESTADO_PEDIDO[estado]
  const pausa = estado === 'pausado'
  const idTitulo = `columna-${estado}`

  if (plegada) {
    const plural = pausa ? 'Pausados' : 'Nuevos'
    return (
      <section
        ref={setNodeRef}
        data-etapa={estado}
        aria-labelledby={idTitulo}
        className={cn(
          'glass glass-clear flex w-16 shrink-0 flex-col items-center gap-3 rounded-module py-3 transition-[background-color] duration-200',
          isOver && (pausa ? 'bg-warning-soft ring-2 ring-warning/50' : 'bg-accent/[0.08] ring-2 ring-accent/35'),
        )}
      >
        <button
          type="button"
          onClick={onPlegar}
          aria-expanded={false}
          className={cn(
            'grid size-11 place-items-center rounded-full outline-none transition-colors hover:bg-[var(--control-bg)] focus-visible:ring-2 focus-visible:ring-accent [&_svg]:size-5',
            pausa ? 'text-warning' : 'text-fg-muted',
          )}
          aria-label={`Mostrar ${plural.toLowerCase()} (${ordenes.length})`}
        >
          {pausa ? <CirclePause aria-hidden /> : <CircleDashed aria-hidden />}
        </button>
        <span
          className={cn(
            'num grid min-w-6 place-items-center rounded-full px-1.5 text-xs font-bold',
            pausa ? 'bg-warning/15 text-warning' : 'bg-[var(--control-bg)] text-fg-muted',
          )}
        >
          {ordenes.length}
        </span>
        <h2 id={idTitulo} className="mt-1 text-sm font-semibold text-fg-muted [writing-mode:vertical-rl]">
          {pausa ? plural : 'Nuevos, esperan anticipo'}
        </h2>
      </section>
    )
  }

  return (
    <section
      ref={setNodeRef}
      data-etapa={estado}
      aria-labelledby={idTitulo}
      className={cn(
        'glass glass-clear flex shrink-0 snap-center flex-col rounded-module transition-[background-color] duration-200',
        'w-full md:w-[16rem] lg:max-h-full',
        isOver && (pausa ? 'bg-warning-soft ring-2 ring-warning/50' : 'bg-accent/[0.08] ring-2 ring-accent/35 dark:bg-navy-300/[0.12] dark:ring-navy-300/50'),
      )}
    >
      <header className="flex items-center gap-2 px-4 pb-2 pt-3.5">
        <span
          className={cn(
            'size-2 shrink-0 rounded-full',
            info.tono === 'luz'
              ? 'bg-luz shadow-[0_0_8px_rgba(249,194,6,0.8)]'
              : pausa
                ? 'bg-warning'
                : info.tono === 'exito'
                  ? 'bg-success'
                  : estado === 'nuevo'
                    ? 'bg-fg/30'
                    : 'bg-accent dark:bg-navy-300',
          )}
          aria-hidden
        />
        <h2 id={idTitulo} className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">
          {info.etiqueta}
        </h2>
        <span className="num rounded-full bg-[var(--control-bg)] px-2 text-xs font-bold text-fg-muted" aria-label={`${ordenes.length} órdenes`}>
          {ordenes.length}
        </span>
        {onPlegar ? (
          <button
            type="button"
            onClick={onPlegar}
            aria-expanded
            aria-label={`Plegar ${pausa ? 'pausados' : 'nuevos'}`}
            className="grid size-8 place-items-center rounded-full text-fg-subtle outline-none hover:bg-[var(--control-bg)] hover:text-fg focus-visible:ring-2 focus-visible:ring-accent [&_svg]:size-4"
          >
            <ChevronsLeftRight aria-hidden />
          </button>
        ) : null}
      </header>
      <ul
        className="flex min-h-[8rem] flex-1 flex-col gap-2.5 overflow-y-auto px-2.5 pb-2.5 pt-1 lg:min-h-0"
        aria-label={`Órdenes en ${info.etiqueta.toLowerCase()}`}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {children}
        </AnimatePresence>
        {restantes > 0 && onMas ? (
          <li className="shrink-0">
            <GlassButton variante="fantasma" tamano="sm" onClick={onMas} className="h-11 w-full">
              Mostrar {Math.min(POR_COLUMNA, restantes)} más (quedan {restantes})
            </GlassButton>
          </li>
        ) : null}
        {ordenes.length === 0 ? (
          <li className="flex flex-1 flex-col items-center justify-center gap-2 rounded-tile border border-dashed border-[var(--divider)] px-4 py-8 text-center text-xs text-fg-subtle [&_svg]:size-5">
            <Inbox aria-hidden />
            {pausa ? 'Nada detenido' : reducir ? 'Sin órdenes' : 'Suelta aquí una orden'}
          </li>
        ) : null}
      </ul>
    </section>
  )
}

function Tarjeta({
  o,
  hoy,
  puedeMover,
  recien,
  onMover,
  onPausar,
}: {
  o: OrdenTrabajo
  hoy: string
  puedeMover: boolean
  recien: boolean
  onMover: (o: OrdenTrabajo, estado: EstadoPedido) => void
  onPausar: (o: OrdenTrabajo) => void
}) {
  const reducir = useReducedMotion()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({ id: o.id, disabled: !puedeMover })

  return (
    <motion.li
      ref={setNodeRef}
      layout={reducir ? false : 'position'}
      // Al soltarla en otra columna, la tarjeta "asienta": baja de la escala de arrastre con un resorte
      initial={recien && !reducir ? { scale: 1.045, rotate: -1.6, opacity: 0.85 } : false}
      animate={{ scale: 1, rotate: 0, opacity: 1 }}
      exit={reducir ? undefined : { opacity: 0, scale: 0.96, transition: { duration: 0.12 } }}
      transition={resorte.expansion}
      onMouseDown={puedeMover ? (listeners?.onMouseDown as MouseEventHandler<HTMLLIElement> | undefined) : undefined}
      className={cn(puedeMover && 'md:cursor-grab')}
    >
      <TarjetaOrden
        o={o}
        hoy={hoy}
        fantasma={isDragging}
        asa={
          puedeMover ? (
            <AsaArrastre
              ref={setActivatorNodeRef}
              folio={o.folio}
              {...attributes}
              onKeyDown={listeners?.onKeyDown as KeyboardEventHandler<HTMLButtonElement> | undefined}
            />
          ) : undefined
        }
        menu={puedeMover ? <MenuMover o={o} onMover={(e) => (e === 'pausado' ? onPausar(o) : onMover(o, e))} onPausar={() => onPausar(o)} /> : undefined}
      />
    </motion.li>
  )
}
