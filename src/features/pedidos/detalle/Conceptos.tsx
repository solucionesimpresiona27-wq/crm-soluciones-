import { ClipboardList, Pencil, Plus, Ruler, StickyNote, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { EncabezadoPanel, EstadoVacio, GlassButton, GlassModal, GlassPanel } from '@/components/glass'
import type { PartidaPedido, PedidoDetalle } from '@/data/modulos/pedidos/contrato'
import { cantidad, dinero } from '@/lib/format'
import { useEliminarPartida } from '../consultas'
import { DialogoPartida } from './Dialogos'

function medidas(x: PartidaPedido) {
  if (x.ancho && x.alto) return `${cantidad(x.ancho)} × ${cantidad(x.alto)} m (${cantidad(Math.round(x.ancho * x.alto * 100) / 100)} m²)`
  if (x.largo) return `${cantidad(x.largo)} m lineales`
  return null
}

/** Conceptos del pedido. Sin `ver_precios` solo se ven cantidades, medidas y notas de producción. */
export function PanelConceptos({ p, precios, editar }: { p: PedidoDetalle; precios: boolean; editar: boolean }) {
  const eliminar = useEliminarPartida()
  const [dialogo, setDialogo] = useState<{ partida: PartidaPedido | null } | null>(null)
  const [borrar, setBorrar] = useState<PartidaPedido | null>(null)
  const cerrado = p.estado === 'finalizado' || p.estado === 'cancelado'
  const puedeEditar = editar && precios && !cerrado

  return (
    <GlassPanel className="p-5 sm:p-6">
      <EncabezadoPanel
        titulo="Conceptos"
        descripcion={p.partidas.length ? `${p.partidas.length} ${p.partidas.length === 1 ? 'concepto' : 'conceptos'}${precios ? '' : ' · sin precios'}` : undefined}
        acciones={
          puedeEditar && p.partidas.length ? (
            <GlassButton variante="cristal" tamano="sm" icono={<Plus />} onClick={() => setDialogo({ partida: null })} className="h-11 px-3.5">
              Agregar concepto
            </GlassButton>
          ) : null
        }
      />
      {p.partidas.length === 0 ? (
        <EstadoVacio
          icono={<ClipboardList />}
          titulo="Este pedido aún no tiene conceptos"
          descripcion={puedeEditar ? 'Agrega lo que se va a producir con su precio acordado; el total se calcula solo.' : 'Ventas agregará los conceptos del trabajo.'}
          accion={
            puedeEditar ? (
              <GlassButton variante="primario" icono={<Plus />} onClick={() => setDialogo({ partida: null })}>
                Agregar concepto
              </GlassButton>
            ) : null
          }
          className="py-6"
        />
      ) : (
        <ol className="mt-3 divide-y divide-[var(--divider)]">
          {p.partidas.map((x, i) => {
            const m = medidas(x)
            return (
              <li key={x.id} className="flex gap-3 py-3.5">
                <span className="num mt-0.5 w-5 shrink-0 text-sm text-fg-subtle">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="min-w-0 font-semibold text-fg">{x.concepto}</p>
                    <p className="num whitespace-nowrap text-sm text-fg-muted">
                      {cantidad(x.cantidad)} {x.unidad}
                      {precios && x.precio_unitario !== null ? <span className="text-fg-subtle"> × {dinero(x.precio_unitario)}</span> : null}
                    </p>
                  </div>
                  {x.descripcion ? <p className="mt-0.5 text-sm text-fg-muted">{x.descripcion}</p> : null}
                  {m ? (
                    <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-fg-muted">
                      <Ruler className="size-3.5 text-fg-subtle" aria-hidden />
                      <span className="num">{m}</span>
                    </p>
                  ) : null}
                  {x.notas_produccion ? (
                    <p className="mt-1.5 flex items-start gap-1.5 rounded-control bg-luz/[0.12] px-2.5 py-1.5 text-sm text-fg dark:bg-luz/[0.08]">
                      <StickyNote className="mt-0.5 size-3.5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
                      <span>
                        <span className="sr-only">Notas de producción: </span>
                        {x.notas_produccion}
                      </span>
                    </p>
                  ) : null}
                </div>
                {precios ? (
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="num text-base font-semibold text-fg">{dinero(x.importe)}</span>
                    {puedeEditar ? (
                      <span className="flex">
                        <GlassButton variante="fantasma" tamano="icono" icono={<Pencil />} aria-label={`Editar ${x.concepto}`} onClick={() => setDialogo({ partida: x })} />
                        <GlassButton variante="fantasma" tamano="icono" icono={<Trash2 />} aria-label={`Quitar ${x.concepto}`} onClick={() => setBorrar(x)} />
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ol>
      )}

      {puedeEditar ? <DialogoPartida abierto={dialogo !== null} onCambio={(v) => !v && setDialogo(null)} pedidoId={p.id} partida={dialogo?.partida ?? null} /> : null}
      <GlassModal
        abierto={borrar !== null}
        onCambio={(v) => !v && setBorrar(null)}
        titulo="Quitar concepto"
        descripcion={borrar ? `“${borrar.concepto}” se quita del pedido y el total se recalcula.` : undefined}
        ancho="sm"
        pie={
          <>
            <GlassButton variante="fantasma" onClick={() => setBorrar(null)}>
              Conservar
            </GlassButton>
            <GlassButton
              variante="peligro"
              icono={<Trash2 />}
              cargando={eliminar.isPending}
              onClick={() =>
                borrar &&
                eliminar.mutate(borrar.id, {
                  onSuccess: () => {
                    toast.success('Concepto quitado')
                    setBorrar(null)
                  },
                })
              }
            >
              Quitar concepto
            </GlassButton>
          </>
        }
      >
        <span className="sr-only">Confirmación</span>
      </GlassModal>
    </GlassPanel>
  )
}
