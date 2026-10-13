import { Contrast, Droplets, Image, Sparkles, Square } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { GlassIconButton, GlassSurface, SegmentedControl, type Segmento } from '@/components/glass'
import { CtxEscenario, type Fondo } from './contexto'
import { CapaFondo } from './Fondos'

const CLAVE = 'impresiona:vitrina-fondo'
const ID_CONTENIDO = 'vitrina-contenido'

const FONDOS: Array<{ valor: Fondo; corto: string; nombre: string; icono: ReactNode; descripcion: string }> = [
  { valor: 'luz', corto: 'Luz', nombre: 'Campo de luz', icono: <Sparkles />, descripcion: 'El fondo de todas las pantallas del CRM.' },
  { valor: 'foto', corto: 'Foto', nombre: 'Fotográfico', icono: <Image />, descripcion: 'Colores intensos, como una foto de fondo de pantalla.' },
  { valor: 'rayas', corto: 'Rayas', nombre: 'Rayas', icono: <Contrast />, descripcion: 'Alto contraste: deja ver el desenfoque y la refracción de los bordes.' },
  { valor: 'liso', corto: 'Liso', nombre: 'Liso', icono: <Square />, descripcion: 'Nada que refractar: el borde de luz y la sombra hacen el trabajo.' },
]

function leerFondo(): Fondo {
  try {
    const v = localStorage.getItem(CLAVE)
    return FONDOS.some((f) => f.valor === v) ? (v as Fondo) : 'luz'
  } catch {
    return 'luz'
  }
}

/** Vista con transparencia reducida (la misma que usa el sistema operativo); se restaura al salir. */
function useTransparenciaReducida() {
  const [activa, setActiva] = useState(false)
  const previa = useRef<string | undefined>(undefined)
  useEffect(() => {
    previa.current = document.documentElement.dataset.transparencia
  }, [])
  useEffect(() => {
    const html = document.documentElement
    if (activa) html.dataset.transparencia = 'reducida'
    else if (previa.current) html.dataset.transparencia = previa.current
    else delete html.dataset.transparencia
  }, [activa])
  useEffect(
    () => () => {
      const html = document.documentElement
      if (previa.current) html.dataset.transparencia = previa.current
      else delete html.dataset.transparencia
    },
    [],
  )
  return [activa, setActiva] as const
}

/**
 * Escenario de la vitrina: un fondo propio (elegible) detrás de todas las muestras.
 * El cristal se prueba directamente sobre él.
 */
export function Escenario({ children }: { children: ReactNode }) {
  const [fondo, setFondo] = useState<Fondo>(leerFondo)
  const [foco, setFoco] = useState(false)
  const [reducida, setReducida] = useTransparenciaReducida()
  const ref = useRef<HTMLDivElement>(null)
  const contexto = useMemo(() => ({ ref, foco, setFoco }), [foco])
  const actual = FONDOS.find((f) => f.valor === fondo) ?? FONDOS[0]

  const cambiar = (v: Fondo) => {
    setFondo(v)
    try {
      localStorage.setItem(CLAVE, v)
    } catch {
      /* preferencia solo para esta visita */
    }
  }

  const segmentos: Segmento<Fondo>[] = FONDOS.map((f) => ({
    valor: f.valor,
    etiqueta: (
      <>
        <span className="hidden sm:contents [&_svg]:size-3.5" aria-hidden>
          {f.icono}
        </span>
        <span className="sm:hidden">{f.corto}</span>
        <span className="hidden sm:inline">{f.nombre}</span>
      </>
    ),
  }))

  return (
    <CtxEscenario.Provider value={contexto}>
      <div ref={ref} id={ID_CONTENIDO} role="region" aria-label="Vitrina" className="relative overflow-clip rounded-sheet">
        <CapaFondo fondo={fondo} foco={foco} />
        <div className="relative px-3 pb-6 pt-3 sm:px-5 md:px-6 md:pb-8 md:pt-4">
          {/* Barra del fondo: flota sobre la vitrina al recorrerla (en celular se queda arriba) */}
          <div className="z-10 mb-6 md:sticky md:top-[5.75rem]">
            <GlassSurface variante="fuerte" grueso className="flex items-center gap-3 rounded-full p-1.5 shadow-glass-lg">
              <SegmentedControl
                etiqueta="Fondo de la vitrina"
                segmentos={segmentos}
                valor={fondo}
                onCambio={cambiar}
                idPanel={ID_CONTENIDO}
                className="min-w-0 shrink"
              />
              <p className="hidden min-w-0 flex-1 truncate text-sm text-fg-muted lg:block" aria-live="polite">
                {actual.descripcion}
              </p>
              <GlassIconButton
                etiqueta="Ver con transparencia reducida"
                icono={<Droplets />}
                activo={reducida}
                tamano="sm"
                onClick={() => setReducida(!reducida)}
                className="ml-auto"
              />
            </GlassSurface>
          </div>
          {children}
        </div>
      </div>
    </CtxEscenario.Provider>
  )
}
