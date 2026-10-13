import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { motion, useReducedMotion, type HTMLMotionProps } from 'motion/react'
import { forwardRef, useImperativeHandle, useRef, type ReactNode } from 'react'
import { usePointerSheen } from '@/hooks/usePointerSheen'
import { resorte } from '@/lib/motion'
import { cn } from '@/lib/utils'

const botonVariantes = cva(
  [
    'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold',
    'outline-none disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:shrink-0',
  ],
  {
    variants: {
      variante: {
        cristal: 'glass glass-interactive text-fg',
        primario: 'glass glass-on-accent glass-interactive',
        luz: 'glass glass-on-luz glass-interactive',
        peligro: 'glass glass-interactive text-danger',
        fantasma: 'text-fg-muted transition-colors hover:bg-[var(--control-bg)] hover:text-fg',
      },
      tamano: {
        sm: 'h-9 px-3.5 text-sm [&_svg]:size-4',
        md: 'h-11 px-5 text-base [&_svg]:size-[1.1rem]',
        lg: 'h-[3.25rem] px-6 text-md [&_svg]:size-5',
        icono: 'size-11 [&_svg]:size-5',
      },
    },
    defaultVariants: { variante: 'cristal', tamano: 'md' },
  },
)

export interface GlassButtonProps
  extends Omit<HTMLMotionProps<'button'>, 'children'>,
    VariantProps<typeof botonVariantes> {
  icono?: ReactNode
  iconoDerecha?: ReactNode
  cargando?: boolean
  children?: ReactNode
}

/** Botón cápsula de cristal: se eleva al pasar el cursor y se comprime al presionar. */
export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(function GlassButton(
  { variante, tamano, icono, iconoDerecha, cargando, className, children, disabled, type = 'button', ...props },
  ref,
) {
  const local = useRef<HTMLButtonElement>(null)
  useImperativeHandle(ref, () => local.current as HTMLButtonElement)
  usePointerSheen(local, variante !== 'fantasma')
  const reducir = useReducedMotion()

  return (
    <motion.button
      ref={local}
      type={type}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      whileHover={reducir ? undefined : { y: -1 }}
      whileTap={reducir ? undefined : { scale: 0.96, y: 0 }}
      transition={resorte.presion}
      className={cn(botonVariantes({ variante, tamano }), className)}
      {...props}
    >
      {cargando ? <Loader2 className="animate-spin" aria-hidden /> : icono}
      {children}
      {iconoDerecha}
    </motion.button>
  )
})

export { botonVariantes }
