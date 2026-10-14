import { ArrowLeft, CheckCircle2, ClipboardX, FileCheck2, FileClock, MapPin, MessageSquarePlus, Printer, RotateCcw } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useSesion } from '@/app/sesion'
import { EstadoVacio, GlassButton, GlassCard, GlassIconButton, GlassPanel, GlassTextarea, Pildora, Skeleton } from '@/components/glass'
import { api } from '@/data/api'
import type { HojaOrden, OrdenTrabajo } from '@/data/modulos/produccion/contrato'
import type { EstadoPedido } from '@/data/tipos'
import { ESTADO_PEDIDO } from '@/lib/estados'
import { fechaLarga, haceCuanto, hoyISO } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useGuardarNotaPartida, useMoverEtapa, useOrden } from './consultas'
import { Casilla, useCasillas } from './orden/Casilla'
import { PASOS_TALLER, PRIORIDAD } from './orden/comun'
import { Conceptos } from './orden/Conceptos'
import { Evidencias } from './orden/Evidencias'
import { HojaImpresion } from './orden/HojaImpresion'
import { DialogoPausa } from './tablero/DialogoPausa'
import { MenuMover } from './tablero/MenuMover'
import { Avatar, Entrega } from './tablero/TarjetaOrden'

/** Hoja de orden de trabajo (/produccion/:id) para consultar e imprimir en el taller. Sin precios. */
export default function OrdenTrabajoPage() {
  const { id = '' } = useParams()
  return <Orden key={id} id={id} />
}

