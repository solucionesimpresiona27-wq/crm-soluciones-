import { AlarmClock, ArrowLeft, CopyPlus, FileSearch, Lock, PackageCheck, RotateCcw, XCircle } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useConfiguracion } from '@/app/consultas'
import { useSesion } from '@/app/sesion'
import { EstadoVacio, GlassButton, GlassIconButton, GlassPanel, GlassSurface, Pildora } from '@/components/glass'
import type { CotizacionCompleta, EstadoCotizacion } from '@/data/tipos'
import { ESTADO_COTIZACION, estadoVisibleCotizacion } from '@/lib/estados'
import { dinero, fechaLarga, hoyISO } from '@/lib/format'
import { resorte } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { useCompartirCotizacion } from './compartir/useCompartirCotizacion'
import { useCambiarEstadoCotizacion, useCotizacion, useDuplicarCotizacion } from './consultas'
import { BarraAcciones, type ManejadoresDetalle } from './detalle/BarraAcciones'
import { anticipoDe } from './detalle/calculos'
import { DialogoConvertir, DialogoEliminar, DialogoRechazar } from './detalle/Dialogos'
import { EsqueletoDetalle } from './detalle/EsqueletoDetalle'
import { HojaCotizacion } from './detalle/HojaCotizacion'
import { ModuloCostos, ModuloHistorial, ModuloNotasInternas, ModuloTotal } from './detalle/PanelResumen'
import { diasRestantes } from './lista/datos'

export default function CotizacionDetallePage() {
  const { puede } = useSesion()
  const { id } = useParams()
  const navegar = useNavigate()
  if (!puede('ver_precios')) {
    return (
      <GlassPanel className="mt-2">
        <EstadoVacio
          icono={<Lock />}
          titulo="Las cotizaciones son para ventas y administración"
          descripcion="Tu rol no incluye precios. Si necesitas consultar esta cotización, pide acceso al administrador."
          accion={
            <GlassButton variante="cristal" onClick={() => navegar('/')}>
              Ir al inicio
            </GlassButton>
          }
        />
      </GlassPanel>
    )
  }
  return <Detalle key={id} id={id ?? ''} />
}

type Dialogo = 'convertir' | 'rechazar' | 'eliminar' | null

