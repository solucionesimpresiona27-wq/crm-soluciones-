import { AnimatePresence, motion, useReducedMotion, type HTMLMotionProps } from 'motion/react'
import { forwardRef, useImperativeHandle, useRef, type ReactNode } from 'react'
import { usePointerSheen } from '@/hooks/usePointerSheen'
import { resorte } from '@/lib/motion'
import { cn } from '@/lib/utils'

const tamanos = {
  sm: 'size-10 [&_svg]:size-[1.1rem]',
  md: 'size-[3.25rem] [&_svg]:size-[1.35rem]',
  lg: 'size-16 [&_svg]:size-7',
  xl: 'size-[4.75rem] [&_svg]:size-8',
} as const

export interface GlassIconButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  icono: ReactNode
  /** Icono alterno cuando está activo (p. ej. sol / luna) */
  iconoActivo?: ReactNode
  /** Nombre accesible; también se muestra debajo si `mostrarEtiqueta` */
  etiqueta: string
  mostrarEtiqueta?: boolean
  activo?: boolean
  /** Color de encendido: azul de marca o la luz amarilla del foco */
  tono?: 'acento' | 'luz'
  tamano?: keyof typeof tamanos
  /** Insignia numérica (pendientes, avisos) */
  insignia?: number | null
}

/**
 * Botón circular inspirado en el Centro de Control: cristal grueso con refracción,
 * borde de luz, compresión con resorte al presionar y cambio claro de estado.
 */
export const GlassIconButton = forwardRef<HTMLButtonElement, GlassIconButtonProps>(function GlassIconButton(
  {
    icono,
    iconoActivo,
    etiqueta,
    mostrarEtiqueta,
    activo,
    tono = 'acento',
    tamano = 'md',
    insignia,
    className,
    type = 'button',
    ...props
  },
  ref,
) {
  const local = useRef<HTMLButtonElement>(null)
  useImperativeHandle(ref, () => local.current as HTMLButtonElement)
  usePointerSheen(local)
  const reducir = useReducedMotion()
  const icon = activo && iconoActivo ? iconoActivo : icono

  const boton = (
    <motion.button
      ref={local}
      type={type}
      aria-label={mostrarEtiqueta ? undefined : etiqueta}
      aria-pressed={activo === undefined ? undefined : activo}
      whileHover={reducir ? undefined : { y: -2, scale: 1.03 }}
      whileTap={reducir ? undefined : { scale: 0.88, y: 0 }}
      transition={resorte.presion}
      className={cn(
        'glass glass-thick glass-interactive glass-lens relative grid shrink-0 place-items-center rounded-full outline-none',
        'transition-[background-color,color] duration-300',
        activo ? (tono === 'luz' ? 'glass-on-luz' : 'glass-on-accent') : 'text-fg',
        tamanos[tamano],
        !mostrarEtiqueta && className,
      )}
      {...props}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={activo && iconoActivo ? 'activo' : 'inactivo'}
          initial={reducir ? false : { opacity: 0, scale: 0.6, rotate: -30 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          exit={reducir ? undefined : { opacity: 0, scale: 0.6, rotate: 30 }}
          transition={resorte.agil}
          className="grid place-items-center"
          aria-hidden
        >
          {icon}
        </motion.span>
      </AnimatePresence>
      {insignia ? (
        <span className="num absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-luz px-1.5 text-2xs font-bold text-luz-fg shadow-[0_2px_8px_rgba(249,194,6,0.5)]">
          {insignia > 99 ? '99+' : insignia}
        </span>
      ) : null}
    </motion.button>
  )

  if (!mostrarEtiqueta) return boton

  return (
    <div className={cn('flex w-[5.5rem] flex-col items-center gap-2 text-center', className)}>
      {boton}
      <span className="text-xs font-medium leading-tight text-fg-muted" aria-hidden>
        {etiqueta}
      </span>
      <span className="sr-only">{etiqueta}</span>
    </div>
  )
})
