import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { resorte } from '@/lib/motion'
import { cn } from '@/lib/utils'

export interface CapsuleMeterProps {
  /** 0 a 1 */
  valor: number
  icono: ReactNode
  etiqueta: string
  /** Texto accesible del valor, p. ej. "72% de la meta" */
  textoValor: string
  tono?: 'claro' | 'luz' | 'acento'
  className?: string
  onClick?: () => void
}

/**
 * Medidor vertical en cápsula (como los controles de brillo y volumen del Centro de Control).
 * El llenado sube desde abajo con un resorte.
 */
export function CapsuleMeter({ valor, icono, etiqueta, textoValor, tono = 'claro', className, onClick }: CapsuleMeterProps) {
  const reducir = useReducedMotion()
  const v = Math.max(0, Math.min(1, valor))
  const relleno =
    tono === 'luz'
      ? 'bg-gradient-to-t from-amber-400 to-amber-300'
      : tono === 'acento'
        ? 'bg-gradient-to-t from-navy-600 to-navy-400'
        : 'bg-gradient-to-t from-white to-white/90 dark:from-white/90 dark:to-white/75'

  const Etiqueta = onClick ? motion.button : motion.div

  return (
    <Etiqueta
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      whileTap={onClick && !reducir ? { scale: 0.95 } : undefined}
      transition={resorte.presion}
      role="meter"
      aria-label={etiqueta}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      aria-valuetext={textoValor}
      className={cn('glass glass-thick glass-lens relative h-full min-h-40 w-full overflow-hidden rounded-[2rem] outline-none', className)}
    >
      <motion.div
        className={cn('absolute inset-x-0 bottom-0 origin-bottom', relleno)}
        style={{ height: '100%' }}
        initial={reducir ? false : { scaleY: 0 }}
        animate={{ scaleY: v }}
        transition={{ ...resorte.expansion, delay: reducir ? 0 : 0.15 }}
      />
      <div
        className={cn(
          'absolute inset-x-0 bottom-4 grid place-items-center [&_svg]:size-6',
          tono === 'claro' ? 'text-navy-600' : tono === 'luz' ? 'text-navy-900' : 'text-white',
          v < 0.12 && 'text-fg',
        )}
      >
        {icono}
      </div>
    </Etiqueta>
  )
}
