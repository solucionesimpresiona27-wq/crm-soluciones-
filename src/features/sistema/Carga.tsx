import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { GlassPanel, Pildora, SegmentedControl, Skeleton, type TonoPildora } from '@/components/glass'
import { dinero } from '@/lib/format'
import { iniciales } from '@/lib/utils'

const FILAS: Array<{ cliente: string; detalle: string; importe: number; estado: string; tono: TonoPildora }> = [
  { cliente: 'Taller Mecánico Rueda', detalle: 'COT-0142, hace 2 días', importe: 6247.7, estado: 'Enviada', tono: 'acento' },
  { cliente: 'Panadería La Espiga', detalle: 'COT-0139, hace 5 días', importe: 2180, estado: 'Aceptada', tono: 'exito' },
  { cliente: 'Clínica Dental Sonríe', detalle: 'COT-0137, hace 1 semana', importe: 11350, estado: 'Vencida', tono: 'aviso' },
]

type Estado = 'cargando' | 'listo'

/** Esqueleto con la misma forma que el contenido que va a llegar. */
export function MuestrarioCarga() {
  const [estado, setEstado] = useState<Estado>('cargando')

  return (
    <GlassPanel className="flex flex-col gap-3 p-4 sm:p-5">
      <SegmentedControl<Estado>
        etiqueta="Estado de la lista de ejemplo"
        tamano="sm"
        valor={estado}
        onCambio={setEstado}
        segmentos={[
          { valor: 'cargando', etiqueta: 'Cargando' },
          { valor: 'listo', etiqueta: 'Con datos' },
        ]}
        className="self-start"
      />
      <div className="relative" aria-busy={estado === 'cargando'}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.ul
            key={estado}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col"
          >
            {FILAS.map((f, i) => (
              <li key={f.cliente} className="flex items-center gap-3 border-t border-[var(--divider)] py-3 first:border-t-0">
                {estado === 'cargando' ? (
                  <>
                    <Skeleton className="size-10 shrink-0 rounded-full" />
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <Skeleton className="h-3.5 rounded-full" style={{ width: `${62 - i * 10}%` }} />
                      <Skeleton className="h-3 w-2/5 rounded-full" />
                    </div>
                    <Skeleton className="h-4 w-16 rounded-full" />
                  </>
                ) : (
                  <>
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--control-bg)] text-xs font-semibold text-fg-muted shadow-[inset_0_1px_0_var(--inner-hi)]">
                      {iniciales(f.cliente)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-fg">{f.cliente}</p>
                      <div className="mt-0.5 flex min-w-0 items-center gap-2">
                        <Pildora tono={f.tono} className="h-5 px-2 text-2xs">
                          {f.estado}
                        </Pildora>
                        <span className="truncate text-xs text-fg-muted">{f.detalle}</span>
                      </div>
                    </div>
                    <span className="num shrink-0 text-sm font-semibold text-fg">{dinero(f.importe)}</span>
                  </>
                )}
              </li>
            ))}
          </motion.ul>
        </AnimatePresence>
      </div>
    </GlassPanel>
  )
}
