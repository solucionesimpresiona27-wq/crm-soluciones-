import { CornerDownLeft, SlidersHorizontal } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { useEquipo } from '@/app/consultas'
import { useSesion } from '@/app/sesion'
import { GlassIconButton, GlassSelect } from '@/components/glass'
import { TIPOS_TAREA, type TipoTarea } from '@/data/modulos/agenda/contrato'
import { sumarDias } from '@/lib/format'
import { resorte } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { useCrearTarea } from './consultas'
import type { BorradorTarea } from './TareaModal'
import { proximoViernes } from './util'

/** Atajos de fecha en cápsulas: Hoy, Mañana, Viernes. */
export function Atajos({ hoy, valor, onCambio }: { hoy: string; valor: string; onCambio: (f: string) => void }) {
  const opciones = [
    { t: 'Hoy', f: hoy },
    { t: 'Mañana', f: sumarDias(hoy, 1) },
    { t: 'Viernes', f: proximoViernes(sumarDias(hoy, 1)) },
  ]
  return (
    <div className="flex gap-1.5" role="group" aria-label="Fecha rápida">
      {opciones.map((o) => (
        <button
          key={o.t}
          type="button"
          aria-pressed={valor === o.f}
          onClick={() => onCambio(o.f)}
          className={cn(
            'h-9 rounded-full px-3.5 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent pointer-coarse:h-11',
            valor === o.f ? 'bg-accent text-accent-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]' : 'bg-[var(--control-bg)] text-fg hover:bg-fg/10',
          )}
        >
          {o.t}
        </button>
      ))}
    </div>
  )
}

/** Cápsula de captura: escribe y Enter. Fecha, tipo y responsable a la vista; el resto en "Más detalles". */
export function CapturaRapida({ hoy, onDetalles }: { hoy: string; onDetalles: (b: BorradorTarea) => void }) {
  const { sesion } = useSesion()
  const equipo = useEquipo()
  const reducir = useReducedMotion()
  const crear = useCrearTarea()
  const [titulo, setTitulo] = useState('')
  const [fecha, setFecha] = useState(hoy)
  const [tipo, setTipo] = useState<TipoTarea>('tarea')
  const [responsable, setResponsable] = useState<string | null>(sesion?.perfil.id ?? null)
  const [error, setError] = useState(false)
  const abierto = titulo.length > 0

  const borrador = (): BorradorTarea => ({
    titulo,
    tipo,
    fecha,
    responsable_id: responsable,
    prioridad: 'normal',
  })

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    if (!titulo.trim()) return setError(true)
    crear.mutate(
      { titulo, fecha, tipo, responsable_id: responsable },
      {
        onSuccess: () => {
          setTitulo('')
          setTipo('tarea')
        },
      },
    )
  }

  return (
    <form onSubmit={enviar} className="glass glass-thick flex flex-col gap-2 rounded-module p-2" aria-label="Agregar tarea rápida">
      <div className="flex items-center gap-2">
        <label htmlFor="captura-tarea" className="sr-only">
          Nueva tarea
        </label>
        <input
          id="captura-tarea"
          value={titulo}
          onChange={(e) => {
            setTitulo(e.target.value)
            setError(false)
          }}
          placeholder="Llamar a…, enviar prueba a…, cobrar a…"
          maxLength={200}
          autoComplete="off"
          aria-invalid={error || undefined}
          aria-describedby={error ? 'captura-error' : undefined}
          className="h-12 min-w-0 flex-1 rounded-full bg-transparent px-4 text-base text-fg outline-none placeholder:text-fg-subtle focus-visible:ring-2 focus-visible:ring-accent"
        />
        <GlassIconButton
          etiqueta="Más detalles"
          title="Más detalles (cliente, pedido, hora…)"
          icono={<SlidersHorizontal />}
          tamano="md"
          type="button"
          onClick={() => onDetalles(borrador())}
        />
        <GlassIconButton etiqueta="Agregar tarea" icono={<CornerDownLeft />} tamano="md" type="submit" destacado tono="acento" disabled={crear.isPending} />
      </div>
      {error ? (
        <p id="captura-error" className="px-4 text-xs font-medium text-danger">
          Escribe qué hay que hacer antes de agregar la tarea.
        </p>
      ) : null}
      <motion.div
        initial={false}
        animate={abierto ? { opacity: 1 } : { opacity: 0.85 }}
        transition={reducir ? { duration: 0 } : resorte.agil}
        className="flex flex-wrap items-center gap-2 px-2 pb-1"
      >
        <Atajos hoy={hoy} valor={fecha} onCambio={setFecha} />
        <input
          type="date"
          value={fecha}
          onChange={(e) => e.target.value && setFecha(e.target.value)}
          aria-label="Otra fecha"
          className="h-9 rounded-full bg-[var(--control-bg)] px-3 text-sm text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent pointer-coarse:h-11"
        />
        <GlassSelect
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoTarea)}
          aria-label="Tipo de tarea"
          className="h-9 w-auto rounded-full py-0 text-sm pointer-coarse:h-11"
        >
          {Object.entries(TIPOS_TAREA).map(([v, t]) => (
            <option key={v} value={v}>
              {t}
            </option>
          ))}
        </GlassSelect>
        <GlassSelect
          value={responsable ?? ''}
          onChange={(e) => setResponsable(e.target.value || null)}
          aria-label="Responsable"
          className="h-9 w-auto max-w-[12rem] rounded-full py-0 text-sm pointer-coarse:h-11"
        >
          {(equipo.data ?? []).map((m) => (
            <option key={m.id} value={m.id}>
              {m.id === sesion?.perfil.id ? 'Yo' : m.nombre}
            </option>
          ))}
        </GlassSelect>
      </motion.div>
    </form>
  )
}
