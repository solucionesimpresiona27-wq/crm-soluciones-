import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowRight, FileUp, HandCoins, MessageSquare, PackagePlus, ReceiptText, Send, ThumbsUp, UserRoundCheck, type LucideIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { EncabezadoPanel, GlassButton, GlassPanel, GlassTextarea, Skeleton } from '@/components/glass'
import type { EventoPedido } from '@/data/modulos/pedidos/contrato'
import { ESTADO_PEDIDO } from '@/lib/estados'
import { cn } from '@/lib/utils'
import { enEtapa } from '../lista/datos'
import { useAgregarNota, useEventosPedido } from '../consultas'

const ICONO: Record<string, LucideIcon> = {
  creado: PackagePlus,
  estado: ArrowRight,
  nota: MessageSquare,
  pago: HandCoins,
  archivo: FileUp,
  aprobacion: ThumbsUp,
  asignacion: UserRoundCheck,
  factura: ReceiptText,
}

function titulo(e: EventoPedido) {
  if (e.tipo === 'estado' && e.estado_a) {
    if (e.estado_a === 'pausado') return 'Pedido en pausa'
    if (e.estado_a === 'cancelado') return 'Pedido cancelado'
    if (e.estado_de === 'pausado') return `Reanudado ${enEtapa(e.estado_a)}`
    return ESTADO_PEDIDO[e.estado_a].etiqueta
  }
  if (e.tipo === 'nota') return 'Nota'
  return e.mensaje ?? ''
}

function cuando(iso: string) {
  return format(parseISO(iso), "d MMM, HH:mm", { locale: es })
}

/** Línea de tiempo (lo más reciente arriba) con notas internas del equipo. */
export function PanelHistorial({ pedidoId, precios }: { pedidoId: string; precios: boolean }) {
  const consulta = useEventosPedido(pedidoId)
  const nota = useAgregarNota()
  const [texto, setTexto] = useState('')

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (!texto.trim()) {
      toast.error('Escribe la nota antes de agregarla')
      return
    }
    try {
      await nota.mutateAsync({ id: pedidoId, mensaje: texto.trim() })
      setTexto('')
    } catch {
      /* el hook ya muestra el error */
    }
  }

  // Los pagos llevan montos: solo con ver_precios
  const eventos = [...(consulta.data ?? [])].filter((e) => precios || e.tipo !== 'pago').reverse()

  return (
    <GlassPanel className="p-5 sm:p-6">
      <EncabezadoPanel titulo="Historial y notas" descripcion="Las notas solo las ve el equipo." />
      <form onSubmit={enviar} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="sr-only" htmlFor={`nota-${pedidoId}`}>
          Nota interna
        </label>
        <GlassTextarea
          id={`nota-${pedidoId}`}
          rows={2}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void enviar(e)
          }}
          placeholder="Escribe una nota para el equipo…"
          className="min-h-[2.75rem] flex-1"
        />
        <GlassButton type="submit" variante="primario" icono={<Send />} cargando={nota.isPending} className="shrink-0">
          Agregar nota
        </GlassButton>
      </form>

      {consulta.isPending ? (
        <div className="mt-5 flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10 rounded-control" />
          ))}
        </div>
      ) : (
        <ol className="mt-5">
          {eventos.map((e, i) => {
            const Icono = ICONO[e.tipo] ?? MessageSquare
            const esNota = e.tipo === 'nota'
            const detalle = e.tipo === 'estado' ? e.mensaje : esNota ? e.mensaje : null
            return (
              <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
                {i < eventos.length - 1 ? <span className="absolute bottom-0 left-[15px] top-9 w-0.5 rounded-full bg-fg/10" aria-hidden /> : null}
                <span
                  className={cn(
                    'relative grid size-8 shrink-0 place-items-center rounded-full [&_svg]:size-4',
                    i === 0 && e.tipo === 'estado' ? 'bg-luz text-luz-fg shadow-[0_4px_14px_-4px_rgba(249,194,6,0.8)]' : esNota ? 'bg-accent/[0.12] text-accent dark:text-navy-200' : 'bg-[var(--control-bg)] text-fg-muted',
                  )}
                  aria-hidden
                >
                  <Icono />
                </span>
                <div className="min-w-0 flex-1 pt-1">
                  <p className="text-sm font-medium text-fg">{titulo(e)}</p>
                  {detalle ? (
                    <p className={cn('mt-0.5 whitespace-pre-line text-sm', esNota ? 'rounded-control bg-[var(--control-bg)] px-3 py-2 text-fg' : 'text-fg-muted')}>{detalle}</p>
                  ) : null}
                  <p className="num mt-0.5 text-xs text-fg-subtle">
                    {cuando(e.created_at)}
                    {e.usuario ? ` · ${e.usuario}` : ''}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </GlassPanel>
  )
}
