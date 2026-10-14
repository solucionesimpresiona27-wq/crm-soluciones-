import { ArrowDown, ArrowUp, ArrowUpDown, TrendingDown, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EstadoVacio, GlassPanel, Pildora } from '@/components/glass'
import type { UtilidadPedido } from '@/data/modulos/reportes/contrato'
import { dinero, fecha, porcentaje } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useUtilidad } from './consultas'
import { descargarCsv, type RangoReporte } from './periodo'
import { CargandoSeccion, EncabezadoSeccion, ErrorSeccion } from './piezas'

type Clave = 'fecha' | 'venta' | 'costo_estimado' | 'gastos' | 'consumo_material' | 'utilidad_real' | 'margen_real_pct'
const COLUMNAS: { clave: Clave; titulo: string; oculta?: string }[] = [
  { clave: 'venta', titulo: 'Venta sin IVA' },
  { clave: 'costo_estimado', titulo: 'Costo estimado', oculta: 'max-lg:hidden' },
  { clave: 'gastos', titulo: 'Gastos reales', oculta: 'max-lg:hidden' },
  { clave: 'consumo_material', titulo: 'Material', oculta: 'max-lg:hidden' },
  { clave: 'utilidad_real', titulo: 'Utilidad' },
  { clave: 'margen_real_pct', titulo: 'Margen' },
]

