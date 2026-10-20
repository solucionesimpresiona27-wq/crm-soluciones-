import { FilePlus2, MessageCircle, Pencil, RotateCcw, SearchX, Send, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useSesion } from '@/app/sesion'
import { EstadoVacio, GlassButton, GlassIconButton, GlassModal, GlassSelect, GlassTextarea, Pildora, Skeleton } from '@/components/glass'
import { TIPOS_ACTIVIDAD, type TipoActividad } from '@/data/modulos/clientes/contrato'
import type { EtapaComercial, Oportunidad } from '@/data/modulos/embudo/contrato'
import { useWhatsAppCliente } from '@/features/clientes/piezas'
import { ESTADO_COTIZACION } from '@/lib/estados'
import { dinero, fecha, fechaLarga, haceCuanto } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useActividadesOportunidad, useEliminarOportunidad, useOportunidad, useRegistrarActividadOportunidad } from './consultas'
import { MenuMover } from './Tarjeta'
import { estadoAccion, etiquetaEtapa } from './util'

interface Props {
  id: string | null
  /** Datos del tablero para pintar al instante */
  previa: Oportunidad | null
  hoy: string
  onCerrar: () => void
  onEditar: (o: Oportunidad) => void
  onMover: (o: Oportunidad, e: EtapaComercial) => void
}

