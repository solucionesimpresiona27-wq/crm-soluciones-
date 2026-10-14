import { Ban, FileImage, FileSearch, HandCoins, Paperclip, ReceiptText, RotateCcw, Undo2, Wallet } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useSesion } from '@/app/sesion'
import { AnimatedNumber, Campo, EstadoVacio, GlassButton, GlassInput, GlassModal, GlassPanel, GlassSelect, GlassSurface, GlassTextarea, SegmentedControl } from '@/components/glass'
import { METODOS_PAGO, TIPOS_PAGO, type Pago } from '@/data/modulos/pagos/contrato'
import type { MetodoPago } from '@/data/tipos'
import { useEsEscritorio } from '@/hooks/useMediaQuery'
import { dinero, hoyISO } from '@/lib/format'
import { resorte } from '@/lib/motion'
import { abrirComprobante, useCancelarPago, usePagos, useSubirComprobante } from '../consultas'
import { AccionFila, Capsula, CapsulasCargando, FilaCapsulas, Importe, Metodo, TablaCargando, TipoPildora } from '../piezas'
import { dineroAsentado, fechaCorta, rangoPeriodo, textoRango, totalesPagos, type Periodo } from '../util'

const PERIODOS: { valor: Periodo; etiqueta: string }[] = [
  { valor: 'hoy', etiqueta: 'Hoy' },
  { valor: 'semana', etiqueta: 'Semana' },
  { valor: 'mes', etiqueta: 'Mes' },
  { valor: 'rango', etiqueta: 'Rango' },
]

interface Acciones {
  comprobante: (p: Pago) => void
  adjuntar?: (p: Pago) => void
  cancelar?: (p: Pago) => void
  adjuntando: string | null
}

export default function CobrosVista() {
  const { puede } = useSesion()
  const escritorio = useEsEscritorio()
  const hoy = useMemo(() => hoyISO(), [])
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [rango, setRango] = useState({ desde: `${hoy.slice(0, 8)}01`, hasta: hoy })
  const [metodo, setMetodo] = useState<MetodoPago | ''>('')
  const { desde, hasta } = rangoPeriodo(periodo, hoy, rango)
  const consulta = usePagos({ desde, hasta })
  const subir = useSubirComprobante()
  const [cancelando, setCancelando] = useState<Pago | null>(null)
  const [limite, setLimite] = useState(50)
  const archivoRef = useRef<HTMLInputElement>(null)
  const adjuntarA = useRef<Pago | null>(null)

  const todos = consulta.data ?? []
  const visibles = metodo ? todos.filter((p) => p.metodo === metodo) : todos
  const t = totalesPagos(visibles)
  const periodoTexto = textoRango(desde, hasta, hoy)
  const descripcion = `Pagos de ${periodoTexto}${metodo ? `, ${METODOS_PAGO[metodo].toLowerCase()}` : ''}`

  const acciones: Acciones = {
    comprobante: (p) => void abrirComprobante(p.id),
    adjuntar: puede('registrar_pagos')
      ? (p) => {
          adjuntarA.current = p
          archivoRef.current?.click()
        }
      : undefined,
    cancelar: puede('cancelar_pagos') ? setCancelando : undefined,
    adjuntando: subir.isPending ? (subir.variables?.id ?? null) : null,
  }

  return (
    <div className="flex flex-col gap-4">
      {consulta.isPending ? (
        <CapsulasCargando />
      ) : (
        <FilaCapsulas etiqueta={`Totales: ${descripcion}`}>
          <Capsula
            className="pr-8"
            pozo={<Wallet />}
            titulo={<AnimatedNumber valor={t.neto} formato={dineroAsentado(t.neto)} className="num text-md" />}
            subtitulo={`Cobrado ${periodo === 'hoy' ? 'hoy' : `del ${periodoTexto}`}`}
          />
          <Capsula
            pozo={<ReceiptText />}
            titulo={
              <>
                <AnimatedNumber valor={t.pagos} className="num" /> {t.pagos === 1 ? 'pago' : 'pagos'}
              </>
            }
            subtitulo={t.porMetodo.efectivo ? `${dinero(t.porMetodo.efectivo)} en efectivo` : 'Sin efectivo'}
          />
          {t.devoluciones > 0 ? (
            <Capsula
              pozo={<Undo2 />}
              titulo={<AnimatedNumber valor={t.devoluciones} formato={(n) => `−${dineroAsentado(t.devoluciones)(n)}`} className="num text-danger" />}
              subtitulo="Devuelto a clientes"
            />
          ) : null}
        </FilaCapsulas>
      )}

      <div className="flex flex-wrap items-end gap-x-3 gap-y-2.5">
        <SegmentedControl etiqueta="Periodo" segmentos={PERIODOS} valor={periodo} onCambio={setPeriodo} className="w-full shrink-0 sm:w-auto" />
        {periodo === 'rango' ? (
          <div className="flex items-center gap-2">
            <GlassInput type="date" aria-label="Desde" value={rango.desde} max={hoy} onChange={(e) => setRango((r) => ({ ...r, desde: e.target.value }))} className="h-11 w-[10.5rem] rounded-full" />
            <span className="text-fg-subtle" aria-hidden>
              –
            </span>
            <GlassInput type="date" aria-label="Hasta" value={rango.hasta} max={hoy} onChange={(e) => setRango((r) => ({ ...r, hasta: e.target.value }))} className="h-11 w-[10.5rem] rounded-full" />
          </div>
        ) : null}
        <div className="w-full sm:ml-auto sm:w-56">
          <GlassSelect aria-label="Filtrar por método" value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPago | '')} className="rounded-full">
            <option value="">Todos los métodos</option>
            {(Object.keys(METODOS_PAGO) as MetodoPago[]).map((m) => (
              <option key={m} value={m}>
                {METODOS_PAGO[m]}
              </option>
            ))}
          </GlassSelect>
        </div>
      </div>

      <p role="status" className="sr-only">
        {consulta.data ? `${visibles.length} ${visibles.length === 1 ? 'pago' : 'pagos'}` : ''}
      </p>

      {consulta.isPending ? (
        <TablaCargando />
      ) : consulta.isError ? (
        <GlassPanel>
          <EstadoVacio
            icono={<FileSearch />}
            titulo="No se pudieron cargar los pagos"
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
            icono={<HandCoins />}
            titulo={metodo ? `Sin pagos en ${METODOS_PAGO[metodo].toLowerCase()} ${periodo === 'hoy' ? 'hoy' : 'en este periodo'}` : periodo === 'hoy' ? 'Todavía no hay cobros hoy' : 'Sin cobros en este periodo'}
            descripcion="Los anticipos, abonos y liquidaciones aparecen aquí en cuanto se registran."
            accion={
              periodo !== 'mes' || metodo ? (
                <GlassButton
                  variante="cristal"
                  icono={<RotateCcw />}
                  onClick={() => {
                    setPeriodo('mes')
                    setMetodo('')
                  }}
                >
                  Ver el mes completo
                </GlassButton>
              ) : null
            }
          />
        </GlassPanel>
      ) : escritorio ? (
        <GlassPanel className="p-2">
          <TablaPagos pagos={visibles.slice(0, limite)} hoy={hoy} acciones={acciones} descripcion={descripcion} />
        </GlassPanel>
      ) : (
        <TarjetasPagos pagos={visibles.slice(0, limite)} hoy={hoy} acciones={acciones} descripcion={descripcion} />
      )}

      {visibles.length > limite ? (
        <div className="flex justify-center">
          <GlassButton variante="cristal" onClick={() => setLimite((l) => l + 50)}>
            Mostrar {Math.min(50, visibles.length - limite)} más
          </GlassButton>
        </div>
      ) : null}

      <input
        ref={archivoRef}
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f && adjuntarA.current) subir.mutate({ id: adjuntarA.current.id, archivo: f })
        }}
      />
      <CancelarPagoModal pago={cancelando} onCerrar={() => setCancelando(null)} />
    </div>
  )
}

