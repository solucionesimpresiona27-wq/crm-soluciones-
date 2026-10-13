import { ArrowDownRight, ArrowUpRight, ChartColumn, HandCoins } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSesion } from '@/app/sesion'
import { AnimatedNumber, GlassButton, Pildora } from '@/components/glass'
import type { DashboardResumen } from '@/data/tipos'
import { dinero } from '@/lib/format'
import { cn } from '@/lib/utils'
import { GraficaVentas, GraficaVentasMini, useColoresGrafica } from './GraficaVentas'
import { GlifoAmpliar, ModuloExpandible, Muestra, PanelExpandido } from './Modulo'
import { entero, nombreMes, pesos, plural } from './util'

interface Comunes {
  r: DashboardResumen
  abierto: boolean
  onAbrir: () => void
  onCerrar: () => void
  enfocar: boolean
  onEnfocado: () => void
  remontado: boolean
  /** Solo la primera vez: contador animado */
  contar: boolean
}

function calcular(r: DashboardResumen) {
  const serie = r.serie_mensual ?? []
  const ventas = r.ventas_mes ?? 0
  const anterior = r.ventas_mes_anterior ?? 0
  const cobrado = r.cobrado_mes ?? 0
  const mes = serie.at(-1)?.mes ?? r.hoy.slice(0, 7)
  const mesPrevio = serie.at(-2)?.mes
  return {
    serie,
    ventas,
    anterior,
    cobrado,
    mes,
    mesPrevio,
    cambio: anterior > 0 ? ((ventas - anterior) / anterior) * 100 : null,
    pctCobrado: ventas > 0 ? Math.round((cobrado / ventas) * 100) : null,
    utilidad: r.utilidad_estimada_mes,
    margen: r.utilidad_estimada_mes && r.utilidad_estimada_mes.venta > 0 ? Math.round((r.utilidad_estimada_mes.utilidad / r.utilidad_estimada_mes.venta) * 100) : null,
  }
}

function PildoraCambio({ cambio, mesPrevio, corto }: { cambio: number; mesPrevio?: string; corto?: boolean }) {
  const sube = cambio >= 0
  const Icono = sube ? ArrowUpRight : ArrowDownRight
  return (
    <Pildora tono={sube ? 'exito' : 'peligro'} punto={false} className="h-7 gap-1 pl-2 pr-2.5">
      <Icono className="size-3.5" aria-hidden />
      <span className="num">{Math.abs(Math.round(cambio))}%</span>
      {mesPrevio ? (
        <span className={cn('font-medium opacity-75', corto && 'hidden sm:inline')}>vs {nombreMes(mesPrevio)}</span>
      ) : null}
      <span className="sr-only">{sube ? 'más' : 'menos'} que el mes anterior</span>
    </Pildora>
  )
}

/** Cifra principal en "texto de cristal", con el signo de pesos en menor tamaño. */
function CifraCristal({ valor, contar, className }: { valor: number; contar: boolean; className?: string }) {
  return (
    <p className={cn('flex items-start font-semibold leading-none', className)}>
      <span className="sr-only">{dinero(valor)}</span>
      <span aria-hidden className="glass-text mr-[0.04em] mt-[0.12em] text-[0.46em] leading-none">
        $
      </span>
      <span aria-hidden className="glass-text pb-[0.06em] leading-none">
        {contar ? (
          // El resorte se asienta lento en cifras grandes: a 0.2% del final ya se muestra la cifra exacta
          <AnimatedNumber valor={valor} formato={(n) => entero(Math.abs(valor - n) <= Math.abs(valor) * 0.002 ? valor : n)} duracion={1.1} />
        ) : (
          entero(valor)
        )}
      </span>
    </p>
  )
}

/** El módulo protagonista: ventas del mes como cifra de cristal, comparación y tendencia de 6 meses. */
export function VentasModulo({ r, abierto, onAbrir, onCerrar, enfocar, onEnfocado, remontado, contar }: Comunes) {
  const d = calcular(r)
  const colores = useColoresGrafica()
  const navegar = useNavigate()
  const { puede } = useSesion()

  const ir = (ruta: string) => {
    onCerrar()
    navegar(ruta)
  }

  return (
    <>
      <ModuloExpandible
        id="ventas"
        etiqueta={`Ventas de ${nombreMes(d.mes, true)}: ${dinero(d.ventas)}. Abrir detalle`}
        abierto={abierto}
        onAbrir={onAbrir}
        enfocar={enfocar}
        onEnfocado={onEnfocado}
        remontado={remontado}
        decoracion={
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-90 dark:opacity-70"
            style={{ background: 'radial-gradient(70% 60% at 92% 4%, rgb(var(--luz) / 0.2), transparent 70%)' }}
          />
        }
      >
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-3">
            <h3 className="flex items-center gap-2 pt-1 text-sm font-semibold text-fg-muted">
              <Muestra color={colores.ventas} />
              Ventas de {nombreMes(d.mes, true)}
            </h3>
            <div className="flex items-center gap-2">
              {d.cambio !== null ? <PildoraCambio cambio={d.cambio} mesPrevio={d.mesPrevio} corto /> : null}
              <GlifoAmpliar />
            </div>
          </div>

          <CifraCristal
            valor={d.ventas}
            contar={contar}
            className="mt-2 text-[3.4rem] tracking-[-0.045em] sm:text-display lg:text-[4.25rem] xl:text-[4.75rem]"
          />

          <dl className="mt-3 flex flex-wrap gap-x-7 gap-y-2">
            <div>
              <dt className="flex items-center gap-1.5 text-xs font-medium text-fg-muted">
                <Muestra color={colores.cobrado} />
                Cobrado
              </dt>
              <dd className="mt-0.5 text-md font-semibold text-fg">
                {pesos(d.cobrado)}
                {d.pctCobrado !== null ? <span className="ml-1.5 text-xs font-medium text-fg-subtle">{d.pctCobrado}%</span> : null}
              </dd>
            </div>
            {d.utilidad ? (
              <div>
                <dt className="text-xs font-medium text-fg-muted">Utilidad estimada</dt>
                <dd className="mt-0.5 text-md font-semibold text-fg">
                  {pesos(d.utilidad.utilidad)}
                  {d.margen !== null ? <span className="ml-1.5 text-xs font-medium text-fg-subtle">{d.margen}% de margen</span> : null}
                </dd>
              </div>
            ) : null}
          </dl>

          {d.serie.length > 1 ? (
            <div className="-mx-1 mt-3 min-h-24 flex-1">
              <GraficaVentasMini serie={d.serie} />
            </div>
          ) : null}
        </div>
      </ModuloExpandible>

      <PanelExpandido
        id="ventas"
        abierto={abierto}
        onCerrar={onCerrar}
        titulo="Ventas"
        descripcion="Lo vendido y lo cobrado en los últimos 6 meses. Montos con IVA."
        pie={
          <>
            {puede('ver_reportes') ? (
              <GlassButton variante="cristal" icono={<ChartColumn />} onClick={() => ir('/reportes')}>
                Ver reportes
              </GlassButton>
            ) : null}
            {puede('ver_precios') ? (
              <GlassButton variante="primario" icono={<HandCoins />} onClick={() => ir('/pagos')}>
                Ir a cobranza
              </GlassButton>
            ) : null}
          </>
        }
      >
        <DetalleVentas r={r} />
      </PanelExpandido>
    </>
  )
}

