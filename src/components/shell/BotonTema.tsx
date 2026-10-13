import { Moon, Sun } from 'lucide-react'
import { useTema } from '@/app/tema'
import { GlassIconButton } from '@/components/glass'

/** Interruptor claro/oscuro estilo Centro de Control. La luz se expande desde el botón. */
export function BotonTema({ tamano = 'sm' }: { tamano?: 'sm' | 'md' }) {
  const { efectivo, alternar } = useTema()
  const oscuro = efectivo === 'oscuro'
  return (
    <GlassIconButton
      etiqueta={oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      icono={<Moon />}
      iconoActivo={<Sun />}
      activo={!oscuro}
      tono="luz"
      tamano={tamano}
      onClick={(e) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
        alternar({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
      }}
    />
  )
}
