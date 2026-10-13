import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { useEffect } from 'react'

export interface AnimatedNumberProps {
  valor: number
  formato?: (n: number) => string
  className?: string
  /** Duración visual del conteo en segundos */
  duracion?: number
}

/** Contador animado que se mantiene legible: arranca cerca del valor y desacelera hasta la cifra exacta. */
export function AnimatedNumber({ valor, formato = (n) => n.toLocaleString('es-MX'), className, duracion = 0.9 }: AnimatedNumberProps) {
  const reducir = useReducedMotion()
  const mv = useMotionValue(reducir ? valor : valor * 0.86)
  const texto = useTransform(mv, (v) => formato(v))

  useEffect(() => {
    if (reducir) {
      mv.set(valor)
      return
    }
    // Desaceleración con duración fija (no resorte): la cifra llega exacta a tiempo y los centavos no "bailan"
    const control = animate(mv, valor, { duration: duracion, ease: [0.16, 1, 0.3, 1], onComplete: () => mv.set(valor) })
    return () => control.stop()
  }, [valor, reducir, duracion, mv])

  return (
    <motion.span className={className} aria-label={formato(valor)}>
      {texto}
    </motion.span>
  )
}
