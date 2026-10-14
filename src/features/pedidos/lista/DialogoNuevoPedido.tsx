import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Command } from 'cmdk'
import { Brush, Hammer, Loader2, PackagePlus, Search, Truck, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { claves, useEquipo } from '@/app/consultas'
import { Campo, GlassButton, GlassInput, GlassModal, GlassSelect, GlassTextarea, SegmentedControl } from '@/components/glass'
import { api } from '@/data/api'
import type { Prioridad } from '@/data/modulos/pedidos/contrato'
import type { ClienteBreve, EstadoPedido } from '@/data/tipos'
import { useDebounce } from '@/hooks/useDebounce'
import { hoyISO, sumarDias, telefono } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useCrearPedido } from '../consultas'
import { Avatar } from '../piezas'

const ATAJOS = [
  { dias: 3, etiqueta: 'En 3 días' },
  { dias: 7, etiqueta: 'En una semana' },
  { dias: 15, etiqueta: 'En 15 días' },
]

const PRIORIDADES: Array<{ valor: Prioridad; etiqueta: string }> = [
  { valor: 'baja', etiqueta: 'Baja' },
  { valor: 'normal', etiqueta: 'Normal' },
  { valor: 'alta', etiqueta: 'Alta' },
  { valor: 'urgente', etiqueta: 'Urgente' },
]

/** Etapas que se omiten según lo que lleva el trabajo (igual que al convertir una cotización). */
export function omitidasPor(lleva: { diseno: boolean; produccion: boolean; instalacion: boolean }): EstadoPedido[] {
  const o: EstadoPedido[] = []
  if (!lleva.diseno) o.push('en_diseno', 'esperando_aprobacion', 'aprobado')
  if (!lleva.produccion) o.push('en_produccion', 'acabados')
  if (!lleva.instalacion) o.push('en_instalacion')
  return o
}

type Errores = Partial<Record<'cliente' | 'titulo' | 'entrega' | 'direccion', string>>

