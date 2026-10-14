import { UserRound } from 'lucide-react'
import { EstadoVacio, GlassPanel } from '@/components/glass'
import { dinero, porcentaje } from '@/lib/format'
import { cn, iniciales } from '@/lib/utils'
import { useComisionesPeriodo, useVendedores } from './consultas'
import { descargarCsv, type RangoReporte } from './periodo'
import { CargandoSeccion, EncabezadoSeccion, ErrorSeccion } from './piezas'

function Tasa({ valor }: { valor: number | null }) {
  if (valor === null) return <span className="text-fg-subtle">—</span>
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-fg/[0.08]" aria-hidden>
        <span className="block h-full rounded-full bg-navy-600 dark:bg-navy-300" style={{ width: `${Math.min(valor, 100)}%` }} />
      </span>
      <span className="num font-semibold text-fg">{porcentaje(valor)}</span>
    </span>
  )
}

export default function VendedoresVista({ r }: { r: RangoReporte }) {
  const consulta = useVendedores(r.desde, r.hasta)
  const comisiones = useComisionesPeriodo(r.desde, r.hasta)
  if (consulta.isPending) return <CargandoSeccion />
  if (consulta.isError) return <ErrorSeccion que="el desempeño de vendedores" error={consulta.error} onReintentar={() => void consulta.refetch()} />
  const com = new Map((comisiones.data ?? []).map((c) => [c.vendedor_id, c.comision]))
  const filas = consulta.data.map((v) => ({ ...v, comision: v.vendedor_id ? (com.get(v.vendedor_id) ?? 0) : null }))
  const lider = filas.reduce<string | null>((m, f) => (f.vendido > 0 && (m === null || f.vendido > (filas.find((x) => x.nombre === m)?.vendido ?? 0)) ? f.nombre : m), null)
  const exportar = () =>
    descargarCsv(`vendedores_${r.desde}_${r.hasta}.csv`, [
      ['Vendedor', 'Cotizaciones', 'Cotizado', 'Aceptadas', 'Rechazadas', 'Tasa de cierre %', 'Pedidos', 'Vendido', 'Cobrado', 'Ticket promedio', 'Comisión'],
      ...filas.map((f) => [f.nombre, f.cotizaciones, f.cotizado, f.aceptadas, f.rechazadas, f.tasa_cierre, f.pedidos, f.vendido, f.cobrado, f.ticket_promedio, f.comision]),
    ])
  return (
    <section aria-labelledby="t-vend" className="flex flex-col gap-3">
      <EncabezadoSeccion id="t-vend" titulo="Vendedores" descripcion="Tasa de cierre = aceptadas entre aceptadas y rechazadas · comisión sobre lo cobrado sin IVA" onExportar={filas.length ? exportar : undefined} />
      {filas.length === 0 ? (
        <GlassPanel>
          <EstadoVacio icono={<UserRound />} titulo="Sin actividad de ventas en este periodo" descripcion="Cuando el equipo envíe cotizaciones o cierre pedidos, verás aquí su desempeño." />
        </GlassPanel>
      ) : (
        <>
          <GlassPanel className="hidden p-2 md:block">
            <table className="tabla">
              <caption className="sr-only">Desempeño de vendedores del {r.texto}</caption>
              <thead>
                <tr>
                  <th scope="col" className="pl-5">Vendedor</th>
                  <th scope="col" className="text-right">Cotizaciones</th>
                  <th scope="col">Tasa de cierre</th>
                  <th scope="col" className="text-right">Pedidos</th>
                  <th scope="col" className="text-right">Vendido</th>
                  <th scope="col" className="text-right">Cobrado</th>
                  <th scope="col" className="pr-5 text-right">Comisión</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.vendedor_id ?? 'sin'}>
                    <th scope="row" className="pl-5 text-left font-normal">
                      <Persona nombre={f.nombre} lider={f.nombre === lider} />
                    </th>
                    <td className="num text-right text-fg-muted">
                      {f.cotizaciones} <span className="text-xs text-fg-subtle">· {dinero(f.cotizado)}</span>
                    </td>
                    <td><Tasa valor={f.tasa_cierre} /></td>
                    <td className="num text-right text-fg-muted">{f.pedidos}</td>
                    <td className="num text-right text-base font-semibold text-fg">{dinero(f.vendido)}</td>
                    <td className="num text-right text-fg">{dinero(f.cobrado)}</td>
                    <td className="num pr-5 text-right text-fg">{f.comision === null ? '—' : dinero(f.comision)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GlassPanel>
          <ul className="grid gap-2.5 md:hidden" aria-label="Desempeño de vendedores">
            {filas.map((f) => (
              <li key={f.vendedor_id ?? 'sin'}>
                <GlassPanel className="rounded-module p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Persona nombre={f.nombre} lider={f.nombre === lider} />
                    <span className="num text-lg font-semibold text-fg">{dinero(f.vendido)}</span>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <Dato t="Tasa de cierre"><Tasa valor={f.tasa_cierre} /></Dato>
                    <Dato t="Cotizaciones"><span className="num">{f.cotizaciones}</span></Dato>
                    <Dato t="Cobrado"><span className="num">{dinero(f.cobrado)}</span></Dato>
                    <Dato t="Comisión"><span className="num">{f.comision === null ? '—' : dinero(f.comision)}</span></Dato>
                  </dl>
                </GlassPanel>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function Dato({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-fg-subtle">{t}</dt>
      <dd className="font-medium text-fg">{children}</dd>
    </div>
  )
}

function Persona({ nombre, lider }: { nombre: string; lider?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className={cn('grid size-8 shrink-0 place-items-center rounded-full text-2xs font-bold', lider ? 'bg-luz text-navy-900 shadow-[0_0_12px_rgba(249,194,6,0.55)]' : 'bg-gradient-to-br from-navy-500 to-navy-700 text-white')} aria-hidden>
        {iniciales(nombre)}
      </span>
      <span className="font-semibold text-fg">{nombre}</span>
      {lider ? <span className="sr-only">(más ventas del periodo)</span> : null}
    </span>
  )
}