function Acciones({ p, acciones, compacto }: { p: Pago; acciones: Acciones; compacto?: boolean }) {
  return (
    <div className="flex items-center justify-end gap-0.5">
      {p.comprobante_path ? (
        <AccionFila etiqueta={`Ver comprobante de ${p.folio}`} icono={<FileImage />} onClick={() => acciones.comprobante(p)} />
      ) : acciones.adjuntar ? (
        <AccionFila etiqueta={`Adjuntar comprobante a ${p.folio}`} icono={<Paperclip />} cargando={acciones.adjuntando === p.id} onClick={() => acciones.adjuntar?.(p)} />
      ) : compacto ? null : (
        <span className="size-11" aria-hidden />
      )}
      {acciones.cancelar ? (
        <AccionFila etiqueta={`Cancelar ${TIPOS_PAGO[p.tipo].toLowerCase()} de ${p.folio}`} icono={<Ban />} onClick={() => acciones.cancelar?.(p)} className="hover:text-danger" />
      ) : null}
    </div>
  )
}

function TablaPagos({ pagos, hoy, acciones, descripcion }: { pagos: Pago[]; hoy: string; acciones: Acciones; descripcion: string }) {
  return (
    <table className="tabla">
      <caption className="sr-only">{descripcion}</caption>
      <thead>
        <tr>
          <th scope="col" className="pl-5">Fecha</th>
          <th scope="col">Pedido</th>
          <th scope="col">Tipo</th>
          <th scope="col">Método</th>
          <th scope="col" className="hidden xl:table-cell">Registró</th>
          <th scope="col" className="text-right">Importe</th>
          <th scope="col" className="w-[6.5rem]">
            <span className="sr-only">Acciones</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <AnimatePresence initial={false}>
          {pagos.map((p) => (
            <motion.tr
              key={p.id}
              layout="position"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ layout: resorte.agil, opacity: { duration: 0.18 } }}
            >
              <td className="whitespace-nowrap pl-5 text-fg-muted">{fechaCorta(p.fecha, hoy)}</td>
              <td className="w-full max-w-0">
                <span className="flex min-w-0 items-baseline gap-2">
                  <Link to={`/pedidos/${p.pedido_id}`} className="num -mx-1 shrink-0 rounded-full px-1 font-semibold text-fg outline-none hover:underline">
                    {p.folio}
                  </Link>
                  <span className="truncate font-semibold text-fg" title={p.cliente ?? undefined}>
                    {p.cliente ?? 'Sin cliente'}
                  </span>
                </span>
                <span className="block truncate text-xs text-fg-muted" title={p.notas ?? p.pedido_titulo}>
                  {p.notas ?? p.pedido_titulo}
                </span>
              </td>
              <td>
                <TipoPildora tipo={p.tipo} />
              </td>
              <td className="max-w-[12rem]">
                <Metodo metodo={p.metodo} referencia={p.referencia} />
              </td>
              <td className="hidden whitespace-nowrap text-fg-muted xl:table-cell">{p.registrado_por_nombre ?? '—'}</td>
              <td className="text-right text-base">
                <Importe importe={p.importe} tipo={p.tipo} />
              </td>
              <td className="py-2 pr-3">
                <Acciones p={p} acciones={acciones} />
              </td>
            </motion.tr>
          ))}
        </AnimatePresence>
      </tbody>
    </table>
  )
}

