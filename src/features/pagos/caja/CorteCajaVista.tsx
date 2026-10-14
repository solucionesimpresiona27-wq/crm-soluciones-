import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarDays, FileSearch, History, Lock, LockOpen, Printer, RotateCcw, Users } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useSesion } from '@/app/sesion'
import { Campo, EncabezadoPanel, EstadoVacio, GlassButton, GlassInput, GlassModal, GlassPanel, GlassTextarea, Pildora, Skeleton } from '@/components/glass'
import { METODOS_PAGO, type ResumenCaja, type TipoPago } from '@/data/modulos/pagos/contrato'
import { dinero, fechaLarga, hoyISO } from '@/lib/format'
import { cn, redondear } from '@/lib/utils'
import { useCerrarCaja, useCortes, useReabrirCaja, useResumenCaja } from '../consultas'
import { ICONO_METODO, Importe, TipoPildora } from '../piezas'
import { fechaCorta, leerImporte } from '../util'
import { Balanza } from './Balanza'

const hora = (iso: string) => format(parseISO(iso), 'HH:mm')
const diaCorto = (f: string) => {
  const t = format(parseISO(`${f}T12:00:00`), 'EEE d MMM', { locale: es })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export default function CorteCajaVista() {
  const hoy = useMemo(() => hoyISO(), [])
  const [params, setParams] = useSearchParams()
  const fechaParam = params.get('fecha')
  const fecha = fechaParam && /^\d{4}-\d{2}-\d{2}$/.test(fechaParam) && fechaParam <= hoy ? fechaParam : hoy
  const consulta = useResumenCaja(fecha)
  const cambiarFecha = (f: string) =>
    setParams(
      (prev) => {
        const n = new URLSearchParams(prev)
        if (!f || f === hoy) n.delete('fecha')
        else n.set('fecha', f)
        return n
      },
      { replace: true },
    )

  const r = consulta.data && consulta.data.fecha === fecha ? consulta.data : undefined

  return (
    <div className="flex flex-col gap-4">
      <div className="no-print flex flex-wrap items-center gap-2.5">
        <div className="w-[11.5rem]">
          <GlassInput type="date" aria-label="Fecha del corte" value={fecha} max={hoy} onChange={(e) => cambiarFecha(e.target.value)} icono={<CalendarDays />} className="h-11 rounded-full" />
        </div>
        {fecha !== hoy ? (
          <GlassButton variante="cristal" onClick={() => cambiarFecha(hoy)}>
            Hoy
          </GlassButton>
        ) : null}
        {r ? (
          r.cerrado ? (
            <Pildora tono="neutro">
              <Lock className="size-3" aria-hidden /> Caja cerrada
            </Pildora>
          ) : (
            <Pildora tono="luz">Caja abierta</Pildora>
          )
        ) : null}
        <GlassButton variante="cristal" icono={<Printer />} onClick={() => window.print()} className="ml-auto" disabled={!r}>
          Imprimir corte
        </GlassButton>
      </div>

      <h2 className="hidden text-xl font-semibold text-fg print:block">Corte de caja del {fechaLarga(fecha)}</h2>

      {consulta.isError ? (
        <GlassPanel>
          <EstadoVacio
            icono={<FileSearch />}
            titulo="No se pudo cargar el corte"
            descripcion={`${consulta.error.message}. Revisa tu conexión e inténtalo de nuevo.`}
            accion={
              <GlassButton icono={<RotateCcw />} onClick={() => void consulta.refetch()}>
                Reintentar
              </GlassButton>
            }
          />
        </GlassPanel>
      ) : !r ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]" aria-hidden>
          <Skeleton className="h-[34rem] rounded-sheet" />
          <div className="flex flex-col gap-4">
            <Skeleton className="h-56 rounded-module" />
            <Skeleton className="h-44 rounded-module" />
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <Cuadre key={`${r.fecha}-${r.cerrado}`} r={r} />
            <div className="flex flex-col gap-4">
              <PorMetodo r={r} />
              <PorUsuario r={r} />
              {r.gastos && r.gastos.length > 0 ? <Gastos r={r} /> : null}
            </div>
          </div>
          <PagosDelDia r={r} />
        </>
      )}

      <Historial actual={fecha} onElegir={cambiarFecha} />
    </div>
  )
}

