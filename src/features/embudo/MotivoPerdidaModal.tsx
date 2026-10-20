import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Campo, GlassButton, GlassModal, GlassTextarea } from '@/components/glass'
import { cn } from '@/lib/utils'
import { enfocarSinDesplazar, MOTIVOS_PERDIDA } from './util'

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

  // Grupo de radio accesible: las flechas cambian de motivo y Tab sale del grupo
  const moverConFlechas = (e: KeyboardEvent<HTMLDivElement>) => {
    const paso = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!paso) return
    e.preventDefault()
    const botones = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')]
    const actual = botones.indexOf(document.activeElement as HTMLButtonElement)
    const siguiente = (actual + paso + botones.length) % botones.length
    botones[siguiente]?.focus()
    setRapido(MOTIVOS_PERDIDA[siguiente]!)
    setError(null)
  }

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    const motivo = [rapido === 'Otro' ? null : rapido, detalle.trim() || null].filter(Boolean).join(': ')
    if (!motivo) {
      setError(rapido === 'Otro' ? 'Escribe cuál fue el motivo.' : 'Elige un motivo o escríbelo para poder marcarla como perdida.')
      requestAnimationFrame(() => enfocarSinDesplazar(document.querySelector<HTMLElement>(rapido === 'Otro' ? '#form-perdida textarea' : '#form-perdida [role="radio"]')))
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
        <div role="radiogroup" aria-label="Motivo rápido" className="flex flex-wrap gap-2" onKeyDown={moverConFlechas}>
          {MOTIVOS_PERDIDA.map((m, i) => {
            const activo = rapido === m
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={activo}
                tabIndex={activo || (!rapido && i === 0) ? 0 : -1}
                onClick={() => {
                  setRapido(activo ? null : m)
                  setError(null)
                }}
                className={cn(
                  'h-11 rounded-full px-4 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/60 dark:focus-visible:ring-navy-200/70',
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