function Orden({ id }: { id: string }) {
  const navegar = useNavigate()
  const { puede } = useSesion()
  const consulta = useOrden(id)
  const mover = useMoverEtapa()
  const guardarNota = useGuardarNotaPartida(id)
  const [casillas, marcar] = useCasillas(id)
  const [pausar, setPausar] = useState<OrdenTrabajo | null>(null)
  const hoy = useMemo(() => hoyISO(), [])
  const editable = puede('actualizar_produccion') || puede('gestionar_pedidos')
  const volver = () => (window.history.length > 1 ? navegar(-1) : navegar('/produccion'))

  if (consulta.isPending) return <EsqueletoOrden />
  if (consulta.isError) {
    const noExiste = /no encontrad/i.test(consulta.error.message)
    return (
      <GlassPanel className="mt-2">
        <EstadoVacio
          icono={<ClipboardX />}
          titulo={noExiste ? 'No encontramos esta orden de trabajo' : 'No se pudo abrir la orden de trabajo'}
          descripcion={
            noExiste
              ? 'Puede que el pedido se haya cancelado o que el enlace esté incompleto.'
              : `${consulta.error.message}. Revisa tu conexión e inténtalo de nuevo.`
          }
          accion={
            <div className="flex flex-wrap justify-center gap-2">
              <GlassButton variante="cristal" icono={<ArrowLeft />} onClick={() => navegar('/produccion')}>
                Volver al tablero
              </GlassButton>
              {!noExiste ? (
                <GlassButton icono={<RotateCcw />} onClick={() => void consulta.refetch()}>
                  Reintentar
                </GlassButton>
              ) : null}
            </div>
          }
        />
      </GlassPanel>
    )
  }

  const hoja = consulta.data
  const o = hoja.orden
  const estado = ESTADO_PEDIDO[o.estado]
  const onMover = (e: EstadoPedido) => mover.mutate({ orden: o, estado: e })

  return (
    <div className="flex flex-col gap-5 pt-1">
      <HojaImpresion hoja={hoja} />

      {/* Encabezado + botones tipo Centro de Control */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <GlassIconButton etiqueta="Volver al tablero" icono={<ArrowLeft />} tamano="sm" className="mt-0.5 shrink-0" onClick={volver} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="num text-sm font-semibold text-fg-muted">{o.folio}</span>
              <Pildora tono={estado.tono}>{estado.etiqueta}</Pildora>
              {o.prioridad === 'urgente' ? (
                <Pildora tono="luz">Urgente</Pildora>
              ) : o.prioridad === 'alta' ? (
                <Pildora tono="aviso">Prioridad alta</Pildora>
              ) : null}
            </div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-fg [text-wrap:balance] sm:text-2xl">{o.titulo}</h2>
            <p className="mt-0.5 text-base text-fg-muted">{o.cliente}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-start gap-4 pl-[3.25rem] sm:pl-0">
          <GlassIconButton etiqueta="Imprimir" icono={<Printer />} mostrarEtiqueta destacado onClick={() => window.print()} />
          {editable ? (
            <div className="flex w-full max-w-[5.5rem] flex-col items-center gap-2 text-center">
              <MenuMover o={o} onMover={(e) => (e === 'pausado' ? setPausar(o) : onMover(e))} onPausar={() => setPausar(o)} grande />
              <span className="text-xs font-medium leading-tight text-fg-muted" aria-hidden>
                Mover a…
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {o.estado === 'pausado' ? (
        <GlassCard className="flex items-center gap-3 bg-warning-soft/70 p-3 pr-4" role="status">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-warning/15 text-warning">
            <RotateCcw className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-fg">Pedido en pausa</p>
            <p className="text-sm text-fg-muted">{o.motivo_estado ?? 'Sin motivo registrado.'}</p>
          </div>
        </GlassCard>
      ) : null}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <GlassPanel className="p-5 sm:p-7" aria-label={`Orden de trabajo ${o.folio}`}>
          <DatosOrden o={o} hoy={hoy} />

          <h3 className="mb-2 mt-7 text-md font-semibold text-fg">Conceptos</h3>
          <Conceptos
            partidas={hoja.partidas}
            editable={editable}
            guardar={async (partidaId, notas) => {
              await guardarNota.mutateAsync({ partidaId, notas })
            }}
            hechos={casillas}
            marcar={marcar}
          />

          <div className="mt-6 grid gap-6 border-t border-[var(--divider)] pt-6 md:grid-cols-2">
            <ArchivosAprobados disenos={hoja.disenos} />
            <section aria-labelledby="titulo-revision">
              <h3 id="titulo-revision" className="text-md font-semibold text-fg">
                Revisión del taller
              </h3>
              <p className="mb-2 text-xs text-fg-subtle">Se recuerda en este dispositivo; en papel van como casillas.</p>
              <div className="-ml-2 flex flex-col">
                {PASOS_TALLER.filter((p) => !p.soloInstalacion || o.requiere_instalacion).map((p) => (
                  <Casilla key={p.id} marcada={Boolean(casillas[p.id])} onCambio={(v) => marcar(p.id, v)}>
                    {p.texto}
                  </Casilla>
                ))}
              </div>
            </section>
          </div>
        </GlassPanel>

        <aside className="grid gap-4 md:grid-cols-2 xl:grid-cols-1" aria-label="Evidencias y notas">
          <Evidencias pedidoId={o.id} evidencias={hoja.evidencias} puedeSubir={editable} />
          <NotasEquipo pedidoId={o.id} notas={hoja.notas} />
        </aside>
      </div>

      <DialogoPausa
        orden={pausar}
        onCerrar={() => setPausar(null)}
        onPausar={(motivo) => {
          if (pausar) mover.mutate({ orden: pausar, estado: 'pausado', motivo })
          setPausar(null)
        }}
      />
    </div>
  )
}

function Dato({ etiqueta, children, className }: { etiqueta: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-xs font-medium text-fg-subtle">{etiqueta}</dt>
      <dd className="mt-1 text-sm font-medium text-fg">{children}</dd>
    </div>
  )
}

function DatosOrden({ o, hoy }: { o: OrdenTrabajo; hoy: string }) {
  return (
    <dl className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-3">
      <Dato etiqueta="Fecha de entrega">
        <span className="block">{o.fecha_entrega ? fechaLarga(o.fecha_entrega) : 'Sin fecha'}</span>
        <Entrega o={o} hoy={hoy} className="mt-1" soloAviso />
      </Dato>
      <Dato etiqueta="Prioridad">{PRIORIDAD[o.prioridad]}</Dato>
      <Dato etiqueta="Responsable">
        {o.responsable ? (
          <span className="inline-flex items-center gap-2">
            <Avatar nombre={o.responsable} />
            {o.responsable}
          </span>
        ) : (
          <span className="text-fg-muted">Sin asignar</span>
        )}
      </Dato>
      <Dato etiqueta="Diseñador">{o.disenador ?? <span className="text-fg-muted">Sin asignar</span>}</Dato>
      <Dato etiqueta="Instalación" className="col-span-2">
        {o.requiere_instalacion ? (
          <span className="inline-flex items-start gap-1.5">
            <MapPin className="mt-0.5 size-4 shrink-0 text-fg-muted" aria-hidden />
            {o.direccion_instalacion || 'Lleva instalación; falta confirmar la dirección'}
          </span>
        ) : (
          <span className="text-fg-muted">No lleva instalación</span>
        )}
      </Dato>
      {o.descripcion ? (
        <Dato etiqueta="Descripción" className="col-span-full">
          <span className="font-normal">{o.descripcion}</span>
        </Dato>
      ) : null}
    </dl>
  )
}

function ArchivosAprobados({ disenos }: { disenos: HojaOrden['disenos'] }) {
  const aprobados = disenos.filter((d) => d.estado_aprobacion === 'aprobado')
  const pendientes = disenos.filter((d) => d.estado_aprobacion === 'pendiente').length
  const abrir = async (archivoId: string) => {
    try {
      const url = await api.archivos.url(archivoId)
      if (url) window.open(url, '_blank', 'noopener')
      else
        toast.error('Este diseño no tiene archivo adjunto', {
          description: 'Pide a diseño que lo suba o agregue el enlace.',
        })
    } catch (e) {
      toast.error('No se pudo abrir el diseño', {
        description: `${e instanceof Error ? e.message : 'Error de conexión'}. Inténtalo de nuevo.`,
      })
    }
  }
  return (
    <section aria-labelledby="titulo-archivos">
      <h3 id="titulo-archivos" className="text-md font-semibold text-fg">
        Archivos aprobados
      </h3>
      {pendientes ? (
        <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 [&_svg]:size-3.5">
          <FileClock aria-hidden />
          {pendientes === 1 ? '1 diseño espera aprobación del cliente' : `${pendientes} diseños esperan aprobación del cliente`}
        </p>
      ) : null}
      {aprobados.length ? (
        <ul className="mt-2 flex flex-col">
          {aprobados.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => void abrir(d.id)}
                className="flex min-h-11 w-full items-center gap-3 rounded-control px-2 text-left text-sm outline-none transition-colors hover:bg-[var(--control-bg)] focus-visible:ring-2 focus-visible:ring-accent"
              >
                <FileCheck2 className="size-[1.1rem] shrink-0 text-success" aria-hidden />
                <span className="min-w-0 flex-1 truncate font-medium text-fg">{d.nombre}</span>
                {d.version ? <span className="num shrink-0 text-xs text-fg-subtle">v{d.version}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-fg-muted">Sin diseño aprobado todavía. No produzcas sin la aprobación del cliente.</p>
      )}
    </section>
  )
}

function NotasEquipo({ pedidoId, notas }: { pedidoId: string; notas: HojaOrden['notas'] }) {
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const qc = useOrden(pedidoId)
  const agregar = async () => {
    if (!texto.trim()) return
    setEnviando(true)
    try {
      await api.produccion.agregarNota(pedidoId, texto.trim())
      setTexto('')
      await qc.refetch()
    } catch (e) {
      toast.error('No se guardó la nota', {
        description: `${e instanceof Error ? e.message : 'Error de conexión'}. Tu texto sigue en el campo.`,
      })
    } finally {
      setEnviando(false)
    }
  }
  return (
    <GlassCard variante="fuerte" className="no-print" aria-labelledby="titulo-notas">
      <h2 id="titulo-notas" className="text-md font-semibold text-fg">
        Notas para el equipo
      </h2>
      <form
        className="mt-3 flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void agregar()
        }}
      >
        <label htmlFor="nota-equipo" className="sr-only">
          Nueva nota para el equipo
        </label>
        <GlassTextarea
          id="nota-equipo"
          rows={2}
          value={texto}
          maxLength={1000}
          placeholder="Ej.: se instaló el lado norte; falta el sur"
          onChange={(e) => setTexto(e.target.value)}
          className="text-sm"
        />
        <GlassButton
          type="submit"
          variante="cristal"
          tamano="sm"
          icono={<MessageSquarePlus />}
          cargando={enviando}
          disabled={!texto.trim()}
          className="self-end pointer-coarse:h-11"
        >
          Agregar nota
        </GlassButton>
      </form>
      {notas.length ? (
        <ul className="mt-3 flex flex-col gap-3 border-t border-[var(--divider)] pt-3">
          {notas.slice(0, 6).map((n) => (
            <li key={n.id} className="text-sm">
              <p className="text-fg [overflow-wrap:anywhere]">{n.mensaje}</p>
              <p className="mt-0.5 text-xs text-fg-subtle">
                {n.usuario ?? 'Equipo'}, {haceCuanto(n.created_at)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-fg-subtle">
          <CheckCircle2 className="size-3.5" aria-hidden /> Sin notas por ahora.
        </p>
      )}
    </GlassCard>
  )
}

function EsqueletoOrden() {
  return (
    <div className="flex flex-col gap-5 pt-1" aria-busy aria-label="Cargando orden de trabajo">
      <div className="flex items-start gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-7 w-72" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <GlassPanel className="flex flex-col gap-4 p-7">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </GlassPanel>
        <Skeleton className="h-56 rounded-module" />
      </div>
    </div>
  )
}
