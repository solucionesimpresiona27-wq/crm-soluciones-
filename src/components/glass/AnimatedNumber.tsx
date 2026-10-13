import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { useEffect } from 'react'

export interface AnimatedNumberProps {
  valor: number
  formato?: (n: number) => string
  className?: string
  /** Duración visual del conteo en segundos */
  duracion?: number
}

/** Contador animado que se mantiene legible: arranca cerca del valor y se asienta con resorte. */
export function AnimatedNumber({ valor, formato = (n) => n.toLocaleString('es-MX'), className, duracion = 0.9 }: AnimatedNumberProps) {
  const reducir = useReducedMotion()
  const mv = useMotionValue(reducir ? valor : valor * 0.86)
  const texto = useTransform(mv, (v) => formato(v))

  useEffect(() => {
    if (reducir) {
      mv.set(valor)
      return
    }
    // Umbral de reposo relativo: en cifras grandes el resorte no se queda "colgado" en el último peso
    const restDelta = Math.max(0.01, Math.abs(valor) * 0.00005)
    const control = animate(mv, valor, {
      type: 'spring',
      visualDuration: duracion,
      bounce: 0,
      restDelta,
      restSpeed: restDelta * 10,
      onComplete: () => mv.set(valor),
    })
    return () => control.stop()
  }, [valor, reducir, duracion, mv])

  return (
    <motion.span className={className} aria-label={formato(valor)}>
      {texto}
    </motion.span>
  )
}
