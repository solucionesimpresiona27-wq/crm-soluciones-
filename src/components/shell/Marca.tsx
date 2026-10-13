import { useTema } from '@/app/tema'
import { cn } from '@/lib/utils'

const base = import.meta.env.BASE_URL

/** Logo completo o isotipo, en su versión para fondo claro u oscuro. */
export function Marca({ variante = 'completo', className }: { variante?: 'completo' | 'isotipo'; className?: string }) {
  const { efectivo } = useTema()
  const oscuro = efectivo === 'oscuro'
  const src =
    variante === 'completo'
      ? `${base}brand/${oscuro ? 'logo-blanco' : 'logo'}.png`
      : `${base}brand/${oscuro ? 'isotipo-blanco' : 'isotipo'}.png`
  return (
    <img
      src={src}
      alt="Soluciones Impresiona"
      className={cn('select-none object-contain', className)}
      draggable={false}
      decoding="async"
    />
  )
}
