import { Ban, FileSearch, Paperclip, Plus, ReceiptText, RotateCcw, Save, Wallet } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useSesion } from '@/app/sesion'
import { AnimatedNumber, Campo, EstadoVacio, GlassButton, GlassInput, GlassModal, GlassPanel, GlassSelect, GlassSurface, GlassTextarea, SegmentedControl } from '@/components/glass'
import { AccionFila, Capsula, CapsulasCargando, FilaCapsulas, Metodo, TablaCargando } from '@/features/pagos/piezas'
import { dineroAsentado, fechaCorta, rangoPeriodo, textoRango, type Periodo } from '@/features/pagos/util'
import { CATEGORIAS_GASTO, type CategoriaGasto, type Gasto } from '@/data/modulos/inventario/contrato'
import { METODOS_PAGO } from '@/data/modulos/pagos/contrato'
import type { MetodoPago } from '@/data/tipos'
import { useEsEscritorio } from '@/hooks/useMediaQuery'
import { dinero, hoyISO } from '@/lib/format'
import { resorte } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { useCancelarGasto, useGastos, useProveedores, useRegistrarGasto } from '../consultas'
import { abrirComprobanteGasto, SelectorPedido, SinAcceso, type PedidoLigado } from '../piezas'
import { desgloseGastos, leerNumero } from '../util'

/** Tope de gastos por consulta; si se alcanza, el total del periodo podría quedar corto y se avisa. */
const LIMITE_GASTOS = 1000

const PERIODOS: { valor: Periodo; etiqueta: string }[] = [
  { valor: 'hoy', etiqueta: 'Hoy' },
  { valor: 'semana', etiqueta: 'Semana' },
  { valor: 'mes', etiqueta: 'Mes' },
  { valor: 'rango', etiqueta: 'Rango' },
]

export default function GastosVista() {
  const { puede } = useSesion()
  if (!puede('registrar_gastos') && !puede('ver_costos'))
    return <SinAcceso titulo="Los gastos son para administración" descripcion="Tu rol no incluye gastos ni costos. Puedes consultar materiales y registrar consumos." />
  return <Gastos />
}

