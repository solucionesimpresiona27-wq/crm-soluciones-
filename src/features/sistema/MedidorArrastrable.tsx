import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { useEffect, useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { resorte } from '@/lib/motion'
import { cn } from '@/lib/utils'

export interface MedidorArrastrableProps {
  /** 0 a 1 */
  valor: number
  onCambio: (valor: number) => void
  etiqueta: string
  /** Texto accesible del valor, p. ej. "22 px" */
  textoValor: string
  icono: ReactNode
  tono?: 'claro' | 'luz' | 'acento'
  className?: string
}

const limitar = (v: number) => Math.min(1, Math.max(0, v))

/**
 * Medidor vertical en cápsula que se arrastra, como brillo y volumen del Centro de Control.
 * Mismo material que CapsuleMeter. El arrastre es relativo (no salta al tocar y mover);
 * un toque sin mover lleva el valor a ese punto. Al pasarse de los extremos la cápsula
 * se estira un poco y regresa con resorte. Con teclado: flechas, Re Pág/Av Pág, Inicio y Fin.
 */
export function MedidorArrastrable({ valor, onCambio, etiqueta, textoValor, icono, tono = 'claro', className }: MedidorArrastrableProps) {
  const reducir = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const relleno = useMotionValue(reducir ? valor : 0)
  const estiramiento = useMotionValue(1)
  const origen = useMotionValue(1)
  const angosto = useTransform(estiramiento, [1, 1.1], [1, 0.95])
  const arrastre = useRef<{ id: number; y0: number; v0: number; movio: boolean; ultimo: number } | null>(null)
  const primera = useRef(true)

  // El valor que llega de fuera (toque, teclado, restablecer) se alcanza con resorte;
  // durante el arrastre el relleno sigue al dedo sin retraso.
  useEffect(() => {
    if (arrastre.current?.movio) return
    if (reducir) {
      relleno.set(valor)
      return
    }
    // La primera vez el relleno sube desde abajo, como al abrir el Centro de Control
    const control = animate(relleno, valor, { ...resorte.expansion, delay: primera.current ? 0.15 : 0 })
    primera.current = false
    return () => control.stop()
  }, [valor, reducir, relleno])

  const alPresionar = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    arrastre.current = { id: e.pointerId, y0: e.clientY, v0: valor, movio: false, ultimo: valor }
  }

  const alMover = (e: PointerEvent<HTMLDivElement>) => {
    const a = arrastre.current
    const el = ref.current
    if (!a || a.id !== e.pointerId || !el) return
    const dy = a.y0 - e.clientY
    if (!a.movio) {
      if (Math.abs(dy) < 3) return
      a.movio = true
      relleno.stop()
    }
    const bruto = a.v0 + dy / el.getBoundingClientRect().height
    const v = limitar(bruto)
    relleno.set(v)
    if (!reducir) {
      const exceso = bruto > 1 ? bruto - 1 : bruto < 0 ? -bruto : 0
      origen.set(bruto < 0 ? 0 : 1)
      estiramiento.set(1 + Math.tanh(exceso * 1.6) * 0.08)
    }
    if (v !== a.ultimo) {
      a.ultimo = v
      onCambio(v)
    }
  }

  const alSoltar = (e: PointerEvent<HTMLDivElement>, cancelado = false) => {
    const a = arrastre.current
    if (!a || a.id !== e.pointerId) return
    arrastre.current = null
    if (!a.movio && !cancelado && ref.current) {
      const r = ref.current.getBoundingClientRect()
      onCambio(limitar(1 - (e.clientY - r.top) / r.height))
    }
    if (estiramiento.get() !== 1) animate(estiramiento, 1, resorte.agil)
  }

  const alTeclear = (e: KeyboardEvent<HTMLDivElement>) => {
    const pasos: Record<string, number> = { ArrowUp: 0.05, ArrowRight: 0.05, ArrowDown: -0.05, ArrowLeft: -0.05, PageUp: 0.2, PageDown: -0.2 }
    let v: number
    if (e.key in pasos) v = valor + pasos[e.key]
    else if (e.key === 'Home') v = 0
    else if (e.key === 'End') v = 1
    else return
    e.preventDefault()
    onCambio(limitar(Math.round(v * 100) / 100))
  }

  const fondoRelleno =
    tono === 'luz'
      ? 'bg-gradient-to-t from-amber-400 to-amber-300'
      : tono === 'acento'
        ? 'bg-gradient-to-t from-navy-600 to-navy-400'
        : 'bg-gradient-to-t from-navy-200 to-navy-100 dark:from-white/90 dark:to-white/75'

  return (
    <motion.div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label={etiqueta}
      aria-orientation="vertical"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(valor * 100)}
      aria-valuetext={textoValor}
      onPointerDown={alPresionar}
      onPointerMove={alMover}
      onPointerUp={(e) => alSoltar(e)}
      onPointerCancel={(e) => alSoltar(e, true)}
      onKeyDown={alTeclear}
      whileTap={reducir ? undefined : { scale: 0.97 }}
      transition={resorte.presion}
      style={{ scaleY: estiramiento, scaleX: angosto, originY: origen }}
      className={cn(
        'glass glass-thick glass-lens relative h-full w-full cursor-ns-resize touch-none select-none overflow-hidden rounded-[2rem] outline-none',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[rgb(var(--accent))]',
        className,
      )}
    >
      <motion.div className={cn('absolute inset-x-0 bottom-0 h-full origin-bottom', fondoRelleno)} style={{ scaleY: relleno }} />
      <div
        className={cn(
          'absolute inset-x-0 bottom-4 grid place-items-center transition-colors duration-200 [&_svg]:size-6',
          valor < 0.12 ? 'text-fg' : tono === 'claro' ? 'text-navy-600' : tono === 'luz' ? 'text-navy-900' : 'text-white',
        )}
        aria-hidden
      >
        {icono}
      </div>
    </motion.div>
  )
}
