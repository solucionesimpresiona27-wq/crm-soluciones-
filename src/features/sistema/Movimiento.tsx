import { Play } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { GlassButton, GlassSurface } from '@/components/glass'
import { resorte } from '@/lib/motion'
import { cn } from '@/lib/utils'

type Clave = keyof typeof resorte

const RESORTES: Array<{ clave: Clave; nombre: string; uso: string }> = [
  { clave: 'presion', nombre: 'Presión', uso: 'Botones y controles al tocarlos' },
  { clave: 'agil', nombre: 'Ágil', uso: 'Interruptores e indicadores' },
  { clave: 'suave', nombre: 'Suave', uso: 'Entrada de tarjetas y paneles' },
  { clave: 'expansion', nombre: 'Expansión', uso: 'Módulos que se amplían' },
  { clave: 'modal', nombre: 'Ventana', uso: 'Ventanas emergentes' },
]

/** Parámetros legibles, tomados del propio resorte para que nunca se desfasen. */
function parametros(clave: Clave) {
  const r = resorte[clave]
  if ('stiffness' in r) return `Rigidez ${r.stiffness}, amortiguación ${r.damping}, masa ${r.mass}`
  return `${r.visualDuration} s, rebote ${r.bounce}`
}

/**
 * Pistas de comparación: la misma ficha recorre la misma distancia con cada resorte.
 * Con "reducir movimiento" activo, la ficha llega sin animarse.
 */
export function MuestrarioMovimiento() {
  const [lados, setLados] = useState<boolean[]>(() => RESORTES.map(() => false))
  const todos = lados.every(Boolean)

  return (
    <GlassSurface className="flex flex-col gap-4 rounded-module p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-fg-muted">Toca una pista o reprodúcelas juntas para comparar.</p>
        <GlassButton variante="primario" icono={<Play />} onClick={() => setLados(RESORTES.map(() => !todos))}>
          Reproducir las cinco
        </GlassButton>
      </div>
      <ol className="flex flex-col gap-3">
        {RESORTES.map((r, i) => {
          const lado = lados[i]
          return (
            <li key={r.clave} className="grid items-center gap-x-5 gap-y-2 md:grid-cols-[11rem_minmax(0,1fr)_14rem]">
              <div className="flex items-baseline justify-between gap-3 md:block">
                <p className="text-sm font-semibold text-fg">{r.nombre}</p>
                <p className="text-xs text-fg-muted">{r.uso}</p>
              </div>
              <button
                type="button"
                aria-label={`Mover la ficha con el resorte ${r.nombre}`}
                onClick={() => setLados((l) => l.map((v, j) => (j === i ? !v : v)))}
                className="relative h-12 w-full rounded-full bg-[var(--control-bg)] shadow-[inset_0_1px_3px_rgb(var(--line)/0.14),inset_0_-1px_0_var(--inner-hi)] outline-none focus-visible:shadow-[var(--focus-ring)]"
              >
                {/* El contenedor mide el recorrido: x = 100% lo lleva al otro extremo */}
                <motion.span
                  className="absolute inset-y-1 left-1 right-11"
                  initial={false}
                  animate={{ x: lado ? '100%' : '0%' }}
                  transition={resorte[r.clave]}
                >
                  <span
                    className={cn(
                      'glass glass-thick block size-10 rounded-full transition-colors duration-300',
                      lado ? 'glass-on-luz' : 'glass-on-accent',
                    )}
                  />
                </motion.span>
              </button>
              <p className="num text-xs text-fg-subtle md:text-right">{parametros(r.clave)}</p>
            </li>
          )
        })}
      </ol>
    </GlassSurface>
  )
}
