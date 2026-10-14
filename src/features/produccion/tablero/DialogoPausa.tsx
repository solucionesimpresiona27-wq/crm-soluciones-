import { CirclePause } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Campo, GlassButton, GlassModal, GlassTextarea } from '@/components/glass'
import type { OrdenTrabajo } from '@/data/modulos/produccion/contrato'

/** Pausar exige motivo (la base lo pide): falta material, cliente no responde, etc. */
export function DialogoPausa({ orden, onCerrar, onPausar }: { orden: OrdenTrabajo | null; onCerrar: () => void; onPausar: (motivo: string) => void }) {
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (orden) {
      setMotivo('')
      setError(null)
    }
  }, [orden])

  const confirmar = () => {
    if (!motivo.trim()) {
      setError('Escribe por qué se detiene; el equipo lo verá en la tarjeta.')
      return
    }
    onPausar(motivo.trim())
  }

  return (
    <GlassModal
      abierto={Boolean(orden)}
      onCambio={(a) => (!a ? onCerrar() : undefined)}
      titulo={orden ? `Pausar ${orden.folio}` : 'Pausar'}
      descripcion={orden?.titulo}
      ancho="sm"
      pie={
        <>
          <GlassButton variante="fantasma" onClick={onCerrar}>
            Cancelar
          </GlassButton>
          <GlassButton variante="luz" icono={<CirclePause />} onClick={confirmar}>
            Pausar pedido
          </GlassButton>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          confirmar()
        }}
      >
        <Campo etiqueta="Motivo de la pausa" error={error ?? undefined} ayuda="Ejemplo: falta lona de 13 oz, el cliente pidió esperar.">
          {(id, a11y) => (
            <GlassTextarea
              id={id}
              {...a11y}
              autoFocus
              value={motivo}
              maxLength={300}
              onChange={(e) => {
                setMotivo(e.target.value)
                if (error) setError(null)
              }}
            />
          )}
        </Campo>
      </form>
    </GlassModal>
  )
}
