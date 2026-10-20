import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarDays, CalendarX2, MessageCircle, Wrench } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSesion } from '@/app/sesion'
import { GlassIconButton, Pildora, SegmentedControl } from '@/components/glass'
import type { DashboardResumen, EntregaProxima } from '@/data/tipos'
import { ESTADO_PEDIDO } from '@/lib/estados'
import { resorte } from '@/lib/motion'
import { enlaceWhatsApp } from '@/lib/whatsapp'
import { cn } from '@/lib/utils'
import { Modulo, TituloModulo } from './Modulo'
import { aFecha, cuandoEntrega, diasHasta, pesos } from './util'

type Vista = 'entregas' | 'seguimientos'
type Seguimiento = NonNullable<DashboardResumen['seguimientos']>[number]

const MAX_FILAS = 4

/** Ficha de fecha: el día de hoy se "enciende" con la luz amarilla. */
function FichaFecha({ fecha, hoy }: { fecha: string; hoy: string }) {
  const d = diasHasta(fecha, hoy)
  const f = aFecha(fecha)
  return (
    <span
      className={cn(
        'grid h-12 w-11 shrink-0 place-content-center rounded-chip text-center leading-none',
        d === 0 && 'bg-luz text-luz-fg shadow-[0_6px_18px_-8px_rgba(249,194,6,0.9),inset_0_1px_0_rgba(255,255,255,0.6)]',
        d < 0 && 'bg-danger-soft text-danger',
        d > 0 && 'bg-[var(--control-bg)] text-fg shadow-[inset_0_1px_0_var(--inner-hi)]',
      )}
      aria-hidden
    >
      {/* El día de la semana va arriba, como en un calendario: "mar 20" se lee martes, no marzo.
          Fuera de esta semana el día de la semana ya no ubica la fecha: se muestra el mes. */}
      <span className="text-2xs font-medium opacity-80">
        {d === 0 ? 'hoy' : format(f, Math.abs(d) > 6 ? 'MMM' : 'EEE', { locale: es }).replace('.', '')}
      </span>
      <span className="mt-0.5 text-md font-semibold">{format(f, 'd')}</span>
    </span>
  )
}

function FilaEntrega({ e, hoy }: { e: EntregaProxima; hoy: string }) {
  const info = ESTADO_PEDIDO[e.estado]
  const cuando = cuandoEntrega(e.fecha_entrega, hoy)
  return (
    <li className="flex items-center gap-3">
      <FichaFecha fecha={e.fecha_entrega} hoy={hoy} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-fg">{e.cliente}</p>
        <p className="flex min-w-0 items-center gap-1.5 text-xs text-fg-muted">
          <span className={cn('shrink-0 font-medium', cuando.atrasado && 'text-danger')}>{cuando.texto}</span>
          <span className="truncate">
            <span className="num">{e.folio}</span> {e.titulo}
          </span>
        </p>
      </div>
      {e.requiere_instalacion ? (
        <>
          <span
            className="hidden size-7 shrink-0 place-items-center rounded-full bg-[var(--control-bg)] text-fg-muted shadow-[inset_0_1px_0_var(--inner-hi)] sm:grid"
            title="Lleva instalación"
            aria-hidden
          >
            <Wrench className="size-3.5" />
          </span>
          <span className="sr-only">Lleva instalación.</span>
        </>
      ) : null}
      <Pildora tono={info.tono} className="shrink-0">
        {info.corto}
      </Pildora>
    </li>
  )
}