/** Utilidad real por pedido (solo con ver_costos; la ruta ya lo exige). */
export default function UtilidadVista({ r }: { r: RangoReporte }) {
  const consulta = useUtilidad(r.desde, r.hasta, true)
  const [orden, setOrden] = useState<{ clave: Clave; asc: boolean }>({ clave: 'utilidad_real', asc: true })
  const filas = useMemo(() => {
    const xs = [...(consulta.data ?? [])]
    const v = (u: UtilidadPedido) => (orden.clave === 'fecha' ? u.fecha : (u[orden.clave] ?? -Infinity))
    return xs.sort((a, b) => (v(a) < v(b) ? -1 : v(a) > v(b) ? 1 : 0) * (orden.asc ? 1 : -1))
  }, [consulta.data, orden])

  if (consulta.isPending) return <CargandoSeccion />
  if (consulta.isError) return <ErrorSeccion que="la utilidad" error={consulta.error} onReintentar={() => void consulta.refetch()} />

  const venta = filas.reduce((s, f) => s + f.venta, 0)
  const utilidad = filas.reduce((s, f) => s + f.utilidad_real, 0)
  const perdidas = filas.filter((f) => f.utilidad_real < 0)
  const sinCosto = filas.filter((f) => f.costo_real === 0).length
  const exportar = () =>
    descargarCsv(`utilidad_${r.desde}_${r.hasta}.csv`, [
      ['Folio', 'Cliente', 'Título', 'Fecha', 'Venta sin IVA', 'Costo estimado', 'Gastos', 'Material', 'Costo real', 'Utilidad real', 'Margen real %', 'Utilidad estimada', 'Margen estimado %'],
      ...filas.map((f) => [f.folio, f.cliente, f.titulo, f.fecha, f.venta, f.costo_estimado, f.gastos, f.consumo_material, f.costo_real, f.utilidad_real, f.margen_real_pct, f.utilidad_estimada, f.margen_estimado_pct]),
    ])
  const ordenar = (clave: Clave) => setOrden((o) => ({ clave, asc: o.clave === clave ? !o.asc : clave === 'fecha' ? false : true }))

  return (
    <section aria-labelledby="t-util" className="flex flex-col gap-3">
      <EncabezadoSeccion id="t-util" titulo="Utilidad real por pedido" descripcion="Venta sin IVA menos gastos ligados y material consumido (a costo actual)" onExportar={filas.length ? exportar : undefined} />
      {filas.length === 0 ? (
        <GlassPanel>
          <EstadoVacio icono={<TrendingDown />} titulo="Sin pedidos en este periodo" descripcion="La utilidad se calcula por pedido. Prueba con un periodo más amplio." />
        </GlassPanel>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Cifra t="Venta sin IVA" v={dinero(venta)} />
            <Cifra t="Utilidad real" v={dinero(utilidad)} pie={venta > 0 ? `Margen ${porcentaje((utilidad / venta) * 100, 1)}` : undefined} />
            <Cifra
              t="Pedidos con pérdida"
              v={String(perdidas.length)}
              luz={perdidas.length > 0}
              pie={sinCosto ? `${sinCosto} sin gastos ni material capturados: su utilidad sale igual a la venta` : 'Todos con costos capturados'}
            />
          </div>
          <GlassPanel className="overflow-x-auto p-2">
            <table className="tabla">
              <caption className="sr-only">Utilidad por pedido. Usa los encabezados para ordenar.</caption>
              <thead>
                <tr>
                  <th scope="col" className="pl-5" aria-sort={orden.clave === 'fecha' ? (orden.asc ? 'ascending' : 'descending') : 'none'}>
                    <BotonOrden activo={orden.clave === 'fecha'} asc={orden.asc} onClick={() => ordenar('fecha')}>Pedido</BotonOrden>
                  </th>
                  {COLUMNAS.map((c) => (
                    <th key={c.clave} scope="col" className={cn('text-right', c.oculta, c.clave === 'margen_real_pct' && 'pr-5')} aria-sort={orden.clave === c.clave ? (orden.asc ? 'ascending' : 'descending') : 'none'}>
                      <BotonOrden activo={orden.clave === c.clave} asc={orden.asc} onClick={() => ordenar(c.clave)} derecha>
                        {c.titulo}
                      </BotonOrden>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => {
                  const perdida = f.utilidad_real < 0
                  return (
                    <tr key={f.pedido_id} className={cn(perdida && 'shadow-[inset_3px_0_0_rgb(var(--luz))]')}>
                      <th scope="row" className="pl-5 text-left font-normal">
                        <span className="flex items-center gap-2">
                          <Link to={`/pedidos/${f.pedido_id}`} className="num font-semibold text-fg outline-none hover:underline focus-visible:underline">{f.folio}</Link>
                          {perdida ? (
                            <Pildora tono="luz" punto={false}>
                              <TriangleAlert className="size-3" aria-hidden /> Pérdida
                            </Pildora>
                          ) : null}
                        </span>
                        <span className="block max-w-[16rem] truncate text-xs text-fg-subtle">{f.cliente} · {fecha(f.fecha)}</span>
                      </th>
                      <td className="num text-right text-fg">{dinero(f.venta)}</td>
                      <td className="num text-right text-fg-muted max-lg:hidden">{dinero(f.costo_estimado)}</td>
                      <td className="num text-right text-fg-muted max-lg:hidden">{dinero(f.gastos)}</td>
                      <td className="num text-right text-fg-muted max-lg:hidden">
                        {dinero(f.consumo_material)}
                        {f.consumos_sin_costo ? <span className="block text-2xs text-amber-700 dark:text-luz">{f.consumos_sin_costo} sin costo</span> : null}
                      </td>
                      <td className={cn('num text-right text-base font-semibold', perdida ? 'text-red-700 dark:text-red-300' : f.costo_real === 0 ? 'text-fg-muted' : 'text-fg')}>{dinero(f.utilidad_real)}</td>
                      <td className={cn('num pr-5 text-right', perdida ? 'font-semibold text-red-700 dark:text-red-300' : 'text-fg-muted')}>
                        {f.costo_real === 0 ? (
                          <span title="Sin gastos ni material capturados: se muestra el margen estimado">
                            <span className="block">{porcentaje(f.margen_estimado_pct, 1)}</span>
                            <span className="block text-2xs text-fg-subtle">estimado</span>
                          </span>
                        ) : (
                          porcentaje(f.margen_real_pct, 1)
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </GlassPanel>
        </>
      )}
    </section>
  )
}

function BotonOrden({ activo, asc, onClick, children, derecha }: { activo: boolean; asc: boolean; onClick: () => void; children: React.ReactNode; derecha?: boolean }) {
  const Icono = !activo ? ArrowUpDown : asc ? ArrowUp : ArrowDown
  return (
    <button type="button" onClick={onClick} className={cn('inline-flex min-h-9 items-center gap-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent', derecha && 'flex-row-reverse', activo ? 'text-fg' : '')}>
      {children}
      <Icono className={cn('size-3.5', !activo && 'opacity-50')} aria-hidden />
    </button>
  )
}

function Cifra({ t, v, pie, luz }: { t: string; v: string; pie?: string; luz?: boolean }) {
  return (
    <GlassPanel className={cn('rounded-tile p-4', luz && 'shadow-[inset_3px_0_0_rgb(var(--luz))]')}>
      <p className="flex items-center gap-1.5 text-sm font-medium text-fg-muted">
        {luz ? <span className="size-2.5 rounded-full bg-luz shadow-[0_0_10px_rgba(249,194,6,0.7)]" aria-hidden /> : null}
        {t}
      </p>
      <p className="num mt-1 text-2xl font-semibold tracking-tight text-fg">{v}</p>
      {pie ? <p className="mt-0.5 text-xs text-fg-subtle">{pie}</p> : null}
    </GlassPanel>
  )
}