/** Pedido directo (sin cotización): datos generales; los conceptos se agregan en el detalle. */
export function DialogoNuevoPedido({ abierto, onCambio }: { abierto: boolean; onCambio: (v: boolean) => void }) {
  const navegar = useNavigate()
  const crear = useCrearPedido()
  const equipo = useEquipo()
  const hoy = hoyISO()
  const [cliente, setCliente] = useState<ClienteBreve | null>(null)
  const [titulo, setTitulo] = useState('')
  const [entrega, setEntrega] = useState('')
  const [prioridad, setPrioridad] = useState<Prioridad>('normal')
  const [responsable, setResponsable] = useState('')
  const [lleva, setLleva] = useState({ diseno: true, produccion: true, instalacion: false })
  const [direccion, setDireccion] = useState('')
  const [errores, setErrores] = useState<Errores>({})

  useEffect(() => {
    if (!abierto) return
    setCliente(null)
    setTitulo('')
    setEntrega('')
    setPrioridad('normal')
    setResponsable('')
    setLleva({ diseno: true, produccion: true, instalacion: false })
    setDireccion('')
    setErrores({})
  }, [abierto])

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    const err: Errores = {}
    if (!cliente) err.cliente = 'Elige el cliente del pedido'
    if (!titulo.trim()) err.titulo = 'Escribe un título corto, por ejemplo “Lona para fachada”'
    if (entrega && entrega < hoy) err.entrega = 'La fecha de entrega no puede ser anterior a hoy'
    if (lleva.instalacion && !direccion.trim()) err.direccion = 'Escribe la dirección de la instalación'
    setErrores(err)
    if (Object.keys(err).length || !cliente) return
    try {
      const r = await crear.mutateAsync({
        cliente_id: cliente.id,
        titulo: titulo.trim(),
        fecha_entrega: entrega || null,
        prioridad,
        responsable_id: responsable || null,
        requiere_instalacion: lleva.instalacion,
        direccion_instalacion: lleva.instalacion ? direccion.trim() : null,
        etapas_omitidas: omitidasPor(lleva),
        partidas: [],
      })
      toast.success(`Pedido ${r.folio} creado`, { description: 'Agrega los conceptos para calcular el total.' })
      onCambio(false)
      navegar(`/pedidos/${r.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear el pedido. Inténtalo de nuevo.')
    }
  }

  return (
    <GlassModal
      abierto={abierto}
      onCambio={onCambio}
      titulo="Nuevo pedido"
      descripcion="Para trabajos que no pasaron por cotización. Los conceptos y precios se agregan en el pedido."
      ancho="lg"
      pie={
        <>
          <GlassButton variante="fantasma" onClick={() => onCambio(false)}>
            Cancelar
          </GlassButton>
          <GlassButton type="submit" form="form-nuevo-pedido" variante="primario" icono={<PackagePlus />} cargando={crear.isPending}>
            Crear pedido
          </GlassButton>
        </>
      }
    >
      <form id="form-nuevo-pedido" onSubmit={enviar} className="flex flex-col gap-4" noValidate>
        <BuscadorCliente cliente={cliente} onCambio={(c) => { setCliente(c); setErrores((x) => ({ ...x, cliente: undefined })) }} error={errores.cliente} />

        <Campo etiqueta="Título del pedido" error={errores.titulo} ayuda="Así lo verá el equipo de producción.">
          {(id, a) => <GlassInput id={id} {...a} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej. Lona para fachada" maxLength={120} />}
        </Campo>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Fecha de entrega" opcional error={errores.entrega}>
            {(id, a) => (
              <div className="flex flex-col gap-2">
                <GlassInput id={id} {...a} type="date" min={hoy} value={entrega} onChange={(e) => setEntrega(e.target.value)} />
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Atajos de fecha de entrega">
                  {ATAJOS.map((x) => {
                    const valor = sumarDias(hoy, x.dias)
                    const activo = entrega === valor
                    return (
                      <GlassButton key={x.dias} variante={activo ? 'luz' : 'cristal'} tamano="sm" aria-pressed={activo} onClick={() => setEntrega(activo ? '' : valor)} className="h-11 px-3.5">
                        {x.etiqueta}
                      </GlassButton>
                    )
                  })}
                </div>
              </div>
            )}
          </Campo>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium text-fg-muted" id="nuevo-prioridad">
                Prioridad
              </p>
              <SegmentedControl etiqueta="Prioridad" tamano="sm" segmentos={PRIORIDADES} valor={prioridad} onCambio={setPrioridad} className="w-full" />
            </div>
            <Campo etiqueta="Responsable" opcional>
              {(id, a) => (
                <GlassSelect id={id} {...a} value={responsable} onChange={(e) => setResponsable(e.target.value)}>
                  <option value="">Sin asignar</option>
                  {(equipo.data ?? []).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre}
                    </option>
                  ))}
                </GlassSelect>
              )}
            </Campo>
          </div>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium text-fg-muted">El trabajo lleva</legend>
          <div className="grid grid-cols-3 gap-2">
            <Interruptor icono={<Brush />} titulo="Diseño" activo={lleva.diseno} onCambio={(v) => setLleva((x) => ({ ...x, diseno: v }))} />
            <Interruptor icono={<Hammer />} titulo="Taller" activo={lleva.produccion} onCambio={(v) => setLleva((x) => ({ ...x, produccion: v }))} />
            <Interruptor icono={<Truck />} titulo="Instalación" activo={lleva.instalacion} onCambio={(v) => setLleva((x) => ({ ...x, instalacion: v }))} />
          </div>
          <p className="text-xs text-fg-subtle">Las etapas que no lleva se saltan solas. Se puede cambiar después en el pedido.</p>
        </fieldset>

        {lleva.instalacion ? (
          <Campo etiqueta="Dirección de la instalación" error={errores.direccion}>
            {(id, a) => <GlassTextarea id={id} {...a} rows={2} value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Calle, número, colonia y referencias" />}
          </Campo>
        ) : null}
      </form>
    </GlassModal>
  )
}

/** Interruptor compacto con pozo de ícono (mismo lenguaje que GlassToggle, en cuadrícula de 3). */
export function Interruptor({ icono, titulo, activo, onCambio, deshabilitado }: { icono: React.ReactNode; titulo: string; activo: boolean; onCambio: (v: boolean) => void; deshabilitado?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      disabled={deshabilitado}
      onClick={() => onCambio(!activo)}
      className={cn(
        'glass glass-thick glass-interactive flex min-h-[3.25rem] items-center gap-2 rounded-full p-1.5 pr-3 text-left outline-none disabled:cursor-not-allowed disabled:opacity-60',
      )}
    >
      <span
        className={cn(
          'grid size-10 shrink-0 place-items-center rounded-full transition-colors duration-300 [&_svg]:size-[1.15rem]',
          activo ? 'bg-accent text-accent-fg' : 'bg-[var(--control-bg)] text-fg-subtle',
        )}
        aria-hidden
      >
        {icono}
      </span>
      <span className={cn('min-w-0 truncate text-sm font-semibold', activo ? 'text-fg' : 'text-fg-muted line-through decoration-fg-subtle/60')}>{titulo}</span>
    </button>
  )
}

function BuscadorCliente({ cliente, onCambio, error }: { cliente: ClienteBreve | null; onCambio: (c: ClienteBreve | null) => void; error?: string }) {
  const [texto, setTexto] = useState('')
  const q = useDebounce(texto.trim(), 250)
  const consulta = useQuery({
    queryKey: claves.clientes(q),
    queryFn: () => api.clientes.buscar(q),
    enabled: !cliente,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })

  if (cliente) {
    return (
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium text-fg-muted">Cliente</p>
        <div className="flex items-center gap-3 rounded-control bg-[var(--control-bg)] py-2 pl-2 pr-1.5">
          <Avatar nombre={cliente.nombre} className="size-9 text-xs" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-fg">{cliente.nombre}</p>
            <p className="truncate text-xs text-fg-muted">{cliente.whatsapp ? `WhatsApp ${telefono(cliente.whatsapp)}` : (cliente.email ?? 'Sin contacto registrado')}</p>
          </div>
          <GlassButton variante="fantasma" tamano="icono" icono={<X />} aria-label={`Cambiar cliente (${cliente.nombre})`} onClick={() => onCambio(null)} />
        </div>
      </div>
    )
  }

  const resultados = (consulta.data ?? []).slice(0, 6)
  return (
    <Command shouldFilter={false} loop label="Cliente: busca por nombre, WhatsApp o correo" className="flex flex-col gap-1.5">
      <p className="text-sm font-medium text-fg-muted" aria-hidden>
        Cliente
      </p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[1.1rem] -translate-y-1/2 text-fg-subtle" aria-hidden />
        <Command.Input
          value={texto}
          onValueChange={setTexto}
          placeholder="Busca por nombre, WhatsApp o correo"
          aria-invalid={error ? true : undefined}
          autoComplete="off"
          className="field pl-10 pr-10"
        />
        {consulta.isFetching ? <Loader2 className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-fg-subtle" aria-hidden /> : null}
      </div>
      {error ? <p className="text-xs font-medium text-danger">{error}</p> : null}
      <Command.List className="max-h-56 overflow-y-auto rounded-control">
        {consulta.data && resultados.length === 0 ? (
          <Command.Empty className="px-3 py-3 text-sm text-fg-muted">{q ? `Ningún cliente coincide con “${q}”. Regístralo primero en Clientes.` : 'Escribe para buscar.'}</Command.Empty>
        ) : null}
        {resultados.map((c) => (
          <Command.Item
            key={c.id}
            value={c.id}
            onSelect={() => onCambio(c)}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-2.5 py-1.5 text-sm outline-none data-[selected=true]:bg-[var(--control-bg-hover)]"
          >
            <Avatar nombre={c.nombre} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-fg">{c.nombre}</span>
              {c.whatsapp ? <span className="block truncate text-xs text-fg-muted">{telefono(c.whatsapp)}</span> : null}
            </span>
          </Command.Item>
        ))}
      </Command.List>
    </Command>
  )
}
