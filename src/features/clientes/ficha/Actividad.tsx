import { formatDistanceToNowStrict, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarCheck, Mail, MessageCircle, NotebookPen, Phone, Trash2, Users } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'
import { useSesion } from '@/app/sesion'
import { GlassButton, GlassPanel, GlassTextarea, Skeleton } from '@/components/glass'
import { TIPOS_ACTIVIDAD, type Actividad as ActividadT, type TipoActividad } from '@/data/modulos/clientes/contrato'
import { fecha } from '@/lib/format'
import { resorte } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { useActividades, useEliminarActividad, useRegistrarActividad } from '../consultas'
import { TituloModulo } from './Modulos'

export const ICONO_ACTIVIDAD: Record<TipoActividad, ReactNode> = {
  nota: <NotebookPen />,
  llamada: <Phone />,
  whatsapp: <MessageCircle />,
  correo: <Mail />,
  visita: <CalendarCheck />,
  reunion: <Users />,
}

const PISTA: Record<TipoActividad, string> = {
  nota: 'Algo que el equipo deba saber de este cliente',
  llamada: '¿Qué se habló en la llamada? ¿Qué sigue?',
  whatsapp: 'Resumen de la conversación por WhatsApp',
  correo: 'Asunto o resumen del correo',
  visita: '¿Qué se vio en la visita?',
  reunion: 'Acuerdos de la reunión',
}

function cuando(iso: string) {
  const d = parseISO(iso)
  const horas = (Date.now() - d.getTime()) / 3_600_000
  if (horas < 0.02) return 'Justo ahora'
  if (horas < 24 * 6) return `hace ${formatDistanceToNowStrict(d, { locale: es })}`
  return fecha(iso)
}

/** Línea de tiempo de seguimiento con captura rápida arriba. Requiere `gestionar_clientes`. */
export function ModuloActividad({ clienteId }: { clienteId: string }) {
  const { sesion } = useSesion()
  const reducir = useReducedMotion()
  const consulta = useActividades(clienteId, true)
  const registrar = useRegistrarActividad(clienteId)
  const eliminar = useEliminarActividad(clienteId)
  const [tipo, setTipo] = useState<TipoActividad>('llamada')
  const [texto, setTexto] = useState('')
  const [error, setError] = useState<string | null>(null)
  const esAdmin = sesion?.perfil.rol === 'admin'

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (!texto.trim()) {
      setError('Escribe qué pasó para registrar la actividad')
      return
    }
    setError(null)
    try {
      await registrar.mutateAsync({ tipo, descripcion: texto })
      setTexto('')
      toast.success(`${TIPOS_ACTIVIDAD[tipo]} registrada`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la actividad. Inténtalo de nuevo.')
    }
  }

  return (
    <GlassPanel className="rounded-module p-5 sm:p-6" aria-labelledby="titulo-actividad">
      <TituloModulo id="titulo-actividad">Actividad</TituloModulo>

      <form onSubmit={enviar} className="mt-2 flex flex-col gap-3 rounded-tile bg-[var(--field-bg)] p-3" aria-label="Registrar actividad">
        <div role="radiogroup" aria-label="Tipo de actividad" className="flex flex-wrap gap-1.5">
          {(Object.keys(TIPOS_ACTIVIDAD) as TipoActividad[]).map((t) => {
            const activo = t === tipo
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={activo}
                onClick={() => setTipo(t)}
                className={cn(
                  'inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium outline-none transition-colors pointer-coarse:h-11 [&_svg]:size-4',
                  activo ? 'glass-on-accent' : 'text-fg-muted hover:bg-[var(--control-bg-hover)]',
                )}
              >
                {ICONO_ACTIVIDAD[t]}
                {TIPOS_ACTIVIDAD[t]}
              </button>
            )
          })}
        </div>
        <GlassTextarea
          aria-label="Descripción de la actividad"
          aria-invalid={error ? true : undefined}
          rows={2}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value)
            if (error) setError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void enviar(e)
          }}
          placeholder={PISTA[tipo]}
        />
        <div className="flex items-center justify-between gap-3">
          {error ? (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          ) : (
            <span className="hidden text-xs text-fg-subtle sm:inline">Ctrl + Enter para registrar</span>
          )}
          <GlassButton variante="primario" type="submit" cargando={registrar.isPending} className="ml-auto">
            Registrar actividad
          </GlassButton>
        </div>
      </form>

      {consulta.isPending ? (
        <div className="mt-4 flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-tile" />
          ))}
        </div>
      ) : consulta.isError ? (
        <p className="mt-4 text-sm text-danger">{consulta.error.message}</p>
      ) : consulta.data.length === 0 ? (
        <p className="mt-4 text-sm text-fg-muted">Sin actividad registrada. Anota cada llamada, visita o mensaje para que todo el equipo sepa en qué va este cliente.</p>
      ) : (
        <ol className="relative mt-4 flex flex-col" aria-label="Línea de tiempo">
          <span className="absolute bottom-4 left-[1.1875rem] top-4 w-px bg-[var(--divider)]" aria-hidden />
          <AnimatePresence initial={false}>
            {consulta.data.map((a: ActividadT) => {
              const t = a.tipo as TipoActividad
              const propia = a.usuario_id === sesion?.id
              return (
                <motion.li
                  key={a.id}
                  layout="position"
                  initial={reducir ? false : { opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  transition={resorte.agil}
                  className="group relative flex gap-3 py-2.5"
                >
                  <span
                    className={cn(
                      'glass glass-thick relative z-10 grid size-10 shrink-0 place-items-center rounded-full [&_svg]:size-[1.05rem]',
                      t === 'whatsapp' || t === 'llamada' ? 'text-accent dark:text-navy-200' : 'text-fg-muted',
                    )}
                    aria-hidden
                  >
                    {ICONO_ACTIVIDAD[t] ?? <NotebookPen />}
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-xs text-fg-subtle">
                      <span className="font-semibold text-fg-muted">{TIPOS_ACTIVIDAD[t] ?? a.tipo}</span>
                      {' · '}
                      <time dateTime={a.fecha} title={fecha(a.fecha)}>
                        {cuando(a.fecha)}
                      </time>
                      {a.usuario ? ` · ${a.usuario}` : ''}
                      {a.oportunidad ? ` · ${a.oportunidad}` : ''}
                    </p>
                    <p className="mt-0.5 whitespace-pre-line text-sm text-fg">{a.descripcion}</p>
                  </div>
                  {propia || esAdmin ? (
                    <GlassButton
                      variante="fantasma"
                      tamano="icono"
                      icono={<Trash2 />}
                      aria-label="Eliminar actividad"
                      className="shrink-0 opacity-100 transition-opacity sm:opacity-0 sm:focus-visible:opacity-100 sm:group-hover:opacity-100"
                      onClick={() => eliminar.mutate(a.id, { onSuccess: () => toast.success('Actividad eliminada') })}
                    />
                  ) : null}
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ol>
      )}
    </GlassPanel>
  )
}
