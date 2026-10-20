import { Camera, FileCheck2, Paperclip, Search, SearchX, X } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { useConfiguracion } from '@/app/consultas'
import { useSesion } from '@/app/sesion'
import { Campo, GlassButton, GlassInput, GlassModal, GlassSurface, GlassTextarea, Pildora, SegmentedControl, Skeleton } from '@/components/glass'
import { METODOS_PAGO, TIPOS_PAGO, type Pago, type TipoPago } from '@/data/modulos/pagos/contrato'
import type { MetodoPago } from '@/data/tipos'
import { useDebounce } from '@/hooks/useDebounce'
import { dinero, hoyISO } from '@/lib/format'
import { resorte } from '@/lib/motion'
import { cn, normalizar, redondear } from '@/lib/utils'
import { useCuentasPorCobrar, usePedidoParaCobro, useRegistrarPago } from './consultas'
import { ICONO_METODO, useMensajePago } from './piezas'
import { leerImporte, tipoSugerido, validarImporte } from './util'

export interface RegistrarPagoModalProps {
  /** Pedido a cobrar. Sin él, el diálogo empieza con un buscador de pedidos con saldo. */
  pedidoId?: string
  abierto: boolean
  onCambio: (abierto: boolean) => void
  /** Se llama con el pago ya registrado (después del aviso). */
  onRegistrado?: (pago: Pago) => void
}

/** Lo mínimo del pedido para cobrarlo. */
interface PedidoCobro {
  id: string
  folio: string
  titulo: string
  cliente: string
  whatsapp: string | null
  total: number
  pagado: number
  saldo: number
  anticipoPct: number | null
  cancelado: boolean
}

const TODOS_METODOS: MetodoPago[] = ['transferencia', 'efectivo', 'deposito', 'tarjeta']
const TIPOS: TipoPago[] = ['anticipo', 'abono', 'liquidacion', 'devolucion']

/**
 * Diálogo para registrar un cobro (o una devolución) de un pedido. Reutilizable desde otros
 * módulos: `<RegistrarPagoModal pedidoId={id} abierto={a} onCambio={setA} />`.
 */
export function RegistrarPagoModal({ pedidoId, abierto, onCambio, onRegistrado }: RegistrarPagoModalProps) {
  const { puede } = useSesion()
  const permitido = puede('registrar_pagos')
  return (
    <GlassModal
      abierto={abierto}
      onCambio={onCambio}
      titulo="Registrar pago"
      descripcion={permitido ? 'El saldo del pedido se actualiza al guardar.' : undefined}
      ancho="md"
    >
      {permitido ? (
        <Formulario key={pedidoId ?? 'buscar'} pedidoId={pedidoId} onCerrar={() => onCambio(false)} onRegistrado={onRegistrado} />
      ) : (
        <p className="py-6 text-sm text-fg-muted">Tu rol no incluye registrar pagos. Pide a administración que lo registre o que te dé el permiso.</p>
      )}
    </GlassModal>
  )
}

function Formulario({ pedidoId, onCerrar, onRegistrado }: { pedidoId?: string; onCerrar: () => void; onRegistrado?: (pago: Pago) => void }) {
  const fijo = usePedidoParaCobro(pedidoId)
  const config = useConfiguracion()
  const [elegido, setElegido] = useState<PedidoCobro | null>(null)

  const desdeId = useMemo<PedidoCobro | null>(() => {
    const p = fijo.data
    if (!p) return null
    const total = p.montos?.total ?? p.total ?? 0
    const pagado = p.montos?.pagado ?? p.pagado ?? 0
    return {
      id: p.id,
      folio: p.folio,
      titulo: p.titulo,
      cliente: p.cliente_datos?.nombre ?? p.cliente,
      whatsapp: p.cliente_datos?.whatsapp ?? p.cliente_datos?.telefono ?? p.cliente_whatsapp,
      total,
      pagado,
      saldo: p.montos?.saldo ?? p.saldo ?? redondear(total - pagado),
      anticipoPct: p.montos?.anticipo_pct ?? null,
      cancelado: p.estado === 'cancelado',
    }
  }, [fijo.data])

  if (pedidoId) {
    if (fijo.isPending) return <EsqueletoFormulario />
    if (fijo.isError || !desdeId)
      return <p className="py-6 text-sm text-danger">No se pudo cargar el pedido: {fijo.error?.message ?? 'no encontrado'}. Cierra y vuelve a intentarlo.</p>
    return <Captura pedido={desdeId} anticipoDefault={config.data?.anticipo_pct ?? 50} onCerrar={onCerrar} onRegistrado={onRegistrado} />
  }
  if (!elegido) return <BuscadorPedido onElegir={setElegido} />
  return (
    <Captura
      pedido={elegido}
      anticipoDefault={config.data?.anticipo_pct ?? 50}
      onCambiarPedido={() => setElegido(null)}
      onCerrar={onCerrar}
      onRegistrado={onRegistrado}
    />
  )
}

