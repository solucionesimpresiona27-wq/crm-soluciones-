import { ChevronRight, ReceiptText } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { GlassButton } from '@/components/glass'
import { dinero } from '@/lib/format'
import { resorte } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { Avatar, Entrega, EtapaPildora, PagoPildora, PrioridadMarca } from '../piezas'
import type { FilaPedido } from './datos'

export interface PropsLista {
  filas: FilaPedido[]
  hoy: string
  descripcion: string
  precios: boolean
  nombres: Map<string, string>
  rutaDetalle: (f: FilaPedido) => { pathname: string; state: unknown }
  abrir: (f: FilaPedido) => void
}

/** Tabla de escritorio sobre cristal fuerte. Sin `ver_precios` no hay columna de saldo. */
export function TablaPedidos({ filas, hoy, descripcion, precios, nombres, rutaDetalle, abrir }: PropsLista) {
  return (
    <table className="tabla">
      <caption className="sr-only">{descripcion}</caption>
      <thead>
        <tr>
          <th scope="col" className="pl-5">Folio</th>
          <th scope="col">Cliente y trabajo</th>
          <th scope="col">Etapa</th>
          <th scope="col" className="hidden min-[1500px]:table-cell">Prioridad</th>
          <th scope="col">Entrega</th>
          <th scope="col" className="hidden min-[1200px]:table-cell">
            <span className="sr-only min-[1500px]:not-sr-only">Responsable</span>
          </th>
          <th scope="col">Pago</th>
          {precios ? <th scope="col" className="text-right">Saldo</th> : null}
          <th scope="col" className="w-14">
            <span className="sr-only">Abrir</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <AnimatePresence initial={false}>
          {filas.map((f) => {
            const destino = rutaDetalle(f)
            const responsable = f.responsable_id ? nombres.get(f.responsable_id) : undefined
            return (
              <motion.tr
                key={f.id}
                layout="position"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                transition={{ layout: resorte.agil, opacity: { duration: 0.18 } }}
                onClick={() => abrir(f)}
                className="cursor-pointer"
              >
                <td className="whitespace-nowrap pl-5">
                  <Link
                    to={destino.pathname}
                    state={destino.state}
                    onClick={(e) => e.stopPropagation()}
                    className="num -mx-1.5 rounded-full px-1.5 py-1 font-semibold text-fg outline-none"
                  >
                    {f.folio}
                  </Link>
                  {f.prioridad === 'urgente' || f.prioridad === 'alta' ? (
                    <span className="mt-0.5 block min-[1500px]:hidden">
                      <PrioridadMarca prioridad={f.prioridad} />
                    </span>
                  ) : null}
                </td>
                <td className="w-full min-w-[11rem]">
                  <span className="block max-w-[22rem] truncate font-semibold text-fg" title={f.cliente}>
                    {f.cliente}
                  </span>
                  <span className="block max-w-[22rem] truncate text-xs text-fg-muted" title={f.titulo}>
                    {f.titulo}
                  </span>
                </td>
                <td>
                  <span className="flex flex-col items-start gap-0.5">
                    <EtapaPildora estado={f.estado} />
                    {f.estado === 'pausado' && f.motivo_estado ? (
                      <span className="max-w-[9rem] truncate text-xs text-fg-subtle" title={f.motivo_estado}>
                        {f.motivo_estado}
                      </span>
                    ) : null}
                  </span>
                </td>
                <td className="hidden min-[1500px]:table-cell">
                  <PrioridadMarca prioridad={f.prioridad} />
                </td>
                <td>
                  <Entrega fechaEntrega={f.fecha_entrega} dias={f.dias} atrasado={f.atrasado} cerrado={f.cerrado} hoy={hoy} />
                </td>
                <td className="hidden min-[1200px]:table-cell">
                  {responsable ? (
                    <span className="inline-flex max-w-[10rem] items-center gap-2">
                      <Avatar nombre={responsable} />
                      <span className="sr-only truncate text-sm text-fg-muted min-[1500px]:not-sr-only">{responsable.split(' ')[0]}</span>
                    </span>
                  ) : (
                    <span className="text-sm text-fg-subtle">—<span className="sr-only">Sin asignar</span></span>
                  )}
                </td>
                <td>
                  <span className="inline-flex items-center gap-1.5">
                    <PagoPildora estado={f.estado_pago} />
                    {f.requiere_factura && !f.facturado && f.estado !== 'cancelado' ? (
                      <span className="grid size-6 place-items-center rounded-full bg-luz/25 text-amber-700 dark:bg-luz/15 dark:text-amber-300" title="Por facturar">
                        <ReceiptText className="size-3.5" aria-hidden />
                        <span className="sr-only">Por facturar</span>
                      </span>
                    ) : null}
                  </span>
                </td>
                {precios ? (
                  <td className={cn('num whitespace-nowrap text-right text-base font-semibold', (f.saldo ?? 0) > 0.009 ? 'text-fg' : 'text-fg-subtle')}>
                    {(f.saldo ?? 0) > 0.009 ? dinero(f.saldo) : 'Pagado'}
                  </td>
                ) : null}
                <td className="py-2 pr-3">
                  <GlassButton
                    variante="fantasma"
                    tamano="icono"
                    aria-label={`Abrir ${f.folio}`}
                    icono={<ChevronRight />}
                    onClick={(e) => {
                      e.stopPropagation()
                      abrir(f)
                    }}
                  />
                </td>
              </motion.tr>
            )
          })}
        </AnimatePresence>
      </tbody>
    </table>
  )
}
