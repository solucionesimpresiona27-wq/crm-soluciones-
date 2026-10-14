import { useQueryClient } from '@tanstack/react-query'
import { Check, CheckCircle2, ExternalLink, FileImage, MessageSquareText, Truck } from 'lucide-react'
import { useRef, useState } from 'react'
import { Campo, GlassButton, GlassInput, GlassModal, GlassPanel, GlassTextarea, Pildora, Skeleton } from '@/components/glass'
import { api } from '@/data/api'
import type { ArchivoPortal, DisenoPortal, VistaPortal } from '@/data/modulos/portal/contrato'
import { ESTADO_PEDIDO } from '@/lib/estados'
import { dinero, fecha, fechaLarga } from '@/lib/format'
import { cn } from '@/lib/utils'
import { clavePortal, useArchivosPortal } from './consultas'
import { Conceptos, ContactoEmpresa, Fila, Foco, LIMITE_COMENTARIO, LIMITE_NOMBRE, TituloSeccion } from './piezas'

type Ped = NonNullable<VistaPortal['pedido']>

const ESTADO_ARCHIVO: Record<string, { etiqueta: string; tono: 'luz' | 'exito' | 'aviso' | 'neutro' }> = {
  pendiente: { etiqueta: 'Espera tu revisión', tono: 'luz' },
  aprobado: { etiqueta: 'Aprobado', tono: 'exito' },
  cambios: { etiqueta: 'Cambios pedidos', tono: 'aviso' },
  rechazado: { etiqueta: 'Cambios pedidos', tono: 'aviso' },
}

export function VistaPedido({ token, vista }: { token: string; vista: VistaPortal }) {
  const p = vista.pedido as Ped
  const pendientes = p.disenos.filter((d) => d.puede_responder)
  const conArchivo = p.disenos.some((d) => d.tiene_archivo)
  const archivos = useArchivosPortal(token, conArchivo)
  const [respuesta, setRespuesta] = useState<{ diseno: DisenoPortal; aprobado: boolean } | null>(null)

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <div className="grid min-w-0 gap-4">
        <GlassPanel className="rounded-sheet p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <span className="num text-sm font-semibold text-fg-muted">{p.folio}</span>
            <Pildora tono={ESTADO_PEDIDO[p.estado].tono}>{ESTADO_PEDIDO[p.estado].etiqueta}</Pildora>
          </div>
          <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight text-fg sm:text-3xl">{p.titulo}</h1>
          <p className="mt-1 text-sm text-fg-muted">Para {p.cliente}</p>

          <div className="mt-6 flex items-center gap-3 rounded-tile bg-accent-soft/40 p-4">
            <Truck className="size-5 shrink-0 text-accent" aria-hidden />
            <div>
              <p className="text-xs font-medium text-fg-muted">{p.entregado_at ? 'Entregado' : 'Fecha de entrega'}</p>
              <p className="font-semibold text-fg">
                {p.entregado_at ? fechaLarga(p.entregado_at) : p.fecha_entrega ? fechaLarga(p.fecha_entrega) : 'Por confirmar'}
                {p.requiere_instalacion && !p.entregado_at ? <span className="font-normal text-fg-muted"> · con instalación</span> : null}
              </p>
            </div>
          </div>

          <LineaEtapas p={p} />
        </GlassPanel>

        {p.disenos.length ? (
          <GlassPanel className="rounded-module p-5 sm:p-6">
            <TituloSeccion extra={pendientes.length ? <Pildora tono="luz">{pendientes.length === 1 ? '1 por revisar' : `${pendientes.length} por revisar`}</Pildora> : null}>
              Pruebas de diseño
            </TituloSeccion>
            <p className="mt-1 text-sm text-fg-muted">Revisa textos, colores y medidas antes de imprimir. Después de aprobar ya no se pueden hacer cambios sin costo.</p>
            <ul className="mt-4 grid gap-3">
              {p.disenos.map((d) => (
                <Diseno
                  key={d.id}
                  d={d}
                  archivo={archivos.data?.find((a) => a.id === d.id)}
                  cargando={archivos.isLoading && d.tiene_archivo}
                  onResponder={(aprobado) => setRespuesta({ diseno: d, aprobado })}
                />
              ))}
            </ul>
          </GlassPanel>
        ) : null}

        <GlassPanel className="rounded-module p-5 sm:p-6">
          <TituloSeccion>Conceptos</TituloSeccion>
          <div className="mt-2">
            <Conceptos partidas={p.partidas} />
          </div>
        </GlassPanel>
      </div>

      <div className="grid gap-4 lg:sticky lg:top-6">
        <GlassPanel className="rounded-module p-5 sm:p-6">
          <p className="text-sm font-medium text-fg-muted">{p.saldo > 0 ? 'Saldo pendiente' : 'Pedido pagado'}</p>
          <p className="glass-text num text-[2.25rem] font-semibold leading-[1.1] tracking-tight">{dinero(p.saldo > 0 ? p.saldo : p.total)}</p>
          <dl className="mt-3 divide-y divide-[var(--divider)] border-t border-[var(--divider)]">
            <Fila etiqueta="Total del pedido">{dinero(p.total)}</Fila>
            <Fila etiqueta="Pagado">{dinero(p.pagado)}</Fila>
            {p.saldo > 0 ? (
              <Fila etiqueta="Saldo" fuerte>
                {dinero(p.saldo)}
              </Fila>
            ) : null}
          </dl>
          {p.condiciones ? <p className="mt-3 whitespace-pre-line text-xs leading-relaxed text-fg-subtle">{p.condiciones}</p> : null}
        </GlassPanel>
        <ContactoEmpresa empresa={vista.empresa} folio={p.folio} />
      </div>

      <ResponderModal token={token} respuesta={respuesta} onCerrar={() => setRespuesta(null)} />
    </div>
  )
}

