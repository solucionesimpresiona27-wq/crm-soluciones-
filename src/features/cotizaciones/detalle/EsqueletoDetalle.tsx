import { GlassPanel, Skeleton } from '@/components/glass'

export function EsqueletoDetalle() {
  return (
    <div className="flex flex-col gap-6 pt-1" role="status" aria-label="Cargando cotización">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex items-start gap-3">
          <Skeleton className="size-11 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-40 rounded-full" />
            <Skeleton className="h-8 w-72 rounded-full" />
            <Skeleton className="h-4 w-52 rounded-full" />
          </div>
        </div>
        <div className="flex gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="size-[3.25rem] rounded-full" />
          ))}
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <GlassPanel className="flex flex-col gap-5 p-8">
          <div className="flex justify-between">
            <Skeleton className="h-12 w-44 rounded-control" />
            <Skeleton className="h-12 w-36 rounded-control" />
          </div>
          <Skeleton className="h-24 w-full rounded-control" />
          <Skeleton className="h-48 w-full rounded-control" />
        </GlassPanel>
        <div className="flex flex-col gap-5">
          <Skeleton className="h-64 rounded-module" />
          <Skeleton className="h-48 rounded-module" />
        </div>
      </div>
    </div>
  )
}