function EsqueletoFormulario() {
  return (
    <div className="flex flex-col gap-4 py-2" aria-hidden>
      <Skeleton className="h-28 rounded-tile" />
      <Skeleton className="h-10 w-3/4 rounded-full" />
      <Skeleton className="h-12" />
      <Skeleton className="h-12" />
    </div>
  )
}

function BuscadorPedido({ onElegir }: { onElegir: (p: PedidoCobro) => void }) {
  const cxc = useCuentasPorCobrar()
  const [texto, setTexto] = useState('')
  const q = normalizar(useDebounce(texto, 150).trim())
  const resultados = useMemo(() => {
    const filas = cxc.data ?? []
    const f = q ? filas.filter((c) => normalizar(`${c.folio} ${c.cliente} ${c.titulo}`).includes(q)) : filas
    return f.slice(0, 8)
  }, [cxc.data, q])
  const idLista = useId()

  return (
    <div className="flex flex-col gap-3 pb-1">
      <GlassInput
        type="search"
        autoFocus
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Folio o cliente"
        aria-label="Buscar pedido con saldo por folio o cliente"
        aria-controls={idLista}
        icono={<Search />}
        className="rounded-full"
        autoComplete="off"
        enterKeyHint="search"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && resultados.length === 1) {
            e.preventDefault()
            const c = resultados[0]
            onElegir(aCobro(c))
          }
        }}
      />
      <p className="text-xs text-fg-subtle">Pedidos con saldo pendiente, los vencidos primero.</p>
      {cxc.isPending ? (
        <div className="flex flex-col gap-2" aria-hidden>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-tile" />
          ))}
        </div>
      ) : cxc.isError ? (
        <p className="text-sm text-danger">No se pudieron cargar los pedidos: {cxc.error.message}</p>
      ) : resultados.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <SearchX className="size-7 text-fg-subtle" aria-hidden />
          <p className="text-sm font-semibold text-fg">{q ? `Ningún pedido con saldo coincide con “${texto.trim()}”` : 'No hay pedidos con saldo pendiente'}</p>
          <p className="max-w-xs text-xs text-fg-muted">Para registrar una devolución, ábrela desde el pedido.</p>
        </div>
      ) : (
        <ul id={idLista} className="flex flex-col gap-1.5" aria-label="Pedidos con saldo">
          {resultados.map((c) => (
            <li key={c.pedido_id}>
              <button
                type="button"
                onClick={() => onElegir(aCobro(c))}
                className="flex min-h-14 w-full items-center gap-3 rounded-tile px-3.5 py-2.5 text-left outline-none transition-colors hover:bg-[var(--row-hover)] focus-visible:shadow-[var(--focus-ring)]"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="num text-sm font-semibold text-fg-muted">{c.folio}</span>
                    {c.vencido ? <Pildora tono="aviso">Vencido</Pildora> : null}
                  </span>
                  <span className="block truncate font-semibold text-fg">{c.cliente}</span>
                  <span className="block truncate text-xs text-fg-subtle">{c.titulo}</span>
                </span>
                <span className="text-right">
                  <span className="num block font-semibold text-fg">{dinero(c.saldo)}</span>
                  <span className="block text-xs text-fg-subtle">de saldo</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function aCobro(c: { pedido_id: string; folio: string; titulo: string; cliente: string; whatsapp: string | null; total: number; pagado: number; saldo: number; estado: string }): PedidoCobro {
  return { id: c.pedido_id, folio: c.folio, titulo: c.titulo, cliente: c.cliente, whatsapp: c.whatsapp, total: c.total, pagado: c.pagado, saldo: c.saldo, anticipoPct: null, cancelado: c.estado === 'cancelado' }
}

function Captura({
  pedido,
  anticipoDefault,
  onCambiarPedido,
  onCerrar,
  onRegistrado,
}: {
  pedido: PedidoCobro
  anticipoDefault: number
  onCambiarPedido?: () => void
  onCerrar: () => void
  onRegistrado?: (pago: Pago) => void
}) {
  const { puede } = useSesion()
  const config = useConfiguracion()
  const registrar = useRegistrarPago()
  const mensaje = useMensajePago()
  const reducir = useReducedMotion()
  const devolver = puede('cancelar_pagos')
  const liquidado = pedido.saldo <= 0

  const metodos = useMemo(() => {
    const activos = config.data?.metodos_pago_activos
    return activos && activos.length > 0 ? TODOS_METODOS.filter((m) => activos.includes(m)) : TODOS_METODOS
  }, [config.data])

  const [textoImporte, setTextoImporte] = useState('')
  const [tipoManual, setTipoManual] = useState<TipoPago | null>(pedido.cancelado || liquidado ? (devolver ? 'devolucion' : null) : null)
  const [metodo, setMetodo] = useState<MetodoPago | null>(null)
  const [fechaPago, setFechaPago] = useState(hoyISO())
  const [referencia, setReferencia] = useState('')
  const [notas, setNotas] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [intento, setIntento] = useState(false)
  const archivoRef = useRef<HTMLInputElement>(null)
  const camaraRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!metodo && metodos.length > 0) setMetodo(metodos.includes('transferencia') ? 'transferencia' : metodos[0])
  }, [metodos, metodo])

  const importe = leerImporte(textoImporte)
  const sugerido = tipoSugerido(pedido, importe ?? 0)
  const tipo: TipoPago = tipoManual ?? sugerido
  const errorImporte = validarImporte(importe, tipo, pedido)
  const errorFecha = !fechaPago ? 'Indica la fecha del pago' : fechaPago > hoyISO() ? 'La fecha no puede ser futura' : null
  const errorMetodo = metodo ? null : 'Elige el método de pago'
  const valido = !errorImporte && !errorFecha && !errorMetodo
  const anticipoPct = pedido.anticipoPct ?? anticipoDefault
  const montoAnticipo = redondear((pedido.total * anticipoPct) / 100)
  const nuevoSaldo = importe && !errorImporte ? redondear(tipo === 'devolucion' ? pedido.saldo + importe : pedido.saldo - importe) : null
  const avance = pedido.total > 0 ? Math.min(1, Math.max(0, pedido.pagado / pedido.total)) : 0

  const tipos = TIPOS.filter((t) => (t === 'devolucion' ? devolver : !pedido.cancelado))

  const elegirArchivo = (f: File | undefined) => {
    if (!f) return
    if (!/^image\//.test(f.type) && f.type !== 'application/pdf') {
      toast.error('El comprobante debe ser una imagen o un PDF')
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error('El comprobante pesa más de 10 MB. Toma una foto más ligera o comprime el PDF.')
      return
    }
    setArchivo(f)
  }

  const guardar = async (e: FormEvent) => {
    e.preventDefault()
    setIntento(true)
    if (!valido || importe === null || !metodo) return
    try {
      const { pago, errorComprobante } = await registrar.mutateAsync({
        datos: { pedido_id: pedido.id, importe, tipo, metodo, fecha: fechaPago, referencia: referencia.trim() || null, notas: notas.trim() || null },
        comprobante: archivo,
      })
      const saldo = Math.max(0, nuevoSaldo ?? pedido.saldo)
      const titulo = tipo === 'devolucion' ? `Devolución de ${dinero(importe)} registrada` : `${TIPOS_PAGO[tipo]} de ${dinero(importe)} registrado`
      toast.success(`${titulo} · ${pedido.folio}`, {
        description: saldo > 0 ? `Saldo pendiente: ${dinero(saldo)}` : 'El pedido quedó liquidado',
        duration: 9000,
        action:
          tipo === 'devolucion'
            ? undefined
            : {
                label: 'Enviar recibo',
                onClick: () =>
                  mensaje(tipo === 'anticipo' ? 'anticipo_recibido' : 'pago_recibido', {
                    cliente: pedido.cliente,
                    whatsapp: pedido.whatsapp,
                    folio: pedido.folio,
                    monto: importe,
                    saldo,
                    total: pedido.total,
                  }),
              },
      })
      if (errorComprobante) toast.error(`El pago se guardó, pero el comprobante no se subió: ${errorComprobante}. Adjúntalo desde la lista de cobros.`)
      onCerrar()
      onRegistrado?.(pago)
    } catch (err) {
      toast.error(`No se registró el pago: ${(err as Error).message}`)
    }
  }

  const etiquetaGuardar = tipo === 'devolucion' ? 'Registrar devolución' : tipo === 'anticipo' ? 'Registrar anticipo' : tipo === 'liquidacion' ? 'Registrar liquidación' : 'Registrar abono'

  return (
    <form onSubmit={guardar} noValidate className="flex flex-col gap-5">
      {/* Pedido: total, pagado y saldo */}
      <GlassSurface variante="fuerte" className="rounded-tile p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="num text-sm font-semibold text-fg-muted">{pedido.folio}</p>
            <p className="truncate text-md font-semibold text-fg">{pedido.cliente}</p>
            <p className="truncate text-xs text-fg-subtle">{pedido.titulo}</p>
          </div>
          {onCambiarPedido ? (
            <GlassButton variante="fantasma" tamano="sm" onClick={onCambiarPedido} className="-mr-1 pointer-coarse:h-11">
              Cambiar pedido
            </GlassButton>
          ) : null}
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-[var(--divider)] pt-3">
          <div>
            <dt className="text-xs text-fg-muted">Total</dt>
            <dd className="num font-semibold text-fg">{dinero(pedido.total)}</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-muted">Pagado</dt>
            <dd className="num font-semibold text-fg">{dinero(pedido.pagado)}</dd>
          </div>
          <div className="text-right">
            <dt className="text-xs text-fg-muted">Saldo</dt>
            <dd className={cn('num text-lg font-semibold leading-tight', liquidado ? 'text-success' : 'text-fg')} data-prueba="saldo-pedido">
              {dinero(pedido.saldo)}
            </dd>
          </div>
        </dl>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-fg/[0.08]" aria-hidden>
          <motion.div
            className="h-full origin-left rounded-full bg-accent dark:bg-navy-300"
            initial={reducir ? false : { scaleX: 0 }}
            animate={{ scaleX: avance }}
            transition={resorte.expansion}
          />
        </div>
        {pedido.cancelado ? <p className="mt-2 text-xs font-medium text-warning">Pedido cancelado: solo se registran devoluciones.</p> : null}
      </GlassSurface>

      {tipos.length === 0 ? (
        <p className="text-sm text-fg-muted">Este pedido no admite cobros y tu rol no incluye devoluciones.</p>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fg-muted">
              Tipo de pago
            </span>
            <SegmentedControl
              etiqueta="Tipo de pago"
              tamano="sm"
              segmentos={tipos.map((t) => ({ valor: t, etiqueta: TIPOS_PAGO[t] }))}
              valor={tipos.includes(tipo) ? tipo : tipos[0]}
              onCambio={(v) => setTipoManual(v)}
              className="self-start"
            />
            <p className="text-xs text-fg-subtle">
              {tipoManual && tipoManual !== sugerido && tipoManual !== 'devolucion' ? (
                <>
                  Sugerido: {TIPOS_PAGO[sugerido].toLowerCase()}.{' '}
                  <button type="button" className="font-semibold text-accent underline-offset-2 hover:underline dark:text-navy-300" onClick={() => setTipoManual(null)}>
                    Usar sugerido
                  </button>
                </>
              ) : tipo === 'devolucion' ? (
                'La devolución resta de lo pagado y aumenta el saldo.'
              ) : (
                'Se elige solo según el importe; puedes cambiarlo.'
              )}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Campo
              etiqueta={tipo === 'devolucion' ? 'Importe a devolver' : 'Importe recibido'}
              error={intento ? errorImporte : null}
              ayuda={nuevoSaldo !== null ? `Saldo después de este pago: ${dinero(Math.max(0, nuevoSaldo))}` : undefined}
            >
              {(id, a11y) => (
                <GlassInput
                  id={id}
                  {...a11y}
                  inputMode="decimal"
                  autoComplete="off"
                  value={textoImporte}
                  onChange={(e) => setTextoImporte(e.target.value)}
                  placeholder="0.00"
                  icono={<span className="text-base font-semibold">$</span>}
                  sufijo="MXN"
                  className="num text-lg font-semibold"
                />
              )}
            </Campo>
            {tipo !== 'devolucion' && pedido.saldo > 0 ? (
              <div className="flex flex-wrap gap-2">
                <GlassButton tamano="sm" variante="cristal" className="pointer-coarse:h-11" onClick={() => setTextoImporte(pedido.saldo.toFixed(2))}>
                  Todo el saldo · <span className="num">{dinero(pedido.saldo)}</span>
                </GlassButton>
                {pedido.pagado <= 0 && montoAnticipo > 0 && montoAnticipo < pedido.saldo ? (
                  <GlassButton tamano="sm" variante="cristal" className="pointer-coarse:h-11" onClick={() => setTextoImporte(montoAnticipo.toFixed(2))}>
                    Anticipo {anticipoPct} % · <span className="num">{dinero(montoAnticipo)}</span>
                  </GlassButton>
                ) : null}
              </div>
            ) : null}
          </div>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-sm font-medium text-fg-muted">Método</legend>
            <div role="radiogroup" aria-label="Método de pago" className="flex flex-wrap gap-2">
              {metodos.map((m) => {
                const Icono = ICONO_METODO[m]
                const activo = metodo === m
                return (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={activo}
                    onClick={() => setMetodo(m)}
                    className={cn(
                      'glass glass-thick glass-interactive inline-flex h-11 items-center gap-2 rounded-full pl-2 pr-4 text-sm font-semibold outline-none',
                      activo ? 'glass-on-accent' : 'text-fg',
                    )}
                  >
                    <span className={cn('grid size-7 place-items-center rounded-full', activo ? 'bg-white/20' : 'bg-[var(--control-bg)]')} aria-hidden>
                      <Icono className="size-4" />
                    </span>
                    {METODOS_PAGO[m]}
                  </button>
                )
              })}
            </div>
            {intento && errorMetodo ? <p className="text-xs font-medium text-danger">{errorMetodo}</p> : null}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Fecha" error={intento ? errorFecha : null}>
              {(id, a11y) => <GlassInput id={id} {...a11y} type="date" value={fechaPago} max={hoyISO()} onChange={(e) => setFechaPago(e.target.value)} />}
            </Campo>
            <Campo etiqueta="Referencia" opcional ayuda={metodo === 'efectivo' ? undefined : 'Folio SPEI, número de autorización…'}>
              {(id, a11y) => <GlassInput id={id} {...a11y} value={referencia} maxLength={120} onChange={(e) => setReferencia(e.target.value)} autoComplete="off" />}
            </Campo>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="flex items-baseline justify-between text-sm font-medium text-fg-muted">
              Comprobante <span className="text-xs font-normal text-fg-subtle">Opcional · imagen o PDF</span>
            </span>
            <input ref={archivoRef} type="file" accept="image/*,application/pdf" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => elegirArchivo(e.target.files?.[0])} data-prueba="comprobante" />
            <input ref={camaraRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => elegirArchivo(e.target.files?.[0])} />
            {archivo ? (
              <div className="flex min-h-12 items-center gap-3 rounded-control bg-[var(--field-bg)] py-1 pl-3.5 pr-1">
                <FileCheck2 className="size-5 shrink-0 text-success" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{archivo.name}</span>
                <GlassButton variante="fantasma" tamano="icono" icono={<X />} aria-label="Quitar comprobante" onClick={() => setArchivo(null)} />
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <GlassButton variante="cristal" icono={<Paperclip />} onClick={() => archivoRef.current?.click()}>
                  Adjuntar archivo
                </GlassButton>
                <GlassButton variante="cristal" icono={<Camera />} onClick={() => camaraRef.current?.click()} className="hidden pointer-coarse:inline-flex">
                  Tomar foto
                </GlassButton>
              </div>
            )}
          </div>

          <Campo etiqueta="Notas" opcional>
            {(id, a11y) => <GlassTextarea id={id} {...a11y} rows={2} value={notas} maxLength={1000} onChange={(e) => setNotas(e.target.value)} />}
          </Campo>
        </>
      )}

      <div className="sticky -bottom-6 z-10 -mx-6 -mb-6 mt-1 flex flex-wrap items-center justify-end gap-2 border-t border-[var(--divider)] bg-[var(--glass-bg-strong)] px-6 py-4 backdrop-blur-xl">
        <GlassButton variante="fantasma" onClick={onCerrar}>
          Cancelar
        </GlassButton>
        <GlassButton type="submit" variante={tipo === 'devolucion' ? 'peligro' : 'primario'} cargando={registrar.isPending} disabled={tipos.length === 0}>
          {etiquetaGuardar}
        </GlassButton>
      </div>
    </form>
  )
}

export default RegistrarPagoModal
