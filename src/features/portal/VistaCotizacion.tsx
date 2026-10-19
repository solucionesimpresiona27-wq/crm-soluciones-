import { useQueryClient } from '@tanstack/react-query'
import { CalendarClock, CheckCircle2, Clock, PackageCheck } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { AnimatedNumber, Campo, GlassButton, GlassInput, GlassModal, GlassPanel, GlassTextarea, Pildora } from '@/components/glass'
import { api } from '@/data/api'
import { COTIZACION_ACTUALIZADA, type VistaPortal } from '@/data/modulos/portal/contrato'
import { ESTADO_COTIZACION } from '@/lib/estados'
import { cantidad, dinero, fecha, fechaLarga } from '@/lib/format'
import { resorte } from '@/lib/motion'
import { clavePortal } from './consultas'
import { Conceptos, ContactoEmpresa, Fila, Foco, LIMITE_COMENTARIO, LIMITE_NOMBRE, TituloSeccion } from './piezas'

type Cot = NonNullable<VistaPortal['cotizacion']>

export function VistaCotizacion({ token, vista }: { token: string; vista: VistaPortal }) {
  const c = vista.cotizacion as Cot
  const reducir = useReducedMotion()
  const [abierto, setAbierto] = useState(false)
  const aprobada = c.estado === 'aceptada' || !!c.aprobacion
  const estado = c.estado === 'enviada' && !c.vigente ? 'vencida' : c.estado

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <div className="grid min-w-0 gap-4">
        {/* Encabezado + total: la cifra protagonista */}
        <GlassPanel className="rounded-sheet p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <span className="num text-sm font-semibold text-fg-muted">{c.folio}</span>
            <Pildora tono={ESTADO_COTIZACION[estado].tono}>{ESTADO_COTIZACION[estado].etiqueta}</Pildora>
          </div>
          <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight text-fg sm:text-3xl">{c.titulo || 'Tu cotización'}</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Para {c.cliente}
            {c.vendedor ? ` · te atiende ${c.vendedor}` : ''}
          </p>
          <p className="mt-6 text-sm font-medium text-fg-muted">Total</p>
          <AnimatedNumber valor={c.total} formato={dinero} className="glass-text num block text-[2.75rem] font-semibold leading-[1.05] tracking-tight" />
          <p className="mt-1 text-xs text-fg-subtle">{c.aplica_iva ? `IVA incluido (${cantidad(c.iva_pct)} %)` : 'Precios sin IVA'}</p>
          <dl className="mt-5 grid grid-cols-2 items-start gap-3 sm:grid-cols-3">
            <Dato icono={<CalendarClock />} etiqueta="Fecha" valor={fecha(c.fecha)} />
            <Dato icono={<Clock />} etiqueta="Vigente hasta" valor={fecha(c.fecha_vencimiento)} aviso={!c.vigente} />
            {c.tiempo_entrega ? <Dato icono={<PackageCheck />} etiqueta="Entrega" valor={c.tiempo_entrega} /> : null}
          </dl>
        </GlassPanel>

        <GlassPanel className="rounded-module p-5 sm:p-6">
          <TituloSeccion>Conceptos</TituloSeccion>
          <div className="mt-2">
            <Conceptos partidas={c.partidas} />
          </div>
          <dl className="mt-3 divide-y divide-[var(--divider)] border-t border-[var(--divider)]">
            <Fila etiqueta="Subtotal">{dinero(c.subtotal)}</Fila>
            {c.descuento > 0 ? <Fila etiqueta="Descuento">−{dinero(c.descuento)}</Fila> : null}
            {c.recargo > 0 ? <Fila etiqueta={c.recargo_concepto || 'Recargo'}>{dinero(c.recargo)}</Fila> : null}
            {c.aplica_iva ? <Fila etiqueta={`IVA (${cantidad(c.iva_pct)} %)`}>{dinero(c.iva)}</Fila> : null}
            <Fila etiqueta="Total" fuerte>
              {dinero(c.total)}
            </Fila>
            {c.anticipo_pct > 0 ? <Fila etiqueta={`Anticipo para iniciar (${cantidad(c.anticipo_pct)} %)`}>{dinero(c.anticipo)}</Fila> : null}
          </dl>
        </GlassPanel>

        {c.condiciones || c.notas ? (
          <GlassPanel className="rounded-module p-5 sm:p-6">
            <TituloSeccion>Condiciones</TituloSeccion>
            {c.condiciones ? <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-fg-muted">{c.condiciones}</p> : null}
            {c.notas ? <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-fg-muted">{c.notas}</p> : null}
          </GlassPanel>
        ) : null}
      </div>

      <div className="grid gap-4 lg:sticky lg:top-6">
        {/* Aprobación */}
        <GlassPanel className="rounded-module p-5 sm:p-6" aria-live="polite">
          <div className="flex items-center gap-4">
            <Foco encendido={aprobada} />
            <div className="min-w-0">
              {aprobada ? (
                <>
                  <p className="text-lg font-semibold leading-tight text-fg">Cotización aprobada</p>
                  <p className="mt-0.5 text-sm text-fg-muted">
                    {c.aprobacion ? `Por ${c.aprobacion.nombre}, ${fechaLarga(c.aprobacion.fecha)}.` : c.aceptada_at ? `El ${fechaLarga(c.aceptada_at)}.` : 'Gracias por tu confianza.'}
                  </p>
                </>
              ) : c.puede_aprobar ? (
                <>
                  <p className="text-lg font-semibold leading-tight text-fg">¿Todo en orden?</p>
                  <p className="mt-0.5 text-sm text-fg-muted">Aprueba la cotización y empezamos a trabajar en tu pedido.</p>
                </>
              ) : (
                <>
                  <p className="text-lg font-semibold leading-tight text-fg">{c.vigente ? 'Esta cotización no se puede aprobar aquí' : 'Esta cotización ya venció'}</p>
                  <p className="mt-0.5 text-sm text-fg-muted">Escríbenos y te enviamos una actualizada.</p>
                </>
              )}
            </div>
          </div>
          {aprobada ? (
            <motion.p
              initial={reducir ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={resorte.suave}
              className="mt-4 flex items-start gap-2 rounded-tile bg-luz-soft/60 p-3 text-sm text-fg"
            >
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-fg" aria-hidden />
              Te contactaremos para coordinar el anticipo y los detalles de tu pedido.
            </motion.p>
          ) : c.puede_aprobar ? (
            <GlassButton variante="primario" tamano="lg" className="mt-5 w-full" icono={<CheckCircle2 />} onClick={() => setAbierto(true)}>
              Aprobar cotización
            </GlassButton>
          ) : null}
        </GlassPanel>

        <ContactoEmpresa empresa={vista.empresa} folio={c.folio} />
      </div>

      <AprobarModal token={token} c={c} abierto={abierto} onCambio={setAbierto} />
    </div>
  )
}

function Dato({ icono, etiqueta, valor, aviso }: { icono: React.ReactNode; etiqueta: string; valor: string; aviso?: boolean }) {
  return (
    <div className="glass glass-clear rounded-tile px-3.5 py-3">
      <dt className="flex items-center gap-1.5 text-xs text-fg-muted [&_svg]:size-3.5">
        {icono}
        {etiqueta}
      </dt>
      <dd className={aviso ? 'mt-0.5 font-semibold text-warning' : 'mt-0.5 font-semibold text-fg'}>{valor}</dd>
    </div>
  )
}

function AprobarModal({ token, c, abierto, onCambio }: { token: string; c: Cot; abierto: boolean; onCambio: (v: boolean) => void }) {
  const qc = useQueryClient()
  const [nombre, setNombre] = useState('')
  const [comentario, setComentario] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const enCurso = useRef(false)
  const nombreLimpio = nombre.trim()
  const valido = nombreLimpio.length >= 2

  async function aprobar(e: React.FormEvent) {
    e.preventDefault()
    if (!valido) {
      setError('Escribe tu nombre completo (al menos 2 letras) para aprobar.')
      return
    }
    if (enCurso.current) return
    enCurso.current = true
    setEnviando(true)
    setError(null)
    try {
      const r = await api.portal.aprobarCotizacion(token, c.version, nombreLimpio.slice(0, LIMITE_NOMBRE), comentario.trim().slice(0, LIMITE_COMENTARIO) || undefined)
      qc.setQueryData<VistaPortal>(clavePortal(token), (v) =>
        v?.cotizacion
          ? { ...v, cotizacion: { ...v.cotizacion, estado: r.estado, puede_aprobar: false, aprobacion: { nombre: nombreLimpio, fecha: new Date().toISOString() } } }
          : v,
      )
      onCambio(false)
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : 'No pudimos registrar tu aprobación. Intenta de nuevo en un momento.'
      if (mensaje === COTIZACION_ACTUALIZADA) {
        // Trae la versión actual; el diálogo se cierra para que el cliente la revise antes de aprobar
        await qc.invalidateQueries({ queryKey: clavePortal(token) })
        toast.warning('La cotización cambió', { description: COTIZACION_ACTUALIZADA })
        onCambio(false)
        return
      }
      setError(mensaje)
    } finally {
      enCurso.current = false
      setEnviando(false)
    }
  }

  return (
    <GlassModal
      abierto={abierto}
      onCambio={(v) => !enviando && onCambio(v)}
      titulo="Aprobar cotización"
      descripcion={`Confirmas los conceptos, el total de ${dinero(c.total)} y las condiciones de ${c.folio}.`}
      ancho="sm"
    >
      <form onSubmit={aprobar} className="grid gap-4" noValidate>
        <Campo etiqueta="Tu nombre" error={error && !valido ? error : null}>
          {(id, p) => (
            <GlassInput id={id} {...p} value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={LIMITE_NOMBRE} autoComplete="name" placeholder="Nombre y apellido" autoFocus />
          )}
        </Campo>
        <Campo etiqueta="Comentario" opcional ayuda={`${comentario.length}/${LIMITE_COMENTARIO}`}>
          {(id, p) => (
            <GlassTextarea id={id} {...p} value={comentario} onChange={(e) => setComentario(e.target.value)} maxLength={LIMITE_COMENTARIO} rows={3} placeholder="Algo que debamos saber" />
          )}
        </Campo>
        {error && valido ? (
          <p role="alert" className="rounded-tile bg-danger-soft/50 p-3 text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <GlassButton variante="fantasma" onClick={() => onCambio(false)} disabled={enviando}>
            Volver
          </GlassButton>
          <GlassButton type="submit" variante="primario" icono={<CheckCircle2 />} cargando={enviando}>
            Sí, aprobar cotización
          </GlassButton>
        </div>
      </form>
    </GlassModal>
  )
}
