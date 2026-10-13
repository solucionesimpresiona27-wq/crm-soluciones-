import { Copy, Lock, Save, Star, Trash2, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { GlassButton, GlassSurface } from '@/components/glass'
import { Subtitulo } from './piezas'

type Variante = 'primario' | 'luz' | 'cristal' | 'fantasma' | 'peligro'

const VARIANTES: Array<{ variante: Variante; nombre: string; uso: string; texto: string; icono: ReactNode }> = [
  { variante: 'primario', nombre: 'Principal', uso: 'Una por pantalla', texto: 'Guardar', icono: <Save /> },
  { variante: 'luz', nombre: 'Luz', uso: 'Lo que debe destacar', texto: 'Destacar', icono: <Star /> },
  { variante: 'cristal', nombre: 'Cristal', uso: 'Acciones secundarias', texto: 'Duplicar', icono: <Copy /> },
  { variante: 'fantasma', nombre: 'Fantasma', uso: 'Cancelar, volver', texto: 'Cancelar', icono: <X /> },
  { variante: 'peligro', nombre: 'Peligro', uso: 'Borrar o anular', texto: 'Eliminar', icono: <Trash2 /> },
]

/** Botones cápsula: cada variante en sus tres tamaños y en versión de solo ícono. */
export function MuestrarioCapsulas() {
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!guardando) return
    const t = setTimeout(() => setGuardando(false), 1800)
    return () => clearTimeout(t)
  }, [guardando])

  return (
    <GlassSurface className="flex h-full flex-col gap-5 rounded-module p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:grid sm:grid-cols-[minmax(7rem,auto)_repeat(4,max-content)] sm:items-center sm:gap-x-4 sm:gap-y-3">
        {/* Encabezados de columna (solo con espacio para la tabla) */}
        <div className="hidden sm:contents" aria-hidden>
          <span />
          <span className="text-xs font-semibold text-fg-subtle">sm, 36 px</span>
          <span className="text-xs font-semibold text-fg-subtle">md, 44 px</span>
          <span className="text-xs font-semibold text-fg-subtle">lg, 52 px</span>
          <span className="text-xs font-semibold text-fg-subtle">Ícono</span>
        </div>
        {VARIANTES.map((v) => (
          <div key={v.variante} className="flex flex-col gap-2 sm:contents">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-fg">{v.nombre}</p>
              <p className="text-xs text-fg-muted">{v.uso}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 sm:contents">
              <div>
                <GlassButton variante={v.variante} tamano="sm">
                  {v.texto}
                </GlassButton>
              </div>
              <div>
                <GlassButton variante={v.variante} tamano="md" icono={v.icono}>
                  {v.texto}
                </GlassButton>
              </div>
              <div>
                <GlassButton variante={v.variante} tamano="lg" icono={v.icono}>
                  {v.texto}
                </GlassButton>
              </div>
              <div>
                <GlassButton variante={v.variante} tamano="icono" icono={v.icono} aria-label={v.texto} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="hairline" />

      <div>
        <Subtitulo detalle="Mientras trabaja, el botón no acepta otro clic">Estados</Subtitulo>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <GlassButton variante="primario" icono={<Save />} cargando={guardando} onClick={() => setGuardando(true)}>
            {guardando ? 'Guardando…' : 'Guardar cotización'}
          </GlassButton>
          <GlassButton variante="cristal" icono={<Lock />} disabled>
            Aprobar diseño
          </GlassButton>
        </div>
      </div>
    </GlassSurface>
  )
}
