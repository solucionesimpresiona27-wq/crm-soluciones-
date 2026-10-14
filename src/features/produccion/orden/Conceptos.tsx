import { Check, Ruler } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { GlassButton, GlassTextarea } from '@/components/glass'
import type { PartidaOrden } from '@/data/modulos/produccion/contrato'
import { describirMedidas } from '@/lib/calculadora'
import { cantidad } from '@/lib/format'
import { resorte } from '@/lib/motion'
import { Casilla } from './Casilla'

const TIPO: Record<PartidaOrden['tipo'], string | null> = {
  concepto: null,
  instalacion: 'Instalación',
  transporte: 'Transporte',
  diseno: 'Diseño',
  extra: 'Extra',
}

/** Conceptos para el taller: medidas, cantidad grande y notas de producción editables. Nunca precios. */
export function Conceptos({
  partidas,
  editable,
  guardar,
  hechos,
  marcar,
}: {
  partidas: PartidaOrden[]
  editable: boolean
  guardar: (partidaId: string, notas: string) => Promise<void>
  hechos: Record<string, boolean>
  marcar: (id: string, v: boolean) => void
}) {
  if (!partidas.length) return <p className="py-6 text-center text-sm text-fg-muted">Este pedido no tiene conceptos.</p>
  return (
    <ol className="flex flex-col">
      {partidas.map((p, i) => {
        const medidas = describirMedidas(p.metodo_calculo, p.ancho, p.alto, p.largo)
        return (
          <li
            key={p.id}
            className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 border-t border-[var(--divider)] py-4 first:border-t-0 first:pt-1 sm:grid-cols-[2rem_minmax(0,1fr)_auto]"
          >
            <span className="num mt-0.5 grid size-8 place-items-center rounded-full bg-[var(--control-bg)] text-sm font-semibold text-fg-muted" aria-hidden>
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-fg">
                {p.concepto}
                {TIPO[p.tipo] ? <span className="ml-2 text-xs font-medium text-fg-subtle">{TIPO[p.tipo]}</span> : null}
              </p>
              {p.descripcion ? <p className="mt-0.5 text-sm text-fg-muted">{p.descripcion}</p> : null}
              {medidas ? (
                <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-accent/[0.08] px-2.5 py-1 text-sm font-medium text-accent dark:bg-navy-300/15 dark:text-navy-100 [&_svg]:size-4">
                  <Ruler aria-hidden />
                  <span className="num">{medidas}</span>
                </p>
              ) : null}
            </div>
            <div className="col-start-2 mt-2 flex items-baseline gap-1.5 sm:col-start-3 sm:row-start-1 sm:mt-0 sm:flex-col sm:items-end sm:gap-0">
              <span className="num text-2xl font-semibold tracking-tight text-fg leading-none">{cantidad(p.cantidad)}</span>
              <span className="text-sm text-fg-muted">{p.unidad}</span>
            </div>
            <div className="col-start-2 mt-3 flex flex-col gap-2 sm:col-span-2">
              <NotaPartida p={p} editable={editable} guardar={guardar} />
              <Casilla marcada={Boolean(hechos[`p:${p.id}`])} onCambio={(v) => marcar(`p:${p.id}`, v)} className="-ml-2 w-auto self-start pr-3">
                Concepto terminado
              </Casilla>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function NotaPartida({ p, editable, guardar }: { p: PartidaOrden; editable: boolean; guardar: (id: string, notas: string) => Promise<void> }) {
  const reducir = useReducedMotion()
  const original = p.notas_produccion ?? ''
  const [texto, setTexto] = useState(original)
  const [estado, setEstado] = useState<'quieto' | 'guardando' | 'guardado'>('quieto')
  useEffect(() => setTexto(original), [original])
  useEffect(() => {
    if (estado !== 'guardado') return
    const t = setTimeout(() => setEstado('quieto'), 2200)
    return () => clearTimeout(t)
  }, [estado])

  if (!editable) {
    return original ? (
      <p className="rounded-control bg-[var(--control-bg)] px-3 py-2 text-sm text-fg">
        <span className="font-medium text-fg-muted">Notas de producción: </span>
        {original}
      </p>
    ) : null
  }

  const cambiado = texto.trim() !== original.trim()
  const enviar = async () => {
    if (!cambiado) return
    setEstado('guardando')
    try {
      await guardar(p.id, texto)
      setEstado('guardado')
    } catch {
      setEstado('quieto')
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={`nota-${p.id}`} className="text-xs font-medium text-fg-subtle">
        Notas de producción
      </label>
      <GlassTextarea
        id={`nota-${p.id}`}
        rows={2}
        value={texto}
        maxLength={1000}
        placeholder="Material, acabado, cuidados al instalar…"
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            void enviar()
          }
        }}
        className="text-sm"
      />
      <AnimatePresence initial={false} mode="popLayout">
        {cambiado || estado !== 'quieto' ? (
          <motion.div
            key={cambiado ? 'pendiente' : 'listo'}
            initial={reducir ? { opacity: 0 } : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={resorte.agil}
            className="flex items-center gap-2"
          >
            {cambiado ? (
              <>
                <GlassButton variante="primario" tamano="sm" cargando={estado === 'guardando'} onClick={() => void enviar()} className="pointer-coarse:h-11">
                  Guardar nota
                </GlassButton>
                <GlassButton variante="fantasma" tamano="sm" onClick={() => setTexto(original)} className="pointer-coarse:h-11">
                  Descartar
                </GlassButton>
              </>
            ) : (
              <span role="status" className="inline-flex items-center gap-1.5 text-xs font-medium text-success [&_svg]:size-3.5">
                <Check aria-hidden /> Nota guardada
              </span>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