/** Fila de la cuenta del efectivo: concepto a la izquierda, cifra tabular a la derecha. */
function Linea({ signo, concepto, valor, nota, fuerte }: { signo?: '+' | '−' | '='; concepto: ReactNode; valor: ReactNode; nota?: ReactNode; fuerte?: boolean }) {
  return (
    <div className={cn('flex items-baseline gap-3 py-2.5', fuerte && 'border-t border-[var(--divider)] pt-3.5')}>
      <span className="w-4 shrink-0 text-center font-semibold text-fg-subtle" aria-hidden>
        {signo}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-sm', fuerte ? 'font-semibold text-fg' : 'text-fg-muted')}>{concepto}</span>
        {nota ? <span className="block text-xs text-fg-subtle">{nota}</span> : null}
      </span>
      <span className={cn('num whitespace-nowrap text-right', fuerte ? 'text-xl font-semibold text-fg' : 'font-medium text-fg')}>{valor}</span>
    </div>
  )
}

function Cuadre({ r }: { r: ResumenCaja }) {
  const { puede, sesion } = useSesion()
  const cerrar = useCerrarCaja()
  const puedeCerrar = puede('registrar_pagos') && !r.cerrado
  const admin = sesion?.perfil.rol === 'admin'
  const corte = r.corte
  const [textoInicial, setTextoInicial] = useState(r.efectivo_inicial ? r.efectivo_inicial.toFixed(2) : '')
  const [textoContado, setTextoContado] = useState('')
  const [notas, setNotas] = useState('')
  const [confirmar, setConfirmar] = useState(false)
  const [reabrir, setReabrir] = useState(false)

  const inicialLeido = leerImporte(textoInicial)
  const inicial = r.cerrado ? (corte?.efectivo_inicial ?? r.efectivo_inicial) : inicialLeido !== null && !Number.isNaN(inicialLeido) ? inicialLeido : 0
  const errorInicial = inicialLeido !== null && (Number.isNaN(inicialLeido) || inicialLeido < 0) ? 'Escribe una cantidad válida (0 o más)' : null
  const esperado = r.cerrado ? (corte?.esperado ?? r.esperado) : redondear(inicial + r.efectivo.neto)
  const contadoLeido = leerImporte(textoContado)
  const errorContado = contadoLeido !== null && (Number.isNaN(contadoLeido) || contadoLeido < 0) ? 'Escribe una cantidad válida (0 o más)' : null
  const contado = r.cerrado ? (corte?.efectivo_contado ?? null) : contadoLeido !== null && !errorContado ? contadoLeido : null
  const diferencia = contado === null ? null : redondear(contado - esperado)
  const cuadra = diferencia !== null && Math.abs(diferencia) < 0.005

  const cerrarCaja = async () => {
    if (contado === null) return
    try {
      await cerrar.mutateAsync({ fecha: r.fecha, efectivo_inicial: inicial, efectivo_contado: contado, notas: notas.trim() || null })
      toast.success(`Caja del ${fechaCorta(r.fecha, r.fecha)} cerrada`, { description: cuadra ? 'El efectivo cuadró exacto.' : `Diferencia registrada: ${dinero(diferencia)}` })
      setConfirmar(false)
    } catch (e) {
      toast.error(`No se cerró la caja: ${(e as Error).message}`)
    }
  }

  const sugerido = r.efectivo_inicial_sugerido

  return (
    <GlassPanel className="p-5 sm:p-6" aria-labelledby="titulo-cuadre">
      <EncabezadoPanel
        titulo={<span id="titulo-cuadre">Cuadre de efectivo</span>}
        descripcion={r.cerrado && corte ? `Cerrada por ${corte.cerrado_por_nombre ?? 'administración'} el ${fechaCorta(corte.created_at.slice(0, 10), r.fecha)} a las ${hora(corte.created_at)}` : fechaLarga(r.fecha)}
        acciones={
          r.cerrado && admin ? (
            <GlassButton variante="cristal" tamano="sm" icono={<LockOpen />} onClick={() => setReabrir(true)} className="no-print pointer-coarse:h-11">
              Reabrir caja
            </GlassButton>
          ) : null
        }
      />

      <div className="mt-4">
        <Linea
          concepto="Efectivo inicial"
          nota={!r.cerrado && sugerido !== null ? `Al cierre anterior se contaron ${dinero(sugerido)}` : undefined}
          valor={
            r.cerrado || !puedeCerrar ? (
              dinero(inicial)
            ) : (
              <span className="inline-block w-36">
                <GlassInput
                  aria-label="Efectivo inicial"
                  aria-invalid={errorInicial ? true : undefined}
                  inputMode="decimal"
                  value={textoInicial}
                  onChange={(e) => setTextoInicial(e.target.value)}
                  placeholder="0.00"
                  icono={<span className="text-sm">$</span>}
                  className="num h-10 text-right font-medium pointer-coarse:h-11"
                />
              </span>
            )
          }
        />
        {errorInicial ? <p className="-mt-1 pb-1 text-right text-xs font-medium text-danger">{errorInicial}</p> : null}
        <Linea signo="+" concepto="Cobros en efectivo" valor={dinero(r.efectivo.entradas)} />
        <Linea signo="−" concepto="Devoluciones en efectivo" valor={dinero(r.efectivo.devoluciones)} />
        <Linea signo="−" concepto="Gastos pagados en efectivo" valor={dinero(r.efectivo.gastos)} />
        <Linea signo="=" concepto="Efectivo esperado en caja" valor={<span data-prueba="esperado">{dinero(esperado)}</span>} fuerte />
      </div>

      <div className="mt-5 rounded-module bg-fg/[0.03] p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            {r.cerrado ? (
              <>
                <p className="text-sm font-medium text-fg-muted">Efectivo contado</p>
                <p className="num text-[2rem] font-semibold leading-tight tracking-tight text-fg">{dinero(contado)}</p>
              </>
            ) : puedeCerrar ? (
              <Campo etiqueta="Efectivo contado" error={errorContado}>
                {(id, a11y) => (
                  <GlassInput
                    id={id}
                    {...a11y}
                    inputMode="decimal"
                    value={textoContado}
                    onChange={(e) => setTextoContado(e.target.value)}
                    placeholder="0.00"
                    icono={<span className="text-lg font-semibold">$</span>}
                    className="num h-14 w-[13rem] text-[1.5rem] font-semibold"
                    autoComplete="off"
                  />
                )}
              </Campo>
            ) : (
              <p className="max-w-xs text-sm text-fg-muted">Solo quien registra pagos captura el efectivo contado y cierra la caja.</p>
            )}
          </div>
          <div className="text-right" aria-live="polite">
            <p className="text-sm font-medium text-fg-muted">Diferencia</p>
            <p
              className={cn(
                'num text-[2rem] font-semibold leading-tight tracking-tight transition-colors',
                diferencia === null ? 'text-fg-subtle' : cuadra ? 'text-success' : diferencia < 0 ? 'text-danger' : 'text-amber-700 dark:text-amber-300',
              )}
              data-prueba="diferencia"
            >
              {diferencia === null ? '—' : cuadra ? dinero(0) : `${diferencia > 0 ? '+' : '−'}${dinero(Math.abs(diferencia))}`}
            </p>
            <p className="text-xs font-medium text-fg-muted">{diferencia === null ? 'Sin contar' : cuadra ? 'Cuadra exacto' : diferencia < 0 ? 'Falta efectivo' : 'Sobra efectivo'}</p>
          </div>
        </div>
        <div className="mt-5">
          <Balanza esperado={esperado} diferencia={diferencia} />
        </div>
      </div>

      {r.cerrado ? (
        corte?.notas ? (
          <p className="mt-4 rounded-tile bg-fg/[0.04] px-4 py-3 text-sm text-fg-muted">
            <span className="font-semibold text-fg">Notas: </span>
            {corte.notas}
          </p>
        ) : null
      ) : puedeCerrar ? (
        <div className="no-print mt-5 flex flex-col gap-4">
          <Campo etiqueta="Notas del corte" opcional ayuda={diferencia !== null && !cuadra ? 'Explica la diferencia: queda en el corte.' : undefined}>
            {(id, a11y) => <GlassTextarea id={id} {...a11y} rows={2} maxLength={2000} value={notas} onChange={(e) => setNotas(e.target.value)} />}
          </Campo>
          <div className="flex flex-wrap items-center justify-end gap-3">
            {contado === null ? <span className="text-xs text-fg-subtle">Captura el efectivo contado para cerrar.</span> : null}
            <GlassButton variante="primario" icono={<Lock />} disabled={contado === null || Boolean(errorInicial)} onClick={() => setConfirmar(true)}>
              Cerrar caja
            </GlassButton>
          </div>
        </div>
      ) : null}

      <GlassModal
        abierto={confirmar}
        onCambio={setConfirmar}
        titulo={`¿Cerrar la caja del ${fechaLarga(r.fecha)}?`}
        descripcion={admin ? 'Podrás reabrirla si hace falta.' : 'Después, solo administración podrá registrar o cambiar movimientos en efectivo de ese día.'}
        ancho="sm"
        pie={
          <>
            <GlassButton variante="fantasma" onClick={() => setConfirmar(false)}>
              Seguir revisando
            </GlassButton>
            <GlassButton variante="primario" icono={<Lock />} cargando={cerrar.isPending} onClick={() => void cerrarCaja()}>
              Cerrar caja
            </GlassButton>
          </>
        }
      >
        <dl className="divide-y divide-[var(--divider)] text-sm">
          {[
            ['Efectivo esperado', dinero(esperado)],
            ['Efectivo contado', dinero(contado)],
            ['Diferencia', cuadra ? 'Cuadra exacto' : dinero(diferencia)],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 py-2.5">
              <dt className="text-fg-muted">{k}</dt>
              <dd className="num font-semibold text-fg">{v}</dd>
            </div>
          ))}
        </dl>
      </GlassModal>
      <ReabrirModal fecha={r.fecha} abierto={reabrir} onCambio={setReabrir} />
    </GlassPanel>
  )
}