function FilaSeguimiento({ s, hoy, verMontos, vendedor }: { s: Seguimiento; hoy: string; verMontos: boolean; vendedor: string }) {
  const d = diasHasta(s.proxima_accion_fecha, hoy)
  const cuando = d < 0 ? (d === -1 ? 'Desde ayer' : `Hace ${-d} días`) : d === 0 ? 'Hoy' : d === 1 ? 'Mañana' : `En ${d} días`
  const texto = `Hola, ¿cómo estás? Soy ${vendedor} de Soluciones Impresiona. Te escribo para dar seguimiento a "${s.titulo}". ¿Tienes alguna duda o comentario?`
  return (
    <li className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2">
          <span className="truncate text-sm font-semibold text-fg">{s.cliente}</span>
          {verMontos && s.valor_estimado ? <span className="shrink-0 text-xs font-medium text-fg-subtle">{pesos(s.valor_estimado)}</span> : null}
        </p>
        <p className="flex min-w-0 items-center gap-1.5 text-xs text-fg-muted">
          <span className={cn('shrink-0 font-medium', d < 0 ? 'text-danger' : d === 0 ? 'text-fg' : undefined)}>{cuando}</span>
          <span className="truncate">{s.proxima_accion ?? s.titulo}</span>
        </p>
      </div>
      <GlassIconButton
        etiqueta={`Escribir por WhatsApp a ${s.cliente}`}
        title="Escribir por WhatsApp"
        icono={<MessageCircle />}
        tamano="md"
        onClick={() => window.open(enlaceWhatsApp(s.whatsapp, texto), '_blank', 'noopener,noreferrer')}
      />
    </li>
  )
}

/** Agenda: próximas entregas e instalaciones y, para ventas, los seguimientos comerciales. */
export function AgendaModulo({ r }: { r: DashboardResumen }) {
  const { sesion, puede } = useSesion()
  const reducir = useReducedMotion()
  const seguimientos = r.seguimientos ?? []
  const conSeguimientos = seguimientos.length > 0
  const [vista, setVista] = useState<Vista>('entregas')
  const idPanel = useId()
  const entregas = r.entregas_proximas
  const actual: Vista = conSeguimientos ? vista : 'entregas'
  const total = actual === 'entregas' ? entregas.length : seguimientos.length
  const visibles = actual === 'entregas' ? MAX_FILAS : MAX_FILAS - 1
  const nombre = sesion?.perfil.nombre.split(' ')[0] ?? 'tu asesor'

  return (
    <Modulo etiqueta="Agenda" className="flex flex-col">
      <TituloModulo
        icono={<CalendarDays />}
        extra={
          total > visibles ? (
            <Link to={actual === 'entregas' ? '/agenda' : '/embudo'} className="-my-2 inline-flex h-11 items-center rounded-full px-3 text-xs font-semibold text-accent outline-none transition-colors hover:bg-[var(--control-bg)] dark:text-navy-200">
              Ver las {total}
            </Link>
          ) : null
        }
      >
        Agenda
      </TituloModulo>

      {conSeguimientos ? (
        <SegmentedControl<Vista>
          etiqueta="Ver en la agenda"
          valor={actual}
          onCambio={setVista}
          idPanel={idPanel}
          className="mt-3 self-start"
          segmentos={[
            { valor: 'entregas', etiqueta: 'Entregas', conteo: entregas.length },
            { valor: 'seguimientos', etiqueta: 'Seguimientos', conteo: seguimientos.length },
          ]}
        />
      ) : (
        <p className="mt-1 text-xs text-fg-subtle">Entregas e instalaciones de los próximos 7 días</p>
      )}

      <div
        id={idPanel}
        className="relative mt-4 min-h-0 flex-1"
        {...(conSeguimientos ? { role: 'tabpanel', 'aria-label': actual === 'entregas' ? 'Entregas' : 'Seguimientos' } : {})}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={actual}
            initial={reducir ? false : { opacity: 0, x: actual === 'entregas' ? -18 : 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reducir ? undefined : { opacity: 0, x: actual === 'entregas' ? -18 : 18 }}
            transition={resorte.agil}
          >
            {actual === 'entregas' ? (
              entregas.length ? (
                <ul className="flex flex-col gap-3">
                  {entregas.slice(0, visibles).map((e) => (
                    <FilaEntrega key={e.id} e={e} hoy={r.hoy} />
                  ))}
                </ul>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 py-6 text-center">
                  <CalendarX2 className="size-6 text-fg-subtle" aria-hidden />
                  <p className="text-sm font-medium text-fg">Sin entregas esta semana</p>
                  <p className="text-xs text-fg-muted">Las fechas de entrega de los pedidos aparecen aquí.</p>
                </div>
              )
            ) : (
              <ul className="flex flex-col gap-2.5">
                {seguimientos.slice(0, visibles).map((s) => (
                  <FilaSeguimiento key={s.id} s={s} hoy={r.hoy} verMontos={puede('ver_precios')} vendedor={nombre} />
                ))}
              </ul>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </Modulo>
  )
}
