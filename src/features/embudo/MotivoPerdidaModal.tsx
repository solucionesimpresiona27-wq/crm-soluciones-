import { useEffect, useState, type FormEvent } from 'react'
import { Campo, GlassButton, GlassModal, GlassTextarea } from '@/components/glass'
import { cn } from '@/lib/utils'
import { MOTIVOS_PERDIDA } from './util'

/** Pide el motivo antes de pasar una oportunidad a "Perdido" (la base también lo exige). */
export function MotivoPerdidaModal({ titulo, abierto, onCambio, onConfirmar }: { titulo: string; abierto: boolean; onCambio: (a: boolean) => void; onConfirmar: (motivo: string) => void }) {
  const [rapido, setRapido] = useState<string | null>(null)
  const [detalle, setDetalle] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (abierto) {
      setRapido(null)
      setDetalle('')
      setError(null)
    }
  }, [abierto])

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    const motivo = [rapido === 'Otro' ? null : rapido, detalle.trim() || null].filter(Boolean).join(': ')
    if (!motivo) {
      setError(rapido === 'Otro' ? 'Escribe cuál fue el motivo.' : 'Elige un motivo o escríbelo para poder marcarla como perdida.')
      return
    }
    onConfirmar(motivo)
  }

  return (
    <GlassModal
      abierto={abierto}
      onCambio={onCambio}
      ancho="sm"
      titulo="¿Por qué se perdió?"
      descripcion={`“${titulo}” pasará a Perdido. El motivo ayuda a entender qué ajustar.`}
      pie={
        <>
          <GlassButton variante="fantasma" onClick={() => onCambio(false)}>
            Cancelar
          </GlassButton>
          <GlassButton variante="peligro" type="submit" form="form-perdida">
            Marcar como perdida
          </GlassButton>
        </>
      }
    >
      <form id="form-perdida" onSubmit={enviar} className="flex flex-col gap-4">
        <div role="radiogroup" aria-label="Motivo rápido" className="flex flex-wrap gap-2">
          {MOTIVOS_PERDIDA.map((m) => {
            const activo = rapido === m
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={activo}
                onClick={() => {
                  setRapido(activo ? null : m)
                  setError(null)
                }}
                className={cn(
                  'h-11 rounded-full px-4 text-sm font-semibold outline-none transition-colors',
                  activo ? 'bg-accent text-white shadow-[0_6px_18px_-8px_rgba(34,66,107,0.8)] dark:bg-navy-400' : 'glass glass-thick text-fg-muted hover:text-fg',
                )}
              >
                {m}
              </button>
            )
          })}
        </div>
        <Campo etiqueta={rapido === 'Otro' ? 'Motivo' : 'Detalle'} opcional={rapido !== 'Otro'} error={error}>
          {(id, p) => (
            <GlassTextarea
              id={id}
              {...p}
              rows={3}
              value={detalle}
              onChange={(e) => {
                setDetalle(e.target.value)
                setError(null)
              }}
              placeholder="Ej. El cliente consiguió la lona más barata en otro lado"
            />
          )}
        </Campo>
      </form>
    </GlassModal>
  )
}
