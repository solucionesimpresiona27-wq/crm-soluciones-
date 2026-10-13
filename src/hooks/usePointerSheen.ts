import { useEffect, type RefObject } from 'react'

const puedeHover = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Mueve el reflejo especular del cristal siguiendo al puntero.
 * Escribe variables CSS directamente (sin renders de React) y solo en equipos con mouse.
 */
export function usePointerSheen(ref: RefObject<HTMLElement | null>, activo = true) {
  useEffect(() => {
    const el = ref.current
    if (!el || !activo || !puedeHover()) return

    let frame = 0
    let x = 0
    let y = 0

    const pintar = () => {
      frame = 0
      el.style.setProperty('--mx', `${x}%`)
      el.style.setProperty('--my', `${y}%`)
    }

    const mover = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      x = ((e.clientX - r.left) / r.width) * 100
      y = ((e.clientY - r.top) / r.height) * 100
      if (!frame) frame = requestAnimationFrame(pintar)
    }

    const salir = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      el.style.removeProperty('--mx')
      el.style.removeProperty('--my')
    }

    el.addEventListener('pointermove', mover)
    el.addEventListener('pointerleave', salir)
    return () => {
      el.removeEventListener('pointermove', mover)
      el.removeEventListener('pointerleave', salir)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [ref, activo])
}
