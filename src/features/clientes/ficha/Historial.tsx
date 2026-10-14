import { ChevronRight, FileText, HandCoins, Package } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { EstadoVacio, GlassPanel, Pildora, SegmentedControl, Skeleton, type TonoPildora } from '@/components/glass'
import type { HistorialCliente } from '@/data/modulos/clientes/contrato'
import { ESTADO_COTIZACION, ESTADO_PEDIDO, estadoVisibleCotizacion } from '@/lib/estados'
import { dinero, fecha, hoyISO } from '@/lib/format'
import { cn } from '@/lib/utils'
import { TituloModulo } from './Modulos'

type Pestana = 'cotizaciones' | 'pedidos' | 'pagos'

const ESTADO_PAGO: Record<HistorialCliente['pedidos'][number]['estado_pago'], { etiqueta: string; tono: TonoPildora }> = {
  pendiente: { etiqueta: 'Sin pago', tono: 'aviso' },
  anticipo: { etiqueta: 'Anticipo', tono: 'luz' },
  parcial: { etiqueta: 'Parcial', tono: 'luz' },
  liquidado: { etiqueta: 'Liquidado', tono: 'exito' },
  reembolsado: { etiqueta: 'Reembolsado', tono: 'neutro' },
}
const METODO: Record<string, string> = { transferencia: 'Transferencia', efectivo: 'Efectivo', deposito: 'Depósito', tarjeta: 'Tarjeta' }
const TIPO_PAGO: Record<string, string> = { anticipo: 'Anticipo', abono: 'Abono', liquidacion: 'Liquidación', devolucion: 'Devolución' }

function Fila({ to, titulo, sub, derecha, estado }: { to: string; titulo: ReactNode; sub: ReactNode; derecha?: ReactNode; estado?: ReactNode }) {
  return (
    <li>
      <Link to={to} className="group -mx-2 flex min-h-[3.5rem] items-center gap-3 rounded-tile px-2 py-2.5 outline-none transition-colors hover:bg-[var(--row-hover)]">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="num text-sm font-semibold text-fg">{titulo}</span>
            {estado}
          </p>
          <p className="truncate text-sm text-fg-muted">{sub}</p>
        </div>
        {derecha ? <div className="shrink-0 text-right">{derecha}</div> : null}
        <ChevronRight className="size-4 shrink-0 text-fg-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </li>
  )
}

/** Cotizaciones, pedidos y pagos del cliente, cada uno enlazado a su detalle. */
export function ModuloHistorial({ h, cargando, conPrecios }: { h: HistorialCliente | undefined; cargando: boolean; conPrecios: boolean }) {
  const [pestana, setPestana] = useState<Pestana>(conPrecios ? 'cotizaciones' : 'pedidos')
  const idPanel = useId()
  const hoy = hoyISO()
  const pestanas = conPrecios ? (['cotizaciones', 'pedidos', 'pagos'] as const) : (['pedidos'] as const)
  const nombres: Record<Pestana, string> = { cotizaciones: 'Cotizaciones', pedidos: 'Pedidos', pagos: 'Pagos' }

  return (
    <GlassPanel className="rounded-module p-5 sm:p-6" aria-labelledby="titulo-historial">
      <TituloModulo id="titulo-historial">Historial</TituloModulo>
      {conPrecios ? (
        <SegmentedControl
          etiqueta="Historial del cliente"
          tamano="sm"
          valor={pestana}
          onCambio={setPestana}
          idPanel={idPanel}
          className="mt-2"
          segmentos={pestanas.map((p) => ({ valor: p, etiqueta: nombres[p], conteo: h ? h[p].length : undefined }))}
        />
      ) : null}
      <div id={idPanel} role={conPrecios ? 'tabpanel' : undefined} aria-label={nombres[pestana]} className="mt-3">
        {cargando || !h ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-tile" />
            ))}
          </div>
        ) : pestana === 'cotizaciones' ? (
          h.cotizaciones.length === 0 ? (
            <EstadoVacio className="py-8" icono={<FileText />} titulo="Sin cotizaciones" descripcion="Arma la primera con el botón Nueva cotización de arriba." />
          ) : (
            <ul className="divide-y divide-[var(--divider)]">
              {h.cotizaciones.map((q) => {
                // La lista del historial no trae vencimiento: se muestra el estado guardado
                const e = ESTADO_COTIZACION[estadoVisibleCotizacion({ estado: q.estado, fecha_vencimiento: '9999-12-31' }, hoy)]
                return (
                  <Fila
                    key={q.id}
                    to={`/cotizaciones/${q.id}`}
                    titulo={q.folio}
                    estado={
                      <Pildora tono={e.tono} className="h-5 text-2xs">
                        {e.etiqueta}
                      </Pildora>
                    }
                    sub={`${fecha(q.fecha)}${q.titulo ? ` · ${q.titulo}` : ''}`}
                    derecha={<span className="num font-semibold text-fg">{dinero(q.total)}</span>}
                  />
                )
              })}
            </ul>
          )
        ) : pestana === 'pedidos' ? (
          h.pedidos.length === 0 ? (
            <EstadoVacio className="py-8" icono={<Package />} titulo="Sin pedidos" descripcion="Cuando acepte una cotización, conviértela en pedido y aparecerá aquí." />
          ) : (
            <ul className="divide-y divide-[var(--divider)]">
              {h.pedidos.map((p) => {
                const e = ESTADO_PEDIDO[p.estado]
                const pago = ESTADO_PAGO[p.estado_pago]
                return (
                  <Fila
                    key={p.id}
                    to={`/pedidos/${p.id}`}
                    titulo={p.folio}
                    estado={
                      <>
                        <Pildora tono={e.tono} className="h-5 text-2xs">
                          {e.corto}
                        </Pildora>
                        {conPrecios && p.estado !== 'cancelado' ? (
                          <Pildora tono={pago.tono} punto={false} className="h-5 text-2xs">
                            {pago.etiqueta}
                          </Pildora>
                        ) : null}
                      </>
                    }
                    sub={`${p.titulo}${p.fecha_entrega ? ` · entrega ${fecha(p.fecha_entrega)}` : ''}`}
                    derecha={
                      conPrecios && p.total !== null ? (
                        <>
                          <span className="num block font-semibold text-fg">{dinero(p.total)}</span>
                          {p.saldo && p.saldo > 0 && p.estado !== 'cancelado' ? <span className="num block text-xs font-medium text-warning">Debe {dinero(p.saldo)}</span> : null}
                        </>
                      ) : undefined
                    }
                  />
                )
              })}
            </ul>
          )
        ) : h.pagos.length === 0 ? (
          <EstadoVacio className="py-8" icono={<HandCoins />} titulo="Sin pagos registrados" />
        ) : (
          <ul className="divide-y divide-[var(--divider)]">
            {h.pagos.map((p) => (
              <Fila
                key={p.id}
                to={`/pedidos/${p.pedido_id}`}
                titulo={fecha(p.fecha)}
                estado={
                  p.cancelado ? (
                    <Pildora tono="peligro" className="h-5 text-2xs">
                      Cancelado
                    </Pildora>
                  ) : null
                }
                sub={`${TIPO_PAGO[p.tipo] ?? p.tipo} · ${METODO[p.metodo] ?? p.metodo}${p.folio ? ` · ${p.folio}` : ''}`}
                derecha={<span className={cn('num font-semibold', p.cancelado ? 'text-fg-subtle line-through' : p.tipo === 'devolucion' ? 'text-danger' : 'text-fg')}>{dinero(p.importe)}</span>}
              />
            ))}
          </ul>
        )}
      </div>
    </GlassPanel>
  )
}