function ReabrirModal({ fecha, abierto, onCambio }: { fecha: string; abierto: boolean; onCambio: (v: boolean) => void }) {
  const reabrir = useReabrirCaja()
  const [motivo, setMotivo] = useState('')
  const [intento, setIntento] = useState(false)
  const confirmar = async () => {
    setIntento(true)
    if (!motivo.trim()) return
    try {
      await reabrir.mutateAsync({ fecha, motivo: motivo.trim() })
      toast.success(`Caja del ${fechaLarga(fecha)} reabierta`)
      setMotivo('')
      setIntento(false)
      onCambio(false)
    } catch (e) {
      toast.error(`No se reabrió la caja: ${(e as Error).message}`)
    }
  }
  return (
    <GlassModal
      abierto={abierto}
      onCambio={onCambio}
      titulo="Reabrir caja"
      descripcion={`El corte del ${fechaLarga(fecha)} se elimina y la caja vuelve a quedar abierta. El motivo queda en la bitácora.`}
      ancho="sm"
      pie={
        <>
          <GlassButton variante="fantasma" onClick={() => onCambio(false)}>
            Mantener cerrada
          </GlassButton>
          <GlassButton variante="primario" icono={<LockOpen />} cargando={reabrir.isPending} onClick={() => void confirmar()}>
            Reabrir caja
          </GlassButton>
        </>
      }
    >
      <Campo etiqueta="Motivo" error={intento && !motivo.trim() ? 'Escribe por qué se reabre la caja' : null}>
        {(id, a11y) => <GlassTextarea id={id} {...a11y} autoFocus rows={3} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. faltó registrar un pago en efectivo" />}
      </Campo>
    </GlassModal>
  )
}

function PorMetodo({ r }: { r: ResumenCaja }) {
  const metodos = [...new Set([...r.entradas_por_metodo.map((m) => m.metodo), ...r.devoluciones_por_metodo.map((m) => m.metodo)])]
  return (
    <GlassPanel className="rounded-module p-5">
      <EncabezadoPanel titulo="Por método" descripcion={`${dinero(r.totales.neto)} netos en ${r.pagos.length} ${r.pagos.length === 1 ? 'movimiento' : 'movimientos'}`} />
      {metodos.length === 0 ? (
        <p className="mt-4 text-sm text-fg-muted">Sin cobros este día.</p>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--divider)]">
          {metodos.map((m) => {
            const e = r.entradas_por_metodo.find((x) => x.metodo === m)
            const d = r.devoluciones_por_metodo.find((x) => x.metodo === m)
            const Icono = ICONO_METODO[m]
            return (
              <li key={m} className="flex items-center gap-3 py-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--control-bg)] text-fg" aria-hidden>
                  <Icono className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-fg">{METODOS_PAGO[m]}</span>
                  <span className="block text-xs text-fg-subtle">
                    {e?.pagos ?? 0} {e?.pagos === 1 ? 'cobro' : 'cobros'}
                    {d ? ` · ${d.pagos} ${d.pagos === 1 ? 'devolución' : 'devoluciones'} (−${dinero(d.total)})` : ''}
                  </span>
                </span>
                <span className="num font-semibold text-fg">{dinero(redondear((e?.total ?? 0) - (d?.total ?? 0)))}</span>
              </li>
            )
          })}
        </ul>
      )}
      {r.cancelados.pagos > 0 ? (
        <p className="mt-2 text-xs text-fg-subtle">
          {r.cancelados.pagos} {r.cancelados.pagos === 1 ? 'pago cancelado' : 'pagos cancelados'} ({dinero(r.cancelados.total)}) no cuentan.
        </p>
      ) : null}
    </GlassPanel>
  )
}

