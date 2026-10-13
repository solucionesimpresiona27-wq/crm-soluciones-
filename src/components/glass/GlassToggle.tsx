import { motion, useReducedMotion } from 'motion/react'
import { useRef, type ReactNode } from 'react'
import { usePointerSheen } from '@/hooks/usePointerSheen'
import { resorte } from '@/lib/motion'
import { cn } from '@/lib/utils'

export interface GlassToggleProps {
  icono: ReactNode
  titulo: string
  subtitulo?: string
  activo: boolean
  onCambio: (activo: boolean) => void
  tono?: 'acento' | 'luz'
  className?: string
}

/** Cápsula de control con pozo circular para el ícono (como "Concentración" en el Centro de Control). */
export function GlassToggle({ icono, titulo, subtitulo, activo, onCambio, tono = 'luz', className }: GlassToggleProps) {
  const ref = useRef<HTMLButtonElement>(null)
  usePointerSheen(ref)
  const reducir = useReducedMotion()

  return (
    <motion.button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={activo}
      onClick={() => onCambio(!activo)}
      whileHover={reducir ? undefined : { y: -1 }}
      whileTap={reducir ? undefined : { scale: 0.96 }}
      transition={resorte.presion}
      className={cn(
        'glass glass-thick glass-interactive glass-lens glass-capsule-lens flex h-16 items-center gap-3 rounded-full pl-2 pr-5 text-left outline-none',
        className,
      )}
    >
      <motion.span
        layout
        transition={resorte.agil}
        className={cn(
          'grid size-12 shrink-0 place-items-center rounded-full transition-colors duration-300 [&_svg]:size-[1.35rem]',
          activo
            ? tono === 'luz'
              ? 'bg-luz text-luz-fg shadow-[0_6px_20px_-6px_rgba(249,194,6,0.75)]'
              : 'bg-accent text-accent-fg'
            : 'bg-[var(--control-bg)] text-fg',
        )}
      >
        {icono}
      </motion.span>
      <span className="min-w-0">
        <span className="block truncate text-base font-semibold text-fg">{titulo}</span>
        {subtitulo ? <span className="block truncate text-xs text-fg-muted">{subtitulo}</span> : null}
      </span>
    </motion.button>
  )
}
