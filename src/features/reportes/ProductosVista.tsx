import { Package } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { EstadoVacio, GlassPanel } from '@/components/glass'
import { cantidad, dinero } from '@/lib/format'
import { resorte } from '@/lib/motion'
import { useProductos } from './consultas'
import { descargarCsv, type RangoReporte } from './periodo'
import { CargandoSeccion, EncabezadoSeccion, ErrorSeccion } from './piezas'

const UNIDAD: Record<string, string> = { m2: 'm²', ml: 'm lineales', pieza: 'piezas', millar: 'millares' }

/** Productos más vendidos: barras horizontales por importe; cada fila es también su dato (lista accesible). */
export default function ProductosVista({ r }: { r: RangoReporte }) {
  const consulta = useProductos(r.desde, r.hasta)
  const reducir = useReducedMotion()
  if (consulta.isPending) return <CargandoSeccion alto="h-[28rem]" />
  if (consulta.isError) return <ErrorSeccion que="los productos" error={consulta.error} onReintentar={() => void consulta.refetch()} />
  const filas = consulta.data
  const max = Math.max(...filas.map((f) => f.importe), 1)
  const total = filas.reduce((s, f) => s + f.importe, 0)
  const exportar = () =>
    descargarCsv(`productos_${r.desde}_${r.hasta}.csv`, [
      ['Producto', 'Categoría', 'Cantidad', 'Unidades', 'Unidad', 'Pedidos', 'Importe'],
      ...filas.map((f) => [f.producto, f.categoria, f.cantidad, f.unidades, f.unidad, f.pedidos, f.importe]),
    ])
  return (
    <section aria-labelledby="t-productos" className="flex flex-col gap-3">
      <EncabezadoSeccion id="t-productos" titulo="Productos más vendidos" descripcion="Por importe de los pedidos del periodo (sin cancelados)" onExportar={filas.length ? exportar : undefined} />
      <GlassPanel className="rounded-module p-3 sm:p-4">
        {filas.length === 0 ? (
          <EstadoVacio icono={<Package />} titulo="Sin productos vendidos en este periodo" descripcion="Aquí verás qué se vende más cuando haya pedidos. Prueba con un periodo más amplio, como Año." />
        ) : (
          <ol className="flex flex-col" aria-label="Productos ordenados por importe">
            {filas.map((f, i) => (
              <li key={f.producto_id ?? `${f.tipo}-${i}`} className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 rounded-tile px-2 py-2.5 transition-colors hover:bg-[var(--row-hover)] sm:grid-cols-[1.75rem_minmax(10rem,16rem)_minmax(0,1fr)_auto]">
                <span className="num text-right text-sm font-semibold text-fg-subtle">{i + 1}</span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-fg">{f.producto}</p>
                  <p className="truncate text-xs text-fg-subtle">
                    {f.categoria ?? 'Sin categoría'} · <span className="num">{cantidad(f.cantidad)}</span> pzas
                    {f.unidad && f.unidad !== 'pieza' ? <> · <span className="num">{cantidad(f.unidades)}</span> {UNIDAD[f.unidad] ?? f.unidad}</> : null}
                    {' · '}
                    {f.pedidos} {f.pedidos === 1 ? 'pedido' : 'pedidos'}
                  </p>
                </div>
                <span className="col-span-1 col-start-2 row-start-2 h-2.5 overflow-hidden rounded-full bg-fg/[0.06] sm:col-start-3 sm:row-start-1" aria-hidden>
                  <motion.span
                    className={i === 0 ? 'block h-full origin-left rounded-full bg-navy-700 dark:bg-navy-300' : 'block h-full origin-left rounded-full bg-navy-500/80 dark:bg-navy-300/70'}
                    initial={reducir ? false : { scaleX: 0 }}
                    animate={{ scaleX: f.importe / max }}
                    transition={{ ...resorte.expansion, delay: reducir ? 0 : Math.min(i, 10) * 0.03 }}
                  />
                </span>
                <span className="text-right sm:col-start-4">
                  <span className="num block font-semibold text-fg">{dinero(f.importe)}</span>
                  <span className="num block text-xs text-fg-subtle">{total > 0 ? Math.round((f.importe / total) * 100) : 0}%</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </GlassPanel>
    </section>
  )
}
