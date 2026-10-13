import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Escalas propias de tailwind.config.ts: sin esto, `text-hero` se toma por color (y se pierde
// junto a `text-fg`) y `rounded-sheet` no reemplaza a otro `rounded-*`.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['2xs', 'md', 'display', 'hero'],
      radius: ['sheet', 'module', 'tile', 'control', 'chip'],
      shadow: ['glass', 'glass-lg', 'lift'],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Quita acentos y pasa a minúsculas, igual que la función normalizar() de la base de datos. */
export function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export function redondear(n: number, decimales = 2) {
  const f = 10 ** decimales
  return Math.round((n + Number.EPSILON) * f) / f
}