function Gastos() {
  const { puede } = useSesion()
  const registrar = puede('registrar_gastos')
  const escritorio = useEsEscritorio()
  const hoy = useMemo(() => hoyISO(), [])
  const [params, setParams] = useSearchParams()
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [rango, setRango] = useState({ desde: `${hoy.slice(0, 8)}01`, hasta: hoy })
  const [categoria, setCategoria] = useState<CategoriaGasto | ''>('')
  const { desde, hasta } = rangoPeriodo(periodo, hoy, rango)
  const consulta = useGastos({ desde, hasta, limite: LIMITE_GASTOS })
  const [nuevo, setNuevo] = useState(false)
  const [cancelando, setCancelando] = useState<Gasto | null>(null)

  useEffect(() => {
    if (params.get('registrar') === '1' && registrar) {
      setNuevo(true)
      setParams((p) => {
        const n = new URLSearchParams(p)
        n.delete('registrar')
        return n
      }, { replace: true })
    }
  }, [params, setParams, registrar])

  const todos = consulta.data ?? []
  const d = desgloseGastos(todos)
  const visibles = categoria ? todos.filter((g) => g.categoria === categoria) : todos
  const periodoTexto = textoRango(desde, hasta, hoy)
  const descripcion = `Gastos de ${periodoTexto}${categoria ? `, ${CATEGORIAS_GASTO[categoria].toLowerCase()}` : ''}`

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2.5">
        <SegmentedControl etiqueta="Periodo" segmentos={PERIODOS} valor={periodo} onCambio={setPeriodo} className="w-full shrink-0 sm:w-auto" />
        {periodo === 'rango' ? (
          <div className="flex items-center gap-2">
            <GlassInput type="date" aria-label="Desde" value={rango.desde} max={rango.hasta || hoy} onChange={(e) => setRango((r) => ({ ...r, desde: e.target.value }))} className="h-11 w-[10.5rem] rounded-full" />
            <span className="text-fg-subtle" aria-hidden>
              –
            </span>
            <GlassInput type="date" aria-label="Hasta" value={rango.hasta} min={rango.desde || undefined} max={hoy} onChange={(e) => setRango((r) => ({ ...r, hasta: e.target.value }))} className="h-11 w-[10.5rem] rounded-full" />
          </div>
        ) : null}
        {registrar ? (
          <GlassButton variante="primario" icono={<Plus />} onClick={() => setNuevo(true)} className="max-sm:w-full sm:ml-auto">
            Registrar gasto
          </GlassButton>
        ) : null}
      </div>

      {consulta.isPending ? (
        <CapsulasCargando n={2} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <FilaCapsulas etiqueta={`Total: ${descripcion}`}>
            <Capsula
              className="pr-8 lg:w-full"
              tono={d.total > 0 ? 'luz' : undefined}
              pozo={<Wallet />}
              titulo={<AnimatedNumber valor={d.total} formato={dineroAsentado(d.total)} className="num text-md" />}
              subtitulo={`Gastado ${periodo === 'hoy' ? 'hoy' : `del ${periodoTexto}`} · ${d.cuantos} ${d.cuantos === 1 ? 'gasto' : 'gastos'}`}
            />
          </FilaCapsulas>
          <Desglose d={d} categoria={categoria} onCategoria={setCategoria} />
        </div>
      )}

      {todos.length >= LIMITE_GASTOS ? (
        <p role="status" className="text-sm text-fg-muted">
          Se muestran los {LIMITE_GASTOS.toLocaleString('es-MX')} gastos más recientes del periodo; el total puede quedar corto. Elige un rango más corto para verlos todos.
        </p>
      ) : null}

      {consulta.isPending ? (
        <TablaCargando />
      ) : consulta.isError ? (
        <GlassPanel>
          <EstadoVacio
            icono={<FileSearch />}
            titulo="No se pudieron cargar los gastos"
            descripcion={`${consulta.error.message}. Revisa tu conexión e inténtalo de nuevo.`}
            accion={
              <GlassButton icono={<RotateCcw />} onClick={() => void consulta.refetch()}>
                Reintentar
              </GlassButton>
            }
          />
        </GlassPanel>
      ) : visibles.length === 0 ? (
        <GlassPanel>
          <EstadoVacio
            icono={<ReceiptText />}
            titulo={categoria ? `Sin gastos de ${CATEGORIAS_GASTO[categoria].toLowerCase()} en este periodo` : 'Sin gastos en este periodo'}
            descripcion="Registra compras, maquila, renta y servicios para conocer la utilidad real."
            accion={
              registrar ? (
                <GlassButton variante="primario" icono={<Plus />} onClick={() => setNuevo(true)}>
                  Registrar gasto
                </GlassButton>
              ) : null
            }
          />
        </GlassPanel>
      ) : escritorio ? (
        <GlassPanel className="p-2">
          <table className="tabla">
            <caption className="sr-only">{descripcion}</caption>
            <thead>
              <tr>
                <th scope="col" className="pl-5">Fecha</th>
                <th scope="col">Concepto</th>
                <th scope="col">Categoría</th>
                <th scope="col">Método</th>
                <th scope="col" className="text-right">Monto</th>
                <th scope="col" className="w-[6.5rem]">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((g) => (
                <tr key={g.id}>
                  <td className="whitespace-nowrap pl-5 text-fg-muted">{fechaCorta(g.fecha, hoy)}</td>
                  <td className="w-full max-w-0">
                    <span className="block truncate font-semibold text-fg" title={g.concepto}>
                      {g.concepto}
                    </span>
                    <Sub g={g} />
                  </td>
                  <td className="whitespace-nowrap text-fg-muted">{CATEGORIAS_GASTO[g.categoria]}</td>
                  <td className="max-w-[11rem]">
                    <Metodo metodo={g.metodo_pago} referencia={g.referencia} />
                  </td>
                  <td className="num whitespace-nowrap text-right text-base font-semibold text-fg">{dinero(g.monto)}</td>
                  <td className="py-2 pr-3">
                    <Acciones g={g} onCancelar={registrar ? setCancelando : undefined} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassPanel>
      ) : (
        <ul aria-label={descripcion} className="grid grid-cols-[minmax(0,1fr)] gap-2.5 md:grid-cols-2">
          {visibles.map((g) => (
            <li key={g.id}>
              <GlassSurface variante="fuerte" className="rounded-tile p-4">
                <div className="flex min-h-8 items-center gap-2 text-sm">
                  <span className="font-medium text-fg-muted">{CATEGORIAS_GASTO[g.categoria]}</span>
                  <span className="ml-auto text-fg-subtle">{fechaCorta(g.fecha, hoy)}</span>
                </div>
                <p className="truncate text-md font-semibold text-fg">{g.concepto}</p>
                <Sub g={g} />
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--divider)] pt-2 text-sm">
                  <Metodo metodo={g.metodo_pago} referencia={g.referencia} className="min-w-0 flex-1" />
                  <span className="num text-lg font-semibold tracking-tight text-fg">{dinero(g.monto)}</span>
                </div>
                <div className="-mb-2 -mr-2 mt-1 flex justify-end">
                  <Acciones g={g} onCancelar={registrar ? setCancelando : undefined} />
                </div>
              </GlassSurface>
            </li>
          ))}
        </ul>
      )}

      {registrar ? <GastoModal abierto={nuevo} onCerrar={() => setNuevo(false)} /> : null}
      <CancelarGastoModal gasto={cancelando} onCerrar={() => setCancelando(null)} />
    </div>
  )
}

