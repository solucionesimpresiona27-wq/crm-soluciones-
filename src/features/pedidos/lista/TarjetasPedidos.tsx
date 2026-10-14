import { AnimatePresence, motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { GlassSurface } from '@/components/glass'
import { dinero } from '@/lib/format'
import { resorte } from '@/lib/motion'
import { Avatar, Entrega, EtapaPildora, PagoPildora, PrioridadMarca } from '../piezas'
import type { PropsLista } from './TablaPedidos'

/** Lista para celular y tableta: una tarjeta de cristal por pedido; toda la tarjeta abre el detalle. */
export function TarjetasPedidos({ filas, hoy, descripcion, precios, nombres, rutaDetalle }: PropsLista) {
  return (
    <ul aria-label={descripcion} className="grid gap-2.5 md:grid-cols-2">
      <AnimatePresence initial={false} mode="popLayout">
        {filas.map((f) => {
          const destino = rutaDetalle(f)
          const responsable = f.responsable_id ? nombres.get(f.responsable_id) : undefined
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
                <div className="flex min-h-7 items-center gap-2">
                  <span className="num text-sm font-semibold text-fg-muted">{f.folio}</span>
                  <EtapaPildora estado={f.estado} />
                  <span className="ml-auto">
                    <PrioridadMarca prioridad={f.prioridad} compacta />
                  </span>
                </div>
                <Link
                  to={destino.pathname}
                  state={destino.state}
                  className="mt-1.5 block truncate text-md font-semibold text-fg outline-none after:absolute after:inset-0 after:rounded-tile focus-visible:shadow-none focus-visible:after:shadow-[var(--focus-ring)]"
                >
                  {f.cliente}
                </Link>
                <p className="truncate text-sm text-fg-muted">{f.titulo}</p>
                <div className="mt-3 flex items-end justify-between gap-3 border-t border-[var(--divider)] pt-3">
                  <Entrega fechaEntrega={f.fecha_entrega} dias={f.dias} atrasado={f.atrasado} cerrado={f.cerrado} hoy={hoy} />
                  <div className="flex flex-col items-end gap-1">
                    {precios && (f.saldo ?? 0) > 0.009 ? (
                      <span className="num whitespace-nowrap text-lg font-semibold leading-tight tracking-tight text-fg">{dinero(f.saldo)}</span>
                    ) : null}
                    <span className="flex items-center gap-1.5">
                      {responsable ? <Avatar nombre={responsable} className="size-6" /> : null}
                      <PagoPildora estado={f.estado_pago} />
                    </span>
                  </div>
                </div>
              </GlassSurface>
            </motion.li>
          )
        })}
      </AnimatePresence>
    </ul>
  )
}
