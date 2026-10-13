import { motion, type HTMLMotionProps } from 'motion/react'
import { forwardRef, useImperativeHandle, useRef } from 'react'
import { usePointerSheen } from '@/hooks/usePointerSheen'
import { cn } from '@/lib/utils'

export type VarianteCristal = 'regular' | 'fuerte' | 'claro'

export interface GlassSurfaceProps extends HTMLMotionProps<'div'> {
  /** regular: widgets y controles · fuerte: contenido con datos · claro: capas decorativas */
  variante?: VarianteCristal
  /** Borde de luz grueso, para controles tipo Centro de Control */
  grueso?: boolean
  /** Reflejo que sigue al puntero y elevación al pasar el cursor */
  interactivo?: boolean
  /** Refracción tipo lente (solo en navegadores compatibles) */
  lente?: boolean | 'capsula'
}

const variantes: Record<VarianteCristal, string> = {
  regular: '',
  fuerte: 'glass-strong',
  claro: 'glass-clear',
}

/**
 * Superficie base del sistema. Todas las piezas de cristal (tarjetas, paneles,
 * botones, menús) comparten este material y sus tokens.
 */
export const GlassSurface = forwardRef<HTMLDivElement, GlassSurfaceProps>(function GlassSurface(
  { variante = 'regular', grueso, interactivo, lente, className, children, ...props },
  ref,
) {
  const local = useRef<HTMLDivElement>(null)
  useImperativeHandle(ref, () => local.current as HTMLDivElement)
  usePointerSheen(local, Boolean(interactivo))

  return (
    <motion.div
      ref={local}
      className={cn(
        'glass',
        variantes[variante],
        grueso && 'glass-thick',
        interactivo && 'glass-interactive',
        lente && 'glass-lens',
        lente === 'capsula' && 'glass-capsule-lens',
        className,
      )}
      {...props}
    >
      {children}
    </motion.div>
  )
})
