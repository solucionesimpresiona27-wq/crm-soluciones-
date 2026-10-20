import { useQuery } from '@tanstack/react-query'
import { Check, Search, UserPlus, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { useEquipo } from '@/app/consultas'
import { useSesion } from '@/app/sesion'
import { Campo, GlassButton, GlassInput, GlassModal, GlassSelect, GlassTextarea } from '@/components/glass'
import { api } from '@/data/api'
import type { Oportunidad } from '@/data/modulos/embudo/contrato'
import { NuevoClienteModal } from '@/features/clientes/NuevoClienteModal'
import { useDebounce } from '@/hooks/useDebounce'
import { telefono } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useGuardarOportunidad } from './consultas'
import { enfocarSinDesplazar, ORIGENES } from './util'

interface Props {
  abierto: boolean
  onCambio: (a: boolean) => void
  /** Si viene, se edita */
  oportunidad?: Oportunidad | null
  onGuardada?: (o: Oportunidad) => void
}

type ClienteSel = { id: string; nombre: string; whatsapp: string | null }

/** Selector de cliente con búsqueda y alta rápida. */
function SelectorCliente({ valor, onValor, error, bloqueado }: { valor: ClienteSel | null; onValor: (c: ClienteSel | null) => void; error?: string | null; bloqueado?: boolean }) {
  const [texto, setTexto] = useState('')
  const [nuevo, setNuevo] = useState(false)
  const q = useDebounce(texto.trim(), 250)
  const resultados = useQuery({ queryKey: ['clientes', 'buscar', q], queryFn: () => api.clientes.buscar(q), enabled: !valor && q.length > 0 })

  if (valor) {
    return (
      <Campo etiqueta="Cliente" error={error}>
        {(id) => (
          <div id={id} className="glass glass-thick flex min-h-11 items-center gap-3 rounded-control py-1.5 pl-4 pr-1.5">
            <Check className="size-4 shrink-0 text-success" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-fg" title={valor.nombre}>{valor.nombre}</span>
              {valor.whatsapp ? <span className="num block text-xs text-fg-muted">{telefono(valor.whatsapp)}</span> : null}
            </span>
            {bloqueado ? null : (
              <GlassButton variante="fantasma" tamano="sm" icono={<X />} className="h-10" onClick={() => onValor(null)}>
                Cambiar
              </GlassButton>
            )}
          </div>
        )}
      </Campo>
    )
  }

  const lista = resultados.data ?? []
  return (
    <>
      <Campo etiqueta="Cliente" error={error}>
        {(id, p) => (
          <div className="flex flex-col gap-1.5">
            <GlassInput
              id={id}
              {...p}
              type="search"
              icono={<Search />}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Busca por nombre o WhatsApp"
              autoComplete="off"
              aria-controls={`${id}-res`}
            />
            {q ? (
              <ul id={`${id}-res`} aria-label="Clientes encontrados" className="glass glass-strong max-h-56 overflow-y-auto rounded-tile p-1.5">
                {lista.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => onValor({ id: c.id, nombre: c.nombre, whatsapp: c.whatsapp ?? c.telefono })}
                      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-control px-3 text-left text-sm outline-none hover:bg-[var(--control-bg-hover)] focus-visible:bg-[var(--control-bg-hover)]"
                    >
                      <span className="truncate font-medium text-fg">{c.nombre}</span>
                      <span className="num shrink-0 text-xs text-fg-subtle">{telefono(c.whatsapp ?? c.telefono)}</span>
                    </button>
                  </li>
                ))}
                {resultados.isFetching && !lista.length ? <li className="px-3 py-2.5 text-sm text-fg-subtle">Buscando…</li> : null}
                {resultados.isSuccess && !lista.length ? <li className="px-3 py-2 text-sm text-fg-subtle">Ningún cliente con “{q}”.</li> : null}
                <li>
                  <button
                    type="button"
                    onClick={() => setNuevo(true)}
                    className="flex min-h-11 w-full items-center gap-2 rounded-control px-3 text-left text-sm font-semibold text-accent outline-none hover:bg-[var(--control-bg-hover)] focus-visible:bg-[var(--control-bg-hover)] dark:text-navy-200 [&_svg]:size-4"
                  >
                    <UserPlus aria-hidden /> Crear cliente “{q}”
                  </button>
                </li>
              </ul>
            ) : null}
          </div>
        )}
      </Campo>
      <NuevoClienteModal
        abierto={nuevo}
        onCambio={setNuevo}
        nombreInicial={q}
        onCreado={(c) => {
          setNuevo(false)
          onValor({ id: c.id, nombre: c.nombre, whatsapp: c.whatsapp ?? c.telefono })
        }}
      />
    </>
  )
}

