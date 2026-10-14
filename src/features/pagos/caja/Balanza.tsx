import { Check, Minus, Plus } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion, type Transition } from 'motion/react'
import { dinero } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Resorte del "encaje": más rebote que los del sistema, solo para este momento. */
const ENCAJE: Transition = { type: 'spring', stiffness: 460, damping: 17, mass: 0.9 }
const DESLIZ: Transition = { type: 'spring', visualDuration: 0.5, bounce: 0.1 }

/**
 * Balanza del cuadre: la ranura del centro es el efectivo esperado y la ficha es lo contado.
 * Si falta, la ficha se queda a la izquierda; si sobra, a la derecha (con luz amarilla).
 * Cuando la diferencia es cero, la ficha "encaja" en la ranura con un resorte y se pone azul.
 */
export function Balanza({ esperado, diferencia }: { esperado: number; diferencia: number | null }) {
  const reducir = useReducedMotion()
  const contado = diferencia !== null
  const cuadra = contado && Math.abs(diferencia) < 0.005
  const escala = Math.max(500, esperado * 0.2)
  const fraccion = !contado ? -1 : cuadra ? 0 : Math.sign(diferencia) * Math.min(1, Math.sqrt(Math.abs(diferencia) / escala))
  // La ficha nunca toca el borde: como mucho, 40 % del ancho a cada lado (y al menos 8 % si hay diferencia)
  const desplazamiento = !contado ? -40 : cuadra ? 0 : Math.sign(fraccion) * Math.max(8, Math.abs(fraccion) * 40)
  const Icono = cuadra ? Check : !contado ? Minus : diferencia < 0 ? Minus : Plus

  const texto = !contado ? 'Escribe el efectivo contado' : cuadra ? 'Cuadra exacto' : diferencia < 0 ? `Faltan ${dinero(-diferencia)}` : `Sobran ${dinero(diferencia)}`

  return (
    <div role="img" aria-label={`Cuadre de caja: ${texto}. Esperado ${dinero(esperado)}.`} className="select-none">
      <div className="relative h-16 overflow-hidden rounded-full bg-[var(--control-bg)] shadow-[inset_0_1px_3px_rgb(0_0_0/0.12)]">
        {/* Marcas del riel */}
        <div className="absolute inset-x-8 top-1/2 flex -translate-y-1/2 justify-between" aria-hidden>
          {Array.from({ length: 11 }).map((_, i) => (
            <span key={i} className={cn('w-px rounded-full bg-fg/15', i === 5 ? 'h-0' : i % 5 === 0 ? 'h-5' : 'h-2.5')} />
          ))}
        </div>
        {/* Ranura del esperado */}
        <div className="absolute inset-0 grid place-items-center" aria-hidden>
          <span
            className={cn(
              'size-[3.25rem] rounded-full border-2 border-dashed transition-colors duration-300',
              cuadra ? 'border-transparent bg-accent/15 dark:bg-navy-300/20' : 'border-fg/25',
            )}
          />
        </div>
        {/* Ficha: el contenedor ocupa todo el riel, así x en % es relativo al ancho del riel */}
        <motion.div
          className="absolute inset-0 grid place-items-center"
          initial={false}
          animate={{ x: `${desplazamiento}%` }}
          transition={reducir ? { duration: 0 } : cuadra ? ENCAJE : DESLIZ}
          aria-hidden
        >
          <motion.span
            key={cuadra ? 'cuadra' : 'libre'}
            initial={reducir || !cuadra ? false : { scale: 1.18 }}
            animate={{ scale: 1 }}
            transition={ENCAJE}
            className={cn(
              'glass glass-thick grid size-12 place-items-center rounded-full transition-[background-color,color,box-shadow] duration-300 [&_svg]:size-5',
              !contado ? 'text-fg-subtle' : cuadra ? 'glass-on-accent' : 'glass-on-luz shadow-[0_0_22px_rgba(249,194,6,0.55)]',
            )}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={!contado ? 'vacio' : cuadra ? 'cuadra' : diferencia < 0 ? 'falta' : 'sobra'}
                initial={reducir ? false : { opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reducir ? undefined : { opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.15 }}
                className="grid place-items-center"
              >
                <Icono strokeWidth={2.5} />
              </motion.span>
            </AnimatePresence>
          </motion.span>
        </motion.div>
      </div>
      <div className="mt-2 grid grid-cols-3 text-xs font-medium text-fg-subtle" aria-hidden>
        <span>Falta</span>
        <span className="text-center">Esperado</span>
        <span className="text-right">Sobra</span>
      </div>
    </div>
  )
}