function PorUsuario({ r }: { r: ResumenCaja }) {
  if (r.por_usuario.length === 0) return null
  return (
    <GlassPanel className="rounded-module p-5">
      <EncabezadoPanel titulo="Por persona" />
      <ul className="mt-3 divide-y divide-[var(--divider)]">
        {r.por_usuario.map((u) => (
          <li key={u.usuario_id ?? u.nombre} className="flex items-center gap-3 py-2.5">
            <Users className="size-4 shrink-0 text-fg-subtle" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-fg">{u.nombre}</span>
              <span className="block text-xs text-fg-subtle">
                {u.pagos} {u.pagos === 1 ? 'movimiento' : 'movimientos'} · {dinero(u.efectivo_neto)} en efectivo
              </span>
            </span>
            <span className="num font-semibold text-fg">{dinero(u.neto)}</span>
          </li>
        ))}
      </ul>
    </GlassPanel>
  )
}

function Gastos({ r }: { r: ResumenCaja }) {
  return (
    <GlassPanel className="rounded-module p-5">
      <EncabezadoPanel titulo="Gastos del día" />
      <ul className="mt-3 divide-y divide-[var(--divider)]">
        {r.gastos!.map((g) => (
          <li key={g.id} className="flex items-center gap-3 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-fg">{g.concepto}</span>
              <span className="block text-xs text-fg-subtle">
                {METODOS_PAGO[g.metodo_pago]}
                {g.proveedor ? ` · ${g.proveedor}` : ''}
              </span>
            </span>
            <span className="num font-semibold text-fg">−{dinero(g.monto)}</span>
          </li>
        ))}
      </ul>
    </GlassPanel>
  )
}

