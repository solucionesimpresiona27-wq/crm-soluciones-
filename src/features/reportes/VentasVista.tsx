import { ArrowDownRight, ArrowUpRight, ChartColumn, Clock, MessageCircle, Table2, UserRoundCheck, Users } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts'
import { useSesion } from '@/app/sesion'
import { AnimatedNumber, EstadoVacio, GlassButton, GlassPanel, Pildora } from '@/components/glass'
import type { VentasPeriodo } from '@/data/modulos/reportes/contrato'
import { useColoresGrafica } from '@/features/dashboard/GraficaVentas'
import { pesosEje } from '@/features/dashboard/util'
import { dinero, fecha } from '@/lib/format'
import { resorte } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { useCobranza, useInactivos, useVentas, useVentasAnterior } from './consultas'
import { antiguedad, descargarCsv, etiquetaPeriodo, variacion, type RangoReporte } from './periodo'
import { CargandoSeccion, EncabezadoSeccion, ErrorSeccion, Muestra } from './piezas'

const mayus = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
const pct = (c: number) => (Math.abs(c) > 999 ? '+999%' : `${Math.abs(Math.round(c))}%`)
const sumar = (xs: VentasPeriodo[], k: keyof Omit<VentasPeriodo, 'periodo'>) => Math.round(xs.reduce((s, x) => s + x[k], 0) * 100) / 100
const asentar = (v: number) => (n: number) => dinero(Math.abs(v - n) <= Math.abs(v) * 0.002 ? v : n)

export default function VentasVista({ r }: { r: RangoReporte }) {
  const { puede } = useSesion()
  return (
    <div className="flex flex-col gap-8">
      <SeccionVentas r={r} />
      <div className="grid gap-8 xl:grid-cols-[1.1fr_1fr]">
        {puede('ver_precios') ? <SeccionCobranza /> : null}
        <SeccionReactivar />
      </div>
    </div>
  )
}

function Cambio({ cambio, texto }: { cambio: number | null; texto: string }) {
  if (cambio === null) return <span className="text-xs text-fg-subtle">Sin datos del periodo anterior</span>
  const sube = cambio >= 0
  const Icono = sube ? ArrowUpRight : ArrowDownRight
  return (
    <Pildora tono={sube ? 'exito' : 'peligro'} punto={false} className="h-7 gap-1 pl-2 pr-2.5">
      <Icono className="size-3.5" aria-hidden />
      <span className="num">{pct(cambio)}</span>
      <span className="font-medium opacity-75">{texto}</span>
      <span className="sr-only">{sube ? '(subió)' : '(bajó)'}</span>
    </Pildora>
  )
}

