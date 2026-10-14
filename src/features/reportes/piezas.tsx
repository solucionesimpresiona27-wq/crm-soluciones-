import { Download, RotateCcw, SearchX } from 'lucide-react'
import type { ReactNode } from 'react'
import { useSesion } from '@/app/sesion'
import { EstadoVacio, GlassButton, GlassPanel, Skeleton } from '@/components/glass'
import { cn } from '@/lib/utils'

/** Encabezado de sección: título, descripción y exportación CSV (solo con exportar_datos). */
export function EncabezadoSeccion({ titulo, descripcion, onExportar, acciones, id }: { titulo: string; descripcion?: ReactNode; onExportar?: () => void; acciones?: ReactNode; id?: string }) {
  const { puede } = useSesion()
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 px-1">
      <div className="min-w-0">
        <h2 id={id} className="text-lg font-semibold tracking-tight text-fg">
          {titulo}
        </h2>
        {descripcion ? <p className="mt-0.5 text-sm text-fg-muted">{descripcion}</p> : null}
      </div>
      <div className="flex items-center gap-2">
        {acciones}
        {onExportar && puede('exportar_datos') ? (
          <GlassButton variante="cristal" tamano="sm" icono={<Download />} onClick={onExportar} className="pointer-coarse:h-11" aria-label={`Exportar ${titulo.toLowerCase()} a CSV`}>
            Exportar CSV
          </GlassButton>
        ) : null}
      </div>
    </div>
  )
}

export function ErrorSeccion({ que, error, onReintentar }: { que: string; error: Error; onReintentar: () => void }) {
  return (
    <GlassPanel>
      <EstadoVacio
        icono={<SearchX />}
        titulo={`No se pudo cargar ${que}`}
        descripcion={`${error.message}. Revisa tu conexión o el periodo e inténtalo de nuevo.`}
        accion={
          <GlassButton icono={<RotateCcw />} onClick={onReintentar}>
            Reintentar
          </GlassButton>
        }
      />
    </GlassPanel>
  )
}

export function CargandoSeccion({ alto = 'h-64', className }: { alto?: string; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3', className)} aria-hidden>
      <Skeleton className="h-6 w-48 rounded-full" />
      <Skeleton className={cn('rounded-module', alto)} />
    </div>
  )
}

/** Muestra de color de una serie (la identidad nunca va solo en color: siempre con texto). */
export function Muestra({ color, linea }: { color: string; linea?: boolean }) {
  return linea ? (
    <span className="inline-block h-0.5 w-3.5 rounded-full border-t-2 border-dashed" style={{ borderColor: color }} aria-hidden />
  ) : (
    <span className="inline-block size-2.5 rounded-[3px]" style={{ background: color }} aria-hidden />
  )
}