/** Crear o editar una oportunidad. */
export function OportunidadModal({ abierto, onCambio, oportunidad, onGuardada }: Props) {
  const { sesion, puede } = useSesion()
  const conPrecios = puede('ver_precios')
  const equipo = useEquipo()
  const guardar = useGuardarOportunidad()
  const [cliente, setCliente] = useState<ClienteSel | null>(null)
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [valor, setValor] = useState('')
  const [origen, setOrigen] = useState('')
  const [responsable, setResponsable] = useState('')
  const [accion, setAccion] = useState('')
  const [fecha, setFecha] = useState('')
  const [errores, setErrores] = useState<{ cliente?: string; titulo?: string; valor?: string; fecha?: string }>({})

  useEffect(() => {
    if (!abierto) return
    const o = oportunidad
    setCliente(o ? o.cliente : null)
    setTitulo(o?.titulo ?? '')
    setDescripcion(o?.descripcion ?? '')
    setValor(o?.valor_estimado != null ? String(o.valor_estimado) : '')
    setOrigen(o?.origen ?? '')
    setResponsable(o ? (o.responsable_id ?? '') : (sesion?.perfil.id ?? ''))
    setAccion(o?.proxima_accion ?? '')
    setFecha(o?.proxima_accion_fecha ?? '')
    setErrores({})
  }, [abierto, oportunidad, sesion])

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    const v = valor.trim() ? Number(valor) : null
    const err: typeof errores = {}
    if (!cliente) err.cliente = 'Elige un cliente o créalo desde el buscador.'
    if (!titulo.trim()) err.titulo = 'Escribe qué quiere el cliente, por ejemplo “Lona para fachada”.'
    if (v !== null && (!Number.isFinite(v) || v < 0)) err.valor = 'Escribe un monto válido (sin signos) o déjalo vacío.'
    if (accion.trim() && !fecha) err.fecha = 'Indica cuándo harás la próxima acción.'
    setErrores(err)
    if (Object.keys(err).length) {
      // Lleva el foco al primer campo con error para que se vea y se pueda corregir de inmediato
      requestAnimationFrame(() => enfocarSinDesplazar(document.querySelector<HTMLElement>('#form-oportunidad [aria-invalid="true"]')))
      return
    }
    guardar.mutate(
      {
        id: oportunidad?.id,
        datos: {
          cliente_id: cliente!.id,
          titulo,
          descripcion,
          ...(conPrecios ? { valor_estimado: v } : {}),
          origen: origen || null,
          responsable_id: responsable || null,
          proxima_accion: accion,
          proxima_accion_fecha: fecha || null,
        },
      },
      {
        onSuccess: (o) => {
          toast.success(oportunidad ? 'Oportunidad actualizada' : 'Oportunidad creada', { description: o.titulo })
          onGuardada?.(o)
          onCambio(false)
        },
        onError: (e) => toast.error('No se pudo guardar la oportunidad', { description: e.message }),
      },
    )
  }

  return (
    <GlassModal
      abierto={abierto}
      onCambio={onCambio}
      ancho="lg"
      titulo={oportunidad ? 'Editar oportunidad' : 'Nueva oportunidad'}
      descripcion={oportunidad ? undefined : 'Registra a quien pidió informes para darle seguimiento hasta cerrar la venta.'}
      pie={
        <>
          <GlassButton variante="fantasma" onClick={() => onCambio(false)}>
            Cancelar
          </GlassButton>
          <GlassButton variante="primario" type="submit" form="form-oportunidad" cargando={guardar.isPending}>
            {oportunidad ? 'Guardar cambios' : 'Crear oportunidad'}
          </GlassButton>
        </>
      }
    >
      <form id="form-oportunidad" onSubmit={enviar} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="min-w-0 sm:col-span-2">
          <SelectorCliente valor={cliente} onValor={setCliente} error={errores.cliente} bloqueado={Boolean(oportunidad)} />
        </div>
        <Campo etiqueta="Título" error={errores.titulo} className="sm:col-span-2">
          {(id, p) => <GlassInput id={id} {...p} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej. Lona 3×2 m para fachada" maxLength={140} />}
        </Campo>
        <Campo etiqueta="Descripción" opcional className="sm:col-span-2">
          {(id) => <GlassTextarea id={id} rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Medidas, cantidades, para cuándo lo necesita…" />}
        </Campo>
        {conPrecios ? (
          <Campo etiqueta="Valor estimado" opcional error={errores.valor} ayuda="Lo que calculas que podría comprar.">
            {(id, p) => (
              <GlassInput id={id} {...p} type="number" inputMode="decimal" min={0} step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} sufijo="MXN" className="num pr-16" />
            )}
          </Campo>
        ) : null}
        <Campo etiqueta="¿Cómo llegó?" opcional>
          {(id) => (
            <GlassSelect id={id} value={origen} onChange={(e) => setOrigen(e.target.value)}>
              <option value="">Sin indicar</option>
              {ORIGENES.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
              {origen && !(ORIGENES as readonly string[]).includes(origen) ? <option value={origen}>{origen}</option> : null}
            </GlassSelect>
          )}
        </Campo>
        <Campo etiqueta="Responsable" className={cn(!conPrecios && 'sm:col-span-2')}>
          {(id) => (
            <GlassSelect id={id} value={responsable} onChange={(e) => setResponsable(e.target.value)}>
              <option value="">Sin asignar</option>
              {(equipo.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </GlassSelect>
          )}
        </Campo>
        <Campo etiqueta="Próxima acción" opcional>
          {(id) => <GlassInput id={id} value={accion} onChange={(e) => setAccion(e.target.value)} placeholder="Ej. Llamar para confirmar medidas" maxLength={140} />}
        </Campo>
        <Campo etiqueta="Fecha de la próxima acción" opcional error={errores.fecha}>
          {(id, p) => <GlassInput id={id} {...p} type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="num" />}
        </Campo>
      </form>
    </GlassModal>
  )
}
