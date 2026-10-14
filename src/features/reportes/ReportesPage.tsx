import { CalendarRange } from 'lucide-react'
import { useMemo } from 'react'
import { Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useSesion } from '@/app/sesion'
import { GlassInput, SegmentedControl } from '@/components/glass'
import { useSeccionesVisibles } from '@/components/shell/usarModulos'
import { hoyISO } from '@/lib/format'
import ClientesVista from './ClientesVista'
import { PERIODOS, rangoReporte, type Periodo, type RangoReporte } from './periodo'
import ProductosVista from './ProductosVista'
import UtilidadVista from './UtilidadVista'
import VendedoresVista from './VendedoresVista'
import VentasVista from './VentasVista'

const NOMBRE: Record<Periodo, string> = { mes: 'Este mes', mesPasado: 'Mes pasado', trimestre: 'Trimestre', anio: 'Año', rango: 'Personalizado' }

/** Periodo del reporte tomado de la URL (?periodo=mes|mesPasado|trimestre|anio|rango&desde&hasta). */
function usePeriodo() {
  const [params, setParams] = useSearchParams()
  const hoy = useMemo(() => hoyISO(), [])
  const p = params.get('periodo') as Periodo | null
  const periodo: Periodo = p && PERIODOS.includes(p) ? p : 'mes'
  const rango = rangoReporte(periodo, hoy, { desde: params.get('desde') ?? undefined, hasta: params.get('hasta') ?? undefined })
  const cambiar = (cambios: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const n = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(cambios)) {
          if (v === null) n.delete(k)
          else n.set(k, v)
        }
        return n
      },
      { replace: true },
    )
  return { rango, hoy, cambiar }
}

export default function ReportesPage() {
  const { puede } = useSesion()
  const { pathname, search } = useLocation()
  const navegar = useNavigate()
  const secciones = useSeccionesVisibles('/reportes')
  const { rango, hoy, cambiar } = usePeriodo()
  const actual = [...secciones].sort((a, b) => b.ruta.length - a.ruta.length).find((s) => pathname === s.ruta || pathname.startsWith(`${s.ruta}/`))?.ruta ?? '/reportes'

  const elegir = (p: Periodo) => {
    if (p === 'rango') cambiar({ periodo: 'rango', desde: rango.desde, hasta: rango.hasta })
    else cambiar({ periodo: p === 'mes' ? null : p, desde: null, hasta: null })
  }

  return (
    <div className="flex flex-col gap-5 pt-1">
      <div className="no-print flex flex-col gap-3">
        <SegmentedControl
          etiqueta="Secciones de reportes"
          segmentos={secciones.map((s) => ({ valor: s.ruta, etiqueta: s.titulo }))}
          valor={actual}
          onCambio={(r) => navegar({ pathname: r, search })}
          className="w-full overflow-x-auto sm:w-auto sm:self-start"
        />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
          <SegmentedControl
            etiqueta="Periodo del reporte"
            tamano="sm"
            segmentos={PERIODOS.map((p) => ({ valor: p, etiqueta: NOMBRE[p] }))}
            valor={rango.periodo}
            onCambio={elegir}
            className="max-w-full overflow-x-auto"
          />
          {rango.periodo === 'rango' ? (
            <div className="flex items-center gap-2">
              <GlassInput type="date" aria-label="Desde" value={rango.desde} max={hoy} onChange={(e) => e.target.value && cambiar({ desde: e.target.value })} className="h-11 w-[10.5rem] rounded-full" />
              <span className="text-fg-subtle" aria-hidden>
                –
              </span>
              <GlassInput type="date" aria-label="Hasta" value={rango.hasta} max={hoy} onChange={(e) => e.target.value && cambiar({ hasta: e.target.value })} className="h-11 w-[10.5rem] rounded-full" />
            </div>
          ) : null}
          <p className="flex items-center gap-1.5 text-sm text-fg-muted lg:ml-auto" aria-live="polite">
            <CalendarRange className="size-4 text-fg-subtle" aria-hidden />
            <span className="font-semibold text-fg">{rango.texto}</span>
            {rango.periodo !== 'rango' ? <span className="num">· {rangoTexto(rango, hoy)}</span> : null}
          </p>
        </div>
      </div>

      <Routes>
        <Route index element={<VentasVista r={rango} />} />
        <Route path="productos" element={<ProductosVista r={rango} />} />
        <Route path="vendedores" element={<VendedoresVista r={rango} />} />
        <Route path="clientes" element={<ClientesVista r={rango} />} />
        <Route path="utilidad" element={puede('ver_costos') ? <UtilidadVista r={rango} /> : <VentasVista r={rango} />} />
        <Route path="*" element={<VentasVista r={rango} />} />
      </Routes>
    </div>
  )
}

function rangoTexto(r: RangoReporte, hoy: string) {
  const f = (s: string) => {
    const [a, m, d] = s.split('-').map(Number)
    return new Date(a, m - 1, d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', ...(s.slice(0, 4) !== hoy.slice(0, 4) ? { year: 'numeric' } : {}) }).replace('.', '')
  }
  return `${f(r.desde)} – ${f(r.hasta)}`
}