/** Línea de etapas: vertical en celular, horizontal en escritorio. */
function LineaEtapas({ p }: { p: Ped }) {
  const etapas = p.etapas.length ? p.etapas : [p.estado]
  const actual = etapas.indexOf(p.estado)
  const fechaDe = (e: string) => p.linea_tiempo.find((x) => x.estado === e)?.fecha
  if (p.estado === 'cancelado' || p.estado === 'pausado') {
    return <p className="mt-5 text-sm text-fg-muted">{p.estado === 'pausado' ? 'Tu pedido está en pausa. Escríbenos si tienes dudas.' : 'Este pedido fue cancelado.'}</p>
  }
  return (
    <ol className="mt-6 grid gap-0 sm:flex sm:items-start" aria-label="Etapas del pedido">
      {etapas.map((e, i) => {
        const hecho = i < actual
        const ahora = i === actual
        const f = fechaDe(e)
        return (
          <li key={e} className="relative flex items-start gap-3 pb-4 last:pb-0 sm:flex-1 sm:flex-col sm:items-center sm:gap-2 sm:pb-0 sm:text-center" aria-current={ahora ? 'step' : undefined}>
            {i < etapas.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  'absolute left-[11px] top-6 h-[calc(100%-1.25rem)] w-0.5 sm:left-[calc(50%+14px)] sm:top-[11px] sm:h-0.5 sm:w-[calc(100%-28px)]',
                  hecho ? 'bg-accent' : 'bg-[var(--divider)]',
                )}
              />
            ) : null}
            <span
              className={cn(
                'relative grid size-6 shrink-0 place-items-center rounded-full text-[0.7rem] font-bold',
                hecho && 'bg-accent text-accent-fg',
                ahora && 'bg-luz text-luz-fg shadow-[0_0_0_4px_rgb(var(--luz)/0.25)]',
                !hecho && !ahora && 'glass glass-thick text-fg-subtle',
              )}
            >
              {hecho ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : i + 1}
            </span>
            <span className="min-w-0">
              <span className={cn('block text-sm leading-tight', ahora ? 'font-semibold text-fg' : hecho ? 'text-fg-muted' : 'text-fg-subtle')}>
                <span className="sm:hidden">{ESTADO_PEDIDO[e].etiqueta}</span>
                <span className="hidden sm:inline">{ESTADO_PEDIDO[e].corto}</span>
              </span>
              {f && (hecho || ahora) ? <span className="num block text-xs text-fg-subtle">{fecha(f)}</span> : null}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function Diseno({ d, archivo, cargando, onResponder }: { d: DisenoPortal; archivo?: ArchivoPortal; cargando: boolean; onResponder: (aprobado: boolean) => void }) {
  const imagen = archivo && d.mime?.startsWith('image/')
  const est = ESTADO_ARCHIVO[d.estado_aprobacion] ?? ESTADO_ARCHIVO.pendiente
  const ver = archivo?.url ?? d.enlace_externo
  return (
    <li className={cn('glass glass-clear rounded-tile p-3 sm:p-4', d.puede_responder && 'ring-1 ring-luz/60')}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="grid aspect-[4/3] w-full shrink-0 place-items-center overflow-hidden rounded-control bg-accent-soft/30 sm:w-44">
          {cargando ? (
            <Skeleton className="size-full" />
          ) : imagen ? (
            <img src={archivo.url} alt={`Vista previa de ${d.nombre}`} className="size-full object-contain" loading="lazy" referrerPolicy="no-referrer" />
          ) : (
            <FileImage className="size-8 text-fg-subtle" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 truncate font-medium text-fg">{d.nombre}</p>
            {d.version ? <span className="num text-xs text-fg-subtle">v{d.version}</span> : null}
          </div>
          <Pildora tono={est.tono} className="mt-1.5">
            {est.etiqueta}
          </Pildora>
          {d.aprobado_por_nombre && d.aprobacion_at ? (
            <p className="mt-1.5 text-xs text-fg-subtle">
              {d.aprobado_por_nombre}, {fecha(d.aprobacion_at)}
            </p>
          ) : null}
          {ver ? (
            <a
              href={ver}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-full text-sm font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <ExternalLink className="size-4" aria-hidden />
              Ver en grande
            </a>
          ) : null}
          {d.puede_responder ? (
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <GlassButton variante="primario" icono={<CheckCircle2 />} onClick={() => onResponder(true)}>
                Aprobar diseño
              </GlassButton>
              <GlassButton variante="cristal" icono={<MessageSquareText />} onClick={() => onResponder(false)}>
                Pedir cambios
              </GlassButton>
            </div>
          ) : null}
        </div>
      </div>
    </li>
  )
}

function ResponderModal({ token, respuesta, onCerrar }: { token: string; respuesta: { diseno: DisenoPortal; aprobado: boolean } | null; onCerrar: () => void }) {
  const qc = useQueryClient()
  const [nombre, setNombre] = useState('')
  const [comentario, setComentario] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [listo, setListo] = useState<boolean | null>(null)
  const enCurso = useRef(false)
  const aprobado = respuesta?.aprobado ?? true

  function cerrar() {
    if (enviando) return
    setError(null)
    setComentario('')
    setListo(null)
    onCerrar()
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!respuesta || enCurso.current) return
    const n = nombre.trim()
    const c = comentario.trim()
    if (n.length < 2) return setError('Escribe tu nombre (al menos 2 letras).')
    if (!aprobado && c.length < 3) return setError('Cuéntanos qué cambios necesitas.')
    enCurso.current = true
    setEnviando(true)
    setError(null)
    try {
      await api.portal.responderDiseno(token, respuesta.diseno.id, aprobado, n.slice(0, LIMITE_NOMBRE), c.slice(0, LIMITE_COMENTARIO) || undefined)
      setListo(aprobado)
      await qc.invalidateQueries({ queryKey: clavePortal(token) })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos enviar tu respuesta. Intenta de nuevo en un momento.')
    } finally {
      enCurso.current = false
      setEnviando(false)
    }
  }

  return (
    <GlassModal
      abierto={!!respuesta}
      onCambio={(v) => !v && cerrar()}
      titulo={listo !== null ? (listo ? 'Diseño aprobado' : 'Cambios enviados') : aprobado ? 'Aprobar diseño' : 'Pedir cambios'}
      descripcion={listo === null ? respuesta?.diseno.nombre : undefined}
      ancho="sm"
    >
      {listo !== null ? (
        <div className="grid justify-items-center gap-3 py-2 text-center">
          <Foco encendido={listo} />
          <p className="text-sm text-fg-muted">{listo ? 'Gracias. Pasamos tu diseño a producción.' : 'Gracias. Te enviaremos una nueva prueba con los cambios.'}</p>
          <GlassButton variante="primario" onClick={cerrar} className="mt-1">
            Listo
          </GlassButton>
        </div>
      ) : (
        <form onSubmit={enviar} className="grid gap-4" noValidate>
          <Campo etiqueta="Tu nombre">
            {(id, p) => <GlassInput id={id} {...p} value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={LIMITE_NOMBRE} autoComplete="name" placeholder="Nombre y apellido" />}
          </Campo>
          <Campo etiqueta={aprobado ? 'Comentario' : '¿Qué cambiamos?'} opcional={aprobado} ayuda={`${comentario.length}/${LIMITE_COMENTARIO}`}>
            {(id, p) => (
              <GlassTextarea
                id={id}
                {...p}
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                maxLength={LIMITE_COMENTARIO}
                rows={4}
                placeholder={aprobado ? 'Algo que debamos saber' : 'Ej. cambiar el teléfono y hacer el logo más grande'}
              />
            )}
          </Campo>
          {error ? (
            <p role="alert" className="rounded-tile bg-danger-soft/50 p-3 text-sm font-medium text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <GlassButton variante="fantasma" onClick={cerrar} disabled={enviando}>
              Volver
            </GlassButton>
            <GlassButton type="submit" variante="primario" cargando={enviando} icono={aprobado ? <CheckCircle2 /> : <MessageSquareText />}>
              {aprobado ? 'Sí, aprobar diseño' : 'Enviar cambios'}
            </GlassButton>
          </div>
        </form>
      )}
    </GlassModal>
  )
}
