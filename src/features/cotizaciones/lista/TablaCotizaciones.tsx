import { ChevronRight, CopyPlus, MessageCircle } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { dinero } from '@/lib/format'
import { resorte } from '@/lib/motion'
import type { FilaCotizacion } from './datos'
import { AccionFila, EstadoFila, Vigencia, fechaCorta } from './piezas'

export interface AccionesLista {
  abrir: (f: FilaCotizacion) => void
  rutaDetalle: (f: FilaCotizacion) => { pathname: string; state: unknown }
  seguimiento?: (f: FilaCotizacion) => void
  duplicar?: (f: FilaCotizacion) => void
  duplicando: string | null
}

/** Tabla de escritorio sobre cristal fuerte. Las filas se reacomodan con resorte al filtrar. */
export function TablaCotizaciones({ filas, hoy, acciones, descripcion }: { filas: FilaCotizacion[]; hoy: string; acciones: AccionesLista; descripcion: string }) {
  return (
    <table className="tabla">
      <caption className="sr-only">{descripcion}</caption>
      <thead>
        <tr>
          <th scope="col" className="!pl-5">Folio</th>
          <th scope="col">Cliente</th>
          <th scope="col" className="hidden xl:table-cell">Título</th>
          <th scope="col">Fecha</th>
          <th scope="col">Vencimiento</th>
          <th scope="col">Estado</th>
          <th scope="col" className="!text-right">Total</th>
          <th scope="col" className="w-[9.75rem]">
            <span className="sr-only">Acciones</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <AnimatePresence initial={false}>
          {filas.map((f) => {
            const destino = acciones.rutaDetalle(f)
            return (
              <motion.tr
                key={f.id}
                layout="position"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                transition={{ layout: resorte.agil, opacity: { duration: 0.18 } }}
                onClick={() => acciones.abrir(f)}
                className="cursor-pointer"
              >
                <td className="whitespace-nowrap !pl-5">
                  <Link
                    to={destino.pathname}
                    state={destino.state}
                    onClick={(e) => e.stopPropagation()}
                    className="num -mx-1.5 rounded-full px-1.5 py-1 font-semibold text-fg outline-none"
                  >
                    {f.folio}
                  </Link>
                </td>
                <td className="max-w-[15rem]">
                  <span className="block truncate font-semibold text-fg">{f.cliente.nombre}</span>
                  <span className="block truncate text-xs text-fg-muted xl:hidden">{f.titulo ?? 'Sin título'}</span>
                </td>
                <td className="hidden max-w-[17rem] xl:table-cell">
                  <span className="block truncate text-fg-muted">{f.titulo ?? 'Sin título'}</span>
                </td>
                <td className="whitespace-nowrap text-fg-muted">{fechaCorta(f.fecha, hoy)}</td>
                <td>
                  <Vigencia f={f} hoy={hoy} />
                </td>
                <td>
                  <EstadoFila f={f} />
                </td>
                <td className="num whitespace-nowrap text-right text-base font-semibold text-fg">{dinero(f.total)}</td>
                <td className="!py-2 !pr-3">
                  <div className="flex items-center justify-end gap-0.5">
                    {acciones.seguimiento && f.visible === 'enviada' ? (
                      <AccionFila etiqueta="Dar seguimiento por WhatsApp" icono={<MessageCircle />} onClick={() => acciones.seguimiento?.(f)} />
                    ) : (
                      <span className="size-11" aria-hidden />
                    )}
                    {acciones.duplicar ? (
                      <AccionFila
                        etiqueta="Duplicar cotización"
                        icono={<CopyPlus />}
                        cargando={acciones.duplicando === f.id}
                        onClick={() => acciones.duplicar?.(f)}
                      />
                    ) : null}
                    <AccionFila etiqueta={`Abrir ${f.folio}`} icono={<ChevronRight />} onClick={() => acciones.abrir(f)} />
                  </div>
                </td>
              </motion.tr>
            )
          })}
        </AnimatePresence>
      </tbody>
    </table>
  )
}