function Detalle({ id }: { id: string }) {
  const { puede } = useSesion()
  const navegar = useNavigate()
  const ubicacion = useLocation()
  const listaQS = (ubicacion.state as { lista?: string } | null)?.lista ?? ''
  const consulta = useCotizacion(id)
  const config = useConfiguracion()
  const compartir = useCompartirCotizacion()
  const duplicar = useDuplicarCotizacion()
  const cambiar = useCambiarEstadoCotizacion()
  const hoy = useMemo(() => hoyISO(), [])
  const [enCurso, setEnCurso] = useState<'whatsapp' | 'pdf' | null>(null)
  const [dialogo, setDialogo] = useState<Dialogo>(null)

  const volver = () => navegar(`/cotizaciones${listaQS}`)

  if (consulta.isPending) return <EsqueletoDetalle />
  if (consulta.isError) {
    const noExiste = /no encontrada/i.test(consulta.error.message)
    return (
      <GlassPanel className="mt-2">
        <EstadoVacio
          icono={<FileSearch />}
          titulo={noExiste ? 'No encontramos esta cotización' : 'No se pudo abrir la cotización'}
          descripcion={noExiste ? 'Puede que se haya eliminado o que el enlace esté incompleto.' : `${consulta.error.message}. Revisa tu conexión e inténtalo de nuevo.`}
          accion={
            <div className="flex flex-wrap justify-center gap-2">
              <GlassButton variante="cristal" icono={<ArrowLeft />} onClick={volver}>
                Volver a cotizaciones
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

  const c = consulta.data
  const visible = estadoVisibleCotizacion(c, hoy)
  const dias = diasRestantes(c.fecha_vencimiento, hoy)
  const estado = ESTADO_COTIZACION[visible]
  const gestionar = puede('gestionar_cotizaciones')

  const compartirCon = async (tipo: 'whatsapp' | 'pdf', fn: (c: CotizacionCompleta) => Promise<void>) => {
    setEnCurso(tipo)
    try {
      await fn(c)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo generar el PDF. Inténtalo de nuevo.')
    } finally {
      setEnCurso(null)
    }
  }

  const duplicarCotizacion = async () => {
    try {
      const nuevo = await duplicar.mutateAsync(c.id)
      toast.success(`Copia de ${c.folio} creada como borrador`, { description: 'Tiene la fecha de hoy y una vigencia nueva.' })
      navegar(`/cotizaciones/${nuevo}`, { state: { lista: listaQS } })
    } catch {
      /* el hook ya muestra el error */
    }
  }

  const en: ManejadoresDetalle = {
    whatsapp: () => void compartirCon('whatsapp', compartir.enviarWhatsApp),
    pdf: () => void compartirCon('pdf', compartir.descargarPdf),
    editar: () => navegar(`/cotizaciones/${c.id}/editar`, { state: { lista: listaQS } }),
    duplicar: () => void duplicarCotizacion(),
    convertir: () => setDialogo('convertir'),
    verPedido: () => {
      const folio = c.pedido_folio ?? ''
      navigator.clipboard
        ?.writeText(folio)
        .then(() => toast.success(`Folio ${folio} copiado`, { description: 'Pégalo donde le des seguimiento al pedido.' }))
        .catch(() => toast(`Pedido ${folio}`))
    },
    marcar: async (nuevo: Extract<EstadoCotizacion, 'enviada' | 'aceptada'>) => {
      try {
        await cambiar.mutateAsync({ id: c.id, estado: nuevo })
        toast.success(nuevo === 'enviada' ? `${c.folio} marcada como enviada` : `${c.folio} marcada como aceptada`)
      } catch {
        /* el hook ya muestra el error */
      }
    },
    rechazar: () => setDialogo('rechazar'),
    eliminar: () => setDialogo('eliminar'),
  }

  const ocupado = compartir.trabajando || enCurso !== null
  const abrirDialogo = (d: Dialogo) => (abierto: boolean) => setDialogo(abierto ? d : null)

  return (
    <div className="flex flex-col gap-5 pt-1">
      {/* Encabezado + botones tipo Centro de Control */}
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <GlassIconButton etiqueta="Volver a cotizaciones" icono={<ArrowLeft />} tamano="sm" className="mt-0.5 size-11 shrink-0" onClick={volver} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="num text-sm font-semibold text-fg-muted">{c.folio}</span>
              <Pildora tono={estado.tono}>{estado.etiqueta}</Pildora>
              {c.pedido_folio ? (
                <Pildora tono="luz">
                  <span className="num">{c.pedido_folio}</span>
                </Pildora>
              ) : null}
            </div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-fg sm:text-2xl">{c.cliente.nombre}</h2>
            <p className="mt-0.5 text-base text-fg-muted">{c.titulo ?? 'Sin título'}</p>
          </div>
        </div>
        <BarraAcciones
          c={c}
          permisos={{ gestionar, convertir: puede('gestionar_pedidos') }}
          en={en}
          ocupado={{ whatsapp: enCurso === 'whatsapp', pdf: enCurso === 'pdf', duplicar: duplicar.isPending, bloqueado: ocupado }}
          className="xl:max-w-[36rem] xl:shrink-0"
        />
      </div>

      <Avisos c={c} visible={visible} gestionar={gestionar} onDuplicar={en.duplicar} duplicando={duplicar.isPending} />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <HojaCotizacion c={c} config={config.data} />
        <aside className="grid gap-4 md:grid-cols-2 xl:grid-cols-1" aria-label="Resumen de la cotización">
          <ModuloTotal c={c} visible={visible} dias={dias} />
          {puede('ver_costos') ? <ModuloCostos c={c} /> : null}
          <ModuloHistorial c={c} visible={visible} />
          {c.notas_internas ? <ModuloNotasInternas texto={c.notas_internas} /> : null}
        </aside>
      </div>

      <DialogoConvertir abierto={dialogo === 'convertir'} onCambio={abrirDialogo('convertir')} c={c} vencida={visible === 'vencida'} />
      <DialogoRechazar abierto={dialogo === 'rechazar'} onCambio={abrirDialogo('rechazar')} c={c} />
      <DialogoEliminar
        abierto={dialogo === 'eliminar'}
        onCambio={abrirDialogo('eliminar')}
        c={c}
        onEliminada={() => {
          toast.success(`Borrador ${c.folio} eliminado`)
          navegar(`/cotizaciones${listaQS}`, { replace: true })
        }}
      />
    </div>
  )
}

/** Avisos de estado que piden atención: convertida, vencida o rechazada. */
function Avisos({
  c,
  visible,
  gestionar,
  onDuplicar,
  duplicando,
}: {
  c: CotizacionCompleta
  visible: ReturnType<typeof estadoVisibleCotizacion>
  gestionar: boolean
  onDuplicar: () => void
  duplicando: boolean
}) {
  const reducir = useReducedMotion()
  const avisos: Array<{ clave: string; nodo: ReactNode }> = []

  if (c.pedido_folio) {
    avisos.push({
      clave: 'pedido',
      nodo: (
        <Aviso
          tono="luz"
          icono={<PackageCheck />}
          titulo={
            <>
              Convertida en el pedido <span className="num">{c.pedido_folio}</span>
            </>
          }
          texto={`La producción empieza al confirmar el anticipo de ${dinero(anticipoDe(c))}.`}
        />
      ),
    })
  } else if (visible === 'vencida') {
    avisos.push({
      clave: 'vencida',
      nodo: (
        <Aviso
          tono="aviso"
          icono={<AlarmClock />}
          titulo={`Venció el ${fechaLarga(c.fecha_vencimiento)}`}
          texto="Antes de reenviarla, revisa precios y vigencia. Una copia toma la fecha de hoy."
          accion={
            gestionar ? (
              <GlassButton variante="cristal" tamano="sm" icono={<CopyPlus />} cargando={duplicando} onClick={onDuplicar} className="h-11 px-4">
                Duplicar con fecha de hoy
              </GlassButton>
            ) : null
          }
        />
      ),
    })
  } else if (c.estado === 'rechazada') {
    avisos.push({
      clave: 'rechazada',
      nodo: <Aviso tono="peligro" icono={<XCircle />} titulo="El cliente rechazó esta cotización" texto={c.motivo_rechazo ? `Motivo: ${c.motivo_rechazo}` : 'Sin motivo registrado.'} />,
    })
  }

  return (
    <AnimatePresence initial={false}>
      {avisos.map((a) => (
        <motion.div
          key={a.clave}
          initial={reducir ? false : { opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          transition={resorte.suave}
        >
          {a.nodo}
        </motion.div>
      ))}
    </AnimatePresence>
  )
}

const tonosAviso = {
  luz: { superficie: 'bg-luz/[0.16] dark:bg-luz/[0.09]', pozo: 'bg-luz text-luz-fg shadow-[0_6px_20px_-6px_rgba(249,194,6,0.75)]' },
  aviso: { superficie: 'bg-warning-soft/70', pozo: 'bg-warning/15 text-warning' },
  peligro: { superficie: 'bg-danger-soft/60', pozo: 'bg-danger/15 text-danger' },
}

function Aviso({ tono, icono, titulo, texto, accion }: { tono: keyof typeof tonosAviso; icono: ReactNode; titulo: ReactNode; texto: string; accion?: ReactNode }) {
  const t = tonosAviso[tono]
  return (
    <GlassSurface role="status" className={cn('flex flex-col gap-3 rounded-module p-3 pr-4 sm:flex-row sm:items-center', t.superficie)}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className={cn('grid size-12 shrink-0 place-items-center rounded-full [&_svg]:size-[1.35rem]', t.pozo)} aria-hidden>
          {icono}
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-fg">{titulo}</p>
          <p className="text-sm text-fg-muted">{texto}</p>
        </div>
      </div>
      {accion ? <div className="shrink-0 pl-[3.75rem] sm:pl-0">{accion}</div> : null}
    </GlassSurface>
  )
}
