import * as Popover from '@radix-ui/react-popover'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Command } from 'cmdk'
import { Loader2, Mail, MessageCircle, Search, UserPlus, UserRound } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useRef, useState } from 'react'
import { claves } from '@/app/consultas'
import { Campo, GlassButton, GlassInput, GlassPanel, Pildora } from '@/components/glass'
import { api } from '@/data/api'
import type { ClienteBreve } from '@/data/tipos'
import { NuevoClienteModal } from '@/features/clientes/NuevoClienteModal'
import { useDebounce } from '@/hooks/useDebounce'
import { telefono } from '@/lib/format'
import { resorte } from '@/lib/motion'
import { cn, iniciales } from '@/lib/utils'
import type { ClienteEditor, Errores, EstadoEditor } from './modelo'
import { EncabezadoSeccion, clasesBandeja } from './piezas'
import { clasesOpcionLista } from './SelectorProducto'

/** Para enfocar el buscador desde la validación. */
export const SELECTOR_BUSCAR_CLIENTE = '[data-buscar-cliente]'

/** Campo de búsqueda con resultados en una lista de cristal; incluye "Crear cliente". */
function BuscadorCliente({
  error,
  puedeCrear,
  onElegir,
  onCrear,
}: {
  error?: string
  puedeCrear: boolean
  onElegir: (c: ClienteBreve) => void
  onCrear: (nombre: string) => void
}) {
  const reducir = useReducedMotion()
  const [texto, setTexto] = useState('')
  const [abierto, setAbierto] = useState(false)
  const ancla = useRef<HTMLDivElement>(null)
  const q = useDebounce(texto.trim(), 250)
  const consulta = useQuery({
    queryKey: claves.clientes(q),
    queryFn: () => api.clientes.buscar(q),
    enabled: abierto,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })
  const resultados = consulta.data ?? []
  const idError = 'editor-cliente-error'

  return (
    // cmdk pone su propio id y etiqueta al campo: el nombre accesible va en `label`
    <Command shouldFilter={false} loop label="Cliente: busca por nombre, WhatsApp o correo" className="grid gap-1.5">
      <p className="text-sm font-medium text-fg-muted" aria-hidden>
        Cliente
      </p>
      <Popover.Root open={abierto} onOpenChange={setAbierto}>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Popover.Anchor asChild>
            <div ref={ancla} className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[1.1rem] -translate-y-1/2 text-fg-subtle" aria-hidden />
              <Command.Input
                data-buscar-cliente=""
                value={texto}
                onValueChange={(v) => {
                  setTexto(v)
                  setAbierto(true)
                }}
                onFocus={() => setAbierto(true)}
                onClick={() => setAbierto(true)}
                placeholder="Nombre, WhatsApp o correo"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? idError : undefined}
                autoComplete="off"
                className="field pl-10 pr-10"
              />
              {consulta.isFetching ? (
                <Loader2 className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-fg-subtle" aria-hidden />
              ) : null}
            </div>
          </Popover.Anchor>
          {puedeCrear ? (
            <GlassButton variante="cristal" icono={<UserPlus />} onClick={() => onCrear(texto.trim())} className="shrink-0 px-4">
              Crear cliente
            </GlassButton>
          ) : null}
        </div>

        <AnimatePresence>
          {abierto ? (
            <Popover.Portal forceMount>
              <Popover.Content
                asChild
                forceMount
                align="start"
                sideOffset={8}
                collisionPadding={12}
                onOpenAutoFocus={(e) => e.preventDefault()}
                onCloseAutoFocus={(e) => e.preventDefault()}
                onInteractOutside={(e) => {
                  if (ancla.current?.contains(e.target as Node)) e.preventDefault()
                }}
              >
                <motion.div
                  initial={reducir ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12 } }}
                  transition={resorte.modal}
                  style={{ transformOrigin: 'var(--radix-popover-content-transform-origin)' }}
                  className="glass glass-strong z-50 w-[var(--radix-popover-trigger-width)] min-w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-module shadow-glass-lg outline-none"
                >
                  <Command.List className="max-h-[min(22rem,50dvh)] overflow-y-auto overscroll-contain p-1.5">
                    {!consulta.isFetching || resultados.length ? (
                      <Command.Empty className="px-4 py-6 text-center text-sm text-fg-muted">
                        {q ? `No hay clientes con “${q}”.` : 'Todavía no hay clientes.'}
                        {puedeCrear ? ' Créalo para continuar.' : ''}
                      </Command.Empty>
                    ) : null}
                    {resultados.length ? (
                      <Command.Group heading={q ? 'Coincidencias' : 'Clientes'} className="px-1 pb-1 pt-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-fg-subtle">
                        {resultados.map((c) => (
                          <Command.Item
                            key={c.id}
                            value={c.id}
                            onSelect={() => {
                              onElegir(c)
                              setAbierto(false)
                              setTexto('')
                            }}
                            className={clasesOpcionLista}
                          >
                            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--control-bg)] text-xs font-semibold text-fg-muted" aria-hidden>
                              {iniciales(c.nombre)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{c.nombre}</span>
                              <span className="block truncate text-xs text-fg-subtle">
                                {c.whatsapp || c.telefono ? telefono(c.whatsapp ?? c.telefono) : (c.email ?? 'Sin contacto')}
                              </span>
                            </span>
                            {c.requiere_factura ? (
                              <Pildora tono="neutro" punto={false} className="shrink-0">
                                Factura
                              </Pildora>
                            ) : null}
                          </Command.Item>
                        ))}
                      </Command.Group>
                    ) : null}
                    {puedeCrear && q ? (
                      <Command.Item
                        value="__crear__"
                        onSelect={() => {
                          setAbierto(false)
                          onCrear(texto.trim())
                        }}
                        className={cn(clasesOpcionLista, 'mt-1 text-accent dark:text-navy-200')}
                      >
                        <UserPlus className="size-4 shrink-0" aria-hidden />
                        <span className="truncate">Crear el cliente “{texto.trim()}”</span>
                      </Command.Item>
                    ) : null}
                  </Command.List>
                </motion.div>
              </Popover.Content>
            </Popover.Portal>
          ) : null}
        </AnimatePresence>
      </Popover.Root>
      {error ? (
        <p id={idError} className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : (
        <p className="text-xs text-fg-subtle">Escribe para buscar o elige de la lista.</p>
      )}
    </Command>
  )
}