function PagosDelDia({ r }: { r: ResumenCaja }) {
  return (
    <GlassPanel className="p-2" aria-labelledby="titulo-pagos-dia">
      <h3 id="titulo-pagos-dia" className="px-4 pb-1 pt-3 text-base font-semibold tracking-tight text-fg">
        Movimientos del día
      </h3>
      {r.pagos.length === 0 ? (
        <p className="px-4 pb-4 pt-2 text-sm text-fg-muted">No se registraron pagos este día.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="tabla">
            <caption className="sr-only">Pagos del {fechaLarga(r.fecha)}</caption>
            <thead>
              <tr>
                <th scope="col" className="pl-5">Hora</th>
                <th scope="col">Pedido</th>
                <th scope="col">Tipo</th>
                <th scope="col">Método</th>
                <th scope="col" className="max-md:hidden">Registró</th>
                <th scope="col" className="pr-5 text-right">Importe</th>
              </tr>
            </thead>
            <tbody>
              {r.pagos.map((p) => (
                <tr key={p.id}>
                  <td className="num whitespace-nowrap pl-5 text-fg-muted">{hora(p.created_at)}</td>
                  <td className="w-full max-w-0">
                    <span className="num font-semibold text-fg">{p.folio}</span>
                    <span className="block truncate text-xs text-fg-muted">{p.cliente ?? '—'}</span>
                  </td>
                  <td>
                    <TipoPildora tipo={p.tipo as TipoPago} />
                  </td>
                  <td className="whitespace-nowrap text-fg">
                    {METODOS_PAGO[p.metodo]}
                    {p.referencia ? <span className="block max-w-[10rem] truncate text-xs text-fg-subtle">{p.referencia}</span> : null}
                  </td>
                  <td className="whitespace-nowrap text-fg-muted max-md:hidden">{p.usuario ?? '—'}</td>
                  <td className="pr-5 text-right">
                    <Importe importe={p.importe} tipo={p.tipo as TipoPago} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GlassPanel>
  )
}

function Historial({ actual, onElegir }: { actual: string; onElegir: (f: string) => void }) {
  const cortes = useCortes()
  return (
    <GlassPanel className="no-print p-2" aria-labelledby="titulo-historial">
      <h3 id="titulo-historial" className="flex items-center gap-2 px-4 pb-1 pt-3 text-base font-semibold tracking-tight text-fg">
        <History className="size-4 text-fg-subtle" aria-hidden />
        Cortes anteriores
      </h3>
      {cortes.isPending ? (
        <div className="flex flex-col gap-2 p-3" aria-hidden>
          <Skeleton className="h-12 rounded-tile" />
          <Skeleton className="h-12 rounded-tile" />
        </div>
      ) : cortes.isError ? (
        <p className="px-4 pb-4 text-sm text-danger">No se pudo cargar el historial: {cortes.error.message}</p>
      ) : cortes.data.length === 0 ? (
        <p className="px-4 pb-4 pt-2 text-sm text-fg-muted">Todavía no hay cortes cerrados.</p>
      ) : (
        <ul className="flex flex-col">
          {cortes.data.map((c) => {
            const cuadra = Math.abs(c.diferencia) < 0.005
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onElegir(c.fecha)}
                  aria-current={c.fecha === actual ? 'date' : undefined}
                  className={cn(
                    'flex min-h-14 w-full items-center gap-3 rounded-tile border-t border-[var(--divider)] px-4 py-2 text-left outline-none transition-colors hover:bg-[var(--row-hover)] focus-visible:shadow-[var(--focus-ring)]',
                    c.fecha === actual && 'bg-[var(--row-hover)]',
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-fg">{diaCorto(c.fecha)}</span>
                    <span className="block truncate text-xs text-fg-subtle">Cerró {c.cerrado_por_nombre ?? '—'}</span>
                  </span>
                  <span className="hidden text-right sm:block">
                    <span className="block text-xs text-fg-subtle">Contado</span>
                    <span className="num text-sm font-medium text-fg">{dinero(c.efectivo_contado)}</span>
                  </span>
                  <span className="w-28 text-right">
                    {cuadra ? (
                      <Pildora tono="exito">Cuadró</Pildora>
                    ) : (
                      <Pildora tono={c.diferencia < 0 ? 'peligro' : 'luz'}>
                        <span className="num">
                          {c.diferencia > 0 ? '+' : '−'}
                          {dinero(Math.abs(c.diferencia))}
                        </span>
                      </Pildora>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </GlassPanel>
  )
}
