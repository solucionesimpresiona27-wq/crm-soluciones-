import { useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { GlassSurface, Pildora, type VarianteCristal } from '@/components/glass'
import { resorte } from '@/lib/motion'

interface Especimen {
  nombre: string
  uso: string
  variante?: VarianteCristal
  grueso?: boolean
  interactivo?: boolean
  lente?: boolean
}

const ESPECIMENES: Especimen[] = [
  { nombre: 'Regular', uso: 'Módulos y controles del panel de control.' },
  { nombre: 'Fuerte', uso: 'Tablas, formularios y precios: todo lo que se lee con calma.', variante: 'fuerte' },
  { nombre: 'Claro', uso: 'Capas decorativas y fondos de selectores. No lleva texto largo.', variante: 'claro' },
  { nombre: 'Grueso', uso: 'Borde de luz marcado, para botones tipo Centro de Control.', grueso: true },
  { nombre: 'Interactivo', uso: 'El reflejo sigue al puntero y se eleva al pasar el cursor.', interactivo: true },
  { nombre: 'Lente', uso: 'Refracta el fondo en los bordes, como vidrio curvo.', lente: true },
]

/**
 * Las seis superficies van directo sobre el fondo del escenario (sin cristal detrás),
 * para que cada una muestre cómo desenfoca y refracta lo que tiene debajo.
 */
export function MuestrarioSuperficies() {
  const reducir = useReducedMotion()
  // Se lee una vez: la clase la pone main.tsx al arrancar
  const [lenteActiva] = useState(() => document.documentElement.classList.contains('lens-ready'))

  return (
    <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
      {ESPECIMENES.map((e) => (
        <GlassSurface
          key={e.nombre}
          variante={e.variante}
          grueso={e.grueso}
          interactivo={e.interactivo}
          lente={e.lente}
          whileTap={e.interactivo && !reducir ? { scale: 0.98 } : undefined}
          transition={resorte.presion}
          className="flex min-h-36 flex-col justify-end gap-1 rounded-module p-5 sm:min-h-44"
        >
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-lg font-semibold tracking-tight text-fg">{e.nombre}</h4>
            {e.lente ? (
              <Pildora tono={lenteActiva ? 'exito' : 'neutro'}>{lenteActiva ? 'Activa aquí' : 'No disponible aquí'}</Pildora>
            ) : null}
          </div>
          <p className="max-w-xs text-sm text-fg-muted">
            {e.uso}
            {e.lente ? (lenteActiva ? '' : ' Este navegador usa el desenfoque normal.') : ''}
          </p>
        </GlassSurface>
      ))}
    </div>
  )
}
