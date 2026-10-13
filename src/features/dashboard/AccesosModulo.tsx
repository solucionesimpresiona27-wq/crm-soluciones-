import { CuadriculaAcciones } from '@/components/shell/CuadriculaAcciones'
import { useEsMovil } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'
import type { Tamano } from './composicion'
import { Modulo } from './Modulo'

/** Accesos directos en botones circulares, como el bloque de conectividad del Centro de Control. */
export function AccesosModulo({ tamano }: { tamano: Tamano }) {
  const movil = useEsMovil()
  const angosto = tamano === '1x2'
  return (
    <Modulo etiqueta="Accesos directos" className="grid place-items-center">
      <h3 className="sr-only">Accesos directos</h3>
      <CuadriculaAcciones
        tamano={movil || angosto ? 'md' : 'lg'}
        className={cn('h-full w-full content-evenly', angosto && 'grid-cols-2')}
      />
    </Modulo>
  )
}
