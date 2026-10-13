import type { Transition } from 'motion/react'

/**
 * Resortes del sistema. Sistema empresarial: rebote bajo, respuesta rápida.
 * Interacciones frecuentes → cortos; acciones importantes → más amplios.
 */
export const resorte = {
  /** Presión de botones y controles */
  presion: { type: 'spring', stiffness: 520, damping: 30, mass: 0.6 },
  /** Cambios de estado pequeños (toggles, indicadores) */
  agil: { type: 'spring', visualDuration: 0.28, bounce: 0.18 },
  /** Entradas de tarjetas y paneles */
  suave: { type: 'spring', visualDuration: 0.45, bounce: 0.12 },
  /** Expansión y contracción de módulos */
  expansion: { type: 'spring', visualDuration: 0.5, bounce: 0.16 },
  /** Ventanas emergentes */
  modal: { type: 'spring', visualDuration: 0.38, bounce: 0.14 },
} satisfies Record<string, Transition>

/** Escalonado de entrada para listas y cuadrículas */
export function escalonado(indice: number, base = 0.04, max = 0.4) {
  return Math.min(indice * base, max)
}

export const entradaModulo = {
  initial: { opacity: 0, y: 14, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
}