/** Cajón lateral con el detalle, actividades y cotizaciones ligadas. */
export function DetalleOportunidad({ id, previa, hoy, onCerrar, onEditar, onMover }: Props) {
  const { puede } = useSesion()
  const conPrecios = puede('ver_precios')
  const navegar = useNavigate()
  const detalle = useOportunidad(id)
  const o = (detalle.data ?? previa) as Oportunidad | null
  const actividades = useActividadesOportunidad(id, Boolean(o))
  const registrar = useRegistrarActividadOportunidad(o)
  const eliminar = useEliminarOportunidad()
  const wa = useWhatsAppCliente()
  const [tipo, setTipo] = useState<TipoActividad>('llamada')
  const [nota, setNota] = useState('')
  const [confirmar, setConfirmar] = useState(false)

  const enviarNota = (e: FormEvent) => {
    e.preventDefault()
    if (!nota.trim()) return toast.error('Escribe qué pasó para registrar la actividad')
    registrar.mutate(
      { tipo, descripcion: nota.trim() },
      { onSuccess: () => (setNota(''), toast.success('Actividad registrada')), onError: (e) => toast.error('No se pudo registrar', { description: e.message }) },
    )
  }

  const whatsapp = () => {
    if (!o) return
    wa.abrir({ nombre: o.cliente.nombre, whatsapp: o.cliente.whatsapp })
    toast(`Mensaje para ${o.cliente.nombre} listo en WhatsApp`, {
      description: '¿Lo enviaste? Regístralo en la actividad.',
      action: { label: 'Registrar', onClick: () => registrar.mutate({ tipo: 'whatsapp', descripcion: `Seguimiento por WhatsApp: ${o.titulo}` }) },
    })
  }

  const accion = o ? estadoAccion(o.proxima_accion_fecha, hoy) : null
  const cotizaciones = detalle.data && 'cotizaciones' in detalle.data ? detalle.data.cotizaciones : null

  return (
    <GlassModal
      abierto={Boolean(id)}
      onCambio={(a) => !a && onCerrar()}
      lateral
      ancho="md"
      titulo={o?.titulo ?? 'Oportunidad'}
      descripcion={
        o ? (
          <>
            <Link to={`/clientes/${o.cliente_id}`} className="font-semibold text-fg underline-offset-2 hover:underline">
              {o.cliente.nombre}
            </Link>
            {' · '}
            {etiquetaEtapa(o.etapa)}
          </>
        ) : undefined
      }
    >
      {!o && detalle.isError ? (
        <EstadoVacio
          icono={<SearchX />}
          titulo="No se pudo abrir la oportunidad"
          descripcion={`${detalle.error.message}. Puede que la hayan eliminado; revisa el tablero o vuelve a intentarlo.`}
          accion={
            <GlassButton icono={<RotateCcw />} onClick={() => void detalle.refetch()}>
              Reintentar
            </GlassButton>
          }
        />
      ) : !o ? (
        <div className="flex flex-col gap-3" role="status" aria-label="Cargando oportunidad">
          <Skeleton className="h-24 rounded-tile" />
          <Skeleton className="h-40 rounded-tile" />
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid auto-cols-fr grid-flow-col items-start justify-items-center gap-x-2 sm:flex sm:justify-start sm:gap-x-5">
            <GlassIconButton etiqueta="WhatsApp" mostrarEtiqueta icono={<MessageCircle />} destacado tono="luz" onClick={whatsapp} />
            {conPrecios ? (
              <GlassIconButton
                etiqueta="Cotizar"
                aria-label="Crear cotización"
                mostrarEtiqueta
                icono={<FilePlus2 />}
                onClick={() => navegar(`/cotizaciones/nueva?cliente=${o.cliente_id}&oportunidad=${o.id}`)}
              />
            ) : null}
            <GlassIconButton etiqueta="Editar" mostrarEtiqueta icono={<Pencil />} onClick={() => onEditar(o)} />
            {puede('eliminar_registros') ? (
              <GlassIconButton etiqueta="Eliminar" mostrarEtiqueta icono={<Trash2 />} onClick={() => setConfirmar(true)} />
            ) : null}
          </div>

          <dl className="glass glass-strong grid grid-cols-2 gap-x-4 gap-y-3 rounded-tile p-4 text-sm">
            {conPrecios ? (
              <div className="col-span-2">
                <dt className="text-xs text-fg-subtle">Valor estimado</dt>
                <dd className="num text-2xl font-semibold leading-tight tracking-tight text-fg">{o.valor_estimado != null ? dinero(o.valor_estimado) : 'Sin estimar'}</dd>
              </div>
            ) : null}
            <div className="col-span-2">
              <dt className="text-xs text-fg-subtle">Próxima acción</dt>
              <dd className={cn('font-medium text-fg', accion === 'atrasada' && 'text-warning')}>
                {o.proxima_accion || o.proxima_accion_fecha ? (
                  <>
                    {o.proxima_accion ?? 'Dar seguimiento'}
                    {o.proxima_accion_fecha ? <span className="num text-fg-muted"> · {fechaLarga(o.proxima_accion_fecha)}</span> : null}
                    {accion === 'atrasada' ? <Pildora tono="aviso" className="ml-2">Atrasada</Pildora> : accion === 'hoy' ? <Pildora tono="luz" className="ml-2">Hoy</Pildora> : null}
                  </>
                ) : (
                  <span className="text-fg-muted">Sin definir: edítala para no perder el seguimiento</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-fg-subtle">Responsable</dt>
              <dd className="text-fg">{o.responsable ?? 'Sin asignar'}</dd>
            </div>
            <div>
              <dt className="text-xs text-fg-subtle">Origen</dt>
              <dd className="text-fg">{o.origen ?? 'Sin indicar'}</dd>
            </div>
            {o.motivo_perdida ? (
              <div className="col-span-2">
                <dt className="text-xs text-fg-subtle">Motivo de pérdida</dt>
                <dd className="text-danger">{o.motivo_perdida}</dd>
              </div>
            ) : null}
            {o.descripcion ? (
              <div className="col-span-2">
                <dt className="text-xs text-fg-subtle">Descripción</dt>
                <dd className="whitespace-pre-line text-fg">{o.descripcion}</dd>
              </div>
            ) : null}
            <div className="col-span-2 flex items-center justify-between gap-3 border-t border-[var(--divider)] pt-3">
              <span className="text-xs text-fg-subtle">Creada {haceCuanto(o.created_at)}</span>
              <MenuMover oportunidad={o} onMover={(e) => onMover(o, e)} conTexto />
            </div>
          </dl>

          {conPrecios ? (
            <section aria-labelledby="cot-lig">
              <h3 id="cot-lig" className="mb-2 text-sm font-semibold text-fg">
                Cotizaciones ligadas
              </h3>
              {!cotizaciones ? (
                <Skeleton className="h-14 rounded-tile" />
              ) : cotizaciones.length ? (
                <ul className="flex flex-col gap-1.5">
                  {cotizaciones.map((c) => {
                    const est = ESTADO_COTIZACION[c.estado as keyof typeof ESTADO_COTIZACION]
                    return (
                      <li key={c.id}>
                        <Link to={`/cotizaciones/${c.id}`} className="glass glass-strong flex min-h-11 items-center gap-3 rounded-control px-3 py-2 text-sm outline-none hover:bg-[var(--control-bg-hover)]">
                          <span className="num font-semibold text-fg">{c.folio}</span>
                          <span className="min-w-0 flex-1 truncate text-fg-muted">{c.titulo ?? fecha(c.fecha)}</span>
                          {est ? <Pildora tono={est.tono}>{est.etiqueta}</Pildora> : null}
                          <span className="num font-semibold text-fg">{dinero(c.total)}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="text-sm text-fg-muted">Aún no hay cotizaciones para esta oportunidad.</p>
              )}
            </section>
          ) : null}

          <section aria-labelledby="act-op">
            <h3 id="act-op" className="mb-2 text-sm font-semibold text-fg">
              Seguimiento
            </h3>
            <form onSubmit={enviarNota} className="glass glass-strong mb-3 flex flex-col gap-2 rounded-tile p-3">
              <GlassTextarea aria-label="¿Qué pasó?" rows={2} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="¿Qué pasó? Ej. Le llamé, pide la cotización el lunes" />
              <div className="flex gap-2">
                <GlassSelect aria-label="Tipo de actividad" value={tipo} onChange={(e) => setTipo(e.target.value as TipoActividad)} className="flex-1">
                  {Object.entries(TIPOS_ACTIVIDAD).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </GlassSelect>
                <GlassButton type="submit" variante="primario" icono={<Send />} cargando={registrar.isPending}>
                  Registrar
                </GlassButton>
              </div>
            </form>
            {actividades.isPending ? (
              <Skeleton className="h-16 rounded-tile" />
            ) : actividades.isError ? (
              <p className="text-sm text-danger">No se pudo cargar el seguimiento: {actividades.error.message}</p>
            ) : actividades.data.length ? (
              <ol className="relative flex flex-col gap-3 border-l border-[var(--divider)] pl-4">
                {actividades.data.map((a) => (
                  <li key={a.id} className="relative">
                    <span className="absolute -left-[1.3rem] top-1.5 size-2 rounded-full bg-accent dark:bg-navy-300" aria-hidden />
                    <p className="text-xs text-fg-subtle">
                      <span className="font-semibold text-fg-muted">{TIPOS_ACTIVIDAD[a.tipo as TipoActividad] ?? a.tipo}</span> · {haceCuanto(a.fecha)}
                      {a.usuario ? ` · ${a.usuario}` : ''}
                    </p>
                    <p className="whitespace-pre-line text-sm text-fg">{a.descripcion}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-fg-muted">Sin actividades todavía. Registra la primera llamada o mensaje.</p>
            )}
          </section>
        </div>
      )}

      <GlassModal
        abierto={confirmar}
        onCambio={setConfirmar}
        ancho="sm"
        titulo="¿Eliminar esta oportunidad?"
        descripcion="Se borra del embudo. Sus actividades y cotizaciones se conservan sin ligarse. No se puede deshacer."
        pie={
          <>
            <GlassButton variante="fantasma" onClick={() => setConfirmar(false)}>
              Cancelar
            </GlassButton>
            <GlassButton
              variante="peligro"
              cargando={eliminar.isPending}
              onClick={() =>
                o &&
                eliminar.mutate(o.id, {
                  onSuccess: () => (setConfirmar(false), onCerrar(), toast.success('Oportunidad eliminada')),
                  onError: (e) => toast.error('No se pudo eliminar', { description: e.message }),
                })
              }
            >
              Eliminar oportunidad
            </GlassButton>
          </>
        }
      >
        <span />
      </GlassModal>
    </GlassModal>
  )
}
