import * as Dialog from '@radix-ui/react-dialog'
import { useQuery } from '@tanstack/react-query'
import { Command } from 'cmdk'
import { FileText, Loader2, Package, Search, User } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { claves } from '@/app/consultas'
import { useSesion } from '@/app/sesion'
import { api } from '@/data/api'
import { useDebounce } from '@/hooks/useDebounce'
import { dinero, telefono } from '@/lib/format'
import { resorte } from '@/lib/motion'
import { normalizar } from '@/lib/utils'
import { ACCIONES_RAPIDAS } from './accionesRapidas'
import { useModulosVisibles } from './usarModulos'

const grupo = 'px-2 pb-1 pt-3 text-xs font-medium text-fg-subtle [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1.5'
const item =
  'flex cursor-pointer items-center gap-3 rounded-control px-3 py-2.5 text-sm text-fg outline-none data-[selected=true]:bg-[var(--control-bg-hover)] data-[selected=true]:shadow-[inset_0_1px_0_var(--inner-hi)]'

/** Accesos que solo abren un módulo: ya están en "Ir a" y se repetirían. */
const SOLO_NAVEGAN = new Set(['calendario', 'produccion', 'reportes'])

/** Búsqueda global y comandos (Ctrl/⌘ + K). */
export function PaletaComandos({ abierto, onCambio }: { abierto: boolean; onCambio: (v: boolean) => void }) {
  const [texto, setTexto] = useState('')
  const q = useDebounce(texto.trim(), 200)
  const navegar = useNavigate()
  const modulos = useModulosVisibles()
  const { puede } = useSesion()
  const resultados = useQuery({
    queryKey: claves.busqueda(q),
    queryFn: () => api.busqueda.global(q),
    enabled: abierto && q.length >= 2,
    staleTime: 10_000,
  })

  const ir = (ruta: string) => {
    onCambio(false)
    setTexto('')
    navegar(ruta)
  }

  const r = resultados.data
  // Sin texto se sugieren acciones y módulos; al escribir, solo los que coinciden (los módulos también se buscan)
  const buscado = normalizar(q)
  const coincide = (...textos: Array<string | undefined>) => q.length < 2 || textos.some((t) => t && normalizar(t).includes(buscado))
  const acciones = ACCIONES_RAPIDAS.filter(
    (a) => a.destino !== 'nuevo-cliente' && !SOLO_NAVEGAN.has(a.id) && (!a.permiso || puede(a.permiso)) && coincide(a.etiqueta),
  ).slice(0, 4)
  const irA = modulos.filter((m) => coincide(m.titulo, m.descripcion))
  return (
    <Dialog.Root open={abierto} onOpenChange={onCambio}>
      <AnimatePresence>
        {abierto ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-navy-950/25 backdrop-blur-[3px] dark:bg-black/45"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              />
            </Dialog.Overlay>
            <div className="pointer-events-none fixed inset-0 z-50 flex items-start justify-center px-3 pt-[12vh]">
              <Dialog.Content asChild forceMount aria-describedby={undefined}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: -6 }}
                  transition={resorte.modal}
                  className="glass glass-strong pointer-events-auto w-full max-w-xl overflow-hidden rounded-sheet shadow-glass-lg outline-none"
                >
                  <Dialog.Title className="sr-only">Buscar</Dialog.Title>
                  <Command shouldFilter={false} label="Búsqueda global" className="flex max-h-[70dvh] flex-col">
                    <div className="flex items-center gap-3 border-b border-[var(--divider)] px-5">
                      <Search className="size-5 shrink-0 text-fg-subtle" aria-hidden />
                      <Command.Input
                        value={texto}
                        onValueChange={setTexto}
                        placeholder="Busca un cliente, folio o módulo"
                        className="h-16 min-w-0 flex-1 bg-transparent text-md text-fg outline-none placeholder:text-fg-subtle focus-visible:shadow-none"
                      />
                      {resultados.isFetching ? <Loader2 className="size-4 animate-spin text-fg-subtle" aria-hidden /> : null}
                    </div>
                    <Command.List className="min-h-0 overflow-y-auto p-2">
                      <Command.Empty className="px-4 py-10 text-center text-sm text-fg-muted">
                        {q.length < 2
                          ? 'Escribe al menos dos letras'
                          : resultados.isFetching || texto.trim() !== q
                            ? 'Buscando…'
                            : resultados.isError
                              ? 'No se pudo buscar. Revisa tu conexión e inténtalo de nuevo.'
                              : `Sin resultados para “${q}”. Prueba con el nombre del cliente o un folio como PED-0012.`}
                      </Command.Empty>

                      {r?.clientes.length ? (
                        <Command.Group heading="Clientes" className={grupo}>
                          {r.clientes.map((c) => (
                            <Command.Item key={c.id} value={`cliente-${c.id}`} onSelect={() => ir(`/clientes/${c.id}`)} className={item}>
                              <User className="size-4 text-fg-subtle" aria-hidden />
                              <span className="flex-1 truncate">{c.nombre}</span>
                              {c.telefono ? <span className="num hidden shrink-0 text-xs text-fg-subtle sm:inline">{telefono(c.telefono)}</span> : null}
                            </Command.Item>
                          ))}
                        </Command.Group>
                      ) : null}
                      {r?.cotizaciones.length ? (
                        <Command.Group heading="Cotizaciones" className={grupo}>
                          {r.cotizaciones.map((c) => (
                            <Command.Item key={c.id} value={`cot-${c.id}`} onSelect={() => ir(`/cotizaciones/${c.id}`)} className={item}>
                              <FileText className="size-4 text-fg-subtle" aria-hidden />
                              <span className="num font-semibold">{c.folio}</span>
                              <span className="flex-1 truncate text-fg-muted">{c.cliente}</span>
                              <span className="num shrink-0 text-xs text-fg-subtle">{dinero(c.total)}</span>
                            </Command.Item>
                          ))}
                        </Command.Group>
                      ) : null}
                      {r?.pedidos.length ? (
                        <Command.Group heading="Pedidos" className={grupo}>
                          {r.pedidos.map((p) => (
                            <Command.Item key={p.id} value={`ped-${p.id}`} onSelect={() => ir(`/pedidos/${p.id}`)} className={item}>
                              <Package className="size-4 text-fg-subtle" aria-hidden />
                              <span className="num font-semibold">{p.folio}</span>
                              <span className="flex-1 truncate text-fg-muted">{p.titulo}</span>
                            </Command.Item>
                          ))}
                        </Command.Group>
                      ) : null}

                      {acciones.length ? (
                        <Command.Group heading="Acciones" className={grupo}>
                          {acciones.map((a) => {
                            const Icono = a.icono
                            return (
                              <Command.Item key={a.id} value={`accion-${a.id}`} onSelect={() => ir(a.destino)} className={item}>
                                <Icono className="size-4 text-fg-subtle" aria-hidden />
                                {a.etiqueta}
                              </Command.Item>
                            )
                          })}
                        </Command.Group>
                      ) : null}
                      {irA.length ? (
                        <Command.Group heading="Ir a" className={grupo}>
                          {irA.map((m) => {
                            const Icono = m.icono
                            return (
                              <Command.Item key={m.ruta} value={`modulo-${m.ruta}`} onSelect={() => ir(m.ruta)} className={item}>
                                <Icono className="size-4 text-fg-subtle" aria-hidden />
                                {m.titulo}
                                <span className="ml-auto truncate text-xs text-fg-subtle">{m.descripcion}</span>
                              </Command.Item>
                            )
                          })}
                        </Command.Group>
                      ) : null}
                    </Command.List>
                  </Command>
                </motion.div>
              </Dialog.Content>
            </div>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  )
}
