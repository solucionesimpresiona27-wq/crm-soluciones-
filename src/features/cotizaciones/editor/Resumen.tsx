import { AlertCircle, CalendarClock, Check, Lock } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { createPortal } from 'react-dom'
import { AnimatedNumber, GlassButton, GlassPanel } from '@/components/glass'
import type { Totales } from '@/lib/calculadora'
import { cantidad, dinero, fecha, porcentaje } from '@/lib/format'
import { DEMO } from '@/lib/supabase'
import { resorte } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { RECARGO_CONCEPTO, anticipoDe, n, utilidadDe, vencimientoDe, type EstadoEditor } from './modelo'
import { Atajo } from './piezas'

function Linea({ etiqueta, valor, tenue }: { etiqueta: string; valor: string; tenue?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <dt className="min-w-0 truncate text-fg-muted">{etiqueta}</dt>
      <dd className={cn('num whitespace-nowrap font-medium', tenue ? 'text-fg-muted' : 'text-fg')}>{valor}</dd>
    </div>
  )
}

/**
 * Resumen en vivo: total con cifra de cristal, desglose, anticipo y vigencia.
 * En escritorio queda fijo a la derecha con el botón de guardar.
 */
export function Resumen({
  estado,
  totales,
  puedeCostos,
  pendientes,
  guardando,
  onGuardar,
  conBoton,
  className,
}: {
  estado: EstadoEditor
  totales: Totales
  puedeCostos: boolean
  /** Mensajes de lo que falta para guardar (solo después de intentar) */
  pendientes: string[]
  guardando: boolean
  onGuardar: () => void
  conBoton: boolean
  className?: string
}) {
  const anticipo = anticipoDe(estado, totales)
  const vence = vencimientoDe(estado)
  const conceptos = estado.partidas.length
  const util = puedeCostos && conceptos > 0 ? utilidadDe(estado, totales) : null

  return (
    <GlassPanel className={cn('p-5 sm:p-6', className)} aria-label="Resumen de la cotización">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-fg-muted">Total</p>
        <p className="text-xs text-fg-subtle">
          {conceptos} {conceptos === 1 ? 'concepto' : 'conceptos'}
        </p>
      </div>
      <AnimatedNumber
        valor={totales.total}
        formato={dinero}
        className="num glass-text mt-1 block truncate text-3xl font-semibold leading-none tracking-tight"
      />
      <p className="mt-1.5 text-xs text-fg-subtle">{estado.aplica_iva ? `IVA incluido (${cantidad(n(estado.iva_pct))} %)` : 'Precios sin IVA'}</p>

      <dl className="mt-5 border-t border-[var(--divider)] pt-3 text-sm">
        <Linea etiqueta="Subtotal" valor={dinero(totales.subtotal)} />
        {totales.descuento > 0 ? (
          <Linea
            etiqueta={estado.descuento_tipo === 'pct' ? `Descuento (${cantidad(n(estado.descuento_valor))} %)` : 'Descuento'}
            valor={`−${dinero(totales.descuento)}`}
          />
        ) : null}
        {totales.recargo > 0 ? (
          <Linea etiqueta={`${estado.recargo_concepto.trim() || RECARGO_CONCEPTO} (${cantidad(n(estado.recargo_pct))} %)`} valor={dinero(totales.recargo)} />
        ) : null}
        {estado.aplica_iva ? <Linea etiqueta={`IVA (${cantidad(n(estado.iva_pct))} %)`} valor={dinero(totales.iva)} /> : null}
      </dl>

      {n(estado.anticipo_pct) > 0 ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-full bg-luz/20 py-2 pl-4 pr-4 text-sm shadow-[inset_0_0_0_1px_rgba(249,194,6,0.35)] dark:bg-luz/10">
          <span className="font-medium text-fg">Anticipo {cantidad(n(estado.anticipo_pct))} %</span>
          <span className="num whitespace-nowrap font-semibold text-fg">{dinero(anticipo)}</span>
        </div>
      ) : null}

      {vence ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-fg-muted">
          <CalendarClock className="size-4 shrink-0 text-fg-subtle" aria-hidden />
          Válida hasta el {fecha(vence)}
        </p>
      ) : null}

      {util ? (
        <div className="mt-4 rounded-tile bg-[rgb(var(--line)/0.035)] p-3 text-sm shadow-[inset_0_0_0_1px_rgb(var(--line)/0.06)]">
          <p className="flex items-center gap-1.5 text-xs font-medium text-fg-subtle">
            <Lock className="size-3.5" aria-hidden />
            Utilidad estimada, solo para ti
          </p>
          {util.sinCosto === conceptos ? (
            <p className="mt-1.5 text-xs text-fg-muted">
              {conceptos === 1 ? 'El concepto no tiene' : 'Ningún concepto tiene'} costo capturado, así que no se puede estimar la utilidad. Captúralo en
              la calculadora de cada concepto.
            </p>
          ) : (
            <>
              <div className="mt-1.5 flex items-baseline justify-between gap-3">
                <span className={cn('num text-md font-semibold', util.utilidad < 0 ? 'text-danger' : 'text-fg')}>{dinero(util.utilidad)}</span>
                <span className="num text-fg-muted">{util.margen === null ? 'Sin venta' : `${porcentaje(util.margen, 1)} de margen`}</span>
              </div>
              <p className="num mt-0.5 text-xs text-fg-subtle">
                Costo {dinero(util.costo)}
                {util.sinCosto > 0 ? `; ${util.sinCosto} ${util.sinCosto === 1 ? 'concepto sin costo' : 'conceptos sin costo'}` : ''}
              </p>
            </>
          )}
        </div>
      ) : null}

      {pendientes.length ? (
        <div className="mt-4 rounded-tile bg-danger-soft/60 p-3 text-sm" role="alert">
          <p className="flex items-center gap-1.5 font-medium text-danger">
            <AlertCircle className="size-4" aria-hidden />
            Antes de guardar
          </p>
          <ul className="mt-1 flex flex-col gap-0.5 pl-[1.375rem] text-fg">
            {pendientes.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {conBoton ? (
        <div className="mt-5 grid gap-2">
          <GlassButton variante="primario" tamano="lg" icono={<Check />} cargando={guardando} onClick={onGuardar} className="w-full">
            Guardar cotización
          </GlassButton>
          <p className="text-center text-xs text-fg-subtle">
            También con <Atajo tecla="S" />
          </p>
        </div>
      ) : null}
    </GlassPanel>
  )
}

/** Celular y tableta: cápsula de cristal con el total y "Guardar", por encima de la navegación. */
export function BarraGuardar({ total, conIva, guardando, onGuardar }: { total: number; conIva: boolean; guardando: boolean; onGuardar: () => void }) {
  const reducir = useReducedMotion()
  return createPortal(
    <motion.div
      initial={reducir ? { opacity: 0 } : { opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...resorte.suave, delay: reducir ? 0 : 0.15 }}
      className={cn(
        'no-print fixed inset-x-3 z-30 md:left-auto md:right-4 md:w-[26rem]',
        // Encima de la barra de navegación del celular (y del aviso de vista previa, que no debe taparse)
        DEMO
          ? 'bottom-[calc(7.5rem+var(--safe-bottom))] md:bottom-[3.75rem]'
          : 'bottom-[calc(5.75rem+var(--safe-bottom))] md:bottom-4',
      )}
    >
      <div className="glass glass-strong flex h-16 items-center gap-3 rounded-full pl-5 pr-2 shadow-glass-lg">
        <div className="min-w-0 flex-1">
          <p className="text-2xs font-medium leading-tight text-fg-subtle">{conIva ? 'Total con IVA' : 'Total sin IVA'}</p>
          <AnimatedNumber valor={total} formato={dinero} className="num block truncate text-lg font-semibold leading-tight tracking-tight text-fg" />
        </div>
        <GlassButton variante="primario" icono={<Check />} cargando={guardando} onClick={onGuardar} className="shrink-0">
          Guardar
        </GlassButton>
      </div>
    </motion.div>,
    document.body,
  )
}