function Dato({ etiqueta, valor, nota, muestra }: { etiqueta: string; valor: string; nota?: ReactNode; muestra?: string }) {
  return (
    <div className="rounded-tile bg-[var(--control-bg)] p-4 shadow-[inset_0_1px_0_var(--inner-hi)]">
      <p className="flex items-center gap-1.5 text-xs font-medium text-fg-muted">
        {muestra ? <Muestra color={muestra} /> : null}
        {etiqueta}
      </p>
      <p className="mt-1 text-xl font-semibold tracking-tight text-fg">{valor}</p>
      {nota ? <p className="mt-0.5 text-xs text-fg-subtle">{nota}</p> : null}
    </div>
  )
}

function DetalleVentas({ r }: { r: DashboardResumen }) {
  const d = calcular(r)
  const colores = useColoresGrafica()

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Dato
          etiqueta={`Vendido en ${nombreMes(d.mes, true)}`}
          valor={pesos(d.ventas)}
          muestra={colores.ventas}
          nota={d.cambio !== null && d.mesPrevio ? `${d.cambio >= 0 ? '+' : '−'}${Math.abs(Math.round(d.cambio))}% vs ${nombreMes(d.mesPrevio, true)}` : undefined}
        />
        <Dato
          etiqueta="Cobrado este mes"
          valor={pesos(d.cobrado)}
          muestra={colores.cobrado}
          nota={d.pctCobrado !== null ? `${d.pctCobrado}% de lo vendido` : undefined}
        />
        {r.por_cobrar ? (
          <Dato etiqueta="Por cobrar" valor={pesos(r.por_cobrar.total)} nota={plural(r.por_cobrar.pedidos, 'pedido con saldo', 'pedidos con saldo')} />
        ) : null}
        {d.utilidad ? (
          <Dato
            etiqueta="Utilidad estimada"
            valor={pesos(d.utilidad.utilidad)}
            nota={d.margen !== null ? `${d.margen}% de margen sin IVA` : undefined}
          />
        ) : null}
      </div>

      <section aria-labelledby="ventas-grafica">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 id="ventas-grafica" className="text-sm font-semibold text-fg">
            Vendido y cobrado por mes
          </h3>
          <ul className="flex items-center gap-4 text-xs font-medium text-fg-muted" aria-label="Leyenda">
            <li className="flex items-center gap-1.5">
              <Muestra color={colores.ventas} />
              Vendido
            </li>
            <li className="flex items-center gap-1.5">
              <Muestra color={colores.cobrado} />
              Cobrado
            </li>
          </ul>
        </div>
        <GraficaVentas serie={d.serie} />
      </section>

      <section aria-labelledby="ventas-tabla" className="rounded-tile bg-[var(--control-bg)] px-1 py-1 shadow-[inset_0_1px_0_var(--inner-hi)]">
        <h3 id="ventas-tabla" className="sr-only">
          Desglose por mes
        </h3>
        <div className="overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Mes</th>
                <th scope="col" className="text-right">
                  Vendido
                </th>
                <th scope="col" className="text-right">
                  Cobrado
                </th>
                <th scope="col" className="hidden text-right sm:table-cell">
                  Cobrado del total
                </th>
              </tr>
            </thead>
            <tbody>
              {[...d.serie].reverse().map((s, i) => {
                const pct = s.ventas > 0 ? Math.round((s.cobrado / s.ventas) * 100) : null
                return (
                  <tr key={s.mes} className={cn(i === 0 && 'font-semibold')}>
                    <td className="text-fg">
                      <span className="capitalize">{nombreMes(s.mes, true)}</span>
                      {i === 0 ? (
                        <Pildora tono="luz" className="ml-2 align-middle">
                          En curso
                        </Pildora>
                      ) : null}
                    </td>
                    <td className="num text-right text-fg">{dinero(s.ventas)}</td>
                    <td className="num text-right text-fg">{dinero(s.cobrado)}</td>
                    <td className="num hidden text-right text-fg-muted sm:table-cell">{pct !== null ? `${entero(pct)}%` : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
