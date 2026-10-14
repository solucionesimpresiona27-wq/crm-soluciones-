import { Check } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'
import { resorte } from '@/lib/motion'
import { cn } from '@/lib/utils'

/** Casilla del taller: se "enciende" en luz amarilla al marcarse. Área táctil de 44 px. */
export function Casilla({
  marcada,
  onCambio,
  children,
  className,
}: {
  marcada: boolean
  onCambio: (v: boolean) => void
  children: ReactNode
  className?: string
}) {
  const reducir = useReducedMotion()
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={marcada}
      onClick={() => onCambio(!marcada)}
      className={cn(
        'group flex min-h-11 w-full items-center gap-3 rounded-control px-2 text-left text-sm outline-none transition-colors hover:bg-[var(--control-bg)] focus-visible:ring-2 focus-visible:ring-accent dark:focus-visible:ring-navy-200',
        marcada ? 'text-fg-muted' : 'text-fg',
        className,
      )}
    >
      <span
        className={cn(
          'grid size-6 shrink-0 place-items-center rounded-[8px] border-[1.5px] transition-colors duration-200',
          marcada ? 'border-luz bg-luz text-luz-fg shadow-[0_2px_10px_-2px_rgba(249,194,6,0.7)]' : 'border-fg/25 bg-[var(--control-bg)]',
        )}
        aria-hidden
      >
        {marcada ? (
          <motion.span initial={reducir ? false : { scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={resorte.presion}>
            <Check className="size-4" strokeWidth={3} />
          </motion.span>
        ) : null}
      </span>
      <span className={cn('min-w-0 flex-1', marcada && 'line-through decoration-fg/30')}>{children}</span>
    </button>
  )
}

/** Casillas marcadas de una orden, recordadas en este navegador (comodidad del taller, no es registro oficial). */
export function useCasillas(ordenId: string) {
  const clave = `impresiona:orden:${ordenId}:casillas`
  const [marcadas, setMarcadas] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem(clave) ?? '{}') as Record<string, boolean>
    } catch {
      return {}
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(clave, JSON.stringify(marcadas))
    } catch {
      /* sin almacenamiento: solo dura mientras la página está abierta */
    }
  }, [clave, marcadas])
  return [marcadas, (id: string, v: boolean) => setMarcadas((m) => ({ ...m, [id]: v }))] as const
}