function Sub({ g }: { g: Gasto }) {
  return (
    <span className="flex min-w-0 items-baseline gap-1.5 text-xs text-fg-muted">
      {g.folio_pedido && g.pedido_id ? (
        <Link to={`/pedidos/${g.pedido_id}`} className="num shrink-0 rounded-full font-semibold text-fg outline-none hover:underline pointer-coarse:-my-3 pointer-coarse:py-3">
          {g.folio_pedido}
        </Link>
      ) : null}
      <span className="truncate">{[g.proveedor, g.usuario ? `registró ${g.usuario}` : null].filter(Boolean).join(' · ')}</span>
    </span>
  )
}

function Acciones({ g, onCancelar }: { g: Gasto; onCancelar?: (g: Gasto) => void }) {
  return (
    <div className="flex items-center justify-end">
      {g.comprobante_path ? <AccionFila etiqueta={`Ver comprobante de ${g.concepto}`} icono={<Paperclip />} onClick={() => void abrirComprobanteGasto(g.id)} /> : null}
      {onCancelar ? <AccionFila etiqueta={`Cancelar gasto ${g.concepto}`} icono={<Ban />} onClick={() => onCancelar(g)} className="hover:text-danger" /> : null}
    </div>
  )
}

/** Desglose por categoría con mini barras (una sola tinta; la categoría elegida se enciende). */
function Desglose({ d, categoria, onCategoria }: { d: ReturnType<typeof desgloseGastos>; categoria: CategoriaGasto | ''; onCategoria: (c: CategoriaGasto | '') => void }) {
  const reducir = useReducedMotion()
  const max = d.categorias[0]?.monto ?? 0
  if (!d.categorias.length) return null
  return (
    <GlassPanel className="rounded-module p-4">
      <h2 className="mb-2 text-sm font-semibold text-fg">Por categoría</h2>
      <ul className="grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
        {d.categorias.map((c) => {
          const activa = categoria === c.categoria
          return (
            <li key={c.categoria}>
              <button
                type="button"
                aria-pressed={activa}
                onClick={() => onCategoria(activa ? '' : c.categoria)}
                title={`${c.cuantos} ${c.cuantos === 1 ? 'gasto' : 'gastos'} · ${d.total ? Math.round((c.monto / d.total) * 100) : 0}% del total`}
                className={cn('grid min-h-11 w-full grid-cols-[6.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-control px-2 text-left text-sm outline-none hover:bg-[var(--control-bg)] focus-visible:bg-[var(--control-bg)]', activa && 'bg-[var(--control-bg)]')}
              >
                <span className={cn('truncate', activa ? 'font-semibold text-fg' : 'text-fg-muted')}>{CATEGORIAS_GASTO[c.categoria]}</span>
                <span className="h-2 overflow-hidden rounded-full bg-[var(--control-bg)]" aria-hidden>
                  <motion.span
                    className={cn('block h-full w-full origin-left rounded-full', activa ? 'bg-luz' : 'bg-navy-500 dark:bg-navy-300')}
                    initial={reducir ? false : { scaleX: 0 }}
                    animate={{ scaleX: max ? c.monto / max : 0 }}
                    transition={resorte.expansion}
                  />
                </span>
                <span className="num whitespace-nowrap font-semibold text-fg">{dinero(c.monto)}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </GlassPanel>
  )
}

/** Registrar gasto: fecha, concepto, categoría, proveedor, pedido (maquila/utilidad real), monto, método, referencia y comprobante. */
export function GastoModal({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const hoy = useMemo(() => hoyISO(), [])
  const proveedores = useProveedores(abierto)
  const registrar = useRegistrarGasto()
  const archivoRef = useRef<HTMLInputElement>(null)
  const inicial = { fecha: hoy, concepto: '', categoria: 'material' as CategoriaGasto, proveedor_id: '', monto: '', metodo: 'transferencia' as MetodoPago, referencia: '', notas: '' }
  const [f, setF] = useState(inicial)
  const [pedido, setPedido] = useState<PedidoLigado | null>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [intento, setIntento] = useState(false)
  useEffect(() => {
    if (abierto) {
      setF({ ...inicial })
      setPedido(null)
      setArchivo(null)
      setIntento(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto])
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))
  const monto = leerNumero(f.monto)
  const errores = {
    concepto: !f.concepto.trim() ? 'Escribe en qué se gastó' : null,
    monto: monto === null ? 'Escribe el monto' : monto <= 0 ? 'El monto debe ser mayor a cero' : null,
    fecha: !f.fecha ? 'Elige la fecha' : f.fecha > hoy ? 'La fecha no puede ser futura' : null,
    archivo: archivo && archivo.size > 10 * 1024 * 1024 ? 'El comprobante pesa más de 10 MB; toma una foto más ligera' : null,
  }
  const enviar = async () => {
    setIntento(true)
    if (Object.values(errores).some(Boolean) || monto === null) return
    try {
      const r = await registrar.mutateAsync({
        datos: {
          fecha: f.fecha,
          concepto: f.concepto.trim(),
          categoria: f.categoria,
          monto,
          metodo_pago: f.metodo,
          proveedor_id: f.proveedor_id || null,
          pedido_id: pedido?.id ?? null,
          referencia: f.referencia.trim() || null,
          notas: f.notas.trim() || null,
        },
        comprobante: archivo,
      })
      toast.success(`Gasto de ${dinero(monto)} registrado`, { description: pedido ? `Ligado a ${pedido.folio}: cuenta en su utilidad real.` : f.concepto.trim() })
      if (r.errorComprobante) toast.warning(`El gasto quedó, pero el comprobante no se subió: ${r.errorComprobante}`)
      onCerrar()
    } catch (e) {
      toast.error(`No se registró el gasto: ${(e as Error).message}`)
    }
  }
  return (
    <GlassModal
      abierto={abierto}
      onCambio={(v) => (v ? null : onCerrar())}
      titulo="Registrar gasto"
      descripcion="Compras, maquila, renta y servicios. Liga la maquila a su pedido para ver la utilidad real."
      pie={
        <>
          <GlassButton variante="fantasma" onClick={onCerrar}>
            Cancelar
          </GlassButton>
          <GlassButton variante="primario" icono={<Save />} cargando={registrar.isPending} onClick={() => void enviar()}>
            Guardar gasto
          </GlassButton>
        </>
      }
    >
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault()
          void enviar()
        }}
      >
        <Campo etiqueta="Concepto" error={intento ? errores.concepto : null} className="sm:col-span-2">
          {(id, a) => <GlassInput id={id} {...a} autoFocus value={f.concepto} onChange={set('concepto')} placeholder="Ej. Maquila de corte láser" maxLength={300} />}
        </Campo>
        <Campo etiqueta="Monto" error={intento ? errores.monto : null} ayuda="Con IVA si lo hubo">
          {(id, a) => <GlassInput id={id} {...a} inputMode="decimal" value={f.monto} onChange={set('monto')} placeholder="0.00" sufijo="MXN" className="num text-md" />}
        </Campo>
        <Campo etiqueta="Categoría">
          {(id) => (
            <GlassSelect id={id} value={f.categoria} onChange={set('categoria')}>
              {(Object.keys(CATEGORIAS_GASTO) as CategoriaGasto[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORIAS_GASTO[c]}
                </option>
              ))}
            </GlassSelect>
          )}
        </Campo>
        <Campo etiqueta="Fecha" error={intento ? errores.fecha : null}>
          {(id, a) => <GlassInput id={id} {...a} type="date" max={hoy} value={f.fecha} onChange={set('fecha')} />}
        </Campo>
        <Campo etiqueta="Método de pago">
          {(id) => (
            <GlassSelect id={id} value={f.metodo} onChange={set('metodo')}>
              {(Object.keys(METODOS_PAGO) as MetodoPago[]).map((m) => (
                <option key={m} value={m}>
                  {METODOS_PAGO[m]}
                </option>
              ))}
            </GlassSelect>
          )}
        </Campo>
        <Campo etiqueta="Proveedor" opcional>
          {(id) => (
            <GlassSelect id={id} value={f.proveedor_id} onChange={set('proveedor_id')}>
              <option value="">Sin proveedor</option>
              {(proveedores.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </GlassSelect>
          )}
        </Campo>
        <Campo etiqueta="Referencia" opcional>
          {(id) => <GlassInput id={id} value={f.referencia} onChange={set('referencia')} placeholder="Factura, folio o transferencia" maxLength={200} />}
        </Campo>
        <Campo etiqueta="Pedido" opcional className="sm:col-span-2">
          {(id) => <SelectorPedido id={id} valor={pedido} onCambio={setPedido} ayuda={f.categoria === 'maquila' ? 'La maquila ligada a su pedido se descuenta de su utilidad real' : undefined} />}
        </Campo>
        <Campo etiqueta="Comprobante" opcional error={intento ? errores.archivo : null} className="sm:col-span-2">
          {(id) => (
            <div className="flex items-center gap-3">
              <input id={id} ref={archivoRef} type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
              <GlassButton variante="cristal" icono={<Paperclip />} onClick={() => archivoRef.current?.click()}>
                {archivo ? 'Cambiar archivo' : 'Adjuntar foto o PDF'}
              </GlassButton>
              {archivo ? <span className="min-w-0 truncate text-sm text-fg-muted">{archivo.name}</span> : null}
            </div>
          )}
        </Campo>
        <Campo etiqueta="Notas" opcional className="sm:col-span-2">
          {(id) => <GlassTextarea id={id} rows={2} value={f.notas} onChange={set('notas')} />}
        </Campo>
        <button type="submit" hidden />
      </form>
    </GlassModal>
  )
}

function CancelarGastoModal({ gasto, onCerrar }: { gasto: Gasto | null; onCerrar: () => void }) {
  const cancelar = useCancelarGasto()
  const [motivo, setMotivo] = useState('')
  const [intento, setIntento] = useState(false)
  const cerrar = () => {
    setMotivo('')
    setIntento(false)
    onCerrar()
  }
  const confirmar = async () => {
    setIntento(true)
    if (!gasto || !motivo.trim()) return
    try {
      await cancelar.mutateAsync({ id: gasto.id, motivo: motivo.trim() })
      toast.success(`Gasto de ${dinero(gasto.monto)} cancelado`)
      cerrar()
    } catch (e) {
      toast.error(`No se canceló: ${(e as Error).message}`)
    }
  }
  return (
    <GlassModal
      abierto={Boolean(gasto)}
      onCambio={(v) => (v ? null : cerrar())}
      titulo="Cancelar gasto"
      descripcion={gasto ? `${gasto.concepto} · ${dinero(gasto.monto)}. No se borra: queda registrado como cancelado.` : undefined}
      ancho="sm"
      pie={
        <>
          <GlassButton variante="fantasma" onClick={cerrar}>
            Conservar gasto
          </GlassButton>
          <GlassButton variante="peligro" icono={<Ban />} cargando={cancelar.isPending} onClick={() => void confirmar()}>
            Cancelar gasto
          </GlassButton>
        </>
      }
    >
      <Campo etiqueta="Motivo" error={intento && !motivo.trim() ? 'Escribe el motivo de la cancelación' : null}>
        {(id, a) => <GlassTextarea id={id} {...a} autoFocus rows={3} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. se capturó dos veces" />}
      </Campo>
    </GlassModal>
  )
}