function ClienteElegido({ cliente, onCambiar }: { cliente: ClienteEditor; onCambiar: () => void }) {
  const tel = cliente.whatsapp ?? cliente.telefono
  return (
    <div className="grid gap-1.5">
      <p className="text-sm font-medium text-fg-muted" id="cliente-elegido">
        Cliente
      </p>
      <div className={cn(clasesBandeja, 'flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap')} aria-labelledby="cliente-elegido" role="group">
        <span className="glass glass-on-accent grid size-12 shrink-0 place-items-center rounded-full text-base font-semibold" aria-hidden>
          {iniciales(cliente.nombre)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold text-fg">
            <span className="truncate">{cliente.nombre}</span>
            {cliente.requiere_factura ? (
              <Pildora tono="acento" punto={false} className="h-5 px-2 text-2xs">
                Requiere factura
              </Pildora>
            ) : null}
          </p>
          <p className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-fg-muted">
            {tel ? (
              <span className="inline-flex items-center gap-1.5">
                <MessageCircle className="size-3.5 text-fg-subtle" aria-hidden />
                <span className="num">{telefono(tel)}</span>
              </span>
            ) : null}
            {cliente.email ? (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <Mail className="size-3.5 shrink-0 text-fg-subtle" aria-hidden />
                <span className="truncate">{cliente.email}</span>
              </span>
            ) : null}
            {!tel && !cliente.email ? <span>Sin WhatsApp ni correo registrado</span> : null}
          </p>
        </div>
        <GlassButton variante="cristal" tamano="sm" onClick={onCambiar} className="h-10 px-4 pointer-coarse:h-11">
          Cambiar cliente
        </GlassButton>
      </div>
    </div>
  )
}

export function SeccionCliente({
  estado,
  errores,
  mostrarErrores,
  puedeCrear,
  actualizar,
}: {
  estado: EstadoEditor
  errores: Errores
  mostrarErrores: boolean
  puedeCrear: boolean
  actualizar: <K extends keyof EstadoEditor>(campo: K, valor: EstadoEditor[K]) => void
}) {
  const [crear, setCrear] = useState<{ abierto: boolean; nombre: string }>({ abierto: false, nombre: '' })
  const [enfocarBuscador, setEnfocarBuscador] = useState(false)

  return (
    <GlassPanel className="p-4 sm:p-6" aria-labelledby="titulo-cliente">
      <EncabezadoSeccion id="titulo-cliente" icono={<UserRound />} titulo="Cliente y referencia" descripcion="A quién va dirigida y cómo la van a identificar." />

      <div className="mt-5 grid gap-4">
        {estado.cliente ? (
          <ClienteElegido
            cliente={estado.cliente}
            onCambiar={() => {
              actualizar('cliente', null)
              setEnfocarBuscador(true)
            }}
          />
        ) : (
          <div
            ref={(el) => {
              if (el && enfocarBuscador) {
                el.querySelector('input')?.focus()
                setEnfocarBuscador(false)
              }
            }}
          >
            <BuscadorCliente
              error={mostrarErrores ? errores.cliente : undefined}
              puedeCrear={puedeCrear}
              onElegir={(c) => actualizar('cliente', c)}
              onCrear={(nombre) => setCrear({ abierto: true, nombre })}
            />
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
          <Campo etiqueta="Título o referencia" opcional ayuda="Ayuda a encontrarla en la lista, p. ej. “Fachada sucursal centro”.">
            {(id, a) => (
              <GlassInput
                id={id}
                {...a}
                value={estado.titulo}
                onChange={(e) => actualizar('titulo', e.target.value)}
                maxLength={120}
                autoComplete="off"
                placeholder="¿Qué se cotiza?"
              />
            )}
          </Campo>
          <Campo etiqueta="Fecha" error={mostrarErrores ? errores.fecha : undefined}>
            {(id, a) => <GlassInput id={id} {...a} type="date" value={estado.fecha} onChange={(e) => actualizar('fecha', e.target.value)} />}
          </Campo>
        </div>
      </div>

      <NuevoClienteModal
        abierto={crear.abierto}
        onCambio={(abierto) => setCrear((c) => ({ ...c, abierto }))}
        nombreInicial={crear.nombre}
        onCreado={(c) => actualizar('cliente', c)}
      />
    </GlassPanel>
  )
}
