import { ChevronRight, MessageCircle } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { GlassButton, GlassIconButton, GlassSurface, Pildora } from '@/components/glass'
import { LISTAS_PRECIO, type ListaPrecio } from '@/data/modulos/clientes/contrato'
import { dinero, telefono } from '@/lib/format'
import { resorte } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { AccionFila, AvatarCliente, UltimaCompra } from '../piezas'
import type { FilaCliente } from './datos'

export interface AccionesClientes {
  abrir: (f: FilaCliente) => void
  whatsapp: (f: FilaCliente) => void
}

const LISTA_CORTA: Record<ListaPrecio, string> = { publico: 'Público', mayoreo: 'Mayoreo', agencia: 'Agencia' }

/** Hasta 2 etiquetas visibles y "+n" con el resto en el título. */
export function Etiquetas({ etiquetas, max = 2, className }: { etiquetas: string[]; max?: number; className?: string }) {
  if (!etiquetas.length) return null
  const resto = etiquetas.length - max
  return (
    <span className={cn('flex flex-wrap items-center gap-1', className)}>
      {etiquetas.slice(0, max).map((e) => (
        <Pildora key={e} tono="acento" punto={false}>
          {e}
        </Pildora>
      ))}
      {resto > 0 ? (
        <Pildora tono="neutro" punto={false}>
          <span title={etiquetas.slice(max).join(', ')}>+{resto}</span>
        </Pildora>
      ) : null}
    </span>
  )
}

function Saldo({ valor }: { valor: number | null }) {
  if (valor === null) return null
  if (valor <= 0) return <span className="text-fg-subtle">—</span>
  return <span className="num font-semibold text-fg">{dinero(valor)}</span>
}

