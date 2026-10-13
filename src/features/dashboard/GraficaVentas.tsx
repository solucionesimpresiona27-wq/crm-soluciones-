import { useReducedMotion } from 'motion/react'
import { Bar, BarChart, CartesianGrid, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts'
import { useTema } from '@/app/tema'
import { dinero } from '@/lib/format'
import { nombreMes, pesosEje } from './util'

export interface PuntoSerie {
  mes: string
  ventas: number
  cobrado: number
}

/**
 * Colores de la gráfica por tema: vendido = azul de marca, cobrado = la luz amarilla.
 * Verificados con el validador de dataviz: separación para daltonismo y visión normal holgada (ΔE > 30).
 * En claro el amarillo baja un paso (amber-500) y aun así queda bajo 3:1 contra el cristal,
 * por eso siempre va con leyenda, cifras visibles y la tabla del detalle.
 */
export function useColoresGrafica() {
  const oscuro = useTema().efectivo === 'oscuro'
  return {
    ventas: oscuro ? '#87A3C9' : '#22426B',
    cobrado: oscuro ? '#F9C206' : '#DDA900',
    eje: oscuro ? 'rgb(172 186 206)' : 'rgb(66 84 110)',
    ejeSuave: oscuro ? 'rgb(128 144 168)' : 'rgb(104 119 142)',
    rejilla: oscuro ? 'rgba(255,255,255,0.08)' : 'rgba(14,28,48,0.08)',
    cursor: oscuro ? 'rgba(255,255,255,0.06)' : 'rgba(14,28,48,0.05)',
    /** Banda de cristal que "enciende" el mes en curso */
    banda: oscuro ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)',
  }
}

type Fila = PuntoSerie & { etiqueta: string; actual: boolean }

function filas(serie: PuntoSerie[]): Fila[] {
  return serie.map((s, i) => ({ ...s, etiqueta: nombreMes(s.mes), actual: i === serie.length - 1 }))
}

function MarcaMes({ x, y, payload, filas: f, color, colorActual }: { x?: number | string; y?: number | string; payload?: { value: string; index: number }; filas: Fila[]; color: string; colorActual: string }) {
  const actual = payload ? f[payload.index]?.actual : false
  return (
    <text x={x} y={y} dy={11} textAnchor="middle" fontSize={11} fontWeight={actual ? 700 : 500} fill={actual ? colorActual : color}>
      {payload?.value}
    </text>
  )
}

/** Mini gráfica del módulo: el mes en curso va sobre una banda de cristal. */
export function GraficaVentasMini({ serie }: { serie: PuntoSerie[] }) {
  const c = useColoresGrafica()
  const datos = filas(serie)
  const actual = datos.at(-1)
  return (
    <div className="h-full w-full" aria-hidden>
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 96 }}>
        <BarChart data={datos} barGap={2} barCategoryGap="24%" margin={{ top: 2, right: 2, bottom: 4, left: 2 }} accessibilityLayer={false}>
          <XAxis
            dataKey="etiqueta"
            axisLine={false}
            tickLine={false}
            interval={0}
            height={22}
            tick={(p) => <MarcaMes {...p} filas={datos} color={c.ejeSuave} colorActual={c.eje} />}
          />
          <YAxis hide domain={[0, 'dataMax']} />
          {actual ? <ReferenceArea x1={actual.etiqueta} x2={actual.etiqueta} fill={c.banda} fillOpacity={1} radius={10} /> : null}
          <Bar dataKey="ventas" fill={c.ventas} radius={[4, 4, 0, 0]} maxBarSize={14} isAnimationActive={false} />
          <Bar dataKey="cobrado" fill={c.cobrado} radius={[4, 4, 0, 0]} maxBarSize={14} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function Globo({ active, payload, label }: TooltipContentProps<number, string>) {
  if (!active || !payload?.length) return null
  const fila = payload[0]?.payload as Fila | undefined
  if (!fila) return null
  const pct = fila.ventas > 0 ? Math.round((fila.cobrado / fila.ventas) * 100) : null
  return (
    <div className="glass glass-strong min-w-44 rounded-control px-3.5 py-2.5 text-sm shadow-glass-lg">
      <p className="text-xs font-semibold capitalize text-fg-muted">{nombreMes(fila.mes, true) || label}</p>
      <ul className="mt-1.5 flex flex-col gap-1">
        {payload.map((p) => (
          <li key={String(p.dataKey)} className="flex items-center gap-2">
            <span className="h-0.5 w-3 rounded-full" style={{ background: p.color }} aria-hidden />
            <span className="num font-semibold text-fg">{dinero(Number(p.value))}</span>
            <span className="ml-auto pl-3 text-xs text-fg-muted">{p.dataKey === 'ventas' ? 'Vendido' : 'Cobrado'}</span>
          </li>
        ))}
      </ul>
      {pct !== null ? <p className="mt-1.5 text-xs text-fg-subtle">Cobrado: {pct}% de lo vendido</p> : null}
    </div>
  )
}

/** Gráfica completa del detalle: eje con montos, rejilla fina y globo con ambas series. */
export function GraficaVentas({ serie }: { serie: PuntoSerie[] }) {
  const c = useColoresGrafica()
  const reducir = useReducedMotion()
  const datos = filas(serie)
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height: 288 }}>
        <BarChart data={datos} barGap={3} barCategoryGap="26%" margin={{ top: 8, right: 4, bottom: 4, left: 0 }}>
          <CartesianGrid vertical={false} stroke={c.rejilla} strokeWidth={1} />
          <XAxis
            dataKey="etiqueta"
            axisLine={false}
            tickLine={false}
            interval={0}
            height={24}
            tick={(p) => <MarcaMes {...p} filas={datos} color={c.ejeSuave} colorActual={c.eje} />}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            width={68}
            tickCount={4}
            tickFormatter={(v: number) => pesosEje(v)}
            tick={{ fontSize: 11, fill: c.ejeSuave }}
          />
          <Tooltip cursor={{ fill: c.cursor, radius: 12 } as never} content={(p) => <Globo {...(p as TooltipContentProps<number, string>)} />} />
          <Bar dataKey="ventas" name="Vendido" fill={c.ventas} radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={!reducir} animationDuration={520} />
          <Bar dataKey="cobrado" name="Cobrado" fill={c.cobrado} radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={!reducir} animationDuration={520} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
