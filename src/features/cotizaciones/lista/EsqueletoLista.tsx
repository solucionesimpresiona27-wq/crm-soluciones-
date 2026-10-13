import { GlassPanel, Skeleton } from '@/components/glass'

/** Carga de la lista con la misma silueta que el contenido final. */
export function EsqueletoLista({ escritorio }: { escritorio: boolean }) {
  if (!escritorio) {
    return (
      <div className="grid gap-2.5 md:grid-cols-2" role="status" aria-label="Cargando cotizaciones">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[9.5rem] rounded-tile" />
        ))}
      </div>
    )
  }
  return (
    <GlassPanel className="p-2" role="status" aria-label="Cargando cotizaciones">
      <div className="flex gap-6 px-4 pb-3 pt-3">
        {['w-12', 'w-24', 'w-14', 'w-20', 'w-14', 'w-10'].map((w, i) => (
          <Skeleton key={i} className={`h-3 rounded-full ${w}`} />
        ))}
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-6 border-t border-[var(--divider)] px-4 py-4">
          <Skeleton className="h-4 w-20 rounded-full" />
          <div className="flex w-56 flex-col gap-1.5">
            <Skeleton className="h-4 w-44 rounded-full" />
            <Skeleton className="h-3 w-32 rounded-full" />
          </div>
          <Skeleton className="h-4 w-16 rounded-full" />
          <Skeleton className="h-4 w-20 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="ml-auto h-4 w-24 rounded-full" />
        </div>
      ))}
    </GlassPanel>
  )
}
