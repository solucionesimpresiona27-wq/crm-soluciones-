import * as Popover from '@radix-ui/react-popover'
import { Command } from 'cmdk'
import { ChevronsUpDown, Loader2, Package, Search, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useMemo, useState } from 'react'
import { GlassIconButton, Pildora } from '@/components/glass'
import type { ProductoCatalogo } from '@/data/tipos'
import { METODOS } from '@/lib/calculadora'
import { dinero } from '@/lib/format'
import { resorte } from '@/lib/motion'
import { cn } from '@/lib/utils'

export const clasesGrupoLista =
  'px-1 pb-1 pt-2 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-fg-subtle'
export const clasesOpcionLista =
  'flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-3 py-2 text-sm text-fg outline-none data-[selected=true]:bg-[var(--control-bg-hover)] data-[selected=true]:shadow-[inset_0_1px_0_var(--inner-hi)]'

/** "$180.00 / m²" con el precio de lista del producto, o null si no tiene precio. */
export function precioDeLista(p: ProductoCatalogo) {
  if (p.precio_venta !== null) return `${dinero(p.precio_venta)} / ${METODOS[p.metodo_calculo].unidadCobro}`
  if (p.escalas.length) return `desde ${dinero(Math.min(...p.escalas.map((e) => e.precio)))}`
  return null
}

function agrupar(productos: ProductoCatalogo[]) {
  const mapa = new Map<string, ProductoCatalogo[]>()
  for (const p of productos) {
    const g = p.categoria?.grupo ?? 'Otros'
    mapa.set(g, [...(mapa.get(g) ?? []), p])
  }
  return [...mapa.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'es'))
    .map(([g, lista]) => [g, lista.sort((a, b) => (a.categoria?.nombre ?? '').localeCompare(b.categoria?.nombre ?? '', 'es') || a.nombre.localeCompare(b.nombre, 'es'))] as const)
}

/** Botón con aspecto de campo que abre el catálogo agrupado y con búsqueda. */
export function SelectorProducto({
  id,
  productos,
  cargando,
  elegido,
  nombreGuardado,
  onElegir,
  onQuitar,
}: {
  id?: string
  productos: ProductoCatalogo[] | undefined
  cargando: boolean
  elegido: ProductoCatalogo | undefined
  /** Producto ligado que ya no está en el catálogo activo */
  nombreGuardado?: string | null
  onElegir: (p: ProductoCatalogo) => void
  onQuitar: () => void
}) {
  const [abierto, setAbierto] = useState(false)
  const reducir = useReducedMotion()
  const grupos = useMemo(() => agrupar(productos ?? []), [productos])
  const precio = elegido ? precioDeLista(elegido) : null
  const ligado = Boolean(elegido || nombreGuardado)

  return (
    <Popover.Root open={abierto} onOpenChange={setAbierto}>
      <div className="flex items-center gap-2">
        <Popover.Trigger asChild>
          <button
            id={id}
            type="button"
            className="field flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-1.5 text-left"
            aria-label={elegido ? `Producto del catálogo: ${elegido.nombre}. Cambiar` : 'Elegir producto del catálogo'}
          >
            <Package className="size-[1.1rem] shrink-0 text-fg-subtle" aria-hidden />
            {elegido ? (
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium leading-snug text-fg">{elegido.nombre}</span>
                <span className="block truncate text-xs leading-snug text-fg-muted">
                  {elegido.categoria?.nombre ?? 'Sin categoría'}
                  {precio ? <span className="num">{`, ${precio}`}</span> : ', sin precio de lista'}
                </span>
              </span>
            ) : (
              <span className={cn('min-w-0 flex-1 truncate', nombreGuardado ? 'text-fg' : 'text-fg-subtle')}>
                {nombreGuardado ?? 'Elegir del catálogo'}
              </span>
            )}
            {cargando ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-fg-subtle" aria-hidden />
            ) : (
              <ChevronsUpDown className="size-4 shrink-0 text-fg-subtle" aria-hidden />
            )}
          </button>
        </Popover.Trigger>
        {ligado ? <GlassIconButton etiqueta="Quitar el producto del catálogo" icono={<X />} tamano="sm" onClick={onQuitar} /> : null}
      </div>

      <AnimatePresence>
        {abierto ? (
          <Popover.Portal forceMount>
            <Popover.Content asChild forceMount align="start" sideOffset={8} collisionPadding={12}>
              <motion.div
                initial={reducir ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }}
                transition={resorte.modal}
                style={{ transformOrigin: 'var(--radix-popover-content-transform-origin)' }}
                className="glass glass-strong z-50 w-[min(28rem,calc(100vw-1.5rem))] overflow-hidden rounded-module shadow-glass-lg outline-none"
              >
                <Command label="Catálogo de productos" loop>
                  <div className="flex items-center gap-2.5 border-b border-[var(--divider)] px-4">
                    <Search className="size-4 shrink-0 text-fg-subtle" aria-hidden />
                    <Command.Input
                      placeholder="Buscar en el catálogo"
                      className="h-12 min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-subtle"
                    />
                  </div>
                  <Command.List className="max-h-[min(24rem,52dvh)] overflow-y-auto overscroll-contain p-1.5">
                    {cargando ? (
                      <Command.Loading>
                        <p className="px-4 py-8 text-center text-sm text-fg-muted">Cargando el catálogo…</p>
                      </Command.Loading>
                    ) : null}
                    <Command.Empty className="px-4 py-8 text-center text-sm text-fg-muted">
                      No hay productos con ese nombre. Puedes escribir el concepto a mano.
                    </Command.Empty>
                    {grupos.map(([grupo, lista]) => (
                      <Command.Group key={grupo} heading={grupo} className={clasesGrupoLista}>
                        {lista.map((p) => {
                          const pl = precioDeLista(p)
                          return (
                            <Command.Item
                              key={p.id}
                              value={`${p.nombre} ${p.categoria?.nombre ?? ''} ${p.id}`}
                              onSelect={() => {
                                onElegir(p)
                                setAbierto(false)
                              }}
                              className={clasesOpcionLista}
                            >
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium">{p.nombre}</span>
                                <span className="block truncate text-xs text-fg-subtle">{p.categoria?.nombre ?? 'Sin categoría'}</span>
                              </span>
                              {pl ? (
                                <span className="num shrink-0 text-right text-sm text-fg-muted">{pl}</span>
                              ) : (
                                <Pildora tono="aviso" className="shrink-0">
                                  Sin precio
                                </Pildora>
                              )}
                            </Command.Item>
                          )
                        })}
                      </Command.Group>
                    ))}
                  </Command.List>
                </Command>
              </motion.div>
            </Popover.Content>
          </Popover.Portal>
        ) : null}
      </AnimatePresence>
    </Popover.Root>
  )
}
