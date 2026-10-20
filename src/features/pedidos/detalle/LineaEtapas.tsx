import {
  ArrowRight,
  Ban,
  Brush,
  Check,
  CheckCheck,
  CircleDot,
  Flag,
  Hammer,
  PackageCheck,
  Pause,
  Play,
  RotateCcw,
  Scissors,
  SlidersHorizontal,
  ThumbsUp,
  Truck,
  Hourglass,
  type LucideIcon,
} from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { GlassButton, GlassPanel } from '@/components/glass'
import type { PedidoDetalle } from '@/data/modulos/pedidos/contrato'
import type { EstadoPedido } from '@/data/tipos'
import { ESTADO_PEDIDO, FLUJO_PEDIDO } from '@/lib/estados'
import { resorte } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { enEtapa } from '../lista/datos'

export const ICONO_ETAPA: Record<EstadoPedido, LucideIcon> = {
  nuevo: CircleDot,
  en_diseno: Brush,
  esperando_aprobacion: Hourglass,
  aprobado: ThumbsUp,
  en_produccion: Hammer,
  acabados: Scissors,
  listo_entrega: PackageCheck,
  en_instalacion: Truck,
  entregado: CheckCheck,
  finalizado: Flag,
  pausado: Pause,
  cancelado: Ban,
}

/** Etapas que aplican a este pedido, en orden. */
export function etapasDe(p: Pick<PedidoDetalle, 'etapas_omitidas'>) {
  return FLUJO_PEDIDO.filter((e) => !p.etapas_omitidas.includes(e))
}

/** Siguiente etapa que aplica (null al final o si está pausado/cancelado). */
export function siguienteEtapa(p: Pick<PedidoDetalle, 'estado' | 'etapas_omitidas'>): EstadoPedido | null {
  if (p.estado === 'pausado' || p.estado === 'cancelado') return null
  const i = FLUJO_PEDIDO.indexOf(p.estado)
  return FLUJO_PEDIDO.slice(i + 1).find((e) => !p.etapas_omitidas.includes(e)) ?? null
}

const VERBO: Partial<Record<EstadoPedido, string>> = {
  en_diseno: 'Empezar diseño',
  esperando_aprobacion: 'Enviar a aprobación',
  aprobado: 'Marcar diseño aprobado',
  en_produccion: 'Pasar a producción',
  acabados: 'Pasar a acabados',
  listo_entrega: 'Marcar listo para entrega',
  en_instalacion: 'Salir a instalar',
  entregado: 'Marcar entregado',
  finalizado: 'Finalizar pedido',
}

export interface AccionesEtapas {
  /** Puede mover etapas (actualizar_produccion o gestionar_pedidos) */
  mover: boolean
  /** Puede cancelar, reabrir y elegir etapas (gestionar_pedidos) */
  gestionar: boolean
  ocupado: EstadoPedido | null
  irA: (estado: EstadoPedido) => void
  pausar: () => void
  cancelar: () => void
  reanudar: () => void
  reabrir: () => void
  elegirEtapas: () => void
}

/**
 * Línea de etapas tipo Centro de Control: círculos de cristal unidos por un riel que se llena;
 * la etapa actual se enciende en luz. Tocar una etapa mueve el pedido ahí.
 */
