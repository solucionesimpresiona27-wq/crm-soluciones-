import { useQuery } from '@tanstack/react-query'
import { Camera, FileText, ImageOff } from 'lucide-react'
import { useRef } from 'react'
import { toast } from 'sonner'
import { GlassButton, GlassCard } from '@/components/glass'
import { api } from '@/data/api'
import type { HojaOrden } from '@/data/modulos/produccion/contrato'
import { haceCuanto } from '@/lib/format'
import { useSubirEvidencia } from '../consultas'

type Evidencia = HojaOrden['evidencias'][number]

const PESO_MAXIMO = 25 * 1024 * 1024

/** Fotos de entrega o instalación: se toman con la cámara del celular y quedan en el pedido. */
export function Evidencias({ pedidoId, evidencias, puedeSubir }: { pedidoId: string; evidencias: Evidencia[]; puedeSubir: boolean }) {
  const entrada = useRef<HTMLInputElement>(null)
  const subir = useSubirEvidencia(pedidoId)

  const elegir = (lista: FileList | null) => {
    const fotos = [...(lista ?? [])]
    if (entrada.current) entrada.current.value = ''
    if (!fotos.length) return
    const pesadas = fotos.filter((f) => f.size > PESO_MAXIMO)
    if (pesadas.length) {
      toast.error('Hay archivos de más de 25 MB', {
        description: 'Toma la foto de nuevo con menor resolución o súbela comprimida.',
      })
      return
    }
    subir.mutate(fotos)
  }

  return (
    <GlassCard variante="fuerte" className="no-print" aria-labelledby="titulo-evidencias">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="titulo-evidencias" className="text-md font-semibold text-fg">
            Evidencias
          </h2>
          <p className="mt-0.5 text-sm text-fg-muted">Fotos del trabajo entregado o instalado.</p>
        </div>
        {evidencias.length ? <span className="num rounded-full bg-[var(--control-bg)] px-2 text-xs font-bold text-fg-muted">{evidencias.length}</span> : null}
      </div>

      {evidencias.length ? (
        <ul className="mt-4 grid grid-cols-3 gap-2">
          {evidencias.map((e) => (
            <Miniatura key={e.id} e={e} />
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-tile border border-dashed border-[var(--divider)] px-4 py-5 text-center text-sm text-fg-subtle">
          Aún no hay fotos. Tómalas al terminar la instalación o al entregar.
        </p>
      )}

      {puedeSubir ? (
        <>
          <input
            ref={entrada}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            capture="environment"
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => elegir(e.target.files)}
          />
          <GlassButton variante="cristal" icono={<Camera />} cargando={subir.isPending} onClick={() => entrada.current?.click()} className="mt-4 w-full">
            {subir.isPending ? 'Subiendo…' : 'Subir fotos de evidencia'}
          </GlassButton>
        </>
      ) : null}
    </GlassCard>
  )
}

function Miniatura({ e }: { e: Evidencia }) {
  const imagen = (e.mime ?? '').startsWith('image/')
  const url = useQuery({
    queryKey: ['produccion', 'evidencia', e.id],
    queryFn: () => api.archivos.url(e.id),
    staleTime: 8 * 60_000,
    enabled: e.tiene_archivo || Boolean(e.enlace_externo),
  })
  const abrir = () => {
    if (url.data) window.open(url.data, '_blank', 'noopener')
    else
      toast.error('No se pudo abrir la evidencia', {
        description: 'El enlace caducó o no hay conexión. Recarga la página e inténtalo de nuevo.',
      })
  }
  return (
    <li>
      <button
        type="button"
        onClick={abrir}
        title={`${e.nombre}${e.subido_por ? ` · ${e.subido_por}` : ''} · ${haceCuanto(e.created_at)}`}
        aria-label={`Abrir evidencia ${e.nombre}`}
        className="group relative grid aspect-square w-full place-items-center overflow-hidden rounded-tile bg-[var(--control-bg)] text-fg-subtle outline-none focus-visible:ring-2 focus-visible:ring-accent [&_svg]:size-6"
      >
        {imagen && url.data ? (
          <img src={url.data} alt="" loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
        ) : imagen && url.isError ? (
          <ImageOff aria-hidden />
        ) : imagen ? (
          <span className="size-full animate-pulse bg-fg/[0.06]" aria-hidden />
        ) : (
          <FileText aria-hidden />
        )}
      </button>
    </li>
  )
}
