import { Skeleton } from '@/components/glass'
import { cn } from '@/lib/utils'
import { claseCelda, type ModuloPanel } from './composicion'

export const CUADRICULA = 'grid grid-flow-row-dense grid-cols-2 auto-rows-[minmax(9.5rem,auto)] gap-3 md:gap-4 lg:grid-cols-4'

/** Carga con la misma forma de la cuadrícula para que nada salte al llegar los datos. */
export function EsqueletoPanel({ modulos }: { modulos: ModuloPanel[] }) {
  return (
    <div role="status" aria-label="Cargando el panel">
      <div className="mb-5 mt-1 flex flex-col px-1">
        <Skeleton className="h-8 w-64 rounded-full md:h-[2.4rem]" />
        <Skeleton className="mt-2 h-4 w-80 max-w-full rounded-full md:h-5" />
      </div>
      <div className={CUADRICULA}>
        {modulos.map((m) =>
          m.id === 'medidores' ? (
            <div key={m.id} className={cn(claseCelda(m), 'grid grid-cols-2 gap-3')}>
              <Skeleton className="h-full rounded-[2rem]" />
              <Skeleton className="h-full rounded-[2rem]" />
            </div>
          ) : (
            <Skeleton key={m.id} className={cn(claseCelda(m), 'h-full min-h-[9.5rem] rounded-module')} />
          ),
        )}
      </div>
    </div>
  )
}
