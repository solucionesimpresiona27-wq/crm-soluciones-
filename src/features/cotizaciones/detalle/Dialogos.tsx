import { AlarmClock, Loader2, PackageCheck } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Campo, GlassButton, GlassInput, GlassModal, GlassTextarea } from '@/components/glass'
import type { CotizacionCompleta } from '@/data/tipos'
import { dinero, fechaLarga, hoyISO, sumarDias } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useCambiarEstadoCotizacion, useConvertirCotizacion, useEliminarCotizacion } from '../consultas'
import { anticipoDe } from './calculos'

const ATAJOS_ENTREGA = [
  { dias: 3, etiqueta: 'En 3 días' },
  { dias: 7, etiqueta: 'En una semana' },
  { dias: 15, etiqueta: 'En 15 días' },
]

/** Convertir en pedido: pide título y fecha de entrega; al terminar muestra el folio del pedido. */
export function DialogoConvertir({
  abierto,
  onCambio,
  c,
  vencida,
}: {
  abierto: boolean
  onCambio: (v: boolean) => void
  c: CotizacionCompleta
  vencida: boolean
}) {
  const reducir = useReducedMotion()
  const convertir = useConvertirCotizacion()
  const [titulo, setTitulo] = useState('')
  const [entrega, setEntrega] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [listo, setListo] = useState(false)
  const hoy = hoyISO()

  useEffect(() => {
    if (!abierto) return
    setTitulo(c.titulo ?? '')
    setEntrega('')
    setError(null)
    setListo(false)
    // Solo al abrir: después la cotización se actualiza con el folio del pedido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto])

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (entrega && entrega < hoy) {
      setError('La fecha de entrega no puede ser anterior a hoy')
      return
    }
    setError(null)
    try {
      await convertir.mutateAsync({ id: c.id, fechaEntrega: entrega || null, titulo: titulo.trim() || null })
      setListo(true)
    } catch {
      /* el hook ya muestra el error */
    }
  }

  return (
    <GlassModal
      abierto={abierto}
      onCambio={onCambio}
      titulo={listo ? 'Pedido creado' : 'Convertir en pedido'}
      descripcion={
        listo
          ? undefined
          : `Se creará la orden de trabajo de ${c.cliente.nombre} por ${dinero(c.total)}. La cotización quedará aceptada y ya no se podrá editar.`
      }
      pie={
        listo ? (
          <GlassButton variante="primario" onClick={() => onCambio(false)} className="w-full sm:w-auto">
            Listo
          </GlassButton>
        ) : (
          <>
            <GlassButton variante="fantasma" onClick={() => onCambio(false)}>
              Cancelar
            </GlassButton>
            <GlassButton type="submit" form="form-convertir" variante="primario" icono={<PackageCheck />} cargando={convertir.isPending}>
              Convertir en pedido
            </GlassButton>
          </>
        )
      }
    >
      {listo ? (
        <div className="flex flex-col items-center gap-4 py-4 text-center" role="status">
          <motion.span
            initial={reducir ? false : { scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', visualDuration: 0.5, bounce: 0.35 }}
            className="glass glass-thick glass-on-luz grid size-20 place-items-center rounded-full"
          >
            <PackageCheck className="size-9" aria-hidden />
          </motion.span>
          <div>
            <p className="text-sm text-fg-muted">Convertida en el pedido</p>
            {c.pedido_folio ? (
              <p className="num text-3xl font-semibold tracking-tight text-fg">{c.pedido_folio}</p>
            ) : (
              <p className="flex items-center justify-center gap-2 py-1.5 text-sm text-fg-muted">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Obteniendo el folio…
              </p>
            )}
          </div>
          <p className="max-w-xs text-sm text-fg-muted">
            La cotización quedó aceptada. Para iniciar la producción, registra el anticipo de{' '}
            <span className="num font-semibold text-fg">{dinero(anticipoDe(c))}</span>.
          </p>
        </div>
      ) : (
        <form id="form-convertir" onSubmit={enviar} className="flex flex-col gap-4" noValidate>
          {vencida ? (
            <p className="flex items-start gap-2 rounded-control bg-warning-soft px-3.5 py-2.5 text-sm font-medium text-warning">
              <AlarmClock className="mt-0.5 size-4 shrink-0" aria-hidden />
              Esta cotización venció el {fechaLarga(c.fecha_vencimiento)}. Confirma con el cliente que los precios siguen vigentes.
            </p>
          ) : null}
          <Campo etiqueta="Título del pedido" ayuda="Así lo verá el equipo de producción.">
            {(id, a) => <GlassInput id={id} {...a} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej. Lona para fachada" maxLength={120} />}
          </Campo>
          <Campo etiqueta="Fecha de entrega" opcional error={error}>
            {(id, a) => (
              <div className="flex flex-col gap-2">
                <GlassInput id={id} {...a} type="date" min={hoy} value={entrega} onChange={(e) => setEntrega(e.target.value)} />
                <div className="flex flex-wrap gap-2" role="group" aria-label="Atajos de fecha de entrega">
                  {ATAJOS_ENTREGA.map((x) => {
                    const valor = sumarDias(hoy, x.dias)
                    const activo = entrega === valor
                    return (
                      <GlassButton
                        key={x.dias}
                        variante={activo ? 'luz' : 'cristal'}
                        tamano="sm"
                        aria-pressed={activo}
                        onClick={() => setEntrega(activo ? '' : valor)}
                        className="h-11 px-4"
                      >
                        {x.etiqueta}
                      </GlassButton>
                    )
                  })}
                </div>
              </div>
            )}
          </Campo>
        </form>
      )}
    </GlassModal>
  )
}

const MOTIVOS = ['Precio alto', 'Tiempo de entrega', 'Eligió otro proveedor', 'Ya no lo necesita']

/** Rechazo con motivo obligatorio: alimenta el análisis de por qué se pierden ventas. */
export function DialogoRechazar({ abierto, onCambio, c }: { abierto: boolean; onCambio: (v: boolean) => void; c: CotizacionCompleta }) {
  const cambiar = useCambiarEstadoCotizacion()
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (abierto) {
      setMotivo('')
      setError(null)
    }
  }, [abierto])

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (motivo.trim().length < 3) {
      setError('Escribe el motivo del rechazo; ayuda a mejorar las próximas cotizaciones')
      return
    }
    try {
      await cambiar.mutateAsync({ id: c.id, estado: 'rechazada', motivo: motivo.trim() })
      toast.success(`${c.folio} marcada como rechazada`)
      onCambio(false)
    } catch {
      /* el hook ya muestra el error */
    }
  }

  return (
    <GlassModal
      abierto={abierto}
      onCambio={onCambio}
      titulo={`Rechazar ${c.folio}`}
      descripcion="Anota por qué el cliente no aceptó. Se guarda en el historial de la cotización."
      ancho="sm"
      pie={
        <>
          <GlassButton variante="fantasma" onClick={() => onCambio(false)}>
            Cancelar
          </GlassButton>
          <GlassButton type="submit" form="form-rechazar" variante="peligro" cargando={cambiar.isPending}>
            Marcar como rechazada
          </GlassButton>
        </>
      }
    >
      <form id="form-rechazar" onSubmit={enviar} className="flex flex-col gap-3" noValidate>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Motivos frecuentes">
          {MOTIVOS.map((m) => {
            const activo = motivo === m
            return (
              <GlassButton
                key={m}
                variante={activo ? 'luz' : 'cristal'}
                tamano="sm"
                aria-pressed={activo}
                onClick={() => {
                  setMotivo(activo ? '' : m)
                  setError(null)
                }}
                className="h-11 px-4"
              >
                {m}
              </GlassButton>
            )
          })}
        </div>
        <Campo etiqueta="Motivo" error={error}>
          {(id, a) => (
            <GlassTextarea
              id={id}
              {...a}
              value={motivo}
              onChange={(e) => {
                setMotivo(e.target.value)
                if (error) setError(null)
              }}
              placeholder="Ej. Encontró un precio más bajo en otra imprenta"
              maxLength={300}
              className={cn('min-h-24')}
            />
          )}
        </Campo>
      </form>
    </GlassModal>
  )
}

/** Confirmación para borrar un borrador. */
export function DialogoEliminar({
  abierto,
  onCambio,
  c,
  onEliminada,
}: {
  abierto: boolean
  onCambio: (v: boolean) => void
  c: CotizacionCompleta
  onEliminada: () => void
}) {
  const eliminar = useEliminarCotizacion()
  return (
    <GlassModal
      abierto={abierto}
      onCambio={onCambio}
      titulo={`¿Eliminar el borrador ${c.folio}?`}
      descripcion="Se borrará con todas sus partidas. Esta acción no se puede deshacer."
      ancho="sm"
      pie={
        <>
          <GlassButton variante="fantasma" onClick={() => onCambio(false)}>
            Conservar
          </GlassButton>
          <GlassButton
            variante="peligro"
            cargando={eliminar.isPending}
            onClick={async () => {
              try {
                await eliminar.mutateAsync(c.id)
                onEliminada()
              } catch {
                /* el hook ya muestra el error */
              }
            }}
          >
            Eliminar borrador
          </GlassButton>
        </>
      }
    >
      <p className="text-sm text-fg-muted">
        {c.cliente.nombre}
        {c.titulo ? `, ${c.titulo}` : ''}: <span className="num font-semibold text-fg">{dinero(c.total)}</span>
      </p>
    </GlassModal>
  )
}