export function LineaEtapas({ p, a }: { p: PedidoDetalle; a: AccionesEtapas }) {
  const reducir = useReducedMotion()
  const etapas = etapasDe(p)
  const detenido = p.estado === 'pausado' || p.estado === 'cancelado'
  // En pausa se marca la etapa donde se quedó
  const referencia = detenido ? p.estado_anterior : p.estado
  const indice = referencia ? etapas.indexOf(referencia) : -1
  const avance = etapas.length > 1 ? Math.max(0, indice) / (etapas.length - 1) : 1
  const siguiente = siguienteEtapa(p)
  const terminado = p.estado === 'finalizado'
  const pista = useRef<HTMLDivElement>(null)

  // En celular la pista se desplaza: se centra la etapa actual
  useEffect(() => {
    const el = pista.current
    const actual = el?.querySelector<HTMLElement>('[aria-current="step"]')
    if (!el || !actual || el.scrollWidth <= el.clientWidth) return
    el.scrollLeft = actual.offsetLeft - el.clientWidth / 2 + actual.offsetWidth / 2
  }, [p.estado])

  return (
    <GlassPanel className="p-5 sm:p-6" aria-label="Etapas del pedido" role="region">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-fg-muted">Etapa actual</p>
          <p className="text-2xl font-semibold leading-tight tracking-tight text-fg">{ESTADO_PEDIDO[p.estado].etiqueta}</p>
          {p.estado === 'pausado' && p.estado_anterior ? (
            <p className="mt-0.5 text-sm text-fg-muted">Se quedó {enEtapa(p.estado_anterior)}</p>
          ) : null}
        </div>
        {a.gestionar && !detenido && !terminado ? (
          <GlassButton variante="fantasma" tamano="sm" icono={<SlidersHorizontal />} onClick={a.elegirEtapas} className="h-11 px-3.5">
            Etapas que aplican
          </GlassButton>
        ) : null}
      </div>

      {/* Pista: en celular se desplaza de lado; los círculos miden 44 px como mínimo */}
      <div ref={pista} className="-mx-5 mt-5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden">
        <ol className="relative flex min-w-max items-start justify-between gap-1 sm:min-w-0" aria-label={`${etapas.length} etapas`}>
          {/* Riel y su llenado (transform: scaleX) */}
          <span className="absolute left-7 right-7 top-[1.6rem] h-1 rounded-full bg-fg/10" aria-hidden>
            <motion.span
              className={cn('absolute inset-0 origin-left rounded-full', detenido ? 'bg-fg/25' : 'bg-gradient-to-r from-navy-500 to-navy-400 dark:from-navy-400 dark:to-navy-300')}
              initial={reducir ? false : { scaleX: 0 }}
              animate={{ scaleX: avance }}
              transition={{ ...resorte.expansion, delay: reducir ? 0 : 0.15 }}
            />
          </span>
          {etapas.map((e, i) => {
            const Icono = ICONO_ETAPA[e]
            const hecha = i < indice || terminado
            const actual = i === indice && !terminado
            const encendida = actual && !detenido
            return (
              <li key={e} className="relative flex w-[4.75rem] flex-col items-center gap-2 text-center sm:w-auto sm:flex-1">
                <motion.button
                  type="button"
                  disabled={!a.mover || (actual && !detenido) || a.ocupado !== null || detenido}
                  onClick={() => a.irA(e)}
                  aria-current={actual ? 'step' : undefined}
                  aria-label={`${ESTADO_PEDIDO[e].etiqueta}${actual ? ' (etapa actual)' : hecha ? ' (hecha)' : ''}${a.mover && !actual && !detenido ? ': mover aquí' : ''}`}
                  whileTap={reducir || !a.mover || detenido ? undefined : { scale: 0.88 }}
                  whileHover={reducir || !a.mover || detenido || actual ? undefined : { y: -2 }}
                  transition={resorte.presion}
                  className={cn(
                    'glass glass-thick relative grid size-[3.25rem] place-items-center rounded-full outline-none transition-[background-color,color,box-shadow] duration-300 [&_svg]:size-[1.3rem]',
                    'disabled:cursor-default',
                    encendida
                      ? 'glass-on-luz shadow-[0_0_0_5px_rgba(249,194,6,0.2),0_10px_28px_-8px_rgba(249,194,6,0.8)]'
                      : actual
                        ? 'text-warning ring-2 ring-warning/50'
                        : hecha
                          ? 'glass-on-accent'
                          : 'text-fg-subtle',
                    a.mover && !actual && !detenido && 'glass-interactive cursor-pointer',
                  )}
                >
                  {a.ocupado === e ? (
                    <span className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
                  ) : hecha ? (
                    <Check aria-hidden />
                  ) : (
                    <Icono aria-hidden />
                  )}
                </motion.button>
                <span className={cn('text-xs font-medium leading-tight', actual ? 'font-semibold text-fg' : hecha ? 'text-fg-muted' : 'text-fg-subtle')} aria-hidden>
                  {ESTADO_PEDIDO[e].corto}
                </span>
              </li>
            )
          })}
        </ol>
      </div>

      {/* Acciones de etapa */}
      {a.mover ? (
        <div className="mt-5 flex flex-col gap-2.5 border-t border-[var(--divider)] pt-5 sm:flex-row sm:items-center">
          {p.estado === 'pausado' ? (
            <GlassButton variante="luz" tamano="lg" icono={<Play />} cargando={a.ocupado !== null} onClick={a.reanudar} className="w-full sm:w-auto">
              Reanudar{p.estado_anterior ? ` ${enEtapa(p.estado_anterior)}` : ''}
            </GlassButton>
          ) : p.estado === 'cancelado' ? (
            a.gestionar ? (
              <GlassButton variante="cristal" tamano="lg" icono={<RotateCcw />} cargando={a.ocupado !== null} onClick={a.reabrir} className="w-full sm:w-auto">
                Reabrir pedido
              </GlassButton>
            ) : (
              <p className="text-sm text-fg-muted">Solo ventas o administración pueden reabrir un pedido cancelado.</p>
            )
          ) : siguiente ? (
            <GlassButton
              variante="primario"
              tamano="lg"
              icono={<ArrowRight />}
              cargando={a.ocupado === siguiente}
              disabled={a.ocupado !== null}
              onClick={() => a.irA(siguiente)}
              className="w-full sm:w-auto"
            >
              {VERBO[siguiente] ?? `Pasar a ${ESTADO_PEDIDO[siguiente].etiqueta.toLowerCase()}`}
            </GlassButton>
          ) : terminado ? (
            a.gestionar ? (
              <GlassButton variante="cristal" icono={<RotateCcw />} cargando={a.ocupado !== null} onClick={a.reabrir} className="w-full sm:w-auto">
                Reabrir pedido
              </GlassButton>
            ) : (
              <p className="text-sm text-fg-muted">Pedido finalizado.</p>
            )
          ) : null}
          {!detenido && !terminado ? (
            <div className="flex gap-2 sm:ml-auto">
              <GlassButton variante="cristal" icono={<Pause />} onClick={a.pausar} disabled={a.ocupado !== null} className="flex-1 sm:flex-none">
                Pausar
              </GlassButton>
              {a.gestionar ? (
                <GlassButton variante="peligro" icono={<Ban />} onClick={a.cancelar} disabled={a.ocupado !== null} className="flex-1 sm:flex-none">
                  Cancelar pedido
                </GlassButton>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </GlassPanel>
  )
}