function TarjetasPagos({ pagos, hoy, acciones, descripcion }: { pagos: Pago[]; hoy: string; acciones: Acciones; descripcion: string }) {
  return (
    <ul aria-label={descripcion} className="grid gap-2.5 md:grid-cols-2">
      {pagos.map((p) => (
        <li key={p.id}>
          <GlassSurface variante="fuerte" className="rounded-tile p-4">
            <div className="flex min-h-11 items-center gap-2">
              <Link to={`/pedidos/${p.pedido_id}`} className="num text-sm font-semibold text-fg-muted outline-none">
                {p.folio}
              </Link>
              <TipoPildora tipo={p.tipo} />
              <span className="ml-auto text-sm text-fg-subtle">{fechaCorta(p.fecha, hoy)}</span>
            </div>
            <p className="truncate text-md font-semibold text-fg">{p.cliente ?? 'Sin cliente'}</p>
            <p className="truncate text-xs text-fg-muted">Registró {p.registrado_por_nombre ?? '—'}</p>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--divider)] pt-2 text-sm">
              <Metodo metodo={p.metodo} referencia={p.referencia} className="min-w-0 flex-1" />
              <Importe importe={p.importe} tipo={p.tipo} className="text-lg tracking-tight" />
            </div>
            {acciones.cancelar || p.comprobante_path || acciones.adjuntar ? (
              <div className="-mb-2 -mr-2 mt-1 flex justify-end">
                <Acciones p={p} acciones={acciones} compacto />
              </div>
            ) : null}
          </GlassSurface>
        </li>
      ))}
    </ul>
  )
}

/** Cancela un pago con motivo (no se borra; el saldo del pedido se recalcula). */
export function CancelarPagoModal({ pago, onCerrar }: { pago: Pago | null; onCerrar: () => void }) {
  const cancelar = useCancelarPago()
  const [motivo, setMotivo] = useState('')
  const [intento, setIntento] = useState(false)
  const error = intento && !motivo.trim() ? 'Escribe el motivo; queda en la bitácora del pedido' : null
  const cerrar = () => {
    setMotivo('')
    setIntento(false)
    onCerrar()
  }
  const confirmar = async () => {
    setIntento(true)
    if (!pago || !motivo.trim()) return
    try {
      await cancelar.mutateAsync({ id: pago.id, motivo: motivo.trim() })
      toast.success(`${TIPOS_PAGO[pago.tipo]} de ${dinero(pago.importe)} cancelado`, { description: `El saldo de ${pago.folio} se actualizó.` })
      cerrar()
    } catch (e) {
      toast.error(`No se canceló: ${(e as Error).message}`)
    }
  }
  return (
    <GlassModal
      abierto={Boolean(pago)}
      onCambio={(v) => (v ? null : cerrar())}
      titulo={pago ? `Cancelar ${TIPOS_PAGO[pago.tipo].toLowerCase()} de ${pago.folio}` : 'Cancelar pago'}
      descripcion={pago ? `${dinero(pago.importe)} · ${METODOS_PAGO[pago.metodo]}${pago.cliente ? ` · ${pago.cliente}` : ''}. No se borra: queda registrado como cancelado.` : undefined}
      ancho="sm"
      pie={
        <>
          <GlassButton variante="fantasma" onClick={cerrar}>
            Conservar pago
          </GlassButton>
          <GlassButton variante="peligro" icono={<Ban />} cargando={cancelar.isPending} onClick={() => void confirmar()}>
            Cancelar pago
          </GlassButton>
        </>
      }
    >
      <Campo etiqueta="Motivo" error={error}>
        {(id, a11y) => <GlassTextarea id={id} {...a11y} autoFocus rows={3} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. se capturó dos veces" />}
      </Campo>
    </GlassModal>
  )
}
