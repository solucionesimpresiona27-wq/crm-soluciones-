import { Box, Briefcase, CalendarSync, Clock, ConciergeBell, Grid2x2, Layers, Ruler } from 'lucide-react'
import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { GlassIconButton } from '@/components/glass'
import type { MetodoCalculo } from '@/data/tipos'
import { METODOS } from '@/lib/calculadora'

export const METODOS_ORDEN = Object.keys(METODOS) as MetodoCalculo[]

export const ICONO_METODO: Record<MetodoCalculo, ReactNode> = {
  pieza: <Box />,
  m2: <Grid2x2 />,
  metro_lineal: <Ruler />,
  millar: <Layers />,
  hora: <Clock />,
  servicio: <ConciergeBell />,
  proyecto: <Briefcase />,
  mensualidad: <CalendarSync />,
}

export const CORTO_METODO: Record<MetodoCalculo, string> = {
  pieza: 'Pieza',
  m2: 'm²',
  metro_lineal: 'Metro lineal',
  millar: 'Millar',
  hora: 'Hora',
  servicio: 'Servicio',
  proyecto: 'Proyecto',
  mensualidad: 'Mensual',
}

/** Método de cobro como fila de botones circulares; se comporta como grupo de opciones. */
export function SelectorMetodo({ valor, onCambio }: { valor: MetodoCalculo; onCambio: (m: MetodoCalculo) => void }) {
  const botones = useRef<Array<HTMLButtonElement | null>>([])
  const alTeclear = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    let j = i
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % METODOS_ORDEN.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + METODOS_ORDEN.length) % METODOS_ORDEN.length
    else if (e.key === 'Home') j = 0
    else if (e.key === 'End') j = METODOS_ORDEN.length - 1
    else return
    e.preventDefault()
    onCambio(METODOS_ORDEN[j])
    botones.current[j]?.focus()
  }
  return (
    <div role="radiogroup" aria-label="Cómo se cobra" className="grid grid-cols-4 justify-items-center gap-x-1 gap-y-3 sm:grid-cols-8">
      {METODOS_ORDEN.map((m, i) => {
        const activo = m === valor
        return (
          <GlassIconButton
            key={m}
            ref={(el) => {
              botones.current[i] = el
            }}
            etiqueta={CORTO_METODO[m]}
            aria-label={METODOS[m].etiqueta}
            mostrarEtiqueta
            tamano="sm"
            icono={ICONO_METODO[m]}
            destacado={activo}
            role="radio"
            aria-checked={activo}
            tabIndex={activo ? 0 : -1}
            onClick={() => onCambio(m)}
          onKeyDown={(e) => alTeclear(e, i)}
          />
        )
      })}
    </div>
  )
}

