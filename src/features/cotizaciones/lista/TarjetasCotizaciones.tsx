import { MessageCircle } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { GlassIconButton, GlassSurface } from '@/components/glass'
import { dinero } from '@/lib/format'
import { resorte } from '@/lib/motion'
import type { FilaCotizacion } from './datos'
import { EstadoFila, Vigencia } from './piezas'
import type { AccionesLista } from './TablaCotizaciones'

/** Lista para celular y tableta: una tarjeta de cristal por cotización; toda la tarjeta abre el detalle. */
export function TarjetasCotizaciones({ filas, hoy, acciones, descripcion }: { filas: FilaCotizacion[]; hoy: string; acciones: AccionesLista; descripcion: string }) {
  return (
    <ul aria-label={descripcion} className="grid gap-2.5 md:grid-cols-2">
      <AnimatePresence initial={false} mode="popLayout">
        {filas.map((f) => {
          const destino = acciones.rutaDetalle(f)
          return (
            <motion.li
              key={f.id}
              layout
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }}
              transition={resorte.agil}
            >
              <GlassSurface variante="fuerte" interactivo className="rounded-tile p-4">
                <div className="flex min-h-11 items-center gap-2">
                  <span className="num text-sm font-semibold text-fg-muted">{f.folio}</span>
                  <EstadoFila f={f} />
                  {acciones.seguimiento && f.visible === 'enviada' ? (
                    <GlassIconButton
                      etiqueta={`Dar seguimiento a ${f.folio} por WhatsApp`}
                      icono={<MessageCircle />}
                      tamano="sm"
                      className="relative z-10 -my-1 ml-auto"
                      onClick={() => acciones.seguimiento?.(f)}
                    />
                  ) : null}
                </div>
                <Link
                  to={destino.pathname}
                  state={destino.state}
                  className="mt-1 block truncate text-md font-semibold text-fg outline-none after:absolute after:inset-0 after:rounded-tile focus-visible:shadow-none focus-visible:after:shadow-[var(--focus-ring)]"
                >
                  {f.cliente.nombre}
                </Link>
                <p className="truncate text-sm text-fg-muted">{f.titulo ?? 'Sin título'}</p>
                <div className="mt-3 flex items-end justify-between gap-3 border-t border-[var(--divider)] pt-3 text-sm">
                  <Vigencia f={f} hoy={hoy} />
                  <span className="num whitespace-nowrap text-lg font-semibold tracking-tight text-fg">{dinero(f.total)}</span>
                </div>
              </GlassSurface>
            </motion.li>
          )
        })}
      </AnimatePresence>
    </ul>
  )
}