function SeccionVentas({ r }: { r: RangoReporte }) {
  const consulta = useVentas(r.desde, r.hasta, r.agrupar)
  const previa = useVentasAnterior(r.anterior.desde, r.anterior.hasta)
  const c = useColoresGrafica()
  const [tabla, setTabla] = useState(false)

  if (consulta.isPending) return <CargandoSeccion alto="h-[26rem]" />
  if (consulta.isError) return <ErrorSeccion que="las ventas" error={consulta.error} onReintentar={() => void consulta.refetch()} />

  const serie = consulta.data
  const ant = previa.data ?? []
  const vendido = sumar(serie, 'vendido')
  const cobrado = sumar(serie, 'cobrado')
  const cotizado = sumar(serie, 'cotizado')
  const pedidos = sumar(serie, 'pedidos')
  const cotizaciones = sumar(serie, 'cotizaciones')
  const hayDatos = vendido || cobrado || cotizado
  const ticket = pedidos ? vendido / pedidos : null
  const filas = serie.map((s) => ({ ...s, etiqueta: etiquetaPeriodo(s.periodo, r.agrupar) }))

  const exportar = () =>
    descargarCsv(`ventas_${r.desde}_${r.hasta}.csv`, [
      ['Periodo', 'Vendido', 'Pedidos', 'Cobrado', 'Cotizado', 'Cotizaciones'],
      ...serie.map((s) => [s.periodo, s.vendido, s.pedidos, s.cobrado, s.cotizado, s.cotizaciones]),
      ['Total', vendido, pedidos, cobrado, cotizado, cotizaciones],
    ])

  const agrupado = r.agrupar === 'dia' ? 'por día' : r.agrupar === 'semana' ? 'por semana' : 'por mes'

  return (
    <section aria-labelledby="t-ventas" className="flex flex-col gap-3">
      <EncabezadoSeccion id="t-ventas" titulo="Ventas" descripcion={`Vendido por fecha del pedido, cobrado por fecha del pago · ${agrupado}`} onExportar={exportar} />
      <GlassPanel className="relative overflow-hidden rounded-module p-5 sm:p-6">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-90 dark:opacity-60" style={{ background: 'radial-gradient(60% 55% at 4% 0%, rgb(var(--luz) / 0.16), transparent 70%)' }} />
        <div className="relative grid grid-cols-2 gap-x-6 gap-y-5 lg:gap-x-8 lg:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))]">
          <div className="col-span-2 lg:col-span-1">
            <p className="flex items-center gap-2 text-sm font-semibold text-fg-muted">
              <Muestra color={c.ventas} /> Vendido
            </p>
            <AnimatedNumber valor={vendido} formato={asentar(vendido)} duracion={1.1} className="glass-text num mt-1 block text-[2.6rem] font-semibold tracking-tight leading-[1.05] sm:text-[3rem] sm:leading-[1.05]" />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Cambio cambio={previa.data ? variacion(vendido, sumar(ant, 'vendido')) : null} texto={r.textoAnterior} />
            </div>
          </div>
          <Kpi etiqueta="Cobrado" color={c.cobrado} valor={cobrado} cambio={previa.data ? variacion(cobrado, sumar(ant, 'cobrado')) : null} pie={vendido > 0 ? `${Math.round((cobrado / vendido) * 100)}% de lo vendido` : undefined} />
          <Kpi etiqueta="Cotizado" color={c.ejeSuave} linea valor={cotizado} cambio={previa.data ? variacion(cotizado, sumar(ant, 'cotizado')) : null} pie={`${cotizaciones} ${cotizaciones === 1 ? 'cotización' : 'cotizaciones'}`} />
          <div className="flex flex-col justify-end">
            <p className="text-sm font-semibold text-fg-muted">Pedidos</p>
            <p className="num mt-1 text-2xl font-semibold tracking-tight text-fg">{pedidos}</p>
            <p className="mt-1 text-xs text-fg-subtle">Ticket promedio {ticket === null ? '—' : <span className="num">{dinero(ticket)}</span>}</p>
          </div>
        </div>

        <div className="relative mt-6 flex flex-wrap items-center justify-between gap-3">
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-fg-muted" aria-label="Leyenda">
            <li className="flex items-center gap-1.5"><Muestra color={c.ventas} /> Vendido</li>
            <li className="flex items-center gap-1.5"><Muestra color={c.cobrado} /> Cobrado</li>
            <li className="flex items-center gap-1.5"><Muestra color={c.ejeSuave} linea /> Cotizado</li>
          </ul>
          <GlassButton variante={tabla ? 'primario' : 'cristal'} tamano="sm" icono={<Table2 />} aria-pressed={tabla} onClick={() => setTabla((t) => !t)} className="pointer-coarse:h-11">
            {tabla ? 'Ver gráfica' : 'Ver como tabla'}
          </GlassButton>
        </div>

        {!hayDatos ? (
          <EstadoVacio icono={<ChartColumn />} titulo="Sin ventas en este periodo" descripcion="Cuando conviertas cotizaciones en pedidos o registres pagos, aparecerán aquí. Prueba con otro periodo." className="relative" />
        ) : tabla ? (
          <div className="relative mt-3 max-h-[22rem] overflow-auto">
            <table className="tabla">
              <caption className="sr-only">Ventas {agrupado}</caption>
              <thead>
                <tr>
                  <th scope="col">Periodo</th>
                  <th scope="col" className="text-right">Vendido</th>
                  <th scope="col" className="text-right">Cobrado</th>
                  <th scope="col" className="text-right">Cotizado</th>
                  <th scope="col" className="text-right">Pedidos</th>
                </tr>
              </thead>
              <tbody>
                {serie.map((s) => (
                  <tr key={s.periodo}>
                    <th scope="row" className="text-left font-medium text-fg">{mayus(etiquetaPeriodo(s.periodo, r.agrupar, true))}</th>
                    <td className="num text-right text-fg">{dinero(s.vendido)}</td>
                    <td className="num text-right text-fg">{dinero(s.cobrado)}</td>
                    <td className="num text-right text-fg-muted">{dinero(s.cotizado)}</td>
                    <td className="num text-right text-fg-muted">{s.pedidos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="relative mt-3 h-72 w-full" role="img" aria-label={`Gráfica de ventas ${agrupado}: vendido ${dinero(vendido)}, cobrado ${dinero(cobrado)}, cotizado ${dinero(cotizado)}. Activa "Ver como tabla" para el detalle.`}>
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height: 288 }}>
              <ComposedChart data={filas} barGap={2} barCategoryGap={filas.length > 20 ? '18%' : '28%'} margin={{ top: 8, right: 4, bottom: 4, left: 0 }}>
                <CartesianGrid vertical={false} stroke={c.rejilla} />
                <XAxis dataKey="etiqueta" axisLine={false} tickLine={false} minTickGap={8} height={24} tick={{ fontSize: 11, fill: c.ejeSuave }} />
                <YAxis axisLine={false} tickLine={false} width={68} tickCount={4} tickFormatter={(v: number) => pesosEje(v)} tick={{ fontSize: 11, fill: c.ejeSuave }} />
                <Tooltip cursor={{ fill: c.cursor, radius: 10 } as never} content={(p) => <Globo {...(p as TooltipContentProps<number, string>)} agrupar={r.agrupar} />} />
                <Bar dataKey="vendido" name="Vendido" fill={c.ventas} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
                <Bar dataKey="cobrado" name="Cobrado" fill={c.cobrado} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
                <Line dataKey="cotizado" name="Cotizado" type="monotone" stroke={c.ejeSuave} strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </GlassPanel>
    </section>
  )
}

function Kpi({ etiqueta, color, linea, valor, cambio, pie }: { etiqueta: string; color: string; linea?: boolean; valor: number; cambio: number | null; pie?: string }) {
  return (
    <div className="flex flex-col justify-end">
      <p className="flex items-center gap-2 text-sm font-semibold text-fg-muted">
        <Muestra color={color} linea={linea} /> {etiqueta}
      </p>
      <p className="num mt-1 text-xl font-semibold tracking-tight text-fg sm:text-2xl">{dinero(valor)}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-subtle">
        {cambio !== null ? (
          <span className={cn('num inline-flex items-center font-semibold', cambio >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300')}>
            {cambio >= 0 ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}
            {pct(cambio)}<span className="sr-only">{cambio >= 0 ? ' más' : ' menos'} que el periodo anterior</span>
          </span>
        ) : null}
        {pie ? <span>{pie}</span> : null}
      </div>
    </div>
  )
}

function Globo({ active, payload, agrupar }: TooltipContentProps<number, string> & { agrupar: RangoReporte['agrupar'] }) {
  if (!active || !payload?.length) return null
  const f = payload[0]?.payload as VentasPeriodo | undefined
  if (!f) return null
  return (
    <div className="glass glass-strong min-w-48 rounded-control px-3.5 py-2.5 text-sm shadow-glass-lg">
      <p className="text-xs font-semibold text-fg-muted">{mayus(etiquetaPeriodo(f.periodo, agrupar, true))}</p>
      <ul className="mt-1.5 flex flex-col gap-1">
        {payload.map((p) => (
          <li key={String(p.dataKey)} className="flex items-center gap-2">
            <span className="h-0.5 w-3 rounded-full" style={{ background: p.color }} aria-hidden />
            <span className="num font-semibold text-fg">{dinero(Number(p.value))}</span>
            <span className="ml-auto pl-3 text-xs text-fg-muted">{p.name}</span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-xs text-fg-subtle">
        {f.pedidos} {f.pedidos === 1 ? 'pedido' : 'pedidos'} · {f.cotizaciones} {f.cotizaciones === 1 ? 'cotización' : 'cotizaciones'}
      </p>
    </div>
  )
}

function SeccionCobranza() {
  const consulta = useCobranza(true)
  const reducir = useReducedMotion()
  if (consulta.isPending) return <CargandoSeccion alto="h-56" />
  if (consulta.isError) return <ErrorSeccion que="las cuentas por cobrar" error={consulta.error} onReintentar={() => void consulta.refetch()} />
  const cuentas = consulta.data
  const total = Math.round(cuentas.reduce((s, x) => s + x.saldo, 0) * 100) / 100
  const tramos = antiguedad(cuentas)
  const max = Math.max(...tramos.map((t) => t.saldo), 1)
  const exportar = () =>
    descargarCsv(`cuentas_por_cobrar_${new Date().toISOString().slice(0, 10)}.csv`, [
      ['Folio', 'Cliente', 'Título', 'Alta', 'Días', 'Total', 'Pagado', 'Saldo', 'Vencido'],
      ...cuentas.map((x) => [x.folio, x.cliente, x.titulo, x.creado.slice(0, 10), x.dias_transcurridos, x.total, x.pagado, x.saldo, x.vencido ? 'Sí' : 'No']),
    ])
  return (
    <section aria-labelledby="t-cxc" className="flex flex-col gap-3">
      <EncabezadoSeccion id="t-cxc" titulo="Cuentas por cobrar" descripcion="Saldo pendiente hoy, por antigüedad del pedido" onExportar={cuentas.length ? exportar : undefined} />
      <GlassPanel className="rounded-module p-5 sm:p-6">
        {cuentas.length === 0 ? (
          <EstadoVacio icono={<UserRoundCheck />} titulo="Nadie te debe" descripcion="Todos los pedidos activos están liquidados." />
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-fg-muted">Total por cobrar</p>
                <p className="num mt-1 text-[2rem] font-semibold tracking-tight leading-tight text-fg">{dinero(total)}</p>
              </div>
              <Link to="/pagos/por-cobrar" className="text-sm font-semibold text-accent outline-none hover:underline focus-visible:underline">
                Ver quién debe
              </Link>
            </div>
            <ul className="mt-5 flex flex-col gap-3" aria-label="Antigüedad de saldos">
              {tramos.map((t, i) => (
                <li key={t.clave} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3">
                  <span className="flex items-center gap-1.5 text-sm text-fg">
                    {i >= 2 ? <Clock className="size-3.5 text-amber-600 dark:text-luz" aria-hidden /> : null}
                    {t.etiqueta}
                  </span>
                  <span className="h-3 overflow-hidden rounded-full bg-fg/[0.07]" aria-hidden>
                    <motion.span
                      className={cn('block h-full origin-left rounded-full', i >= 2 ? 'bg-gradient-to-r from-amber-400 to-luz' : 'bg-navy-600 dark:bg-navy-300')}
                      initial={reducir ? false : { scaleX: 0 }}
                      animate={{ scaleX: t.saldo / max }}
                      transition={{ ...resorte.expansion, delay: reducir ? 0 : 0.05 * i }}
                    />
                  </span>
                  <span className="text-right">
                    <span className="num block text-sm font-semibold text-fg">{dinero(t.saldo)}</span>
                    <span className="num block text-xs text-fg-subtle">
                      {t.pedidos} {t.pedidos === 1 ? 'pedido' : 'pedidos'}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </GlassPanel>
    </section>
  )
}

function SeccionReactivar() {
  const { puede } = useSesion()
  const consulta = useInactivos()
  if (consulta.isPending) return <CargandoSeccion alto="h-56" />
  if (consulta.isError) return <ErrorSeccion que="los clientes por reactivar" error={consulta.error} onReintentar={() => void consulta.refetch()} />
  const lista = consulta.data
  const exportar = () =>
    descargarCsv('clientes_para_reactivar.csv', [
      ['Cliente', 'WhatsApp', 'Última compra', 'Días sin comprar', 'Pedidos', ...(puede('ver_precios') ? ['Total comprado'] : []), 'Vendedor'],
      ...lista.map((x) => [x.nombre, x.whatsapp ?? x.telefono, x.ultima_compra.slice(0, 10), x.dias_sin_compra, x.pedidos, ...(puede('ver_precios') ? [x.total_comprado] : []), x.vendedor]),
    ])
  return (
    <section aria-labelledby="t-reactivar" className="flex flex-col gap-3">
      <EncabezadoSeccion id="t-reactivar" titulo="Clientes para reactivar" descripcion="Compraron antes y llevan más de 90 días sin pedir" onExportar={lista.length ? exportar : undefined} />
      <GlassPanel className="rounded-module p-2">
        {lista.length === 0 ? (
          <EstadoVacio icono={<Users />} titulo="Tus clientes siguen comprando" descripcion="Nadie lleva más de 90 días sin pedir. Aquí aparecerán quienes conviene contactar." />
        ) : (
          <ul aria-label="Clientes sin compras recientes">
            {lista.slice(0, 6).map((x) => (
              <li key={x.cliente_id} className="flex min-h-[3.25rem] items-center gap-3 rounded-tile px-3 py-2 transition-colors hover:bg-[var(--row-hover)] [&+&]:border-t [&+&]:border-[var(--divider)]">
                <div className="min-w-0 flex-1">
                  <Link to={`/clientes/${x.cliente_id}`} className="block truncate font-semibold text-fg outline-none hover:underline focus-visible:underline">
                    {x.nombre}
                  </Link>
                  <p className="truncate text-xs text-fg-subtle">
                    Última compra {fecha(x.ultima_compra)} · {x.pedidos} {x.pedidos === 1 ? 'pedido' : 'pedidos'}
                    {x.total_comprado !== null && puede('ver_precios') ? ` · ${dinero(x.total_comprado)}` : ''}
                  </p>
                </div>
                <Pildora tono={x.dias_sin_compra > 180 ? 'luz' : 'neutro'} punto={false}>
                  <span className="num">{x.dias_sin_compra}</span> días
                </Pildora>
                {x.whatsapp ? (
                  <a
                    href={`https://wa.me/${x.whatsapp.replace(/\D/g, '').replace(/^(\d{10})$/, '52$1')}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Escribir a ${x.nombre} por WhatsApp`}
                    className="grid size-11 shrink-0 place-items-center rounded-full text-fg-muted outline-none transition-colors hover:bg-fg/[0.06] hover:text-fg focus-visible:ring-2 focus-visible:ring-acento"
                  >
                    <MessageCircle className="size-[18px]" aria-hidden />
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {lista.length > 0 ? (
          <div className="flex items-center justify-between gap-3 border-t border-[var(--divider)] px-3 pb-1.5 pt-2.5">
            <span className="text-xs text-fg-subtle">
              {lista.length} {lista.length === 1 ? 'cliente' : 'clientes'} en total
            </span>
            <Link to="/clientes?vista=reactivar" className="inline-flex min-h-11 items-center text-sm font-semibold text-accent outline-none hover:underline focus-visible:underline">
              Ver en Clientes
            </Link>
          </div>
        ) : null}
      </GlassPanel>
    </section>
  )
}
