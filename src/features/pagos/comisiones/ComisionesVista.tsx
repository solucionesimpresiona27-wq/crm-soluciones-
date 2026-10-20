import { ChevronDown, Download, FileSearch, Percent, RotateCcw, UserRound, Wallet } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSesion } from '@/app/sesion'
import { AnimatedNumber, EstadoVacio, GlassButton, GlassInput, GlassPanel, GlassSurface, SegmentedControl, Skeleton } from '@/components/glass'
import type { Comision } from '@/data/modulos/pagos/contrato'
import { useEsEscritorio } from '@/hooks/useMediaQuery'
import { cantidad, dinero, hoyISO } from '@/lib/format'
import { resorte } from '@/lib/motion'
import { cn, iniciales, redondear } from '@/lib/utils'
import { useComisiones, useDetalleComisiones } from '../consultas'
import { Capsula, CapsulasCargando, FilaCapsulas, TablaCargando } from '../piezas'
import { descargarCsv, dineroAsentado, mesAnterior, rangoPeriodo, textoRango } from '../util'

type PeriodoComision = 'mes' | 'anterior' | 'rango'

export default function ComisionesVista() {
  const { puede } = useSesion()
  const todos = puede('ver_reportes')
  const escritorio = useEsEscritorio()
  const hoy = useMemo(() => hoyISO(), [])
  const [periodo, setPeriodo] = useState<PeriodoComision>('mes')
  const [rango, setRango] = useState(() => mesAnterior(hoy))
  const { desde, hasta } = periodo === 'mes' ? rangoPeriodo('mes', hoy) : periodo === 'anterior' ? mesAnterior(hoy) : rangoPeriodo('rango', hoy, rango)
  const consulta = useComisiones(desde, hasta)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [verSinCobros, setVerSinCobros] = useState(false)

  const filas = consulta.data ?? []
  // Quien no cobró nada en el periodo va al final y se oculta hasta pedirlo (la lista de vendedores puede ser larga).
  const conCobros = filas.filter((f) => f.cobrado !== 0 || f.comision !== 0 || f.pedidos > 0)
  const sinCobros = filas.length - conCobros.length
  const visibles = verSinCobros || conCobros.length === 0 ? filas : conCobros
  const totalComision = redondear(filas.reduce((s, f) => s + f.comision, 0))
  const totalBase = redondear(filas.reduce((s, f) => s + f.base_comision, 0))
  const totalCobrado = redondear(filas.reduce((s, f) => s + f.cobrado, 0))
  const textoPeriodo = textoRango(desde, hasta, hoy)

  const exportar = () =>
    descargarCsv(`comisiones_${desde}_${hasta}.csv`, [
      ['Vendedor', 'Comisión %', 'Pedidos', 'Pagos', 'Cobrado con IVA', 'Base sin IVA', 'Comisión'],
      ...filas.map((f) => [f.nombre, f.comision_pct, f.pedidos, f.pagos, f.cobrado.toFixed(2), f.base_comision.toFixed(2), f.comision.toFixed(2)]),
      ['Total', '', '', '', totalCobrado.toFixed(2), totalBase.toFixed(2), totalComision.toFixed(2)],
    ])

  return (
    <div className="flex flex-col gap-4">
      {consulta.isPending ? (
        <CapsulasCargando n={2} />
      ) : (
        <FilaCapsulas etiqueta="Totales de comisiones">
          <Capsula
            className="pr-8"
            tono={totalComision > 0 ? 'luz' : undefined}
            pozo={<Wallet />}
            titulo={<AnimatedNumber valor={totalComision} formato={dineroAsentado(totalComision)} className="num text-md" />}
            subtitulo={todos ? `Comisiones del ${textoPeriodo}` : `Tu comisión del ${textoPeriodo}`}
          />
          <Capsula pozo={<Percent />} titulo={<span className="num">{dinero(totalBase)}</span>} subtitulo="Cobrado sin IVA (base)" />
        </FilaCapsulas>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
        <SegmentedControl
          etiqueta="Periodo"
          segmentos={[
            { valor: 'mes', etiqueta: 'Este mes' },
            { valor: 'anterior', etiqueta: 'Mes anterior' },
            { valor: 'rango', etiqueta: 'Rango' },
          ]}
          valor={periodo}
          onCambio={setPeriodo}
          className="w-full shrink-0 sm:w-auto"
        />
        {periodo === 'rango' ? (
          <div className="flex items-center gap-2">
            <GlassInput type="date" aria-label="Desde" value={rango.desde} max={hoy} onChange={(e) => setRango((r) => ({ ...r, desde: e.target.value }))} className="h-11 w-[10.5rem] rounded-full" />
            <span className="text-fg-subtle" aria-hidden>
              –
            </span>
            <GlassInput type="date" aria-label="Hasta" value={rango.hasta} max={hoy} onChange={(e) => setRango((r) => ({ ...r, hasta: e.target.value }))} className="h-11 w-[10.5rem] rounded-full" />
          </div>
        ) : null}
        {puede('exportar_datos') && filas.length > 0 ? (
          <GlassButton variante="cristal" icono={<Download />} onClick={exportar} className="sm:ml-auto">
            Exportar CSV
          </GlassButton>
        ) : null}
      </div>

      {!todos ? <p className="-mt-1 text-sm text-fg-muted">Ves solo tus comisiones. La comisión se calcula sobre lo cobrado en el periodo, sin IVA.</p> : null}

      {consulta.isPending ? (
        <TablaCargando filas={3} />
      ) : consulta.isError ? (
        <GlassPanel>
          <EstadoVacio
            icono={<FileSearch />}
            titulo="No se pudieron calcular las comisiones"
            descripcion={`${consulta.error.message}. Revisa las fechas e inténtalo de nuevo.`}
            accion={
              <GlassButton icono={<RotateCcw />} onClick={() => void consulta.refetch()}>
                Reintentar
              </GlassButton>
            }
          />
        </GlassPanel>
      ) : filas.length === 0 ? (
        <GlassPanel>
          <EstadoVacio icono={<UserRound />} titulo="Sin vendedores con comisión" descripcion="Asigna un porcentaje de comisión a cada vendedor en Usuarios para verlo aquí." />
        </GlassPanel>
      ) : escritorio ? (
        <GlassPanel className="p-2">
          <table className="tabla">
            <caption className="sr-only">Comisiones del {textoPeriodo}</caption>
            <thead>
              <tr>
                <th scope="col" className="pl-5">Vendedor</th>
                <th scope="col" className="text-right">Comisión %</th>
                <th scope="col" className="text-right">Pedidos</th>
                <th scope="col" className="text-right">Cobrado</th>
                <th scope="col" className="text-right">Base sin IVA</th>
                <th scope="col" className="text-right">Comisión</th>
                <th scope="col" className="w-14">
                  <span className="sr-only">Detalle</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((f) => (
                <Fragment key={f.vendedor_id}>
                  <tr className="cursor-pointer" onClick={() => setAbierto((a) => (a === f.vendedor_id ? null : f.vendedor_id))}>
                    <td className="pl-5">
                      <Persona nombre={f.nombre} />
                    </td>
                    <td className="num text-right text-fg-muted">{cantidad(f.comision_pct)} %</td>
                    <td className="num text-right text-fg-muted">{f.pedidos}</td>
                    <td className="num text-right text-fg">{dinero(f.cobrado)}</td>
                    <td className="num text-right text-fg">{dinero(f.base_comision)}</td>
                    <td className="num text-right text-base font-semibold text-fg">{dinero(f.comision)}</td>
                    <td className="py-2 pr-3">
                      <BotonDetalle f={f} abierto={abierto === f.vendedor_id} onClick={() => setAbierto((a) => (a === f.vendedor_id ? null : f.vendedor_id))} />
                    </td>
                  </tr>
                  {abierto === f.vendedor_id ? (
                    <tr>
                      <td colSpan={7} className="px-3 pb-3 pt-0">
                        <Detalle desde={desde} hasta={hasta} vendedor={f.vendedor_id} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
            {filas.length > 1 ? (
              <tfoot>
                <tr>
                  <th scope="row" className="pl-5 pt-3 text-left text-sm text-fg">
                    Total
                  </th>
                  <td />
                  <td />
                  <td className="num px-4 pt-3 text-right font-semibold text-fg">{dinero(totalCobrado)}</td>
                  <td className="num px-4 pt-3 text-right font-semibold text-fg">{dinero(totalBase)}</td>
                  <td className="num px-4 pt-3 text-right text-base font-semibold text-fg">{dinero(totalComision)}</td>
                  <td />
                </tr>
              </tfoot>
            ) : null}
          </table>
        </GlassPanel>
      ) : (
        <ul className="grid gap-2.5 md:grid-cols-2" aria-label={`Comisiones del ${textoPeriodo}`}>
          {visibles.map((f) => (
            <li key={f.vendedor_id}>
              <GlassSurface variante="fuerte" className="rounded-tile p-4">
                <div className="flex items-center gap-3">
                  <Persona nombre={f.nombre} sub={`${cantidad(f.comision_pct)} % · ${f.pedidos} ${f.pedidos === 1 ? 'pedido' : 'pedidos'}`} />
                  <span className="num ml-auto text-lg font-semibold tracking-tight text-fg">{dinero(f.comision)}</span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-[var(--divider)] pt-3 text-sm">
                  <div>
                    <dt className="text-xs text-fg-muted">Cobrado</dt>
                    <dd className="num font-medium text-fg">{dinero(f.cobrado)}</dd>
                  </div>
                  <div className="text-right">
                    <dt className="text-xs text-fg-muted">Base sin IVA</dt>
                    <dd className="num font-medium text-fg">{dinero(f.base_comision)}</dd>
                  </div>
                </dl>
                <div className="mt-2 flex justify-end">
                  <GlassButton variante="fantasma" tamano="sm" className="pointer-coarse:h-11" iconoDerecha={<ChevronDown className={cn('transition-transform', abierto === f.vendedor_id && 'rotate-180')} />} onClick={() => setAbierto((a) => (a === f.vendedor_id ? null : f.vendedor_id))} aria-expanded={abierto === f.vendedor_id}>
                    Ver pedidos
                  </GlassButton>
                </div>
                {abierto === f.vendedor_id ? <Detalle desde={desde} hasta={hasta} vendedor={f.vendedor_id} /> : null}
              </GlassSurface>
            </li>
          ))}
        </ul>
      )}

      {!consulta.isPending && !consulta.isError && sinCobros > 0 && conCobros.length > 0 ? (
        <div className="flex justify-center">
          <GlassButton variante="cristal" iconoDerecha={<ChevronDown className={cn('transition-transform', verSinCobros && 'rotate-180')} />} aria-expanded={verSinCobros} onClick={() => setVerSinCobros((v) => !v)}>
            {verSinCobros ? 'Ocultar vendedores sin cobros' : `Mostrar ${sinCobros} ${sinCobros === 1 ? 'vendedor' : 'vendedores'} sin cobros`}
          </GlassButton>
        </div>
      ) : null}
    </div>
  )
}

function Persona({ nombre, sub }: { nombre: string; sub?: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-navy-500 to-navy-700 text-2xs font-bold text-white" aria-hidden>
        {iniciales(nombre)}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-semibold text-fg">{nombre}</span>
        {sub ? <span className="block text-xs text-fg-muted">{sub}</span> : null}
      </span>
    </span>
  )
}

function BotonDetalle({ f, abierto, onClick }: { f: Comision; abierto: boolean; onClick: () => void }) {
  return (
    <GlassButton
      variante="fantasma"
      tamano="icono"
      aria-label={`${abierto ? 'Ocultar' : 'Ver'} pedidos de ${f.nombre}`}
      aria-expanded={abierto}
      icono={<ChevronDown className={cn('transition-transform duration-300', abierto && 'rotate-180')} />}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    />
  )
}

function Detalle({ desde, hasta, vendedor }: { desde: string; hasta: string; vendedor: string }) {
  const detalle = useDetalleComisiones(desde, hasta, vendedor)
  const reducir = useReducedMotion()
  return (
    <AnimatePresence initial>
      <motion.div
        initial={reducir ? false : { opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={resorte.suave}
        className="mt-1 rounded-tile bg-fg/[0.035] p-2"
      >
        {detalle.isPending ? (
          <Skeleton className="h-16 rounded-tile" />
        ) : detalle.isError ? (
          <p className="p-3 text-sm text-danger">No se pudo cargar el detalle: {detalle.error.message}</p>
        ) : detalle.data.length === 0 ? (
          <p className="p-3 text-sm text-fg-muted">Sin cobros de sus pedidos en este periodo.</p>
        ) : (
          <ul className="flex flex-col">
            {detalle.data.map((d) => (
              <li key={d.pedido_id} className="flex items-center gap-3 rounded-control px-3 py-2 text-sm">
                <Link to={`/pedidos/${d.pedido_id}`} className="num font-semibold text-fg outline-none hover:underline" onClick={(e) => e.stopPropagation()}>
                  {d.folio}
                </Link>
                <span className="min-w-0 flex-1 truncate text-fg-muted">{d.cliente ?? '—'}</span>
                <span className="num hidden text-fg-muted sm:inline">{dinero(d.base_comision)}</span>
                <span className="num w-24 text-right font-semibold text-fg">{dinero(d.comision)}</span>
              </li>
            ))}
          </ul>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