/** Tabla de escritorio sobre cristal fuerte; toda la fila abre la ficha. */
export function TablaClientes({ filas, acciones, conSaldo, descripcion }: { filas: FilaCliente[]; acciones: AccionesClientes; conSaldo: boolean; descripcion: string }) {
  return (
    <table className="tabla">
      <caption className="sr-only">{descripcion}</caption>
      <thead>
        <tr>
          <th scope="col" className="pl-5">Cliente</th>
          <th scope="col" className="hidden whitespace-nowrap min-[1360px]:table-cell">Contacto principal</th>
          <th scope="col">WhatsApp</th>
          <th scope="col">Etiquetas</th>
          <th scope="col" className="hidden min-[1600px]:table-cell">Lista</th>
          <th scope="col" className="whitespace-nowrap">Última compra</th>
          {conSaldo ? <th scope="col" className="text-right">Saldo</th> : null}
          <th scope="col" className="hidden min-[1360px]:table-cell">Vendedor</th>
          <th scope="col" className="w-14">
            <span className="sr-only">Abrir</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <AnimatePresence initial={false}>
          {filas.map((f) => (
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
              <td className="w-full max-w-0 pl-5">
                <span className="flex min-w-0 items-center gap-3">
                  <AvatarCliente nombre={f.nombre} tipo={f.tipo} />
                  <span className="min-w-0">
                    <Link
                      to={`/clientes/${f.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="-mx-1 block truncate rounded-full px-1 font-semibold text-fg outline-none"
                      title={f.nombre}
                    >
                      {f.nombre}
                    </Link>
                    <span className="block truncate text-xs text-fg-muted">
                      <span className="min-[1360px]:hidden">{f.contacto_principal ? `${f.contacto_principal.nombre} · ` : ''}</span>
                      {f.tipo === 'persona' ? 'Persona' : 'Empresa'}
                      {f.ciudad ? ` · ${f.ciudad}` : ''}
                    </span>
                  </span>
                </span>
              </td>
              <td className="hidden max-w-[12rem] min-[1360px]:table-cell">
                {f.contacto_principal ? (
                  <>
                    <span className="block truncate text-fg">{f.contacto_principal.nombre}</span>
                    {f.contacto_principal.puesto ? <span className="block truncate text-xs text-fg-subtle">{f.contacto_principal.puesto}</span> : null}
                  </>
                ) : (
                  <span className="text-fg-subtle">—</span>
                )}
              </td>
              <td className="py-2">
                {f.whatsapp || f.telefono ? (
                  <GlassButton
                    variante="fantasma"
                    tamano="sm"
                    icono={<MessageCircle />}
                    aria-label={`Escribir por WhatsApp a ${f.nombre}`}
                    className="num -ml-2 h-11 whitespace-nowrap px-3"
                    onClick={(e) => {
                      e.stopPropagation()
                      acciones.whatsapp(f)
                    }}
                  >
                    {telefono(f.whatsapp ?? f.telefono)}
                  </GlassButton>
                ) : (
                  <span className="whitespace-nowrap text-fg-subtle">Sin número</span>
                )}
              </td>
              <td>
                <Etiquetas etiquetas={f.etiquetas} max={1} className="flex-nowrap" />
              </td>
              <td className="hidden whitespace-nowrap text-fg-muted min-[1600px]:table-cell" title={LISTAS_PRECIO[f.lista_precio]}>
                {LISTA_CORTA[f.lista_precio]}
              </td>
              <td className="whitespace-nowrap text-fg-muted">
                <UltimaCompra iso={f.ultima_compra_at} />
              </td>
              {conSaldo ? (
                <td className="whitespace-nowrap text-right">
                  <Saldo valor={f.saldo} />
                </td>
              ) : null}
              <td className="hidden max-w-[9rem] truncate text-fg-muted min-[1360px]:table-cell">{f.vendedor ?? '—'}</td>
              <td className="py-2 pr-3">
                <AccionFila etiqueta={`Abrir ficha de ${f.nombre}`} icono={<ChevronRight />} onClick={() => acciones.abrir(f)} />
              </td>
            </motion.tr>
          ))}
        </AnimatePresence>
      </tbody>
    </table>
  )
}

/** Celular y tableta: una tarjeta por cliente; toda la tarjeta abre la ficha. */
export function TarjetasClientes({ filas, acciones, conSaldo, descripcion }: { filas: FilaCliente[]; acciones: AccionesClientes; conSaldo: boolean; descripcion: string }) {
  return (
    <ul aria-label={descripcion} className="grid gap-2.5 md:grid-cols-2">
      <AnimatePresence initial={false} mode="popLayout">
        {filas.map((f) => (
          <motion.li
            key={f.id}
            layout
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }}
            transition={resorte.agil}
          >
            <GlassSurface variante="fuerte" interactivo className="rounded-tile p-4">
              <div className="flex items-start gap-3">
                <AvatarCliente nombre={f.nombre} tipo={f.tipo} />
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/clientes/${f.id}`}
                    className="block truncate text-md font-semibold text-fg outline-none after:absolute after:inset-0 after:rounded-tile focus-visible:shadow-none focus-visible:after:shadow-[var(--focus-ring)]"
                  >
                    {f.nombre}
                  </Link>
                  <p className="truncate text-sm text-fg-muted">
                    {f.contacto_principal?.nombre ?? (f.tipo === 'persona' ? 'Persona' : 'Empresa')}
                    {f.ciudad ? ` · ${f.ciudad}` : ''}
                  </p>
                </div>
                {f.whatsapp || f.telefono ? (
                  <GlassIconButton
                    etiqueta={`Escribir por WhatsApp a ${f.nombre}`}
                    icono={<MessageCircle />}
                    tamano="sm"
                    className="relative z-10 -my-1 shrink-0"
                    onClick={() => acciones.whatsapp(f)}
                  />
                ) : null}
              </div>
              {f.etiquetas.length ? <Etiquetas etiquetas={f.etiquetas} max={3} className="mt-2.5" /> : null}
              <div className="mt-3 flex items-end justify-between gap-3 border-t border-[var(--divider)] pt-3 text-sm">
                <span className="flex flex-col">
                  <span className="text-xs text-fg-subtle">Última compra</span>
                  <UltimaCompra iso={f.ultima_compra_at} className="font-medium text-fg" />
                </span>
                {conSaldo && f.saldo && f.saldo > 0 ? (
                  <span className="flex flex-col items-end">
                    <span className="text-xs text-fg-subtle">Saldo pendiente</span>
                    <span className="num text-lg font-semibold leading-tight tracking-tight text-fg">{dinero(f.saldo)}</span>
                  </span>
                ) : (
                  <span className="text-xs text-fg-subtle">{LISTA_CORTA[f.lista_precio]}</span>
                )}
              </div>
            </GlassSurface>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  )
}
